import { describe, it, expect } from 'vitest';
import type { Task } from '@/lib/types';
import {
  applyDrag,
  buildRows,
  clampRange,
  contentHeight,
  dateAt,
  durationLabel,
  earlyMinutes,
  factFromDoneAt,
  factGeometry,
  formatRange,
  HOUR_PX,
  layoutBlocks,
  minuteAt,
  minutesOnDate,
  missedState,
  nudge,
  overrunMinutes,
  PAD_PX,
  pickScrollTarget,
  planRange,
  rescheduleOptions,
  snapMinutes,
  STRIP_PX,
  yAt,
} from './timeline';

const t = (p: Partial<Task>): Task => ({
  id: 't', createdAt: '', updatedAt: '', title: 'x', area: 'personal', status: 'todo',
  rescheduleCount: 0, source: 'web', kind: 'task', position: 0, ...p,
});

const DAY = '2026-09-30';
const iso = (hh: number, mm = 0, date = DAY) => dateAt(date, hh * 60 + mm).toISOString();

describe('snapMinutes / clampRange', () => {
  it('привязывает к 15 минутам по ближайшему делению', () => {
    expect([snapMinutes(7), snapMinutes(8), snapMinutes(22), snapMinutes(23), snapMinutes(-8)]).toEqual([0, 15, 15, 30, -15]);
    expect(snapMinutes(44, 30)).toBe(30);
  });

  it('держит отрезок в сутках, не меняя длительность', () => {
    expect(clampRange(-30, 30)).toEqual({ start: 0, end: 60 });
    expect(clampRange(1400, 1500)).toEqual({ start: 1340, end: 1440 });
    expect(clampRange(600, 660)).toEqual({ start: 600, end: 660 });
    expect(clampRange(-10, 2000)).toEqual({ start: 0, end: 1440 });
  });

  it('форматирует время и длительность', () => {
    expect(formatRange(420, 480)).toBe('07:00–08:00');
    expect(formatRange(1410, 1440)).toBe('23:30–24:00');
    expect([durationLabel(45), durationLabel(60), durationLabel(90)]).toEqual(['45 мин', '1 ч', '1 ч 30 мин']);
  });
});

describe('planRange / layoutBlocks', () => {
  it('пропускает задачи без времени', () => {
    expect(layoutBlocks([t({ id: 'a' }), t({ id: 'b', plannedStart: '09:00' })]).map(b => b.task.id)).toEqual(['b']);
  });

  it('конец по длительности: без длительности полчаса, не короче 15 минут', () => {
    expect(planRange({ plannedStart: '09:00' })).toEqual({ start: 540, end: 570 });
    expect(planRange({ plannedStart: '09:00', plannedMinutes: 5 })).toEqual({ start: 540, end: 555 });
    expect(planRange({ plannedStart: '23:50', plannedMinutes: 60 })).toEqual({ start: 1425, end: 1440 });
    expect(planRange({ plannedStart: '03:00', plannedMinutes: 30 })).toEqual({ start: 180, end: 210 });
  });

  it('непересекающиеся задачи идут одной колонкой', () => {
    const blocks = layoutBlocks([
      t({ id: 'a', plannedStart: '09:00', plannedMinutes: 60 }),
      t({ id: 'b', plannedStart: '10:00', plannedMinutes: 60 }),
    ]);
    expect(blocks.map(b => [b.lane, b.lanes])).toEqual([[0, 1], [0, 1]]);
    expect(blocks[0].nextStart).toBe(600);
    expect(blocks[1].nextStart).toBe(1440);
  });

  it('пересекающиеся задачи расходятся в колонки, до трёх', () => {
    const blocks = layoutBlocks([
      t({ id: 'a', plannedStart: '09:00', plannedMinutes: 120 }),
      t({ id: 'b', plannedStart: '09:15', plannedMinutes: 120 }),
      t({ id: 'c', plannedStart: '09:30', plannedMinutes: 120 }),
      t({ id: 'd', plannedStart: '09:45', plannedMinutes: 30 }),
    ]);
    expect(blocks.map(b => [b.task.id, b.lane, b.lanes])).toEqual([
      ['a', 0, 3],
      ['b', 1, 3],
      ['c', 2, 3],
      ['d', 2, 3],
    ]);
  });

  it('соседняя колонка того же кластера не ограничивает высоту, следующий кластер — ограничивает', () => {
    const [a, b, c] = layoutBlocks([
      t({ id: 'a', plannedStart: '09:00', plannedMinutes: 15 }),
      t({ id: 'b', plannedStart: '09:05', plannedMinutes: 60 }),
      t({ id: 'c', plannedStart: '10:30', plannedMinutes: 30 }),
    ]);
    expect(a.nextStart).toBe(630);
    expect(b.nextStart).toBe(630);
    expect(c.nextStart).toBe(1440);
  });
});

