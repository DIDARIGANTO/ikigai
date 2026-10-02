import type { Dream, Goal, Reminder, Task } from '@/lib/types';
import { addDaysISO } from '@/lib/dates';
import { daysUntil } from './reminders';
import { minutesBetween, planVsFact } from './tasks';

/** Время суток для «неба» на «Сегодня»: рассвет 05–08, день 08–17, закат 17–21, ночь 21–05. */
export type Daypart = 'dawn' | 'day' | 'dusk' | 'night';

export function daypart(hour: number): Daypart {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'dusk';
  return 'night';
}

/**
 * Задача во «Входящих»: без даты, без доски и ещё не начата.
 * Такая задача нигде больше не видна — её надо разобрать.
 */
export const isInbox = (t: Task): boolean => !t.date && !t.boardId && t.status === 'todo';

/** Сколько минут задача уже идёт или шла по факту. Без запуска таймера — 0. */
export function factMinutes(t: Task, nowMs?: number): number {
  if (!t.actualStart) return 0;
  if (t.actualEnd) return Math.max(0, minutesBetween(t.actualStart, t.actualEnd));
  if (t.status === 'doing' && nowMs !== undefined) {
    const from = new Date(t.actualStart).getTime();
    return Number.isFinite(from) ? Math.max(0, Math.floor((nowMs - from) / 60000)) : 0;
  }
  return 0;
}

export interface DaySummary {
  /** Сумма оценок времени по задачам дня (без пропущенных). */
  planned: number;
  /** Сколько минут ушло по таймеру: законченные задачи и та, что идёт сейчас. */
  actual: number;
  done: number;
  /** Задачи дня без пропущенных. */
  total: number;
}

/** Итог «план против факта» за день. `nowMs` — чтобы засчитать идущую задачу. */
export function daySummary(tasks: Task[], dateISO: string, nowMs?: number): DaySummary {
  const day = tasks.filter(t => t.date === dateISO && t.status !== 'skipped');
  let planned = 0;
  let actual = 0;
  let done = 0;
  for (const t of day) {
    planned += t.plannedMinutes ?? 0;
    actual += factMinutes(t, nowMs);
    if (t.status === 'done') done++;
  }
  return { planned, actual, done, total: day.length };
}

/** Минуты — коротко по-русски: «45 мин», «5 ч», «3 ч 20». */
export function formatDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} ч ${rest}` : `${h} ч`;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Точность плана: медиана «факт / план» по законченным задачам с оценкой.
 * 1 — ровно по плану, 1.2 — на 20 % дольше. Нечего сравнить — `null`.
 */
export function planAccuracy(tasks: Task[]): number | null {
  const ratios: number[] = [];
  for (const t of tasks) {
    if (t.status !== 'done') continue;
    const pf = planVsFact(t);
    if (!pf || pf.planned <= 0 || pf.actual <= 0) continue;
    ratios.push(pf.actual / pf.planned);
  }
  const m = median(ratios);
  return m === null ? null : Math.round(m * 100) / 100;
}

/** «×1.2» — как показывать точность плана. */
export const formatAccuracy = (a: number) => `×${a.toFixed(a >= 10 ? 0 : 1).replace(/\.0$/, '')}`;

export interface DayStats {
  done: number;
  skipped: number;
  /** Задачи, которые сегодня перенесли на другой день. */
  moved: number;
  accuracy: number | null;
  /** Минуты по таймеру за день. */
  focusMinutes: number;
  /** Из них — на задачи, привязанные к целям. */
  goalMinutes: number;
}

const localDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * Цифры для «Итога дня». «Перенесено» — задачи, у которых сегодня (по местному времени)
 * менялась запись, есть перенос и дата теперь позже этого дня: их убрали с сегодня на потом.
 */
export function dayStats(tasks: Task[], dateISO: string): DayStats {
  const day = tasks.filter(t => t.date === dateISO);
  const done = day.filter(t => t.status === 'done');
  const moved = tasks.filter(
    t => t.rescheduleCount > 0 && !!t.date && t.date > dateISO && localDate(t.updatedAt) === dateISO,
  ).length;
  let focusMinutes = 0;
  let goalMinutes = 0;
  for (const t of done) {
    const m = factMinutes(t);
    focusMinutes += m;
    if (t.goalId) goalMinutes += m;
  }
  return {
    done: done.length,
    skipped: day.filter(t => t.status === 'skipped').length,
    moved,
    accuracy: planAccuracy(day),
    focusMinutes,
    goalMinutes,
  };
}

export interface NorthStar {
  dream?: Dream;
  /** Цепочка целей от верхней к цели недели. */
  goals: Goal[];
  /** Ближайший шаг к цели недели. */
  nextStep?: Task;
}

const open = (t: Task) => t.status === 'todo' || t.status === 'doing';

const byTime = (a: Task, b: Task) =>
  (a.plannedStart ?? '99:99').localeCompare(b.plannedStart ?? '99:99') || a.position - b.position;

/**
 * «Северная звезда»: мечта › цели › шаг дня для цели недели.
 * Поднимаемся по `parentId` (с защитой от петель), мечту берём у ближайшего предка, у кого она есть.
 * Шаг — незакрытая задача цели: сначала идущая, потом сегодняшняя по времени, потом ближайшая будущая,
 * потом без даты. Хвосты прошлых дней шагом не считаем — у них своя карточка.
 */
export function northStarChain(
  goals: Goal[],
  dreams: Dream[],
  weekGoalId: string | undefined,
  tasks: Task[],
  todayISO: string,
): NorthStar {
  const week = weekGoalId ? goals.find(g => g.id === weekGoalId) : undefined;
  if (!week) return { goals: [] };

  const byId = new Map(goals.map(g => [g.id, g]));
  const chain: Goal[] = [];
  const seen = new Set<string>();
  let cur: Goal | undefined = week;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }

  let dream: Dream | undefined;
  for (let i = chain.length - 1; i >= 0 && !dream; i--) {
    const id = chain[i].dreamId;
    if (id) dream = dreams.find(d => d.id === id);
  }

  const mine = tasks.filter(t => t.goalId === week.id && open(t));
  const running = mine.find(t => t.status === 'doing' && !!t.actualStart);
  const today = mine.filter(t => t.date === todayISO).sort(byTime);
  const future = mine
    .filter(t => !!t.date && t.date > todayISO)
    .sort((a, b) => (a.date as string).localeCompare(b.date as string) || byTime(a, b));
  const undated = mine.filter(t => !t.date).sort((a, b) => a.position - b.position);
  const nextStep = running ?? today[0] ?? future[0] ?? undated[0];

  return { dream, goals: chain, nextStep };
}

export interface UpcomingReminder {
  reminder: Reminder;
  /** 0 — сегодня. */
  days: number;
  date: string;
}

/**
 * Напоминания на сегодня и ближайшие ежегодные даты (дни рождения) на `horizon` дней вперёд.
 * Сегодняшние — первыми, дальше по близости и времени.
 */
export function upcomingReminders(reminders: Reminder[], todayISO: string, horizon = 7): UpcomingReminder[] {
  const out: UpcomingReminder[] = [];
  for (const r of reminders) {
    const days = daysUntil(r, todayISO);
    if (days === null) continue;
    if (days === 0 || (r.repeat === 'yearly' && days <= horizon)) {
      out.push({ reminder: r, days, date: addDaysISO(todayISO, days) });
    }
  }
  return out.sort((a, b) => a.days - b.days || (a.reminder.time ?? '').localeCompare(b.reminder.time ?? ''));
}
