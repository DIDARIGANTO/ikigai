import { addDays, addMonths, eachDayOfInterval, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Reminder, Task } from '@/lib/types';
import { toDateISO } from '@/lib/dates';
import { reminderOccursOn } from '@/lib/domain/reminders';
import { sortByPlannedStart } from '@/lib/domain/tasks';

export type CalendarView = 'month' | 'week' | 'day';

export const VIEWS: { key: CalendarView; label: string }[] = [
  { key: 'month', label: 'Месяц' },
  { key: 'week', label: 'Неделя' },
  { key: 'day', label: 'День' },
];

export const isView = (v: string | null): v is CalendarView => VIEWS.some(x => x.key === v);

/** Подписи колонок сетки: неделя начинается с понедельника. */
export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/**
 * Сетка месяца: ровно 42 дня — шесть недель с понедельника.
 * Постоянная высота важнее плотности: страница не прыгает при листании месяцев.
 */
export function monthGrid(iso: string): string[] {
  const first = startOfWeek(startOfMonth(parseISO(iso)), { weekStartsOn: 1 });
  return eachDayOfInterval({ start: first, end: addDays(first, 41) }).map(toDateISO);
}

/** Семь дней недели, в которую попадает дата, с понедельника. */
export function weekGrid(iso: string): string[] {
  const first = startOfWeek(parseISO(iso), { weekStartsOn: 1 });
  return eachDayOfInterval({ start: first, end: addDays(first, 6) }).map(toDateISO);
}

export const sameMonth = (a: string, b: string) => isSameMonth(parseISO(a), parseISO(b));

/** Шаг стрелок «‹ ›»: месяц, неделя или день — смотря какой вид открыт. */
export function shiftCursor(iso: string, view: CalendarView, delta: number): string {
  const d = parseISO(iso);
  if (view === 'month') return toDateISO(addMonths(d, delta));
  return toDateISO(addDays(d, view === 'week' ? delta * 7 : delta));
}

/** Заголовок недели: «8 – 14 сентября», а на стыке месяцев — «29 сент. – 5 окт.». */
export function weekTitleRu(iso: string): string {
  const days = weekGrid(iso);
  const a = parseISO(days[0]);
  const b = parseISO(days[6]);
  return isSameMonth(a, b)
    ? `${format(a, 'd', { locale: ru })} – ${format(b, 'd MMMM', { locale: ru })}`
    : `${format(a, 'd MMM', { locale: ru })} – ${format(b, 'd MMM', { locale: ru })}`;
}

export const dayNum = (iso: string) => format(parseISO(iso), 'd');
/** Короткий день недели: «пн». */
export const weekdayShortRu = (iso: string) => format(parseISO(iso), 'EEEEEE', { locale: ru });

/** Задачи, разложенные по датам и упорядоченные по времени начала. */
export function tasksByDate(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.date) continue;
    const list = map.get(t.date);
    if (list) list.push(t);
    else map.set(t.date, [t]);
  }
  for (const [date, list] of map) map.set(date, sortByPlannedStart(list));
  return map;
}

/** Напоминания, которые сработают в этот день (с учётом повторов), по времени. */
export function remindersOn(reminders: Reminder[], iso: string): Reminder[] {
  return reminders
    .filter(r => reminderOccursOn(r, iso))
    .sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99') || a.text.localeCompare(b.text));
}

/** Идентификатор дня-приёмника для перетаскивания. */
export const dayDroppableId = (iso: string) => `day:${iso}`;
export const dateFromDroppableId = (id: string) => (id.startsWith('day:') ? id.slice(4) : null);

/* ───────────────────────── Сетка времени недели ───────────────────────── */

export const GRID_START_HOUR = 6;
export const GRID_END_HOUR = 24;
/** Высота часа в сетке недели. */
export const HOUR_PX = 56;
/** Шаг перетаскивания и клавиатуры. */
export const SNAP_MIN = 15;
/** Короче четверти часа задачу не растянуть. */
export const MIN_DURATION = 15;
/** Задача без длительности рисуется получасовой. */
export const DEFAULT_DURATION = 30;
export const DAY_START = GRID_START_HOUR * 60;
export const DAY_END = GRID_END_HOUR * 60;
export const GRID_PX = ((DAY_END - DAY_START) / 60) * HOUR_PX;

/** Минуты от полуночи → пиксели от верха сетки. */
export const minutesToPx = (min: number) => ((min - DAY_START) / 60) * HOUR_PX;
/** Пиксели от верха сетки → минуты от полуночи (без округления). */
export const pxToMinutes = (px: number) => DAY_START + (px / HOUR_PX) * 60;

export const snapMinutes = (min: number, step = SNAP_MIN) => Math.round(min / step) * step;

/** Длительность, которая помещается в день, начиная с `start`. */
export function clampDuration(start: number, duration: number): number {
  return Math.max(MIN_DURATION, Math.min(duration, DAY_END - start));
}

/** Начало, при котором блок длиной `duration` целиком внутри сетки. */
export function clampStart(start: number, duration: number): number {
  const d = Math.min(Math.max(duration, MIN_DURATION), DAY_END - DAY_START);
  return Math.min(Math.max(start, DAY_START), DAY_END - d);
}

