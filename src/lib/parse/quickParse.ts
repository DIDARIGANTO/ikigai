import { addDays, addMonths, addYears, format } from 'date-fns';
import type { Area, Repeat } from '@/lib/types';

/**
 * Разбор быстрой записи на русском: «завтра в 15 на 30м #работа ^сайт ! позвонить маме»
 * → дата, время, длительность, сфера, цель, важность и чистое название.
 * Чистая функция: всё, что зависит от «сейчас», приходит в `ctx.now`.
 */

export type QuickKind = 'task' | 'reminder' | 'list_item' | 'note';

export type TokenKind =
  | 'date'
  | 'time'
  | 'duration'
  | 'area'
  | 'goal'
  | 'important'
  | 'emoji'
  | 'price'
  | 'list'
  | 'kind'
  | 'repeat';

export interface ParseToken {
  /** Начало и конец распознанного куска в исходном тексте (индексы UTF-16, как у `slice`). */
  start: number;
  end: number;
  kind: TokenKind;
  /** Как показать кусок человеку: «Завтра», «15:00», «30 мин». */
  label: string;
}

export interface QuickParse {
  title: string;
  date?: string;
  time?: string;
  minutes?: number;
  area?: Area;
  goalId?: string;
  important?: boolean;
  emoji?: string;
  price?: number;
  listId?: string;
  kind?: QuickKind;
  /** Только для напоминаний: «каждый месяц» → `monthly`. */
  repeat?: Repeat;
  tokens: ParseToken[];
}

export interface ParseContext {
  now: Date;
  goals: { id: string; title: string; emoji?: string }[];
  lists: { id: string; title: string }[];
  /** Дата, если в тексте её нет (строка «Сегодня» подставляет сегодняшнюю). */
  defaultDate?: string;
}

/* ───────────── словари ───────────── */

/** Буква или цифра по краям — границы слова для кириллицы (`\b` в JS её не знает). */
const B = '(?<![\\p{L}\\p{N}_])';
const E = '(?![\\p{L}\\p{N}_])';

const re = (src: string) => new RegExp(src, 'gu');

const WORD_NUM: Record<string, number> = {
  один: 1, одну: 1, одна: 1, два: 2, две: 2, пару: 2, три: 3, четыре: 4, пять: 5,
  шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10,
};
const NUM = `(\\d+|${Object.keys(WORD_NUM).join('|')})`;

/** Дни недели: форма → номер (0 — понедельник). */
const WEEKDAYS: [RegExp, number][] = [
  [/^(понедельник|пн)$/, 0],
  [/^(вторник|вт)$/, 1],
  [/^(среда|среду|ср)$/, 2],
  [/^(четверг|чт)$/, 3],
  [/^(пятница|пятницу|пт)$/, 4],
  [/^(суббота|субботу|сб)$/, 5],
  [/^(воскресенье|вс)$/, 6],
];
const WEEKDAY_SRC = '(понедельник|вторник|среду|среда|четверг|пятницу|пятница|субботу|суббота|воскресенье|пн|вт|ср|чт|пт|сб|вс)';
const weekdayIndex = (w: string) => WEEKDAYS.find(([r]) => r.test(w))?.[1] ?? -1;

const MONTH_SRC =
  '(январ[ья]|феврал[ья]|марта?|апрел[ья]|мая|май|июн[ья]|июл[ья]|августа?|сентябр[ья]|октябр[ья]|ноябр[ья]|декабр[ья]|янв|фев|мар|апр|июн|июл|авг|сент|сен|окт|ноя|дек)';
