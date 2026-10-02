import { describe, it, expect, beforeEach } from 'vitest';
import { CELEBRATED_KEY, markCelebrated, readCelebrated, shouldCelebrate } from './celebrate';

beforeEach(() => localStorage.clear());

describe('goal celebration', () => {
  it('fires for an active goal at 100% that was not celebrated', () => {
    expect(shouldCelebrate({ id: 'a', progress: 1, status: 'active', celebrated: new Set() })).toBe(true);
  });
  it('does not fire below 100%, for closed goals or twice', () => {
    expect(shouldCelebrate({ id: 'a', progress: 0.99, status: 'active', celebrated: new Set() })).toBe(false);
    expect(shouldCelebrate({ id: 'a', progress: 1, status: 'done', celebrated: new Set() })).toBe(false);
    expect(shouldCelebrate({ id: 'a', progress: 1, status: 'active', celebrated: new Set(['a']) })).toBe(false);
  });
  it('remembers celebrated goals across reads', () => {
    markCelebrated('a');
    markCelebrated('b');
    markCelebrated('a');
    expect([...readCelebrated()].sort()).toEqual(['a', 'b']);
    expect(shouldCelebrate({ id: 'a', progress: 1, status: 'active', celebrated: readCelebrated() })).toBe(false);
  });
  it('survives garbage in storage', () => {
    localStorage.setItem(CELEBRATED_KEY, '{nope');
    expect(readCelebrated().size).toBe(0);
    localStorage.setItem(CELEBRATED_KEY, '{"a":1}');
    expect(readCelebrated().size).toBe(0);
  });
});
