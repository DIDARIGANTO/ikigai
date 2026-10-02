import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStore } from './local';
import { exportAll, importAll } from './exportImport';

const file = (data: unknown, app = 'ikigai') => JSON.stringify({ app, version: 1, data });

const board = (id: string) => ({ id, title: 'Работа', position: 0, createdAt: 'a', updatedAt: 'a' });

describe('importAll', () => {
  let store: LocalStore;
  beforeEach(() => { store = new LocalStore('test-' + Math.random()); });

  it('imports rows from a valid export', async () => {
    const res = await importAll(store, file({ boards: [board('b1'), board('b2')] }));
    expect(res).toEqual({ imported: 2, skipped: 0, repaired: 0 });
    expect((await store.list('boards')).map(b => b.id).sort()).toEqual(['b1', 'b2']);
  });

  it('round-trips an exported file', async () => {
    await store.put('boards', board('b1'));
    const json = await exportAll(store);
    const other = new LocalStore('test-' + Math.random());
    const res = await importAll(other, json);
    expect(res.skipped).toBe(0);
    expect((await other.list('boards'))[0].title).toBe('Работа');
  });

  it('exports and imports daily logs («Итог дня»)', async () => {
    const log = {
      id: '2026-09-30', date: '2026-09-30', energy: 4 as const, done: 3, skipped: 0, moved: 1, focusMinutes: 80,
      goalMinutes: 40, closedAt: '2026-09-30T16:00:00.000Z', createdAt: 'a', updatedAt: 'a',
    };
    await store.put('dailyLogs', log);
    const json = await exportAll(store);
    expect(JSON.parse(json).data.dailyLogs).toHaveLength(1);
    const other = new LocalStore('test-' + Math.random());
    await importAll(other, json);
    expect(await other.list('dailyLogs')).toEqual([log]);
  });

  it('rejects text that is not JSON', async () => {
    await expect(importAll(store, '<html>не тот файл</html>')).rejects.toThrow(
      'Не удалось прочитать файл: это не JSON',
    );
  });

  it('rejects JSON from another app', async () => {
    await expect(importAll(store, file({ boards: [] }, 'notion'))).rejects.toThrow(
      'Это не файл экспорта Ikigai',
    );
  });

  it('rejects a file without a data object', async () => {
    await expect(importAll(store, JSON.stringify({ app: 'ikigai' }))).rejects.toThrow(
      'Это не файл экспорта Ikigai',
    );
    await expect(importAll(store, JSON.stringify([1, 2, 3]))).rejects.toThrow(
      'Это не файл экспорта Ikigai',
    );
  });

  it('skips rows without a string id and counts them', async () => {
    const res = await importAll(
      store,
      file({ boards: [board('b1'), { title: 'без id' }, null, 'строка', { ...board(''), id: 7 }] }),
    );
    expect(res).toEqual({ imported: 1, skipped: 4, repaired: 0 });
    expect((await store.list('boards')).map(b => b.id)).toEqual(['b1']);
  });

  it('ignores collections that are not arrays', async () => {
    const res = await importAll(store, file({ boards: { id: 'b1' }, tasks: [] }));
    expect(res).toEqual({ imported: 0, skipped: 0, repaired: 0 });
    expect(await store.list('boards')).toEqual([]);
  });

  it('repairs fixable rows and counts them separately', async () => {
    const res = await importAll(
      store,
      file({
        goals: [{ id: 'g1', title: 'Цель', horizon: 'bogus', status: 'active', createdAt: 'a', updatedAt: 'a' }],
        reminders: [{ id: 'r1', text: 'без даты', repeat: 'none', createdAt: 'a', updatedAt: 'a' }],
      }),
    );
    expect(res).toEqual({ imported: 1, skipped: 1, repaired: 1 });
    expect((await store.list('goals'))[0].horizon).toBe('month');
  });
});
