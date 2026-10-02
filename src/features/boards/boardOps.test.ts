import { describe, it, expect } from 'vitest';
import type { Column, Task } from '@/lib/types';
import { applyColumnKind, byPosition, dropIndex, dropPosition, positionBetween, resolveColumnId } from './boardOps';

const t = (id: string, position: number, p: Partial<Task> = {}): Task => ({
  id, createdAt: '2026-09-13T00:00:00Z', updatedAt: '', title: id, area: 'work',
  status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position, ...p,
});

const col = (id: string, kind: Column['kind']): Column => ({
  id, boardId: 'b', title: id, kind, position: 0, createdAt: '', updatedAt: '',
});

describe('positionBetween', () => {
  it('пустая колонка', () => expect(positionBetween(undefined, undefined)).toBe(0));
  it('перед первой', () => expect(positionBetween(undefined, 0)).toBe(-1000));
  it('после последней', () => expect(positionBetween(5, undefined)).toBe(1005));
  it('между соседями', () => expect(positionBetween(0, 1000)).toBe(500));
});

describe('dropIndex', () => {
  const list = [t('a', 0), t('b', 1000), t('c', 2000)];

  it('в конец, если бросили мимо карточек', () => expect(dropIndex(list, 'a', null)).toBe(2));
  it('внутри колонки вниз: встаёт после цели', () => expect(dropIndex(list, 'a', 'c')).toBe(2));
  it('внутри колонки вверх: встаёт перед целью', () => expect(dropIndex(list, 'c', 'a')).toBe(0));
  it('из другой колонки: встаёт перед целью', () => expect(dropIndex(list, 'z', 'b')).toBe(1));
  it('неизвестная цель уходит в конец', () => expect(dropIndex(list, 'z', 'нет')).toBe(3));
});

describe('dropPosition', () => {
  const list = [t('a', 0), t('b', 1000), t('c', 2000)];

  it('в конец колонки', () => expect(dropPosition(list, 'z', null)).toBe(3000));
  it('в пустую колонку', () => expect(dropPosition([], 'z', null)).toBe(0));
  it('между b и c', () => expect(dropPosition(list, 'z', 'c')).toBe(1500));
  it('перед первой', () => expect(dropPosition(list, 'z', 'a')).toBe(-1000));

  it('перенос вниз внутри колонки ставит задачу последней', () => {
    const moved = { ...list[0], position: dropPosition(list, 'a', 'c') };
    expect([...list.slice(1), moved].sort(byPosition).map(x => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('перенос вверх внутри колонки ставит задачу первой', () => {
    const moved = { ...list[2], position: dropPosition(list, 'c', 'a') };
    expect([moved, ...list.slice(0, 2)].sort(byPosition).map(x => x.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('applyColumnKind', () => {
  it('готово закрывает задачу', () => {
    expect(applyColumnKind(t('a', 0), 'done', 'now')).toMatchObject({ status: 'done', actualEnd: 'now' });
  });
  it('надо возвращает задачу в работу', () => {
    const r = applyColumnKind(t('a', 0, { status: 'done', actualStart: 's', actualEnd: 'e' }), 'todo', 'now');
    expect(r).toMatchObject({ status: 'todo', actualStart: undefined, actualEnd: undefined });
  });
  it('в работе не запускает таймер', () => {
    const r = applyColumnKind(t('a', 0), 'doing', 'now');
    expect(r.status).toBe('doing');
    expect(r.actualStart).toBeUndefined();
  });
  it('колонка своего типа ничего не меняет', () => {
    const task = t('a', 0, { status: 'done', actualEnd: 'e' });
    expect(applyColumnKind(task, 'done', 'now')).toBe(task);
  });
});

describe('resolveColumnId', () => {
  const columns = [col('todo', 'todo'), col('doing', 'doing'), col('done', 'done')];

  it('оставляет свою колонку', () => expect(resolveColumnId(t('a', 0, { columnId: 'doing' }), columns)).toBe('doing'));
  it('подбирает колонку по статусу, если своей нет', () =>
    expect(resolveColumnId(t('a', 0, { status: 'done', columnId: 'нет' }), columns)).toBe('done'));
  it('без подходящего типа берёт первую', () =>
    expect(resolveColumnId(t('a', 0, { status: 'done' }), [col('одна', 'todo')])).toBe('одна'));
});
