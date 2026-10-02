import { describe, it, expect } from 'vitest';
import type { Dream, Goal, Reminder, Task } from '@/lib/types';
import {
  dayStats,
  daySummary,
  daypart,
  factMinutes,
  formatAccuracy,
  formatDuration,
  isInbox,
  northStarChain,
  planAccuracy,
  upcomingReminders,
} from './day';

const D = '2026-09-30';
let n = 0;
const task = (p: Partial<Task>): Task => ({
  id: `t${n++}`,
  title: 'x',
  area: 'work',
  status: 'todo',
  rescheduleCount: 0,
  source: 'web',
  kind: 'task',
  position: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...p,
});
const goal = (p: Partial<Goal> & { id: string }): Goal => ({
  title: p.id,
  horizon: 'week',
  status: 'active',
  createdAt: '',
  updatedAt: '',
  ...p,
});
const dream = (id: string): Dream => ({ id, title: id, createdAt: '', updatedAt: '' });
/** Локальное время дня D как ISO — тесты не зависят от часового пояса машины. */
const at = (hhmm: string, date = D) => new Date(`${date}T${hhmm}:00`).toISOString();

describe('daypart', () => {
  it.each([
    [5, 'dawn'],
    [7, 'dawn'],
    [8, 'day'],
    [16, 'day'],
    [17, 'dusk'],
    [20, 'dusk'],
    [21, 'night'],
    [0, 'night'],
    [4, 'night'],
    [24, 'night'],
    [-1, 'night'],
  ])('%i → %s', (h, part) => expect(daypart(h)).toBe(part));
});

describe('isInbox', () => {
  it('is a todo task with neither date nor board', () => {
    expect(isInbox(task({}))).toBe(true);
    expect(isInbox(task({ date: D }))).toBe(false);
    expect(isInbox(task({ boardId: 'b' }))).toBe(false);
    expect(isInbox(task({ status: 'done' }))).toBe(false);
    expect(isInbox(task({ status: 'doing' }))).toBe(false);
    expect(isInbox(task({ status: 'skipped' }))).toBe(false);
  });
});

describe('factMinutes', () => {
  it('counts finished, running (with now) and never started tasks', () => {
    expect(factMinutes(task({ actualStart: at('10:00'), actualEnd: at('10:45') }))).toBe(45);
    const running = task({ status: 'doing', actualStart: at('10:00') });
    expect(factMinutes(running, new Date(at('10:20')).getTime())).toBe(20);
    expect(factMinutes(running)).toBe(0);
    expect(factMinutes(task({}))).toBe(0);
  });
});

describe('daySummary', () => {
  it('sums plan and fact for the day, skipping skipped tasks and other days', () => {
    const tasks = [
      task({ date: D, plannedMinutes: 60, status: 'done', actualStart: at('09:00'), actualEnd: at('10:10') }),
      task({ date: D, plannedMinutes: 120, status: 'doing', actualStart: at('11:00') }),
      task({ date: D, plannedMinutes: 30 }),
      task({ date: D }),
      task({ date: D, plannedMinutes: 90, status: 'skipped' }),
      task({ date: '2026-09-29', plannedMinutes: 45, status: 'done' }),
    ];
    expect(daySummary(tasks, D, new Date(at('11:30')).getTime())).toEqual({
      planned: 210,
      actual: 100,
      done: 1,
      total: 4,
    });
  });

  it('is all zeros for an empty day', () => {
    expect(daySummary([], D)).toEqual({ planned: 0, actual: 0, done: 0, total: 0 });
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0 мин'],
    [45, '45 мин'],
    [60, '1 ч'],
    [300, '5 ч'],
    [200, '3 ч 20'],
    [-5, '0 мин'],
  ])('%i → %s', (m, s) => expect(formatDuration(m)).toBe(s));
});

describe('planAccuracy', () => {
  const done = (planned: number, actual: number) =>
    task({
      status: 'done',
      plannedMinutes: planned,
      actualStart: at('09:00'),
      actualEnd: new Date(new Date(at('09:00')).getTime() + actual * 60000).toISOString(),
    });

  it('is the median of actual / planned over finished tasks with a plan', () => {
    expect(planAccuracy([done(60, 60), done(60, 90), done(30, 30)])).toBe(1);
    expect(planAccuracy([done(60, 72), done(60, 60), done(60, 90)])).toBe(1.2);
    expect(planAccuracy([done(60, 60), done(60, 90)])).toBe(1.25);
  });

  it('ignores unfinished, unplanned and zero-length tasks', () => {
    expect(planAccuracy([task({ plannedMinutes: 60 }), task({ status: 'done' }), done(60, 0)])).toBeNull();
    expect(planAccuracy([])).toBeNull();
  });

  it('formats as ×1.2', () => {
    expect(formatAccuracy(1.2)).toBe('×1.2');
    expect(formatAccuracy(1)).toBe('×1');
    expect(formatAccuracy(0.84)).toBe('×0.8');
  });
});

