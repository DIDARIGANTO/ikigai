import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { ShortcutHandler } from './features/pwa/ShortcutHandler';
import { WelcomeGate } from './features/onboarding/WelcomeGate';

/** Пока грузится код раздела — спокойная заготовка страницы из токенов, без спиннеров. */
function PageSkeleton() {
  return (
    <div className="mx-auto max-w-[1120px] animate-pulse" aria-busy="true" aria-label="Загрузка раздела">
      <div className="h-9 w-56 rounded-bar bg-fill" />
      <div className="mt-6 h-40 rounded-card bg-surface shadow-(--shadow-raised)" />
      <div className="mt-4 h-24 rounded-card bg-surface shadow-(--shadow-raised)" />
    </div>
  );
}

/** Рамка раздела внутри каркаса: ярлыки приложения и ожидание ленивых страниц. */
export function PageFrame() {
  return (
    <>
      <ShortcutHandler />
      <WelcomeGate />
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
    </>
  );
}
