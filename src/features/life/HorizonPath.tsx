import { Link } from 'react-router-dom';
import { Flag, Plus } from 'lucide-react';
import type { Goal } from '@/lib/types';
import { Chip } from '@/components/ui/Chip';
import { goalsByHorizon } from '@/lib/domain/life';
import { HORIZON_ICON, HORIZON_ORDER, HORIZON_SHORT } from '@/features/goals/meta';

/** Сколько целей показывать в строке горизонта — остальное на странице целей. */
const PER_LANE = 6;

/**
 * Горизонты от лет к неделе: четыре строки «Годы / Год / Месяц / Неделя» с тонкой линией между ними.
 * В каждой — активные цели этого срока нейтральными чипами; цель недели отмечена флажком.
 */
export function HorizonPath({ goals, weekGoalId }: { goals: Goal[]; weekGoalId?: string }) {
  const lanes = goalsByHorizon(goals);
  return (
    <ol className="divide-y divide-border">
      {HORIZON_ORDER.map(h => {
        const Icon = HORIZON_ICON[h];
        const items = lanes[h];
        const shown = items.slice(0, PER_LANE);
        const more = items.length - shown.length;
        return (
          <li key={h} className="grid gap-x-4 gap-y-2 py-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <h3 className="flex h-6 items-center gap-2 text-body font-medium text-text">
              <Icon size={16} aria-hidden="true" className="shrink-0 text-muted" />
              {HORIZON_SHORT[h]}
              <span className="font-mono text-small tabular-nums text-muted">{items.length}</span>
            </h3>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {shown.map(g => {
                const isWeekGoal = g.id === weekGoalId;
                return (
                  <Link key={g.id} to={`/goals/${g.id}`} className="focus-ring min-w-0 max-w-full rounded-chip">
                    <Chip
                      icon={
                        isWeekGoal ? <Flag size={12} /> : g.emoji ? <span className="font-emoji text-caption">{g.emoji}</span> : undefined
                      }
                      className="max-w-full hover:border-border-strong hover:text-text"
                    >
                      <span className="truncate">{g.title}</span>
                      {isWeekGoal ? <span className="sr-only"> — цель недели</span> : null}
                    </Chip>
                  </Link>
                );
              })}
              {more > 0 ? (
                <Link
                  to={`/goals?tab=${h}`}
                  className="focus-ring rounded-sm px-1 text-small text-muted hover:text-text"
                >
                  Ещё {more}
                </Link>
              ) : null}
              {items.length === 0 ? (
                <Link
                  to={`/goals?new=${h}`}
                  className="focus-ring inline-flex h-6 items-center gap-1 rounded-sm text-small text-muted hover:text-text"
                >
                  <Plus size={14} aria-hidden="true" />
                  Добавить цель
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
