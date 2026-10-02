import { describe, expect, it } from 'vitest';
import type { Reminder, Repeat } from '@/lib/types';
import { countdownRatio, postponeDate, soonest } from './grouping';

const mk = (text: string, date: string, repeat: Repeat = 'none', time?: string): Reminder => ({
  id: text,
  text,
  date,
  time,
  repeat,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const TODAY = '2026-09-14';

describe('soonest — плитки «Скоро»', () => {
  it('берёт три ближайшие даты по порядку', () => {
    const list = soonest(
      [
        mk('через месяц', '2026-10-14'),
        mk('завтра', '2026-09-15'),
        mk('день рождения', '1990-09-20', 'yearly'),
        mk('сегодня вечером', TODAY, 'none', '19:00'),
        mk('сегодня утром', TODAY, 'none', '08:00'),
      ],
      TODAY,
    );
    expect(list.map(e => e.reminder.text)).toEqual(['сегодня утром', 'сегодня вечером', 'завтра']);
    expect(list.map(e => e.days)).toEqual([0, 0, 1]);
  });

  it('пропускает ежедневные и прошедшие разовые', () => {
    const list = soonest(
      [mk('зарядка', '2026-01-01', 'daily'), mk('было', '2026-09-01'), mk('годовщина', '2020-09-30', 'yearly')],
      TODAY,
    );
    expect(list.map(e => e.reminder.text)).toEqual(['годовщина']);
    expect(list[0].next).toBe('2026-09-30');
    expect(list[0].days).toBe(16);
  });

  it('уважает лимит', () => {
    const many = Array.from({ length: 6 }, (_, i) => mk(`r${i}`, `2026-09-${20 + i}`));
    expect(soonest(many, TODAY, 2)).toHaveLength(2);
  });
});

describe('обратный отсчёт и перенос', () => {
  it('кольцо полнее, когда дата ближе', () => {
    expect(countdownRatio(0)).toBe(1);
    expect(countdownRatio(15)).toBeCloseTo(0.5);
    expect(countdownRatio(29)).toBeGreaterThan(countdownRatio(40) - 0.0001);
    expect(countdownRatio(90)).toBeCloseTo(0.06);
  });

  it('перенос считает от сегодняшнего дня', () => {
    expect(postponeDate('tomorrow', TODAY)).toBe('2026-09-15');
    expect(postponeDate('week', '2026-09-28')).toBe('2026-10-05');
  });
});
