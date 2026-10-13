import type { Idea } from '@/lib/types';

/**
 * Идеи: чистая логика без интерфейса. Идея приходит в голову — её записывают («Новые»), потом берут в работу
 * («В работе») и доводят («Реализованные»).
 */

export type IdeaStatus = 'new' | 'work' | 'done';

/** Этапы по порядку, как и вкладки. */
export const IDEA_STATUSES: readonly IdeaStatus[] = ['new', 'work', 'done'];

/** Название вкладки. */
export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = { new: 'Новые', work: 'В работе', done: 'Реализованные' };

/** Как назвать перенос на этот этап (кнопка и меню). */
export const IDEA_MOVE_LABEL: Record<IdeaStatus, string> = { new: 'В новые', work: 'В работу', done: 'Реализована' };

/** Следующий этап для кнопки «дальше»; у реализованной следующего нет. */
export const NEXT_IDEA_STATUS: Partial<Record<IdeaStatus, IdeaStatus>> = { new: 'work', work: 'done' };

/** Нет статуса (или он незнакомый) — новая: так читаются идеи, которые пришли из бота и файла импорта без статуса. */
export const statusOf = (idea: Pick<Idea, 'status'>): IdeaStatus =>
  IDEA_STATUSES.includes(idea.status as IdeaStatus) ? (idea.status as IdeaStatus) : 'new';

export type SplitIdeas = Record<IdeaStatus, Idea[]>;

/** По этапам; в каждом новые записи выше. */
export function splitIdeas(ideas: readonly Idea[]): SplitIdeas {
  const out: SplitIdeas = { new: [], work: [], done: [] };
  for (const i of ideas) out[statusOf(i)].push(i);
  const newestFirst = (a: Idea, b: Idea) => b.createdAt.localeCompare(a.createdAt) || a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' });
  for (const st of IDEA_STATUSES) out[st].sort(newestFirst);
  return out;
}

/** Перенести на другой этап: возвращает новую строку, исходную не трогает. */
export const moveIdea = (idea: Idea, status: IdeaStatus): Idea => ({ ...idea, status });
