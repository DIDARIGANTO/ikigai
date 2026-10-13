import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Debt, DebtDirection, DebtPayment } from '@/lib/types';

/**
 * Долги: чистая логика без интерфейса. Остаток считается из возвратов, а не хранится,
 * поэтому правка или удаление возврата всегда даёт верную сумму.
 */

export const DIRECTION_LABEL: Record<DebtDirection, string> = { owedToMe: 'Мне должны', iOwe: 'Я должен' };
export const DIRECTIONS: readonly DebtDirection[] = ['owedToMe', 'iOwe'];

/** Как назвать возвращённый долг: кто кому вернул. */
export const RETURNED_LABEL: Record<DebtDirection, string> = { owedToMe: 'мне вернули', iOwe: 'я вернул' };

/** Ближе стольки дней срок считается «скоро». */
export const SOON_DAYS = 7;

/** Деньги — до копеек: сумма долей не должна давать «0,30000000000000004». */
const cents = (n: number): number => Math.round(n * 100) / 100;

/** Сколько выплачено. */
export const paidOf = (d: Debt): number => cents(d.payments.reduce((sum, p) => sum + p.amount, 0));

/** Сколько осталось; не меньше нуля, даже если выплатили больше. */
export const leftOf = (d: Debt): number => Math.max(0, cents(d.amount - paidOf(d)));

/** Закрыт: выплачено всё или закрыт вручную (простили, списали). */
export const isClosed = (d: Debt): boolean => !!d.closedAt || leftOf(d) <= 0;

/** Возвращён целиком: остатка нет, и возвраты были. Такой долг живёт в журнале «Вернули долг», а не в открытых и не в «закрытых без оплаты». */
export const isReturned = (d: Debt): boolean => leftOf(d) <= 0 && d.payments.length > 0;

/** Доля выплаченного, 0…1. */
export const paidRatio = (d: Debt): number => (d.amount > 0 ? Math.min(1, paidOf(d) / d.amount) : 1);

export type DueState = 'overdue' | 'soon' | 'later' | 'none';

export interface Due {
  state: DueState;
  /** Дней до срока: отрицательное — просрочено. `null`, если срока нет или долг закрыт. */
  days: number | null;
}

/** Срок открытого долга относительно сегодняшней даты. У закрытого долга и долга без срока срока нет. */
export function dueOf(d: Debt, today: string): Due {
  if (!d.dueDate || isClosed(d)) return { state: 'none', days: null };
  const days = differenceInCalendarDays(parseISO(d.dueDate), parseISO(today));
  return { state: days < 0 ? 'overdue' : days <= SOON_DAYS ? 'soon' : 'later', days };
}

/** Остатки открытых долгов по направлениям и валютам. */
export type Totals = Record<DebtDirection, Record<string, number>>;

export function totalsOf(debts: readonly Debt[]): Totals {
  const out: Totals = { owedToMe: {}, iOwe: {} };
  for (const d of debts) {
    if (isClosed(d)) continue;
    out[d.direction][d.currency] = cents((out[d.direction][d.currency] ?? 0) + leftOf(d));
  }
  return out;
}

/** Баланс по валютам: «мне должны» минус «я должен». Нули не возвращаем. */
export function balanceOf(totals: Totals): Record<string, number> {
  const out: Record<string, number> = {};
  for (const dir of DIRECTIONS) {
    for (const [cur, sum] of Object.entries(totals[dir])) {
      out[cur] = cents((out[cur] ?? 0) + (dir === 'owedToMe' ? sum : -sum));
    }
  }
  for (const cur of Object.keys(out)) if (out[cur] === 0) delete out[cur];
  return out;
}

/** Дата, когда долг закрылся: последний возврат, а если возвратов нет — день закрытия. */
export function closedOn(d: Debt): string {
  const last = d.payments.length ? d.payments.reduce((a, b) => (a.date >= b.date ? a : b)).date : undefined;
  return d.closedAt ? (last && last > d.closedAt.slice(0, 10) ? last : d.closedAt.slice(0, 10)) : (last ?? d.date);
}

/** Открытые: сначала со сроком — ближайший выше, потом без срока — новые выше. */
export function sortOpen(debts: readonly Debt[]): Debt[] {
  return [...debts].sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate) || b.createdAt.localeCompare(a.createdAt);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
  });
}

/** Закрытые: недавно закрытые выше. */
export function sortClosed(debts: readonly Debt[]): Debt[] {
  return [...debts].sort((a, b) => closedOn(b).localeCompare(closedOn(a)) || b.createdAt.localeCompare(a.createdAt));
}

export interface SplitDebts {
  open: Record<DebtDirection, Debt[]>;
  /** Закрыты вручную без полной выплаты (простили, списали). Возвращённые целиком сюда не входят: они в журнале возвратов. */
  closed: Debt[];
}

