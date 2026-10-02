import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Goal } from '@/lib/types';
import { useCollection } from '@/data/hooks';
import { useTaskActions } from './useTaskActions';

/**
 * Одна подписка на задачи, колонки и цели на всё приложение.
 * Без контекста каждая карточка и каждый таймер открывали бы свои подписки на те же коллекции.
 */
export type TaskActionsValue = ReturnType<typeof useTaskActions> & { goals: Goal[] };

const Ctx = createContext<TaskActionsValue | null>(null);

export function TaskActionsProvider({ children }: { children: ReactNode }) {
  const actions = useTaskActions();
  const goals = useCollection('goals');
  const value = useMemo<TaskActionsValue>(() => ({ ...actions, goals }), [actions, goals]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// oxlint-disable-next-line react/only-export-components -- хук живёт рядом со своим провайдером
export function useTaskActionsCtx(): TaskActionsValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTaskActionsCtx: нужен <TaskActionsProvider>');
  return ctx;
}
