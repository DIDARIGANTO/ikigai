import type { ReactNode } from 'react';
import { SectionIcon } from './SectionIcon';
import type { SectionKey } from '@/lib/icons';

/**
 * Пустое состояние — тихое: приглушённая иконка 20 px, заголовок 14 px, строка-подсказка 13 px
 * и одно действие. `compact` — для карточек и колонок (меньше отступы).
 */
export function EmptyState({
  k,
  icon,
  title,
  description,
  action,
  compact = false,
  className = '',
}: {
  k?: SectionKey;
  /** Своя иконка вместо значка раздела. */
  icon?: ReactNode;
  title: string;
  /** Одна строка: пример или подсказка, что сюда положить. */
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const glyph = icon ?? (k ? <SectionIcon k={k} size={20} /> : null);
  return (
    <div className={`animate-in flex flex-col items-center text-center ${compact ? 'py-6 px-4' : 'py-12 px-6'} ${className}`}>
      {glyph ? (
        <span aria-hidden="true" className="mb-3 inline-flex text-muted [&_svg]:size-5">
          {glyph}
        </span>
      ) : null}
      <h2 className="text-body font-medium text-text">{title}</h2>
      {description ? <p className="mt-1 max-w-sm text-small text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
