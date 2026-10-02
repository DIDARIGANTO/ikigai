import { useRef } from 'react';
import { Flag, Play, Square } from 'lucide-react';
import type { Goal, Task } from '@/lib/types';
import { IconButton } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Chip } from '@/components/ui/Chip';
import { burst } from '@/components/ui/Burst';
import { formatShortRu } from '@/lib/dates';
import { durationLabel } from '@/lib/parse/quickParse';
import { isRunning, planVsFact } from '@/lib/domain/tasks';
import { GoalChip } from '@/features/goals/GoalChip';
import { formatElapsed, useElapsed } from './TaskTimer';
import { useTaskActionsCtx } from './TaskActionsContext';
import { planFactBar } from './planFact';

/**
 * Кнопка появляется по наведению и фокусу. На сенсорных экранах наведения нет,
 * поэтому там она видна всегда — прятать её можно только при `hover: hover`.
 */
const REVEAL =
  '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/card:opacity-100 [@media(hover:hover)]:group-focus-within/card:opacity-100 focus-visible:opacity-100';

/** Свойства в подписи — маленькие нейтральные чипы, 12 px, табличные цифры. */
const META = 'text-caption! tabular-nums';

/** Идущий отсчёт: `mm:ss` моноширинным — рядом с акцентной полосой слева. */
function RunningTime({ task }: { task: Task }) {
  const seconds = useElapsed(task.actualStart, true);
  return (
    <span aria-live="off" title="Идёт с начала работы" className="font-mono text-caption tabular-nums text-accent-strong">
      {formatElapsed(seconds)}
    </span>
  );
}

/** «Начать» / «Закончить» — тихая кнопка-иконка справа, видна по наведению. */
function TimerControl({ task }: { task: Task }) {
  const { start, finish } = useTaskActionsCtx();
  const running = isRunning(task);
  if (!running && task.status !== 'todo' && task.status !== 'doing') return null;
  return (
    <IconButton
      size="sm"
      onClick={() => void (running ? finish(task, { undo: 'Закончено' }) : start(task, { undo: true }))}
      aria-label={`${running ? 'Закончить' : 'Начать'}: ${task.title}`}
      title={running ? 'Закончить' : 'Начать'}
      className={`-my-1.5 ${REVEAL}`}
    >
      {running ? (
        <Square size={14} fill="currentColor" aria-hidden="true" />
      ) : (
        <Play size={14} fill="currentColor" aria-hidden="true" />
      )}
    </IconButton>
  );
}

/** Тонкая полоса «план / факт» (3 px): сколько из запланированного ушло, перерасход — янтарным. */
function PlanFactBar({ planned, actual }: { planned: number; actual: number }) {
  const bar = planFactBar(planned, actual);
  return (
    <div className="mt-2 flex items-center gap-2" title={bar.title}>
      <div role="img" aria-label={bar.title} className="relative h-0.75 min-w-0 flex-1 overflow-hidden rounded-bar bg-fill-strong">
        <div
          className={`h-full rounded-bar transition-[width] duration-(--duration-slow) ease-out-soft ${bar.over ? 'bg-warning' : 'bg-accent'}`}
          style={{ width: `${bar.fill * 100}%` }}
        />
      </div>
      <span className={`shrink-0 font-mono text-micro tabular-nums ${bar.over ? 'text-warning-strong' : 'text-muted'}`}>{bar.short}</span>
    </div>
  );
}

/** Для идущей задачи факт тикает — отдельный компонент, чтобы секунды не перерисовывали всю карточку. */
function RunningPlanFact({ task }: { task: Task }) {
  const seconds = useElapsed(task.actualStart, true);
  if (!task.plannedMinutes) return null;
  return <PlanFactBar planned={task.plannedMinutes} actual={Math.floor(seconds / 60)} />;
}

/**
 * Карточка задачи «Графита»: линия 1 px, острые углы, без пастели и плиток.
 * Эмодзи (если человек его выбрал) — просто символ перед названием; свойства — маленькие нейтральные чипы.
 * Идущая задача — акцентная полоса 2 px слева и моноширинный таймер; готовая — приглушённая и зачёркнутая.
 */
