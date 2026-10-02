import { describe, it, expect } from 'vitest';
import type { Debt } from '@/lib/types';
import {
  addPayment,
  balanceOf,
  closedOn,
  dueOf,
  forgive,
  isClosed,
  leftOf,
  paidOf,
  paidRatio,
  removePayment,
  reopen,
  settle,
  sortClosed,
  sortOpen,
  splitDebts,
  totalsOf,
} from './debts';

const T = { createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };

function debt(over: Partial<Debt> = {}): Debt {
  return { id: 'd1', direction: 'owedToMe', person: 'Асхат', amount: 50000, currency: 'KZT', date: '2026-10-01', payments: [], ...T, ...over };
}

describe('paid / left / closed', () => {
  it('a fresh debt has nothing paid and is open', () => {
    const d = debt();
    expect(paidOf(d)).toBe(0);
    expect(leftOf(d)).toBe(50000);
    expect(isClosed(d)).toBe(false);
    expect(paidRatio(d)).toBe(0);
  });

  it('left comes from the payments, down to zero and no further', () => {
    const d = debt({ payments: [{ id: 'p1', date: '2026-10-05', amount: 20000 }, { id: 'p2', date: '2026-10-09', amount: 10000 }] });
    expect(paidOf(d)).toBe(30000);
    expect(leftOf(d)).toBe(20000);
    expect(paidRatio(d)).toBeCloseTo(0.6);
    const over = addPayment(d, { id: 'p3', date: '2026-10-10', amount: 25000 });
    expect(leftOf(over)).toBe(0);
    expect(isClosed(over)).toBe(true);
    expect(paidRatio(over)).toBe(1);
  });

  it('does not leak floating point noise into the sums', () => {
    const d = debt({ amount: 0.3, payments: [{ id: 'p1', date: '2026-10-05', amount: 0.1 }, { id: 'p2', date: '2026-10-06', amount: 0.2 }] });
    expect(paidOf(d)).toBe(0.3);
    expect(leftOf(d)).toBe(0);
    expect(isClosed(d)).toBe(true);
  });

  it('a manually closed debt is closed even though something is left', () => {
    const d = forgive(debt(), '2026-10-12T10:00:00.000Z');
    expect(leftOf(d)).toBe(50000);
    expect(isClosed(d)).toBe(true);
    expect(isClosed(reopen(d))).toBe(false);
  });

  it('a zero debt counts as closed', () => {
    expect(isClosed(debt({ amount: 0 }))).toBe(true);
    expect(paidRatio(debt({ amount: 0 }))).toBe(1);
  });
});

describe('dueOf', () => {
  const today = '2026-10-10';
  it('no due date or a closed debt → no due state', () => {
    expect(dueOf(debt(), today)).toEqual({ state: 'none', days: null });
    expect(dueOf(debt({ dueDate: '2026-10-01', closedAt: '2026-10-02T00:00:00.000Z' }), today)).toEqual({ state: 'none', days: null });
  });

  it('overdue, soon (within a week, today included) and later', () => {
    expect(dueOf(debt({ dueDate: '2026-10-08' }), today)).toEqual({ state: 'overdue', days: -2 });
    expect(dueOf(debt({ dueDate: '2026-10-10' }), today)).toEqual({ state: 'soon', days: 0 });
    expect(dueOf(debt({ dueDate: '2026-10-17' }), today)).toEqual({ state: 'soon', days: 7 });
    expect(dueOf(debt({ dueDate: '2026-10-18' }), today)).toEqual({ state: 'later', days: 8 });
  });
});

