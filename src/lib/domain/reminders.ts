import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Reminder } from '@/lib/types';
import { addDaysISO } from '@/lib/dates';

export function reminderOccursOn(r: Reminder, dateISO: string): boolean {
  if (dateISO < r.date) return false;
  if (r.repeat === 'none') return r.date === dateISO;
  if (r.repeat === 'daily') return true;
  const a = parseISO(r.date), b = parseISO(dateISO);
  if (r.repeat === 'weekly') return a.getDay() === b.getDay();
  if (r.repeat === 'monthly') return a.getDate() === b.getDate();
  return a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); // yearly
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
  return next ? differenceInCalendarDays(parseISO(next), parseISO(fromISO)) : null;
}
