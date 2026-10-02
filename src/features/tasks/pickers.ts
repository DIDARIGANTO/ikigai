import type { Board, Goal, Horizon, List } from '@/lib/types';
import type { PickerItem } from './PickerMenu';

const HORIZON_LABEL: Record<Horizon, string> = { years: 'Годы', year: 'Год', month: 'Месяц', week: 'Неделя' };
const HORIZON_ORDER: Horizon[] = ['week', 'month', 'year', 'years'];

/** Активные цели для выбора: сначала ближние горизонты (неделя, месяц), с эмодзи цели. */
export function goalPickerItems(goals: Goal[]): PickerItem[] {
  return HORIZON_ORDER.flatMap(h =>
    goals
      .filter(g => g.status === 'active' && g.horizon === h)
      .map(g => ({ id: g.id, label: g.title, emoji: g.emoji, group: HORIZON_LABEL[h] })),
  );
}

export function boardPickerItems(boards: Board[]): PickerItem[] {
  return [...boards].sort((a, b) => a.position - b.position).map(b => ({ id: b.id, label: b.title }));
}

export function listPickerItems(lists: List[]): PickerItem[] {
  return [...lists].sort((a, b) => a.position - b.position).map(l => ({ id: l.id, label: l.title }));
}

/** Триггер меню в строке — как кнопка `ghost` 32 px: текст и шеврон, без фона, пока не навели. */
export const MENU_TRIGGER =
  "focus-ring press relative inline-flex h-8 shrink-0 items-center gap-1 rounded-control px-2 text-small font-medium whitespace-nowrap text-muted-strong hover:bg-fill hover:text-text aria-expanded:bg-fill aria-expanded:text-text pointer-coarse:before:absolute pointer-coarse:before:-inset-y-1.5 pointer-coarse:before:inset-x-0 pointer-coarse:before:content-['']";
