#!/usr/bin/env bash
# Обновление бота одной командой (docs/SETUP.md, раздел 6): выкладывает свежий код обеих функций
# и включает расписание «раз в минуту» — по нему бот присылает напоминания в назначенное время и утреннюю сводку.
#
# Запуск из папки проекта:   bash scripts/update-bot.sh
# Нужно: подключённый бот (scripts/connect-telegram.sh уже запускался) и заполненный .env.
# Ключей и токенов спрашивать не будет: пароль для расписания скрипт придумывает сам и кладёт только в Supabase.
# Запускать можно сколько угодно раз: каждый раз код обновляется, а расписание перезаписывается без дублей.
#
# Только код, без пароля и расписания (быстрее, когда менялся лишь код бота):  CODE_ONLY=1 bash scripts/update-bot.sh
# Проверка без сети и без изменений:  DRY_RUN=1 bash scripts/update-bot.sh

set -euo pipefail
cd "$(dirname "$0")/.."

DRY_RUN="${DRY_RUN:-0}"
CODE_ONLY="${CODE_ONLY:-0}"
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die() {
  printf '\n\033[31mОшибка:\033[0m %s\n' "$*" >&2
  printf 'Скрипт остановлен. Чтобы начать заново, введи в терминале: bash scripts/update-bot.sh\n' >&2
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

tmp_env=""
tmp_sql=""
cleanup() {
  [ -n "$tmp_env" ] && rm -f "$tmp_env"
  [ -n "$tmp_sql" ] && rm -f "$tmp_sql"
  return 0
}
trap cleanup EXIT

say "Обновление бота Ikigai"

# Reference ID — буквы из адреса проекта: https://XXXX.supabase.co
REF="${SUPABASE_REF:-}"
if [ -z "$REF" ] && [ -f .env ]; then
  REF="$(sed -n 's/^VITE_SUPABASE_URL=//p' .env | tail -n 1 | tr -d "\r\"' " | sed -e 's#^https\{0,1\}://##' -e 's#\.supabase\.co.*$##')"
fi
[ -n "$REF" ] || die "Не нашёл адрес проекта Supabase в .env (VITE_SUPABASE_URL). Запусти scripts/connect-telegram.sh или передай SUPABASE_REF=XXXX."
case "$REF" in *[!a-z0-9]*) die "Reference ID состоит только из латинских букв и цифр, а нашёл: $REF" ;; esac
ok "Проект Supabase: ${REF}"

say "Вхожу в Supabase"
echo "(Если программа Supabase ещё не скачана, минуту экран может молчать.)"
if [ "$DRY_RUN" = "1" ] || npx --yes supabase projects list >/dev/null 2>&1; then
  ok "Вход уже выполнен"
else
  echo "Дальше три действия:"
  echo "  1) нажми Enter — откроется браузер;"
  echo "  2) войди в Supabase, если попросит: на странице появится код подтверждения — скопируй его;"
  echo "  3) вернись сюда, вставь код и нажми Enter."
  run npx --yes supabase login
fi

CRON_SECRET=""
if [ "$CODE_ONLY" != "1" ]; then
  say "Придумываю пароль для расписания"
  # Расписание в базе и функция cron-tick проверяют друг друга по этому паролю; старый пароль после запуска перестаёт работать.
  CRON_SECRET="ikigai-cron-$(openssl rand -hex 16)"
  tmp_env="$(mktemp)"
  chmod 600 "$tmp_env"
  printf 'CRON_SECRET=%s\n' "$CRON_SECRET" > "$tmp_env"
  run npx --yes supabase secrets set --env-file "$tmp_env" --project-ref "$REF"
  ok "Пароль положен в Supabase"
fi

say "Выкладываю функции бота"
# --use-api: сборку делает сервер Supabase, поэтому Docker на компьютере не нужен.
run npx --yes supabase functions deploy telegram-webhook --no-verify-jwt --use-api --project-ref "$REF"
run npx --yes supabase functions deploy cron-tick --no-verify-jwt --use-api --project-ref "$REF"
ok "Функции выложены"