/** Сдвиг даты на `days` дней по календарю (через границы месяцев, лет и перевод часов). */
export const shiftDate = (iso: string, days: number) => toDateISO(addDays(parseISO(iso), days));

export interface Span {
  start: number;
  end: number;
}

/** Задуманное время задачи в минутах. Без `plannedStart` — null. */
export function planSpan(task: Task): Span | null {
  if (!task.plannedStart) return null;
  const [h, m] = task.plannedStart.split(':').map(Number);
  const raw = h * 60 + m;
  const duration = task.plannedMinutes && task.plannedMinutes > 0 ? task.plannedMinutes : DEFAULT_DURATION;
  const start = clampStart(raw, duration);
  return { start, end: start + clampDuration(start, duration) };
}

const localMinutes = (isoDateTime: string) => {
  const d = new Date(isoDateTime);
  return d.getHours() * 60 + d.getMinutes();
};

/**
 * Факт: когда задачу на самом деле делали (по таймеру). Идущая задача тянется до `nowMin`.
 * Обрезается рамками сетки; пустой или перевёрнутый отрезок — null.
 */
export function factSpan(task: Task, nowMin: number): Span | null {
  if (!task.actualStart) return null;
  const start = Math.max(DAY_START, localMinutes(task.actualStart));
  const endRaw = task.actualEnd ? localMinutes(task.actualEnd) : task.status === 'doing' ? nowMin : null;
  if (endRaw === null) return null;
  const end = Math.min(DAY_END, endRaw);
  return end > start ? { start, end } : null;
}

export interface Laned<T> {
  item: T;
  start: number;
  end: number;
  lane: number;
  lanes: number;
}

/**
 * Дорожки для пересекающихся блоков: жадно, по началу. Группа пересечений делит ширину поровну;
 * блоки, которым не хватило дорожки, ложатся в последнюю. Короткие блоки для раскладки
 * считаются получасовыми — иначе соседние подписи налезали бы друг на друга.
 */
export function layoutLanes<T>(items: { item: T; start: number; end: number }[], maxLanes = 3): Laned<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Laned<T>[] = [];
  let cluster: Laned<T>[] = [];
  let clusterEnd = -Infinity;
  const laneEnds: number[] = [];

  const close = () => {
    const lanes = Math.max(1, ...cluster.map(b => b.lane + 1));
    for (const b of cluster) b.lanes = lanes;
    cluster = [];
    laneEnds.length = 0;
  };

  for (const it of sorted) {
    const visualEnd = Math.max(it.end, it.start + DEFAULT_DURATION);
    if (it.start >= clusterEnd) close();
    let lane = laneEnds.findIndex(end => end <= it.start);
    if (lane < 0) lane = laneEnds.length < maxLanes ? laneEnds.length : maxLanes - 1;
    laneEnds[lane] = Math.max(laneEnds[lane] ?? 0, visualEnd);
    const block: Laned<T> = { ...it, lane, lanes: 1 };
    cluster.push(block);
    out.push(block);
    clusterEnd = Math.max(clusterEnd, visualEnd);
  }
  close();
  return out;
}

export interface Slot {
  date: string;
  /** Начало в минутах; null — задача «на день», без времени. */
  start: number | null;
  duration: number;
}

/**
 * Клавиатура в сетке недели: ↑/↓ — ±15 минут, ←/→ (или с Alt) — ±день, Shift+↑/↓ — короче/длиннее.
 * Возвращает новый слот или null, если клавиша не наша. За края дня блок не выходит.
 */
export function nudgeSlot(slot: Slot, key: string, mods: { shift?: boolean; alt?: boolean } = {}): Slot | null {
  const { shift = false } = mods;
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    if (shift) return null;
    return { ...slot, date: shiftDate(slot.date, key === 'ArrowLeft' ? -1 : 1) };
  }
  if (key !== 'ArrowUp' && key !== 'ArrowDown') return null;
  const dir = key === 'ArrowUp' ? -1 : 1;
  if (slot.start === null) return null;
  if (shift) {
    const duration = clampDuration(slot.start, snapMinutes(slot.duration + dir * SNAP_MIN));
    return duration === slot.duration ? slot : { ...slot, duration };
  }
  const start = clampStart(snapMinutes(slot.start + dir * SNAP_MIN), slot.duration);
  return { ...slot, start };
}

export interface GridMetrics {
  /** Левый край первой колонки дня (после шкалы часов), в координатах страницы. */
  left: number;
  /** Верх сетки (06:00), в координатах страницы. */
  top: number;
  colWidth: number;
  days: string[];
}

/** Номер колонки под точкой `x`; за краями — крайняя колонка. */
export function columnAt(x: number, m: Pick<GridMetrics, 'left' | 'colWidth' | 'days'>): number {
  if (m.colWidth <= 0) return 0;
  const i = Math.floor((x - m.left) / m.colWidth);
  return Math.max(0, Math.min(m.days.length - 1, i));
}

