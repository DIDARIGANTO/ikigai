import type { Site, SitePayment } from '@/lib/types';

/**
 * Сайты: чистая логика без интерфейса. Сайт — это заказ: он идёт по этапам от встречи с клиентом до оплаты
 * (`SITE_STATUSES`), у него есть клиент и сумма сделки.
 */

/** По алфавиту без учёта регистра; одинаковые названия — старые выше. */
export function sortSites(sites: readonly Site[]): Site[] {
  return [...sites].sort(
    (a, b) => a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' }) || a.createdAt.localeCompare(b.createdAt),
  );
}

export type SiteStatus = 'meeting' | 'work' | 'payment' | 'done';

/** Этапы по порядку, как и вкладки: согласовать встречу → в работе → жду оплату → реализован. */
export const SITE_STATUSES: readonly SiteStatus[] = ['meeting', 'work', 'payment', 'done'];

/** Название вкладки. */
export const STATUS_LABEL: Record<SiteStatus, string> = {
  meeting: 'Согласовать встречу',
  work: 'В работе',
  payment: 'Жду оплату',
  done: 'Реализованные',
};

/** Как назвать перенос на этот этап (кнопка и меню). */
export const MOVE_LABEL: Record<SiteStatus, string> = {
  meeting: 'Согласовать встречу',
  work: 'В работу',
  payment: 'Жду оплату',
  done: 'Реализован',
};

/** Пометка этапа в подписи поиска; у «в работе» её нет — это обычное состояние. */
export const STATUS_HINT: Record<SiteStatus, string> = { meeting: 'согласовать встречу', work: '', payment: 'жду оплату', done: 'реализован' };

/** Следующий этап для кнопки «дальше»; у реализованного следующего нет. */
export const NEXT_STATUS: Partial<Record<SiteStatus, SiteStatus>> = { meeting: 'work', work: 'payment', payment: 'done' };

/** Нет статуса (или он незнакомый) — «в работе»: так читаются сайты, записанные до появления этапов. */
export const statusOf = (site: Pick<Site, 'status'>): SiteStatus =>
  SITE_STATUSES.includes(site.status as SiteStatus) ? (site.status as SiteStatus) : 'work';

export type SplitSites = Record<SiteStatus, Site[]>;

/** По этапам: везде по алфавиту, а реализованные — недавно сданные выше, без даты в конце. */
export function splitSites(sites: readonly Site[]): SplitSites {
  const out: SplitSites = { meeting: [], work: [], payment: [], done: [] };
  for (const s of sites) out[statusOf(s)].push(s);
  return {
    meeting: sortSites(out.meeting),
    work: sortSites(out.work),
    payment: sortSites(out.payment),
    // Сортировка устойчивая: при одинаковой дате порядок остаётся алфавитным.
    done: sortSites(out.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')),
  };
}

/** Перенести на другой этап. Дата сдачи ставится один раз при переходе в «реализован» и снимается, когда сайт его покидает. */
export const moveTo = (site: Site, status: SiteStatus, date: string): Site => ({
  ...site,
  status,
  doneAt: status === 'done' ? (site.doneAt ?? date) : undefined,
});

/** Деньги — до копеек: сумма долей не должна давать «0,30000000000000004». */
const cents = (n: number): number => Math.round(n * 100) / 100;

// ——— Платежи: остаток считается из платежей и суммы сделки, а не хранится ———

/** Сколько клиент уже заплатил. */
export const paidOf = (site: Pick<Site, 'payments'>): number => cents((site.payments ?? []).reduce((sum, p) => sum + p.amount, 0));

/** Сколько осталось заплатить; не меньше нуля. Без суммы сделки остатка нет — считать не с чем. */
export const leftOf = (site: Pick<Site, 'price' | 'payments'>): number => (site.price ? Math.max(0, cents(site.price - paidOf(site))) : 0);

/** Доля оплаченного, 0…1; без суммы сделки — 0. */
export const paidRatio = (site: Pick<Site, 'price' | 'payments'>): number => (site.price ? Math.min(1, paidOf(site) / site.price) : 0);

/** Оплачено полностью: сумма сделки есть, и остатка нет. */
export const isPaidUp = (site: Pick<Site, 'price' | 'payments'>): boolean => !!site.price && leftOf(site) <= 0;

export const addSitePayment = (site: Site, payment: SitePayment): Site => ({ ...site, payments: [...(site.payments ?? []), payment] });

export const removeSitePayment = (site: Site, paymentId: string): Site => ({
  ...site,
  payments: (site.payments ?? []).filter(p => p.id !== paymentId),
});

/** Сколько ещё ждёшь по этим сайтам, до копеек; сайты без суммы и оплаченные целиком ничего не добавляют. */
export const totalLeft = (sites: readonly Pick<Site, 'price' | 'payments'>[]): number => cents(sites.reduce((sum, s) => sum + leftOf(s), 0));

const firstChar = (s: string): string | undefined => Array.from(s.trim())[0];

/** Буква на плитке: первая у названия. */
export function siteMonogram(site: Pick<Site, 'title'>): string {
  return (firstChar(site.title) ?? '?').toLocaleUpperCase('ru');
}
