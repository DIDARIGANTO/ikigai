import { describe, it, expect } from 'vitest';
import type { Site } from '@/lib/types';
import { moveTo, NEXT_STATUS, SITE_STATUSES, siteMonogram, sortSites, splitSites, statusOf, totalPrice } from './sites';

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

  it('totalPrice sums the amounts down to kopecks and skips sites without one', () => {
    expect(totalPrice([site({ price: 0.1 }), site({ price: 0.2 }), site(), site({ price: 200000 })])).toBe(200000.3);
    expect(totalPrice([])).toBe(0);
  });
});