/**
 * Куда встанет блок, если отпустить его в точке (x, y). `grabMin` — на сколько минут ниже
 * начала блока его схватили: блок едет вместе с пальцем, а не прыгает началом под курсор.
 */
export function slotAt(x: number, y: number, m: GridMetrics, duration: number, grabMin = 0): { date: string; start: number } {
  const date = m.days[columnAt(x, m)];
  const start = clampStart(snapMinutes(pxToMinutes(y - m.top) - grabMin), duration);
  return { date, start };
}

/**
 * Куда прокрутить сетку при открытии (минута у верхнего края): к 07:00 или к первому делу недели —
 * что раньше. На текущей неделе ещё и так, чтобы линия «сейчас» была видна (`visibleMin` — высота окна в минутах).
 */
export function initialScrollMinute(starts: number[], nowMin: number | null, visibleMin = Infinity): number {
  const first = starts.length ? Math.min(...starts) : Infinity;
  let top = Math.max(DAY_START, Math.min(7 * 60, first) - 30);
  if (nowMin !== null && nowMin >= DAY_START && nowMin <= DAY_END) {
    // «Сейчас» ниже окна — поднимаем так, чтобы до линии оставалась треть окна.
    if (nowMin > top + visibleMin * 0.75) top = nowMin - visibleMin * 0.66;
    if (nowMin < top) top = nowMin - 60;
  }
  // К целому часу: сетка открывается ровно на подписи, а не на середине блока.
  return Math.max(DAY_START, Math.floor(top / 60) * 60);
}

/* ───────────────────────── Месяц ───────────────────────── */

/** На сколько дней сдвигает стрелка при переносе в сетке месяца: строка — неделя. */
export function monthKeyStep(key: string): number | null {
  if (key === 'ArrowLeft') return -1;
  if (key === 'ArrowRight') return 1;
  if (key === 'ArrowUp') return -7;
  if (key === 'ArrowDown') return 7;
  return null;
}

export interface KeyboardMove {
  taskId: string;
  /** Откуда взяли — собственный день задачи. */
  origin: string;
  /** Над каким днём задача сейчас. */
  target: string;
}

/** Взяли задачу с клавиатуры: первым подсвечивается её собственный день, а не соседний. */
export const startKeyboardMove = (task: Pick<Task, 'id' | 'date'>, fallback: string): KeyboardMove => ({
  taskId: task.id,
  origin: task.date ?? fallback,
  target: task.date ?? fallback,
});

/** Шаг стрелкой; за край видимой сетки задача не уходит. */
export function stepKeyboardMove(move: KeyboardMove, key: string, visible: string[]): KeyboardMove {
  const step = monthKeyStep(key);
  if (step === null) return move;
  const next = shiftDate(move.target, step);
  return visible.includes(next) ? { ...move, target: next } : move;
}

const isOpen = (t: Task) => t.status !== 'done' && t.status !== 'skipped';

/**
 * Нагрузка дня — от 0 до 4 делений: берём большее из «сколько открытых задач» и «сколько часов
 * запланировано»; каждое деление — две задачи или два часа.
 */
export function dayLoad(tasks: Task[]): number {
  const open = tasks.filter(isOpen);
  const hours = open.reduce((s, t) => s + (t.plannedMinutes ?? 0), 0) / 60;
  const score = Math.max(open.length, hours);
  return Math.min(4, Math.ceil(score / 2));
}

export interface PlanSummary {
  plannedMinutes: number;
  done: number;
  total: number;
}

/** Итог дня (или недели): сколько минут запланировано и сколько задач сделано. Пропущенные не считаются. */
export function planSummary(tasks: Task[]): PlanSummary {
  const counted = tasks.filter(t => t.status !== 'skipped');
  return {
    plannedMinutes: counted.reduce((s, t) => s + (t.plannedMinutes ?? 0), 0),
    done: counted.filter(t => t.status === 'done').length,
    total: counted.length,
  };
}

/** «45 мин», «4 ч», «1 ч 30 мин». */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} мин`;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

/** Строка итога: «план 4 ч · сделано 2 из 5». */
export function summaryLine(s: PlanSummary): string {
  if (!s.total) return 'Задач нет';
  const parts = [];
  if (s.plannedMinutes) parts.push(`план ${formatDuration(s.plannedMinutes)}`);
  parts.push(`сделано ${s.done} из ${s.total}`);
  return parts.join(' · ');
}

/* ───────────────────────── Горячие клавиши ───────────────────────── */

export type CalendarHotkey = 'today' | 'prev' | 'next' | CalendarView;

/** Клавиша страницы календаря по физической кнопке — работает и в русской раскладке. */
export function calendarHotkey(e: Pick<KeyboardEvent, 'code' | 'metaKey' | 'ctrlKey' | 'altKey'>): CalendarHotkey | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  switch (e.code) {
    case 'KeyT':
      return 'today';
    case 'BracketLeft':
      return 'prev';
    case 'BracketRight':
      return 'next';
    case 'Digit1':
    case 'Numpad1':
      return 'month';
    case 'Digit2':
    case 'Numpad2':
      return 'week';
    case 'Digit3':
    case 'Numpad3':
      return 'day';
    default:
      return null;
  }
}
