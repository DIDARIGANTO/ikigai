import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStore } from '@/data/local';
import { loadDemo } from '@/data/seed';
import { removeDemoData } from './dataOps';

describe('removeDemoData', () => {
  let store: LocalStore;
  beforeEach(async () => {
    store = new LocalStore('demo-' + Math.random());
    await loadDemo(store);
  });

  it('оставляет каркас: доски, колонки, список «Купить», папки блокнота', async () => {
    await removeDemoData(store);
    expect((await store.list('boards')).map(b => b.title).sort()).toEqual(['Личное', 'Работа']);
    expect(await store.list('columns')).toHaveLength(6);
    expect((await store.list('lists')).map(l => l.title)).toEqual(['Купить']);
    expect((await store.list('noteFolders')).map(f => f.title)).toEqual(['Входящие']);
  });

  it('убирает демо-записи', async () => {
    expect((await store.list('tasks')).length).toBeGreaterThan(0);
    await removeDemoData(store);
    for (const c of ['tasks', 'goals', 'dreams', 'reminders', 'listItems', 'notes'] as const) {
      expect(await store.list(c)).toEqual([]);
    }
  });

  it('не трогает долги: это настоящие записи, в демо их нет', async () => {
    await store.put('debts', {
      id: 'db1', direction: 'owedToMe', person: 'Асхат', amount: 5000, currency: 'KZT', date: '2026-10-02', payments: [],
      createdAt: '2026-10-02T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z',
    });
    await removeDemoData(store);
    expect((await store.list('debts')).map(x => x.person)).toEqual(['Асхат']);
  });

  it('снимает demoLoaded и ссылку на цель недели', async () => {
    expect((await store.list('profiles'))[0].demoLoaded).toBe(true);
    await removeDemoData(store);
    const profile = (await store.list('profiles'))[0];
    expect(profile.demoLoaded).toBe(false);
    expect(profile.weekGoalId).toBeUndefined();
    expect(profile.id).toBe('me');
  });
});