describe('factGeometry / overrun', () => {
  it('без запуска факта нет', () => {
    expect(factGeometry(t({ plannedStart: '07:00' }), DAY)).toBeNull();
  });

  it('сделанная задача — от начала до конца в минутах дня', () => {
    const f = factGeometry(t({ status: 'done', actualStart: iso(7, 10), actualEnd: iso(8, 12) }), DAY);
    expect(f).toEqual({ start: 430, end: 492, running: false });
    expect(overrunMinutes(480, f!.end)).toBe(12);
    expect(earlyMinutes(480, f!.end)).toBe(0);
  });

  it('идущая задача тянется до «сейчас»', () => {
    const f = factGeometry(t({ status: 'doing', actualStart: iso(7) }), DAY, dateAt(DAY, 7 * 60 + 25));
    expect(f).toEqual({ start: 420, end: 445, running: true });
  });

  it('факт со вчера начинается с полуночи', () => {
    expect(minutesOnDate(iso(23, 0, '2026-09-29'), DAY)).toBe(0);
    expect(minutesOnDate('не дата', DAY)).toBeNull();
  });

  it('раньше конца плана — «минус»', () => {
    expect(earlyMinutes(480, 470)).toBe(10);
    expect(overrunMinutes(480, 470)).toBe(0);
  });
});

describe('missedState', () => {
  const ctx = { date: DAY, today: DAY, nowMin: 15 * 60 };
  it('прошедшее начало без запуска — «не успел»', () => {
    expect(missedState(t({ plannedStart: '07:00' }), ctx)).toEqual({ missed: true, lateBy: 480 });
  });
  it('будущее, сделанное, пропущенное, запущенное и другие дни — нет', () => {
    expect(missedState(t({ plannedStart: '16:00' }), ctx).missed).toBe(false);
    expect(missedState(t({ plannedStart: '07:00', status: 'done' }), ctx).missed).toBe(false);
    expect(missedState(t({ plannedStart: '07:00', status: 'skipped' }), ctx).missed).toBe(false);
    expect(missedState(t({ plannedStart: '07:00', status: 'doing', actualStart: iso(7) }), ctx).missed).toBe(false);
    expect(missedState(t({ plannedStart: '07:00' }), { ...ctx, date: '2026-09-29' }).missed).toBe(false);
    expect(missedState(t({ plannedStart: '07:00' }), { ...ctx, nowMin: null }).missed).toBe(false);
  });
  it('«в работе» с доски без таймера тоже не начата', () => {
    expect(missedState(t({ plannedStart: '07:00', status: 'doing' }), ctx).missed).toBe(true);
  });
});

describe('rescheduleOptions / factFromDoneAt', () => {
  it('через час от ближайших 15 минут, вечером, завтра', () => {
    expect(rescheduleOptions(15 * 60 + 2, 60)).toEqual([
      { key: 'hour', label: '+1 час', start: 16 * 60 + 15 },
      { key: 'evening', label: 'Вечером', start: 19 * 60 },
      { key: 'tomorrow', label: 'Завтра', start: null },
    ]);
  });
  it('поздно вечером остаётся только завтра', () => {
    expect(rescheduleOptions(23 * 60, 60).map(o => o.key)).toEqual(['tomorrow']);
    expect(rescheduleOptions(19 * 60 + 30, 30).map(o => o.key)).toEqual(['hour', 'tomorrow']);
  });
  it('«сделал в» записывает факт на задуманную длительность', () => {
    const f = factFromDoneAt(DAY, 7 * 60 + 30, 45);
    expect(f).toEqual({ actualStart: iso(7, 30), actualEnd: iso(8, 15) });
  });
});

