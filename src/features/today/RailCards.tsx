import { Link } from 'react-router-dom';
import { Bell, Cake, ChevronRight, Inbox, Target } from 'lucide-react';
import type { Goal, Task } from '@/lib/types';
import { Card, CardHeader, cardClass } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { UpcomingReminder } from '@/lib/domain/day';
import { pluralRu } from '@/features/goals/meta';

/** Цель недели: название, тонкая полоса прогресса с процентом моноширинным, ниже — следующий шаг строкой. */
export function WeekGoalCard({
  goal,
  progress,
  nextStep,
  onOpenTask,
}: {
  goal: Goal;
  progress: number;
  nextStep?: Task;
  onOpenTask: (t: Task) => void;
}) {
  const pct = Math.round(progress * 100);
  return (
    <Card className="p-5" aria-label="Цель недели">
      <CardHeader title="Цель недели" icon={<Target size={16} />} />
      <Link
        to={`/goals/${goal.id}`}
        className="mt-1 block text-body font-medium text-text line-clamp-2 hover:text-accent-strong rounded-sm focus-ring"
      >
        {goal.emoji ? <span className="font-emoji mr-1.5">{goal.emoji}</span> : null}
        {goal.title}
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <ProgressBar value={progress} size="sm" label={`Прогресс цели: ${goal.title}`} className="flex-1" />
        <span className="shrink-0 font-mono text-small tabular-nums text-muted">{pct}%</span>
      </div>
      <div className="mt-3">
        <div className="-mx-2">
          {nextStep ? (
            <button
              type="button"
              onClick={() => onOpenTask(nextStep)}
              className="focus-ring group flex w-full items-center gap-3 rounded-control px-2 py-1.5 text-left hover:bg-fill"
            >
              <span className="min-w-0 flex-1">
                <span className="block label-text text-muted">Следующий шаг</span>
                <span className="block truncate text-body text-text">
                  {nextStep.emoji ? <span className="font-emoji mr-1.5">{nextStep.emoji}</span> : null}
                  {nextStep.title}
                </span>
              </span>
              <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted group-hover:text-text" />
            </button>
          ) : (
            <Link
              to={`/goals/${goal.id}`}
              className="focus-ring group flex min-h-10 items-center gap-3 rounded-control px-2 text-body text-muted-strong hover:bg-fill hover:text-text"
            >
              <span className="min-w-0 flex-1">Запланируй следующий шаг</span>
              <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted group-hover:text-text" />
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Когда: сегодня — время (или «сегодня»), завтра — словом, дальше — дата «04.10» моноширинным. */
function When({ u }: { u: UpcomingReminder }) {
  if (u.days === 0) {
    return u.reminder.time ? (
      <span className="font-mono text-text">{u.reminder.time}</span>
    ) : (
      <span className="text-text">сегодня</span>
    );
  }
  if (u.days === 1) return <span>завтра</span>;
  const [, m, d] = u.date.split('-').map(Number);
  return (
    <span className="font-mono" title={`через ${u.days} ${pluralRu(u.days, ['день', 'дня', 'дней'])}`}>
      {pad(d)}.{pad(m)}
    </span>
  );
}

export function RemindersCard({ items }: { items: UpcomingReminder[] }) {
  if (!items.length) return null;
  return (
    <Card className="p-5" aria-label="Напоминания">
      <CardHeader
        title="Напоминания"
        icon={<Bell size={16} />}
        meta={<span className="font-mono text-small">{items.length}</span>}
      />
      <ul className="mt-1">
        {items.map(u => {
          const yearly = u.reminder.repeat === 'yearly';
          const Icon = yearly ? Cake : Bell;
          return (
            <li key={u.reminder.id} className="flex min-h-9 items-center gap-3 text-body">
              <Icon size={16} className="shrink-0 text-muted" aria-label={yearly ? 'Ежегодное' : 'Напоминание'} role="img" />
              <span className="min-w-0 flex-1 truncate text-text">{u.reminder.text}</span>
              <span className="shrink-0 text-small tabular-nums text-muted">
                <When u={u} />
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Входящие: задачи без даты и без доски. Одна строка-ссылка со счётчиком. */
export function InboxCard({ count }: { count: number }) {
  return (
    <Link
      to="/inbox"
      aria-label={count ? `Входящие: ${count} ${pluralRu(count, ['задача', 'задачи', 'задач'])} разобрать` : 'Входящие пусты'}
      className={`${cardClass({ interactive: true })} focus-ring group flex min-h-12 items-center gap-3 px-5`}
    >
      <Inbox size={16} aria-hidden="true" className="shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate text-title font-semibold text-text">Входящие</span>
      <span className="shrink-0 text-small tabular-nums text-muted">
        {count ? <span className="font-mono">{count}</span> : 'пусто'}
      </span>
      <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted group-hover:text-text" />
    </Link>
  );
}
