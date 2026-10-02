import { describe, it, expect } from 'vitest';
import { taskOps } from './useTaskActions';
import type { Task } from '@/lib/types';

const t = (p: Partial<Task>): Task => ({ id: 't', createdAt: '', updatedAt: '', title: 'x', area: 'work', status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: 0, ...p });

describe('taskOps', () => {
  it('start sets doing and actualStart', () => {
    const r = taskOps.start(t({}), '2026-09-13T05:00:00Z');
    expect(r.status).toBe('doing'); expect(r.actualStart).toBe('2026-09-13T05:00:00Z');
  });
  it('finish sets done and actualEnd; keeps actualStart', () => {
    const r = taskOps.finish(t({ status: 'doing', actualStart: 'a' }), 'b');
    expect(r).toMatchObject({ status: 'done', actualStart: 'a', actualEnd: 'b' });
  });
  it('finish without start still marks done', () => {
    expect(taskOps.finish(t({}), 'b').status).toBe('done');
  });
  it('reschedule changes date and increments counter', () => {
    const r = taskOps.reschedule(t({ date: '2026-09-12' }), '2026-09-13');
    expect(r.date).toBe('2026-09-13'); expect(r.rescheduleCount).toBe(1);
  });
  it('reopen returns to todo and clears actuals', () => {
    const r = taskOps.reopen(t({ status: 'done', actualStart: 'a', actualEnd: 'b' }));
    expect(r).toMatchObject({ status: 'todo', actualStart: undefined, actualEnd: undefined });
  });
});
