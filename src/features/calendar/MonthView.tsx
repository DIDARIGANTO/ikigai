import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { Announcements, CollisionDetection, DragEndEvent } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import type { Reminder, Task } from '@/lib/types';
import { formatDayRu, formatShortRu, todayISO } from '@/lib/dates';
import {
  WEEKDAYS,
  dateFromDroppableId,
  dayDroppableId,
  dayNum,
  sameMonth,
  startKeyboardMove,
  stepKeyboardMove,
} from './grid';
import type { KeyboardMove } from './grid';
import { DaySheet } from './DaySheet';
import { useMoveTask } from './move';
import { ReminderChip, TaskChipBody, chipTone, taskDot, useMedia } from './parts';

/** Сколько плашек помещается в клетку, прежде чем появится «+N ещё». */
const VISIBLE = 3;
/** Столько цветных точек в клетке телефона. */
const DOTS = 3;

/** Суббота и воскресенье — последние две колонки: им едва заметная подложка. */
const isWeekendColumn = (index: number) => index % 7 >= 5;

const INSTRUCTIONS =
  'Enter — открыть задачу. Пробел — взять и перенести: стрелки выбирают день, пробел или Enter — положить, Esc — отмена.';

const announcements: Announcements = {
  onDragStart: ({ active }) => `Взяли задачу «${active.data.current?.title ?? active.id}»`,
  onDragOver: ({ over }) => {
    const date = over ? dateFromDroppableId(String(over.id)) : null;
    return date ? `Над днём ${formatShortRu(date)}` : undefined;
  },
  onDragEnd: ({ active, over }) => {
    const date = over ? dateFromDroppableId(String(over.id)) : null;
    if (!date || date === active.data.current?.date) return 'Оставлено на месте';
    return `Перенесено на ${formatShortRu(date)}`;
  },
  onDragCancel: () => 'Перенос отменён',
};

/** Клетки месяца велики, поэтому решает курсор; мимо всех клеток — ближайшая. */
const collisionDetection: CollisionDetection = args => {
  const hit = pointerWithin(args);
  return hit.length ? hit : closestCenter(args);
};

/** Задача в клетке месяца: мышью тянется, с клавиатуры — пробел, стрелки, пробел. */
function TaskChip({
  task,
  moving,
  onOpen,
  onKeyDown,
  onBlur,
}: {
  task: Task;
  moving: boolean;
  onOpen: (t: Task) => void;
  onKeyDown: (e: ReactKeyboardEvent, t: Task) => void;
  onBlur: () => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: task.id,
    data: { title: task.title, date: task.date },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-roledescription="задача в календаре"
      aria-describedby="month-drag-hint"
      aria-pressed={moving || undefined}
      onClick={() => onOpen(task)}
      data-focus-key={`cal-${task.id}`}
      onKeyDown={e => onKeyDown(e, task)}
      // Пробел берёт задачу, а не «нажимает» кнопку (иначе по отпусканию откроется редактор).
      onKeyUp={e => e.key === ' ' && e.preventDefault()}
      onBlur={onBlur}
      title={task.title}
      style={{ touchAction: 'none' }}
      className={`focus-ring pointer-events-auto flex h-5.5 w-full min-w-0 cursor-grab items-center gap-1.5 rounded-chip border px-1.5 text-left text-caption active:cursor-grabbing pointer-coarse:h-8 ${chipTone(
        task,
      )} ${isDragging ? 'opacity-30' : ''} ${moving ? 'bg-raised shadow-(--shadow-pop) ring-1 ring-accent' : ''}`}
    >
      <TaskChipBody task={task} />
    </button>
  );
}

