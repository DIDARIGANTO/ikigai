import type { Store } from '@/data/store';
import { COLLECTIONS, type CollectionName } from '@/lib/types';
import { nowISO } from '@/lib/ids';

/**
 * Эти коллекции демо-данные не трогают: каркас приложения (профиль, доски, колонки, папки блокнота)
 * и долги — это всегда настоящие записи человека, в демо их нет.
 */
const KEEP_COLLECTIONS: CollectionName[] = ['profiles', 'boards', 'columns', 'noteFolders', 'debts'];

/** Единственный список, который создаётся вместе с каркасом. */
export const KEPT_LIST_TITLE = 'Купить';

/**
 * Убирает всё, что пришло с демо-данными: остаются профиль, доски с колонками,
 * список «Купить» и папки блокнота. Флаг `demoLoaded` снимается, чтобы кнопка исчезла.
 */
export async function removeDemoData(store: Store): Promise<void> {
  for (const collection of COLLECTIONS) {
    if (KEEP_COLLECTIONS.includes(collection)) continue;
    const rows = await store.list(collection);
    for (const row of rows) {
      if (collection === 'lists' && (row as { title?: string }).title === KEPT_LIST_TITLE) continue;
      await store.remove(collection, row.id);
    }
  }
  const profile = (await store.list('profiles'))[0];
  if (profile) {
    // Цель недели ссылалась на удалённую цель — ссылку тоже снимаем.
    await store.put('profiles', { ...profile, demoLoaded: false, weekGoalId: undefined, updatedAt: nowISO() });
  }
}
