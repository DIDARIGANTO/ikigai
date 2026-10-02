import { Bell, CalendarClock, Flag, ListTodo, Plus } from 'lucide-react';
import type { Reminder, Task } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { burst } from '@/components/ui/Burst';
import { Card, CardHeader } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import { Timeline } from '@/features/today/Timeline';
import { ReminderIcon, isClosed, taskDot } from './parts';

/** Задача без времени: отметка, точка смысла 6 px, эмодзи (если выбрано) и название; важная — флажок. */
function DayTaskRow({ task, onOpen, lastOpen }: { task: Task; onOpen: (t: Task) => void; lastOpen: boolean }) {
  const { toggleDone } = useTaskActionsCtx();
  const done = task.status === 'done';
  const closed = isClosed(task);

  return (
    <li className="-mx-2 flex min-h-10 items-center gap-3 rounded-control px-2 hover:bg-fill pointer-coarse:min-h-11">
      <Checkbox
        checked={done}
        tone={task.area === 'personal' ? 'personal' : 'accent'}
        onChange={() => {
          // Закрыли последнюю задачу дня — маленький праздник.
          if (!done && lastOpen) {
            const el = document.activeElement;
            if (el instanceof Element) burst(el, { count: 22, power: 6 });
          }
          void toggleDone(task);
        }}
        aria-label={done ? `Вернуть в работу: ${task.title}` : `Отметить готово: ${task.title}`}
      />
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1.5 text-left text-body"
      >
        <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-mark ${taskDot(task)}`} />
        {task.emoji ? (
          <span aria-hidden="true" className="font-emoji shrink-0">
            {task.emoji}
          </span>
        ) : null}
        <span className={`min-w-0 truncate ${closed ? 'text-muted line-through decoration-muted/60' : 'text-text'}`}>{task.title}</span>
      </button>
      {task.important && !closed ? (
        <Flag
          size={14}
          role="img"
          aria-label="Важная"
          fill="currentColor"
          fillOpacity={0.2}
          className="shrink-0 text-important-strong"
        />
      ) : null}
    </li>
  );
}

export function DayView({
  date,
  tasks,
  reminders,
  onOpenTask,
  onCreate,
}: {
  date: string;
  tasks: Task[];
  reminders: Reminder[];
  onOpenTask: (t: Task) => void;
  /** Создать задачу: с временем — из получаса на шкале, без — кнопкой в карточке. */
  onCreate: (defaults: Partial<Task>) => void;
}) {
  const timed = tasks.filter(t => t.plannedStart);
  const anytime = tasks.filter(t => !t.plannedStart);
  const anytimeDone = anytime.filter(t => t.status === 'done').length;
  const openLeft = anytime.filter(t => !isClosed(t)).length;

  return (
    <div className="grid gap-4 md:gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="animate-in min-w-0 p-4 md:p-5">
        <CardHeader
          title="Расписание"
          icon={<CalendarClock size={16} />}
          meta={timed.length ? `${timed.length}` : undefined}
          action={
            <Button variant="ghost" size="sm" aria-label="Добавить задачу" onClick={() => onCreate({ date })}>
              <Plus size={16} aria-hidden="true" />
              <span className="hidden min-[360px]:inline">Задача</span>
            </Button>
          }
        />
        {/* Подсказку на пустой шкале показывает сама шкала — здесь только для скринридера. */}
        {timed.length ? null : <p className="sr-only">Задач со временем нет. Нажмите на час, чтобы запланировать.</p>}
        <Timeline date={date} embedded className="-mx-2 mt-3" onOpenTask={onOpenTask} onCreate={onCreate} />
      </Card>

      <div className="stagger min-w-0 space-y-4 md:space-y-6">
        <Card className="p-4 md:p-5">
          <CardHeader
            title="Задачи на день"
            icon={<ListTodo size={16} />}
            meta={anytime.length ? `${anytimeDone} из ${anytime.length}` : undefined}
          />
          {anytime.length ? (
            <>
              <ProgressBar value={anytimeDone / anytime.length} className="mt-3" label="Сделано задач на день" />
              <ul className="mt-2">
                {anytime.map(t => (
                  <DayTaskRow key={t.id} task={t} onOpen={onOpenTask} lastOpen={openLeft === 1 && !isClosed(t)} />
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-small text-muted">Задач без времени нет.</p>
          )}
          <div className="mt-3 border-t border-border pt-3">
            <Button variant="ghost" size="sm" className="-ml-2.5" onClick={() => onCreate({ date })}>
              <Plus size={16} aria-hidden="true" />
              Добавить
            </Button>
          </div>
        </Card>

        <Card className="p-4 md:p-5">
          <CardHeader
            title="Напоминания"
            icon={<Bell size={16} />}
            meta={reminders.length ? `${reminders.length}` : undefined}
          />
          {reminders.length ? (
            <ul className="mt-2">
              {reminders.map(r => (
                <li key={r.id} className="flex min-h-10 items-center gap-3 text-body">
                  <ReminderIcon reminder={r} size={16} className="text-muted" />
                  <span className="min-w-0 flex-1 truncate text-text">{r.text}</span>
                  {r.time ? <span className="shrink-0 font-mono text-caption text-muted">{r.time}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-small text-muted">На этот день напоминаний нет.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