# Код ответа функции без пароля (403 = жива и закрыта от посторонних); свежевыложенной иногда нужно несколько секунд.
status_of() {
  local code="000" _
  for _ in 1 2 3 4; do
    code="$(curl -sS -m 30 -o /dev/null -w '%{http_code}' -X POST "$1" 2>/dev/null || true)"
    [ "$code" = "403" ] && break
    sleep 4
  done
  printf '%s' "$code"
}

say "Проверяю, что функции отвечают"
if [ "$DRY_RUN" = "1" ]; then
  echo "  [проверка] запросы к функциям пропущены"
else
  for fn in telegram-webhook cron-tick; do
    code="$(status_of "https://${REF}.supabase.co/functions/v1/${fn}")"
    [ "$code" = "403" ] || die "Функция ${fn} ответила кодом ${code}, ожидал 403. Подробности: Supabase → Edge Functions → ${fn} → Logs."
    ok "${fn} работает и чужих запросов не принимает"
  done
fi

if [ "$CODE_ONLY" = "1" ]; then
  say "Готово"
  echo "Код бота обновлён; пароль и расписание не трогал."
  exit 0
fi

say "Включаю расписание: раз в минуту"
tmp_sql="$(mktemp)"
chmod 600 "$tmp_sql"
sed -e "s#<PROJECT_REF>#${REF}#g" -e "s#<CRON_SECRET>#${CRON_SECRET}#g" supabase/migrations/0002_cron.sql > "$tmp_sql"
if [ "$DRY_RUN" = "1" ]; then
  echo "  [проверка] supabase db query --linked --project-ref ${REF} --file <расписание>"
elif npx --yes supabase db query --linked --project-ref "$REF" --file "$tmp_sql" >/dev/null 2>&1; then
  ok "Расписание записано в базу"
else
  # Запасной путь: то же самое руками через редактор SQL в Supabase.
  warn "Автоматически записать расписание не вышло. Сделай это руками, это минута:"
  if command -v pbcopy >/dev/null 2>&1; then
    pbcopy < "$tmp_sql"
    echo "  1) Скрипт уже скопировал нужный SQL в буфер обмена."
  else
    echo "  1) Скопируй текст файла supabase/migrations/0002_cron.sql, подставив ${REF} и ${CRON_SECRET}."
  fi
  echo "  2) Supabase → проект ikigai → SQL Editor → New query → вставь (Cmd+V) → Run."
  die "Расписание не включено, пока не выполнен SQL из шага выше."
fi

say "Проверяю расписание"
if [ "$DRY_RUN" = "1" ]; then
  echo "  [проверка] select jobname, schedule, active from cron.job"
else
  JOB="$(npx --yes supabase db query --linked --project-ref "$REF" -o json "select jobname, schedule, active from cron.job where jobname = 'ikigai-tick'" 2>/dev/null || true)"
  case "$JOB" in
    *ikigai-tick*'* * * * *'*) ok "Задание ikigai-tick включено: каждую минуту" ;;
    *ikigai-tick*) warn "Задание ikigai-tick есть, но расписание отличается от «каждую минуту»: ${JOB}" ;;
    *) warn "Не смог прочитать задание из базы. Проверь вручную в SQL Editor: select jobname, schedule, active from cron.job;" ;;
  esac
  # Пробный тик с паролем: функция должна ответить 200 и числом отправленного.
  TICK="$(printf 'header = "x-cron-secret: %s"\n' "$CRON_SECRET" | curl -sS -m 60 -X POST --config - "https://${REF}.supabase.co/functions/v1/cron-tick" 2>/dev/null || true)"
  case "$TICK" in
    *'"alerts"'*) ok "Пробный тик прошёл: ${TICK}" ;;
    *) warn "Пробный тик ответил неожиданно: ${TICK:-пусто}. Если напоминания не придут, пришли мне этот текст." ;;
  esac
fi

say "Готово"
echo "Бот присылает напоминания в назначенную минуту и утреннюю сводку в заданное время."
echo "Проверь: добавь на сайте напоминание на ближайшие минуты (с временем) — оно придёт в Telegram."
