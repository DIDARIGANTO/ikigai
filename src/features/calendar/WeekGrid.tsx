import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Dumbbell, Flag, Plus, Target as TargetIcon } from 'lucide-react';
import type { Goal, Reminder, Task } from '@/lib/types';
import { formatDayRu, minutesToTime, todayISO } from '@/lib/dates';
import { isRunning } from '@/lib/domain/tasks';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import {
  DAY_END,
  DAY_START,
  DEFAULT_DURATION,
  GRID_END_HOUR,
  GRID_PX,
  GRID_START_HOUR,
  HOUR_PX,
  MIN_DURATION,
  clampDuration,
  columnAt,
  factSpan,
  initialScrollMinute,
  layoutLanes,
  minutesToPx,
  nudgeSlot,
  planSpan,
  pxToMinutes,
  slotAt,
  snapMinutes,
} from './grid';
import type { Slot } from './grid';
import { useMoveTask } from './move';
import { ReminderChip, TaskChipBody, chipTone, isClosed, taskDot, useMedia, useNowMinutes } from './parts';

/** Колонка со шкалой часов. */
const GUTTER = 52;
/** Воздух над 06:00 и под 24:00, чтобы подписи не липли к краю. */
const PAD = 10;
const LANE_ROWS = 3;
/** Порог, после которого нажатие мышью становится переносом, а не кликом. */
const DRAG_PX = 4;
/** Долгое нажатие пальцем, после которого блок «берётся». */
const LONG_PRESS_MS = 320;
/** Через сколько после последней стрелки перенос с клавиатуры сохраняется сам. */
const KBD_COMMIT_MS = 1200;

const HOURS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => GRID_START_HOUR + i);
const y = (min: number) => PAD + minutesToPx(min);

