import type { Reminder, Repeat } from '@/lib/types';
import { daysUntil, nextOccurrence } from '@/lib/domain/reminders';
import { addDaysISO } from '@/lib/dates';

export interface ReminderEntry {
  reminder: Reminder;
  /** Ближайшая дата срабатывания или null, если разовое уже прошло. */
  next: string | null;
  days: number | null;
}

export interface ReminderGroups {
  today: ReminderEntry[];
  week: ReminderEntry[];
  later: ReminderEntry[];
  yearly: ReminderEntry[];
  past: ReminderEntry[];
}

export const REPEAT_LABEL: Record<Repeat, string> = {
  none: 'разово',
  daily: 'каждый день',
  weekly: 'каждую неделю',
  monthly: 'каждый месяц',
  yearly: 'каждый год',
};

export const REPEAT_OPTIONS: { value: Repeat; label: string }[] = [
  { value: 'none', label: 'Без повтора' },
  { value: 'daily', label: 'Каждый день' },
  { value: 'weekly', label: 'Каждую неделю' },
  { value: 'monthly', label: 'Каждый месяц' },
  { value: 'yearly', label: 'Каждый год' },
];

/** «день / дня / дней» по числу. */
export function daysWord(n: number): string {
  const a = Math.abs(n) % 100;
  if (a >= 11 && a <= 14) return 'дней';
  const b = a % 10;
  if (b === 1) return 'день';
  if (b >= 2 && b <= 4) return 'дня';
  return 'дней';
}

/** «сегодня», «завтра», «через N дней». */
export function relativeDays(n: number): string {
  if (n <= 0) return 'сегодня';
  if (n === 1) return 'завтра';
  return `через ${n} ${daysWord(n)}`;
}

/** Короткий отсчёт для узкой колонки справа: «сегодня», «завтра», «через 12 дн.». */
export function shortDays(n: number): string {
  if (n <= 0) return 'сегодня';
  if (n === 1) return 'завтра';
  return `через ${n} дн.`;
}

const byNext = (a: ReminderEntry, b: ReminderEntry) =>
  (a.next ?? '').localeCompare(b.next ?? '') ||
  (a.reminder.time ?? '').localeCompare(b.reminder.time ?? '') ||
  a.reminder.text.localeCompare(b.reminder.text);

const byDays = (a: ReminderEntry, b: ReminderEntry) => (a.days ?? 0) - (b.days ?? 0) || byNext(a, b);

/**
 * Раскладывает напоминания по разделам тихой ведомости.
 * Ежегодные (дни рождения) живут отдельным списком по близости,
 * прошедшие разовые собираются в свёрнутый раздел.
 */
export function groupReminders(reminders: Reminder[], fromISO: string): ReminderGroups {
  const groups: ReminderGroups = { today: [], week: [], later: [], yearly: [], past: [] };

  for (const reminder of reminders) {
    const next = nextOccurrence(reminder, fromISO);
    const days = daysUntil(reminder, fromISO);
    const entry: ReminderEntry = { reminder, next, days };
    if (next === null || days === null) groups.past.push(entry);
    else if (reminder.repeat === 'yearly') groups.yearly.push(entry);
    else if (days === 0) groups.today.push(entry);
    else if (days <= 7) groups.week.push(entry);
    else groups.later.push(entry);
  }

  groups.today.sort(byNext);
  groups.week.sort(byNext);
  groups.later.sort(byNext);
  groups.yearly.sort(byDays);
  groups.past.sort((a, b) => b.reminder.date.localeCompare(a.reminder.date));
  return groups;
}

/**
 * «Скоро»: ближайшие даты для верхних плиток. Ежедневные не берём — это распорядок, а не дата,
 * иначе они всегда занимали бы все места. Порядок: ближе раньше, затем по времени.
 */
export function soonest(reminders: Reminder[], fromISO: string, limit = 3): ReminderEntry[] {
  const out: ReminderEntry[] = [];
  for (const reminder of reminders) {
    if (reminder.repeat === 'daily') continue;
    const next = nextOccurrence(reminder, fromISO);
    const days = daysUntil(reminder, fromISO);
    if (next === null || days === null) continue;
    out.push({ reminder, next, days });
  }
  return out.sort(byDays).slice(0, limit);
}

/** Заполненность кольца обратного отсчёта: чем ближе дата, тем полнее (месяц — пустое кольцо). */
export function countdownRatio(days: number, horizon = 30): number {
  if (days <= 0) return 1;
  return Math.max(0.06, 1 - days / horizon);
}

export type Postpone = 'tomorrow' | 'week';

/** Новая дата разового напоминания: «на завтра» — завтрашний день, «через неделю» — через 7 дней от сегодня. */
export function postponeDate(to: Postpone, todayISO: string): string {
  return addDaysISO(todayISO, to === 'tomorrow' ? 1 : 7);
}
