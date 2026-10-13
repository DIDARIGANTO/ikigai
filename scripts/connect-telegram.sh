#!/usr/bin/env bash
# Подключение Telegram-бота Ikigai одной командой (docs/SETUP.md, шаги 5.4–5.7):
# кладёт секреты в Supabase, выкладывает функции бота и говорит Telegram, куда слать сообщения.
#
# Запуск из папки проекта:   bash scripts/connect-telegram.sh
# Сначала нужны: проект Supabase с таблицами (разделы 1–2), токен бота от @BotFather (5.1), ключ Anthropic (5.3).
# Токены и ключи вводятся в терминале и не показываются на экране; нигде, кроме Supabase и Telegram, не сохраняются.
# Ключи Anthropic и Groq сразу проверяются настоящим запросом (он стоит доли цента), а после выкладки
# скрипт стучится в функцию бота — так любая ошибка видна здесь, а не позже в чате с ботом.
#
# Reference ID можно передать заранее, тогда первый вопрос пропускается:  SUPABASE_REF=abcdefgh bash scripts/connect-telegram.sh
# Проверка без сети и без изменений:  DRY_RUN=1 bash scripts/connect-telegram.sh

set -euo pipefail
cd "$(dirname "$0")/.."

DRY_RUN="${DRY_RUN:-0}"
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die() {
  printf '\n\033[31mОшибка:\033[0m %s\n' "$*" >&2
  printf 'Скрипт остановлен. Чтобы начать заново, введи в терминале: bash scripts/connect-telegram.sh\n' >&2
  exit 1
}

ask() {
  local value
  read -r -p "$1: " value
  printf '%s' "$value"
}
ask_secret() {
  local value
  read -r -s -p "$1: " value
  printf '\n' >&2
  printf '%s' "$value"
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
probe_body="$(mktemp)"
cleanup() {
  rm -f "$probe_body"
  [ -n "$tmp_env" ] && rm -f "$tmp_env"
}
trap cleanup EXIT

# Ключи уходят в curl через конфиг на stdin, а не аргументом: так их не видно в списке процессов.
# Проверки печатают HTTP-код ответа (000 — нет связи), тело ответа остаётся в $probe_body.
check_anthropic() {
  printf 'header = "x-api-key: %s"\n' "$1" | curl -sS -m 30 -o "$probe_body" -w '%{http_code}' --config - \
    -H 'anthropic-version: 2023-06-01' -H 'content-type: application/json' \
    --data '{"model":"claude-haiku-4-5","max_tokens":1,"messages":[{"role":"user","content":"ok"}]}' \
    https://api.anthropic.com/v1/messages 2>/dev/null || true
}
check_groq() {
  printf 'header = "Authorization: Bearer %s"\n' "$1" | curl -sS -m 30 -o "$probe_body" -w '%{http_code}' --config - \
    https://api.groq.com/openai/v1/models 2>/dev/null || true
}
error_text() { sed -n 's/.*"message" *: *"\([^"]*\)".*/\1/p' "$probe_body" | head -n 1; }

KEY_VALUE=""
PROBE_STATUS=""
# Спрашивает ключ и сразу проверяет его; если сервис ключ не принял — спрашивает снова (три попытки).
# $1 — вопрос, $2 — функция проверки, $3 — название сервиса, $4 = optional: пустой ввод (Enter) разрешён.
read_key() {
  local attempt=1 value
  KEY_VALUE=""
  PROBE_STATUS=""
  while :; do
    value="$(ask_secret "$1")"
    value="$(printf '%s' "$value" | tr -d '[:space:]')"
    if [ -z "$value" ]; then
      [ "${4:-}" = "optional" ] && return 0
      warn "Ключ не введён."
    elif [ -n "$(printf '%s' "$value" | LC_ALL=C tr -d 'A-Za-z0-9_-')" ]; then
      warn "В ключе есть лишние символы — скопируй его целиком, без кавычек."
    elif [ "$DRY_RUN" = "1" ]; then
      KEY_VALUE="$value"
      return 0
    else
      PROBE_STATUS="$("$2" "$value")"
      PROBE_STATUS="${PROBE_STATUS:-000}"
      case "$PROBE_STATUS" in
        401 | 403) warn "$3 не принял ключ (код ${PROBE_STATUS}). Ключи показываются один раз; если потерял — создай новый." ;;
        *) KEY_VALUE="$value"; return 0 ;;
      esac
    fi
    [ "$attempt" -lt 3 ] || die "Не получилось с трёх попыток. Запусти команду ещё раз, когда ключ будет под рукой."
    attempt=$((attempt + 1))
  done
}

