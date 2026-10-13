import type { Site } from '@/lib/types';

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

/** Сумма сделок по сайтам, до копеек; сайты без суммы не считаются. */
export const totalPrice = (sites: readonly Pick<Site, 'price'>[]): number =>
  Math.round(sites.reduce((sum, s) => sum + (s.price ?? 0), 0) * 100) / 100;

const firstChar = (s: string): string | undefined => Array.from(s.trim())[0];

/** Буква на плитке: первая у названия. */
export function siteMonogram(site: Pick<Site, 'title'>): string {
  return (firstChar(site.title) ?? '?').toLocaleUpperCase('ru');
}
