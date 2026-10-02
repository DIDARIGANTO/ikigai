import { describe, it, expect } from 'vitest';
import type { Dream, Goal, Task } from '@/lib/types';
import {
  actualMinutes,
  contribution,
  dreamProgress,
  formatHours,
  goalChain,
  goalFamily,
  goalHours,
  goalsByHorizon,
  goalsByHours,
  previousWeekRange,
  weekRange,
} from './life';

const g = (p: Partial<Goal>): Goal => ({ id: 'g', createdAt: '', updatedAt: '', title: 'g', horizon: 'month', status: 'active', ...p });
const t = (p: Partial<Task>): Task => ({ id: 't', createdAt: '', updatedAt: '', title: 't', area: 'work', status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: 0, ...p });
const d = (p: Partial<Dream>): Dream => ({ id: 'd', createdAt: '', updatedAt: '', title: 'd', ...p });
/** Местное время → ISO, чтобы тесты не зависели от часового пояса машины. */
const at = (day: string, hh: number, mm = 0) => {
  const [y, m, dd] = day.split('-').map(Number);
  return new Date(y, m - 1, dd, hh, mm).toISOString();
};

describe('weekRange', () => {
  it('runs Monday to Sunday', () => {
    expect(weekRange('2026-09-30')).toEqual({ start: '2026-09-28', end: '2026-10-04' });
    expect(weekRange('2026-10-04')).toEqual({ start: '2026-09-28', end: '2026-10-04' });
  });
  it('previous week is the seven days before', () => {
    expect(previousWeekRange('2026-09-30')).toEqual({ start: '2026-09-21', end: '2026-09-27' });
  });
});

describe('dreamProgress', () => {
  const goals = [
    g({ id: 'a', dreamId: 'd1' }),
    g({ id: 'b', dreamId: 'd1' }),
    g({ id: 'x', dreamId: 'd1', status: 'dropped' }),
  ];
  const tasks = [t({ id: '1', goalId: 'a', status: 'done' }), t({ id: '2', goalId: 'b' })];
  it('is the mean of linked goals, ignoring dropped ones', () => {
    expect(dreamProgress(d({ id: 'd1' }), goals, tasks)).toBe(0.5);
  });
  it('follows the dream → goal link too', () => {
    expect(dreamProgress(d({ id: 'd2', goalId: 'a' }), goals, tasks)).toBe(1);
  });
  it('is 1 for a fulfilled dream and 0 without goals', () => {
    expect(dreamProgress(d({ id: 'd3', doneAt: '2026-01-01' }), [], [])).toBe(1);
    expect(dreamProgress(d({ id: 'd4' }), goals, tasks)).toBe(0);
  });
});

describe('goalHours', () => {
  const goals = [g({ id: 'y', horizon: 'year' }), g({ id: 'm', parentId: 'y' }), g({ id: 'other' })];
  const tasks = [
    t({ id: '1', goalId: 'y', status: 'done', actualStart: at('2026-09-29', 10), actualEnd: at('2026-09-29', 11, 30) }),
    t({ id: '2', goalId: 'm', status: 'done', actualStart: at('2026-09-30', 9), actualEnd: at('2026-09-30', 9, 30) }),
    // Не сделана — не считается, хоть таймер и шёл.
    t({ id: '3', goalId: 'm', status: 'doing', actualStart: at('2026-09-30', 12) }),
    // Прошлая неделя.
    t({ id: '4', goalId: 'y', status: 'done', actualStart: at('2026-09-22', 10), actualEnd: at('2026-09-22', 12) }),
    t({ id: '5', goalId: 'other', status: 'done', actualStart: at('2026-09-30', 8), actualEnd: at('2026-09-30', 9) }),
    // Без цели.
    t({ id: '6', status: 'done', actualStart: at('2026-09-30', 8), actualEnd: at('2026-09-30', 9) }),
  ];
  it('sums actual time of done tasks of the goal and its descendants in range', () => {
    expect(goalHours(tasks, '2026-09-28', '2026-10-04', goalFamily(goals, 'y'))).toBe(2);
  });
  it('without a goal set counts every goal task in range', () => {
    expect(goalHours(tasks, '2026-09-28', '2026-10-04')).toBe(3);
  });
  it('respects the range', () => {
    expect(goalHours(tasks, '2026-09-21', '2026-09-27', goalFamily(goals, 'y'))).toBe(2);
  });
  it('ignores broken timers', () => {
    expect(actualMinutes(t({ actualStart: at('2026-09-30', 10), actualEnd: at('2026-09-30', 9) }))).toBe(0);
    expect(actualMinutes(t({ actualStart: 'nope', actualEnd: 'nope' }))).toBe(0);
  });
});

