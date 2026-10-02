import { useCallback } from 'react';
import type { CollectionName, Row } from '@/lib/types';
import { useRepo } from '@/data/hooks';
import { useToast } from '@/components/ui/Toast';

/**
 * Отмена на снимках: каждое изменение — пара «было / стало» по строке.
 * `before: null` — строку создали, `after: null` — удалили. Отмена применяет пары наоборот:
 * созданное удаляет, изменённое и удалённое кладёт обратно как было.
 */
export type RowChange = {
  [K in CollectionName]: { name: K; before: Row<K> | null; after: Row<K> | null };
}[CollectionName];

/** Минимум хранилища, который нужен отмене (`useRepo()` и `Store` подходят). */
export interface UndoRepo {
  put<K extends CollectionName>(name: K, row: Row<K>): Promise<void>;
  remove<K extends CollectionName>(name: K, id: string): Promise<void>;
}

export const created = <K extends CollectionName>(name: K, row: Row<K>) => ({ name, before: null, after: row }) as RowChange;
export const updated = <K extends CollectionName>(name: K, before: Row<K>, after: Row<K>) => ({ name, before, after }) as RowChange;
export const deleted = <K extends CollectionName>(name: K, row: Row<K>) => ({ name, before: row, after: null }) as RowChange;

/** Применяет изменения по порядку. */
export async function applyChanges(repo: UndoRepo, changes: RowChange[]): Promise<void> {
  for (const c of changes) {
    if (c.after) await repo.put(c.name, c.after as never);
    else if (c.before) await repo.remove(c.name, c.before.id);
  }
}

/** Обратные изменения — в обратном порядке. */
export function inverse(changes: RowChange[]): RowChange[] {
  return [...changes].reverse().map(c => ({ name: c.name, before: c.after, after: c.before }) as RowChange);
}

export const revertChanges = (repo: UndoRepo, changes: RowChange[]) => applyChanges(repo, inverse(changes));

export const UNDO_LABEL = 'Отменить';
export const UNDO_DURATION = 6000;

export interface UndoableOptions {
  /** Что сказать после отмены. По умолчанию — «Отменено». */
  undone?: string;
  /** Вызвать после отмены (например, вернуть текст в поле). */
  onUndo?: () => void;
}

/**
 * `const commit = useUndoable(); await commit('Задача удалена', [deleted('tasks', t)]);`
 * — применяет изменения и показывает тост с «Отменить». Текст `null` — применить молча.
 * Возвращает функцию отмены (её можно вызвать и без тоста — например, по Ctrl+Z).
 */
export function useUndoable() {
  const repo = useRepo();
  const toast = useToast();
  return useCallback(
    async (text: string | null, changes: RowChange[], options: UndoableOptions = {}) => {
      await applyChanges(repo, changes);
      let done = false;
      const undo = async () => {
        if (done) return;
        done = true;
        await revertChanges(repo, changes);
        options.onUndo?.();
        toast(options.undone ?? 'Отменено', { kind: 'info' });
      };
      if (text !== null) {
        toast(text, { action: { label: UNDO_LABEL, onClick: () => void undo() }, duration: UNDO_DURATION });
      }
      return undo;
    },
    [repo, toast],
  );
}
