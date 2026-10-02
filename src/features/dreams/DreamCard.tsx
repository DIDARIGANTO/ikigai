import { Circle, CircleCheck, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Dream, Goal } from '@/lib/types';
import { formatShortRu } from '@/lib/dates';
import { burst } from '@/components/ui/Burst';
import { IconButton } from '@/components/ui/Button';
import { cardClass } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { categoryLook } from './categories';

/**
 * Карточка мечты «Графита»: поверхность с линией 1 px. Сверху — эмодзи в строке (или приглушённая
 * иконка категории) и название в две строки, справа — отметка «исполнено». Ниже — нейтральный чип
 * категории с точкой, связанная цель (13 px) и тонкая полоса прогресса. Вся карточка открывает
 * редактор. Исполненная мечта — приглушённое название и галочка, без рамок и подложек.
 */
export function DreamCard({
  dream,
  goal,
  progress = 0,
  onToggleDone,
  onMakeGoal,
  onEdit,
}: {
  dream: Dream;
  goal?: Goal;
  /** Прогресс связанных целей, 0–1. */
  progress?: number;
  onToggleDone: (dream: Dream) => void;
  onMakeGoal: (dream: Dream) => void;
  onEdit: (dream: Dream) => void;
}) {
  const done = !!dream.doneAt;
  const look = categoryLook(dream.category);
  const Icon = look.icon;
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);

  return (
    <article className={`group relative flex flex-col gap-3 p-4 ${cardClass({ interactive: true })}`}>
      {/* Вся карточка — кнопка «Изменить»; остальные действия лежат поверх неё. */}
      <button
        type="button"
        aria-label={`Изменить: ${dream.title}`}
        title="Изменить"
        onClick={() => onEdit(dream)}
        className="focus-ring absolute inset-0 rounded-card"
      />

      {dream.imageDataUrl ? (
        <img
          src={dream.imageDataUrl}
          alt=""
          className={`pointer-events-none relative aspect-video w-full rounded-tile border border-border object-cover ${done ? 'opacity-70' : ''}`}
        />
      ) : null}

      <div className="pointer-events-none relative flex items-start gap-2.5">
        <span aria-hidden="true" className="inline-flex size-5 shrink-0 items-center justify-center">
          {dream.emoji ? (
            <span className="font-emoji text-lg leading-none">{dream.emoji}</span>
          ) : (
            <Icon size={16} className="text-muted" />
          )}
        </span>
        <h3 className={`min-w-0 flex-1 text-title font-semibold line-clamp-2 break-words ${done ? 'text-muted' : 'text-text'}`}>
          {dream.title}
        </h3>
        <IconButton
          size="sm"
          aria-pressed={done}
          aria-label={done ? `Снять отметку: ${dream.title}` : `Отметить исполненной: ${dream.title}`}
          title={done ? 'Снять отметку' : 'Исполнено'}
          onClick={e => {
            if (!done) burst(e.currentTarget, { count: 48, power: 8 });
            onToggleDone(dream);
          }}
          className={`pointer-events-auto -mr-2 -my-1.5 ${done ? '' : 'hover-reveal'}`}
        >
          {done ? (
            <CircleCheck size={16} aria-hidden="true" className="text-accent-strong" />
          ) : (
            <Circle size={16} aria-hidden="true" />
          )}
        </IconButton>
      </div>

      {dream.category || done ? (
        <div className="pointer-events-none relative flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 pl-7.5">
          {dream.category ? (
            <Chip tone={look.name} className="max-w-full truncate">
              {dream.category}
            </Chip>
          ) : null}
          {done ? (
            <span className="text-small text-muted tabular-nums">Исполнено {formatShortRu(dream.doneAt as string)}</span>
          ) : null}
        </div>
      ) : null}

      {goal ? (
        <div className="pointer-events-none relative mt-auto pl-7.5">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              to={`/goals/${goal.id}`}
              aria-label={`Открыть цель: ${goal.title}`}
              className="focus-ring pointer-events-auto flex min-w-0 items-center gap-1.5 rounded-sm text-small text-muted hover:text-text"
            >
              <Target size={14} aria-hidden="true" className="shrink-0" />
              <span className="truncate">{goal.title}</span>
            </Link>
            {done ? null : <span className="ml-auto shrink-0 font-mono text-small tabular-nums text-muted">{pct}%</span>}
          </div>
          {done ? null : <ProgressBar value={progress} label={`Прогресс мечты «${dream.title}»`} className="mt-2" />}
        </div>
      ) : done ? null : (
        <div className="pointer-events-none relative mt-auto pl-7.5">
          <button
            type="button"
            aria-label={`Сделать целью: ${dream.title}`}
            onClick={() => onMakeGoal(dream)}
            className="focus-ring hover-reveal pointer-events-auto -mx-1.5 inline-flex h-7 items-center gap-1.5 rounded-control px-1.5 text-small text-muted hover:bg-fill hover:text-text"
          >
            <Target size={14} aria-hidden="true" />
            Сделать целью
          </button>
        </div>
      )}
    </article>
  );
}
