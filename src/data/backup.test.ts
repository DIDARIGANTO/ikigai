import { describe, it, expect } from 'vitest';
import { daysBetween, shouldNudgeBackup } from './backup';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date(2026, 8, 30, 12, 0).getTime();

describe('shouldNudgeBackup', () => {
  it('stays quiet without data', () => {
    expect(shouldNudgeBackup(now, null, null, null)).toBe(false);
  });

  it('never exported: nudges only once data is older than 7 days', () => {
    expect(shouldNudgeBackup(now, null, now - 3 * DAY, null)).toBe(false);
    expect(shouldNudgeBackup(now, null, now - 7 * DAY, null)).toBe(false);
    expect(shouldNudgeBackup(now, null, now - 8 * DAY, null)).toBe(true);
  });

  it('exported before: nudges only when the copy is older than 14 days', () => {
    expect(shouldNudgeBackup(now, now - 2 * DAY, now - 100 * DAY, null)).toBe(false);
    expect(shouldNudgeBackup(now, now - 14 * DAY, now - 100 * DAY, null)).toBe(false);
    expect(shouldNudgeBackup(now, now - 15 * DAY, now - 100 * DAY, null)).toBe(true);
  });

  it('dismissing hides it for the rest of the day, then it comes back', () => {
    const old = now - 30 * DAY;
    expect(shouldNudgeBackup(now, old, old, now - 60 * 60 * 1000)).toBe(false);
    expect(shouldNudgeBackup(now, old, old, now - DAY)).toBe(true);
  });
});

describe('daysBetween', () => {
  it('counts whole days and never goes negative', () => {
    expect(daysBetween(now - 3.5 * DAY, now)).toBe(3);
    expect(daysBetween(now + DAY, now)).toBe(0);
  });
});