function DayCell({
  iso,
  index,
  cursor,
  tasks,
  reminders,
  compact,
  target,
  movingId,
  onOpenTask,
  onPickDay,
  onCreate,
  onMore,
  onChipKey,
  onChipBlur,
}: {
  iso: string;
  index: number;
  cursor: string;
  tasks: Task[];
  reminders: Reminder[];
  compact: boolean;
  /** Сюда сейчас целится перенос с клавиатуры. */
  target: boolean;
  movingId: string | null;
  onOpenTask: (t: Task) => void;
  onPickDay: (iso: string) => void;
  onCreate: (iso: string) => void;
  onMore: (iso: string, anchor: RefObject<HTMLElement | null>) => void;
  onChipKey: (e: ReactKeyboardEvent, t: Task) => void;
  onChipBlur: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayDroppableId(iso) });
  const moreRef = useRef<HTMLButtonElement>(null);
  const cellRef = useRef<HTMLButtonElement>(null);
  const today = iso === todayISO();
  const outside = !sameMonth(iso, cursor);
  const weekend = isWeekendColumn(index);

  const total = tasks.length + reminders.length;
  const room = total > VISIBLE ? VISIBLE - 1 : VISIBLE;
  const shownTasks = tasks.slice(0, room);
  const shownReminders = reminders.slice(0, Math.max(0, room - shownTasks.length));
  const hidden = total - shownTasks.length - shownReminders.length;

  const hot = isOver || target;
  const background = hot ? 'bg-accent-soft' : weekend || outside ? 'bg-canvas' : 'bg-surface';

  // Число дня — моноширинное 12 px; сегодня — в акцентном кружке 24 px.
  const number = (
    <span
      className={`inline-flex size-6 items-center justify-center font-mono text-caption ${
        today ? 'rounded-mark bg-accent text-on-accent' : outside ? 'text-muted' : 'text-text'
      }`}
    >
      {dayNum(iso)}
    </span>
  );

  // Телефон: число, до трёх точек смысла и счётчик, если дел больше; нажатие открывает лист дня.
  if (compact) {
    return (
      <div ref={setNodeRef} className={`relative min-h-16 ${background}`}>
        <button
          ref={cellRef}
          type="button"
          onClick={() => onMore(iso, cellRef)}
          aria-label={`${formatDayRu(iso)}${total ? `, дел: ${total}` : ''}`}
          className="focus-ring-inset flex h-full min-h-16 w-full flex-col items-center gap-1 pt-1.5"
        >
          {number}
          {total ? (
            <span aria-hidden="true" className={`flex items-center gap-0.5 ${outside ? 'opacity-50' : ''}`}>
              {tasks.slice(0, DOTS).map(t => (
                <span key={t.id} className={`size-1.5 rounded-mark ${taskDot(t)}`} />
              ))}
              {reminders.length && tasks.length < DOTS ? <span className="size-1.5 rounded-mark border border-muted" /> : null}
            </span>
          ) : null}
          {total > DOTS ? <span className="font-mono text-micro text-muted">{total}</span> : null}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      data-day={iso}
      data-kbd-target={target || undefined}
      className={`group relative min-h-28 lg:min-h-32 ${background} ${hot ? 'ring-2 ring-inset ring-accent' : ''}`}
    >
      <div className="flex h-full flex-col gap-1 p-1.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPickDay(iso)}
            data-day-focus={hidden > 0 ? undefined : iso}
            aria-label={`Открыть день: ${formatDayRu(iso)}`}
            className={`focus-ring ${today ? 'rounded-mark' : 'rounded-chip hover:bg-fill'}`}
          >
            {number}
          </button>
          <button
            type="button"
            onClick={() => onCreate(iso)}
            aria-label={`Добавить задачу: ${formatDayRu(iso)}`}
            title="Добавить задачу"
            className="focus-ring hover-reveal relative ml-auto inline-flex size-6 items-center justify-center rounded-chip text-muted hover:bg-fill hover:text-text pointer-coarse:before:absolute pointer-coarse:before:-inset-2.5 pointer-coarse:before:content-['']"
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Чужой месяц — приглушённые точки без прозрачности: текст плашек сохраняет контраст. */}
        <div className={`flex min-h-0 flex-col gap-1 ${outside ? 'saturate-50' : ''}`}>
          {shownTasks.map(t => (
            <TaskChip
              key={t.id}
              task={t}
              moving={movingId === t.id}
              onOpen={onOpenTask}
              onKeyDown={onChipKey}
              onBlur={onChipBlur}
            />
          ))}
          {shownReminders.map(r => (
            <ReminderChip key={r.id} reminder={r} />
          ))}
          {hidden > 0 ? (
            <button
              ref={moreRef}
              data-day-focus={iso}
              type="button"
              onClick={() => onMore(iso, moreRef)}
              aria-haspopup="dialog"
              className="focus-ring h-5.5 self-start rounded-chip px-1.5 text-caption text-muted hover:bg-fill hover:text-text pointer-coarse:h-8"
            >
              +{hidden} ещё
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function MonthView({
  cursor,
  tasksFor,
  remindersFor,
  days,
  onOpenTask,
  onPickDay,
  onCreate,
}: {
  cursor: string;
  days: string[];
  tasksFor: (iso: string) => Task[];
  remindersFor: (iso: string) => Reminder[];
  onOpenTask: (t: Task) => void;
  onPickDay: (iso: string) => void;
  onCreate: (iso: string) => void;
}) {
  const move = useMoveTask();
  const compact = useMedia('(max-width: 639px)');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [kbd, setKbd] = useState<KeyboardMove | null>(null);
  const [live, setLive] = useState('');
  const [sheet, setSheet] = useState<{ date: string; anchor: RefObject<HTMLElement | null> } | null>(null);

  const sensors = useSensors(
    // Небольшой порог: короткий клик по задаче открывает её, а не начинает перенос.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const allTasks = useMemo(() => days.flatMap(d => tasksFor(d)), [days, tasksFor]);

  // После переноса с клавиатуры плашка переезжает в другую клетку. Как только данные обновились,
  // возвращаем на неё фокус, а если в клетке она ушла под «+N ещё» — на этот «+N» (или на число дня).
  const refocus = useRef<{ taskId: string; date: string } | null>(null);
  useEffect(() => {
    const r = refocus.current;
    if (!r || !tasksFor(r.date).some(t => t.id === r.taskId)) return;
    refocus.current = null;
    (
      document.querySelector<HTMLElement>(`[data-focus-key="cal-${r.taskId}"]`) ??
      document.querySelector<HTMLElement>(`[data-day-focus="${r.date}"]`)
    )?.focus();
  }, [allTasks, tasksFor]);
  const activeTask = activeId ? allTasks.find(t => t.id === activeId) : undefined;

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const date = e.over ? dateFromDroppableId(String(e.over.id)) : null;
    const task = allTasks.find(t => t.id === String(e.active.id));
    if (!date || !task || task.date === date) return;
    void move(task, { date });
  };

  /* Перенос с клавиатуры: пробел — взять, стрелки — день, пробел/Enter — положить, Esc — отмена. */
  const onChipKey = (e: ReactKeyboardEvent, task: Task) => {
    const own = kbd?.taskId === task.id ? kbd : null;
    if (!own) {
      if (e.key !== ' ') return;
      e.preventDefault();
      const m = startKeyboardMove(task, cursor);
      setKbd(m);
      setLive(`Взяли «${task.title}», ${formatDayRu(m.target)}. Стрелки — выбрать день, пробел — положить.`);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setKbd(null);
      setLive('Перенос отменён');
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setKbd(null);
      if (own.target === own.origin) {
        setLive('Оставлено на месте');
        return;
      }
      void move(task, { date: own.target }).then(text => {
        if (text) setLive(text);
        // Плашка переехала в другую клетку — возвращаем на неё фокус.
        refocus.current = { taskId: task.id, date: own.target };
      });
      return;
    }
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const next = stepKeyboardMove(own, e.key, days);
      setKbd(next);
      setLive(next.target === own.target ? 'Дальше край сетки' : formatDayRu(next.target));
    }
  };

  const onChipBlur = () => {
    if (!kbd) return;
    setKbd(null);
    setLive('Перенос отменён');
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      accessibility={{ announcements, screenReaderInstructions: { draggable: INSTRUCTIONS } }}
      onDragStart={e => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <section aria-label="Месяц" className="animate-in overflow-hidden rounded-card border border-border bg-surface shadow-(--shadow-raised)">
        <p id="month-drag-hint" className="sr-only">
          {INSTRUCTIONS}
        </p>
        <p aria-live="assertive" className="sr-only">
          {live}
        </p>
        <div className="grid grid-cols-7 border-b border-border/70">
          {WEEKDAYS.map((w, i) => (
            <span
              key={w}
              className={`flex h-8 items-center justify-center text-caption text-muted sm:justify-start sm:px-3 ${
                isWeekendColumn(i) ? 'bg-canvas' : ''
              }`}
            >
              {w}
            </span>
          ))}
        </div>

        {/* Разлиновка — просветы сетки: линии в волос толщиной, без двойных рамок. */}
        <div className="grid grid-cols-7 gap-px bg-border/70">
          {days.map((iso, i) => (
            <DayCell
              key={iso}
              iso={iso}
              index={i}
              cursor={cursor}
              tasks={tasksFor(iso)}
              reminders={remindersFor(iso)}
              compact={compact}
              target={kbd?.target === iso}
              movingId={kbd?.taskId ?? null}
              onOpenTask={onOpenTask}
              onPickDay={onPickDay}
              onCreate={onCreate}
              onMore={(date, anchor) => setSheet({ date, anchor })}
              onChipKey={onChipKey}
              onChipBlur={onChipBlur}
            />
          ))}
        </div>
      </section>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div
            className={`flex h-5.5 max-w-48 cursor-grabbing items-center gap-1.5 rounded-chip border bg-raised px-1.5 text-caption shadow-(--shadow-pop) ${chipTone(activeTask)}`}
          >
            <TaskChipBody task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>

      {sheet ? (
        <DaySheet
          mode={compact ? 'sheet' : 'popover'}
          anchor={sheet.anchor}
          date={sheet.date}
          tasks={tasksFor(sheet.date)}
          reminders={remindersFor(sheet.date)}
          onClose={() => setSheet(null)}
          onOpenTask={t => {
            setSheet(null);
            onOpenTask(t);
          }}
          onCreate={d => {
            setSheet(null);
            onCreate(d);
          }}
          onOpenDay={d => {
            setSheet(null);
            onPickDay(d);
          }}
        />
      ) : null}
    </DndContext>
  );
}
