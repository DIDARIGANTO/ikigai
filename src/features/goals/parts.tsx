import type { Goal, Horizon } from '@/lib/types';
import { Chip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { Tone } from '@/components/ui/tones';
import { HORIZON_ICON, HORIZON_SHORT } from './meta';

// oxlint-disable-next-line react/only-export-components -- общий класс фокуса раздела
export const FOCUS = 'focus-ring';

/**
 * Тон горизонта — для совместимости (точки и полосы). «Графит»: горизонт различается иконкой,
 * а не цветом, поэтому на экранах целей тон не используется.
 */
// oxlint-disable-next-line react/only-export-components -- тон горизонта живёт рядом с его чипом
export const HORIZON_TONE: Record<Horizon, Tone> = {
  years: 'lilac',
  year: 'indigo',
  month: 'sky',
  week: 'mint',
};

/** Нейтральный чип горизонта — короткая подпись. `compact` прячет чип на узких экранах. */
export function HorizonChip({ horizon, compact = false }: { horizon: Horizon; compact?: boolean }) {
  return <Chip className={compact ? 'max-sm:hidden' : ''}>{HORIZON_SHORT[horizon]}</Chip>;
}

/** Значок цели в строке: эмодзи, выбранное человеком, или простая иконка горизонта 16 px. */
export function GoalGlyph({ goal, className = '' }: { goal: Pick<Goal, 'emoji' | 'horizon' | 'status'>; className?: string }) {
  const Icon = HORIZON_ICON[goal.horizon];
  return (
    <span
      aria-hidden="true"
      className={`inline-flex size-4 shrink-0 items-center justify-center ${goal.status === 'active' ? '' : 'opacity-60'} ${className}`}
    >
      {goal.emoji ? (
        <span className="font-emoji text-base leading-none">{goal.emoji}</span>
      ) : (
        <Icon size={16} className="text-muted" />
      )}
    </span>
  );
}

/** Цвет названия цели по статусу: достигнутая — приглушённая, отменённая — ещё и зачёркнутая. */
// oxlint-disable-next-line react/only-export-components -- класс нужен строкам дерева, списка и подцелей
export function goalTitleClass(goal: Pick<Goal, 'status'>): string {
  if (goal.status === 'done') return 'text-muted';
  if (goal.status === 'dropped') return 'text-muted line-through';
  return 'text-text';
}

/** Полоса прогресса 3 px и процент моноширинными цифрами справа. */
export function ProgressInline({ pct, label, barClass = 'w-24' }: { pct: number; label: string; barClass?: string }) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <ProgressBar value={pct / 100} label={label} className={barClass} />
      <span className="w-10 text-right font-mono text-small tabular-nums text-muted">{pct}%</span>
    </div>
  );
}
