import { describe, it, expect } from 'vitest';
import type { Reminder, Task } from '@/lib/types';
import {
  DAY_END,
  DAY_START,
  GRID_PX,
  HOUR_PX,
  calendarHotkey,
  clampDuration,
  clampStart,
  columnAt,
  dateFromDroppableId,
  dayLoad,
  factSpan,
  formatDuration,
  initialScrollMinute,
  layoutLanes,
  minutesToPx,
  nudgeSlot,
  planSpan,
  planSummary,
  pxToMinutes,
  shiftDate,
  slotAt,
  snapMinutes,
  startKeyboardMove,
  stepKeyboardMove,
  summaryLine,
  dayDroppableId,
  monthGrid,
  remindersOn,
  shiftCursor,
  tasksByDate,
  weekGrid,
  weekTitleRu,
} from './grid';

const task = (id: string, p: Partial<Task> = {}): Task => ({
  id, createdAt: '', updatedAt: '', title: id, area: 'personal',
  status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: 0, ...p,
});

const reminder = (id: string, p: Partial<Reminder> = {}): Reminder => ({
  id, createdAt: '', updatedAt: '', text: id, date: '2026-09-14', repeat: 'none', ...p,
});

describe('monthGrid', () => {
  it('всегда шесть недель', () => expect(monthGrid('2026-09-14')).toHaveLength(42));

  it('начинается с понедельника перед первым числом', () => {
    // 1 сентября 2026 — вторник, значит сетка открывается 31 августа.
    const grid = monthGrid('2026-09-14');
    expect(grid[0]).toBe('2026-08-31');
    expect(grid[41]).toBe('2026-10-11');
  });

  it('месяц, начинающийся с понедельника, не тянет прошлый', () => {
    // 1 июня 2026 — понедельник.
    expect(monthGrid('2026-06-30')[0]).toBe('2026-06-01');
  });

  it('дни идут подряд без пропусков', () => {
    const grid = monthGrid('2026-02-15');
    expect(grid).toContain('2026-02-28');
    expect(grid).toContain('2026-03-01');
    expect(new Set(grid).size).toBe(42);
  });
});

describe('weekGrid', () => {
  it('семь дней с понедельника', () => {
    expect(weekGrid('2026-09-14')).toEqual([
      '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20',
    ]);
  });

  it('воскресенье относится к уходящей неделе', () => expect(weekGrid('2026-09-13')[0]).toBe('2026-09-07'));
});

describe('shiftCursor', () => {
  it('месяц', () => expect(shiftCursor('2026-09-14', 'month', 1)).toBe('2026-10-14'));
  it('месяц назад', () => expect(shiftCursor('2026-01-15', 'month', -1)).toBe('2025-12-15'));
  it('короткий месяц не выходит за границу', () => expect(shiftCursor('2026-01-31', 'month', 1)).toBe('2026-02-28'));
  it('неделя', () => expect(shiftCursor('2026-09-14', 'week', 1)).toBe('2026-09-21'));
  it('день', () => expect(shiftCursor('2026-09-14', 'day', -1)).toBe('2026-09-13'));
});

describe('weekTitleRu', () => {
  it('внутри месяца', () => expect(weekTitleRu('2026-09-14')).toBe('14 – 20 сентября'));
  it('на стыке месяцев', () => expect(weekTitleRu('2026-09-30')).toBe('28 сент. – 4 окт.'));
});

describe('tasksByDate', () => {
  it('раскладывает по датам и сортирует по времени', () => {
    const map = tasksByDate([
      task('a', { date: '2026-09-14', plannedStart: '10:00' }),
      task('b', { date: '2026-09-14' }),
      task('c', { date: '2026-09-14', plannedStart: '07:00' }),
      task('d', { date: '2026-09-15' }),
      task('e'),
    ]);
    expect(map.get('2026-09-14')?.map(t => t.id)).toEqual(['c', 'a', 'b']);
    expect(map.get('2026-09-15')?.map(t => t.id)).toEqual(['d']);
    expect(map.size).toBe(2);
  });
});

describe('remindersOn', () => {
  it('учитывает повторы и сортирует по времени', () => {
    const list = [
      reminder('вечер', { repeat: 'daily', time: '21:00' }),
      reminder('без времени', { repeat: 'daily' }),
      reminder('утро', { repeat: 'daily', time: '07:00' }),
      reminder('другой день', { date: '2026-09-20' }),
    ];
    expect(remindersOn(list, '2026-09-14').map(r => r.text)).toEqual(['утро', 'вечер', 'без времени']);
  });
});

describe('dayDroppableId', () => {
  it('туда и обратно', () => expect(dateFromDroppableId(dayDroppableId('2026-09-14'))).toBe('2026-09-14'));
  it('чужой приёмник — не дата', () => expect(dateFromDroppableId('column-1')).toBeNull());
});

