import type { Store } from '@/data/store';
import type { Dream, Goal, Profile, Task } from '@/lib/types';
import { DEFAULT_PROFILE } from '@/data/hooks';
import { newId, nowISO } from '@/lib/ids';
import { newTask } from '@/features/tasks/useTaskActions';

/** Подсказки к первой мечте: заполняют поле одним нажатием, а заодно предлагают первый шаг. */
export interface DreamSuggestion {
  title: string;
  emoji: string;
  category: string;
  step: string;
}

export const DREAM_SUGGESTIONS: DreamSuggestion[] = [
  { title: 'Пробежать полумарафон', emoji: '🏃', category: 'Тело', step: 'Лёгкая пробежка 3 км' },
  { title: 'Путешествие в Японию', emoji: '🗻', category: 'Путешествия', step: 'Посчитать бюджет поездки' },
  { title: 'Запустить свой проект', emoji: '🚀', category: 'Дело', step: 'Описать идею на одной странице' },
  { title: 'Выучить язык', emoji: '🗣️', category: 'Разум', step: 'Выбрать курс и пройти первый урок' },
  { title: 'Накопить на квартиру', emoji: '🏠', category: 'Дом', step: 'Посчитать, сколько откладывать в месяц' },
  { title: 'Читать больше', emoji: '📚', category: 'Разум', step: 'Выбрать книгу и прочитать 20 страниц' },
];

export const DEFAULT_STEP = 'Полчаса на первый шаг';

/** Название недельной подцели, которая становится «целью недели». */
export const WEEK_GOAL_TITLE = 'Первый шаг';

/** Свежий профиль из хранилища, дополненный заплаткой. Читаем заново — не из замыкания экрана. */
export async function patchProfile(store: Store, patch: Partial<Profile>): Promise<Profile> {
  const current = (await store.list('profiles'))[0] ?? { ...DEFAULT_PROFILE, createdAt: nowISO() };
  const next: Profile = { ...current, ...patch, id: 'me', updatedAt: nowISO() };
  await store.put('profiles', next);
  return next;
}

/** Мечта из знакомства: создаёт новую или правит уже созданную (если вернулись на шаг назад). */
export async function saveDream(
  store: Store,
  existingId: string | undefined,
  patch: Pick<Dream, 'title' | 'emoji' | 'category'>,
): Promise<Dream> {
  const now = nowISO();
  const prev = existingId ? (await store.list('dreams')).find(d => d.id === existingId) : undefined;
  const dream: Dream = prev
    ? { ...prev, ...patch, updatedAt: now }
    : { id: newId(), createdAt: now, updatedAt: now, ...patch };
  await store.put('dreams', dream);
  return dream;
}

export interface FirstPathInput {
  dream: Dream;
  goalTitle: string;
  taskTitle: string;
  date: string;
  time: string;
  minutes: number;
}

export interface FirstPath {
  goal: Goal;
  weekGoal: Goal;
  task: Task;
}

/**
 * Мечта → цель на год → цель недели «Первый шаг» → задача со временем.
 * Цель недели сразу ставится в профиль — она появится на «Сегодня».
 */
export async function createFirstPath(store: Store, input: FirstPathInput): Promise<FirstPath> {
  const now = nowISO();
  const base = { createdAt: now, updatedAt: now, status: 'active' as const };
  const goal: Goal = {
    id: newId(),
    title: input.goalTitle.trim() || input.dream.title,
    emoji: input.dream.emoji,
    horizon: 'year',
    dreamId: input.dream.id,
    ...base,
  };
  const weekGoal: Goal = { id: newId(), title: WEEK_GOAL_TITLE, horizon: 'week', parentId: goal.id, ...base };
  await store.putMany('goals', [goal, weekGoal]);
  await store.put('dreams', { ...input.dream, goalId: goal.id, updatedAt: now });

  // Шаг — на личную доску, в колонку «Надо», как любая задача из редактора.
  const boards = await store.list('boards');
  const columns = await store.list('columns');
  const board = boards.find(b => b.title === 'Личное') ?? boards[0];
  const column = board ? columns.find(c => c.boardId === board.id && c.kind === 'todo') : undefined;
  const task = newTask({
    title: input.taskTitle.trim() || DEFAULT_STEP,
    area: 'personal',
    boardId: board?.id,
    columnId: column?.id,
    goalId: weekGoal.id,
    date: input.date,
    plannedStart: input.time || undefined,
    plannedMinutes: input.minutes,
  });
  await store.put('tasks', task);
  await patchProfile(store, { weekGoalId: weekGoal.id });
  return { goal, weekGoal, task };
}
