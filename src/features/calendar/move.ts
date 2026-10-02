import { useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Task } from '@/lib/types';
import { minutesToTime } from '@/lib/dates';
import { useToast } from '@/components/ui/Toast';
import { taskOps } from '@/features/tasks/useTaskActions';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import { formatDuration } from './grid';

export interface Target {
  date: string;
  /** Начало в минутах; null — без времени; undefined — время не трогаем (перенос в месяце). */
  start?: number | null;
  /** Новая длительность (только при растягивании). */
  duration?: number;
}

/**
 * Новая версия задачи после переноса. Смена даты идёт через `taskOps.reschedule` —
 * так же, как везде в приложении, со счётчиком переносов.
 */
export function applyTarget(task: Task, target: Target): Task {
  let next: Task = target.date !== task.date ? taskOps.reschedule(task, target.date) : { ...task };
  if (target.start !== undefined) {
    next = { ...next, plannedStart: target.start === null ? undefined : minutesToTime(target.start) };
  }
  if (target.duration !== undefined) next = { ...next, plannedMinutes: target.duration };
  return next;
}

/** Изменилось ли что-то, что видно в календаре. */
export const changed = (a: Task, b: Task) =>
  a.date !== b.date || a.plannedStart !== b.plannedStart || (a.plannedMinutes ?? 0) !== (b.plannedMinutes ?? 0);

const dayRu = (iso: string) => format(parseISO(iso), 'EEEEEE, d MMM', { locale: ru });

/** Текст уведомления: что именно поменялось — день, время или длительность. */
export function moveMessage(before: Task, after: Task): string {
  const dateChanged = before.date !== after.date;
  const timeChanged = before.plannedStart !== after.plannedStart;
  if ((before.plannedMinutes ?? 0) !== (after.plannedMinutes ?? 0) && !dateChanged && !timeChanged) {
    return `Длительность: ${formatDuration(after.plannedMinutes ?? 0)}`;
  }
  if (!after.date) return 'Перенесено';
  if (timeChanged && !after.plannedStart) return `Без времени, ${dayRu(after.date)}`;
  if (dateChanged) return `Перенесено на ${dayRu(after.date)}${after.plannedStart ? `, ${after.plannedStart}` : ''}`;
  return `Время: ${after.plannedStart}`;
}

/** Сохранить перенос и показать уведомление с «Отменить», которое возвращает снимок. */
export function useMoveTask() {
  const { save } = useTaskActionsCtx();
  const toast = useToast();

  return useCallback(
    async (task: Task, target: Target): Promise<string | null> => {
      const next = applyTarget(task, target);
      if (!changed(task, next)) return null;
      const snapshot = task;
      const text = moveMessage(task, next);
      try {
        await save(next);
        toast(text, {
          action: {
            label: 'Отменить',
            onClick: () => {
              save(snapshot).then(
                () => toast('Вернули как было'),
                () => toast('Не удалось отменить', { kind: 'error' }),
              );
            },
          },
        });
        return text;
      } catch {
        toast('Не удалось перенести', { kind: 'error' });
        return null;
      }
    },
    [save, toast],
  );
}
