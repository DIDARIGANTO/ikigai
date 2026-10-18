#!/usr/bin/env bash
# Выкладка Ikigai на Vercel одной командой (docs/DEPLOY.md): создаёт проект, кладёт в него публичные настройки
# облака из .env (адрес Supabase, публичный ключ, имя бота) и выкладывает сайт.
#
# Запуск из папки проекта:   bash scripts/deploy-vercel.sh
# Нужно: заполненный .env (его делает scripts/connect-telegram.sh) и вход в Vercel (скрипт сам предложит войти).
# Секретов скрипт не трогает: в .env лежат только публичные значения, которые по замыслу встраиваются в сайт.
# Сайт закрыт паролем (scripts/site-password.sh): без пароля на Vercel выкладка отдаёт всем только окно пароля,
# поэтому скрипт сначала убеждается, что пароль задан, а после выкладки проверяет, что сайт и правда закрыт.
#
# Проверка без сети и без изменений:  DRY_RUN=1 bash scripts/deploy-vercel.sh

set -euo pipefail
cd "$(dirname "$0")/.."

DRY_RUN="${DRY_RUN:-0}"
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die() {
  printf '\n\033[31mОшибка:\033[0m %s\n' "$*" >&2
  printf 'Скрипт остановлен. Чтобы начать заново, введи в терминале: bash scripts/deploy-vercel.sh\n' >&2
  exit 1
}

# Команды, которые меняют что-то снаружи, в режиме проверки только печатаются.
run() {
  if [ "$DRY_RUN" = "1" ]; then
    printf '  [проверка] %s\n' "$*"
  else
    "$@"
  fi
}

errlog="$(mktemp)"
pagelog="$(mktemp)"
trap 'rm -f "$errlog" "$pagelog"' EXIT

# Значение переменной из .env без кавычек и пробелов по краям (последнее, если строк несколько).
env_value() {
  [ -f .env ] || return 0
  sed -n "s/^$1=//p" .env | tail -n 1 | tr -d "\r\"'" | sed -e 's/^ *//' -e 's/ *$//'
}

say "Выкладка Ikigai на Vercel"

SUPABASE_URL="$(env_value VITE_SUPABASE_URL)"
SUPABASE_KEY="$(env_value VITE_SUPABASE_ANON_KEY)"
BOT_NAME="$(env_value VITE_TELEGRAM_BOT)"

[ -n "$SUPABASE_URL" ] || die "В файле .env нет VITE_SUPABASE_URL. Сначала подключи облако (docs/SETUP.md) или запусти scripts/connect-telegram.sh."
[ -n "$SUPABASE_KEY" ] || die "В файле .env нет VITE_SUPABASE_ANON_KEY (публичный ключ Supabase, вид sb_publishable_…)."
case "$SUPABASE_URL" in https://*.supabase.co) ;; *) die "VITE_SUPABASE_URL должен выглядеть как https://XXXX.supabase.co, а в .env: $SUPABASE_URL" ;; esac
# В сайт попадает только публичный ключ: секретный в браузере читает любой посетитель.
case "$SUPABASE_KEY" in sb_secret_*) die "В VITE_SUPABASE_ANON_KEY лежит СЕКРЕТНЫЙ ключ (sb_secret_…). Его нельзя встраивать в сайт: возьми публичный (sb_publishable_…) в Supabase → Project Settings → API Keys." ;; esac
if printf '%s' "$SUPABASE_KEY" | cut -d. -f2 | tr '_-' '/+' | base64 -d 2>/dev/null | grep -q 'service_role'; then
  die "В VITE_SUPABASE_ANON_KEY лежит служебный ключ service_role. Его нельзя встраивать в сайт: возьми публичный (anon / publishable)."
fi
ok "Настройки облака из .env: ${SUPABASE_URL}"
if [ -n "$BOT_NAME" ]; then ok "Бот: @${BOT_NAME}"; else warn "VITE_TELEGRAM_BOT не задан: в настройках сайта не будет кнопки привязки Telegram."; fi

say "Вхожу в Vercel"
echo "(Первый раз скачивается программа Vercel — минуту экран может молчать.)"
if [ "$DRY_RUN" = "1" ]; then
  echo "  [проверка] vercel whoami пропущен"
else
  WHO="$(npx --yes vercel whoami 2>/dev/null | tail -n 1 || true)"
  if [ -z "$WHO" ]; then
    echo "Откроется вход: выбери способ, подтверди в браузере и вернись сюда."
    npx --yes vercel login
    WHO="$(npx --yes vercel whoami 2>/dev/null | tail -n 1 || true)"
    [ -n "$WHO" ] || die "Не удалось войти в Vercel."
  fi
  ok "Вход выполнен: ${WHO}"
fi

say "Создаю проект на Vercel"
# --yes: проект создаётся под именем папки (ikigai) в личной области; повторный запуск просто подхватывает его.
run npx --yes vercel link --yes
ok "Проект привязан"

say "Кладу настройки облака в Vercel"
set_env() {
  local name="$1" value="$2"
  if [ "$DRY_RUN" = "1" ]; then
    printf '  [проверка] vercel env add %s production\n' "$name"
    return 0
  fi
  # Сайт собирается на сервере Vercel, а Vite вшивает VITE_* при сборке, поэтому значения нужны там.
  if printf '%s' "$value" | npx --yes vercel env add "$name" production --yes >"$errlog" 2>&1; then
    ok "${name}: добавлена"
  elif npx --yes vercel env update "$name" production --value "$value" --yes >"$errlog" 2>&1; then
    ok "${name}: обновлена"
  else
    cat "$errlog" >&2
    die "Не получилось положить ${name} в Vercel. Текст ошибки выше, пришли его мне."
  fi
}
set_env VITE_SUPABASE_URL "$SUPABASE_URL"
set_env VITE_SUPABASE_ANON_KEY "$SUPABASE_KEY"
if [ -n "$BOT_NAME" ]; then set_env VITE_TELEGRAM_BOT "$BOT_NAME"; fi

