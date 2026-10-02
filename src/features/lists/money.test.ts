import { describe, expect, it } from 'vitest';
import type { ListItem } from '@/lib/types';
import { currencySymbol, formatMoney, listTotals, parsePrice, progressLabel } from './money';

const item = (p: Partial<ListItem>): ListItem => ({
  id: p.id ?? 'i',
  listId: 'l',
  text: p.text ?? 'пункт',
  price: p.price,
  doneAt: p.doneAt,
  position: p.position ?? 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
});

describe('formatMoney', () => {
  it('разделяет разряды по-русски и ставит символ валюты', () => {
    // Intl для ru-RU использует неразрывный пробел как разделитель разрядов.
    expect(formatMoney(105000, 'KZT')).toBe('105 000 ₸');
    expect(formatMoney(1200, 'RUB')).toBe('1 200 ₽');
    expect(formatMoney(0, 'USD')).toBe('0 $');
  });

  it('незнакомый код валюты показывает как есть', () => {
    expect(currencySymbol('GBP')).toBe('GBP');
  });
});

describe('listTotals', () => {
  it('делит суммы на «осталось» и «куплено»', () => {
    const totals = listTotals([
      item({ id: '1', price: 45000 }),
      item({ id: '2', price: 60000 }),
      item({ id: '3', price: 10000, doneAt: '2026-09-02T00:00:00.000Z' }),
      item({ id: '4' }),
    ]);
    expect(totals.left).toBe(105000);
    expect(totals.bought).toBe(10000);
    expect(totals.done).toBe(1);
    expect(totals.total).toBe(4);
    expect(totals.hasPrices).toBe(true);
  });

  it('без цен денежный блок не показывается', () => {
    const totals = listTotals([item({ id: '1' }), item({ id: '2' })]);
    expect(totals.hasPrices).toBe(false);
    expect(progressLabel(totals)).toBe('сделано 0 из 2');
  });

  it('пустой список не ломает подпись', () => {
    expect(progressLabel(listTotals([]))).toBe('пока пусто');
  });
});

describe('parsePrice', () => {
  it('понимает разряды пробелами и запятую как десятичную', () => {
    expect(parsePrice('1 234,56')).toBe(1234.56);
    // Неразрывный и узкий неразрывный пробелы — их ставит Intl при копировании суммы.
    expect(parsePrice('1 234,56')).toBe(1234.56);
    expect(parsePrice('1 234,56')).toBe(1234.56);
  });

  it('понимает точку как десятичную и как разрядную', () => {
    expect(parsePrice('1234.56')).toBe(1234.56);
    expect(parsePrice('1.234,56')).toBe(1234.56);
    // За последним разделителем три цифры — значит это разряды, а не копейки.
    expect(parsePrice('1.234')).toBe(1234);
    expect(parsePrice('1,234,567')).toBe(1234567);
  });

  it('понимает целое число и цену с валютой', () => {
    expect(parsePrice('45000')).toBe(45000);
    expect(parsePrice('45 000 ₸')).toBe(45000);
    expect(parsePrice('0')).toBe(0);
  });

  it('пустая строка снимает цену', () => {
    expect(parsePrice('')).toBeUndefined();
    expect(parsePrice('   ')).toBeUndefined();
  });

  it('непонятную строку не принимает', () => {
    expect(parsePrice('дорого')).toBeNull();
    expect(parsePrice('₸')).toBeNull();
    expect(parsePrice('-,.')).toBeNull();
  });
});
