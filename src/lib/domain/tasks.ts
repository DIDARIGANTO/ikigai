import type { Task } from '@/lib/types';

export const tasksForDate = (tasks: Task[], dateISO: string) => tasks.filter(t => t.date === dateISO);

export const carriedOverTasks = (tasks: Task[], todayISO: string) =>
  tasks.filter(t => !!t.date && t.date < todayISO && (t.status === 'todo' || t.status === 'doing'));

export const minutesBetween = (aISO: string, bISO: string) =>
  Math.round((new Date(bISO).getTime() - new Date(aISO).getTime()) / 60000);

export function planVsFact(t: Task): { planned: number; actual: number } | null {
  if (!t.plannedMinutes || !t.actualStart || !t.actualEnd) return null;
  return { planned: t.plannedMinutes, actual: minutesBetween(t.actualStart, t.actualEnd) };
}

export const sortByPlannedStart = (tasks: Task[]) =>
  [...tasks].sort((a, b) => {
    if (a.plannedStart && b.plannedStart) return a.plannedStart.localeCompare(b.plannedStart);
    if (a.plannedStart) return -1;
    if (b.plannedStart) return 1;
    return a.position - b.position;
  });

/**
 * Задача «идёт» только если её запустили таймером.
 * Один статус `doing` этого не значит: карточку могли просто перетащить в «В работе» на доске —
 * такая задача не занимает таймер и не мешает начать другую.
 */
export const isRunning = (t: Task) => t.status === 'doing' && !!t.actualStart;

export const runningTask = (tasks: Task[]) => tasks.find(isRunning);

/** Идущая задача, кроме указанной, — та, из-за которой нельзя начать новую. */
export const findRunning = (tasks: Task[], exceptId?: string) =>
  tasks.find(t => t.id !== exceptId && isRunning(t));