describe('totals and balance', () => {
  const list = [
    debt({ id: 'a', amount: 50000, payments: [{ id: 'p', date: '2026-10-05', amount: 20000 }] }),
    debt({ id: 'b', amount: 10000 }),
    debt({ id: 'c', direction: 'iOwe', amount: 30000 }),
    debt({ id: 'd', direction: 'iOwe', amount: 100, currency: 'USD' }),
    debt({ id: 'e', amount: 5000, closedAt: '2026-10-06T00:00:00.000Z' }),
  ];

  it('sums what is left of open debts per direction and currency', () => {
    expect(totalsOf(list)).toEqual({ owedToMe: { KZT: 40000 }, iOwe: { KZT: 30000, USD: 100 } });
  });

  it('balance is «owed to me» minus «I owe», per currency, without zeros', () => {
    expect(balanceOf(totalsOf(list))).toEqual({ KZT: 10000, USD: -100 });
    expect(balanceOf(totalsOf([debt({ amount: 500 }), debt({ id: 'x', direction: 'iOwe', amount: 500 })]))).toEqual({});
  });
});

describe('ordering and splitting', () => {
  it('open debts: nearest due date first, then undated ones newest first', () => {
    const a = debt({ id: 'a', dueDate: '2026-10-20' });
    const b = debt({ id: 'b', dueDate: '2026-10-12' });
    const c = debt({ id: 'c', date: '2026-10-03' });
    const d = debt({ id: 'd', date: '2026-10-08' });
    expect(sortOpen([a, c, d, b]).map(x => x.id)).toEqual(['b', 'a', 'd', 'c']);
  });

  it('closed debts: recently closed first; closing date is the last payment or the manual close', () => {
    const paid = debt({ id: 'p', payments: [{ id: 'x', date: '2026-10-09', amount: 50000 }] });
    const forgiven = debt({ id: 'f', closedAt: '2026-10-11T08:00:00.000Z' });
    const old = debt({ id: 'o', payments: [{ id: 'y', date: '2026-10-02', amount: 50000 }] });
    expect(closedOn(paid)).toBe('2026-10-09');
    expect(closedOn(forgiven)).toBe('2026-10-11');
    expect(closedOn(debt())).toBe('2026-10-01');
    expect(sortClosed([old, paid, forgiven]).map(x => x.id)).toEqual(['f', 'p', 'o']);
  });

  it('splitDebts puts open ones under their direction and closed ones aside', () => {
    const s = splitDebts([
      debt({ id: 'a' }),
      debt({ id: 'b', direction: 'iOwe' }),
      debt({ id: 'c', closedAt: '2026-10-02T00:00:00.000Z' }),
      debt({ id: 'd', direction: 'iOwe', payments: [{ id: 'p', date: '2026-10-05', amount: 50000 }] }),
    ]);
    expect(s.open.owedToMe.map(x => x.id)).toEqual(['a']);
    expect(s.open.iOwe.map(x => x.id)).toEqual(['b']);
    expect(s.closed.map(x => x.id).sort()).toEqual(['c', 'd']);
  });
});

describe('changes return new rows and keep the original', () => {
  it('addPayment / removePayment', () => {
    const d = debt();
    const paid = addPayment(d, { id: 'p1', date: '2026-10-05', amount: 1000 });
    expect(d.payments).toEqual([]);
    expect(paid.payments).toHaveLength(1);
    expect(removePayment(paid, 'p1').payments).toEqual([]);
    expect(removePayment(paid, 'zzz').payments).toHaveLength(1);
  });

  it('settle pays off exactly what is left and closes the debt', () => {
    const d = debt({ payments: [{ id: 'p1', date: '2026-10-05', amount: 20000 }] });
    const s = settle(d, '2026-10-10', 'p2');
    expect(s.payments.at(-1)).toEqual({ id: 'p2', date: '2026-10-10', amount: 30000 });
    expect(leftOf(s)).toBe(0);
    expect(isClosed(s)).toBe(true);
    expect(d.payments).toHaveLength(1);
  });

  it('settle on a manually closed debt pays the rest and clears the manual close', () => {
    const s = settle(forgive(debt(), '2026-10-12T10:00:00.000Z'), '2026-10-13', 'p9');
    expect(s.closedAt).toBeUndefined();
    expect(leftOf(s)).toBe(0);
  });

  it('settle on a debt with nothing left adds no payment', () => {
    const paid = debt({ payments: [{ id: 'p1', date: '2026-10-05', amount: 50000 }] });
    expect(settle(paid, '2026-10-10', 'p2').payments).toHaveLength(1);
  });
});