/** «Пн», «Вт»… — с заглавной, без капса. */
const dayShort = (iso: string) => {
  const s = format(parseISO(iso), 'EEEEEE', { locale: ru });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const isWeekend = (iso: string) => [0, 6].includes(parseISO(iso).getDay());

function slotOf(task: Task): Slot {
  const span = planSpan(task);
  return {
    date: task.date ?? '',
    start: span ? span.start : null,
    duration: span ? span.end - span.start : task.plannedMinutes || DEFAULT_DURATION,
  };
}

const sameSlot = (a: Slot, b: Slot) => a.date === b.date && a.start === b.start && a.duration === b.duration;

function describeSlot(s: Slot): string {
  const day = formatDayRu(s.date);
  if (s.start === null) return `${day}, без времени`;
  return `${day}, ${minutesToTime(s.start)}–${minutesToTime(s.start + s.duration)}`;
}

interface Gesture {
  taskId: string;
  mode: 'move' | 'resize';
  origin: Slot;
  grabMin: number;
  x0: number;
  y0: number;
  touch: boolean;
  started: boolean;
  timer?: number;
  slot: Slot;
  lastX: number;
  lastY: number;
}

export function WeekGrid({
  days,
  tasksFor,
  remindersFor,
  onOpenTask,
  onCreate,
  onOpenDay,
}: {
  days: string[];
  tasksFor: (iso: string) => Task[];
  remindersFor: (iso: string) => Reminder[];
  onOpenTask: (t: Task) => void;
  onCreate: (defaults: Partial<Task>) => void;
  onOpenDay: (iso: string) => void;
}) {
  const { goals } = useTaskActionsCtx();
  const move = useMoveTask();
  const scroller = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const lane = useRef<HTMLDivElement>(null);

  // На сенсорных экранах плашки дорожки выше: в них должен попадать палец.
  const coarse = useMedia('(pointer: coarse)');
  const LANE_ROW = coarse ? 36 : 26;
  const [width, setWidth] = useState(0);
  const narrow = width > 0 && width < 640;
  const colW = width ? Math.max(0, (width - GUTTER) / (narrow ? 3 : 7)) : 0;

  const [drag, setDrag] = useState<{ taskId: string; slot: Slot } | null>(null);
  const [kbd, setKbd] = useState<{ taskId: string; origin: Slot; slot: Slot } | null>(null);
  const [hover, setHover] = useState<{ day: number; min: number } | null>(null);
  const [live, setLive] = useState('');

  const today = todayISO();
  const todayIdx = days.indexOf(today);
  const now = useNowMinutes(todayIdx >= 0);
  const goalById = useMemo(() => new Map<string, Goal>(goals.map(g => [g.id, g])), [goals]);

  // Задачи недели и их текущие слоты (с учётом того, что сейчас тащат).
  const weekTasks = useMemo(() => days.flatMap(d => tasksFor(d)), [days, tasksFor]);
  const effective = useMemo(
    () =>
      weekTasks.map(task => {
        const draft = drag?.taskId === task.id ? drag.slot : kbd?.taskId === task.id ? kbd.slot : null;
        return { task, slot: draft ?? slotOf(task), moving: !!draft };
      }),
    [weekTasks, drag, kbd],
  );

  const blocks = useMemo(() => {
    const out: (ReturnType<typeof layoutLanes<(typeof effective)[number]>>[number] & { day: number })[] = [];
    days.forEach((iso, day) => {
      const items = effective
        .filter(e => e.slot.date === iso && e.slot.start !== null)
        .map(e => ({ item: e, start: e.slot.start as number, end: (e.slot.start as number) + e.slot.duration }));
      for (const b of layoutLanes(items, narrow ? 2 : 3)) out.push({ ...b, day });
    });
    return out;
  }, [days, effective, narrow]);

  const laneItems = useMemo(
    () =>
      days.map(iso => ({
        tasks: effective.filter(e => e.slot.date === iso && e.slot.start === null),
        reminders: remindersFor(iso),
      })),
    [days, effective, remindersFor],
  );
  const laneRows = Math.max(1, Math.min(LANE_ROWS, Math.max(0, ...laneItems.map(l => l.tasks.length + l.reminders.length))));

  // Ширина сетки: от неё зависит, сколько дней видно (7 или 3 на телефоне).
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Первая прокрутка недели: к «сейчас» на текущей неделе, иначе к 07:00 или к первому делу.
  const scrolledFor = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !colW) return;
    const key = `${days[0]}:${narrow}`;
    if (scrolledFor.current === key) return;
    scrolledFor.current = key;
    const starts = blocks.map(b => b.start);
    const visible = ((el.clientHeight - (lane.current?.getBoundingClientRect().bottom ?? 0) + el.getBoundingClientRect().top) / HOUR_PX) * 60;
    el.scrollTop = Math.max(0, y(initialScrollMinute(starts, todayIdx >= 0 ? now : null, visible)) - PAD);
    if (narrow) el.scrollLeft = Math.min(Math.max(0, todayIdx), days.length - 3) * colW;
    else el.scrollLeft = 0;
  }, [days, colW, narrow, blocks, todayIdx, now]);

  const announce = (text: string) => setLive(text);

  /* ─────────── перенос мышью и пальцем ─────────── */

  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const raf = useRef<number | null>(null);
  // Свежие значения для обработчиков окна: сами обработчики стабильны и видят их через ref.
  const latest = useRef({ weekTasks, days, colW, move });
  useLayoutEffect(() => {
    latest.current = { weekTasks, days, colW, move };
  });

  const slotFromPoint = (g: Gesture, cx: number, cy: number): Slot => {
    const r = body.current?.getBoundingClientRect();
    if (!r) return g.slot;
    const { colW: colWidth, days: ds } = latest.current;
    const m = { left: r.left + GUTTER, top: r.top + PAD, colWidth, days: ds };
    if (g.mode === 'resize' && g.origin.start !== null) {
      const end = snapMinutes(pxToMinutes(cy - m.top));
      return { ...g.origin, duration: clampDuration(g.origin.start, Math.max(MIN_DURATION, end - g.origin.start)) };
    }
    const laneBottom = lane.current?.getBoundingClientRect().bottom ?? -Infinity;
    if (cy < laneBottom) return { ...g.origin, date: m.days[columnAt(cx, m)], start: null };
    const s = slotAt(cx, cy, m, g.origin.duration, g.grabMin);
    return { ...g.origin, date: s.date, start: s.start };
  };

  // Обработчики жеста создаются один раз: их можно снять с window тем же объектом.
  const [gestureApi] = useState(() => {
    const update = (g: Gesture) => {
      const slot = slotFromPoint(g, g.lastX, g.lastY);
      if (sameSlot(slot, g.slot)) return;
      g.slot = slot;
      setDrag({ taskId: g.taskId, slot });
    };

    // Автопрокрутка у краёв, пока блок держат: иначе вечер не достать, не отпуская блок.
    const autoScroll = () => {
      raf.current = null;
      const g = gesture.current;
      const el = scroller.current;
      if (!g?.started || !el) return;
      const r = el.getBoundingClientRect();
      const top = lane.current?.getBoundingClientRect().bottom ?? r.top;
      const zone = 36;
      let dy = 0;
      let dx = 0;
      if (g.lastY < top + zone && g.lastY > top - zone) dy = -10;
      else if (g.lastY > r.bottom - zone) dy = 10;
      if (g.lastX < r.left + GUTTER + zone / 2) dx = -8;
      else if (g.lastX > r.right - zone / 2) dx = 8;
      if (!dx && !dy) return;
      el.scrollTop += dy;
      el.scrollLeft += dx;
      update(g);
      raf.current = requestAnimationFrame(autoScroll);
    };

    const finish = () => {
      const g = gesture.current;
      gesture.current = null;
      if (g?.timer) window.clearTimeout(g.timer);
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = null;
      window.removeEventListener('pointermove', api.move);
      window.removeEventListener('pointerup', api.up);
      window.removeEventListener('pointercancel', api.cancel);
      document.removeEventListener('touchmove', api.touchmove);
      if (scroller.current) scroller.current.style.scrollSnapType = '';
      return g;
    };

    const begin = (g: Gesture) => {
      g.started = true;
      suppressClick.current = true;
      setHover(null);
      // Пока тащим, снап колонок мешал бы автопрокрутке.
      if (scroller.current) scroller.current.style.scrollSnapType = 'none';
      if (g.touch) navigator.vibrate?.(8);
      setDrag({ taskId: g.taskId, slot: g.slot });
    };

    const api: {
      move: (e: PointerEvent) => void;
      up: () => void;
      cancel: () => void;
      touchmove: (e: TouchEvent) => void;
      begin: (g: Gesture) => void;
    } = {
      begin,
      touchmove: e => {
        if (gesture.current?.started) e.preventDefault();
      },
      move: e => {
        const g = gesture.current;
        if (!g) return;
        g.lastX = e.clientX;
        g.lastY = e.clientY;
        if (!g.started) {
          const dist = Math.hypot(e.clientX - g.x0, e.clientY - g.y0);
          // Палец сдвинулся раньше долгого нажатия — это прокрутка, а не перенос.
          if (g.touch) {
            if (dist > 8) finish();
            return;
          }
          if (dist < DRAG_PX) return;
          begin(g);
        }
        update(g);
        if (!raf.current) raf.current = requestAnimationFrame(autoScroll);
      },
      up: () => {
        const g = finish();
        if (!g?.started) return;
        // Клик после переноса может достаться другому элементу — снимаем запрет, когда он пройдёт.
        window.setTimeout(() => (suppressClick.current = false), 0);
        const task = latest.current.weekTasks.find(t => t.id === g.taskId);
        if (!task || sameSlot(g.slot, g.origin)) {
          setDrag(null);
          return;
        }
        const target =
          g.mode === 'resize' ? { date: g.slot.date, duration: g.slot.duration } : { date: g.slot.date, start: g.slot.start };
        void latest.current.move(task, target).then(text => {
          if (text) setLive(text);
          requestAnimationFrame(() => setDrag(null));
        });
      },
      cancel: () => {
        finish();
        setDrag(null);
      },
    };
    return api;
  });

  useEffect(() => () => gestureApi.cancel(), [gestureApi]);

  const onPointerDown = (e: ReactPointerEvent, task: Task, mode: 'move' | 'resize') => {
    const api = gestureApi;
    if (e.button !== 0 || gesture.current) return;
    if (mode === 'resize') e.stopPropagation();
    const origin = slotOf(task);
    const r = body.current?.getBoundingClientRect();
    const grabMin =
      origin.start !== null && r ? Math.max(0, Math.min(origin.duration, pxToMinutes(e.clientY - r.top - PAD) - origin.start)) : 0;
    const g: Gesture = {
      taskId: task.id,
      mode,
      origin,
      grabMin: snapMinutes(grabMin),
      x0: e.clientX,
      y0: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      touch: e.pointerType === 'touch',
      started: false,
      slot: origin,
    };
    gesture.current = g;
    suppressClick.current = false;
    if (g.touch) {
      document.addEventListener('touchmove', api.touchmove, { passive: false });
      // Ручка длительности берётся сразу, сам блок — долгим нажатием (иначе сетку не прокрутить).
      if (mode === 'resize') api.begin(g);
      else g.timer = window.setTimeout(() => gesture.current === g && api.begin(g), LONG_PRESS_MS);
    }
    window.addEventListener('pointermove', api.move);
    window.addEventListener('pointerup', api.up);
    window.addEventListener('pointercancel', api.cancel);
  };

  const onContextMenu = (e: React.MouseEvent) => {
    if (gesture.current?.touch) e.preventDefault();
  };

  const onBlockClick = (task: Task) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (kbd?.taskId === task.id) return;
    onOpenTask(task);
  };

  /* ─────────── клавиатура ─────────── */

  const kbdRef = useRef(kbd);
  useLayoutEffect(() => {
    kbdRef.current = kbd;
  });
  const kbdTimer = useRef<number | undefined>(undefined);

  const commitKbd = useCallback(() => {
    window.clearTimeout(kbdTimer.current);
    const k = kbdRef.current;
    if (!k) return;
    const task = latest.current.weekTasks.find(t => t.id === k.taskId);
    if (!task || sameSlot(k.slot, k.origin)) {
      setKbd(null);
      return;
    }
    const target: { date: string; start?: number | null; duration?: number } = { date: k.slot.date };
    if (k.slot.start !== k.origin.start) target.start = k.slot.start;
    if (k.slot.duration !== k.origin.duration) target.duration = k.slot.duration;
    void latest.current.move(task, target).then(text => {
      if (text) setLive(text);
      requestAnimationFrame(() => setKbd(cur => (cur?.taskId === k.taskId ? null : cur)));
    });
  }, []);

  useEffect(() => () => window.clearTimeout(kbdTimer.current), []);

  const onBlockKey = (e: ReactKeyboardEvent, task: Task) => {
    const own = kbd?.taskId === task.id ? kbd : null;
    if (e.key === 'Escape' && own) {
      e.preventDefault();
      e.stopPropagation();
      window.clearTimeout(kbdTimer.current);
      setKbd(null);
      announce('Перенос отменён');
      return;
    }
    if (e.key === 'Enter' && own) {
      e.preventDefault();
      commitKbd();
      return;
    }
    const base = own?.slot ?? slotOf(task);
    const next = nudgeSlot(base, e.key, { shift: e.shiftKey, alt: e.altKey });
    if (!next) return;
    e.preventDefault();
    if (!days.includes(next.date)) {
      announce('Дальше край недели');
      return;
    }
    if (kbd && kbd.taskId !== task.id) commitKbd();
    setKbd({ taskId: task.id, origin: own?.origin ?? slotOf(task), slot: next });
    announce(describeSlot(next));
    window.clearTimeout(kbdTimer.current);
    kbdTimer.current = window.setTimeout(commitKbd, KBD_COMMIT_MS);
  };

  /* ─────────── пустое место: «+» на получасе ─────────── */

  const pointToHover = (e: ReactPointerEvent | React.MouseEvent) => {
    const r = body.current?.getBoundingClientRect();
    if (!r || !colW) return null;
    const day = columnAt(e.clientX, { left: r.left + GUTTER, colWidth: colW, days });
    const min = Math.floor(pxToMinutes(e.clientY - r.top - PAD) / 30) * 30;
    if (min < DAY_START || min >= DAY_END) return null;
    return { day, min };
  };

  const onGridMove = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse' || gesture.current?.started) return;
    if ((e.target as HTMLElement).closest('[data-block]')) {
      if (hover) setHover(null);
      return;
    }
    const h = pointToHover(e);
    if (h?.day !== hover?.day || h?.min !== hover?.min) setHover(h);
  };

  const onGridClick = (e: React.MouseEvent) => {
    // Клик, которым закончился перенос, — не просьба создать задачу.
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if ((e.target as HTMLElement).closest('[data-block]')) return;
    const h = pointToHover(e);
    if (!h) return;
    onCreate({ date: days[h.day], plannedStart: minutesToTime(h.min) });
  };

  /* ─────────── разметка ─────────── */

  const contentW = GUTTER + colW * days.length;
  const colLeft = (i: number) => i * colW;
  const showNow = todayIdx >= 0 && now >= DAY_START && now <= DAY_END;

  return (
    <section aria-label="Неделя по часам" className="animate-in relative overflow-hidden rounded-card border border-border bg-surface shadow-(--shadow-raised)">
      <p aria-live="polite" className="sr-only">
        {live}
      </p>
      <p id="week-block-hint" className="sr-only">
        Enter — открыть. Стрелки вверх и вниз — сдвиг на 15 минут, влево и вправо — на день, Shift со стрелками — длительность.
        Сохраняется само, Esc — отменить.
      </p>
      <div
        ref={scroller}
        className="relative h-[calc(100dvh-17rem)] min-h-96 overflow-auto overscroll-contain scroll-thin md:h-[calc(100dvh-12.5rem)]"
        style={{ scrollSnapType: narrow ? 'x mandatory' : undefined, scrollPaddingLeft: GUTTER }}
      >
        <div className="relative" style={{ width: contentW || '100%' }}>
          {/* Шапка: дни и дорожка «без времени» — прилипают сверху. */}
          <div className="sticky top-0 z-30 border-b border-border bg-surface">
            <div className="flex">
              <div className="sticky left-0 z-10 shrink-0 bg-surface" style={{ width: GUTTER }} />
              {days.map(iso => {
                const isToday = iso === today;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => onOpenDay(iso)}
                    aria-label={`Открыть день: ${formatDayRu(iso)}`}
                    className={`focus-ring-inset flex h-11 shrink-0 items-center justify-center gap-1.5 hover:bg-fill ${
                      isWeekend(iso) ? 'bg-fill/50' : ''
                    }`}
                    style={{ width: colW, scrollSnapAlign: 'start' }}
                  >
                    <span className="text-caption text-muted">{dayShort(iso)}</span>
                    {/* Сегодня — число в акцентном кружке 24 px; остальные — просто моноширинное число. */}
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center font-mono text-h2 ${
                        isToday ? 'rounded-mark bg-accent text-on-accent' : 'text-text'
                      }`}
                    >
                      {format(parseISO(iso), 'd')}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Дорожка «без времени»: задачи на день и напоминания. */}
            <div className="flex">
              <div
                className="sticky left-0 z-10 flex shrink-0 items-start justify-end bg-surface pr-2 pt-1 text-right text-micro leading-3.5 text-muted"
                style={{ width: GUTTER }}
              >
                весь
                <br />
                день
              </div>
              <div ref={lane} className="relative" style={{ width: colW * days.length, height: laneRows * LANE_ROW + 6 }}>
                {days.map((iso, i) => {
                  const l = laneItems[i];
                  return (
                    <div
                      key={iso}
                      // Пустое место дорожки — быстрый способ добавить задачу на день (на телефоне «+» не нужен).
                      onClick={e => e.target === e.currentTarget && onCreate({ date: iso })}
                      className={`group absolute inset-y-0 border-l border-border/70 ${isWeekend(iso) ? 'bg-fill/50' : ''} ${
                        drag && drag.slot.date === iso && drag.slot.start === null ? 'bg-accent-soft' : ''
                      }`}
                      style={{ left: colLeft(i), width: colW }}
                    >
                      <button
                        type="button"
                        onClick={() => onCreate({ date: iso })}
                        aria-label={`Добавить задачу без времени: ${formatDayRu(iso)}`}
                        title="Задача на день"
                        className={`focus-ring hover-reveal absolute bottom-1 right-1 inline-flex size-6 items-center justify-center rounded-chip text-muted hover:bg-fill hover:text-text pointer-coarse:hidden ${
                          l.tasks.length + l.reminders.length >= laneRows ? 'hidden' : ''
                        }`}
                      >
                        <Plus size={14} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}

                {days.map((iso, i) => {
                  const l = laneItems[i];
                  const total = l.tasks.length + l.reminders.length;
                  const overflow = total > laneRows;
                  const room = overflow ? laneRows - 1 : laneRows;
                  const tasksShown = l.tasks.slice(0, room);
                  const remShown = l.reminders.slice(0, Math.max(0, room - tasksShown.length));
                  const pos = (row: number) => ({ left: colLeft(i) + 3, width: colW - 6, top: 4 + row * LANE_ROW });
                  return [
                    ...tasksShown.map((e, row) => (
                      <button
                        key={e.task.id}
                        type="button"
                        data-block
                        data-focus-key={`cal-${e.task.id}`}
                        aria-describedby="week-block-hint"
                        aria-roledescription="задача на день"
                        onClick={() => onBlockClick(e.task)}
                        onKeyDown={ev => onBlockKey(ev, e.task)}
                        onBlur={() => kbd?.taskId === e.task.id && commitKbd()}
                        onPointerDown={ev => onPointerDown(ev, e.task, 'move')}
                        onContextMenu={onContextMenu}
                        title={e.task.title}
                        className={`focus-ring absolute flex h-5.5 min-w-0 cursor-grab pointer-coarse:h-8 select-none items-center gap-1.5 rounded-chip border px-1.5 text-left text-caption active:cursor-grabbing ${chipTone(
                          e.task,
                        )} ${e.moving ? 'z-20 bg-raised shadow-(--shadow-pop) ring-1 ring-accent' : ''}`}
                        style={{ ...pos(row), WebkitTouchCallout: 'none' }}
                      >
                        <TaskChipBody task={e.task} />
                      </button>
                    )),
                    ...remShown.map((r, k) => (
                      <div key={`r-${r.id}`} className="absolute" style={pos(tasksShown.length + k)}>
                        <ReminderChip reminder={r} className="pointer-coarse:h-8" />
                      </div>
                    )),
                    overflow ? (
                      <button
                        key={`more-${iso}`}
                        type="button"
                        onClick={() => onOpenDay(iso)}
                        className="focus-ring absolute h-5.5 rounded-chip px-1.5 text-left text-caption text-muted pointer-coarse:h-8 hover:bg-fill hover:text-text"
                        style={pos(laneRows - 1)}
                      >
                        +{total - room} ещё
                      </button>
                    ) : null,
                  ];
                })}
              </div>
            </div>
          </div>

          {/* Сетка часов. */}
          <div ref={body} className="relative flex" style={{ height: GRID_PX + PAD * 2 }}>
            <div aria-hidden="true" className="sticky left-0 z-20 shrink-0 bg-surface" style={{ width: GUTTER }}>
              {HOURS.map(h => {
                const nearNow = showNow && Math.abs(now - h * 60) < 16;
                return (
                  <span
                    key={h}
                    className={`absolute right-2 font-mono text-micro text-muted ${nearNow ? 'opacity-0' : ''}`}
                    style={{ top: y(h * 60) - 7 }}
                  >
                    {minutesToTime(h * 60 === 1440 ? 1440 : h * 60).replace('24:00', '00:00')}
                  </span>
                );
              })}
              {showNow ? (
                <span
                  className="absolute right-0.5 inline-flex h-5 items-center rounded-chip border border-border bg-surface px-1 font-mono text-micro text-accent-strong"
                  style={{ top: y(now) - 10 }}
                >
                  {minutesToTime(now)}
                </span>
              ) : null}
            </div>

            <div
              className="relative shrink-0"
              style={{ width: colW * days.length }}
              onPointerMove={onGridMove}
              onPointerLeave={() => setHover(null)}
              onClick={onGridClick}
            >
              {/* Колонки дней: линии в волос, выходные — едва заметная подложка (≤ 3 %). */}
              {days.map((iso, i) => (
                <div
                  key={iso}
                  aria-hidden="true"
                  className={`absolute inset-y-0 border-l border-border/70 ${isWeekend(iso) ? 'bg-fill/50' : ''}`}
                  style={{ left: colLeft(i), width: colW }}
                />
              ))}
              {HOURS.map(h => (
                <div
                  key={h}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 border-t border-border/70"
                  style={{ top: y(h * 60) }}
                />
              ))}

              {hover && !drag ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute flex items-center gap-1 rounded-chip bg-fill px-1.5 text-micro text-muted"
                  style={{ left: colLeft(hover.day) + 3, width: colW - 6, top: y(hover.min) + 2, height: (30 / 60) * HOUR_PX - 4 }}
                >
                  <Plus size={12} aria-hidden="true" />
                  <span className="font-mono">{minutesToTime(hover.min)}</span>
                </div>
              ) : null}

              {/* Откуда взяли блок — пунктирная тень на старом месте. */}
              {drag
                ? (() => {
                    const e = effective.find(x => x.task.id === drag.taskId);
                    const o = e ? slotOf(e.task) : null;
                    const di = o ? days.indexOf(o.date) : -1;
                    if (!o || o.start === null || di < 0) return null;
                    return (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute rounded-control border border-dashed border-border-strong"
                        style={{ left: colLeft(di) + 3, width: colW - 6, top: y(o.start) + 1, height: (o.duration / 60) * HOUR_PX - 2 }}
                      />
                    );
                  })()
                : null}

              {blocks.map(b => (
                <Block
                  key={b.item.task.id}
                  task={b.item.task}
                  slot={b.item.slot}
                  moving={b.item.moving}
                  goal={b.item.task.goalId ? goalById.get(b.item.task.goalId) : undefined}
                  left={colLeft(b.day) + 3 + (b.lane * (colW - 6)) / b.lanes}
                  width={(colW - 6) / b.lanes - (b.lanes > 1 ? 2 : 0)}
                  now={now}
                  onClick={() => onBlockClick(b.item.task)}
                  onKeyDown={ev => onBlockKey(ev, b.item.task)}
                  onBlur={() => kbd?.taskId === b.item.task.id && commitKbd()}
                  onPointerDown={(ev, mode) => onPointerDown(ev, b.item.task, mode)}
                  onContextMenu={onContextMenu}
                />
              ))}

              {/* «Сейчас»: линия 1 px под блоками — едва заметная через всю неделю, акцентная в колонке сегодня. */}
              {showNow ? (
                <>
                  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 h-px bg-accent/30" style={{ top: y(now) }} />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute h-px bg-accent"
                    style={{ top: y(now), left: colLeft(todayIdx), width: colW }}
                  >
                    <span className="absolute -top-0.5 -left-0.5 size-1.5 rounded-mark bg-accent" />
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Блок задачи в сетке — тот же язык, что у «Расписания»: нейтральная плашка с линией в волос,
 * смысл — полосой 2 px слева, время моноширинным, факт — тонкая акцентная дорожка у правого края.
 */
function Block({
  task,
  slot,
  moving,
  goal,
  left,
  width,
  now,
  onClick,
  onKeyDown,
  onBlur,
  onPointerDown,
  onContextMenu,
}: {
  task: Task;
  slot: Slot;
  moving: boolean;
  goal?: Goal;
  left: number;
  width: number;
  now: number;
  onClick: () => void;
  onKeyDown: (e: ReactKeyboardEvent) => void;
  onBlur: () => void;
  onPointerDown: (e: ReactPointerEvent, mode: 'move' | 'resize') => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const start = slot.start as number;
  const top = y(start) + 1;
  const height = Math.max(22, (slot.duration / 60) * HOUR_PX - 2);
  const closed = isClosed(task);
  const running = isRunning(task);
  const fact = moving ? null : factSpan(task, now);
  const range = `${minutesToTime(start)}–${minutesToTime(start + slot.duration)}`;
  const compact = height < 44;
  // В узкой однострочной плашке (окно из трёх дней на телефоне) важнее название: время есть в подписи и сетке.
  const showTime = !compact || width >= 104;
  const bar = running ? 'bg-accent' : taskDot(task);

  const lead = task.emoji ? (
    <span className="font-emoji mr-1 no-underline">{task.emoji}</span>
  ) : task.kind === 'workout' ? (
    <Dumbbell size={12} aria-hidden="true" className="mr-1 -mt-0.5 inline-block text-muted" />
  ) : null;

  return (
    <>
      <button
        type="button"
        data-block
        data-focus-key={`cal-${task.id}`}
        aria-label={`${task.title}, ${range}${task.important ? ', важная' : ''}${running ? ', идёт' : ''}${closed ? ', закрыта' : ''}`}
        aria-describedby="week-block-hint"
        aria-roledescription="блок расписания"
        onClick={onClick}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onPointerDown={e => onPointerDown(e, 'move')}
        onContextMenu={onContextMenu}
        title={`${task.title} · ${range}`}
        className={`focus-ring group/block absolute z-1 cursor-grab select-none overflow-hidden rounded-control border text-left active:cursor-grabbing ${
          closed ? 'border-border bg-surface' : running ? 'border-border-strong bg-raised' : 'border-border bg-raised'
        } ${moving ? 'z-20 shadow-(--shadow-pop) ring-1 ring-accent' : 'hover:border-border-strong'}`}
        style={{ left, width, top, height, WebkitTouchCallout: 'none' }}
      >
        {running ? <span aria-hidden="true" className="absolute inset-0 bg-fill" /> : null}
        <span aria-hidden="true" className={`absolute inset-y-1 left-1 w-0.5 rounded-bar ${bar}`} />
        <span className={`relative flex h-full min-w-0 pl-2.5 pr-1.5 ${compact ? 'items-center gap-1.5' : 'flex-col gap-0.5 py-1'}`}>
          <span
            className={`min-w-0 text-caption font-medium ${compact ? 'flex-1 truncate' : height < 64 ? 'line-clamp-1 break-all' : 'line-clamp-2 break-words'} ${
              closed ? 'text-muted line-through decoration-muted/60' : 'text-text'
            } ${goal && !compact ? 'pr-4' : ''}`}
          >
            {task.important && !closed ? (
              <Flag size={12} aria-hidden="true" fill="currentColor" fillOpacity={0.2} className="mr-1 -mt-0.5 inline-block text-important-strong" />
            ) : null}
            {lead}
            {task.title}
          </span>
          {showTime ? (
            <span className="shrink-0 truncate font-mono text-micro text-muted">{compact ? minutesToTime(start) : range}</span>
          ) : null}
          {goal && !compact ? <GoalMark goal={goal} className="absolute top-1 right-1.5" /> : null}
        </span>
        {/* Ручка длительности: потянуть вниз — длиннее. */}
        <span
          aria-hidden="true"
          onPointerDown={e => onPointerDown(e, 'resize')}
          className="absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize touch-none items-end justify-center pb-0.5 pointer-coarse:h-3"
        >
          {compact ? null : <span className="hover-reveal h-0.5 w-6 rounded-bar bg-border-strong group-hover/block:opacity-100" />}
        </span>
      </button>
      {fact ? (
        <span
          aria-hidden="true"
          title={`Факт: ${minutesToTime(fact.start)}–${minutesToTime(fact.end)}`}
          className="pointer-events-none absolute z-2 w-0.75 rounded-bar bg-accent"
          style={{ left: left + width - 5, top: y(fact.start) + 2, height: Math.max(4, ((fact.end - fact.start) / 60) * HOUR_PX - 4) }}
        />
      ) : null}
    </>
  );
}

/** Метка цели на блоке: эмодзи цели или значок «мишень» 12 px — без подложки. */
function GoalMark({ goal, className = '' }: { goal: Goal; className?: string }) {
  return (
    <span title={`Цель: ${goal.title}`} className={`inline-flex size-3 items-center justify-center text-muted ${className}`}>
      {goal.emoji ? <span className="font-emoji text-micro leading-none">{goal.emoji}</span> : <TargetIcon size={12} aria-hidden="true" />}
    </span>
  );
}
