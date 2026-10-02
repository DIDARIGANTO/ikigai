import type { Goal, Task } from '@/lib/types';

export const childGoals = (goals: Goal[], parentId: string) => goals.filter(g => g.parentId === parentId);

export function goalProgress(goal: Goal, goals: Goal[], tasks: Task[]): number {
  if (goal.status === 'done') return 1;
  const subs = childGoals(goals, goal.id);
  const own = tasks.filter(t => t.goalId === goal.id && t.status !== 'skipped');
  const total = subs.length + own.length;
  if (total === 0) return 0;
  const done = subs.filter(s => s.status === 'done').length + own.filter(t => t.status === 'done').length;
  return done / total;
}

export const HORIZON_LABEL: Record<Goal['horizon'], string> = {
  years: 'Несколько лет', year: 'Год', month: 'Месяц', week: 'Неделя',
};
