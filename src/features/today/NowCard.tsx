import { Play, Square } from 'lucide-react';
import type { Goal, Task } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { minutesToTime, timeToMinutes } from '@/lib/dates';
import { isRunning } from '@/lib/domain/tasks';
import { formatDuration } from '@/lib/domain/day';
import { GoalChip } from '@/features/goals/GoalChip';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import { formatElapsed, useElapsed } from '@/features/tasks/TaskTimer';
import { FreeDay } from './FreeDay';

function TaskTitle({ task, onOpen, className = '' }: { task: Task; onOpen: (t: Task) => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      className={`block max-w-full truncate text-left text-h2 font-semibold text-text hover:text-accent-strong rounded-sm focus-ring ${className}`}
    >
      {task.title}
    </button>
  );
}

/**
 * Полоса «план / факт» 3 px. Шкала — большее из двух: факт в пределах плана — акцентом,
 * перерасход — отрезок цвета предупреждения за отметкой плана. Не красный: это сведения, а не провал.
 */
export function PlanFactBar({ planned, actual }: { planned: number; actual: number }) {
  const scale = Math.max(planned, actual, 1);
  const over = actual > planned;
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  return (
    <div aria-hidden="true" data-over={over || undefined} className="relative h-0.75 overflow-hidden rounded-bar bg-fill-strong">
      <div
        className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-(--duration-slow) ease-out-soft"
        style={{ width: pct(Math.min(actual, planned)) }}
      />
      {over ? (
        <div
          className="absolute inset-y-0 bg-warning transition-[width] duration-(--duration-slow) ease-out-soft"
          style={{ left: pct(planned), width: `calc(${pct(actual)} - ${pct(planned)})` }}
        />
      ) : null}
    </div>
  );
}

