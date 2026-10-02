import type { ListItem } from '@/lib/types';

const SYMBOLS: Record<string, string> = { KZT: '₸', RUB: '₽', USD: '$', EUR: '€' };

/** Символ валюты из профиля; незнакомый код показываем как есть. */
export const currencySymbol = (code: string): string => SYMBOLS[code] ?? code;

/** «105 000 ₸» — разряды по-русски, неразрывный пробел ставит Intl. */
export const formatMoney = (value: number, currency: string): string =>
  `${new Intl.NumberFormat('ru-RU').format(Math.round(value))} ${currencySymbol(currency)}`;

export interface ListTotals {
  /** Всего пунктов. */
  total: number;
  /** Отмеченных пунктов. */
  done: number;
  /** Сумма цен невыполненных пунктов. */
  left: number;
  /** Сумма цен выполненных пунктов. */
  bought: number;
  /** Есть ли хоть одна цена — от этого зависит, показывать ли деньги. */
  hasPrices: boolean;
}

export function listTotals(items: ListItem[]): ListTotals {
  let left = 0;
  let bought = 0;
  let done = 0;
  let priced = 0;
  for (const item of items) {
    if (item.doneAt) done += 1;
    if (typeof item.price === 'number' && Number.isFinite(item.price)) {
      priced += 1;
      if (item.doneAt) bought += item.price;
      else left += item.price;
    }
  }
  return { total: items.length, done, left, bought, hasPrices: priced > 0 };
}

/** Пробелы всех мастей: `\s` в JS покрывает и неразрывный (U+00A0), и узкий (U+202F). */
const SPACES = /\s/g;

/**
 * Разбор цены из строки: «45000», «45 000 ₸», «1 234,56», «1234.56», «1.234,56».
 * Последний разделитель считается десятичным, только если за ним ровно 1–2 цифры,
 * иначе все разделители — разрядные и просто убираются.
 * Пустая строка снимает цену (`undefined`), непонятная — `null`.
 */
export function parsePrice(raw: string): number | undefined | null {
  if (!raw.trim()) return undefined;
  const cleaned = raw.replace(SPACES, '').replace(/[^\d.,]/g, '');
  if (!/\d/.test(cleaned)) return null;

  const sep = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf(','));
  const decimals = sep === -1 ? '' : cleaned.slice(sep + 1);
  const normalized =
    sep !== -1 && /^\d{1,2}$/.test(decimals)
      ? `${cleaned.slice(0, sep).replace(/[.,]/g, '')}.${decimals}`
      : cleaned.replace(/[.,]/g, '');

  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** «сделано 1 из 3» — короткая строка для карточки списка. */
export const progressLabel = (t: ListTotals): string =>
  t.total ? `сделано ${t.done} из ${t.total}` : 'пока пусто';

/** Русское число: 1 пункт, 2 пункта, 5 пунктов. */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

/** Хвост строки с ценой: «45000», «45 000», «1,5к», «150k», «2 тыс», «45000 ₸», «990 тг». */
const TRAILING_PRICE =
  /^(.*?\S)\s+(\d{1,3}(?:[\s  ]\d{3})+|\d+(?:[.,]\d+)?)\s*(к|k|тыс\.?|₸|тг\.?|₽|руб\.?|р\.?|\$|€)?$/iu;
const THOUSANDS = /^(к|k|тыс\.?)$/iu;
/** Без валюты или «к» маленькое число в конце — скорее часть названия («iPhone 15», «Кроссовки 42»). */
const MIN_BARE_PRICE = 100;

/**
 * Цена в конце нового пункта: «Наушники 45000» → { text: 'Наушники', price: 45000 }, «Куртка 150к» → 150 000.
 * Если цены нет или она сомнительна — строка остаётся как есть, `price` не задан.
 */
export function splitTrailingPrice(raw: string): { text: string; price?: number } {
  const value = raw.trim();
  const m = TRAILING_PRICE.exec(value);
  if (!m) return { text: value };
  const [, head, digits, suffix] = m;
  const base = Number(digits.replace(/[\s  ]/g, '').replace(',', '.'));
  if (!Number.isFinite(base)) return { text: value };
  const thousands = !!suffix && THOUSANDS.test(suffix);
  const price = Math.round(thousands ? base * 1000 : base);
  if (!suffix && price < MIN_BARE_PRICE) return { text: value };
  // Дробная цена без «к» («Молоко 1.5») — это не деньги, а объём или вес.
  if (!thousands && /[.,]/.test(digits)) return { text: value };
  return { text: head.trim(), price };
}
