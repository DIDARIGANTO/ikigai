import { useEffect, useId, useRef, useState } from 'react';
import { ListTodo, Play, Plus } from 'lucide-react';
import type { Task } from '@/lib/types';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Chip } from '@/components/ui/Chip';
import { Popover } from '@/components/ui/Popover';
import { useToast } from '@/components/ui/Toast';
import { burst } from '@/components/ui/Burst';
import { isRunning } from '@/lib/domain/tasks';
import { formatDuration } from '@/lib/domain/day';
import { DEFAULT_MINUTES, freeSlots } from '@/lib/domain/schedule';
import { GoalChip } from '@/features/goals/GoalChip';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import { formatElapsed, useElapsed } from '@/features/tasks/TaskTimer';

/** Идущая задача: точка акцента и таймер моноширинным, без подложки. */
function RunningTime({ task }: { task: Task }) {
  const seconds = useElapsed(task.actualStart, true);
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-small tabular-nums text-accent-strong">
      <span aria-hidden="true" className="size-1.5 rounded-mark bg-accent" />
      {formatElapsed(seconds)}
    </span>
  );
}

/** «Запланировать»: ближайшие свободные окна сегодня под длительность задачи. */
function ScheduleButton({ task, date, nowMin }: { task: Task; date: string; nowMin: number }) {
  const { tasks, save } = useTaskActionsCtx();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const popId = useId();
  // Слой появляется скрытым (сначала меряется), поэтому фокус на первое окно ставим кадром позже.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => document.getElementById(popId)?.querySelector<HTMLElement>('button')?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open, popId]);
  const minutes = task.plannedMinutes || DEFAULT_MINUTES;
  const slots = open ? freeSlots(tasks, date, minutes, nowMin) : [];

  const pick = (start: string) => {
    setOpen(false);
    void save({ ...task, plannedStart: start, plannedMinutes: minutes }).then(() => toast(`Запланировано на ${start}`));
  };

  return (
    <>
      <Button
        ref={anchor}
        variant="ghost"
        size="sm"
        aria-label={`Запланировать: ${task.title}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        Запланировать
      </Button>
      <Popover id={popId} anchor={anchor} open={open} onClose={() => setOpen(false)} role="dialog" label="Свободное время" className="w-60 p-2">
        <p className="px-2 pt-1 pb-2 text-small text-muted">
          Свободно сегодня · {formatDuration(minutes)}
        </p>
        {slots.length ? (
          <ul className="space-y-0.5">
            {slots.map((s, i) => (
              <li key={s.start}>
                <button
                  type="button"
                  onClick={() => pick(s.start)}
                  className="focus-ring-inset flex w-full items-center justify-between rounded-control px-3 h-10 text-body text-text hover:bg-fill"
                >
                  <span className="font-mono tabular-nums">
                    {s.start}–{s.end}
                  </span>
                  <span className="text-small text-muted">{i === 0 ? 'ближайшее' : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2 pb-2 text-body text-muted-strong">Сегодня до 22:00 свободных окон нет.</p>
        )}
      </Popover>
    </>
  );
}

function DayTaskRow({
  task,
  date,
  nowMin,
  onOpen,
}: {
  task: Task;
  date: string;
  nowMin: number;
  onOpen: (t: Task) => void;
}) {
  const { toggleDone, start, goals } = useTaskActionsCtx();
  const box = useRef<HTMLSpanElement>(null);
  const done = task.status === 'done';
  const closed = done || task.status === 'skipped';
  const running = isRunning(task);
  const goal = task.goalId ? goals.find(g => g.id === task.goalId) : undefined;

  return (
    <li className="group relative flex min-h-10 items-center gap-3">
      <span ref={box} className="inline-flex">
        <Checkbox
          checked={done}
          tone={task.area === 'personal' ? 'personal' : 'accent'}
          onChange={next => {
            if (next && box.current) burst(box.current, { count: 16, power: 5 });
            void toggleDone(task);
          }}
          aria-label={done ? `Вернуть в работу: ${task.title}` : `Отметить готово: ${task.title}`}
        />
      </span>
      {/* Название не уже половины строки: подписи справа сжимаются первыми. */}
      <div className="flex min-w-0 shrink-0 grow basis-1/2 items-center gap-2">
        <button
          type="button"
          onClick={() => onOpen(task)}
          className={`min-w-0 truncate text-left text-body rounded-sm focus-ring ${
            closed ? 'text-muted line-through decoration-border-strong' : 'text-text hover:text-accent-strong'
          }`}
        >
          {task.emoji ? <span className="font-emoji mr-1.5">{task.emoji}</span> : null}
          {task.title}
        </button>
        <span
          aria-hidden="true"
          title={task.area === 'work' ? 'Работа' : 'Личное'}
          className={`size-1.5 shrink-0 rounded-mark ${closed ? 'bg-fill-strong' : task.area === 'work' ? 'bg-indigo' : 'bg-mint'}`}
        />
        {task.important && !closed ? (
          <Chip size="sm" tone="rose">
            важно
          </Chip>
        ) : null}
      </div>
      {goal || task.plannedMinutes || running ? (
        <div className="flex min-w-0 items-center justify-end gap-2">
          {running ? <RunningTime task={task} /> : null}
          {/* Чип цели сжимается и обрезает название — в отличие от остальных чипов. */}
          {goal ? <GoalChip goal={goal} className="shrink!" /> : null}
          {task.plannedMinutes && !running ? (
            <span className="shrink-0 text-small tabular-nums text-muted">{formatDuration(task.plannedMinutes)}</span>
          ) : null}
        </div>
      ) : null}
      {!closed && !running ? (
        // Действия по наведению ложатся поверх подписей справа; на сенсорных экранах видны всегда и стоят в строке.
        <div className="hover-reveal flex shrink-0 items-center pointer-fine:absolute pointer-fine:inset-y-0 pointer-fine:right-0 pointer-fine:bg-surface pointer-fine:pl-2">
          <ScheduleButton task={task} date={date} nowMin={nowMin} />
          <IconButton
            size="sm"
            aria-label={`Начать: ${task.title}`}
            title="Начать"
            onClick={() => void start(task)}
          >
            <Play size={12} strokeWidth={2.5} fill="currentColor" />
          </IconButton>
        </div>
      ) : null}
    </li>
  );
}

/** «Задачи на день» — задачи без времени строками 40 px: отметка, название, точка сферы, цель, «Запланировать» в свободное окно. */
export function DayTasksCard({
  tasks,
  date,
  nowMin,
  onOpen,
  onAdd,
}: {
  tasks: Task[];
  date: string;
  nowMin: number;
  onOpen: (t: Task) => void;
  onAdd: () => void;
}) {
  const done = tasks.filter(t => t.status === 'done').length;
  return (
    <Card className="p-5" aria-label="Задачи на день">
      <CardHeader
        title="Задачи на день"
        icon={<ListTodo size={16} />}
        meta={tasks.length ? <span className="font-mono text-small">{done}/{tasks.length}</span> : undefined}
      />
      {tasks.length ? (
        <ul className="mt-1 divide-y divide-border">
          {tasks.map(t => (
            <DayTaskRow key={t.id} task={t} date={date} nowMin={nowMin} onOpen={onOpen} />
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-small text-muted">Задач без времени нет.</p>
      )}
      <div className="mt-1">
        <Button variant="ghost" size="sm" className="-ml-3" onClick={onAdd}>
          <Plus size={16} aria-hidden="true" />
          Добавить
        </Button>
      </div>
    </Card>
  );
}