BOT_TOKEN=""
BOT_NAME=""
# Спрашивает токен бота и сразу проверяет его у Telegram (getMe); если не подошёл — спрашивает снова (три попытки).
read_bot_token() {
  local attempt=1 value reply problem
  while :; do
    value="$(ask_secret "2/4  Токен бота от @BotFather (вид 1234567890:AAH…)")"
    value="$(printf '%s' "$value" | tr -d '[:space:]')"
    problem=""
    case "$value" in
      "") problem="Токен не введён." ;;
      [0-9]*:*)
        if [ -n "$(printf '%s' "$value" | LC_ALL=C tr -d 'A-Za-z0-9_:-')" ]; then
          problem="В токене лишние символы — скопируй его целиком, без кавычек."
        fi
        ;;
      *) problem="Это не похоже на токен: он начинается с числа, потом двоеточие и длинная строка (1234567890:AAH…)." ;;
    esac
    if [ -z "$problem" ]; then
      if [ "$DRY_RUN" = "1" ]; then
        BOT_TOKEN="$value"
        BOT_NAME="ikigai_test_bot"
        echo "  [проверка] getMe пропущен"
        return 0
      fi
      reply="$(printf 'url = "https://api.telegram.org/bot%s/getMe"\n' "$value" | curl -sS -m 30 --config - 2>&1 || true)"
      case "$reply" in
        *'"ok":true'*)
          BOT_TOKEN="$value"
          BOT_NAME="$(printf '%s' "$reply" | sed -n 's/.*"username" *: *"\([^"]*\)".*/\1/p' | head -n 1)"
          [ -n "$BOT_NAME" ] && return 0
          problem="Telegram ответил, но имени бота в ответе нет."
          ;;
        *'"ok":false'*)
          problem="Telegram не принял этот токен (ответ: $(printf '%s' "$reply" | sed -n 's/.*"description" *: *"\([^"]*\)".*/\1/p' | head -n 1))."
          ;;
        *) problem="Нет связи с Telegram: ${reply:-пустой ответ}." ;;
      esac
    fi
    warn "$problem"
    [ "$attempt" -lt 3 ] || die "Не получилось с трёх попыток. Токен берётся заново так: в Telegram открой @BotFather, отправь /mybots, выбери бота и нажми API Token."
    attempt=$((attempt + 1))
  done
}

say "Подключение Telegram-бота Ikigai"
echo "Нужно ввести четыре вещи. Токен и ключи при вводе не видны — это нормально."

REF="${SUPABASE_REF:-}"
if [ -n "$REF" ]; then
  echo "1/4  Reference ID проекта Supabase: ${REF}"
else
  REF="$(ask "1/4  Reference ID проекта Supabase (буквы из адреса https://XXXX.supabase.co)")"
fi
REF="$(printf '%s' "$REF" | tr -d '[:space:]' | sed -e 's#^https\{0,1\}://##' -e 's#\.supabase\.co.*$##')"
[ -n "$REF" ] || die "Reference ID не введён."
case "$REF" in *[!a-z0-9]*) die "Reference ID состоит только из латинских букв и цифр, а ввели: $REF" ;; esac

read_bot_token
ok "Бот найден: @${BOT_NAME}"

ANTHROPIC_LOW_BALANCE=0
read_key "3/4  Ключ Anthropic (вид sk-ant-…) — им бот разбирает дела" check_anthropic "Anthropic"
ANTHROPIC_KEY="$KEY_VALUE"
if [ "$DRY_RUN" = "1" ]; then
  echo "  [проверка] запрос к Anthropic пропущен"
else
  case "$PROBE_STATUS" in
    200) ok "Ключ Anthropic работает" ;;
    400)
      if grep -qi 'credit balance' "$probe_body"; then
        ANTHROPIC_LOW_BALANCE=1
        warn "Ключ верный, но на счёте Anthropic нет денег — пока их нет, бот не разберёт ни одного дела."
        warn "Пополни: console.anthropic.com → Settings → Billing → Buy credits (5 долларов хватит надолго)."
      else
        warn "Anthropic ответил ошибкой 400: $(error_text)"
      fi
      ;;
    000) warn "Нет связи с Anthropic — ключ не проверен." ;;
    *) warn "Anthropic ответил кодом ${PROBE_STATUS}: ключ принят, но проверить работу не удалось." ;;
  esac
