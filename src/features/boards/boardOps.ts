import type { Column, ColumnKind, Task } from '@/lib/types';
import { taskOps } from '@/features/tasks/useTaskActions';

/** Шаг между соседними карточками: хватает места, чтобы много раз вставлять посередине. */
export const STEP = 1000;

export const KINDS: ColumnKind[] = ['todo', 'doing', 'done'];

export const KIND_LABEL: Record<ColumnKind, string> = {
  todo: 'Надо',
  doing: 'В работе',
  done: 'Готово',
};

/** Порядок внутри колонки. При равных position решает дата создания — иначе порядок «дрожал» бы. */
export const byPosition = (a: Task, b: Task) =>
  a.position - b.position || a.createdAt.localeCompare(b.createdAt);

/** Позиция между соседями: посередине, а с краю — на шаг дальше. */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return 0;
  if (before === undefined) return after! - STEP;
  if (after === undefined) return before + STEP;
  return (before + after) / 2;
}

/**
 * Индекс вставки в колонке: над какой карточкой отпустили — туда и встаёт.
 * `ordered` — задачи целевой колонки по возрастанию position (с перетаскиваемой, если колонка та же).
 * `overTaskId === null` — бросили на пустое место колонки, значит в конец.
 */
export function dropIndex(ordered: Task[], activeId: string, overTaskId: string | null): number {
  const others = ordered.filter(t => t.id !== activeId);
  if (overTaskId === null) return others.length;
  const idx = ordered.findIndex(t => t.id === overTaskId);
  if (idx < 0) return others.length;
  return Math.min(idx, others.length);
}

/** Новая позиция задачи после переноса в колонку. */
export function dropPosition(ordered: Task[], activeId: string, overTaskId: string | null): number {
  const others = ordered.filter(t => t.id !== activeId);
  const index = dropIndex(ordered, activeId, overTaskId);
  return positionBetween(others[index - 1]?.position, others[index]?.position);
}

/**
 * Статус задачи под тип колонки: «готово» закрывает, «надо» возвращает в работу,
 * «в работе» только меняет статус — таймер запускается кнопкой, а не перетаскиванием.
 */
export function applyColumnKind(task: Task, kind: ColumnKind, at: string): Task {
  if (kind === 'done') return task.status === 'done' ? task : taskOps.finish(task, at);
  if (kind === 'todo') return task.status === 'todo' ? task : taskOps.reopen(task);
  return task.status === 'doing' ? task : { ...task, status: 'doing', actualEnd: undefined };
}

/** Колонка, в которой показывать задачу: своя, иначе подходящая по статусу, иначе первая. */
export function resolveColumnId(task: Task, columns: Column[]): string | undefined {
  if (columns.some(c => c.id === task.columnId)) return task.columnId;
  const kind: ColumnKind = task.status === 'done' ? 'done' : task.status === 'doing' ? 'doing' : 'todo';
  return (columns.find(c => c.kind === kind) ?? columns[0])?.id;
}
