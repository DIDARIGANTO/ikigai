import { describe, it, expect, vi, afterEach } from 'vitest';
import Dexie from 'dexie';
import { LocalStore } from './local';
import { MemoryStore } from './memory';
import { createLocalStore } from './index';

const board = (id: string) => ({ id, title: 'Работа', position: 0, createdAt: 'a', updatedAt: 'a' });

afterEach(() => vi.restoreAllMocks());

describe('LocalStore when IndexedDB fails', () => {
  it('switches to memory, reports status error and keeps working for the session', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = new LocalStore('fail-' + Math.random());
    await store.put('boards', board('b1'));
    const seen: string[] = [];
    store.onStatus(s => seen.push(s));
    let reloads = 0;
    store.subscribe('boards', () => reloads++);

    // Имитируем переполнение: любая запись в IndexedDB падает.
    const err = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
    const table = (store as unknown as { db: Dexie }).db.table('boards');
    vi.spyOn(table, 'put').mockRejectedValue(err);

    await store.put('boards', board('b2'));
    expect(store.status()).toBe('error');
    expect(seen).toEqual(['error']);
    expect(store.errorMessage()).toMatch(/место/);
    // Прочитанное раньше перенесено, новая запись видна.
    expect((await store.list('boards')).map(b => b.id).sort()).toEqual(['b1', 'b2']);
    expect(reloads).toBeGreaterThan(0);
    await store.remove('boards', 'b1');
    expect((await store.list('boards')).map(b => b.id)).toEqual(['b2']);
  });

  it('falls back when the database cannot be opened at all', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Как в приватном режиме Firefox: открыть базу нельзя.
    const broken = {
      open() {
        throw new DOMException('A mutation operation was attempted on a database that did not allow mutations.', 'InvalidStateError');
      },
    } as unknown as IDBFactory;
    const store = new LocalStore('closed-' + Math.random(), { indexedDB: broken, IDBKeyRange });
    expect(await store.list('tasks')).toEqual([]);
    expect(store.status()).toBe('error');
    await store.put('boards', board('b1'));
    expect((await store.list('boards')).map(b => b.id)).toEqual(['b1']);
  });
});

describe('createLocalStore', () => {
  it('uses memory with status error when IndexedDB is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('indexedDB', undefined);
    try {
      const store = createLocalStore();
      expect(store).toBeInstanceOf(MemoryStore);
      expect(store.status()).toBe('error');
      expect(store.errorMessage?.()).toBeTruthy();
      await store.put('boards', board('b1'));
      expect(await store.list('boards')).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('uses IndexedDB normally', () => {
    const store = createLocalStore('ok-' + Math.random());
    expect(store).toBeInstanceOf(LocalStore);
    expect(store.status()).toBe('ok');
  });
});
