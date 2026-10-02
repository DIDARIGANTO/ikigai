import { describe, it, expect } from 'vitest';
import { parseLines } from './lines';

describe('parseLines', () => {
  it('splits lines, drops blanks and list markers', () => {
    expect(parseLines('- Бег\n\n• Бассейн\n1. Йога\n2) Растяжка\n[ ] Сон\n  Вода  ')).toEqual([
      'Бег', 'Бассейн', 'Йога', 'Растяжка', 'Сон', 'Вода',
    ]);
  });
  it('drops duplicates regardless of case', () => {
    expect(parseLines('Бег\nбег\nБЕГ')).toEqual(['Бег']);
  });
  it('is empty for whitespace', () => {
    expect(parseLines('  \n \n')).toEqual([]);
  });
});