describe('pickScrollTarget', () => {
  const blocks = layoutBlocks([
    t({ id: 'a', plannedStart: '07:00', status: 'done' }),
    t({ id: 'b', plannedStart: '10:00' }),
    t({ id: 'c', plannedStart: '18:00' }),
  ]);
  it('сегодня: к первому незакрытому, если оно уже началось', () => {
    expect(pickScrollTarget(blocks, 15 * 60)).toEqual({ min: 600, align: 'top' });
  });
  it('сегодня: всё впереди — к «сейчас»', () => {
    expect(pickScrollTarget(blocks, 9 * 60)).toEqual({ min: 540, align: 'third' });
    expect(pickScrollTarget([], 9 * 60)).toEqual({ min: 540, align: 'third' });
  });
  it('другой день: к первому незакрытому, к первому блоку или к 08:00', () => {
    expect(pickScrollTarget(blocks, null)).toEqual({ min: 600, align: 'top' });
    expect(pickScrollTarget(layoutBlocks([t({ plannedStart: '06:00', status: 'done' })]), null)).toEqual({ min: 360, align: 'top' });
    expect(pickScrollTarget([], null)).toEqual({ min: 480, align: 'top' });
  });
});

describe('buildRows / yAt / minuteAt', () => {
  const pastBefore15 = (h: number) => h < 15;

  it('без свёртки — ровная сетка по 56 px', () => {
    const rows = buildRows({ busy: [], collapsible: () => false });
    expect(rows).toEqual([{ kind: 'hours', from: 0, to: 1440, top: PAD_PX, height: 24 * HOUR_PX }]);
    expect(yAt(rows, 60)).toBe(PAD_PX + HOUR_PX);
    expect(minuteAt(rows, PAD_PX + HOUR_PX * 1.5)).toBe(90);
    expect(contentHeight(rows)).toBe(24 * HOUR_PX + PAD_PX * 2);
  });

  it('пустые прошедшие часы сворачиваются в полосы, занятые и одиночные — нет', () => {
    const rows = buildRows({
      busy: [{ start: 420, end: 480 }, { start: 600, end: 840 }],
      collapsible: pastBefore15,
    });
    expect(rows.map(r => [r.kind, r.from / 60, r.to / 60])).toEqual([
      ['strip', 0, 7],
      ['hours', 7, 8],
      ['strip', 8, 10],
      ['hours', 10, 24],
    ]);
    expect(rows[1].top).toBe(PAD_PX + STRIP_PX);
    expect(yAt(rows, 420)).toBe(PAD_PX + STRIP_PX);
    // Внутри полосы минуты сжаты пропорционально.
    expect(yAt(rows, 540)).toBe(rows[2].top + STRIP_PX / 2);
    expect(minuteAt(rows, rows[2].top + STRIP_PX / 2)).toBe(540);
    expect(minuteAt(rows, 0)).toBe(0);
  });

  it('раскрытая полоса снова показывает часы', () => {
    const rows = buildRows({ busy: [], collapsible: pastBefore15, expanded: new Set([0]) });
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('hours');
  });
});

describe('applyDrag / nudge', () => {
  const base = { start: 420, end: 480 };
  it('перенос с шагом 15 минут и упором в сутки', () => {
    expect(applyDrag('move', base, 440, 468)).toEqual({ start: 450, end: 510 });
    expect(applyDrag('move', base, 440, 441)).toEqual(base);
    expect(applyDrag('move', base, 440, -300)).toEqual({ start: 0, end: 60 });
    expect(applyDrag('move', base, 440, 5000)).toEqual({ start: 1380, end: 1440 });
    expect(applyDrag('move', { start: 425, end: 485 }, 430, 430)).toEqual({ start: 420, end: 480 });
  });
  it('растягивание — только низ, не короче 15 минут', () => {
    expect(applyDrag('resize', base, 480, 512)).toEqual({ start: 420, end: 510 });
    expect(applyDrag('resize', base, 480, 300)).toEqual({ start: 420, end: 435 });
    expect(applyDrag('resize', base, 480, 5000)).toEqual({ start: 420, end: 1440 });
  });
  it('создание — вниз и вверх от точки нажатия', () => {
    expect(applyDrag('create', base, 548, 548)).toEqual({ start: 540, end: 555 });
    expect(applyDrag('create', base, 548, 632)).toEqual({ start: 540, end: 630 });
    expect(applyDrag('create', base, 548, 482)).toEqual({ start: 480, end: 555 });
  });
  it('клавиатура: стрелки двигают, Shift — длительность', () => {
    expect(nudge(base, 'move', 15)).toEqual({ start: 435, end: 495 });
    expect(nudge({ start: 0, end: 30 }, 'move', -15)).toEqual({ start: 0, end: 30 });
    expect(nudge(base, 'resize', -15)).toEqual({ start: 420, end: 465 });
    expect(nudge({ start: 420, end: 435 }, 'resize', -15)).toEqual({ start: 420, end: 435 });
  });
});
