#!/usr/bin/env bash
# Выкладка Ikigai на Vercel одной командой (docs/DEPLOY.md): создаёт проект, кладёт в него публичные настройки
# облака из .env (адрес Supabase, публичный ключ, имя бота) и выкладывает сайт.
#
# Запуск из папки проекта:   bash scripts/deploy-vercel.sh
# Нужно: заполненный .env (его делает scripts/connect-telegram.sh) и вход в Vercel (скрипт сам предложит войти).
# Секретов скрипт не трогает: в .env лежат только публичные значения, которые по замыслу встраиваются в сайт.
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
trap 'rm -f "$errlog"' EXIT

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
  # «Aliased: …» — постоянный адрес проекта; адрес самой выкладки Vercel может прятать за входом в свой аккаунт.
  ALIAS="$(sed -n 's/.*Aliased: *\(https:\/\/[^ ]*\).*/\1/p' "$errlog" | tail -n 1)"
  SITE="${ALIAS:-$URL}"
  [ -n "$ALIAS" ] || warn "Короткий адрес не нашёл: если сайт просит войти в Vercel, открой адрес из строки Aliased выше."
fi
ok "Сайт выложен"

say "Готово"
echo "Твой сайт: ${SITE}"
if [ "$DRY_RUN" != "1" ] && command -v pbcopy >/dev/null 2>&1; then
  printf '%s' "$SITE" | pbcopy
  echo "(Адрес уже скопирован: вставляй его через Cmd+V.)"
fi
echo
echo "Теперь один раз скажи Supabase про этот адрес (supabase.com → проект ikigai → Authentication → URL Configuration):"
echo "  1) Site URL: ${SITE}"
echo "  2) Redirect URLs → Add URL: ${SITE}/**  → Save"
echo "Потом открой сайт, войди по ссылке из письма и напиши мне: после этого закроем регистрацию посторонним."
