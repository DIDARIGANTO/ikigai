import { describe, it, expect } from 'vitest';
import type { Site } from '@/lib/types';
import {
  addSitePayment,
  isPaidUp,
  leftOf,
  moveTo,
  NEXT_STATUS,
  paidOf,
  paidRatio,
  removeSitePayment,
  SITE_STATUSES,
  siteMonogram,
  sortSites,
  splitSites,
  statusOf,
  totalLeft,
} from './sites';

const T = { createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };
const site = (over: Partial<Site> = {}): Site => ({ id: 's1', title: 'Сайт', ...T, ...over });

describe('sortSites / siteMonogram', () => {
  it('alphabetically, ignoring case, then oldest first', () => {
    const list = [
      site({ id: 'b', title: 'банк' }),
      site({ id: 'a2', title: 'Авито', createdAt: '2026-10-02T00:00:00.000Z' }),
      site({ id: 'a1', title: 'авито' }),
      site({ id: 'v', title: 'Вики' }),
    ];
    expect(sortSites(list).map(s => s.id)).toEqual(['a1', 'a2', 'b', 'v']);
  });

  it('monogram is the first letter of the title', () => {
    expect(siteMonogram(site({ title: 'satgroup' }))).toBe('S');
    expect(siteMonogram(site({ title: 'кофейня' }))).toBe('К');
    expect(siteMonogram(site({ title: '🚀 Запуск' }))).toBe('🚀');
    expect(siteMonogram(site({ title: '  ' }))).toBe('?');
  });
});

describe('этапы сайта: встреча → в работе → жду оплату → реализован', () => {
  it('a site without a status (or with an unknown one) is «в работе»', () => {
    expect(statusOf(site())).toBe('work');
    expect(statusOf(site({ status: 'bogus' as never }))).toBe('work');
    for (const st of SITE_STATUSES) expect(statusOf(site({ status: st }))).toBe(st);
  });

  it('the order of the stages and the next one', () => {
    expect(SITE_STATUSES).toEqual(['meeting', 'work', 'payment', 'done']);
    expect(NEXT_STATUS).toEqual({ meeting: 'work', work: 'payment', payment: 'done' });
  });

  it('splitSites: every stage alphabetically, «реализованные» — recently delivered first', () => {
    const list = [
      site({ id: 'w2', title: 'Яндекс' }),
      site({ id: 'w1', title: 'Авито', status: 'work' }),
      site({ id: 'm1', title: 'Кофейня', status: 'meeting' }),
      site({ id: 'p2', title: 'Яблоко', status: 'payment' }),
      site({ id: 'p1', title: 'Аптека', status: 'payment' }),
      site({ id: 'd-old', title: 'Старый', status: 'done', doneAt: '2026-08-01' }),
      site({ id: 'd-new', title: 'Новый', status: 'done', doneAt: '2026-10-05' }),
      site({ id: 'd-none', title: 'Без даты', status: 'done' }),
    ];
    const s = splitSites(list);
    expect(s.meeting.map(x => x.id)).toEqual(['m1']);
    expect(s.work.map(x => x.id)).toEqual(['w1', 'w2']);
    expect(s.payment.map(x => x.id)).toEqual(['p1', 'p2']);
    expect(s.done.map(x => x.id)).toEqual(['d-new', 'd-old', 'd-none']);
  });

  it('moveTo changes the stage; the delivery date is set once on «реализован» and cleared when the site leaves it', () => {
    const base = site();
    expect(moveTo(base, 'payment', '2026-10-08')).toMatchObject({ status: 'payment' });
    expect(moveTo(base, 'payment', '2026-10-08').doneAt).toBeUndefined();
    const done = moveTo(base, 'done', '2026-10-08');
    expect(done).toMatchObject({ status: 'done', doneAt: '2026-10-08' });
    expect(moveTo(done, 'done', '2026-12-01').doneAt).toBe('2026-10-08');
    const back = moveTo(done, 'work', '2026-12-01');
    expect(back.status).toBe('work');
    expect(back.doneAt).toBeUndefined();
    // исходные строки не меняются
    expect(base.status).toBeUndefined();
    expect(done.status).toBe('done');
  });

  it('totalLeft sums what is still expected, down to kopecks; sites without an amount and fully paid ones add nothing', () => {
    const paid = site({ price: 100000, payments: [{ id: 'p', date: '2026-10-05', amount: 100000 }] });
    const part = site({ price: 200000, payments: [{ id: 'q', date: '2026-10-06', amount: 50000 }] });
    expect(totalLeft([site({ price: 0.1 }), site({ price: 0.2 }), site(), paid, part])).toBe(150000.3);
    expect(totalLeft([])).toBe(0);
  });
});

describe('платежи по сайту и остаток', () => {
  const pay = (id: string, amount: number, date = '2026-10-05') => ({ id, date, amount });

  it('paid, left and the paid share come from the payments', () => {
    const s = site({ price: 200000, payments: [pay('a', 50000), pay('b', 30000)] });
    expect(paidOf(s)).toBe(80000);
    expect(leftOf(s)).toBe(120000);
    expect(paidRatio(s)).toBeCloseTo(0.4);
    expect(isPaidUp(s)).toBe(false);
  });

  it('a site without payments owes the whole amount; without an amount there is nothing to be left', () => {
    expect(leftOf(site({ price: 200000 }))).toBe(200000);
    expect(paidRatio(site({ price: 200000 }))).toBe(0);
    expect(leftOf(site())).toBe(0);
    expect(paidRatio(site())).toBe(0);
    expect(isPaidUp(site())).toBe(false);
  });

  it('left never goes below zero, and kopecks do not leak noise', () => {
    expect(leftOf(site({ price: 100, payments: [pay('a', 150)] }))).toBe(0);
    expect(paidOf(site({ price: 1, payments: [pay('a', 0.1), pay('b', 0.2)] }))).toBe(0.3);
    expect(paidRatio(site({ price: 100, payments: [pay('a', 150)] }))).toBe(1);
  });

  it('paid up means: there is an amount and everything is paid', () => {
    expect(isPaidUp(site({ price: 100, payments: [pay('a', 100)] }))).toBe(true);
    expect(isPaidUp(site({ price: 100, payments: [pay('a', 40)] }))).toBe(false);
  });

  it('addSitePayment / removeSitePayment return new rows and keep the original', () => {
    const base = site({ price: 100 });
    const one = addSitePayment(base, pay('a', 40));
    const two = addSitePayment(one, pay('b', 60));
    expect(base.payments).toBeUndefined();
    expect(one.payments).toEqual([pay('a', 40)]);
    expect(isPaidUp(two)).toBe(true);
    expect(removeSitePayment(two, 'a').payments).toEqual([pay('b', 60)]);
    expect(removeSitePayment(base, 'zzz').payments).toEqual([]);
  });
});

