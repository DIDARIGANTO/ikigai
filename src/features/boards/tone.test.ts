import { describe, expect, it } from 'vitest';
import { columnTone, listTone, parseTone } from './tone';

describe('тона колонок и списков', () => {
  it('parseTone принимает только тона палитры', () => {
    expect(parseTone('mint')).toBe('mint');
    expect(parseTone('neutral')).toBe('neutral');
    expect(parseTone('toString')).toBeUndefined();
    expect(parseTone('#ff0000')).toBeUndefined();
    expect(parseTone(undefined)).toBeUndefined();
  });

  it('колонка без выбранного тона нейтральная, выбранный тон сохраняется', () => {
    expect(columnTone({})).toBe('neutral');
    expect(columnTone({ tone: 'rose' })).toBe('rose');
    expect(columnTone({ tone: 'garbage' })).toBe('neutral');
  });

  it('список без выбранного тона нейтральный, выбор человека уважается', () => {
    expect(listTone({})).toBe('neutral');
    expect(listTone({ tone: 'sky' })).toBe('sky');
    expect(listTone({ tone: '#ff0000' })).toBe('neutral');
  });
});