const MONTH_PREFIX = ['янв', 'фев', 'мар', 'апр', 'ма', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const monthIndex = (m: string) => MONTH_PREFIX.findIndex(p => m.startsWith(p));

const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const REPEAT_LABEL: Record<Repeat, string> = {
  none: 'Один раз',
  daily: 'Каждый день',
  weekly: 'Каждую неделю',
  monthly: 'Каждый месяц',
  yearly: 'Каждый год',
};

const AREA_TAGS: [RegExp, Area][] = [
  [/^(работа|работе|работу|раб|work|job)$/, 'work'],
  [/^(личное|личн|лично|личное|дом|personal|life)$/, 'personal'],
];

/* ───────────── помощники ───────────── */

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const hhmm = (h: number, m: number) => `${pad(h)}:${pad(m)}`;
const num = (raw: string) => (raw in WORD_NUM ? WORD_NUM[raw] : Number(raw.replace(/[\s ]/g, '').replace(',', '.')));
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** Номер дня недели с понедельника: 0 — пн, 6 — вс. */
const dow = (d: Date) => (d.getDay() + 6) % 7;

/** Нижний регистр и «ё» → «е» без смены длины строки: индексы совпадают с исходным текстом. */
export function normalize(text: string): string {
  let out = '';
  for (const ch of text) {
    const low = ch.toLowerCase();
    out += (low.length === ch.length ? low : ch).replace('ё', 'е');
  }
  return out;
}

/** Подпись даты: «Сегодня», «Завтра», «Пт, 2 окт», а в другом году — «14 окт 2027». */
export function dateLabel(dateISO: string, now: Date): string {
  const today = startOfDay(now);
  const [y, m, d] = dateISO.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Завтра';
  if (diff === 2) return 'Послезавтра';
  const base = `${d} ${MONTH_SHORT[m - 1]}`;
  if (y !== today.getFullYear()) return `${base} ${y}`;
  if (diff > 0 && diff < 7) return `${WEEKDAY_SHORT[dow(date)]}, ${base}`;
  return base;
}

/** «90» → «1 ч 30 мин». */
export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} мин`;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

/** 150000 → «150 000 ₸». */
export function priceLabel(price: number): string {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(price).replace(/ /g, ' ')} ₸`;
}

/** Вырезает куски текста (например, распознанные токены) и приводит пробелы в порядок. */
export function stripSpans(text: string, spans: { start: number; end: number }[]): string {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let out = '';
  let at = 0;
  for (const s of sorted) {
    if (s.start > at) out += text.slice(at, s.start);
    out += ' ';
    at = Math.max(at, s.end);
  }
  out += text.slice(at);
  return tidy(out);
}

/** Схлопывает пробелы, убирает осиротевшие запятые, двоеточия и тире по краям. */
function tidy(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:?)»])/g, '$1')
    .replace(/([(«])\s+/g, '$1')
    .replace(/([,;:])(?:\s*[,;:])+/g, '$1')
    .replace(/^[\s,.;:—–-]+/, '')
    .replace(/[\s,;:—–-]+$/, '')
    .trim();
}

/* ───────────── сканер ───────────── */

/** Подпись токена; `end` — если токен короче совпадения (абсолютный индекс конца). */
type Accepted = string | { label: string; end: number } | null;

interface Scanner {
  text: string;
  s: string;
  tokens: ParseToken[];
  /** Первое совпадение, не задевающее уже распознанное; `accept` может отказаться (вернуть null). */
  take: (pattern: RegExp, kind: TokenKind, accept: (m: RegExpExecArray) => Accepted, from?: number) => boolean;
}

function scanner(text: string): Scanner {
  const s = normalize(text);
  const tokens: ParseToken[] = [];
  const free = (a: number, b: number) => tokens.every(t => b <= t.start || a >= t.end);
  const take: Scanner['take'] = (pattern, kind, accept, from = 0) => {
    pattern.lastIndex = from;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(s))) {
      // Пробелы по краям совпадения — не часть токена.
      const lead = m[0].length - m[0].trimStart().length;
      const start = m.index + lead;
      const end = m.index + m[0].trimEnd().length;
      if (end > start && free(start, end)) {
        const res = accept(m);
        if (res !== null) {
          if (typeof res === 'string') tokens.push({ start, end, kind, label: res });
          else tokens.push({ start, end: res.end, kind, label: res.label });
          return true;
        }
      }
      if (m[0].length === 0) pattern.lastIndex++;
    }
    return false;
  };
  return { text, s, tokens, take };
}

/* ───────────── разбор ───────────── */

const EMOJI = /^\s*((?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2})(?:️|⃣|\p{Emoji_Modifier}|‍\p{Extended_Pictographic}️?)*)/u;

