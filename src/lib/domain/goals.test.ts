import { describe, it, expect } from 'vitest';
import { goalProgress, childGoals } from './goals';
import type { Goal, Task } from '@/lib/types';

const g = (p: Partial<Goal>): Goal => ({ id: 'g', createdAt: '', updatedAt: '', title: 'g', horizon: 'month', status: 'active', ...p });
const t = (p: Partial<Task>): Task => ({ id: 't', createdAt: '', updatedAt: '', title: 't', area: 'work', status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: 0, ...p });

describe('goalProgress', () => {
  it('is 0 with nothing linked', () => {
    expect(goalProgress(g({ id: 'a' }), [], [])).toBe(0);
  });
  it('counts done tasks and done subgoals equally', () => {
    const goals = [g({ id: 'a' }), g({ id: 'b', parentId: 'a', status: 'done' }), g({ id: 'c', parentId: 'a' })];
    const tasks = [t({ id: '1', goalId: 'a', status: 'done' }), t({ id: '2', goalId: 'a' })];
    expect(goalProgress(goals[0], goals, tasks)).toBe(0.5); // 2 of 4
  });
  it('is 1 when goal itself is done', () => {
    expect(goalProgress(g({ id: 'a', status: 'done' }), [], [])).toBe(1);
  });
  it('childGoals returns direct children', () => {
    const goals = [g({ id: 'a' }), g({ id: 'b', parentId: 'a' })];
    expect(childGoals(goals, 'a').map(x => x.id)).toEqual(['b']);
  });
});