describe('геометрия сетки', () => {
  it('06:00 — верх, 24:00 — низ', () => {
    expect(minutesToPx(DAY_START)).toBe(0);
    expect(minutesToPx(DAY_END)).toBe(GRID_PX);
    expect(minutesToPx(7 * 60 + 30)).toBe(HOUR_PX * 1.5);
  });
  it('пиксели обратно в минуты', () => expect(pxToMinutes(HOUR_PX * 2)).toBe(8 * 60));
  it('снап к 15 минутам', () => {
    expect(snapMinutes(607)).toBe(600);
    expect(snapMinutes(608)).toBe(615);
  });
  it('начало не выходит за сетку', () => {
    expect(clampStart(5 * 60, 60)).toBe(DAY_START);
    expect(clampStart(23 * 60 + 30, 60)).toBe(23 * 60);
    expect(clampStart(10 * 60, 60)).toBe(600);
  });
  it('длительность — не короче 15 минут и до полуночи', () => {
    expect(clampDuration(600, 5)).toBe(15);
    expect(clampDuration(23 * 60, 120)).toBe(60);
  });
});

describe('колонки недели', () => {
  const days = weekGrid('2026-09-30');
  const m = { left: 100, top: 50, colWidth: 100, days };
  it('номер колонки по x', () => {
    expect(columnAt(150, m)).toBe(0);
    expect(columnAt(399, m)).toBe(2);
    expect(columnAt(20, m)).toBe(0);
    expect(columnAt(5000, m)).toBe(6);
  });
  it('слот под курсором с учётом того, где схватили блок', () => {
    // y = 50 + 4 часа → 10:00; схватили на 30-й минуте блока — начало 09:30.
    expect(slotAt(250, 50 + HOUR_PX * 4, m, 60, 30)).toEqual({ date: days[1], start: 9 * 60 + 30 });
  });
  it('слот у низа сетки прижимается', () => {
    expect(slotAt(150, 50 + GRID_PX + 200, m, 90).start).toBe(DAY_END - 90);
  });
});

describe('layoutLanes', () => {
  const it2 = (id: string, start: number, end: number) => ({ item: id, start, end });
  it('непересекающиеся — во всю ширину', () => {
    const out = layoutLanes([it2('a', 600, 660), it2('b', 660, 720)]);
    expect(out.map(b => [b.item, b.lane, b.lanes])).toEqual([['a', 0, 1], ['b', 0, 1]]);
  });
  it('пересекающиеся — по дорожкам', () => {
    const out = layoutLanes([it2('a', 600, 660), it2('b', 630, 690), it2('c', 640, 700)]);
    expect(out.map(b => [b.item, b.lane, b.lanes])).toEqual([['a', 0, 3], ['b', 1, 3], ['c', 2, 3]]);
  });
  it('лишние ложатся в последнюю дорожку', () => {
    const out = layoutLanes([it2('a', 600, 700), it2('b', 600, 700), it2('c', 600, 700)], 2);
    expect(out.map(b => b.lane)).toEqual([0, 1, 1]);
    expect(out.every(b => b.lanes === 2)).toBe(true);
  });
  it('короткий блок считается получасовым', () => {
    const out = layoutLanes([it2('a', 600, 610), it2('b', 620, 650)]);
    expect(out[1].lane).toBe(1);
  });
});

describe('planSpan и factSpan', () => {
  it('план с длительностью по умолчанию', () => {
    expect(planSpan(task('a', { plannedStart: '10:00' }))).toEqual({ start: 600, end: 630 });
    expect(planSpan(task('a'))).toBeNull();
  });
  it('поздний план прижимается к концу дня', () => {
    expect(planSpan(task('a', { plannedStart: '23:30', plannedMinutes: 90 }))).toEqual({ start: 22 * 60 + 30, end: DAY_END });
  });
  it('факт идущей задачи тянется до «сейчас»', () => {
    const d = new Date(2026, 8, 30, 10, 0);
    const t = task('a', { status: 'doing', actualStart: d.toISOString() });
    expect(factSpan(t, 11 * 60)).toEqual({ start: 600, end: 660 });
    expect(factSpan(task('b'), 600)).toBeNull();
  });
});

