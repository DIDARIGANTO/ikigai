import { useEffect, useId, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Plus, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Reminder, Task } from '@/lib/types';
import { Button, IconButton } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Popover } from '@/components/ui/Popover';
import { BACKDROP } from '@/components/ui/Modal';
import { useFocusTrap, useOverlay } from '@/components/ui/overlay';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import { planSummary, summaryLine } from './grid';
import { ReminderIcon, isClosed, taskDot } from './parts';

export interface DaySheetProps {
  date: string;
  tasks: Task[];
  reminders: Reminder[];
  onClose: () => void;
  onOpenTask: (t: Task) => void;
  onCreate: (date: string) => void;
  onOpenDay: (date: string) => void;
}

/** Строка задачи в листе дня: отметка, точка смысла, время моноширинным, эмодзи и название; клик открывает задачу. */
function TaskLine({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const { toggleDone } = useTaskActionsCtx();
  const done = task.status === 'done';
  const closed = isClosed(task);
  return (
    <li className="flex min-h-9 items-center gap-3 rounded-control px-2 hover:bg-fill pointer-coarse:min-h-11">
      <Checkbox
        checked={done}
        tone={task.area === 'personal' ? 'personal' : 'accent'}
        onChange={() => void toggleDone(task)}
        aria-label={done ? `Вернуть в работу: ${task.title}` : `Отметить готово: ${task.title}`}
      />
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1.5 text-left text-small"
      >
        <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-mark ${taskDot(task)}`} />
        {task.plannedStart ? <span className="shrink-0 font-mono text-caption text-muted">{task.plannedStart}</span> : null}
        <span className={`min-w-0 truncate ${closed ? 'text-muted line-through decoration-muted/60' : 'text-text'}`}>
          {task.emoji ? <span className="font-emoji mr-1.5 no-underline">{task.emoji}</span> : null}
          {task.title}
        </span>
      </button>
    </li>
  );
}

/** Содержимое листа дня — одно и то же в всплывающем окне (компьютер) и в листе снизу (телефон). */
function DayContent({
  date,
  tasks,
  reminders,
  titleId,
  onClose,
  onOpenTask,
  onCreate,
  onOpenDay,
  sheet,
}: DaySheetProps & { titleId: string; sheet: boolean }) {
  const d = parseISO(date);
  const summary = summaryLine(planSummary(tasks));
  const empty = !tasks.length && !reminders.length;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption text-muted first-letter:uppercase">{format(d, 'EEEE', { locale: ru })}</p>
          <h2 id={titleId} className={`font-semibold text-text ${sheet ? 'text-h2' : 'text-title'}`}>
            {format(d, 'd MMMM', { locale: ru })}
          </h2>
          <p className="mt-0.5 font-mono text-caption text-muted">{summary}</p>
        </div>
        <IconButton size="sm" aria-label="Закрыть" onClick={onClose} className="-mr-1 -mt-1">
          <X size={16} aria-hidden="true" />
        </IconButton>
      </div>

      {empty ? (
        <p className="py-4 text-small text-muted">На этот день ничего нет.</p>
      ) : (
        <div className="-mx-2 mt-2 max-h-[min(22rem,50dvh)] overflow-y-auto scroll-thin">
          {tasks.length ? (
            <ul aria-label="Задачи">
              {tasks.map(t => (
                <TaskLine key={t.id} task={t} onOpen={onOpenTask} />
              ))}
            </ul>
          ) : null}
          {reminders.length ? (
            <ul aria-label="Напоминания" className={tasks.length ? 'mt-1 border-t border-border pt-1' : ''}>
              {reminders.map(r => (
                <li key={r.id} className="flex min-h-9 items-center gap-3 px-2 text-small pointer-coarse:min-h-11">
                  <ReminderIcon reminder={r} size={16} className="text-muted" />
                  {r.time ? <span className="shrink-0 font-mono text-caption text-muted">{r.time}</span> : null}
                  <span className="min-w-0 truncate text-muted-strong">{r.text}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <Button variant="tonal" size={sheet ? 'md' : 'sm'} onClick={() => onCreate(date)}>
          <Plus size={16} aria-hidden="true" />
          Задача
        </Button>
        <Button variant="ghost" size={sheet ? 'md' : 'sm'} onClick={() => onOpenDay(date)}>
          Открыть день
          <ArrowRight size={16} aria-hidden="true" />
        </Button>
      </div>
    </>
  );
}

/** Лист снизу для телефона: портал, фон, фокус внутри, отступ под «чёлку» снизу. */
function BottomSheet({ onClose, labelledBy, children }: { onClose: () => void; labelledBy: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlay(true, onClose);
  useFocusTrap(ref, true);
  return createPortal(
    <div
      data-overlay="backdrop"
      className={`${BACKDROP} flex items-end justify-center`}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        data-overlay="dialog"
        className="relative w-full max-w-lg rounded-t-sheet bg-overlay px-5 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-(--shadow-overlay) focus:outline-none"
      >
        <span aria-hidden="true" className="absolute left-1/2 top-2 h-1 w-9 -translate-x-1/2 rounded-bar bg-fill-strong" />
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Всё про один день: на компьютере — всплывающее окно у «+N ещё», на телефоне — лист снизу.
 * Внутри — задачи с отметкой, напоминания и «+ Задача».
 */
export function DaySheet({
  anchor,
  mode,
  ...props
}: DaySheetProps & { anchor?: RefObject<HTMLElement | null>; mode: 'popover' | 'sheet' }) {
  const titleId = useId();
  const popover = mode === 'popover' && !!anchor;
  // Во всплывающем окне своей ловушки фокуса нет — переводим фокус внутрь сами (Esc вернёт его на «+N ещё»).
  useEffect(() => {
    if (!popover) return;
    const frame = requestAnimationFrame(() => {
      const root = document.getElementById(titleId)?.closest<HTMLElement>('[data-overlay="popover"]');
      root?.querySelector<HTMLElement>('button:not([aria-label="Закрыть"]), input')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [popover, titleId]);
  if (!popover) {
    return (
      <BottomSheet onClose={props.onClose} labelledBy={titleId}>
        <DayContent {...props} titleId={titleId} sheet />
      </BottomSheet>
    );
  }
  return (
    <Popover anchor={anchor} open onClose={props.onClose} align="start" role="dialog" label="День" className="w-80 p-3">
      <DayContent {...props} titleId={titleId} sheet={false} />
    </Popover>
  );
}
