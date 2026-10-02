import { useId, useState } from 'react';
import { ChevronDown, History } from 'lucide-react';
import type { Task } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { addDaysISO, formatShortRu } from '@/lib/dates';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';

/** Сколько строк видно, пока список свёрнут. */
const COLLAPSED = 2;

function since(date: string, today: string): string {
  if (date === addDaysISO(today, -1)) return 'со вчера';
  return `с ${formatShortRu(date)}`;
}

function TailRow({ task, today }: { task: Task; today: string }) {
  const { reschedule, skip } = useTaskActionsCtx();
  const toast = useToast();
  return (
    <li className="animate-in flex flex-wrap items-center gap-x-3 py-1">
      <p className="flex min-h-8 min-w-0 flex-1 basis-48 items-center gap-2">
        <span className="min-w-0 truncate text-body text-text">
          {task.emoji ? <span className="font-emoji mr-1.5">{task.emoji}</span> : null}
          {task.title}
        </span>
        {task.date ? <span className="shrink-0 text-small tabular-nums text-muted">{since(task.date, today)}</span> : null}
      </p>
      <div className="-mx-3 flex items-center" role="group" aria-label={`Что сделать с «${task.title}»`}>
        <Button variant="ghost" size="sm" onClick={() => void reschedule(task, today)}>
          Сегодня
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void reschedule(task, addDaysISO(today, 1)).then(() => toast('Перенесено на завтра'))}
        >
          Завтра
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void skip(task).then(() => toast('Отмечено: не делал'))}>
          Не делал
        </Button>
      </div>
    </li>
  );
}

/**
 * «Незавершённое» — открытые задачи прошлых дней. Спокойная карточка без цвета:
 * счётчик, «Перенести на сегодня» для всех разом и список с решением по каждой — две строки сразу, остальное по запросу.
 */
export function TailsCard({ tasks, today }: { tasks: Task[]; today: string }) {
  const { reschedule } = useTaskActionsCtx();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const listId = useId();

  if (!tasks.length) return null;
  const hidden = tasks.length - COLLAPSED;
  // Одну задачу переносит её же «Сегодня»; «всё разом» — от двух.
  const bulk = tasks.length > 1;
  const visible = open || hidden <= 0 ? tasks : tasks.slice(0, COLLAPSED);

  const moveAll = async () => {
    const n = tasks.length;
    for (const t of tasks) await reschedule(t, today);
    toast(`Перенесено на сегодня: ${n}`);
  };

  return (
    <Card className="animate-in p-5" aria-label="Незавершённое" data-testid="tails">
      <CardHeader
        title="Незавершённое"
        icon={<History size={16} />}
        meta={<Badge>{tasks.length}</Badge>}
        action={
          bulk ? (
            <Button variant="secondary" size="sm" onClick={() => void moveAll()} className="max-sm:hidden">
              Перенести на сегодня
            </Button>
          ) : null
        }
      />
      <ul id={listId} className="mt-2 divide-y divide-border">
        {visible.map(t => (
          <TailRow key={t.id} task={t} today={today} />
        ))}
      </ul>
      {hidden > 0 || bulk ? (
        // Внизу — «Показать ещё»; на телефоне сюда же уходит «Перенести на сегодня», чтобы не теснить заголовок.
        <div className={`mt-1 flex items-center justify-between gap-2 ${hidden > 0 ? '' : 'sm:hidden'}`}>
          {hidden > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => setOpen(o => !o)}
              className="-ml-3"
            >
              {open ? 'Свернуть' : `Показать ещё ${hidden}`}
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={`transition-transform duration-(--duration-base) ${open ? 'rotate-180' : ''}`}
              />
            </Button>
          ) : null}
          {bulk ? (
            <Button variant="secondary" size="sm" onClick={() => void moveAll()} className="sm:hidden">
              Перенести на сегодня
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
