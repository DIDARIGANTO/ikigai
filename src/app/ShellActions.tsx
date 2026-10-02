import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useToast } from '@/components/ui/Toast';

export interface ShellActions {
  /** Открыть быструю запись (Task 6). */
  openQuick: () => void;
  /** Открыть поиск (Task 12). */
  openSearch: () => void;
}

const NOOP: ShellActions = { openQuick: () => {}, openSearch: () => {} };

const Ctx = createContext<ShellActions>(NOOP);

// oxlint-disable-next-line react/only-export-components -- хук живёт рядом со своим провайдером
export function useShellActions(): ShellActions {
  return useContext(Ctx);
}

/**
 * Пока быстрая запись и поиск не написаны, обе кнопки показывают уведомление.
 * Следующие задачи подставят настоящие реализации через `value`, интерфейс останется прежним.
 */
export function ShellActionsProvider({
  children,
  value,
}: {
  children: ReactNode;
  value?: Partial<ShellActions>;
}) {
  const toast = useToast();
  const openQuick = value?.openQuick;
  const openSearch = value?.openSearch;
  const actions = useMemo<ShellActions>(
    () => ({
      openQuick: openQuick ?? (() => toast('Скоро')),
      openSearch: openSearch ?? (() => toast('Скоро')),
    }),
    [openQuick, openSearch, toast],
  );
  return <Ctx.Provider value={actions}>{children}</Ctx.Provider>;
}
