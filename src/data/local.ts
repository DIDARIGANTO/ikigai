import Dexie, { type Table } from 'dexie';
import type { CollectionName, Row } from '@/lib/types';
import { COLLECTIONS } from '@/lib/types';
import { Emitter, type Store, type StoreStatus } from './store';
import { MemoryStore } from './memory';
import { normalizeRows, warnOnce } from './validate';

/** Коллекции первой версии базы. */
export const V1_COLLECTIONS: CollectionName[] = [
  'profiles', 'dreams', 'goals', 'boards', 'columns', 'tasks',
  'reminders', 'lists', 'listItems', 'noteFolders', 'notes',
];

/** Коллекции второй версии: первая + «Итог дня». */
export const V2_COLLECTIONS: CollectionName[] = [...V1_COLLECTIONS, 'dailyLogs'];

/** Свои `indexedDB`/`IDBKeyRange` — для тестов, где нужна сломанная база. */
type DexieDeps = { indexedDB?: IDBFactory; IDBKeyRange?: typeof IDBKeyRange };

class IkigaiDB extends Dexie {
  constructor(name: string, deps?: DexieDeps) {
    super(name, deps);
    // v1 — одиннадцать исходных коллекций. Схему прошлых версий не меняем: по ней Dexie обновляет старые базы.
    const v1: Record<string, string> = {};
    for (const c of V1_COLLECTIONS) v1[c] = 'id';
    this.version(1).stores(v1);
    // v2 — добавлен «Итог дня» (`dailyLogs`). Объявляем все коллекции: новые хранилища создаются, данные остаются.
    const v2: Record<string, string> = {};
    for (const c of V2_COLLECTIONS) v2[c] = 'id';
    this.version(2).stores(v2);
    // v3 — добавлены «Долги» (`debts`).
    const all: Record<string, string> = {};
    for (const c of COLLECTIONS) all[c] = 'id';
    this.version(3).stores(all);
  }
  typedTable<K extends CollectionName>(name: K): Table<Row<K>, string> {
    return this.table(name) as Table<Row<K>, string>;
  }
}

/** Понятный текст для типичных отказов IndexedDB. */
export function describeStorageError(e: unknown): string {
  const name = (e as { name?: string })?.name ?? '';
  const inner = (e as { inner?: { name?: string } })?.inner?.name ?? '';
  const all = `${name} ${inner}`;
  if (/Quota/i.test(all)) return 'В браузере закончилось место для данных';
  if (/MissingAPI|InvalidState|Security|NotAllowed/i.test(all)) return 'Браузер не разрешает хранить данные (возможно, приватный режим)';
  if (/Blocked|VersionChange/i.test(all)) return 'Хранилище занято другой вкладкой';
  return e instanceof Error && e.message ? e.message : 'Хранилище браузера недоступно';
}

/**
 * Браузерное хранилище на IndexedDB (Dexie). Если база не открылась или запись
 * не прошла, хранилище переходит в память: статус `error`, всё, что удалось
 * прочитать, переносится, приложение продолжает работать до закрытия вкладки.
 */
export class LocalStore implements Store {
  private db: IkigaiDB;
  private em = new Emitter();
  private mem: MemoryStore | null = null;
  private degrading: Promise<void> | null = null;
  private _status: StoreStatus = 'ok';
  private _error: string | null = null;
  private statusSubs = new Set<(s: StoreStatus) => void>();

  constructor(name = 'ikigai', deps?: DexieDeps) {
    this.db = new IkigaiDB(name, deps);
  }

  /** Выполнить операцию в IndexedDB, а при отказе — перейти в память и повторить там. */
  private async run<T>(op: (db: IkigaiDB) => Promise<T>, fallback: (m: MemoryStore) => Promise<T>): Promise<T> {
    if (!this.mem) {
      try {
        return await op(this.db);
      } catch (e) {
        await this.degrade(e);
      }
    }
    return fallback(this.mem!);
  }

  private degrade(e: unknown): Promise<void> {
    this.degrading ??= (async () => {
      console.error('Ikigai: хранилище браузера недоступно, данные живут только в этой вкладке', e);
      const mem = new MemoryStore();
      // Чтение часто работает, даже когда запись упала (например, кончилось место).
      for (const c of COLLECTIONS) {
        try {
          mem.seed(c, await this.db.typedTable(c).toArray());
        } catch {
          // Не прочиталось — начнём с пустой коллекции.
        }
      }
      this.mem = mem;
      this._error = describeStorageError(e);
      this.setStatus('error');
      // Страницы перечитают данные уже из памяти.
      this.em.emit('*');
    })();
    return this.degrading;
  }

  private setStatus(s: StoreStatus) {
    this._status = s;
    this.statusSubs.forEach(cb => cb(s));
  }

  /** Строки проходят проверку: одна битая запись не должна ронять страницу. */
  async list<K extends CollectionName>(name: K): Promise<Row<K>[]> {
    return this.run(
      async db => {
        const { rows, repaired, dropped } = normalizeRows(name, await db.typedTable(name).toArray());
        warnOnce(name, repaired, dropped);
        return rows;
      },
      m => m.list(name),
    );
  }
  async put<K extends CollectionName>(name: K, row: Row<K>) {
    await this.run(
      async db => {
        await db.typedTable(name).put(row);
        this.em.emit(name);
      },
      async m => {
        await m.put(name, row);
        this.em.emit(name);
      },
    );
  }
  async putMany<K extends CollectionName>(name: K, rows: Row<K>[]) {
    await this.run(
      async db => {
        await db.typedTable(name).bulkPut(rows);
        this.em.emit(name);
      },
      async m => {
        await m.putMany(name, rows);
        this.em.emit(name);
      },
    );
  }
  async remove<K extends CollectionName>(name: K, id: string) {
    await this.run(
      async db => {
        await db.typedTable(name).delete(id);
        this.em.emit(name);
      },
      async m => {
        await m.remove(name, id);
        this.em.emit(name);
      },
    );
  }
  subscribe(name: CollectionName | '*', cb: () => void) {
    return this.em.on(name, cb);
  }
  async clearAll() {
    await this.run(
      async db => {
        for (const c of COLLECTIONS) await db.typedTable(c).clear();
        this.em.emit('*');
      },
      async m => {
        await m.clearAll();
        this.em.emit('*');
      },
    );
  }
  status(): StoreStatus {
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