describe('contribution', () => {
  it('lists goal tasks done that day with fact or plan minutes', () => {
    const tasks = [
      t({ id: '1', goalId: 'a', status: 'done', actualStart: at('2026-09-30', 10), actualEnd: at('2026-09-30', 10, 45) }),
      t({ id: '2', goalId: 'a', status: 'done', date: '2026-09-30', plannedMinutes: 30 }),
      t({ id: '3', goalId: 'a', status: 'todo', date: '2026-09-30', plannedMinutes: 30 }),
      t({ id: '4', status: 'done', date: '2026-09-30', plannedMinutes: 30 }),
      t({ id: '5', goalId: 'a', status: 'done', date: '2026-09-29', plannedMinutes: 30 }),
    ];
    const c = contribution(tasks, '2026-09-30');
    expect(c.items.map(i => i.task.id).sort()).toEqual(['1', '2']);
    expect(c.minutes).toBe(75);
  });
});

describe('goalChain', () => {
  it('walks up to the root and finds the dream on the nearest ancestor', () => {
    const goals = [g({ id: 'y', horizon: 'year', dreamId: 'd1' }), g({ id: 'm', parentId: 'y' }), g({ id: 'w', horizon: 'week', parentId: 'm' })];
    const chain = goalChain(goals[2], goals, [d({ id: 'd1' })]);
    expect(chain.goals.map(x => x.id)).toEqual(['y', 'm', 'w']);
    expect(chain.dream?.id).toBe('d1');
  });
  it('survives a parent cycle', () => {
    const goals = [g({ id: 'a', parentId: 'b' }), g({ id: 'b', parentId: 'a' })];
    expect(goalChain(goals[0], goals, []).goals.map(x => x.id)).toEqual(['b', 'a']);
  });
});

describe('goalsByHours / goalsByHorizon / formatHours', () => {
  it('sorts active goals by hours', () => {
    const goals = [g({ id: 'a', title: 'A' }), g({ id: 'b', title: 'B' }), g({ id: 'c', status: 'done' })];
    const tasks = [t({ goalId: 'b', status: 'done', actualStart: at('2026-09-30', 9), actualEnd: at('2026-09-30', 10) })];
    expect(goalsByHours(goals, tasks, '2026-09-28', '2026-10-04').map(x => [x.goal.id, x.hours])).toEqual([
      ['b', 1],
      ['a', 0],
    ]);
  });
  it('groups active goals by horizon', () => {
    const out = goalsByHorizon([g({ id: 'a', horizon: 'year' }), g({ id: 'b', horizon: 'week' }), g({ id: 'c', horizon: 'week', status: 'dropped' })]);
    expect(out.year.map(x => x.id)).toEqual(['a']);
    expect(out.week.map(x => x.id)).toEqual(['b']);
  });
  it('formats hours', () => {
    expect(formatHours(0)).toBe('0 ч');
    expect(formatHours(0.5)).toBe('30 мин');
    expect(formatHours(1.25)).toBe('1,3 ч');
    expect(formatHours(3)).toBe('3 ч');
  });
});
