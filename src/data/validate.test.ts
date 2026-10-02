import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { CollectionName } from '@/lib/types';
import { COLLECTIONS } from '@/lib/types';
import { LocalStore } from './local';
import { isDateISO, isTimeHM, normalizeRow, normalizeRows, resetWarnings } from './validate';

const T = { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

/** Правильная строка каждой коллекции: от неё отталкиваются битые варианты. */
const GOOD: Record<CollectionName, Record<string, unknown>> = {
  profiles: { id: 'me', timezone: 'Asia/Almaty', morningTime: '09:00', currency: 'KZT', ...T },
  dreams: { id: 'd1', title: 'Мечта', ...T },
  goals: { id: 'g1', title: 'Цель', horizon: 'year', status: 'active', startDate: '2026-01-01', ...T },
  boards: { id: 'b1', title: 'Работа', position: 0, ...T },
  columns: { id: 'c1', boardId: 'b1', title: 'Сделать', kind: 'todo', position: 0, ...T },
  tasks: {
    id: 't1', title: 'Задача', area: 'work', status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task',
    position: 0, date: '2026-09-30', plannedStart: '10:00', plannedMinutes: 30, ...T,
  },
  reminders: { id: 'r1', text: 'Позвонить', date: '2026-09-30', time: '09:30', repeat: 'none', ...T },
  lists: { id: 'l1', title: 'Купить', icon: 'shopping-bag', position: 0, pinned: true, ...T },
  listItems: { id: 'i1', listId: 'l1', text: 'Хлеб', price: 500, position: 0, ...T },
  noteFolders: { id: 'f1', title: 'Папка', position: 0, ...T },
  notes: { id: 'n1', title: 'Заметка', body: 'текст', source: 'web', ...T },
  dailyLogs: {
    id: '2026-09-30', date: '2026-09-30', energy: 4, done: 3, skipped: 1, moved: 0, accuracy: 1.2,
    focusMinutes: 90, goalMinutes: 60, closedAt: '2026-09-30T16:00:00.000Z', ...T,
  },
  debts: {
    id: 'db1', direction: 'owedToMe', person: 'Асхат', amount: 50000, currency: 'KZT', date: '2026-09-30',
    dueDate: '2026-10-30', note: 'за ремонт', payments: [{ id: 'p1', date: '2026-10-01', amount: 10000 }], ...T,
  },
};

/** Битая, но чинимая строка каждой коллекции и то, что должно получиться. */
const REPAIRABLE: Record<CollectionName, [Record<string, unknown>, Record<string, unknown>]> = {
  profiles: [{ timezone: 'Mars/Olympus', morningTime: '9 утра', currency: 'рубли' }, { morningTime: '09:00', currency: 'KZT' }],
  dreams: [{ title: 42, doneAt: 'когда-нибудь', goalId: '' }, { title: '42' }],
  goals: [{ horizon: 'bogus', status: 'maybe', endDate: '2026-02-30' }, { horizon: 'month', status: 'active' }],
  boards: [{ position: NaN, title: null }, { position: 0, title: '' }],
  columns: [{ kind: 'later', position: Infinity }, { kind: 'todo', position: 0 }],
  tasks: [
    { area: 'hobby', status: 'lost', source: 'fax', kind: 'meeting', rescheduleCount: '2', plannedStart: '25:00', plannedMinutes: -5, date: '30.09.2026', actualStart: 'вчера' },
    { area: 'personal', status: 'todo', source: 'web', kind: 'task', rescheduleCount: 0 },
  ],
  reminders: [{ repeat: 'hourly', time: '9:5' }, { repeat: 'none' }],
  lists: [{ pinned: 'yes', icon: undefined }, { pinned: false, icon: 'list' }],
  listItems: [{ price: 'дорого', position: '1' }, { position: 0 }],
  noteFolders: [{ position: null }, { position: 0 }],
  notes: [{ body: undefined, source: 'email' }, { body: '', source: 'web' }],
  dailyLogs: [{ energy: 9, done: 'три', accuracy: -1, closedAt: 'вечером' }, { done: 0, closedAt: '1970-01-01T00:00:00.000Z' }],
  debts: [
    { direction: 'sideways', person: 7, amount: 'много', currency: 'рубли', dueDate: 'скоро', payments: 'нет', closedAt: 'давно' },
    { direction: 'owedToMe', person: '7', amount: 0, currency: 'KZT', payments: [] },
  ],
};

/** Поля, которые после починки должны исчезнуть (неверные необязательные). */
const REMOVED: Partial<Record<CollectionName, string[]>> = {
  dreams: ['doneAt', 'goalId'],
  goals: ['endDate'],
  tasks: ['plannedStart', 'plannedMinutes', 'date', 'actualStart'],
  reminders: ['time'],
  listItems: ['price'],
  dailyLogs: ['energy', 'accuracy'],
  debts: ['dueDate', 'closedAt'],
};

/** Строки, которые починить нельзя. */
const UNFIXABLE: Partial<Record<CollectionName, Record<string, unknown>>> = {
  columns: { boardId: undefined },
  reminders: { date: 'завтра' },
  listItems: { listId: 7 },
  dailyLogs: { date: 'сегодня' },
  debts: { date: 'вчера' },
};

beforeEach(() => resetWarnings());
afterEach(() => vi.restoreAllMocks());

describe('isDateISO / isTimeHM', () => {
  it('accepts only real calendar dates and 24h times', () => {
    expect(isDateISO('2026-02-28')).toBe(true);
    expect(isDateISO('2028-02-29')).toBe(true);
    expect(isDateISO('2026-02-29')).toBe(false);
    expect(isDateISO('2026-13-01')).toBe(false);
    expect(isDateISO('2026-9-30')).toBe(false);
    expect(isTimeHM('00:00')).toBe(true);
    expect(isTimeHM('23:59')).toBe(true);
    expect(isTimeHM('24:00')).toBe(false);
    expect(isTimeHM('9:30')).toBe(false);
  });
});

describe('normalizeRow', () => {
  it.each(COLLECTIONS)('%s: a good row passes untouched (same object)', c => {
    const row = GOOD[c];
    expect(normalizeRow(c, row)).toBe(row);
  });

  it.each(COLLECTIONS)('%s: drops non-objects and rows without a string id', c => {
    for (const bad of [null, undefined, 1, 'x', [], { ...GOOD[c], id: '' }, { ...GOOD[c], id: 5 }, { title: 'нет id' }]) {
      expect(normalizeRow(c, bad)).toBeNull();
    }
  });

  it.each(COLLECTIONS)('%s: repairs what is safely repairable', c => {
    const [patch, expected] = REPAIRABLE[c];
    const raw = { ...GOOD[c], ...patch };
    const out = normalizeRow(c, raw) as Record<string, unknown> | null;
    expect(out).not.toBeNull();
    expect(out).toMatchObject(expected);
    for (const f of REMOVED[c] ?? []) expect(out).not.toHaveProperty(f);
    // Исходная строка не мутирует.
    expect(raw).toMatchObject(patch);
  });

  it.each(Object.keys(UNFIXABLE) as CollectionName[])('%s: drops rows missing a required reference or date', c => {
    expect(normalizeRow(c, { ...GOOD[c], ...UNFIXABLE[c] })).toBeNull();
  });

  it('keeps unknown fields (a newer app version may have written them)', () => {
    const out = normalizeRow('goals', { ...GOOD.goals, horizon: 'bogus', emoji: '🎯', future: { x: 1 } });
    expect(out).toMatchObject({ emoji: '🎯', future: { x: 1 }, horizon: 'month' });
  });

  it('fills missing timestamps', () => {
    const out = normalizeRow('boards', { id: 'b', title: 'x', position: 0 });
    expect(out?.createdAt).toBe('1970-01-01T00:00:00.000Z');
    expect(out?.updatedAt).toBe('1970-01-01T00:00:00.000Z');
  });

  it('debts: keeps good payments, drops broken ones, and a missing list becomes empty', () => {
    const good = { id: 'p1', date: '2026-10-01', amount: 10000 };
    const out = normalizeRow('debts', {
      ...GOOD.debts,
      payments: [good, { id: '', date: '2026-10-02', amount: 5 }, { id: 'p3', date: 'вчера', amount: 5 }, { id: 'p4', date: '2026-10-03', amount: -5 }, 'нет'],
    });
    expect(out?.payments).toEqual([good]);
    const { payments: _omit, ...noPayments } = GOOD.debts;
    expect(normalizeRow('debts', noPayments)).toMatchObject({ payments: [] });
  });

  it('replaces an invalid timezone with a valid one', () => {
    const out = normalizeRow('profiles', { ...GOOD.profiles, timezone: 'Mars/Olympus' });
    expect(() => new Intl.DateTimeFormat('en', { timeZone: out!.timezone })).not.toThrow();
  });
});

describe('normalizeRows', () => {
  it('counts repaired and dropped rows', () => {
    const r = normalizeRows('goals', [GOOD.goals, { ...GOOD.goals, id: 'g2', horizon: 'x' }, null, { id: 3 }]);
    expect(r.rows.map(g => g.id)).toEqual(['g1', 'g2']);
    expect(r.repaired).toBe(1);
    expect(r.dropped).toBe(2);
  });
});

describe('LocalStore with garbage in IndexedDB', () => {
  it('lists every collection cleanly and warns once per collection', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = new LocalStore('garbage-' + Math.random());
    // Пишем в обход проверки — так, как могла записать старая версия или ручная правка.
    for (const c of COLLECTIONS) {
      const [patch] = REPAIRABLE[c];
      await store.putMany(c, [
        GOOD[c],
        { ...GOOD[c], ...patch, id: GOOD[c].id + '-fix' },
        { ...GOOD[c], id: GOOD[c].id + '-bad', createdAt: { weird: true }, ...(UNFIXABLE[c] ?? {}) },
      ] as never);
    }
    for (const c of COLLECTIONS) {
      const rows = await store.list(c);
      const expectedCount = UNFIXABLE[c] ? 2 : 3;
      expect(rows).toHaveLength(expectedCount);
      for (const row of rows) expect(normalizeRow(c, row)).toBe(row);
    }
    const goals = await store.list('goals');
    expect(goals.every(g => ['years', 'year', 'month', 'week'].includes(g.horizon))).toBe(true);

    // Повторное чтение не спамит консоль.
    const calls = warn.mock.calls.length;
    expect(calls).toBe(COLLECTIONS.length);
    for (const c of COLLECTIONS) await store.list(c);
    expect(warn.mock.calls.length).toBe(calls);
  });
});