describe('dayStats', () => {
  it('counts done, skipped, moved, focus and goal minutes', () => {
    const tasks = [
      task({ date: D, status: 'done', goalId: 'g', plannedMinutes: 60, actualStart: at('09:00'), actualEnd: at('10:00') }),
      task({ date: D, status: 'done', plannedMinutes: 20, actualStart: at('11:00'), actualEnd: at('11:30') }),
      task({ date: D, status: 'done' }),
      task({ date: D, status: 'skipped' }),
      task({ date: D }),
      // Перенесли сегодня на завтра.
      task({ date: '2026-10-01', rescheduleCount: 1, updatedAt: at('15:00') }),
      // Перенесли раньше — не сегодняшний перенос.
      task({ date: '2026-10-02', rescheduleCount: 2, updatedAt: at('15:00', '2026-09-28') }),
      // Хвост перенесли на сегодня — это не «перенесено с сегодня».
      task({ date: D, rescheduleCount: 1, updatedAt: at('09:00') }),
    ];
    expect(dayStats(tasks, D)).toEqual({
      done: 3,
      skipped: 1,
      moved: 1,
      accuracy: 1.25,
      focusMinutes: 90,
      goalMinutes: 60,
    });
  });
});

describe('northStarChain', () => {
  const goals = [
    goal({ id: 'year', horizon: 'year', dreamId: 'd1' }),
    goal({ id: 'month', horizon: 'month', parentId: 'year' }),
    goal({ id: 'week', parentId: 'month' }),
    goal({ id: 'solo' }),
  ];
  const dreams = [dream('d1'), dream('d2')];

  it('walks up to the root and finds the dream of an ancestor', () => {
    const r = northStarChain(goals, dreams, 'week', [], D);
    expect(r.goals.map(g => g.id)).toEqual(['year', 'month', 'week']);
    expect(r.dream?.id).toBe('d1');
    expect(r.nextStep).toBeUndefined();
  });

  it('prefers the closest ancestor dream', () => {
    const gs = goals.map(g => (g.id === 'month' ? { ...g, dreamId: 'd2' } : g));
    expect(northStarChain(gs, dreams, 'week', [], D).dream?.id).toBe('d2');
  });

  it('is empty without a week goal or with a missing one', () => {
    expect(northStarChain(goals, dreams, undefined, [], D)).toEqual({ goals: [] });
    expect(northStarChain(goals, dreams, 'gone', [], D)).toEqual({ goals: [] });
  });

  it('survives a parent loop', () => {
    const loop = [goal({ id: 'a', parentId: 'b' }), goal({ id: 'b', parentId: 'a' })];
    expect(northStarChain(loop, [], 'a', [], D).goals.map(g => g.id)).toEqual(['b', 'a']);
  });

  it('picks the next step: running, then today by time, then soonest, then undated', () => {
    const later = task({ goalId: 'week', date: '2026-10-03', title: 'later' });
    const soon = task({ goalId: 'week', date: '2026-10-01', title: 'soon' });
    const undated = task({ goalId: 'week', title: 'undated' });
    const t14 = task({ goalId: 'week', date: D, plannedStart: '14:00', title: '14' });
    const t10 = task({ goalId: 'week', date: D, plannedStart: '10:00', title: '10' });
    const untimed = task({ goalId: 'week', date: D, title: 'untimed' });
    const doneToday = task({ goalId: 'week', date: D, plannedStart: '08:00', status: 'done', title: 'done' });
    const overdue = task({ goalId: 'week', date: '2026-09-20', title: 'overdue' });
    const other = task({ goalId: 'solo', date: D, plannedStart: '07:00', title: 'other' });
    const running = task({ goalId: 'week', date: '2026-09-29', status: 'doing', actualStart: at('09:00'), title: 'run' });

    const pick = (ts: Task[]) => northStarChain(goals, dreams, 'week', ts, D).nextStep?.title;
    expect(pick([later, soon, undated, t14, t10, untimed, doneToday, overdue, other, running])).toBe('run');
    expect(pick([later, soon, undated, t14, t10, untimed, doneToday, overdue, other])).toBe('10');
    expect(pick([later, soon, undated, untimed, doneToday])).toBe('untimed');
    expect(pick([later, soon, undated, doneToday, overdue])).toBe('soon');
    expect(pick([undated, overdue])).toBe('undated');
    expect(pick([overdue, other])).toBeUndefined();
  });
});

describe('upcomingReminders', () => {
  const rem = (id: string, p: Partial<Reminder>): Reminder => ({
    id,
    text: id,
    date: D,
    repeat: 'none',
    createdAt: '',
    updatedAt: '',
    ...p,
  });

  it('keeps today and yearly dates within a week, nearest first', () => {
    const list = [
      rem('bday-3', { date: '1990-10-03', repeat: 'yearly' }),
      rem('bday-12', { date: '1972-10-12', repeat: 'yearly' }),
      rem('bday-today', { date: '1985-09-30', repeat: 'yearly' }),
      rem('pay', { date: '2026-09-05', repeat: 'monthly' }),
      rem('call', { date: D, time: '09:00' }),
      rem('early', { date: D, time: '07:30', repeat: 'daily' }),
      rem('next-week-once', { date: '2026-10-02' }),
      rem('past', { date: '2026-09-01' }),
    ];
    const r = upcomingReminders(list, D);
    expect(r.map(u => u.reminder.id)).toEqual(['bday-today', 'early', 'call', 'bday-3']);
    expect(r[3]).toMatchObject({ days: 3, date: '2026-10-03' });
  });

  it('includes the 7th day but not the 8th', () => {
    const list = [rem('d7', { date: '2000-10-07', repeat: 'yearly' }), rem('d8', { date: '2000-10-08', repeat: 'yearly' })];
    expect(upcomingReminders(list, D).map(u => u.reminder.id)).toEqual(['d7']);
  });
});
