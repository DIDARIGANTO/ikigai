import { describe, it, expect } from 'vitest';
import { NAV, NAV_GROUPS } from './nav';

describe('меню', () => {
  it('раздел целей называется «100 целей» и остался в своей группе', () => {
    const goals = NAV.find(n => n.key === 'goals');
    expect(goals).toMatchObject({ label: '100 целей', to: '/goals' });
    expect(NAV_GROUPS.find(g => g.keys.includes('goals'))?.label).toBe('Мечты и цели');
  });

  it('каждый раздел групп есть в меню, и ни один не потерян', () => {
    const inGroups = NAV_GROUPS.flatMap(g => g.keys).sort();
    expect(inGroups).toEqual(NAV.map(n => n.key).sort());
  });
});
