import { Calendar, CalendarDays, CalendarRange, Mountain } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Goal, GoalStatus, Horizon, Task } from '@/lib/types';
import { childGoals } from '@/lib/domain/goals';
import { formatShortRu } from '@/lib/dates';

/** Горизонты от дальнего к ближнему: порядок задаёт вложенность дерева. */
export const HORIZON_ORDER: Horizon[] = ['years', 'year', 'month', 'week'];

/** Иконка горизонта: даль, год, месяц, неделя. */
export const HORIZON_ICON: Record<Horizon, LucideIcon> = {
  years: Mountain,
  year: CalendarRange,
  month: Calendar,
  week: CalendarDays,
};

/** Короткая подпись горизонта — для чипов и переключателя. */
export const HORIZON_SHORT: Record<Horizon, string> = {
  years: 'Годы',
  year: 'Год',
  month: 'Месяц',
  week: 'Неделя',
};

export const STATUS_LABEL: Record<GoalStatus, string> = {
  active: 'Активна',
  done: 'Достигнута',
  dropped: 'Отменена',
};

/** Горизонт на ступень ближе: подцель года — месяц, подцель недели — тоже неделя. */
export const nextHorizon = (h: Horizon): Horizon =>
  HORIZON_ORDER[Math.min(HORIZON_ORDER.indexOf(h) + 1, HORIZON_ORDER.length - 1)];

const withYear = (iso: string) => {
  const year = iso.slice(0, 4);
  return year === String(new Date().getFullYear()) ? formatShortRu(iso) : `${formatShortRu(iso)} ${year}`;
};

/** Срок цели одной строкой: «12 мая — 30 ноя», «с 12 мая», «до 30 ноя». */
export function goalDatesLabel(goal: Goal): string | null {
  const { startDate: from, endDate: to } = goal;
  if (from && to) return `${withYear(from)} — ${withYear(to)}`;
  if (from) return `с ${withYear(from)}`;
  if (to) return `до ${withYear(to)}`;
  return null;
}

/** Сделано и всего — те же слагаемые, из которых считается goalProgress. */
export function goalCounts(goal: Goal, goals: Goal[], tasks: Task[]): { done: number; total: number } {
  const subs = childGoals(goals, goal.id);
  const own = tasks.filter(t => t.goalId === goal.id && t.status !== 'skipped');
  return {
    done: subs.filter(s => s.status === 'done').length + own.filter(t => t.status === 'done').length,
    total: subs.length + own.length,
  };
}

/** Русское склонение по числу: 1 шаг, 2 шага, 5 шагов. */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

export interface GoalForest {
  /** Цели верхнего уровня в порядке входного списка. */
  roots: Goal[];
  /** Подцели по идентификатору родителя. */
  childrenOf: Map<string, Goal[]>;
}

/**
 * Раскладывает плоский список целей в лес «корень → подцели».
 * Цель, чей родитель отфильтрован или отсутствует, поднимается в корни.
 * Импортированные данные могут содержать цикл `parentId` (A → B → A): такие цели
 * не видны ни из одного корня, поэтому первая из них тоже становится корнем —
 * связь с её родителем при этом рвётся, иначе дерево нельзя было бы отрисовать.
 */
export function buildGoalForest(goals: Goal[]): GoalForest {
  const childrenOf = new Map<string, Goal[]>();
  const shown = new Set(goals.map(g => g.id));
  const roots: Goal[] = [];

  for (const g of goals) {
    if (!g.parentId || !shown.has(g.parentId)) roots.push(g);
    else childrenOf.set(g.parentId, [...(childrenOf.get(g.parentId) ?? []), g]);
  }

  const reached = new Set<string>();
  const walk = (goal: Goal) => {
    if (reached.has(goal.id)) return;
    reached.add(goal.id);
    for (const kid of childrenOf.get(goal.id) ?? []) walk(kid);
  };
  for (const root of roots) walk(root);

  for (const g of goals) {
    if (reached.has(g.id)) continue;
    const parentId = g.parentId;
    if (parentId) {
      const siblings = childrenOf.get(parentId) ?? [];
      childrenOf.set(
        parentId,
        siblings.filter(s => s.id !== g.id),
      );
    }
    roots.push(g);
    walk(g);
  }

  return { roots, childrenOf };
}

/** Цель и все её потомки — чтобы не предложить цель родителем самой себе. */
export function descendantIds(goals: Goal[], id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const g of goals) {
      if (g.parentId && out.has(g.parentId) && !out.has(g.id)) {
        out.add(g.id);
        grew = true;
      }
    }
  }
  return out;
}
