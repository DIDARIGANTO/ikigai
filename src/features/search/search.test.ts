import { describe, expect, it } from 'vitest';
import type { Debt, Dream, Goal, Idea, List, ListItem, Note, Reminder, Rule, Site, Task } from '@/lib/types';
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
const site = (id: string, title: string, client?: string, noteText?: string, status?: Site['status']): Site => ({ id, title, client, note: noteText, status, ...base });
const idea = (id: string, title: string, noteText?: string, status?: Idea['status']): Idea => ({ id, title, note: noteText, status, source: 'web', ...base });
const rule = (id: string, text: string, group: Rule['group'], noteText?: string): Rule => ({ id, text, group, note: noteText, position: 1, ...base });
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
  sites: [site('w1', 'Кофейня Brew', 'Асхат', 'лендинг с меню', 'payment'), site('w2', 'Студия йоги', 'Дана')],
  ideas: [idea('x1', 'Приложение для барберов', 'запись и касса', 'work'), idea('x2', 'Курс по продажам')],
  rules: [rule('u1', 'Сон не меньше семи часов', 'brain', 'иначе весь день в тумане'), rule('u2', 'Десять процентов дохода откладывать сразу', 'economy')],
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

  it('ищет сайты по названию, клиенту и заметке; подпись — клиент и этап', () => {
    const byTitle = buildSearch('кофейня', data)[0];
    expect(byTitle.label).toBe('Сайты');
    expect(byTitle.icon).toBe('sites');
    expect(byTitle.hits[0]).toMatchObject({ id: 'w1', kind: 'site', title: 'Кофейня Brew', subtitle: 'Асхат · жду оплату', to: '/sites?site=w1' });
    // «Асхат» есть и среди долгов: берём именно группу сайтов
    expect(buildSearch('асхат', data).find(g => g.kind === 'site')?.hits[0].id).toBe('w1');
    expect(buildSearch('лендинг', data)[0].hits[0].id).toBe('w1');
    expect(buildSearch('йоги', data)[0].hits[0]).toMatchObject({ id: 'w2', subtitle: 'Дана' });
  });

  it('этап в подписи: у «в работе» его нет, а без клиента подписи может не быть вовсе', () => {
    const at = (status: Site['status'], client?: string): SearchData => ({ ...data, sites: [site('w3', 'Клиентский', client, undefined, status)] });
    const subtitle = (d: SearchData) => buildSearch('клиентский', d)[0].hits[0].subtitle;
    expect(subtitle(at('done', 'Асхат'))).toBe('Асхат · реализован');
    expect(subtitle(at('meeting', 'Асхат'))).toBe('Асхат · согласовать встречу');
    expect(subtitle(at('work', 'Асхат'))).toBe('Асхат');
    expect(subtitle(at('payment'))).toBe('жду оплату');
    expect(subtitle(at('work'))).toBeUndefined();
  });

  it('ищет идеи по названию и заметке; подпись — этап', () => {
    const found = buildSearch('барберов', data)[0];
    expect(found.label).toBe('Идеи');
    expect(found.icon).toBe('ideas');
    expect(found.hits[0]).toMatchObject({ id: 'x1', kind: 'idea', title: 'Приложение для барберов', subtitle: 'в работе', to: '/ideas?idea=x1' });
    expect(buildSearch('касса', data)[0].hits[0].id).toBe('x1');
    // новая идея: этап по умолчанию, в подписи его нет
    expect(buildSearch('продажам', data)[0].hits[0]).toMatchObject({ id: 'x2', subtitle: undefined });
  });

  it('ищет правила жизни по тексту и пояснению; подпись — раздел', () => {
    const found = buildSearch('семи часов', data)[0];
    expect(found.label).toBe('Правила жизни');
    expect(found.icon).toBe('rules');
    expect(found.hits[0]).toMatchObject({ id: 'u1', kind: 'rule', title: 'Сон не меньше семи часов', subtitle: 'Мозг', to: '/rules?rule=u1' });
    expect(buildSearch('в тумане', data)[0].hits[0].id).toBe('u1');
    expect(buildSearch('откладывать', data)[0].hits[0]).toMatchObject({ id: 'u2', subtitle: 'Экономика' });
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