/** Цель по началу слова: сначала начало названия, потом начало любого слова, потом просто вхождение. */
export function matchGoal<T extends { title: string }>(query: string, goals: T[]): T | undefined {
  const q = normalize(query).trim();
  if (!q) return undefined;
  let best: T | undefined;
  let bestScore = 0;
  for (const g of goals) {
    const t = normalize(g.title);
    const score = t.startsWith(q) ? 3 : t.split(/[^\p{L}\p{N}]+/u).some(w => w.startsWith(q)) ? 2 : t.includes(q) ? 1 : 0;
    if (score > bestScore) {
      best = g;
      bestScore = score;
    }
  }
  return best;
}

export function parseQuick(text: string, ctx: ParseContext): QuickParse {
  const sc = scanner(text);
  const { s, take } = sc;
  const now = ctx.now;
  const today = startOfDay(now);
  const out: QuickParse = { title: '', tokens: sc.tokens };

  // Эмодзи в начале — плитка записи.
  let body = 0;
  const em = EMOJI.exec(text);
  if (em) {
    const start = em[0].length - em[1].length;
    out.emoji = em[1];
    sc.tokens.push({ start, end: em[0].length, kind: 'emoji', label: em[1] });
    body = em[0].length;
  }

  // «мысль: …», «идея: …» — заметка; текст остаётся как есть, без дат и тегов.
  const note = new RegExp(`^\\s*(мысль|идея|заметка|note)\\s*:`, 'u').exec(s.slice(body));
  if (note) {
    const start = body + note[0].length - note[0].trimStart().length;
    sc.tokens.push({ start, end: body + note[0].length, kind: 'kind', label: 'Заметка' });
    out.kind = 'note';
    out.title = tidy(text.slice(body + note[0].length));
    return out;
  }

  // «напомни (мне) (о|про) …» — напоминание.
  if (take(re(`${B}напомни(?:ть)?(?:\\s+мне)?(?:\\s+(?:об|о|про))?${E}`), 'kind', () => 'Напоминание')) out.kind = 'reminder';

  // Повтор: «каждый месяц», «ежегодно», «каждый понедельник», «каждое утро».
  let repeatWeekday = -1;
  let repeatTime: string | undefined;
  take(
    re(
      `${B}(?:(ежедневно|еженедельно|ежемесячно|ежегодно)|кажд(?:ый|ую|ое)\\s+(день|неделю|месяц|год|утро|вечер|${WEEKDAY_SRC}))${E}`,
    ),
    'repeat',
    m => {
      const adverb = m[1];
      const unit = m[2];
      let repeat: Repeat;
      if (adverb) repeat = ({ ежедневно: 'daily', еженедельно: 'weekly', ежемесячно: 'monthly', ежегодно: 'yearly' } as const)[adverb as 'ежедневно'];
      else if (unit === 'день') repeat = 'daily';
      else if (unit === 'неделю') repeat = 'weekly';
      else if (unit === 'месяц') repeat = 'monthly';
      else if (unit === 'год') repeat = 'yearly';
      else if (unit === 'утро' || unit === 'вечер') {
        repeat = 'daily';
        repeatTime = unit === 'утро' ? '09:00' : '19:00';
      } else {
        repeat = 'weekly';
        repeatWeekday = weekdayIndex(unit);
      }
      out.repeat = repeat;
      return REPEAT_LABEL[repeat];
    },
  );
  if (out.repeat && !out.kind) out.kind = 'reminder';

  // «купить …» в начале — покупка; «в список Покупки» — пункт конкретного списка.
  if (!out.kind) {
    const buy = new RegExp(`^\\s*(купить|купи)${E}`, 'u').exec(s.slice(body));
    if (buy) {
      const start = body + buy[0].length - buy[1].length;
      sc.tokens.push({ start, end: body + buy[0].length, kind: 'kind', label: 'Покупка' });
      out.kind = 'list_item';
    }
  }
  const sortedLists = [...ctx.lists].sort((a, b) => b.title.length - a.title.length);
  take(re(`${B}(?:в|во)\\s+список\\s+[«"“]?([\\p{L}\\p{N}][^«»"“”]*)`), 'list', m => {
    const rest = m[1];
    const hit = sortedLists.find(l => {
      const t = normalize(l.title).trim();
      return t && rest.startsWith(t) && !/[\p{L}\p{N}]/u.test(rest.charAt(t.length));
    });
    const nameLen = hit ? normalize(hit.title).trim().length : (/^[\p{L}\p{N}-]+/u.exec(rest)?.[0].length ?? 0);
    // Токен — «в список» + имя (и закрывающая кавычка), а не весь хвост строки.
    const nameStart = m.index + m[0].length - rest.length;
    const closing = /^[»"”]/.test(s.charAt(nameStart + nameLen)) ? 1 : 0;
    out.listId = hit?.id;
    if (!out.kind || out.kind === 'task') out.kind = 'list_item';
    return { label: `Список: ${hit ? hit.title : text.slice(nameStart, nameStart + nameLen)}`, end: nameStart + nameLen + closing };
  });
  if (out.kind === 'list_item' && !out.listId) {
    out.listId = ctx.lists.find(l => normalize(l.title).includes('покуп'))?.id;
  }

  // Деньги: «₸150000», «150 000 ₸», «150к», «150 тыс», «1.5 млн».
  // Здесь и ниже `void (a || b || …)` — правила по порядку, первое сработавшее останавливает перебор.
  const AMOUNT = '(\\d{1,3}(?:[ \\u00a0]\\d{3})+|\\d+(?:[.,]\\d+)?)';
  const money = (m: RegExpExecArray, mult: number) => {
    const n = Math.round(num(m[1]) * mult);
    if (!Number.isFinite(n) || n <= 0) return null;
    out.price = n;
    return priceLabel(n);
  };
  void (take(re(`[₸]\\s?${AMOUNT}${E}`), 'price', m => money(m, 1)) ||
    take(re(`${B}${AMOUNT}(?:к|k)${E}`), 'price', m => money(m, 1000)) ||
    take(re(`${B}${AMOUNT}\\s?(тыс\\.?|тысяч[аи]?|млн\\.?|миллион(?:а|ов)?)(?:\\s?(?:₸|тг|тенге))?(?![\\p{L}\\p{N}_])`), 'price', m =>
      money(m, m[2].startsWith('м') ? 1_000_000 : 1000),
    ) ||
    take(re(`${B}${AMOUNT}\\s?(?:₸|тг\\.?|тенге)(?![\\p{L}\\p{N}_])`), 'price', m => money(m, 1)));

  // «через 3 дня», «через неделю», «через 2 часа».
  let date: Date | undefined;
  let time: string | undefined;
  take(
    re(`${B}через\\s+(?:${NUM}\\s*)?(минуту|минуты|минут|мин|часа|часов|час|день|дня|дней|неделю|недели|недель|месяц|месяца|месяцев|год|года|лет)${E}`),
    'date',
    m => {
      const n = m[1] ? num(m[1]) : 1;
      if (!Number.isFinite(n) || n <= 0 || n > 1000) return null;
      const u = m[2];
      if (u.startsWith('мин') || u.startsWith('час')) {
        const minutes = u.startsWith('мин') ? n : n * 60;
        const at = new Date(now.getTime() + minutes * 60000);
        date = startOfDay(at);
        time = hhmm(at.getHours(), at.getMinutes());
        return `через ${u.startsWith('мин') ? `${n} мин` : `${n} ч`}`;
      }
      if (u.startsWith('д')) date = addDays(today, n);
      else if (u.startsWith('нед')) date = addDays(today, n * 7);
      else if (u.startsWith('мес')) date = addMonths(today, n);
      else date = addYears(today, n);
      return dateLabel(iso(date), now);
    },
  );
  // Относительное время («через 2 часа») помечаем как время: так понятнее в чипах.
  const rel = sc.tokens.find(t => t.kind === 'date' && t.label.startsWith('через '));
  if (rel) {
    rel.kind = 'time';
    rel.label = time ?? rel.label;
  }

  // Длительность: «30м», «1.5ч», «1ч 30м», «на час», «на полчаса», «90 минут».
  const setMinutes = (n: number) => {
    const v = Math.round(n);
    if (!(v > 0 && v <= 24 * 60)) return null;
    out.minutes = v;
    return durationLabel(v);
  };
  const NOT_AT = '(?<!(?:^|[^\\p{L}])(?:в|к|до|с|после)\\s+)';
  void (take(re(`${B}(?:на\\s+)?полчаса${E}`), 'duration', () => setMinutes(30)) ||
    take(re(`${B}(?:на\\s+)?полтора\\s+часа${E}`), 'duration', () => setMinutes(90)) ||
    take(re(`${B}на\\s+час${E}`), 'duration', () => setMinutes(60)) ||
    take(
      re(`${B}${NOT_AT}(?:на\\s+)?(\\d+(?:[.,]\\d+)?)\\s*(?:ч|час|часа|часов)\\.?(?:\\s*(\\d+)\\s*(?:м|мин|минуты|минута|минут|минуту)\\.?)?${E}`),
      'duration',
      m => setMinutes(num(m[1]) * 60 + (m[2] ? Number(m[2]) : 0)),
    ) ||
    take(re(`${B}(?:на\\s+)?(\\d+)\\s*(?:м|мин|минуты|минута|минут|минуту)\\.?${E}`), 'duration', m => setMinutes(Number(m[1]))));

  // Даты.
  let weekday = -1;
  let nextWeek = false;
  if (!date) {
    void (take(re(`${B}(?:на\\s+)?(послезавтра|завтра|сегодня)${E}`), 'date', m => {
      date = addDays(today, m[1] === 'сегодня' ? 0 : m[1] === 'завтра' ? 1 : 2);
      return dateLabel(iso(date), now);
    }) ||
      take(re(`${B}(?:(?:на|к|до)\\s+)?(\\d{1,2})\\s*${MONTH_SRC}\\.?(?:\\s+(\\d{4})(?:\\s*г(?:ода|од)?\\.?)?)?${E}`), 'date', m => {
        const d = explicitDate(Number(m[1]), monthIndex(m[2]), m[3] ? Number(m[3]) : undefined, today);
        if (!d) return null;
        date = d;
        return dateLabel(iso(d), now);
      }) ||
      take(re(`${B}(?:(?:на|к|до|в)\\s+)?(\\d{1,2})\\.(\\d{1,2})(?:\\.(\\d{4}|\\d{2}))?(?![\\p{L}\\p{N}_]|[.,:]\\d)`), 'date', m => {
        const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
        const d = explicitDate(Number(m[1]), Number(m[2]) - 1, y, today);
        if (!d) return null;
        date = d;
        return dateLabel(iso(d), now);
      }) ||
      take(re(`${B}(?:на|в)\\s+(?:выходных|выходные)${E}`), 'date', () => {
        const wd = dow(today);
        date = wd >= 5 ? today : addDays(today, 5 - wd);
        return dateLabel(iso(date), now);
      }));

    if (!date) {
      // «на следующей неделе (в среду)», «в пятницу», «в следующий вторник».
      take(re(`${B}на\\s+следующей\\s+неделе${E}`), 'date', () => {
        nextWeek = true;
        return 'След. неделя';
      });
      take(re(`${B}(?:(?:в|во|на|к)\\s+)?(?:(следующ(?:ий|ую|ее|ей)|эт(?:от|у|о))\\s+)?${WEEKDAY_SRC}${E}`), 'date', m => {
        weekday = weekdayIndex(m[2]);
        if (weekday < 0) return null;
        if (m[1]?.startsWith('след')) nextWeek = true;
        return WEEKDAY_SHORT[weekday];
      });
      if (nextWeek || weekday >= 0) {
        const monday = addDays(today, -dow(today));
        if (nextWeek) date = addDays(monday, 7 + Math.max(0, weekday));
        else date = addDays(today, (weekday - dow(today) + 7) % 7 || 7);
        // Подпись получает итоговая дата; второй кусок («на следующей неделе») остаётся без подписи.
        const label = dateLabel(iso(date), now);
        const dateTokens = sc.tokens.filter(t => t.kind === 'date');
        dateTokens.forEach(t => (t.label = label));
      }
    }
  }

  if (repeatWeekday >= 0 && !date) {
    date = addDays(today, (repeatWeekday - dow(today) + 7) % 7);
  }

  // Время: «в 15:00», «15:30», «в 15», «в 7 утра», «в 3 дня», а потом «утром / днём / вечером».
  let hour = -1;
  let minute = 0;
  let qualified = false;
  if (!time) {
    void (take(re(`${B}(?:(?:в|к|до|с)\\s+)?([01]?\\d|2[0-3]):([0-5]\\d)${E}`), 'time', m => {
      hour = Number(m[1]);
      minute = Number(m[2]);
      qualified = true;
      return '';
    }) ||
      take(re(`${B}(?:в|к|до)\\s+([01]?\\d|2[0-3])[.]([0-5]\\d)${E}`), 'time', m => {
        hour = Number(m[1]);
        minute = Number(m[2]);
        qualified = true;
        return '';
      }) ||
      take(
        re(`${B}(?:в|к|до|с)\\s+(\\d{1,2})(?:\\s*(?:часов|часа|час|ч))?(?:\\s+(утра|дня|вечера|ночи))?(?![\\p{L}\\p{N}_]|[.,:]\\d)`),
        'time',
        m => {
          let h = Number(m[1]);
          if (h > 23) return null;
          const part = m[2];
          if (part) {
            qualified = true;
            if (part === 'утра' && h === 12) h = 0;
            if ((part === 'дня' || part === 'вечера') && h < 12) h += 12;
            if (part === 'ночи' && h === 12) h = 0;
            if (h > 23) return null;
          } else if (h >= 1 && h <= 6) {
            // «в 3» почти всегда значит 15:00: встречи в три ночи записывают как «в 3 ночи».
            h += 12;
          }
          hour = h;
          minute = 0;
          return '';
        },
      ));

    const DAYPART: Record<string, number> = { утром: 9, днем: 13, вечером: 19, ночью: 23, полдень: 12, полночь: 0 };
    let part: string | undefined;
    take(re(`${B}(?:(?:в)\\s+)?(утром|днем|вечером|ночью|полдень|полночь)${E}`), 'time', m => {
      part = m[1];
      return '';
    });
    if (part !== undefined) {
      if (hour < 0) {
        hour = DAYPART[part];
        minute = 0;
      } else if (!qualified) {
        // «вечером в 8» → 20:00, «утром в 5» → 05:00.
        const raw = hour >= 13 && hour <= 18 ? hour - 12 : hour;
        hour = part === 'вечером' || part === 'днем' ? (raw < 12 ? raw + 12 : raw) : part === 'утром' ? raw : hour;
      }
    }
    if (hour >= 0) time = hhmm(hour, minute);
    else if (repeatTime) time = repeatTime;
  }
  if (time) {
    out.time = time;
    for (const t of sc.tokens) if (t.kind === 'time') t.label = time;
  }

  // Время без даты: ближайшее такое время (сегодня, а если уже прошло — завтра) либо дата по умолчанию.
  if (date) out.date = iso(date);
  else if (ctx.defaultDate) out.date = ctx.defaultDate;
  else if (out.time) {
    const [h, m] = out.time.split(':').map(Number);
    const passed = h * 60 + m <= now.getHours() * 60 + now.getMinutes();
    out.date = iso(passed ? addDays(today, 1) : today);
  }

  // Сфера: #работа / #личное (прочие теги остаются в тексте).
  take(re(`#([\\p{L}\\p{N}_]+)`), 'area', m => {
    const hit = AREA_TAGS.find(([r]) => r.test(m[1]));
    if (!hit) return null;
    out.area = hit[1];
    return hit[1] === 'work' ? 'Работа' : 'Личное';
  });

  // Цель: ^сайт — по началу названия, без учёта регистра и «ё».
  take(re(`\\^([\\p{L}\\p{N}_-]+)`), 'goal', m => {
    const g = matchGoal(m[1], ctx.goals);
    if (!g) return null;
    out.goalId = g.id;
    return g.emoji ? `${g.emoji} ${g.title}` : g.title;
  });

  // «!» отдельным словом — важная.
  if (take(/(?<!\S)!{1,3}(?!\S)/gu, 'important', () => 'Важное')) out.important = true;

  sc.tokens.sort((a, b) => a.start - b.start);
  out.title = stripSpans(text, sc.tokens);
  return out;
}

/** День и месяц без года — ближайший в будущем (сегодняшний тоже). Некорректная дата → undefined. */
function explicitDate(d: number, m: number, y: number | undefined, today: Date): Date | undefined {
  if (m < 0 || m > 11 || d < 1 || d > 31) return undefined;
  const make = (year: number) => {
    const date = new Date(year, m, d);
    return date.getMonth() === m ? date : undefined;
  };
  if (y !== undefined) return make(y);
  const thisYear = make(today.getFullYear());
  if (thisYear && thisYear >= today) return thisYear;
  return make(today.getFullYear() + 1);
}