export function TaskCard({
  task,
  goals,
  onOpen,
  compact = false,
  className = '',
}: {
  task: Task;
  /** Цели для подписи; если не передать — берутся из хранилища. */
  goals?: Goal[];
  onOpen?: (task: Task) => void;
  /** Вид для досок и недели: плотнее, в подписи появляется дата. */
  compact?: boolean;
  className?: string;
}) {
  const { toggleDone, goals: allGoals } = useTaskActionsCtx();
  const goal = (goals ?? allGoals).find(g => g.id === task.goalId);
  const checkRef = useRef<HTMLSpanElement>(null);

  const done = task.status === 'done';
  const closed = done || task.status === 'skipped';
  const running = isRunning(task);
  const pf = done ? planVsFact(task) : null;

  const onCheck = () => {
    // Залп из чекбокса — только если человек включил «Праздничные эффекты» (по умолчанию выключены).
    if (!done && checkRef.current) burst(checkRef.current, { count: 14, power: 4 });
    void toggleDone(task, { undo: true });
  };

  const showDuration = !!task.plannedMinutes && !pf;
  const showDate = compact && !!task.date;
  const hasMeta = !!(task.plannedStart || showDuration || showDate || goal);

  return (
    <article
      className={`group/card relative flex items-start gap-2.5 overflow-hidden rounded-tile border bg-surface shadow-(--shadow-raised) transition-colors duration-(--duration-fast) ${
        compact ? 'p-2' : 'px-3 py-2.5'
      } ${running ? 'border-border-strong' : 'border-border hover:border-border-strong'} ${className}`}
    >
      {running ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-accent" /> : null}

      <span ref={checkRef} className="inline-flex h-5 shrink-0 items-center">
        <Checkbox
          checked={done}
          onChange={onCheck}
          aria-label={done ? `Вернуть в работу: ${task.title}` : `Отметить готово: ${task.title}`}
        />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start gap-1.5">
          {task.emoji ? (
            <span aria-hidden="true" className={`font-emoji shrink-0 text-base leading-5 ${closed ? 'opacity-50' : ''}`}>
              {task.emoji}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => onOpen?.(task)}
            disabled={!onOpen}
            className={`focus-ring min-w-0 rounded-sm text-left text-body font-medium line-clamp-2 break-words ${
              closed ? 'text-muted line-through decoration-muted/60' : 'text-text'
            } ${onOpen ? 'cursor-pointer' : 'cursor-default'}`}
          >
            {task.title}
          </button>
          {task.important ? (
            <Flag
              size={14}
              role="img"
              aria-label="Важная"
              className={`mt-0.75 shrink-0 ${closed ? 'text-muted' : 'text-important-strong'}`}
            />
          ) : null}
        </div>

        {hasMeta ? (
          <div className={`mt-1.5 flex min-w-0 flex-wrap items-center gap-1 ${closed ? 'opacity-60' : ''}`}>
            {task.plannedStart ? (
              <Chip size="sm" title="Время начала" className={`${META} font-mono`}>
                {task.plannedStart}
              </Chip>
            ) : null}
            {showDuration ? (
              <Chip size="sm" title="Длительность" className={META}>
                {durationLabel(task.plannedMinutes!)}
              </Chip>
            ) : null}
            {showDate ? (
              <Chip size="sm" title="Дата" className={META}>
                {formatShortRu(task.date!)}
              </Chip>
            ) : null}
            {goal ? <GoalChip goal={goal} className="text-caption!" /> : null}
          </div>
        ) : null}

        {pf ? <PlanFactBar planned={pf.planned} actual={pf.actual} /> : running ? <RunningPlanFact task={task} /> : null}
      </div>

      <div className="flex h-5 shrink-0 items-center gap-1">
        {running ? <RunningTime task={task} /> : null}
        <TimerControl task={task} />
      </div>
    </article>
  );
}
