import type { CollectionName, Row } from '@/lib/types';

/**
 * `offline` — облако недоступно, записи ждут в очереди.
 * `error` — браузер не даёт хранить данные (IndexedDB заблокирован, переполнен, приватный режим):
 * приложение работает в памяти до закрытия вкладки.
 */
export type StoreStatus = 'ok' | 'saving' | 'offline' | 'error';

export interface Store {
  list<K extends CollectionName>(name: K): Promise<Row<K>[]>;
  put<K extends CollectionName>(name: K, row: Row<K>): Promise<void>;
  putMany<K extends CollectionName>(name: K, rows: Row<K>[]): Promise<void>;
  remove<K extends CollectionName>(name: K, id: string): Promise<void>;
  subscribe(name: CollectionName | '*', cb: () => void): () => void;
  clearAll(): Promise<void>;
  status(): StoreStatus;
  onStatus(cb: (s: StoreStatus) => void): () => void;
  /** Текст последней ошибки хранилища, если статус `error`. */
  errorMessage?(): string | null;
}

export class Emitter {
  private subs = new Map<string, Set<() => void>>();
  on(key: string, cb: () => void) {
    if (!this.subs.has(key)) this.subs.set(key, new Set());
    this.subs.get(key)!.add(cb);
    return () => { this.subs.get(key)?.delete(cb); };
  }
  emit(key: string) {
    // '*' — «изменилось всё» (например, после очистки): будим каждого подписчика.
    if (key === '*') {
      this.subs.forEach(set => set.forEach(cb => cb()));
      return;
    }
    this.subs.get(key)?.forEach(cb => cb());
    this.subs.get('*')?.forEach(cb => cb());
  }
}
