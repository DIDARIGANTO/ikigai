import { describe, expect, it } from 'vitest';
import type { Reminder, Repeat } from '@/lib/types';
import { daysWord, groupReminders, relativeDays, shortDays } from './grouping';

const mk = (text: string, date: string, repeat: Repeat = 'none'): Reminder => ({
  id: text,
  text,
  date,
  repeat,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const TODAY = '2026-09-14';

describe('groupReminders', () => {
  it('раскладывает по срокам относительно сегодняшнего дня', () => {
    const groups = groupReminders(
      [
        mk('сегодня', TODAY),
        mk('через три дня', '2026-09-17'),
        mk('через месяц', '2026-10-20'),
        mk('день рождения', '1972-09-26', 'yearly'),
        mk('давно прошло', '2026-09-01'),
      ],
      TODAY,
    );
    expect(groups.today.map(e => e.reminder.text)).toEqual(['сегодня']);
    expect(groups.week.map(e => e.reminder.text)).toEqual(['через три дня']);
    expect(groups.later.map(e => e.reminder.text)).toEqual(['через месяц']);
    expect(groups.yearly.map(e => e.reminder.text)).toEqual(['день рождения']);
    expect(groups.past.map(e => e.reminder.text)).toEqual(['давно прошло']);
  });

  it('ежегодные остаются в своём разделе и сортируются по близости', () => {
    const groups = groupReminders([mk('позже', '1990-12-01', 'yearly'), mk('скоро', '1990-09-20', 'yearly')], TODAY);
    expect(groups.yearly.map(e => e.reminder.text)).toEqual(['скоро', 'позже']);
    expect(groups.yearly[0].days).toBe(6);
    expect(groups.today).toHaveLength(0);
  });

  it('повторяющиеся напоминания не попадают в прошедшие', () => {
    const groups = groupReminders([mk('оплатить интернет', '2026-09-05', 'monthly')], TODAY);
    expect(groups.past).toHaveLength(0);
    expect(groups.later[0].next).toBe('2026-10-05');
  });
});

describe('relativeDays', () => {
  it('называет ближайшие дни словами', () => {
    expect(relativeDays(0)).toBe('сегодня');
    expect(relativeDays(1)).toBe('завтра');
    expect(relativeDays(12)).toBe('через 12 дней');
    expect(relativeDays(2)).toBe('через 2 дня');
    expect(relativeDays(21)).toBe('через 21 день');
  });

  it('склоняет «день» по числу', () => {
    expect([1, 2, 5, 11, 22, 105].map(daysWord)).toEqual(['день', 'дня', 'дней', 'дней', 'дня', 'дней']);
  });
});

describe('shortDays — короткий отсчёт', () => {
  it('сегодня, завтра и «через N дн.»', () => {
    expect(shortDays(0)).toBe('сегодня');
    expect(shortDays(-2)).toBe('сегодня');
    expect(shortDays(1)).toBe('завтра');
    expect(shortDays(12)).toBe('через 12 дн.');
  });
});
