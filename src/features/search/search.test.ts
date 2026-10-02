import { describe, expect, it } from 'vitest';
import type { Debt, Dream, Goal, List, ListItem, Note, Reminder, Task } from '@/lib/types';
import { buildSearch, flatHits, MAX_PER_GROUP } from './search';
import type { SearchData } from './search';

const base = { createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };

const task = (id: string, title: string, notes?: string): Task => ({
  id,
  title,
  notes,
  area: 'personal',
  status: 'todo',
  rescheduleCount: 0,
  source: 'web',
  kind: 'task',
  position: 0,
  date: '2026-09-14',
  ...base,
});

const note = (id: string, title: string, body = ''): Note => ({ id, title, body, source: 'web', ...base });
const list = (id: string, title: string): List => ({ id, title, icon: 'list', position: 0, pinned: false, ...base });
const listItem = (id: string, text: string, listId = 'l1'): ListItem => ({ id, listId, text, position: 0, ...base });
const goal = (id: string, title: string): Goal => ({ id, title, horizon: 'year', status: 'active', ...base });
const dream = (id: string, title: string): Dream => ({ id, title, ...base });
const debt = (id: string, person: string, over: Partial<Debt> = {}): Debt => ({
  id,
  direction: 'owedToMe',
  person,
  amount: 50000,
  currency: 'KZT',
  date: '2026-09-10',
  payments: [],
  ...base,
  ...over,
});
const reminder = (id: string, text: string): Reminder => ({ id, text, date: '2026-09-20', repeat: 'none', ...base });

const data: SearchData = {
  tasks: [task('t1', 'Позвонить маме'), task('t2', 'Разобрать почту', 'написать маме про встречу')],
  notes: [note('n1', 'Идея', 'Каждое утро — 10 минут планирования')],
  listItems: [listItem('i1', 'Наушники')],
  lists: [list('l1', 'Купить')],
  goals: [goal('g1', 'Выпустить Ikigai')],
  dreams: [dream('d1', 'Побывать в Японии')],
  reminders: [reminder('r1', 'Оплатить интернет')],
  debts: [debt('b1', 'Асхат', { note: 'за ремонт' }), debt('b2', 'Марат', { direction: 'iOwe', amount: 12000, closedAt: '2026-09-12T00:00:00.000Z' })],
};

describe('buildSearch', () => {
  it('пустой запрос ничего не ищет', () => {
    expect(buildSearch('   ', data)).toEqual([]);
  });

  it('находит задачи по названию и по заметке', () => {
    const groups = buildSearch('маме', data);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('task');
    expect(groups[0].hits.map(h => h.id)).toEqual(['t1', 't2']);
    // Задачи открываются редактором, поэтому у них нет адреса.
    expect(groups[0].hits[0].to).toBeUndefined();
  });

  it('не учитывает регистр и различие е/ё', () => {
    expect(buildSearch('ПОЗВОНИТЬ', data)[0].hits[0].id).toBe('t1');
    expect(buildSearch('наушникй'.replace('й', 'и'), data)[0].kind).toBe('listItem');
    expect(buildSearch('идея', data)[0].kind).toBe('note');
  });

  it('даёт адреса для остальных разделов', () => {
    const byKind = (q: string) => buildSearch(q, data)[0].hits[0];
    expect(byKind('идея').to).toBe('/notes?note=n1');
    expect(byKind('наушники').to).toBe('/lists/l1');
    expect(byKind('наушники').subtitle).toBe('Купить');
    expect(byKind('ikigai').to).toBe('/goals/g1');
    expect(byKind('японии').to).toBe('/dreams');
    expect(byKind('интернет').to).toBe('/reminders');
  });

  it('ищет долги по имени и по заметке, подпись — направление и остаток', () => {
    const asked = buildSearch('асхат', data)[0];
    expect(asked.label).toBe('Долги');
    expect(asked.icon).toBe('debts');
    expect(asked.hits[0]).toMatchObject({ id: 'b1', kind: 'debt', title: 'Асхат', to: '/debts?debt=b1' });
    expect(asked.hits[0].subtitle).toMatch(/^Мне должны · 50\s000\s₸$/);
    expect(buildSearch('ремонт', data)[0].hits[0].id).toBe('b1');
    // закрытый долг показывает «закрыт» вместо остатка
    expect(buildSearch('марат', data)[0].hits[0].subtitle).toBe('Я должен · закрыт');
  });

  it('режет группу до восьми строк, но помнит общее число', () => {
    const many = Array.from({ length: 11 }, (_, i) => task(`x${i}`, `Задача ${i}`));
    const groups = buildSearch('задача', { ...data, tasks: many });
    expect(groups[0].hits).toHaveLength(MAX_PER_GROUP);
    expect(groups[0].total).toBe(11);
  });

  it('плоский список идёт в порядке групп', () => {
    const groups = buildSearch('а', data);
    const keys = flatHits(groups).map(h => h.key);
    expect(keys.length).toBeGreaterThan(1);
    expect(keys).toEqual([...new Set(keys)]);
  });
});
