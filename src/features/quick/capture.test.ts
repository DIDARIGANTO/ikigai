import { describe, it, expect } from 'vitest';
import { parseQuick } from '@/lib/parse/quickParse';
import { chipTokens, destination, kindToType, noteTitleFrom, removeTokenKind } from './capture';

const now = new Date(2026, 8, 30, 10, 0);
const ctx = { now, goals: [{ id: 'g', title: 'Сайт' }], lists: [] };
const extra = { now, today: '2026-09-30' };

describe('capture', () => {
  it('kindToType', () => {
    expect(kindToType(undefined)).toBe('task');
    expect(kindToType('list_item')).toBe('listItem');
    expect(kindToType('note')).toBe('note');
    expect(kindToType('reminder')).toBe('reminder');
  });

  it('removeTokenKind убирает кусок и оставляет остальное', () => {
    const text = 'завтра в 15 созвон #работа';
    const p = parseQuick(text, ctx);
    expect(removeTokenKind(text, p.tokens, 'date')).toBe('в 15 созвон #работа');
    expect(removeTokenKind(text, p.tokens, 'area')).toBe('завтра в 15 созвон');
  });

  it('chipTokens — по одному на вид и в порядке фразы', () => {
    const p = parseQuick('! #работа на следующей неделе в среду созвон в 15', ctx);
    expect(chipTokens(p.tokens).map(t => t.kind)).toEqual(['date', 'time', 'area', 'important']);
  });

  it('destination: без даты и доски — во входящие', () => {
    expect(destination('task', {}, extra)).toEqual({ inbox: true, text: 'Во входящие' });
  });

  it('destination: дата, время, длительность, сфера', () => {
    const d = destination('task', { date: '2026-09-30', time: '15:00', minutes: 30, area: 'work' }, extra);
    expect(d).toEqual({ inbox: false, text: 'Сегодня 15:00 · 30 мин · Работа' });
  });

  it('destination: доска без даты — не входящие', () => {
    expect(destination('task', {}, { ...extra, boardTitle: 'Дом' }).text).toBe('Личное · доска «Дом»');
  });

  it('destination: напоминание, покупка, заметка', () => {
    expect(destination('reminder', { repeat: 'monthly' }, extra).text).toBe('Напоминание · Сегодня · каждый месяц');
    expect(destination('listItem', { price: 1500 }, { ...extra, listTitle: 'Покупки' }).text).toBe('В список «Покупки» · 1 500 ₸');
    expect(destination('listItem', {}, extra).text).toBe('Нужен список');
    expect(destination('note', {}, extra).text).toBe('В заметки · «Входящие»');
  });

  it('noteTitleFrom', () => {
    expect(noteTitleFrom('  \nПервая строка\nвторая')).toBe('Первая строка');
    expect(noteTitleFrom('')).toBe('Без названия');
    expect(noteTitleFrom('а'.repeat(100))).toHaveLength(80);
  });
});
