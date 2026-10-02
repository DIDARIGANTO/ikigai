import { useLocation } from 'react-router-dom';
import type { SectionKey } from '@/lib/icons';

export interface NavItem {
  key: SectionKey;
  label: string;
  to: string;
  soon?: boolean;
}

export const NAV: NavItem[] = [
  { key: 'inbox', label: 'Входящие', to: '/inbox' },
  { key: 'today', label: 'Сегодня', to: '/' },
  { key: 'calendar', label: 'Календарь', to: '/calendar' },
  { key: 'boards', label: 'Доски', to: '/boards' },
  { key: 'life', label: 'Моя жизнь', to: '/life' },
  { key: 'goals', label: 'Цели', to: '/goals' },
  { key: 'dreams', label: 'Мечты', to: '/dreams' },
  { key: 'reminders', label: 'Напоминания', to: '/reminders' },
  { key: 'lists', label: 'Списки', to: '/lists' },
  { key: 'notes', label: 'Блокнот', to: '/notes' },
  { key: 'debts', label: 'Долги', to: '/debts' },
  { key: 'analytics', label: 'Аналитика', to: '/analytics', soon: true },
  { key: 'codex', label: 'Кодекс', to: '/codex', soon: true },
];

/** Группы бокового меню: подпись и разделы в ней. */
export const NAV_GROUPS: { label: string; keys: SectionKey[] }[] = [
  { label: 'Планирование', keys: ['inbox', 'today', 'calendar', 'boards'] },
  { label: 'Мечты и цели', keys: ['life', 'goals', 'dreams'] },
  { label: 'Под рукой', keys: ['reminders', 'lists', 'notes', 'debts'] },
  { label: 'Скоро', keys: ['analytics', 'codex'] },
];

export const SETTINGS_NAV: NavItem = { key: 'settings', label: 'Настройки', to: '/settings' };

/** Три раздела в нижней панели телефона; в центре — «+», справа — «Ещё». */
export const MOBILE_NAV: SectionKey[] = ['today', 'calendar', 'boards'];

const ALL = [...NAV, SETTINGS_NAV];

/** Пункт меню, которому принадлежит путь (учитывает вложенные пути вида /goals/:id). */
export function navItemForPath(pathname: string): NavItem {
  const exact = ALL.find(n => n.to === pathname);
  if (exact) return exact;
  const nested = ALL.filter(n => n.to !== '/').find(n => pathname.startsWith(`${n.to}/`));
  return nested ?? NAV[0];
}

export function useCurrentNav(): NavItem {
  return navItemForPath(useLocation().pathname);
}
