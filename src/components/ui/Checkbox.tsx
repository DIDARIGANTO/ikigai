import type { ReactNode } from 'react';

/**
 * Чекбокс: видимый квадрат 16 px (радиус 4) внутри цели 44 px на сенсорных экранах.
 * Граница поля ≥ 3:1 к фону; отмеченный — заливка акцентом и белая галочка, которая
 * прорисовывается за 120 мс (без «щелчка» и пружины). При первой отрисовке галочка
 * уже на месте: переход срабатывает только на смену состояния.
 * `tone` оставлен для совместимости: в «Графите» один акцент для всех задач.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  tone: _tone = 'accent',
  className = '',
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  tone?: 'accent' | 'personal';
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <label
      className={`relative inline-flex items-center gap-2 select-none ${disabled ? 'opacity-40' : 'cursor-pointer'} ${className}`}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={e => onChange(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className={`relative inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-(--duration-fast) peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent pointer-coarse:before:absolute pointer-coarse:before:-inset-3.5 pointer-coarse:before:content-[''] ${
          checked ? 'border-accent bg-accent text-on-accent' : 'border-control-border bg-transparent text-transparent hover:border-muted-strong'
        }`}
      >
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M3.5 8.5 6.5 11.5 12.5 4.5"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={checked ? 0 : 1}
            className={checked ? 'transition-[stroke-dashoffset] duration-[120ms] ease-out-soft' : ''}
          />
        </svg>
      </span>
      {label ? <span className="text-body">{label}</span> : null}
    </label>
  );
}
