import type { ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Место для служебных плашек поверх приложения (сбой хранилища, копия данных, новая версия).
 * Не сдвигает вёрстку каркаса: на телефоне — сверху, на компьютере — в правом нижнем углу,
 * чтобы не спорить с уведомлениями по центру снизу.
 */
export function BannerStack({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed z-50 inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] px-3 flex flex-col gap-2 pointer-events-none md:inset-x-auto md:top-auto md:right-6 md:bottom-6 md:w-[380px] md:px-0"
      aria-live="polite"
    >
      {children}
    </div>
  );
}

/** Одна плашка: приподнятая полоса с линией — значок 16 px, текст 13 px, действие и (необязательно) «закрыть». */
export function Banner({
  tone = 'neutral',
  icon,
  children,
  action,
  onDismiss,
}: {
  tone?: 'neutral' | 'danger';
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`animate-pop pointer-events-auto flex min-h-11 items-center gap-2.5 rounded-control border bg-raised py-1.5 pl-3 pr-1.5 text-small shadow-(--shadow-pop) ${
        tone === 'danger' ? 'border-danger/40' : 'border-border'
      }`}
    >
      {icon ? (
        <span
          className={`inline-flex shrink-0 [&_svg]:size-4 ${tone === 'danger' ? 'text-danger-strong' : 'text-muted'}`}
          aria-hidden="true"
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1 text-text">{children}</div>
      {action}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Скрыть"
          className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted hover:text-text hover:bg-fill focus-ring"
        >
          <X size={16} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
