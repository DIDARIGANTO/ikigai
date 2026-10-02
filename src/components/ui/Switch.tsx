import { useId } from 'react';
import type { ReactNode } from 'react';

/**
 * Тумблер «вкл/выкл»: `role="switch"`, дорожка 30×18, бегунок едет 150 мс без пружины; форма (пилюля или острые углы)
 * и цвет бегунка — по образу. Выключенный — дорожка цвета границы поля (≥ 3:1), включённый — акцент.
 * С `label` вся строка кликабельна; без неё нужен `aria-label`.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className = '',
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  const id = useId();
  const control = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      aria-describedby={description ? `${id}-d` : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`focus-ring relative inline-flex h-4.5 w-7.5 shrink-0 items-center rounded-track border transition-colors disabled:opacity-40 pointer-coarse:before:absolute pointer-coarse:before:-inset-3.5 pointer-coarse:before:content-[''] ${
        checked ? 'border-accent bg-accent' : 'border-control-border bg-control-border'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0.5 size-3 rounded-knob transition-[translate] duration-(--duration-base) ease-out-soft ${
          checked ? 'translate-x-3 bg-knob-on' : 'translate-x-0 bg-knob-off'
        }`}
      />
    </button>
  );
  if (!label) return <span className={className}>{control}</span>;
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <label htmlFor={id} className={`min-w-0 ${disabled ? 'opacity-40' : 'cursor-pointer'}`}>
        <span className="block text-body text-text">{label}</span>
        {description ? (
          <span id={`${id}-d`} className="mt-0.5 block text-caption text-muted">
            {description}
          </span>
        ) : null}
      </label>
      {control}
    </div>
  );
}
