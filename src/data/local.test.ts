import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStore } from './local';

describe('LocalStore', () => {
  let store: LocalStore;
  beforeEach(async () => { store = new LocalStore('test-' + Math.random()); });

  it('puts, lists, removes', async () => {
    await store.put('boards', { id: 'b1', title: 'Работа', position: 0, createdAt: 'a', updatedAt: 'a' });
    expect((await store.list('boards')).map(b => b.title)).toEqual(['Работа']);
    await store.remove('boards', 'b1');
    expect(await store.list('boards')).toEqual([]);
  });

  it('notifies subscribers of the collection and of *', async () => {
    let n = 0, all = 0;
    store.subscribe('boards', () => n++);
    store.subscribe('*', () => all++);
    await store.put('boards', { id: 'b1', title: 'x', position: 0, createdAt: 'a', updatedAt: 'a' });
    expect(n).toBe(1); expect(all).toBe(1);
  });

  it('put with same id replaces', async () => {
    await store.put('boards', { id: 'b1', title: 'x', position: 0, createdAt: 'a', updatedAt: 'a' });
    await store.put('boards', { id: 'b1', title: 'y', position: 0, createdAt: 'a', updatedAt: 'b' });
    expect((await store.list('boards'))[0].title).toBe('y');
  });
});

describe('LocalStore schema upgrade v1 → v2', () => {
  it('keeps v1 data and adds the dailyLogs store', async () => {
    const { default: Dexie } = await import('dexie');
    const { V1_COLLECTIONS } = await import('./local');
    const name = 'upgrade-' + Math.random();
    // База первой версии, как её создавали прошлые сборки.
    const old = new Dexie(name);
    const v1: Record<string, string> = {};
    for (const c of V1_COLLECTIONS) v1[c] = 'id';
    old.version(1).stores(v1);
    await old.table('tasks').put({
      id: 't1', title: 'Старая задача', area: 'work', status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task',
      position: 0, createdAt: 'a', updatedAt: 'a',
    });
    await old.table('boards').put({ id: 'b1', title: 'Работа', position: 0, createdAt: 'a', updatedAt: 'a' });
    old.close();

    const store = new LocalStore(name);
    expect((await store.list('tasks')).map(t => t.title)).toEqual(['Старая задача']);
    expect((await store.list('boards')).map(b => b.title)).toEqual(['Работа']);
    expect(await store.list('dailyLogs')).toEqual([]);
    await store.put('dailyLogs', {
      id: '2026-09-30', date: '2026-09-30', done: 2, skipped: 0, moved: 1, focusMinutes: 50, goalMinutes: 20,
      closedAt: '2026-09-30T16:00:00.000Z', createdAt: 'a', updatedAt: 'a',
    });
    expect((await store.list('dailyLogs'))[0].done).toBe(2);
    expect(store.status()).toBe('ok');

    const reopened = new Dexie(name);
    await reopened.open();
    expect(reopened.verno).toBe(3);
    expect(reopened.tables.map(t => t.name).sort()).toEqual(expect.arrayContaining(['dailyLogs', 'debts']));
    reopened.close();
  });
});

describe('LocalStore schema upgrade v2 → v3', () => {
  it('keeps v2 data and adds the debts store', async () => {
    const { default: Dexie } = await import('dexie');
    const { V1_COLLECTIONS, V2_COLLECTIONS } = await import('./local');
    const name = 'upgrade-v2-' + Math.random();
    // База второй версии (с «Итогом дня», но без долгов), как её создавала прошлая сборка.
    const old = new Dexie(name);
    const v1: Record<string, string> = {};
    for (const c of V1_COLLECTIONS) v1[c] = 'id';
    const v2: Record<string, string> = {};
    for (const c of V2_COLLECTIONS) v2[c] = 'id';
    old.version(1).stores(v1);
    old.version(2).stores(v2);
    await old.table('dailyLogs').put({
      id: '2026-10-01', date: '2026-10-01', done: 4, skipped: 0, moved: 0, focusMinutes: 120, goalMinutes: 60,
      closedAt: '2026-10-01T16:00:00.000Z', createdAt: 'a', updatedAt: 'a',
    });
    old.close();

    const store = new LocalStore(name);
    expect((await store.list('dailyLogs'))[0].done).toBe(4);
    expect(await store.list('debts')).toEqual([]);
    await store.put('debts', {
      id: 'db1', direction: 'iOwe', person: 'Марат', amount: 12000, currency: 'KZT', date: '2026-10-02', payments: [],
      createdAt: '2026-10-02T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z',
    });
    expect((await store.list('debts'))[0].person).toBe('Марат');
    expect(store.status()).toBe('ok');

    const reopened = new Dexie(name);
    await reopened.open();
    expect(reopened.verno).toBe(3);
    expect(reopened.tables.map(t => t.name)).toContain('debts');
    reopened.close();
  });
});