export function splitDebts(debts: readonly Debt[]): SplitDebts {
  const open: Record<DebtDirection, Debt[]> = { owedToMe: [], iOwe: [] };
  const closed: Debt[] = [];
  for (const d of debts) {
    if (!isClosed(d)) open[d.direction].push(d);
    else if (!isReturned(d)) closed.push(d);
  }
  return { open: { owedToMe: sortOpen(open.owedToMe), iOwe: sortOpen(open.iOwe) }, closed: sortClosed(closed) };
}

// ——— Журнал возвратов: блок «Вернули долг» ———

export interface ReturnEntry {
  debt: Debt;
  payment: DebtPayment;
  /** Сколько ещё осталось по этому долгу сейчас (0 — возвращён целиком). */
  left: number;
}

/** Каждый возврат каждого долга, новые выше; в один день позднее записанный выше. */
export function returnsOf(debts: readonly Debt[]): ReturnEntry[] {
  const all: { entry: ReturnEntry; order: number }[] = [];
  let order = 0;
  for (const debt of debts) {
    const left = leftOf(debt);
    for (const payment of debt.payments) all.push({ entry: { debt, payment, left }, order: order++ });
  }
  return all.sort((a, b) => b.entry.payment.date.localeCompare(a.entry.payment.date) || b.order - a.order).map(x => x.entry);
}

/** Имя для сравнения: без лишних пробелов и без разницы регистра, чтобы «асхат » нашёл «Асхат». */
const nameKey = (s: string): string => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');

/** Открытые долги этого человека в этом направлении, старые выше: их и закрывает возврат. */
export function openDebtsFor(debts: readonly Debt[], direction: DebtDirection, person: string): Debt[] {
  const who = nameKey(person);
  if (!who) return [];
  return debts
    .filter(d => !isClosed(d) && d.direction === direction && nameKey(d.person) === who)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export interface ReturnInput {
  direction: DebtDirection;
  person: string;
  amount: number;
  /** Валюта нового долга; если возврат ложится на открытый долг, берётся его валюта. */
  currency: string;
  date: string;
}

export interface ReturnResult {
  /** Открытые долги, по которым записан возврат (было / стало). */
  updated: { before: Debt; after: Debt }[];
  /** Новый уже возвращённый долг: когда долга в списке не было или вернули больше, чем в нём записано. */
  created: Debt[];
}

/**
 * «Асхат вернул 20 000»: возврат ложится на открытые долги этого человека, старые первыми.
 * Хватило не на всё — долг остаётся открытым с отметкой о частичном возврате; осталось лишнее или долга не было —
 * лишнее записывается новым уже возвращённым долгом, чтобы возврат не потерялся.
 */
export function recordReturn(debts: readonly Debt[], input: ReturnInput, makeId: () => string, nowISO: string): ReturnResult {
  const person = input.person.trim().replace(/\s+/g, ' ');
  const matches = openDebtsFor(debts, input.direction, person);
  const currency = matches[0]?.currency ?? input.currency;
  const updated: ReturnResult['updated'] = [];
  let rest = cents(input.amount);
  for (const before of matches) {
    if (rest <= 0) break;
    if (before.currency !== currency) continue;
    const take = Math.min(leftOf(before), rest);
    if (take <= 0) continue;
    updated.push({ before, after: addPayment(before, { id: makeId(), date: input.date, amount: take }) });
    rest = cents(rest - take);
  }
  const created: Debt[] = [];
  if (rest > 0) {
    created.push({
      id: makeId(), direction: input.direction, person, amount: rest, currency, date: input.date,
      payments: [{ id: makeId(), date: input.date, amount: rest }], createdAt: nowISO, updatedAt: nowISO,
    });
  }
  return { updated, created };
}

// ——— Изменения долга: возвращают новую строку, исходную не трогают ———

export const addPayment = (d: Debt, payment: DebtPayment): Debt => ({ ...d, payments: [...d.payments, payment] });

export const removePayment = (d: Debt, paymentId: string): Debt => ({
  ...d,
  payments: d.payments.filter(p => p.id !== paymentId),
});

/** Погасить остаток одним возвратом. Если возвращать нечего (закрыт вручную) — просто снимает «закрыт». */
export function settle(d: Debt, date: string, id: string): Debt {
  const left = leftOf(d);
  const open: Debt = { ...d, closedAt: undefined };
  return left > 0 ? addPayment(open, { id, date, amount: left }) : open;
}

/** Закрыть без полной выплаты: простили, списали, договорились иначе. */
export const forgive = (d: Debt, nowISO: string): Debt => ({ ...d, closedAt: nowISO });

/** Вернуть закрытый вручную долг в открытые. */
export const reopen = (d: Debt): Debt => ({ ...d, closedAt: undefined });
