#!/usr/bin/env bash
# Пароль на весь сайт Ikigai (docs/DEPLOY.md, «Сайт только для тебя»): спрашивает пароль и кладёт его на Vercel
# вместе со случайным ключом подписи. После выкладки посторонний видит только окно пароля: ни экрана входа,
# ни кода приложения. Сам пароль нигде, кроме секретных переменных проекта на Vercel, не хранится и в репозиторий не попадает.
#
# Запуск из папки проекта, в панели Terminal (пароль вводится руками, буквы на экране не видны):
#   bash scripts/site-password.sh
# Сменить пароль: запустить ещё раз и выложить сайт заново; старый пароль и все прежние входы перестанут работать.
# Проверка без сети и без изменений:  DRY_RUN=1 bash scripts/site-password.sh

set -euo pipefail
cd "$(dirname "$0")/.."

DRY_RUN="${DRY_RUN:-0}"
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die() {
  printf '\n\033[31mОшибка:\033[0m %s\n' "$*" >&2
  printf 'Скрипт остановлен. Чтобы начать заново, введи в терминале: bash scripts/site-password.sh\n' >&2
  exit 1
}

errlog="$(mktemp)"
trap 'rm -f "$errlog"' EXIT

# Ввод пароля со звёздочками: на каждую набранную букву появляется «*», Backspace стирает последнюю.
# Совсем без отклика (как у `read -s`) кажется, что клавиши не нажимаются, и ошибку в наборе не заметить.
# Знаки читаются по одному, поэтому вставка целиком из буфера (Cmd+V) тоже работает.
PASSWORD_INPUT=""
read_password() {
  local char value=""
  printf '%s' "$1" >&2
  while IFS= read -r -s -n1 char; do
    case "$char" in
      '') break ;; # Enter: read отдаёт пустую строку вместо перевода строки
      $'\177' | $'\b')
        if [ -n "$value" ]; then
          value="${value%?}"
          printf '\b \b' >&2
        fi
        ;;
      [[:cntrl:]]) ;; # Tab, Esc и прочие управляющие знаки не считаются
      *)
        value="$value$char"
        printf '*' >&2
        ;;
    esac
  done
  printf '\n' >&2
  PASSWORD_INPUT="$value"
}

say "Пароль на сайт Ikigai"

# Пароль вводят руками: в чате или в окне без клавиатуры спросить его нечем.
if [ "$DRY_RUN" != "1" ] && [ ! -t 0 ]; then
  die "Пароль нужно вводить с клавиатуры, а здесь ввод закрыт. Открой панель Terminal (рядом с чатом) и запусти там: bash scripts/site-password.sh"
fi

say "Вхожу в Vercel"
if [ "$DRY_RUN" = "1" ]; then
  echo "  [проверка] vercel whoami, vercel link --yes пропущены"
else
  WHO="$(npx --yes vercel whoami 2>/dev/null | tail -n 1 || true)"
  if [ -z "$WHO" ]; then
    echo "Откроется вход: выбери способ, подтверди в браузере и вернись сюда."
    npx --yes vercel login
    WHO="$(npx --yes vercel whoami 2>/dev/null | tail -n 1 || true)"
    [ -n "$WHO" ] || die "Не удалось войти в Vercel."
  fi
  ok "Вход выполнен: ${WHO}"
  # Проект уже создан выкладкой; без связи с ним переменные некуда класть.
  if [ ! -f .vercel/project.json ]; then npx --yes vercel link --yes; fi
  ok "Проект привязан"
fi

MIN_LENGTH=10
PASSWORD=""
if [ "$DRY_RUN" = "1" ]; then
  echo "  [проверка] вопрос про пароль пропущен"
else
  say "Придумай пароль на сайт"
  echo "Не короче ${MIN_LENGTH} знаков, только латиница, цифры и знаки (!?-_ и т. п.): так он одинаково вводится на любом устройстве."
  echo "Надёжнее всего фраза из трёх-четырёх слов. На каждую набранную букву появляется звёздочка; пароль можно и вставить целиком через Cmd+V."
  echo "Это пароль только на входную дверь сайта; внутри остаётся обычный вход по ссылке из письма."
  echo "(Сначала кликни мышкой внутрь этого окна, чтобы клавиши попадали сюда.)"
  attempt=1
  while :; do
    read_password "Пароль: "
    first="$PASSWORD_INPUT"
    read_password "Ещё раз: "
    second="$PASSWORD_INPUT"
    if [ "${#first}" -lt "$MIN_LENGTH" ]; then
      warn "Слишком короткий: набрано знаков ${#first}, нужно хотя бы ${MIN_LENGTH}."
    elif LC_ALL=C grep -q '[^ -~]' <<<"$first"; then
      warn "В пароле есть русские буквы или невидимые знаки. Нужны только латиница, цифры и знаки; проверь раскладку клавиатуры."
    elif [ "$first" != "${first# }" ] || [ "$first" != "${first% }" ]; then
      warn "В начале или конце пароля пробел: его не видно и потом легко ошибиться. Убери его."
    elif [ "$first" != "$second" ]; then
      warn "Два раза введено по-разному (в первый раз знаков ${#first}, во второй ${#second}). Попробуй ещё раз или вставь пароль через Cmd+V оба раза."
    else
      PASSWORD="$first"
      ok "Пароль принят (знаков: ${#PASSWORD})"
      break
    fi
    attempt=$((attempt + 1))
    [ "$attempt" -le 5 ] || die "Не получилось ввести пароль за пять попыток."
  done
fi

# Ключ подписи входа: случайный, его никто не видит и не вводит. Подписывается он, а не пароль: если украдут
# запись о входе с устройства, пароль по ней не подобрать; смена ключа разом выкидывает все устройства.
if command -v openssl >/dev/null 2>&1; then
  SECRET="$(openssl rand -hex 32)"
else
  SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
fi

say "Кладу пароль на Vercel"
set_secret() {
  local name="$1" value="$2"
  if [ "$DRY_RUN" = "1" ]; then
    printf '  [проверка] vercel env add %s production --sensitive\n' "$name"
    return 0
  fi
  # Значение уходит через stdin, а не аргументом: так его не видно в списке процессов.
  # --sensitive: после записи его нельзя прочитать обратно ни в панели Vercel, ни командой.
  if printf '%s' "$value" | npx --yes vercel env add "$name" production --sensitive --force --yes >"$errlog" 2>&1; then
    ok "${name}: записан"
  else
    cat "$errlog" >&2
    die "Не получилось положить ${name} на Vercel. Текст ошибки выше, пришли его мне."
  fi
}
set_secret SITE_PASSWORD "$PASSWORD"
set_secret SITE_GATE_SECRET "$SECRET"

say "Готово"
echo "Пароль записан. Чтобы сайт закрылся, его нужно выложить заново (напиши мне «выложи» или введи: bash scripts/deploy-vercel.sh)."
echo "Открыв сайт, введи этот пароль один раз на каждом устройстве: браузер запомнит его на 90 дней, а Safari предложит сохранить его в связке ключей."
