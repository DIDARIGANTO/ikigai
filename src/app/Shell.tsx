import { useCallback, useEffect, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';
import { ToastProvider } from '@/components/ui/Toast';
import { cloudEnabled, getStore } from '@/data';
import { ensureDefaults, loadDemo } from '@/data/seed';
import type { Store } from '@/data/store';
import { QuickCaptureProvider, useQuickCapture } from '@/features/quick/QuickCapture';
import { SearchProvider, useSearch } from '@/features/search/SearchDialog';
import { TaskActionsProvider } from '@/features/tasks/TaskActionsContext';
import { MobileNav } from './MobileNav';
import { ShellActionsProvider } from './ShellActions';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useGlobalHotkeys } from './useGlobalHotkeys';

/**
 * Какое хранилище уже подготовлено. Не булев флаг, а сам экземпляр: StrictMode
 * монтирует эффекты дважды (готовить надо один раз), но после смены пользователя
 * `AuthGate` ставит новое хранилище — и подготовку надо повторить для него.
 */
let bootstrapped: Store | null = null;

async function bootstrap() {
  let store: Store;
  try {
    store = getStore();
  } catch (e) {
    // Облачный режим до входа: хранилища ещё нет, готовить нечего.
    console.error('Не удалось подготовить хранилище', e);
    return;
  }
  if (bootstrapped === store) return;
  bootstrapped = store;
  try {
    await ensureDefaults(store);
    // Облачный аккаунт начинается пустым: чужие демо-задачи в личном кабинете
    // выглядят как чужие данные, да ещё и уезжают на сервер.
    if (cloudEnabled) return;
    const profiles = await store.list('profiles');
    if (!profiles.length) await loadDemo(store);
  } catch (e) {
    bootstrapped = null;
    console.error('Не удалось подготовить хранилище', e);
  }
}

/** Хоткеи и заголовок вкладки живут внутри провайдера действий каркаса. */
function Hotkeys() {
  useGlobalHotkeys();
  return null;
}

/** Каркас внутри провайдеров: связывает быструю запись и поиск с меню и клавишами N и /. */
function Chrome() {
  const { open } = useQuickCapture();
  const { open: openSearch } = useSearch();
  const { pathname } = useLocation();
  // Отдельная обёртка: обработчик клика не должен передавать событие как тип записи.
  const openQuick = useCallback(() => open(), [open]);
  const actions = useMemo(() => ({ openQuick, openSearch }), [openQuick, openSearch]);
  return (
    <ShellActionsProvider value={actions}>
      <Hotkeys />
      {/* Первый Tab — сразу к содержимому, мимо меню. */}
      <a
        href="#app-main"
        onClick={e => {
          e.preventDefault();
          document.getElementById('app-main')?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-control focus:border focus:border-border focus:bg-raised focus:px-3 focus:py-2 focus:text-body focus:font-medium focus:text-text focus:shadow-(--shadow-pop)"
      >
        К содержимому
      </a>
      <div className="grid grid-rows-[minmax(0,1fr)] md:grid-cols-[auto_1fr] h-full">
        <Sidebar />
        <div className="flex flex-col min-w-0 h-full">
          <TopBar />
          <main
            id="app-main"
            tabIndex={-1}
            className="relative flex-1 min-h-0 px-4 pt-3 pb-[calc(5rem+env(safe-area-inset-bottom))] md:px-8 md:pt-8 md:pb-10 overflow-y-auto scroll-thin focus:outline-none"
          >
            {/* Смена раздела: новая страница мягко появляется (ключ по адресу), а старая, если браузер
                умеет View Transitions и переход шёл через меню, успевает растаять. */}
            <div key={pathname} className="animate-in" style={{ viewTransitionName: 'page' }}>
              <Outlet />
            </div>
          </main>
        </div>
        <MobileNav />
      </div>
    </ShellActionsProvider>
  );
}

export function Shell() {
  useEffect(() => {
    void bootstrap();
  }, []);

  return (
    <ToastProvider>
      {/* Подтверждения нужны всем разделам, поэтому провайдер лежит выше остальных. */}
      <ConfirmProvider>
        {/* Действия над задачами — выше быстрой записи: её диалог рисуется рядом с children, а не внутри них. */}
        <TaskActionsProvider>
          <QuickCaptureProvider>
            <SearchProvider>
              <Chrome />
            </SearchProvider>
          </QuickCaptureProvider>
        </TaskActionsProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