say "Проверяю пароль на сайт"
# Без пароля сайт закрывается наглухо (503 всем, включая владельца), поэтому выкладывать без него нельзя.
# Список читаем в переменную, а не через конвейер: grep -q выходит раньше конца вывода, и при pipefail это давало ложное «нет».
secrets_ready() {
  local names
  names="$(npx --yes vercel env ls production 2>/dev/null || true)"
  grep -Eq '(^|[^A-Za-z0-9_])SITE_PASSWORD([^A-Za-z0-9_]|$)' <<<"$names" && grep -Eq '(^|[^A-Za-z0-9_])SITE_GATE_SECRET([^A-Za-z0-9_]|$)' <<<"$names"
}
if [ "$DRY_RUN" = "1" ]; then
  echo "  [проверка] vercel env ls production: ищу SITE_PASSWORD и SITE_GATE_SECRET"
elif secrets_ready; then
  ok "Пароль на сайт задан"
elif [ -t 0 ]; then
  echo "Пароль на сайт ещё не задан, задаём сейчас."
  bash scripts/site-password.sh
  secrets_ready || die "Пароль на сайт не появился на Vercel."
else
  die "Пароль на сайт ещё не задан, а здесь ввести его нельзя. Открой панель Terminal (рядом с чатом) и введи там: bash scripts/site-password.sh — потом запусти выкладку снова."
fi

say "Выкладываю сайт"
echo "(Сборка на сервере Vercel занимает одну-две минуты.)"
if [ "$DRY_RUN" = "1" ]; then
  echo "  [проверка] vercel deploy --prod --yes"
  URL="https://ikigai-проверка.vercel.app"
  SITE="$URL"
else
  # Адрес выкладки идёт в stdout, ход сборки — в stderr: его показываем и заодно читаем, чтобы найти короткий адрес.
  if ! URL="$(npx --yes vercel deploy --prod --yes 2> >(tee "$errlog" >&2))"; then
    die "Выкладка не удалась. Причина в строках выше: если там ошибка сборки, пришли мне её текст."
  fi
  sleep 1
  # «Aliased …» — постоянный адрес проекта (в разных версиях Vercel с двоеточием и без него); адрес самой выкладки он прячет за входом в свой аккаунт.
  ALIAS="$(sed -n 's/.*Aliased:\{0,1\} *\(https:\/\/[^ ]*\).*/\1/p' "$errlog" | tail -n 1)"
  SITE="${ALIAS:-$URL}"
  [ -n "$ALIAS" ] || warn "Короткий адрес не нашёл: если сайт просит войти в Vercel, открой адрес из строки Aliased выше."
fi
ok "Сайт выложен"

say "Проверяю, что сайт закрыт"
# Не надеемся, а смотрим: посторонний без пароля должен получить окно пароля, а не приложение.
http_code() { curl -sS -m 20 -o "${2:-/dev/null}" -w '%{http_code}' -H 'accept: text/html' "$1" 2>/dev/null || true; }
if [ "$DRY_RUN" = "1" ]; then
  echo "  [проверка] curl ${SITE}/ — жду окно пароля (401), /sw.js — 401, /robots.txt — 200"
else
  code=""
  for _ in 1 2 3 4 5 6; do
    code="$(http_code "${SITE}/" "$pagelog")"
    [ "$code" = "401" ] && break
    sleep 3 # новая выкладка подхватывается адресом не мгновенно
  done
  case "$code" in
    401) grep -q 'type="password"' "$pagelog" && ok "Без пароля сайт отдаёт только окно пароля (ответ 401)" || warn "Ответ 401, но окна пароля в нём нет: пришли мне это." ;;
    200) die "САЙТ ОТКРЫТ ВСЕМ: без пароля он отдал приложение. Пароль на сайт не сработал; пришли мне это сообщение." ;;
    503) die "Сайт закрыт для всех, включая тебя: пароль не дошёл до выложенной версии (ответ 503). Пришли мне это сообщение." ;;
    *) die "Сайт ответил неожиданным кодом '${code:-нет ответа}'. Пришли мне это сообщение." ;;
  esac
  [ "$(http_code "${SITE}/sw.js")" = "401" ] && ok "Файлы приложения без пароля тоже закрыты (/sw.js → 401)" || warn "/sw.js без пароля отдался: файлы приложения не закрыты, пришли мне это."
  [ "$(http_code "${SITE}/robots.txt")" = "200" ] && ok "Общие файлы (значки, robots.txt) отдаются как положено" || warn "/robots.txt не отдался: после ввода пароля сайт может не открыться, пришли мне это."
fi

say "Готово"
echo "Твой сайт: ${SITE}"
if [ "$DRY_RUN" != "1" ] && command -v pbcopy >/dev/null 2>&1; then
  printf '%s' "$SITE" | pbcopy
  echo "(Адрес уже скопирован: вставляй его через Cmd+V.)"
fi
echo
echo "Сайт закрыт паролем: при первом заходе с каждого устройства спросят пароль на сайт (потом браузер помнит 90 дней), а внутри остаётся вход по ссылке из письма."
echo
echo "Теперь один раз скажи Supabase про этот адрес (supabase.com → проект ikigai → Authentication → URL Configuration):"
echo "  1) Site URL: ${SITE}"
echo "  2) Redirect URLs → Add URL: ${SITE}/**  → Save"
echo "Потом открой сайт, войди по ссылке из письма и напиши мне: после этого закроем регистрацию посторонним."
