import { describe, it, expect } from 'vitest';
import type { Debt } from '@/lib/types';
import {
  addPayment,
  balanceOf,
  closedOn,
  dueOf,
  forgive,
  isClosed,
  isReturned,
  leftOf,
  openDebtsFor,
  paidOf,
  paidRatio,
  recordReturn,
  RETURNED_LABEL,
  removePayment,
  returnsOf,
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

  it('splitDebts puts open ones under their direction; written-off ones are «closed», fully returned ones live in the returns journal', () => {
    const s = splitDebts([
      debt({ id: 'a' }),
      debt({ id: 'b', direction: 'iOwe' }),
      debt({ id: 'c', closedAt: '2026-10-02T00:00:00.000Z' }),
      debt({ id: 'd', direction: 'iOwe', payments: [{ id: 'p', date: '2026-10-05', amount: 50000 }] }),
    ]);
    expect(s.open.owedToMe.map(x => x.id)).toEqual(['a']);
    expect(s.open.iOwe.map(x => x.id)).toEqual(['b']);
    expect(s.closed.map(x => x.id)).toEqual(['c']);
  });

  it('a manual close after a partial return is written off, not «returned»', () => {
    const partial = debt({ id: 'p', payments: [{ id: 'w', date: '2026-10-11', amount: 10000 }], closedAt: '2026-10-12T00:00:00.000Z' });
    expect(isReturned(partial)).toBe(false);
    expect(splitDebts([partial]).closed.map(x => x.id)).toEqual(['p']);
    expect(isReturned(debt({ payments: [{ id: 'w', date: '2026-10-11', amount: 50000 }] }))).toBe(true);
    expect(isReturned(debt())).toBe(false);
  });

  it('says who returned to whom', () => {
    expect(RETURNED_LABEL).toEqual({ owedToMe: 'мне вернули', iOwe: 'я вернул' });
  });
});

describe('returnsOf — журнал возвратов', () => {
  it('collects every return of every debt, newest first, with what is still left on that debt', () => {
    const a = debt({ id: 'a', person: 'Асхат', payments: [{ id: 'a1', date: '2026-10-02', amount: 20000 }, { id: 'a2', date: '2026-10-09', amount: 10000 }] });
    const b = debt({ id: 'b', person: 'Марат', direction: 'iOwe', amount: 5000, payments: [{ id: 'b1', date: '2026-10-05', amount: 5000 }] });
    const c = debt({ id: 'c', person: 'Айгуль' });
    const out = returnsOf([a, b, c]);
    expect(out.map(r => `${r.debt.id}/${r.payment.id}`)).toEqual(['a/a2', 'b/b1', 'a/a1']);
    expect(out.map(r => r.left)).toEqual([20000, 0, 20000]);
  });

  it('on the same day the later return goes first', () => {
    const a = debt({ payments: [{ id: 'x1', date: '2026-10-09', amount: 1000 }, { id: 'x2', date: '2026-10-09', amount: 2000 }] });
    expect(returnsOf([a]).map(r => r.payment.id)).toEqual(['x2', 'x1']);
  });
});

describe('openDebtsFor', () => {
  it('finds open debts of the same person and direction, ignoring case and extra spaces, oldest first', () => {
    const list = [
      debt({ id: 'new', person: 'Асхат', date: '2026-10-05' }),
      debt({ id: 'old', person: 'асхат ', date: '2026-09-01' }),
      debt({ id: 'closed', person: 'Асхат', closedAt: '2026-10-02T00:00:00.000Z' }),
      debt({ id: 'other-way', person: 'Асхат', direction: 'iOwe' }),
      debt({ id: 'other-person', person: 'Марат' }),
    ];
    expect(openDebtsFor(list, 'owedToMe', '  АСХАТ').map(d => d.id)).toEqual(['old', 'new']);
    expect(openDebtsFor(list, 'owedToMe', '')).toEqual([]);
  });
});

describe('recordReturn — «вернули долг»', () => {
  const NOW = '2026-10-10T08:00:00.000Z';
  const counter = () => {
    let n = 0;
    return () => `id${++n}`;
  };
  const input = (over: Partial<Parameters<typeof recordReturn>[1]> = {}) => ({
    direction: 'owedToMe' as const, person: 'Асхат', amount: 50000, currency: 'KZT', date: '2026-10-09', ...over,
  });

  it('no open debt: records a debt that is already returned', () => {
    const r = recordReturn([], input({ person: ' Марат ', amount: 12000 }), counter(), NOW);
    expect(r.updated).toEqual([]);
    expect(r.created).toHaveLength(1);
    expect(r.created[0]).toMatchObject({
      direction: 'owedToMe', person: 'Марат', amount: 12000, currency: 'KZT', date: '2026-10-09', createdAt: NOW, updatedAt: NOW,
      payments: [{ date: '2026-10-09', amount: 12000 }],
    });
    expect(isReturned(r.created[0])).toBe(true);
  });

  it('an open debt of that person takes a partial return and stays open', () => {
    const open = debt({ id: 'a' });
    const r = recordReturn([open], input({ amount: 20000 }), counter(), NOW);
    expect(r.created).toEqual([]);
    expect(r.updated).toHaveLength(1);
    expect(r.updated[0].before).toBe(open);
    expect(leftOf(r.updated[0].after)).toBe(30000);
    expect(isClosed(r.updated[0].after)).toBe(false);
    expect(r.updated[0].after.payments).toEqual([{ id: 'id1', date: '2026-10-09', amount: 20000 }]);
  });

  it('the full amount closes the debt', () => {
    const r = recordReturn([debt({ id: 'a' })], input(), counter(), NOW);
    expect(isReturned(r.updated[0].after)).toBe(true);
    expect(r.created).toEqual([]);
  });

  it('a return bigger than one debt goes on to the next open debt of the same person, oldest first', () => {
    const first = debt({ id: 'first', amount: 50000, date: '2026-09-01' });
    const second = debt({ id: 'second', amount: 30000, date: '2026-09-20' });
    const r = recordReturn([second, first], input({ amount: 70000 }), counter(), NOW);
    expect(r.updated.map(u => u.after.id)).toEqual(['first', 'second']);
    expect(leftOf(r.updated[0].after)).toBe(0);
    expect(leftOf(r.updated[1].after)).toBe(10000);
    expect(r.created).toEqual([]);
  });

  it('what is more than all open debts becomes a returned record of its own', () => {
    const r = recordReturn([debt({ id: 'a', amount: 10000 })], input({ amount: 15000 }), counter(), NOW);
    expect(isReturned(r.updated[0].after)).toBe(true);
    expect(r.created).toHaveLength(1);
    expect(r.created[0]).toMatchObject({ person: 'Асхат', amount: 5000, payments: [{ amount: 5000 }] });
  });

  it('does not touch closed debts, other people or the other direction', () => {
    const list = [
      debt({ id: 'closed', closedAt: '2026-10-02T00:00:00.000Z' }),
      debt({ id: 'other', person: 'Марат' }),
      debt({ id: 'way', direction: 'iOwe' }),
    ];
    const r = recordReturn(list, input({ amount: 1000 }), counter(), NOW);
    expect(r.updated).toEqual([]);
    expect(r.created).toHaveLength(1);
  });

  it('takes the currency of the debt it is applied to', () => {
    const r = recordReturn([debt({ id: 'usd', currency: 'USD', amount: 100 })], input({ amount: 40, currency: 'KZT' }), counter(), NOW);
    expect(r.created).toEqual([]);
    expect(leftOf(r.updated[0].after)).toBe(60);
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
