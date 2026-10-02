import { useCallback, useMemo } from 'react';
import type { Task, Column } from '@/lib/types';
import { useCollection, useRepo } from '@/data/hooks';
import { newId, nowISO } from '@/lib/ids';
import { findRunning } from '@/lib/domain/tasks';
import { useToast } from '@/components/ui/Toast';
import { formatShortRu } from '@/lib/dates';
import { deleted, updated, useUndoable, UNDO_DURATION } from '@/lib/undo';

export const taskOps = {
  start: (t: Task, at: string): Task => ({ ...t, status: 'doing', actualStart: at }),
  finish: (t: Task, at: string): Task => ({ ...t, status: 'done', actualEnd: at }),
  reschedule: (t: Task, date: string): Task => ({ ...t, date, rescheduleCount: t.rescheduleCount + 1 }),
  reopen: (t: Task): Task => ({ ...t, status: 'todo', actualStart: undefined, actualEnd: undefined }),
  skip: (t: Task): Task => ({ ...t, status: 'skipped' }),
};

export function newTask(p: Partial<Task> & { title: string }): Task {
  const now = nowISO();
  return { id: newId(), area: 'personal', status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: Date.now(), createdAt: now, updatedAt: now, ...p };
}

/** Переносит задачу в колонку нужного типа на её доске (для синхронизации статуса и канбана). */
export function columnFor(columns: Column[], boardId: string | undefined, kind: Column['kind']) {
  return columns.find(c => c.boardId === boardId && c.kind === kind)?.id;
}

/**
 * Необязательный последний аргумент действий. `undo: true` — тост с «Отменить» и текстом по умолчанию,
 * строка — свой текст. Без него действие молчит, как раньше (страницы показывают свои тосты).
 */
export interface ActOptions {
  undo?: boolean | string;
}

const undoText = (opts: ActOptions | undefined, fallback: string) =>
  opts?.undo ? (typeof opts.undo === 'string' ? opts.undo : fallback) : null;

export function useTaskActions() {
  const { put } = useRepo();
  const tasks = useCollection('tasks');
  const columns = useCollection('columns');
  const toast = useToast();
  const commit = useUndoable();

  const save = useCallback((t: Task) => put('tasks', t), [put]);

  /** Изменить задачу одной строкой истории: снимок «было» берётся из самой задачи. */
  const change = useCallback(
    async (before: Task, after: Task, text: string | null) => {
      await commit(text, [updated('tasks', before, after)]);
    },
    [commit],
  );

  const started = useCallback(
    (t: Task, at: string): Task => ({ ...taskOps.start(t, at), columnId: columnFor(columns, t.boardId, 'doing') ?? t.columnId }),
    [columns],
  );
  const finished = useCallback(
    (t: Task, at: string): Task => ({ ...taskOps.finish(t, at), columnId: columnFor(columns, t.boardId, 'done') ?? t.columnId }),
    [columns],
  );

  /** Закончить идущую и начать новую — один шаг, одна отмена. */
  const switchTo = useCallback(
    async (running: Task, next: Task) => {
      const at = nowISO();
      await commit(`Переключились на «${next.title}»`, [
        updated('tasks', running, finished(running, at)),
        updated('tasks', next, started(next, at)),
      ]);
    },
    [commit, finished, started],
  );

  const start = useCallback(
    async (t: Task, opts?: ActOptions) => {
      // Мешает только задача с запущенным таймером: статус `doing` без `actualStart` ставит доска.
      const running = findRunning(tasks, t.id);
      if (running) {
        toast(`Сейчас идёт «${running.title}»`, {
          kind: 'info',
          action: { label: 'Переключиться', onClick: () => void switchTo(running, t) },
          duration: UNDO_DURATION,
        });
        return;
      }
      await change(t, started(t, nowISO()), undoText(opts, 'Таймер запущен'));
    },
    [tasks, toast, switchTo, change, started],
  );

  const finish = useCallback(
    (t: Task, opts?: ActOptions) => change(t, finished(t, nowISO()), undoText(opts, 'Готово')),
    [change, finished],
  );

  const reopen = useCallback(
    (t: Task, opts?: ActOptions) =>
      change(t, { ...taskOps.reopen(t), columnId: columnFor(columns, t.boardId, 'todo') ?? t.columnId }, undoText(opts, 'Вернули в работу')),
    [columns, change],
  );

  const toggleDone = useCallback(
    (t: Task, opts?: ActOptions) => (t.status === 'done' ? reopen(t, opts) : finish(t, opts)),
    [reopen, finish],
  );
  const reschedule = useCallback(
    (t: Task, date: string, opts?: ActOptions) => change(t, taskOps.reschedule(t, date), undoText(opts, `Перенесено на ${formatShortRu(date)}`)),
    [change],
  );
  const skip = useCallback((t: Task, opts?: ActOptions) => change(t, taskOps.skip(t), undoText(opts, 'Пропущено')), [change]);
  const del = useCallback(
    async (t: Task, opts?: ActOptions) => {
      await commit(undoText(opts, 'Задача удалена'), [deleted('tasks', t)]);
    },
    [commit],
  );

  // Стабильный объект: его раздаёт контекст, поэтому лишние ссылки означали бы лишние перерисовки.
  return useMemo(
    () => ({ tasks, columns, save, start, finish, reopen, toggleDone, reschedule, skip, del, switchTo, commit }),
    [tasks, columns, save, start, finish, reopen, toggleDone, reschedule, skip, del, switchTo, commit],
  );
}
