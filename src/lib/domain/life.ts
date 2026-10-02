import type { Dream, Goal, Horizon, Task } from '@/lib/types';
import { goalProgress } from './goals';
import { toDateISO, weekRange as isoWeekRange, addDaysISO } from '@/lib/dates';

/**
 * «Моя жизнь» — вся картина одним взглядом: мечты, цели и время, которое им отдано.
 * Чистые функции: экран только раскладывает то, что посчитано здесь.
 */

/** Неделя (пн–вс), в которую попадает дата: `{ start, end }` в 'YYYY-MM-DD'. */
export function weekRange(iso: string): { start: string; end: string } {
  return isoWeekRange(iso);
}

/** Прошлая неделя относительно даты. */
export function previousWeekRange(iso: string): { start: string; end: string } {
  return isoWeekRange(addDaysISO(isoWeekRange(iso).start, -1));
}

/** Цели, выросшие из мечты: по ссылке у цели (`dreamId`) или у мечты (`goalId`). */
export function dreamGoals(dream: Dream, goals: Goal[]): Goal[] {
  return goals.filter(g => g.dreamId === dream.id || g.id === dream.goalId);
}

/**
 * Насколько мечта ближе: среднее по прогрессу связанных целей (брошенные не считаются).
 * Исполненная мечта — 1, мечта без целей — 0.
 */
export function dreamProgress(dream: Dream, goals: Goal[], tasks: Task[]): number {
  if (dream.doneAt) return 1;
  const linked = dreamGoals(dream, goals).filter(g => g.status !== 'dropped');
  if (!linked.length) return 0;
  const sum = linked.reduce((s, g) => s + goalProgress(g, goals, tasks), 0);
  return sum / linked.length;
}

/** Цель и все её потомки (устойчиво к циклам в импортированных данных). */
export function goalFamily(goals: Goal[], id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const g of goals) {
      if (g.parentId && out.has(g.parentId) && !out.has(g.id)) {
        out.add(g.id);
        grew = true;
      }
    }
  }
  return out;
}

/** Сколько минут реально ушло на задачу: разница «закончил − начал». Без обеих отметок — 0. */
export function actualMinutes(task: Task): number {
  if (!task.actualStart || !task.actualEnd) return 0;
  const ms = Date.parse(task.actualEnd) - Date.parse(task.actualStart);
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60000) : 0;
}

/** Местная дата ISO-времени: 'YYYY-MM-DD'. */
const localDate = (isoDateTime: string) => toDateISO(new Date(isoDateTime));

/**
 * Часы, реально вложенные в цели за период: сумма `actualEnd − actualStart` сделанных задач,
 * начатых в диапазоне дат `[rangeStart, rangeEnd]` (включительно, местное время).
 * `goalIds` — какие цели считать (обычно `goalFamily`): без него — все задачи с целью.
 */
export function goalHours(tasks: Task[], rangeStart: string, rangeEnd: string, goalIds?: Set<string>): number {
  let minutes = 0;
  for (const t of tasks) {
    if (t.status !== 'done' || !t.goalId || !t.actualStart) continue;
    if (goalIds && !goalIds.has(t.goalId)) continue;
    const day = localDate(t.actualStart);
    if (day < rangeStart || day > rangeEnd) continue;
    minutes += actualMinutes(t);
  }
  return minutes / 60;
}

export interface Contribution {
  task: Task;
  /** Факт, если был таймер; иначе план. */
  minutes: number;
}

/**
 * «Вклад сегодня»: задачи с целью, сделанные в этот день. День — по окончанию таймера,
 * а без таймера — по дате задачи. Минуты — факт, а если его нет — план.
 */
export function contribution(tasks: Task[], dateISO: string): { items: Contribution[]; minutes: number } {
  const items: Contribution[] = [];
  for (const t of tasks) {
    if (t.status !== 'done' || !t.goalId) continue;
    const day = t.actualEnd ? localDate(t.actualEnd) : t.date;
    if (day !== dateISO) continue;
    const fact = actualMinutes(t);
    items.push({ task: t, minutes: fact || t.plannedMinutes || 0 });
  }
  items.sort((a, b) => (a.task.actualEnd ?? '').localeCompare(b.task.actualEnd ?? ''));
  return { items, minutes: items.reduce((s, i) => s + i.minutes, 0) };
}

/**
 * Цепочка цели от мечты к самой цели: «Мечта › Год › Месяц › Неделя».
 * Мечта берётся у ближайшего предка, у которого она указана.
 */
export function goalChain(goal: Goal, goals: Goal[], dreams: Dream[]): { dream?: Dream; goals: Goal[] } {
  const byId = new Map(goals.map(g => [g.id, g]));
  const chain: Goal[] = [goal];
  const seen = new Set([goal.id]);
  let cur = goal;
  while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.parentId)) {
    cur = byId.get(cur.parentId)!;
    seen.add(cur.id);
    chain.unshift(cur);
  }
  let dream: Dream | undefined;
  for (let i = chain.length - 1; i >= 0 && !dream; i--) {
    const g = chain[i];
    dream = dreams.find(d => (g.dreamId && d.id === g.dreamId) || d.goalId === g.id);
  }
  return { dream, goals: chain };
}

export interface GoalWeek {
  goal: Goal;
  progress: number;
  /** Часы за выбранную неделю (с подцелями). */
  hours: number;
}

/** Активные цели с прогрессом и часами за период; больше всего часов — выше. */
export function goalsByHours(goals: Goal[], tasks: Task[], rangeStart: string, rangeEnd: string): GoalWeek[] {
  return goals
    .filter(g => g.status === 'active')
    .map(g => ({
      goal: g,
      progress: goalProgress(g, goals, tasks),
      hours: goalHours(tasks, rangeStart, rangeEnd, goalFamily(goals, g.id)),
    }))
    .sort((a, b) => b.hours - a.hours || b.progress - a.progress || a.goal.title.localeCompare(b.goal.title));
}

/** Активные цели по горизонтам — для «тропы» годы → год → месяц → неделя. */
export function goalsByHorizon(goals: Goal[]): Record<Horizon, Goal[]> {
  const out: Record<Horizon, Goal[]> = { years: [], year: [], month: [], week: [] };
  for (const g of goals) if (g.status === 'active') out[g.horizon]?.push(g);
  return out;
}

/** «1,5 ч», «40 мин», «0 ч» — часы для подписи. */
export function formatHours(hours: number): string {
  if (hours <= 0) return '0 ч';
  if (hours < 1) return `${Math.round(hours * 60)} мин`;
  const rounded = Math.round(hours * 10) / 10;
  return `${String(rounded).replace('.', ',')} ч`;
}
