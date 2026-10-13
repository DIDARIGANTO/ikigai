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
    expect(reopened.verno).toBe(5);
    expect(reopened.tables.map(t => t.name).sort()).toEqual(expect.arrayContaining(['dailyLogs', 'debts', 'sites', 'ideas']));
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
    expect(reopened.verno).toBe(5);
    expect(reopened.tables.map(t => t.name)).toContain('debts');
    reopened.close();
  });
});

describe('LocalStore schema upgrade v3 → v4', () => {
  it('keeps v3 data (debts) and adds the sites store', async () => {
    const { default: Dexie } = await import('dexie');
    const { V1_COLLECTIONS, V2_COLLECTIONS, V3_COLLECTIONS } = await import('./local');
    const name = 'upgrade-v3-' + Math.random();
    // База третьей версии (с долгами, но без сайтов), как её создавала прошлая сборка.
    const old = new Dexie(name);
    const stores = (list: string[]) => Object.fromEntries(list.map(c => [c, 'id']));
    old.version(1).stores(stores(V1_COLLECTIONS));
    old.version(2).stores(stores(V2_COLLECTIONS));
    old.version(3).stores(stores(V3_COLLECTIONS));
    await old.table('debts').put({
      id: 'db1', direction: 'iOwe', person: 'Марат', amount: 12000, currency: 'KZT', date: '2026-10-02', payments: [],
      createdAt: '2026-10-02T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z',
    });
    old.close();

    const store = new LocalStore(name);
    expect((await store.list('debts'))[0].person).toBe('Марат');
    expect(await store.list('sites')).toEqual([]);
    await store.put('sites', {
      id: 's1', title: 'S.A.T Group', createdAt: '2026-10-08T00:00:00.000Z', updatedAt: '2026-10-08T00:00:00.000Z',
    });
    expect((await store.list('sites'))[0].title).toBe('S.A.T Group');
    expect(store.status()).toBe('ok');

    const reopened = new Dexie(name);
    await reopened.open();
    expect(reopened.verno).toBe(5);
    expect(reopened.tables.map(t => t.name)).toContain('sites');
    reopened.close();
  });
});

describe('LocalStore schema upgrade v4 → v5', () => {
  it('keeps v4 data (sites) and adds the ideas store', async () => {
    const { default: Dexie } = await import('dexie');
    const { V1_COLLECTIONS, V2_COLLECTIONS, V3_COLLECTIONS, V4_COLLECTIONS } = await import('./local');
    const name = 'upgrade-v4-' + Math.random();
    // База четвёртой версии (с сайтами, но без идей), как её создавала прошлая сборка.
    const old = new Dexie(name);
    const stores = (list: string[]) => Object.fromEntries(list.map(c => [c, 'id']));
    old.version(1).stores(stores(V1_COLLECTIONS));
    old.version(2).stores(stores(V2_COLLECTIONS));
    old.version(3).stores(stores(V3_COLLECTIONS));
    old.version(4).stores(stores(V4_COLLECTIONS));
    await old.table('sites').put({ id: 's1', title: 'Кофейня Brew', createdAt: '2026-10-08T00:00:00.000Z', updatedAt: '2026-10-08T00:00:00.000Z' });
    old.close();

    const store = new LocalStore(name);
    expect((await store.list('sites'))[0].title).toBe('Кофейня Brew');
    expect(await store.list('ideas')).toEqual([]);
    await store.put('ideas', { id: 'i1', title: 'Приложение для барберов', source: 'web', createdAt: '2026-10-13T00:00:00.000Z', updatedAt: '2026-10-13T00:00:00.000Z' });
    expect((await store.list('ideas'))[0].title).toBe('Приложение для барберов');
    expect(store.status()).toBe('ok');

    const reopened = new Dexie(name);
    await reopened.open();
    expect(reopened.verno).toBe(5);
    expect(reopened.tables.map(t => t.name)).toContain('ideas');
    reopened.close();
  });
});
