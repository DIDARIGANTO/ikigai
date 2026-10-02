import type { CollectionName, Row } from '@/lib/types';
import { COLLECTIONS } from '@/lib/types';
import { Emitter, type Store, type StoreStatus } from './store';
import { normalizeRows, warnOnce } from './validate';

/**
 * Хранилище в памяти вкладки. Запасной вариант, когда браузер не даёт IndexedDB:
 * приложение остаётся рабочим, но всё пропадёт при закрытии — об этом говорит статус `error`.
 */
export class MemoryStore implements Store {
  private data = new Map<CollectionName, Map<string, unknown>>();
  private em = new Emitter();
  private statusSubs = new Set<(s: StoreStatus) => void>();
  private _status: StoreStatus;
  private _error: string | null;

  constructor(opts: { error?: string | null } = {}) {
    this._error = opts.error ?? null;
    this._status = this._error ? 'error' : 'ok';
    for (const c of COLLECTIONS) this.data.set(c, new Map());
  }

  /** Положить строки без уведомлений — для переноса уже прочитанных данных. */
  seed(name: CollectionName, rows: readonly unknown[]) {
    const m = this.data.get(name)!;
    for (const r of rows) {
      const id = (r as { id?: unknown })?.id;
      if (typeof id === 'string') m.set(id, r);
    }
  }

  async list<K extends CollectionName>(name: K): Promise<Row<K>[]> {
    const { rows, repaired, dropped } = normalizeRows(name, [...this.data.get(name)!.values()]);
    warnOnce(name, repaired, dropped, 'память');
    return rows;
  }
  async put<K extends CollectionName>(name: K, row: Row<K>) {
    this.data.get(name)!.set(row.id, row);
    this.em.emit(name);
  }
  async putMany<K extends CollectionName>(name: K, rows: Row<K>[]) {
    const m = this.data.get(name)!;
    for (const r of rows) m.set(r.id, r);
    this.em.emit(name);
  }
  async remove<K extends CollectionName>(name: K, id: string) {
    this.data.get(name)!.delete(id);
    this.em.emit(name);
  }
  subscribe(name: CollectionName | '*', cb: () => void) {
    return this.em.on(name, cb);
  }
  async clearAll() {
    for (const m of this.data.values()) m.clear();
    this.em.emit('*');
  }
  status() {
    return this._status;
  }
  errorMessage() {
    return this._error;
  }
  onStatus(cb: (s: StoreStatus) => void) {
    this.statusSubs.add(cb);
    return () => {
      this.statusSubs.delete(cb);
    };
  }
}