describe('shiftDate', () => {
  it('через конец месяца и года', () => {
    expect(shiftDate('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDate('2027-01-01', -1)).toBe('2026-12-31');
    expect(shiftDate('2028-02-28', 1)).toBe('2028-02-29');
  });
  it('неделя перехода на летнее время — ровно по дню', () => {
    const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
    const prev = env.TZ;
    env.TZ = 'Europe/Berlin';
    try {
      // 29 марта 2026 в Европе переводят часы: в этом дне 23 часа.
      expect(shiftDate('2026-03-28', 1)).toBe('2026-03-29');
      expect(shiftDate('2026-03-29', 1)).toBe('2026-03-30');
      expect(weekGrid('2026-03-29')).toEqual([
        '2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29',
      ]);
      expect(shiftDate('2026-10-25', -1)).toBe('2026-10-24');
    } finally {
      env.TZ = prev;
    }
  });
});

describe('nudgeSlot', () => {
  const slot = { date: '2026-09-30', start: 600, duration: 60 };
  it('стрелки вверх-вниз — 15 минут', () => {
    expect(nudgeSlot(slot, 'ArrowDown')).toEqual({ ...slot, start: 615 });
    expect(nudgeSlot(slot, 'ArrowUp')).toEqual({ ...slot, start: 585 });
  });
  it('влево-вправо (и с Alt) — день, через границу месяца', () => {
    expect(nudgeSlot(slot, 'ArrowRight', { alt: true })?.date).toBe('2026-10-01');
    expect(nudgeSlot(slot, 'ArrowLeft')?.date).toBe('2026-09-29');
  });
  it('Shift — длительность', () => {
    expect(nudgeSlot(slot, 'ArrowDown', { shift: true })?.duration).toBe(75);
    expect(nudgeSlot({ ...slot, duration: 15 }, 'ArrowUp', { shift: true })?.duration).toBe(15);
  });
  it('у края дня стоит на месте', () => {
    expect(nudgeSlot({ ...slot, start: DAY_END - 60 }, 'ArrowDown')?.start).toBe(DAY_END - 60);
  });
  it('без времени вверх-вниз не двигается, чужие клавиши — null', () => {
    expect(nudgeSlot({ ...slot, start: null }, 'ArrowDown')).toBeNull();
    expect(nudgeSlot(slot, 'KeyA')).toBeNull();
  });
});

describe('initialScrollMinute', () => {
  it('07:00, если дела начинаются позже', () => expect(initialScrollMinute([600], null)).toBe(6 * 60));
  it('раньше, если есть ранний блок', () => expect(initialScrollMinute([6 * 60 + 30], null)).toBe(6 * 60));
  it('без блоков — к 07:00 с запасом', () => expect(initialScrollMinute([], null)).toBe(6 * 60));
  it('на текущей неделе «сейчас» видно', () => {
    const top = initialScrollMinute([600], 17 * 60, 10 * 60);
    expect(top).toBeLessThanOrEqual(17 * 60);
    expect(top + 10 * 60).toBeGreaterThan(17 * 60 + 60);
  });
});

describe('перенос в месяце с клавиатуры', () => {
  const visible = monthGrid('2026-09-14');
  it('первым подсвечен собственный день задачи', () => {
    const m = startKeyboardMove({ id: 'a', date: '2026-09-14' }, '2026-09-30');
    expect(m.target).toBe('2026-09-14');
    expect(m.origin).toBe('2026-09-14');
  });
  it('стрелки: ±1 день, вверх-вниз — неделя', () => {
    let m = startKeyboardMove({ id: 'a', date: '2026-09-14' }, '');
    m = stepKeyboardMove(m, 'ArrowRight', visible);
    expect(m.target).toBe('2026-09-15');
    m = stepKeyboardMove(m, 'ArrowDown', visible);
    expect(m.target).toBe('2026-09-22');
    m = stepKeyboardMove(m, 'ArrowUp', visible);
    m = stepKeyboardMove(m, 'ArrowLeft', visible);
    expect(m.target).toBe('2026-09-14');
  });
  it('за край сетки не уходит', () => {
    const m = startKeyboardMove({ id: 'a', date: visible[0] }, '');
    expect(stepKeyboardMove(m, 'ArrowUp', visible).target).toBe(visible[0]);
  });
});

describe('нагрузка и итог', () => {
  it('dayLoad: от 0 до 4 делений', () => {
    expect(dayLoad([])).toBe(0);
    expect(dayLoad([task('a')])).toBe(1);
    expect(dayLoad([task('a'), task('b'), task('c')])).toBe(2);
    expect(dayLoad([task('a', { plannedMinutes: 600 })])).toBe(4);
    expect(dayLoad([task('a', { status: 'done', plannedMinutes: 600 })])).toBe(0);
  });
  it('planSummary и строка итога', () => {
    const s = planSummary([
      task('a', { plannedMinutes: 120, status: 'done' }),
      task('b', { plannedMinutes: 120 }),
      task('c', { status: 'skipped', plannedMinutes: 60 }),
    ]);
    expect(s).toEqual({ plannedMinutes: 240, done: 1, total: 2 });
    expect(summaryLine(s)).toBe('план 4 ч · сделано 1 из 2');
    expect(summaryLine({ plannedMinutes: 0, done: 0, total: 0 })).toBe('Задач нет');
  });
  it('formatDuration', () => {
    expect(formatDuration(45)).toBe('45 мин');
    expect(formatDuration(60)).toBe('1 ч');
    expect(formatDuration(90)).toBe('1 ч 30 мин');
  });
});

describe('calendarHotkey', () => {
  const k = (code: string, mods: Partial<KeyboardEvent> = {}) =>
    calendarHotkey({ code, metaKey: false, ctrlKey: false, altKey: false, ...mods } as KeyboardEvent);
  it('по физическим клавишам (работает и в русской раскладке)', () => {
    expect(k('KeyT')).toBe('today');
    expect(k('BracketLeft')).toBe('prev');
    expect(k('BracketRight')).toBe('next');
    expect(k('Digit1')).toBe('month');
    expect(k('Digit2')).toBe('week');
    expect(k('Digit3')).toBe('day');
  });
  it('с модификаторами и чужие — нет', () => {
    expect(k('KeyT', { metaKey: true })).toBeNull();
    expect(k('KeyN')).toBeNull();
  });
});
