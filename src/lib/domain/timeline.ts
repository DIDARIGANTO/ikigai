import type { Task } from '@/lib/types';
import { timeToMinutes } from '@/lib/dates';

/**
 * Чистая геометрия расписания «план против факта»: минуты дня, дорожки, свёрнутые пустые часы,
 * перетаскивание и перенос. Здесь нет DOM и React — поэтому всё проверяется юнит-тестами,
 * а компонент только переводит результаты в пиксели.
 */

export const DAY_MIN = 24 * 60;
export const SNAP_MIN = 15;
/** Самая короткая задача, которую можно получить растягиванием. */
export const MIN_DURATION = 15;
/** Длительность по умолчанию: у задачи без длительности блок всё равно в полчаса. */
export const DEFAULT_DURATION = 30;
export const MAX_LANES = 3;

export const HOUR_PX = 56;
/** Высота свёрнутой полосы пустых часов: одна тонкая строка. */
export const STRIP_PX = 24;
/** Воздух сверху и снизу, чтобы подпись «00:00» и последняя линия не липли к краю. */
export const PAD_PX = 10;

// ——— минуты ———

/** Привязка к сетке (по умолчанию 15 минут), к ближайшему делению. */
export const snapMinutes = (min: number, step = SNAP_MIN) => Math.round(min / step) * step;

const floorTo = (min: number, step = SNAP_MIN) => Math.floor(min / step) * step;
export const ceilTo = (min: number, step = SNAP_MIN) => Math.ceil(min / step) * step;

/**
 * Держит отрезок внутри суток, сохраняя длительность: блок, упёршийся в полночь, не сжимается, а останавливается.
 * Слишком длинный отрезок обрезается до суток.
 */
export function clampRange(start: number, end: number, min = 0, max = DAY_MIN): { start: number; end: number } {
  const dur = Math.min(Math.max(end - start, 0), max - min);
  const s = Math.min(Math.max(start, min), max - dur);
  return { start: s, end: s + dur };
}

/** `HH:mm` для минут суток; 1440 — это «24:00». */
export const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`;

export const formatRange = (start: number, end: number) => `${hhmm(start)}–${hhmm(end)}`;

/** «45 мин», «1 ч», «1 ч 30 мин». */
export function durationLabel(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest} мин`;
  return rest ? `${h} ч ${rest} мин` : `${h} ч`;
}

/** Локальная дата-время для дня `YYYY-MM-DD` и минут суток. */
export function dateAt(dateISO: string, min: number): Date {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(y, m - 1, d, 0, min);
}

/** Минуты от начала дня `dateISO` до момента `iso` — в пределах суток (вчера → 0, завтра → 1440). */
export function minutesOnDate(iso: string, dateISO: string): number | null {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return null;
  const from = dateAt(dateISO, 0).getTime();
  return Math.min(Math.max((at - from) / 60000, 0), DAY_MIN);
}

// ——— раскладка по дорожкам ———

export interface TimelineBlock {
  task: Task;
  startMin: number;
  endMin: number;
  lane: number;
  lanes: number;
  /** Начало следующего блока на той же дорожке: выше него блок не вырастет даже ради читаемости. */
  nextStart: number;
}

/** План задачи в минутах суток; задачи без времени на шкалу не попадают. */
export function planRange(task: Pick<Task, 'plannedStart' | 'plannedMinutes'>): { start: number; end: number } | null {
  if (!task.plannedStart) return null;
  const start = Math.min(Math.max(timeToMinutes(task.plannedStart), 0), DAY_MIN - MIN_DURATION);
  const dur = Math.max(task.plannedMinutes ?? DEFAULT_DURATION, MIN_DURATION);
  return { start, end: Math.min(start + dur, DAY_MIN) };
}

/**
 * Раскладка задач по дорожкам: пересекающиеся соседи встают рядом (до трёх колонок) и становятся уже,
 * а не перекрывают друг друга. Четвёртая и дальше делят последнюю дорожку.
 */
