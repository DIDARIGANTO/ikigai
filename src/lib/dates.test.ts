import { describe, it, expect } from 'vitest';
import { toDateISO, formatDayRu, weekRange, addDaysISO, timeToMinutes } from './dates';

describe('dates', () => {
  it('toDateISO formats a Date as YYYY-MM-DD in local time', () => {
    expect(toDateISO(new Date(2026, 8, 13))).toBe('2026-09-13');
  });
  it('formatDayRu returns Russian weekday and date', () => {
    expect(formatDayRu('2026-09-13')).toBe('воскресенье, 13 сентября');
  });
  it('weekRange returns Monday..Sunday', () => {
    expect(weekRange('2026-09-13')).toEqual({ start: '2026-09-07', end: '2026-09-13' });
    expect(weekRange('2026-09-14')).toEqual({ start: '2026-09-14', end: '2026-09-20' });
  });
  it('addDaysISO adds days', () => {
    expect(addDaysISO('2026-09-30', 1)).toBe('2026-10-01');
  });
  it('timeToMinutes parses HH:mm', () => {
    expect(timeToMinutes('09:30')).toBe(570);
  });
});
