import { describe, it, expect } from 'vitest';
import type { Idea } from '@/lib/types';
import { IDEA_STATUSES, moveIdea, NEXT_IDEA_STATUS, splitIdeas, statusOf } from './ideas';

const T = { createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-01T08:00:00.000Z' };
const idea = (over: Partial<Idea> = {}): Idea => ({ id: 'i1', title: 'Идея', source: 'web', ...T, ...over });

describe('этапы идеи: новая → в работе → реализована', () => {
  it('an idea without a status (or with an unknown one) is new', () => {
    expect(statusOf(idea())).toBe('new');
    expect(statusOf(idea({ status: 'bogus' as never }))).toBe('new');
    for (const st of IDEA_STATUSES) expect(statusOf(idea({ status: st }))).toBe(st);
  });

  it('the order of the stages and the next one', () => {
    expect(IDEA_STATUSES).toEqual(['new', 'work', 'done']);
    expect(NEXT_IDEA_STATUS).toEqual({ new: 'work', work: 'done' });
  });

  it('splitIdeas: every stage, the newest first', () => {
    const list = [
      idea({ id: 'n-old', createdAt: '2026-09-01T00:00:00.000Z' }),
      idea({ id: 'n-new', createdAt: '2026-10-05T00:00:00.000Z', status: 'new' }),
      idea({ id: 'w', status: 'work' }),
      idea({ id: 'd2', status: 'done', createdAt: '2026-09-20T00:00:00.000Z' }),
      idea({ id: 'd1', status: 'done', createdAt: '2026-09-25T00:00:00.000Z' }),
    ];
    const s = splitIdeas(list);
    expect(s.new.map(x => x.id)).toEqual(['n-new', 'n-old']);
    expect(s.work.map(x => x.id)).toEqual(['w']);
    expect(s.done.map(x => x.id)).toEqual(['d1', 'd2']);
  });

  it('moveIdea changes the stage and keeps the original row intact', () => {
    const base = idea();
    const moved = moveIdea(base, 'work');
    expect(moved.status).toBe('work');
    expect(base.status).toBeUndefined();
  });
});
