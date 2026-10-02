/**
 * Копия доменных функций веб-приложения для edge-функций (Deno).
 *
 * Источники: `src/lib/domain/digest.ts`, `src/lib/domain/reminders.ts` и `src/lib/domain/tasks.ts`.
 * Здесь нет внешних зависимостей (date-fns недоступен в Deno-сборке),
 * поэтому арифметика дат сделана на `Date` в виде строк «YYYY-MM-DD».
 * Правки нужно вносить в обе копии — тесты лежат в веб-проекте.
 */

// ── даты ───────────────────────────────────────────────────────────────────

/** «YYYY-MM-DD» → Date в UTC-полночь: так день недели и число не зависят от зоны сервера. */
function parseDateISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Разница в календарных днях между двумя датами «YYYY-MM-DD». */
export function diffDaysISO(a: string, b: string): number {
  return Math.round((parseDateISO(a).getTime() - parseDateISO(b).getTime()) / 86400000);
}

// ── задачи ─────────────────────────────────────────────────────────────────

/** Минимум полей задачи, нужный боту: полный тип живёт в `src/lib/types.ts`. */
export interface RunnableTask { status?: string; actualStart?: string }

/**
 * Задача «идёт» только если её запустили таймером.
 * Один статус `doing` этого не значит: карточку могли просто перетащить в «В работе» на доске —
 * такая задача не занимает таймер и не мешает начать другую (см. `src/lib/domain/tasks.ts`).
 */
export const isRunning = (t: RunnableTask) => t.status === 'doing' && !!t.actualStart;

// ── напоминания ────────────────────────────────────────────────────────────

export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Reminder {
  id: string;
  text: string;
  date: string; // 'YYYY-MM-DD' — первая дата
  time?: string; // 'HH:mm'
  repeat: Repeat;
}

export function reminderOccursOn(r: Reminder, dateISO: string): boolean {
  if (dateISO < r.date) return false;
  if (r.repeat === 'none') return r.date === dateISO;
  if (r.repeat === 'daily') return true;
  const a = parseDateISO(r.date), b = parseDateISO(dateISO);
  if (r.repeat === 'weekly') return a.getUTCDay() === b.getUTCDay();
  if (r.repeat === 'monthly') return a.getUTCDate() === b.getUTCDate();
  return a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate(); // yearly
}

/** Ближайшая дата (включая fromISO), когда напоминание сработает; null если больше не сработает. */
export function nextOccurrence(r: Reminder, fromISO: string): string | null {
  if (r.repeat === 'none') return r.date >= fromISO ? r.date : null;
  let d = fromISO < r.date ? r.date : fromISO;
  for (let i = 0; i < 400; i++) {
    if (reminderOccursOn(r, d)) return d;
    d = addDaysISO(d, 1);
  }
  return null;
}

export function daysUntil(r: Reminder, fromISO: string): number | null {
  const next = nextOccurrence(r, fromISO);
  return next ? diffDaysISO(next, fromISO) : null;
}

// ── утренняя сводка ────────────────────────────────────────────────────────

export interface DigestTask { id: string; title: string; plannedStart?: string; plannedMinutes?: number; }
export interface DigestInput {
  dateLabel: string;
  weekGoal?: { title: string; progress: number };
  timed: DigestTask[];
  untimed: DigestTask[];
  reminders: { text: string; time?: string; yearly?: boolean }[];
  carried: DigestTask[];
  principle?: string;
}

export function buildMorningDigest(i: DigestInput): string {
  const L: string[] = [`☀️ Доброе утро. Сегодня ${i.dateLabel}`, ''];
  if (i.weekGoal) L.push(`🎯 Цель недели: ${i.weekGoal.title} — ${Math.round(i.weekGoal.progress * 100)}%`, '');
  if (i.timed.length + i.untimed.length === 0) L.push('Задач на сегодня нет.', '');
  if (i.timed.length) {
    L.push('🕘 По времени:');
    for (const t of i.timed) L.push(`${t.plannedStart} · ${t.title}${t.plannedMinutes ? ` (${t.plannedMinutes} мин)` : ''}`);
    L.push('');
  }
  if (i.untimed.length) {
    L.push('📋 В течение дня:');
    for (const t of i.untimed) L.push(`• ${t.title}`);
    L.push('');
  }
  if (i.reminders.length) {
    L.push('🔔 Напоминания:');
    for (const r of i.reminders) L.push(`${r.yearly ? '🎂' : '•'} ${r.text}${r.time ? ` в ${r.time}` : ''}`);
    L.push('');
  }
  if (i.carried.length) {
    L.push('↩️ Не сделано ранее:');
    for (const t of i.carried) L.push(`• ${t.title}`);
    L.push('');
  }
  if (i.principle) L.push(`道 ${i.principle}`);
  return L.join('\n').trim();
}

/**
 * Ограничение длины сводки: у Telegram лимит 4096 символов на сообщение.
 * Режем по границе строки, чтобы не обрывать пункт на полуслове, и помечаем обрез многоточием.
 * Результат никогда не длиннее `max`.
 */
export function capDigest(text: string, max = 3900): string {
  if (text.length <= max) return text;
  const tail = '\n…';
  const cut = text.slice(0, Math.max(0, max - tail.length));
  const nl = cut.lastIndexOf('\n');
  return `${(nl > 0 ? cut.slice(0, nl) : cut).trimEnd()}${tail}`;
}

export function localClock(now: Date, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)!.value;
  const hour = get('hour') === '24' ? '00' : get('hour');
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${hour}:${get('minute')}` };
}

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** Отправлять, если в часовом поясе пользователя уже наступило morningTime (но прошло не больше 2 часов) и сегодня ещё не отправляли. */
export function shouldSendMorning(now: Date, timeZone: string, morningTime: string, lastSentDate: string | null): boolean {
  const { date, time } = localClock(now, timeZone);
  if (lastSentDate === date) return false;
  const diff = toMin(time) - toMin(morningTime);
  return diff >= 0 && diff <= 120;
}
