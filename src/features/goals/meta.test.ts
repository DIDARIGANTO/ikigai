import { describe, expect, it } from 'vitest';
import type { Goal } from '@/lib/types';
import { buildGoalForest } from './meta';

const base = { createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };

const goal = (id: string, parentId?: string): Goal => ({
  id,
  title: id,
  horizon: 'year',
  status: 'active',
  parentId,
  ...base,
});

const ids = (goals: Goal[]) => goals.map(g => g.id);

describe('buildGoalForest', () => {
  it('строит дерево от корней к подцелям', () => {
    const { roots, childrenOf } = buildGoalForest([goal('a'), goal('b', 'a'), goal('c', 'b'), goal('d')]);
    expect(ids(roots)).toEqual(['a', 'd']);
    expect(ids(childrenOf.get('a') ?? [])).toEqual(['b']);
    expect(ids(childrenOf.get('b') ?? [])).toEqual(['c']);
  });

  it('поднимает в корни цель с отфильтрованным родителем', () => {
    const { roots } = buildGoalForest([goal('b', 'a')]);
    expect(ids(roots)).toEqual(['b']);
  });

  it('не теряет цели, связанные в цикл', () => {
    // Так выглядят битые импортированные данные: a → b → a.
    const { roots, childrenOf } = buildGoalForest([goal('a', 'b'), goal('b', 'a')]);
    expect(ids(roots)).toEqual(['a']);
    expect(ids(childrenOf.get('a') ?? [])).toEqual(['b']);
    // Связь, замыкавшая круг, разорвана — иначе дерево нельзя отрисовать.
    expect(ids(childrenOf.get('b') ?? [])).toEqual([]);
  });

  it('разрывает длинный цикл и сохраняет все цели ровно один раз', () => {
    const goals = [goal('a', 'c'), goal('b', 'a'), goal('c', 'b'), goal('d')];
    const { roots, childrenOf } = buildGoalForest(goals);

    const seen: string[] = [];
    const walk = (g: Goal) => {
      seen.push(g.id);
      for (const kid of childrenOf.get(g.id) ?? []) walk(kid);
    };
    for (const root of roots) walk(root);

    expect([...seen].sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});