function RunningCard({ task, goal, onOpen }: { task: Task; goal?: Goal; onOpen: (t: Task) => void }) {
  const { finish, save } = useTaskActionsCtx();
  const seconds = useElapsed(task.actualStart, true);
  const elapsedMin = Math.floor(seconds / 60);
  const planned = task.plannedMinutes ?? 0;
  const over = planned > 0 ? elapsedMin - planned : 0;

  return (
    <Card aria-label="Сейчас" data-testid="now-running" className="animate-in relative overflow-hidden p-5">
      {over > 0 ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-warning" /> : null}
      {/* На телефоне таймер уходит под название — чтобы название не обрезалось. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 label-text text-muted">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-mark bg-accent" />
            Сейчас
          </p>
          <TaskTitle task={task} onOpen={onOpen} className="mt-1" />
          {goal ? <GoalChip goal={goal} className="mt-2" /> : null}
        </div>
        <p aria-live="off" className="font-mono text-display font-medium tabular-nums text-text sm:shrink-0">
          {formatElapsed(seconds)}
        </p>
      </div>

      {planned ? (
        <div className="mt-4">
          <PlanFactBar planned={planned} actual={elapsedMin} />
          <div className="mt-2 flex items-center justify-between gap-4 text-small">
            {over > 0 ? (
              <p className="font-medium tabular-nums text-warning-strong">+{formatDuration(over)} сверх плана</p>
            ) : (
              <p className="tabular-nums text-muted">Осталось {formatDuration(Math.max(0, planned - elapsedMin))}</p>
            )}
            <p className="shrink-0 tabular-nums text-muted">план {formatDuration(planned)}</p>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-small text-muted">Без оценки времени</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => void finish(task)}>
          <Square size={12} strokeWidth={2.5} fill="currentColor" aria-hidden="true" />
          Закончить
        </Button>
        {planned ? (
          <Button variant="secondary" onClick={() => void save({ ...task, plannedMinutes: planned + 15 })}>
            Ещё 15 мин
          </Button>
        ) : null}
        <Button variant="ghost" onClick={() => onOpen(task)}>
          Открыть
        </Button>
      </div>
    </Card>
  );
}

function whenLabel(delta: number): string {
  if (delta <= 0) return 'по плану уже сейчас';
  if (delta < 60) return `через ${delta} мин`;
  const h = Math.floor(delta / 60);
  const m = delta % 60;
  return m ? `через ${h} ч ${m} мин` : `через ${h} ч`;
}

function NextCard({
  task,
  goal,
  nowMin,
  onOpen,
}: {
  task: Task;
  goal?: Goal;
  nowMin: number;
  onOpen: (t: Task) => void;
}) {
  const { start } = useTaskActionsCtx();
  const startMin = task.plannedStart ? timeToMinutes(task.plannedStart) : null;
  const missed = startMin !== null && startMin + (task.plannedMinutes ?? 30) <= nowMin;
  const end =
    startMin !== null && task.plannedMinutes ? minutesToTime(Math.min(startMin + task.plannedMinutes, 24 * 60 - 1)) : null;
  const label =
    startMin === null ? 'Следующая задача' : missed ? 'Пропущено · можно начать сейчас' : `Дальше · ${whenLabel(startMin - nowMin)}`;
  const time = startMin !== null ? `${task.plannedStart}${end ? `–${end}` : ''}` : task.plannedMinutes ? formatDuration(task.plannedMinutes) : null;

  return (
    <Card className="animate-in p-5" aria-label="Дальше" data-testid="now-next">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-56">
          <p className="label-text text-muted">{label}</p>
          <TaskTitle task={task} onOpen={onOpen} className="mt-1" />
          {time || goal ? (
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              {time ? <span className="font-mono text-small tabular-nums text-muted">{time}</span> : null}
              {goal ? <GoalChip goal={goal} /> : null}
            </div>
          ) : null}
        </div>
        <Button variant="primary" onClick={() => void start(task)} className="max-sm:w-full">
          <Play size={12} strokeWidth={2.5} fill="currentColor" aria-hidden="true" />
          Начать
        </Button>
      </div>
    </Card>
  );
}

const byPosition = (a: Task, b: Task) => Number(!!b.important) - Number(!!a.important) || a.position - b.position;

/** Что показать, когда ничего не идёт. Чистая функция — для тестов. */
// oxlint-disable-next-line react/only-export-components -- выбор карточки проверяется тестами
export function pickNext(dayTasks: Task[], nowMin: number): Task | undefined {
  const open = dayTasks.filter(t => t.status === 'todo');
  const timed = open.filter(t => t.plannedStart);
  // Ближайшая задача со временем, которая по плану ещё не закончилась.
  const upcoming = timed.find(t => timeToMinutes(t.plannedStart as string) + (t.plannedMinutes ?? 30) > nowMin);
  if (upcoming) return upcoming;
  const untimed = open.filter(t => !t.plannedStart).sort(byPosition);
  // Затем — без времени, потом — пропущенная по времени (её ещё можно сделать).
  return untimed[0] ?? timed[timed.length - 1];
}

/**
 * Карточка «Сейчас»: идущая задача с моноширинным таймером и полосой «план / факт»,
 * иначе — следующая задача; пустой день — «На сегодня пока ничего» с примерами. Всё закрыто — карточки нет.
 */
export function NowCard({
  tasks,
  dayTasks,
  nowMin,
  date,
  onOpen,
  onAdd,
}: {
  /** Все задачи: идущая может быть и не сегодняшней. */
  tasks: Task[];
  /** Задачи дня, отсортированные по времени. */
  dayTasks: Task[];
  nowMin: number;
  date: string;
  onOpen: (t: Task) => void;
  /** «Добавить задачу» на пустой день. */
  onAdd?: () => void;
}) {
  const { goals } = useTaskActionsCtx();
  const goalOf = (t: Task) => (t.goalId ? goals.find(g => g.id === t.goalId) : undefined);

  const running = tasks.find(isRunning);
  if (running) return <RunningCard task={running} goal={goalOf(running)} onOpen={onOpen} />;

  if (!dayTasks.length) return <FreeDay date={date} onAdd={onAdd} />;

  const next = pickNext(dayTasks, nowMin);
  if (!next) return null;
  return <NextCard task={next} goal={goalOf(next)} nowMin={nowMin} onOpen={onOpen} />;
}
