import type { Dream, Goal, Profile, Task } from '@/lib/types';

/**
 * Логика знакомства и чек-листа «Первые шаги» — чистые функции, экраны только рисуют.
 */

/** Сколько содержимого у человека и сколько из него — нетронутые демо-данные. */
export interface ContentCounts {
  /** Мечты, цели, задачи, напоминания, заметки, пункты и списки (кроме «Купить» из каркаса). */
  total: number;
  /** Из них — демо, которое никто не трогал. */
  demo: number;
}

interface Stamped {
  createdAt: string;
  updatedAt: string;
}

/**
 * Демо-строка — созданная тем же залпом, что и профиль при первой загрузке (`loadDemo` ставит
 * всем одну метку времени), и с тех пор не изменённая. Всё остальное — дело рук человека.
 */
export function countContent(profile: Profile | undefined, rows: Stamped[]): ContentCounts {
  const stamp = profile?.demoLoaded ? profile.createdAt : undefined;
  let demo = 0;
  for (const r of rows) if (stamp && r.createdAt === stamp && r.updatedAt === r.createdAt) demo++;
  return { total: rows.length, demo };
}

/**
 * Показывать ли знакомство. `null` — профиль ещё грузится: пока нет (решим, когда будет);
 * `undefined` — профиля нет вовсе (новый облачный аккаунт).
 * Уже пройдено — нет. Есть хоть что-то своё (не нетронутое демо) — человек не новый: нет,
 * даже если флаг `onboarded` не выставлен. Свежий профиль с демо или пустой — да.
 */
export function shouldOnboard(profile: Profile | undefined | null, counts: ContentCounts): boolean {
  if (profile === null) return false;
  if (profile?.onboarded === true) return false;
  return counts.total - counts.demo <= 0;
}

/* ───────────────────────── Чек-лист «Первые шаги» ───────────────────────── */

export type StepKey = 'dreams' | 'goal' | 'week' | 'timed' | 'telegram';

export interface ChecklistStep {
  key: StepKey;
  done: boolean;
  /** Сколько уже есть — для «2 из 3». */
  have?: number;
  need?: number;
}

export const DREAMS_NEEDED = 3;

/** Шаги по данным: отмечаются сами, как только в данных появляется нужное. */
export function checklistSteps({
  profile,
  dreams,
  goals,
  tasks,
}: {
  profile: Profile;
  dreams: Dream[];
  goals: Goal[];
  tasks: Task[];
}): ChecklistStep[] {
  const weekGoal = profile.weekGoalId ? goals.find(g => g.id === profile.weekGoalId) : undefined;
  return [
    { key: 'dreams', done: dreams.length >= DREAMS_NEEDED, have: Math.min(dreams.length, DREAMS_NEEDED), need: DREAMS_NEEDED },
    { key: 'goal', done: goals.length > 0 },
    { key: 'week', done: !!weekGoal },
    { key: 'timed', done: tasks.some(t => !!t.plannedStart) },
    { key: 'telegram', done: !!profile.telegramChatId },
  ];
}

/** Сутки праздника после того, как всё сделано. */
export const CELEBRATE_MS = 24 * 60 * 60 * 1000;

export type ChecklistView = 'hidden' | 'progress' | 'celebrate';

/**
 * Что показать: скрыт или всё давно сделано — ничего; не всё — прогресс; только что закончил —
 * сутки поздравления. Если человек ни разу не видел чек-лист незаконченным (давний пользователь),
 * праздновать нечего — сразу скрыт.
 */
export function checklistView({
  dismissed,
  allDone,
  seenIncomplete,
  doneAt,
  now,
}: {
  dismissed: boolean;
  allDone: boolean;
  seenIncomplete: boolean;
  doneAt: number | null;
  now: number;
}): ChecklistView {
  if (dismissed) return 'hidden';
  if (!allDone) return 'progress';
  if (!seenIncomplete) return 'hidden';
  if (doneAt === null) return 'celebrate';
  return now - doneAt < CELEBRATE_MS ? 'celebrate' : 'hidden';
}