fi

read_key "4/4  Ключ Groq (вид gsk_…) для голосовых; Enter — пропустить" check_groq "Groq" optional
GROQ_KEY="$KEY_VALUE"
if [ -z "$GROQ_KEY" ]; then
  echo "  Без ключа Groq голосовые не распознаются, а текст бот разбирает как обычно; ключ можно добавить позже."
elif [ "$DRY_RUN" != "1" ]; then
  case "$PROBE_STATUS" in
    200) ok "Ключ Groq работает" ;;
    000) warn "Нет связи с Groq — ключ не проверен." ;;
    *) warn "Groq ответил кодом ${PROBE_STATUS}: ключ принят, но проверить работу не удалось." ;;
  esac
fi

# Придуманные пароли: бот проверяет по ним, что вебхук и рассылка вызваны не посторонними.
WEBHOOK_SECRET="ikigai-hook-$(openssl rand -hex 16)"
CRON_SECRET="ikigai-cron-$(openssl rand -hex 16)"

say "Вхожу в Supabase"
echo "(Первый раз скачивается программа Supabase — минуту-две экран может молчать.)"
if [ "$DRY_RUN" = "1" ] || npx --yes supabase projects list >/dev/null 2>&1; then
  ok "Вход уже выполнен"
else
  echo "Дальше три действия:"
  echo "  1) нажми Enter — откроется браузер;"
  echo "  2) войди в Supabase, если попросит: на странице появится код подтверждения — скопируй его;"
  echo "  3) вернись сюда, вставь код и нажми Enter."
  run npx --yes supabase login
fi

say "Кладу секреты в Supabase"
tmp_env="$(mktemp)"
chmod 600 "$tmp_env"
{
  printf 'TELEGRAM_BOT_TOKEN=%s\n' "$BOT_TOKEN"
  printf 'TELEGRAM_WEBHOOK_SECRET=%s\n' "$WEBHOOK_SECRET"
  printf 'ANTHROPIC_API_KEY=%s\n' "$ANTHROPIC_KEY"
  printf 'CRON_SECRET=%s\n' "$CRON_SECRET"
  if [ -n "$GROQ_KEY" ]; then printf 'GROQ_API_KEY=%s\n' "$GROQ_KEY"; fi
} > "$tmp_env"
run npx --yes supabase secrets set --env-file "$tmp_env" --project-ref "$REF"
ok "Секреты сохранены$( [ -n "$GROQ_KEY" ] && printf ' (и ключ для голосовых)' )"

say "Выкладываю функции бота"
# --use-api: сборку делает сервер Supabase, поэтому Docker на компьютере не нужен.
run npx --yes supabase functions deploy telegram-webhook --no-verify-jwt --use-api --project-ref "$REF"
run npx --yes supabase functions deploy cron-tick --no-verify-jwt --use-api --project-ref "$REF"
ok "Функции выложены"

