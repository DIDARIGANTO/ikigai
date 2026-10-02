import { describe, it, expect } from 'vitest';
import { reminderOccursOn, nextOccurrence, daysUntil } from './reminders';
import type { Reminder } from '@/lib/types';

const base = { id: 'r', createdAt: '', updatedAt: '', text: 'x', time: undefined } as const;
const r = (date: string, repeat: Reminder['repeat']): Reminder => ({ ...base, date, repeat });

describe('reminderOccursOn', () => {
  it('none: only on its date', () => {
    expect(reminderOccursOn(r('2026-09-13', 'none'), '2026-09-13')).toBe(true);
    expect(reminderOccursOn(r('2026-09-13', 'none'), '2026-09-14')).toBe(false);
  });
  it('daily: every day from start', () => {
    expect(reminderOccursOn(r('2026-09-13', 'daily'), '2026-09-20')).toBe(true);
    expect(reminderOccursOn(r('2026-09-13', 'daily'), '2026-09-12')).toBe(false);
  });
  it('weekly: same weekday', () => {
    expect(reminderOccursOn(r('2026-09-13', 'weekly'), '2026-09-20')).toBe(true);
    expect(reminderOccursOn(r('2026-09-13', 'weekly'), '2026-09-21')).toBe(false);
  });
  it('monthly: same day of month', () => {
    expect(reminderOccursOn(r('2026-01-31', 'monthly'), '2026-03-31')).toBe(true);
    expect(reminderOccursOn(r('2026-01-31', 'monthly'), '2026-02-28')).toBe(false);
  });
  it('yearly: same month and day', () => {
    expect(reminderOccursOn(r('1994-03-14', 'yearly'), '2026-03-14')).toBe(true);
    expect(reminderOccursOn(r('1994-03-14', 'yearly'), '2026-03-15')).toBe(false);
  });
});

describe('nextOccurrence / daysUntil', () => {
  it('yearly next occurrence after today', () => {
    expect(nextOccurrence(r('1994-03-14', 'yearly'), '2026-09-13')).toBe('2027-03-14');
    expect(daysUntil(r('1994-03-14', 'yearly'), '2026-09-13')).toBe(182);
  });
  it('none in the past returns null', () => {
    expect(nextOccurrence(r('2026-01-01', 'none'), '2026-09-13')).toBeNull();
  });
  it('today counts as 0 days', () => {
    expect(daysUntil(r('2026-09-13', 'none'), '2026-09-13')).toBe(0);
  });
});
