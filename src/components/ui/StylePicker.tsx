import { Check } from 'lucide-react';
import { STYLES, useStyle } from '@/app/style';
import type { StyleId } from '@/app/style';

/**
 * Мини-макет образа на настоящих токенах: элемент с `data-style` пересчитывает цвета, шрифты и углы,
 * поэтому превью выглядит ровно так, как будет выглядеть приложение, — и не расходится с globals.css.
 */
function StylePreview({ id, compact }: { id: StyleId; compact: boolean }) {
  return (
    <div
      data-style={id}
      aria-hidden="true"
      className={`relative overflow-hidden rounded-card border border-border bg-canvas font-sans text-text ${compact ? 'h-16' : 'h-24'}`}
    >
      <div className="absolute inset-y-0 left-0 w-8 border-r border-border bg-panel p-1.5">
        <span className="block size-2 rounded-mark bg-accent" />
        <span className="mt-2 block h-1 w-full rounded-bar bg-fill-strong" />
        <span className="mt-1 block h-1 w-3/4 rounded-bar bg-fill" />
        <span className="mt-1 block h-1 w-full rounded-bar bg-fill" />
      </div>
      <div className="absolute inset-y-0 left-8 right-0 p-2">
        <p className="title-text truncate text-[12px] leading-4 text-text">Сегодня</p>
        <div className="mt-1 rounded-card border border-border bg-surface p-1.5">
          <span className="block h-1 w-2/3 rounded-bar bg-text/80" />
          <span className="mt-1 block h-1 w-1/2 rounded-bar bg-muted/60" />
          {compact ? null : (
            <span className="mt-1.5 flex items-center gap-1.5">
              <span className="btn-text inline-flex h-3.5 items-center rounded-control bg-primary px-1.5 text-[8px] font-medium leading-none text-on-primary">
                Начать
              </span>
              <span className="h-1 w-8 rounded-bar bg-accent" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Выбор стиля: пять карточек с живым превью. Это группа радио-кнопок: стрелки ходят по образам,
 * выбранный применяется сразу и запоминается. `compact` — для узкого листа меню на телефоне (без пояснений).
 */
export function StylePicker({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const [style, setStyle] = useStyle();
  return (
    <fieldset className={className}>
      <legend className="sr-only">Стиль оформления</legend>
      <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {STYLES.map(s => {
          const on = style === s.id;
          return (
            <label key={s.id} className="group relative flex cursor-pointer">
              <input
                type="radio"
                name="ikigai-style"
                value={s.id}
                checked={on}
                onChange={() => setStyle(s.id)}
                className="peer sr-only"
              />
              <span
                className={`block w-full rounded-card border p-2 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
                  on ? 'border-accent ring-1 ring-accent' : 'border-border group-hover:border-border-strong'
                }`}
              >
                <StylePreview id={s.id} compact={compact} />
                <span className="mt-2 flex items-center justify-between gap-2 px-0.5">
                  <span className="text-body font-medium text-text">{s.name}</span>
                  {on ? <Check size={16} aria-hidden="true" className="shrink-0 text-accent-strong" /> : null}
                </span>
                {compact ? null : <span className="mt-0.5 block px-0.5 text-caption text-muted">{s.hint}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
