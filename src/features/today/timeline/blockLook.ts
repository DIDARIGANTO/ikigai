import type { Task } from '@/lib/types';

/** Смысл блока: работа, личное или нейтральное (тренировка). */
export type BlockMeaning = 'work' | 'personal' | 'neutral';

export function blockMeaning(task: Pick<Task, 'kind' | 'area'>): BlockMeaning {
  if (task.kind === 'workout') return 'neutral';
  return task.area === 'work' ? 'work' : 'personal';
}

/** Левая полоса 2 px — единственный цвет блока: работа — акцент, личное — бирюза, остальное — нейтрально. */
const BAR: Record<BlockMeaning, string> = {
  work: 'bg-accent',
  personal: 'bg-personal',
  neutral: 'bg-muted',
};

export interface BlockLook {
  /** Фон и линия плана (рамка 1 px задаётся у самого блока). */
  box: string;
  /** Левая полоса 2 px. */
  bar: string;
  /** Цвет заголовка. */
  title: string;
  closed: boolean;
}

/**
 * Нейтральный блок «Графита»: поверхность `raised` и линия 1 px, смысл — только полосой слева.
 * Идёт — акцентная полоса и лёгкая заливка; закрыт — без заливки, приглушённый текст;
 * пропущен — тот же блок, лишь линия пунктиром.
 */
export function blockLook(task: Task, state: { running?: boolean; missed?: boolean } = {}): BlockLook {
  const closed = task.status === 'done' || task.status === 'skipped';
  if (closed) return { box: 'bg-surface border-border', bar: 'bg-border-strong', title: 'text-muted', closed };
  if (state.running) return { box: 'bg-raised border-border-strong', bar: 'bg-accent', title: 'text-text', closed };
  return {
    box: state.missed ? 'bg-raised border-dashed border-warning/40' : 'bg-raised border-border',
    bar: BAR[blockMeaning(task)],
    title: 'text-text',
    closed,
  };
}

/** Ширина колонки с подписями времени и поле справа. */
export const GUTTER_PX = 46;
export const RIGHT_PX = 8;

/** Горизонталь дорожки: колонки делят ширину справа от подписей часов и становятся уже, а не наезжают. */
export function laneStyle(lane: number, lanes: number) {
  const track = `(100% - ${GUTTER_PX + RIGHT_PX}px)`;
  return {
    left: `calc(${GUTTER_PX}px + ${track} * ${lane / lanes})`,
    width: `calc(${track} / ${lanes} - ${lanes > 1 ? 4 : 0}px)`,
  };
}
