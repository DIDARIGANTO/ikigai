import { describe, it, expect } from 'vitest';
import type { Task } from '@/lib/types';
import { applyTarget, changed, moveMessage } from './move';

const task = (p: Partial<Task> = {}): Task => ({
  id: 't', createdAt: '', updatedAt: '', title: 't', area: 'work',
  status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: 0, ...p,
});

describe('applyTarget', () => {
  it('смена дня — через reschedule: счётчик переносов растёт', () => {
    const next = applyTarget(task({ date: '2026-09-30', plannedStart: '10:00' }), { date: '2026-10-01', start: 11 * 60 });
    expect(next).toMatchObject({ date: '2026-10-01', plannedStart: '11:00', rescheduleCount: 1 });
  });
  it('та же дата — только время, счётчик не трогаем', () => {
    const next = applyTarget(task({ date: '2026-09-30', plannedStart: '10:00' }), { date: '2026-09-30', start: 615 });
    expect(next).toMatchObject({ plannedStart: '10:15', rescheduleCount: 0 });
  });
  it('в дорожку «весь день» — время снимается', () => {
    const next = applyTarget(task({ date: '2026-09-30', plannedStart: '10:00' }), { date: '2026-09-30', start: null });
    expect(next.plannedStart).toBeUndefined();
    expect(moveMessage(task({ date: '2026-09-30', plannedStart: '10:00' }), next)).toMatch(/^Без времени/);
  });
  it('растягивание меняет только длительность', () => {
    const before = task({ date: '2026-09-30', plannedStart: '10:00', plannedMinutes: 30 });
    const next = applyTarget(before, { date: '2026-09-30', duration: 75 });
    expect(next.plannedMinutes).toBe(75);
    expect(moveMessage(before, next)).toBe('Длительность: 1 ч 15 мин');
  });
  it('перенос в месяце не трогает время', () => {
    const before = task({ date: '2026-09-30', plannedStart: '10:00' });
    const next = applyTarget(before, { date: '2026-10-02' });
    expect(next.plannedStart).toBe('10:00');
    expect(moveMessage(before, next)).toBe('Перенесено на пт, 2 окт., 10:00');
  });
  it('ничего не поменялось', () => {
    const before = task({ date: '2026-09-30' });
    expect(changed(before, applyTarget(before, { date: '2026-09-30' }))).toBe(false);
  });
});