say "Проверяю, что функция бота отвечает"
HOOK_URL="https://${REF}.supabase.co/functions/v1/telegram-webhook"
if [ "$DRY_RUN" = "1" ]; then
  echo "  [проверка] запрос к ${HOOK_URL} пропущен"
else
  # Без пароля вебхука функция обязана ответить 403: значит, она запущена и закрыта от посторонних.
  # Только что выложенной функции иногда нужно несколько секунд, поэтому пробуем до четырёх раз.
  HOOK_STATUS="000"
  for _ in 1 2 3 4; do
    HOOK_STATUS="$(curl -sS -m 30 -o /dev/null -w '%{http_code}' -X POST "$HOOK_URL" 2>/dev/null || true)"
    [ "$HOOK_STATUS" = "403" ] && break
    sleep 4
  done
  case "$HOOK_STATUS" in
    403) ok "Функция бота работает и чужих запросов не принимает" ;;
    404) die "Supabase не нашёл функцию telegram-webhook в проекте ${REF}. Проверь Reference ID и список в Supabase → Edge Functions." ;;
    401) die "Supabase требует вход по ключу (код 401): функция выложена с проверкой JWT. Запусти команду ещё раз." ;;
    000) die "Нет связи с ${HOOK_URL}. Проверь интернет и запусти команду ещё раз." ;;
    *) die "Функция бота не запустилась (код ${HOOK_STATUS}). Подробности: Supabase → Edge Functions → telegram-webhook → Logs." ;;
  esac
fi

say "Говорю Telegram, куда слать сообщения"
if [ "$DRY_RUN" = "1" ]; then
  echo "  [проверка] setWebhook → ${HOOK_URL}"
else
  ANSWER="$(printf 'url = "https://api.telegram.org/bot%s/setWebhook"\ndata-urlencode = "url=%s"\ndata-urlencode = "secret_token=%s"\n' \
    "$BOT_TOKEN" "$HOOK_URL" "$WEBHOOK_SECRET" | curl -sS -m 30 --config - 2>/dev/null || true)"
  case "$ANSWER" in *'"ok":true'*) ;; *) die "Telegram не принял адрес вебхука: ${ANSWER:-нет ответа}" ;; esac
fi
ok "Вебхук установлен"

say "Записываю имя бота в .env"
if [ -f .env ] && grep -q '^VITE_TELEGRAM_BOT=' .env; then
  if [ "$DRY_RUN" = "1" ]; then echo "  [проверка] VITE_TELEGRAM_BOT уже есть"; else
    sed -i.bak "s/^VITE_TELEGRAM_BOT=.*/VITE_TELEGRAM_BOT=${BOT_NAME}/" .env && rm -f .env.bak
  fi
elif [ "$DRY_RUN" = "1" ]; then
  echo "  [проверка] добавил бы VITE_TELEGRAM_BOT=${BOT_NAME}"
else
  printf '\nVITE_TELEGRAM_BOT=%s\n' "$BOT_NAME" >> .env
fi
ok "VITE_TELEGRAM_BOT=${BOT_NAME}"

say "Готово"
echo "Бот: https://t.me/${BOT_NAME}"
if [ "$ANTHROPIC_LOW_BALANCE" = "1" ]; then
  warn "Не забудь пополнить баланс Anthropic (console.anthropic.com → Settings → Billing): без него бот не разберёт ни одного дела."
fi
echo "Дальше: перезапусти сайт (npm run dev), открой Настройки → Telegram → «Подключить Telegram»,"
echo "нажми Start в чате с ботом — и можно диктовать дела."
echo
echo "Чтобы бот присылал напоминания в назначенное время и утреннюю сводку, запусти ещё: bash scripts/update-bot.sh"
