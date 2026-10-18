import { describe, it, expect } from 'vitest';
import { titleFromNote } from './titleFromNote';

describe('titleFromNote', () => {
  it('takes the first non-empty line', () => {
    expect(titleFromNote('мир отель звонок\nренк, бильярдный\nбанный клуб встреча')).toBe('мир отель звонок');
    expect(titleFromNote('\n\n  Позвонить маме\nещё')).toBe('Позвонить маме');
  });

  it('trims and collapses spaces', () => {
    expect(titleFromNote('  мир   отель  \n')).toBe('мир отель');
  });

  it('is empty when there is nothing to take', () => {
    expect(titleFromNote('')).toBe('');
    expect(titleFromNote(' \n  \n')).toBe('');
  });

  it('a long first line is cut at a word boundary and marked, in at most 80 characters', () => {
    const out = titleFromNote('слово '.repeat(30));
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.endsWith('…')).toBe(true);
    expect(out.slice(0, -1).trimEnd().split(' ').every(w => w === 'слово')).toBe(true);
  });

  it('a long line with no spaces is cut hard', () => {
    const out = titleFromNote('а'.repeat(200));
    expect(out).toBe(`${'а'.repeat(79)}…`);
  });

  it('a line of exactly 80 characters is left alone', () => {
    expect(titleFromNote('б'.repeat(80))).toBe('б'.repeat(80));
  });
});
