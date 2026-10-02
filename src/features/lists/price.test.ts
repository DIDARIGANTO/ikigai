import { describe, expect, it } from 'vitest';
import { plural, splitTrailingPrice } from './money';

describe('splitTrailingPrice', () => {
  it('отрезает цену в конце', () => {
    expect(splitTrailingPrice('Наушники 45000')).toEqual({ text: 'Наушники', price: 45000 });
    expect(splitTrailingPrice('Наушники 45 000')).toEqual({ text: 'Наушники', price: 45000 });
    expect(splitTrailingPrice('  Кофе в зёрнах 4 990 ₸ ')).toEqual({ text: 'Кофе в зёрнах', price: 4990 });
    expect(splitTrailingPrice('Билет 990 тг')).toEqual({ text: 'Билет', price: 990 });
  });

  it('понимает тысячи', () => {
    expect(splitTrailingPrice('Куртка 150к')).toEqual({ text: 'Куртка', price: 150000 });
    expect(splitTrailingPrice('Куртка 150 k')).toEqual({ text: 'Куртка', price: 150000 });
    expect(splitTrailingPrice('Самокат 1,5к')).toEqual({ text: 'Самокат', price: 1500 });
    expect(splitTrailingPrice('Велосипед 2 тыс')).toEqual({ text: 'Велосипед', price: 2000 });
  });

  it('не трогает числа, которые похожи на часть названия', () => {
    expect(splitTrailingPrice('iPhone 15')).toEqual({ text: 'iPhone 15' });
    expect(splitTrailingPrice('Кроссовки 42')).toEqual({ text: 'Кроссовки 42' });
    expect(splitTrailingPrice('Молоко 1.5')).toEqual({ text: 'Молоко 1.5' });
    expect(splitTrailingPrice('45000')).toEqual({ text: '45000' });
    expect(splitTrailingPrice('Просто пункт')).toEqual({ text: 'Просто пункт' });
  });

  it('маленькая цена с валютой — всё равно цена', () => {
    expect(splitTrailingPrice('Жвачка 50 ₸')).toEqual({ text: 'Жвачка', price: 50 });
  });
});

describe('plural', () => {
  it('склоняет по-русски', () => {
    const f: [string, string, string] = ['пункт', 'пункта', 'пунктов'];
    expect(plural(1, f)).toBe('пункт');
    expect(plural(3, f)).toBe('пункта');
    expect(plural(5, f)).toBe('пунктов');
    expect(plural(11, f)).toBe('пунктов');
    expect(plural(21, f)).toBe('пункт');
    expect(plural(0, f)).toBe('пунктов');
  });
});
