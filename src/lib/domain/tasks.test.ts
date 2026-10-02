import { describe, it, expect } from 'vitest';
import {
  tasksForDate,
  carriedOverTasks,
  planVsFact,
  minutesBetween,
  sortByPlannedStart,
  isRunning,
  runningTask,
  findRunning,
} from './tasks';
import type { Task } from '@/lib/types';

const t = (p: Partial<Task>): Task => ({
  id: 't', createdAt: '', updatedAt: '', title: 'x', area: 'personal', status: 'todo',
  rescheduleCount: 0, source: 'web', kind: 'task', position: 0, ...p,
});

describe('tasks', () => {
  it('tasksForDate filters by date', () => {
    const a = t({ id: 'a', date: '2026-09-13' }), b = t({ id: 'b', date: '2026-09-14' });
    expect(tasksForDate([a, b], '2026-09-13').map(x => x.id)).toEqual(['a']);
  });
  it('carriedOverTasks = unfinished tasks dated before today', () => {
    const old = t({ id: 'o', date: '2026-09-10' });
    const oldDone = t({ id: 'd', date: '2026-09-10', status: 'done' });
    const today = t({ id: 'n', date: '2026-09-13' });
    expect(carriedOverTasks([old, oldDone, today], '2026-09-13').map(x => x.id)).toEqual(['o']);
  });
  it('minutesBetween rounds to whole minutes', () => {
    expect(minutesBetween('2026-09-13T10:00:00Z', '2026-09-13T11:35:30Z')).toBe(96);
  });
  it('planVsFact returns both when available', () => {
    const task = t({ plannedMinutes: 60, actualStart: '2026-09-13T10:00:00Z', actualEnd: '2026-09-13T11:35:00Z' });
    expect(planVsFact(task)).toEqual({ planned: 60, actual: 95 });
    expect(planVsFact(t({}))).toBeNull();
  });
  it('sortByPlannedStart puts timed tasks first in time order', () => {
    const a = t({ id: 'a', plannedStart: '14:00' }), b = t({ id: 'b' }), c = t({ id: 'c', plannedStart: '09:00' });
    expect(sortByPlannedStart([a, b, c]).map(x => x.id)).toEqual(['c', 'a', 'b']);
  });
  it('isRunning требует и статус doing, и actualStart', () => {
    expect(isRunning(t({ status: 'doing', actualStart: '2026-09-13T10:00:00Z' }))).toBe(true);
    // Карточку перетащили в «В работе» на доске — таймер не запускали.
    expect(isRunning(t({ status: 'doing' }))).toBe(false);
    expect(isRunning(t({ status: 'todo', actualStart: '2026-09-13T10:00:00Z' }))).toBe(false);
  });
  it('runningTask пропускает doing без actualStart', () => {
    const dragged = t({ id: 'dragged', status: 'doing' });
    const started = t({ id: 'started', status: 'doing', actualStart: '2026-09-13T10:00:00Z' });
    expect(runningTask([dragged])).toBeUndefined();
    expect(runningTask([dragged, started])?.id).toBe('started');
  });
  it('findRunning не считает саму задачу', () => {
    const started = t({ id: 'started', status: 'doing', actualStart: '2026-09-13T10:00:00Z' });
    const other = t({ id: 'other' });
    expect(findRunning([started, other], 'started')).toBeUndefined();
    expect(findRunning([started, other], 'other')?.id).toBe('started');
  });
});
