import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Иконка или цветная точка перед подписью (в `stack` — над ней). */
  icon?: ReactNode;
  /** Счётчик справа от подписи. */
  count?: number;
  /** Подпись для скринридера, если на экране только иконка. */
  ariaLabel?: string;
  /** id панели, которой управляет вкладка (только для `role="tabs"`). */
  controls?: string;
}

export type SegmentedSize = 'sm' | 'md' | 'lg';

/**
 * Единственный переключатель «одно из»: дорожка с радиусом 2 и «бегунок», который за 150 мс
 * (ease-out, без пружины) переезжает к выбранному сегменту. Клавиатура: стрелки/Home/End двигают выбор, Tab — один стоп на группу.
 * `kind="radio"` — выбор значения (radiogroup), `kind="tabs"` — вкладки над панелью (tablist).
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  labelledBy,
  size = 'md',
  layout = 'row',
  kind = 'radio',
  fullWidth = false,
  iconOnly = false,
  className = '',
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (next: T) => void;
  /** Имя группы для скринридера, если рядом нет видимой подписи. */
  label?: string;
  labelledBy?: string;
  size?: SegmentedSize;
  /** `stack` — иконка над подписью (для четырёх и более сегментов в узких местах). */
  layout?: 'row' | 'stack';
  kind?: 'radio' | 'tabs';
  /** Растянуть на всю ширину, сегменты поровну. */
  fullWidth?: boolean;
  /** Показывать только иконки (подпись уходит в aria-label и title). */
  iconOnly?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const track = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  // Значения нет среди вариантов (ещё не выбрано) — ничего не отмечено, Tab попадает на первый сегмент.
  const selected = options.findIndex(o => o.value === value);
  const index = Math.max(0, selected);

  const measure = useCallback(() => {
    if (selected < 0) return;
    const el = refs.current[index];
    if (!el || !el.offsetWidth) return;
    setThumb(prev =>
      prev && prev.left === el.offsetLeft && prev.width === el.offsetWidth
        ? prev
        : { left: el.offsetLeft, width: el.offsetWidth },
    );
  }, [index, selected]);

  useLayoutEffect(() => {
    measure();
    if (typeof ResizeObserver === 'undefined' || !track.current) return;
    const ro = new ResizeObserver(measure);
    ro.observe(track.current);
    return () => ro.disconnect();
  }, [measure, options.length]);

  const move = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = options.length - 1;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = i === last ? 0 : i + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = i === 0 ? last : i - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next < 0) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(options[next].value);
  };

  const stack = layout === 'stack';
  const seg = stack
    ? 'h-14 flex-col gap-1 px-1 text-caption [&_svg]:size-4'
    : {
        sm: 'h-6 gap-1.5 px-2 text-caption pointer-coarse:h-9 [&_svg]:size-3.5',
        md: 'h-7 gap-1.5 px-2.5 text-small pointer-coarse:h-10 [&_svg]:size-4',
        lg: 'h-8 gap-2 px-3 text-body [&_svg]:size-4',
      }[size];
  const iconSeg = iconOnly && !stack ? { sm: 'w-6 px-0 pointer-coarse:w-9', md: 'w-7 px-0 pointer-coarse:w-10', lg: 'w-8 px-0' }[size] : '';

  return (
    <div
      ref={track}
      role={kind === 'tabs' ? 'tablist' : 'radiogroup'}
      aria-label={label}
      aria-labelledby={labelledBy}
      className={`relative isolate items-stretch gap-0.5 rounded-control bg-fill p-0.5 ${fullWidth ? 'flex w-full' : 'inline-flex max-w-full overflow-x-auto scroll-thin'} ${className}`}
    >
      {thumb && selected >= 0 ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-0.5 -z-10 rounded-chip border border-border bg-raised shadow-(--shadow-raised) transition-[left,width] duration-(--duration-base) ease-out-soft dark:border-border-strong dark:bg-fill-strong"
          style={{ left: thumb.left, width: thumb.width }}
        />
      ) : null}
      {options.map((o, i) => {
        const active = i === selected;
        const a11y =
          kind === 'tabs'
            ? { role: 'tab', 'aria-selected': active, 'aria-controls': o.controls }
            : { role: 'radio', 'aria-checked': active };
        return (
          <button
            key={o.value}
            ref={el => {
              refs.current[i] = el;
            }}
            type="button"
            {...a11y}
            tabIndex={i === index ? 0 : -1}
            aria-label={iconOnly ? (o.ariaLabel ?? o.label) : o.ariaLabel}
            title={iconOnly ? o.label : undefined}
            onClick={() => onChange(o.value)}
            onKeyDown={e => move(e, i)}
            className={`focus-ring relative inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-chip font-medium ${seg} ${fullWidth ? 'min-w-0 flex-1 px-1.5' : ''} ${iconSeg} ${
              active ? `text-text ${thumb ? '' : 'bg-raised ring-1 ring-border'}` : 'text-muted hover:text-text'
            }`}
          >
            {o.icon ? (
              <span aria-hidden="true" className="inline-flex shrink-0">
                {o.icon}
              </span>
            ) : null}
            {iconOnly ? null : <span className="truncate">{o.label}</span>}
            {o.count !== undefined ? (
              <span className={`font-numeral text-caption ${active ? 'text-muted-strong' : 'text-muted'}`}>{o.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
