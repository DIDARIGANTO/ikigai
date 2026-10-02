import type { ReactNode } from 'react';
import type { Tone } from './tones';

/**
 * Шапка страницы: заголовок 24/30 (шрифт, вес и регистр — по образу: у «Сигнала» и «Хардкора» капителью), приглушённое описание 14 px и действия справа.
 * Иконка раздела — простая 20 px приглушённая, без плитки. `display` — приветствие «Сегодня» (28/34).
 */
export function PageHeader({
  title,
  description,
  actions,
  icon,
  display = false,
  className = '',
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Иконка раздела перед заголовком: 20 px, приглушённая. */
  icon?: ReactNode;
  /** Крупный заголовок-приветствие (только «Сегодня»). */
  display?: boolean;
  /** Оставлен для совместимости: шапка больше не тонируется. */
  tone?: Tone;
  className?: string;
}) {
  return (
    <header className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-3 ${className}`}>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon ? (
            <span aria-hidden="true" className="inline-flex shrink-0 text-muted [&_svg]:size-5">
              {icon}
            </span>
          ) : null}
          <h1 className={`min-w-0 title-text text-text break-words ${display ? 'text-display' : 'text-h1'}`}>{title}</h1>
        </div>
        {description ? <div className="mt-1 text-body text-muted">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
