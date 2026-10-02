import { describe, it, expect } from 'vitest';
import type { Dream, Goal, Profile, Task } from '@/lib/types';
import { CELEBRATE_MS, checklistSteps, checklistView, countContent, shouldOnboard } from './logic';

const STAMP = '2026-09-30T08:00:00.000Z';
const profile = (p: Partial<Profile> = {}): Profile => ({
  id: 'me', timezone: 'Asia/Almaty', morningTime: '09:00', currency: 'KZT', createdAt: STAMP, updatedAt: STAMP, ...p,
});
const row = (createdAt: string, updatedAt = createdAt) => ({ createdAt, updatedAt });
const g = (p: Partial<Goal>): Goal => ({ id: 'g', createdAt: '', updatedAt: '', title: 'g', horizon: 'week', status: 'active', ...p });
const t = (p: Partial<Task>): Task => ({ id: 't', createdAt: '', updatedAt: '', title: 't', area: 'work', status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: 0, ...p });
const d = (id: string): Dream => ({ id, createdAt: '', updatedAt: '', title: id });

describe('countContent', () => {
  it('counts untouched rows from the demo batch as demo', () => {
    const p = profile({ demoLoaded: true });
    const rows = [row(STAMP), row(STAMP), row(STAMP, '2026-09-30T09:00:00.000Z'), row('2026-09-30T10:00:00.000Z')];
    expect(countContent(p, rows)).toEqual({ total: 4, demo: 2 });
  });
  it('without demo nothing is demo', () => {
    expect(countContent(profile(), [row(STAMP)])).toEqual({ total: 1, demo: 0 });
    expect(countContent(undefined, [row(STAMP)])).toEqual({ total: 1, demo: 0 });
  });
});

describe('shouldOnboard', () => {
  it('waits while the profile is loading', () => {
    expect(shouldOnboard(null, { total: 0, demo: 0 })).toBe(false);
  });
  it('shows for a fresh profile with untouched demo data', () => {
    expect(shouldOnboard(profile({ demoLoaded: true }), { total: 20, demo: 20 })).toBe(true);
  });
  it('shows for an empty account, even before a profile exists', () => {
    expect(shouldOnboard(undefined, { total: 0, demo: 0 })).toBe(true);
    expect(shouldOnboard(profile(), { total: 0, demo: 0 })).toBe(true);
  });
  it('never shows once onboarded', () => {
    expect(shouldOnboard(profile({ onboarded: true }), { total: 0, demo: 0 })).toBe(false);
  });
  it('treats anyone with their own data as onboarded', () => {
    expect(shouldOnboard(profile({ demoLoaded: true }), { total: 21, demo: 20 })).toBe(false);
    expect(shouldOnboard(profile({ onboarded: false }), { total: 40, demo: 0 })).toBe(false);
  });
});

describe('checklistSteps', () => {
  it('starts with nothing done', () => {
    const steps = checklistSteps({ profile: profile(), dreams: [], goals: [], tasks: [] });
    expect(steps.map(s => s.done)).toEqual([false, false, false, false, false]);
    expect(steps[0]).toMatchObject({ have: 0, need: 3 });
  });
  it('completes each step from data', () => {
    const goals = [g({ id: 'w' })];
    const steps = checklistSteps({
      profile: profile({ weekGoalId: 'w', telegramChatId: '42' }),
      dreams: [d('1'), d('2'), d('3'), d('4')],
      goals,
      tasks: [t({ plannedStart: '09:00' })],
    });
    expect(steps.every(s => s.done)).toBe(true);
    expect(steps[0].have).toBe(3);
  });
  it('a week goal pointing at a deleted goal does not count', () => {
    const steps = checklistSteps({ profile: profile({ weekGoalId: 'gone' }), dreams: [], goals: [g({ id: 'x' })], tasks: [t({})] });
    expect(steps.find(s => s.key === 'week')?.done).toBe(false);
    expect(steps.find(s => s.key === 'goal')?.done).toBe(true);
    expect(steps.find(s => s.key === 'timed')?.done).toBe(false);
  });
});

describe('checklistView', () => {
  const base = { dismissed: false, allDone: false, seenIncomplete: true, doneAt: null, now: 1_000_000_000 };
  it('shows progress until done, hides when dismissed', () => {
    expect(checklistView(base)).toBe('progress');
    expect(checklistView({ ...base, dismissed: true })).toBe('hidden');
  });
  it('celebrates for a day after finishing, then hides', () => {
    expect(checklistView({ ...base, allDone: true })).toBe('celebrate');
    expect(checklistView({ ...base, allDone: true, doneAt: base.now - 1000 })).toBe('celebrate');
    expect(checklistView({ ...base, allDone: true, doneAt: base.now - CELEBRATE_MS - 1 })).toBe('hidden');
  });
  it('does not celebrate for someone who never saw it incomplete', () => {
    expect(checklistView({ ...base, allDone: true, seenIncomplete: false })).toBe('hidden');
  });
});
