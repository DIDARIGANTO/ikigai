import type { Task } from '@/lib/types';
import { minutesToTime, timeToMinutes } from '@/lib/dates';

/** Окно, в котором предлагаем свободное время: 07:00–22:00. */
export const DAY_START = 7 * 60;
export const DAY_END = 22 * 60;
const STEP = 15;
/** Длительность задачи без оценки — как в расписании. */
export const DEFAULT_MINUTES = 30;

export interface Slot {
  start: string; // 'HH:mm'
  end: string;
}

const ceilTo = (m: number, step: number) => Math.ceil(m / step) * step;

/** Занятые отрезки дня (в минутах), слитые и отсортированные. Пропущенные задачи время не занимают. */
export function busyIntervals(tasks: Task[], dateISO: string): [number, number][] {
  const raw = tasks
    .filter(t => t.date === dateISO && t.plannedStart && t.status !== 'skipped')
    .map(t => {
      const s = timeToMinutes(t.plannedStart as string);
      return [s, s + (t.plannedMinutes || DEFAULT_MINUTES)] as [number, number];
    })
    .sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [s, e] of raw) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

/**
 * Ближайшие свободные окна под задачу длиной `minutes` между 07:00 и 22:00, с шагом 15 минут.
 * Сначала — по одному началу в каждом промежутке между задачами (чтобы предложить разные части дня);
 * если промежутков меньше `limit`, добираем более поздние начала в тех же промежутках.
 * `nowMinutes` — для сегодняшнего дня: прошедшее время не предлагаем.
 */
export function freeSlots(
  tasks: Task[],
  dateISO: string,
  minutes: number,
  nowMinutes?: number,
  limit = 3,
): Slot[] {
  const len = Math.max(STEP, minutes || DEFAULT_MINUTES);
  const from = Math.max(DAY_START, nowMinutes === undefined ? DAY_START : ceilTo(nowMinutes, STEP));
  const busy = busyIntervals(tasks, dateISO);

  // Свободные промежутки внутри окна.
  const gaps: [number, number][] = [];
  let cursor = from;
  for (const [s, e] of busy) {
    if (e <= cursor) continue;
    if (s > cursor) gaps.push([cursor, Math.min(s, DAY_END)]);
    cursor = Math.max(cursor, e);
    if (cursor >= DAY_END) break;
  }
  if (cursor < DAY_END) gaps.push([cursor, DAY_END]);

  const starts: number[] = [];
  const fits = gaps
    .map(([s, e]) => [ceilTo(s, STEP), e] as [number, number])
    .filter(([s, e]) => e - s >= len);
  for (const [s] of fits) {
    if (starts.length >= limit) break;
    starts.push(s);
  }
  // Добор: следующие начала в тех же промежутках, через длину задачи (не реже раза в час).
  const hop = ceilTo(Math.max(len, 60), STEP);
  for (let round = 1; starts.length < limit; round++) {
    let added = false;
    for (const [s, e] of fits) {
      const next = s + hop * round;
      if (next + len <= e) {
        starts.push(next);
        added = true;
        if (starts.length >= limit) break;
      }
    }
    if (!added) break;
  }
  return starts
    .sort((a, b) => a - b)
    .map(s => ({ start: minutesToTime(s), end: minutesToTime(s + len) }));
}
