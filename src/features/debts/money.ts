import { currencySymbol } from '@/features/lists/money';

/** «50 000 ₸», «1 234,56 ₸»: копейки показываем, только если они есть. */
export function formatDebtAmount(value: number, currency: string): string {
  const hasFraction = Math.abs(value - Math.round(value)) > 0.0049;
  const text = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
  return `${text} ${currencySymbol(currency)}`;
}

/** Суммы по валютам одной строкой: «50 000 ₸ · 100 $». Нет сумм — «0» в валюте по умолчанию. */
export function formatTotals(sums: Record<string, number>, fallbackCurrency: string): string {
  const parts = Object.entries(sums).map(([cur, v]) => formatDebtAmount(v, cur));
  return parts.length ? parts.join(' · ') : formatDebtAmount(0, fallbackCurrency);
}

const CURRENCY_CODES = ['KZT', 'RUB', 'USD', 'EUR'] as const;

/** Валюты для выбора: четыре привычные и, если в долге другая (например, из импорта), она тоже. */
export function currencyOptions(current: string): { code: string; label: string }[] {
  const codes: string[] = [...CURRENCY_CODES];
  if (!codes.includes(current)) codes.push(current);
  return codes.map(code => {
    const symbol = currencySymbol(code);
    return { code, label: symbol === code ? code : `${code} ${symbol}` };
  });
}
