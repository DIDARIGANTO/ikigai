import { Target } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import type { Goal } from '@/lib/types';

/**
 * Метка цели на любой поверхности с задачей (Сегодня, расписание, календарь, доски):
 * эмодзи цели (или значок «мишень») и название. Один компонент — чтобы связь «задача → цель» выглядела везде одинаково.
 */
export function GoalChip({ goal, className = '' }: { goal: Pick<Goal, 'title' | 'emoji'>; className?: string }) {
  return (
    <Chip
      tone="indigo"
      size="sm"
      title={goal.title}
      className={`min-w-0 max-w-full ${className}`}
      icon={goal.emoji ? <span className="font-emoji">{goal.emoji}</span> : <Target size={14} />}
    >
      <span className="truncate max-w-48">{goal.title}</span>
    </Chip>
  );
}
