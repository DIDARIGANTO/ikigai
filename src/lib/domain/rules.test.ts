import { describe, it, expect } from 'vitest';
import type { Rule } from '@/lib/types';
import { groupRules, RULE_GROUP_HINT, RULE_GROUP_LABEL, RULE_GROUPS, moveRule } from './rules';

const T = { createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-01T08:00:00.000Z' };
const rule = (over: Partial<Rule> = {}): Rule => ({ id: 'r1', text: 'Сон не меньше 7 часов', group: 'brain', position: 1, ...T, ...over });

describe('группы правил', () => {
  it('four groups in the order the owner named them, each with a label and a hint', () => {
    expect(RULE_GROUPS).toEqual(['brain', 'regime', 'economy', 'sport']);
    expect(RULE_GROUPS.map(g => RULE_GROUP_LABEL[g])).toEqual(['Мозг', 'Режим', 'Экономика', 'Спорт']);
    for (const g of RULE_GROUPS) expect(RULE_GROUP_HINT[g]).toMatch(/^Например: /);
  });

  it('groupRules puts every rule into its group, in the order they were written', () => {
    const list = [
      rule({ id: 's2', group: 'sport', position: 20 }),
      rule({ id: 'b1', group: 'brain', position: 5 }),
      rule({ id: 's1', group: 'sport', position: 10 }),
      rule({ id: 'e1', group: 'economy', position: 7 }),
      rule({ id: 'b0', group: 'brain', position: 5, createdAt: '2026-09-01T00:00:00.000Z' }),
    ];
    const g = groupRules(list);
    expect(g.brain.map(r => r.id)).toEqual(['b0', 'b1']);
    expect(g.regime).toEqual([]);
    expect(g.economy.map(r => r.id)).toEqual(['e1']);
    expect(g.sport.map(r => r.id)).toEqual(['s1', 's2']);
  });

  it('a rule with an unknown group is not lost: it goes to «Мозг»', () => {
    expect(groupRules([rule({ id: 'x', group: 'bogus' as never })]).brain.map(r => r.id)).toEqual(['x']);
  });

  it('moveRule changes the group and puts the rule at the end of the new one; the original stays intact', () => {
    const base = rule({ position: 1 });
    const moved = moveRule(base, 'sport', 99);
    expect(moved).toMatchObject({ group: 'sport', position: 99 });
    expect(base.group).toBe('brain');
  });
});