export function layoutBlocks(tasks: Task[], maxLanes = MAX_LANES): TimelineBlock[] {
  const items = tasks
    .map(task => ({ task, range: planRange(task) }))
    .filter((x): x is { task: Task; range: { start: number; end: number } } => x.range !== null)
    .map(({ task, range }) => ({ task, startMin: range.start, endMin: range.end }))
    .sort((a, b) => a.startMin - b.startMin || a.task.position - b.task.position);

  const out: TimelineBlock[] = [];
  let cluster: TimelineBlock[] = [];
  let clusterEnd = -1;
  const laneEnds: number[] = [];

  const clusterOf = new Map<TimelineBlock, number>();
  let clusterId = 0;
  const closeCluster = () => {
    clusterId++;
    const lanes = Math.max(1, ...cluster.map(b => b.lane + 1));
    for (const b of cluster) b.lanes = lanes;
    cluster = [];
    laneEnds.length = 0;
  };

  for (const item of items) {
    if (item.startMin >= clusterEnd) closeCluster();
    let lane = laneEnds.findIndex(end => end <= item.startMin);
    if (lane < 0) lane = laneEnds.length < maxLanes ? laneEnds.length : maxLanes - 1;
    laneEnds[lane] = Math.max(laneEnds[lane] ?? 0, item.endMin);
    const block: TimelineBlock = { ...item, lane, lanes: 1, nextStart: DAY_MIN };
    cluster.push(block);
    clusterOf.set(block, clusterId);
    out.push(block);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  closeCluster();

  // Сосед снизу — любой более поздний блок, который может оказаться под этим: на той же дорожке
  // или из другого кластера (там ширина другая). Соседние колонки одного кластера не мешают.
  for (const b of out) {
    const below = out.filter(
      o => o !== b && o.startMin > b.startMin && (clusterOf.get(o) !== clusterOf.get(b) || o.lane === b.lane),
    );
    b.nextStart = Math.min(DAY_MIN, ...below.map(o => o.startMin));
  }
  return out;
}

// ——— факт ———

export interface FactGeometry {
  start: number;
  end: number;
  running: boolean;
}

/**
 * Факт задачи в минутах дня: от `actualStart` до `actualEnd`, а пока таймер идёт — до «сейчас».
 * Без запуска таймера факта нет.
 */
export function factGeometry(task: Task, dateISO: string, now: Date = new Date()): FactGeometry | null {
  if (!task.actualStart) return null;
  const start = minutesOnDate(task.actualStart, dateISO);
  if (start === null) return null;
  const running = task.status === 'doing' && !task.actualEnd;
  const endISO = running ? now.toISOString() : task.actualEnd;
  const end = endISO ? minutesOnDate(endISO, dateISO) : null;
  return { start, end: Math.max(start, end ?? start), running };
}

/** Насколько факт вышел за конец плана (0 — уложились). */
export const overrunMinutes = (planEnd: number, factEnd: number) => Math.max(0, Math.round(factEnd - planEnd));

/** На сколько раньше конца плана закончили (0 — не раньше). */
export const earlyMinutes = (planEnd: number, factEnd: number) => Math.max(0, Math.round(planEnd - factEnd));

// ——— пропущенные ———

export interface MissedState {
  missed: boolean;
  /** Сколько минут прошло с задуманного начала. */
  lateBy: number;
}

/**
 * «Не успел»: сегодняшняя задача, чьё начало уже прошло, а таймер так и не запускали.
 * Закрытые (сделанные или пропущенные) задачи и другие дни — никогда не «пропущены».
 */
export function missedState(
  task: Task,
  ctx: { date: string; today: string; nowMin: number | null },
): MissedState {
  const none = { missed: false, lateBy: 0 };
  if (ctx.date !== ctx.today || ctx.nowMin === null || !task.plannedStart) return none;
  if (task.status === 'done' || task.status === 'skipped' || task.actualStart) return none;
  const start = timeToMinutes(task.plannedStart);
  if (start >= ctx.nowMin) return none;
  return { missed: true, lateBy: ctx.nowMin - start };
}

/** Куда перенести пропущенное: через час, вечером, завтра в то же время (невозможные варианты отпадают). */
export function rescheduleOptions(
  nowMin: number,
  durationMin: number,
): { key: 'hour' | 'evening' | 'tomorrow'; label: string; start: number | null }[] {
  const out: { key: 'hour' | 'evening' | 'tomorrow'; label: string; start: number | null }[] = [];
  const inHour = ceilTo(nowMin) + 60;
  if (inHour + durationMin <= DAY_MIN) out.push({ key: 'hour', label: '+1 час', start: inHour });
  const evening = 19 * 60;
  if (nowMin < evening - SNAP_MIN && evening + durationMin <= DAY_MIN && evening !== inHour) {
    out.push({ key: 'evening', label: 'Вечером', start: evening });
  }
  out.push({ key: 'tomorrow', label: 'Завтра', start: null });
  return out;
}

/** «Сделал в …»: факт от выбранного времени на задуманную длительность. */
export function factFromDoneAt(dateISO: string, startMin: number, durationMin: number) {
  const start = dateAt(dateISO, startMin);
  const end = dateAt(dateISO, startMin + durationMin);
  return { actualStart: start.toISOString(), actualEnd: end.toISOString() };
}

// ——— куда прокрутить ———

export interface ScrollTarget {
  min: number;
  /** `top` — блок у верхнего края, `third` — «сейчас» в верхней трети. */
  align: 'top' | 'third';
}

/**
 * Начальная прокрутка: к первому незакрытому блоку, если он уже начался (ничего сегодняшнего не пролистываем),
 * иначе к «сейчас», иначе — к первому блоку дня или к 08:00.
 */
export function pickScrollTarget(blocks: TimelineBlock[], nowMin: number | null): ScrollTarget {
  const open = blocks.filter(b => b.task.status !== 'done' && b.task.status !== 'skipped');
  const firstOpen = open.length ? Math.min(...open.map(b => b.startMin)) : null;
  if (nowMin !== null) {
    if (firstOpen !== null && firstOpen < nowMin) return { min: firstOpen, align: 'top' };
    return { min: nowMin, align: 'third' };
  }
  if (firstOpen !== null) return { min: firstOpen, align: 'top' };
  if (blocks.length) return { min: Math.min(...blocks.map(b => b.startMin)), align: 'top' };
  return { min: 8 * 60, align: 'top' };
}

// ——— ряды: часы и свёрнутые полосы ———

export interface Row {
  kind: 'hours' | 'strip';
  from: number;
  to: number;
  top: number;
  height: number;
}

/**
 * Ряды шкалы. Подряд идущие пустые часы, которые можно свернуть (прошедшие или ночные), становятся
 * одной тонкой полосой; раскрытые полосы (`expanded` — минута начала) снова разворачиваются в часы.
 * Сворачиваются только отрезки от двух часов: один час выглядит полосой и так.
 */
export function buildRows(opts: {
  busy: { start: number; end: number }[];
  collapsible: (hour: number) => boolean;
  expanded?: ReadonlySet<number>;
}): Row[] {
  const { busy, collapsible, expanded } = opts;
  const empty = (h: number) => !busy.some(b => b.start < (h + 1) * 60 && b.end > h * 60);
  const fold: boolean[] = Array.from({ length: 24 }, (_, h) => collapsible(h) && empty(h));

  // Отрезки подряд идущих свёртываемых часов длиной меньше двух — обратно в часы.
  const runs: { from: number; to: number; strip: boolean }[] = [];
  let h = 0;
  while (h < 24) {
    const strip = fold[h];
    let e = h;
    while (e < 24 && fold[e] === strip) e++;
    const isStrip = strip && e - h >= 2 && !expanded?.has(h * 60);
    runs.push({ from: h * 60, to: e * 60, strip: isStrip });
    h = e;
  }

  const rows: Row[] = [];
  let top = PAD_PX;
  for (const r of runs) {
    const last = rows[rows.length - 1];
    if (!r.strip && last && last.kind === 'hours') {
      last.to = r.to;
      last.height = ((last.to - last.from) / 60) * HOUR_PX;
      top = last.top + last.height;
      continue;
    }
    const height = r.strip ? STRIP_PX : ((r.to - r.from) / 60) * HOUR_PX;
    rows.push({ kind: r.strip ? 'strip' : 'hours', from: r.from, to: r.to, top, height });
    top += height;
  }
  return rows;
}

export const contentHeight = (rows: Row[]) =>
  (rows.length ? rows[rows.length - 1].top + rows[rows.length - 1].height : 0) + PAD_PX;

/** Минута суток → вертикаль в пикселях содержимого. */
export function yAt(rows: Row[], min: number): number {
  const m = Math.min(Math.max(min, 0), DAY_MIN);
  const row = rows.find(r => m >= r.from && m < r.to) ?? rows[rows.length - 1];
  if (!row) return PAD_PX;
  const frac = (Math.min(m, row.to) - row.from) / (row.to - row.from);
  return row.top + frac * row.height;
}

/** Вертикаль в пикселях → минута суток (обратная к `yAt`). */
export function minuteAt(rows: Row[], y: number): number {
  if (!rows.length) return 0;
  if (y <= rows[0].top) return rows[0].from;
  const row = rows.find(r => y >= r.top && y < r.top + r.height) ?? rows[rows.length - 1];
  const frac = Math.min(Math.max((y - row.top) / row.height, 0), 1);
  return row.from + frac * (row.to - row.from);
}

// ——— перетаскивание ———

export type DragMode = 'move' | 'resize' | 'create';

/**
 * Новый отрезок во время перетаскивания. `anchor` — минута под пальцем в начале, `pointer` — сейчас.
 * move — сдвиг с шагом 15 минут и упором в границы суток; resize — только нижний край, не короче 15 минут;
 * create — отрезок между точкой нажатия и пальцем (вверх тоже можно).
 */
export function applyDrag(
  mode: DragMode,
  base: { start: number; end: number },
  anchor: number,
  pointer: number,
): { start: number; end: number } {
  if (mode === 'move') {
    const dur = base.end - base.start;
    const start = snapMinutes(base.start + (pointer - anchor));
    return clampRange(start, start + dur);
  }
  if (mode === 'resize') {
    const end = snapMinutes(base.end + (pointer - anchor));
    return { start: base.start, end: Math.min(Math.max(end, base.start + MIN_DURATION), DAY_MIN) };
  }
  const a = floorTo(anchor);
  const p = snapMinutes(pointer);
  if (p >= a) return clampRange(a, Math.max(p, a + MIN_DURATION));
  return clampRange(Math.max(p, 0), a + SNAP_MIN);
}

/** Шаг с клавиатуры: стрелки двигают, Shift+стрелки меняют длительность. */
export function nudge(
  range: { start: number; end: number },
  mode: 'move' | 'resize',
  delta: number,
): { start: number; end: number } {
  if (mode === 'move') return clampRange(range.start + delta, range.end + delta);
  return { start: range.start, end: Math.min(Math.max(range.end + delta, range.start + MIN_DURATION), DAY_MIN) };
}
