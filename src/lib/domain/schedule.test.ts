import { describe, it, expect } from 'vitest';
import type { Task } from '@/lib/types';
import { busyIntervals, freeSlots } from './schedule';

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
  createdAt: '',
  updatedAt: '',
  date: D,
  ...p,
});

describe('busyIntervals', () => {
  it('merges overlapping tasks and ignores skipped, untimed and other days', () => {
    const tasks = [
      task({ plannedStart: '10:00', plannedMinutes: 60 }),
      task({ plannedStart: '10:30', plannedMinutes: 60 }),
      task({ plannedStart: '13:00' }), // без оценки — 30 минут
      task({ plannedStart: '15:00', status: 'skipped' }),
      task({}),
      task({ plannedStart: '09:00', date: '2026-10-01' }),
    ];
    expect(busyIntervals(tasks, D)).toEqual([
      [600, 690],
      [780, 810],
    ]);
  });
});

describe('freeSlots', () => {
  it('offers one start per gap, earliest first', () => {
    const tasks = [
      task({ plannedStart: '07:00', plannedMinutes: 60 }),
      task({ plannedStart: '10:00', plannedMinutes: 120 }),
      task({ plannedStart: '14:00', plannedMinutes: 60 }),
    ];
    expect(freeSlots(tasks, D, 30)).toEqual([
      { start: '08:00', end: '08:30' },
      { start: '12:00', end: '12:30' },
      { start: '15:00', end: '15:30' },
    ]);
  });

  it('skips gaps shorter than the duration', () => {
    const tasks = [
      task({ plannedStart: '07:00', plannedMinutes: 60 }),
      task({ plannedStart: '08:30', plannedMinutes: 60 }), // окно 08:00–08:30 мало для часа
    ];
    expect(freeSlots(tasks, D, 60, undefined, 1)).toEqual([{ start: '09:30', end: '10:30' }]);
  });

  it('snaps to 15 minutes after now and never offers the past', () => {
    expect(freeSlots([], D, 30, 14 * 60 + 5)[0]).toEqual({ start: '14:15', end: '14:45' });
    const tasks = [task({ plannedStart: '14:00', plannedMinutes: 50 })]; // до 14:50
    expect(freeSlots(tasks, D, 30, 14 * 60 + 10)[0]).toEqual({ start: '15:00', end: '15:30' });
  });

  it('fills a single long gap with later starts', () => {
    expect(freeSlots([], D, 30, 9 * 60).map(s => s.start)).toEqual(['09:00', '10:00', '11:00']);
    expect(freeSlots([], D, 90, 9 * 60).map(s => s.start)).toEqual(['09:00', '10:30', '12:00']);
  });

  it('respects the 07:00–22:00 window', () => {
    expect(freeSlots([], D, 30, 3 * 60)[0].start).toBe('07:00');
    expect(freeSlots([], D, 30, 21 * 60 + 40)).toEqual([]);
    expect(freeSlots([], D, 30, 21 * 60 + 20)).toEqual([{ start: '21:30', end: '22:00' }]);
    expect(freeSlots([], D, 30, 23 * 60)).toEqual([]);
  });

  it('treats a task that starts before 07:00 as busy', () => {
    const tasks = [task({ plannedStart: '06:30', plannedMinutes: 60 })];
    expect(freeSlots(tasks, D, 30)[0].start).toBe('07:30');
  });

  it('returns nothing when the day is full', () => {
    const tasks = [task({ plannedStart: '07:00', plannedMinutes: 15 * 60 })];
    expect(freeSlots(tasks, D, 15)).toEqual([]);
  });
});
