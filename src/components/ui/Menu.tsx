import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Check, MoreHorizontal } from 'lucide-react';
import { IconButton } from './Button';
import type { ButtonSize } from './Button';
import { Popover } from './Popover';

export type MenuEntry =
  | {
      type: 'item';
      label: string;
      onSelect: () => void;
      icon?: ReactNode;
      danger?: boolean;
      disabled?: boolean;
      /** Пункт-флажок: галочка слева, `role="menuitemcheckbox"`. */
      checked?: boolean;
    }
  | { type: 'label'; label: string }
  | { type: 'separator' };

/**
 * Единственное выпадающее меню «⋯». Стрелки ходят по пунктам, Home/End — к краям,
 * Esc и Tab закрывают, фокус возвращается на кнопку. Появляется коротким сдвигом и прозрачностью (@starting-style).
 */
export function Menu({
  label,
  entries,
  size = 'md',
  className = '',
  triggerClassName = '',
}: {
  label: string;
  entries: MenuEntry[];
  size?: ButtonSize;
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const items = () => Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[data-menuitem]:not(:disabled)') ?? []);

  // Открылось — фокус на первый доступный пункт.
  useEffect(() => {
    if (!open) return;
    const r = requestAnimationFrame(() => items()[0]?.focus());
    return () => cancelAnimationFrame(r);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const all = items();
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (e.key === 'ArrowDown') next = i < 0 || i === all.length - 1 ? 0 : i + 1;
    else if (e.key === 'ArrowUp') next = i <= 0 ? all.length - 1 : i - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = all.length - 1;
    else if (e.key === 'Tab') {
      close(false);
      return;
    }
    if (next < 0) return;
    e.preventDefault();
    all[next]?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      <IconButton
        ref={trigger}
        size={size}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`${open ? 'bg-fill text-text' : ''} ${triggerClassName}`}
      >
        <MoreHorizontal size={16} />
      </IconButton>

      <Popover anchor={trigger} open={open} onClose={() => close(false)} className="min-w-52 p-1">
        <div ref={list} id={id} role="menu" aria-label={label} onKeyDown={onKey}>
          {entries.map((entry, i) => {
            if (entry.type === 'separator') {
              return <div key={i} role="separator" className="my-1 -mx-1 h-px bg-border" />;
            }
            if (entry.type === 'label') {
              return (
                <div key={i} role="presentation" className="px-2 pt-2 pb-1 label-text text-muted">
                  {entry.label}
                </div>
              );
            }
            const checkable = entry.checked !== undefined;
            return (
              <button
                key={i}
                type="button"
                data-menuitem=""
                role={checkable ? 'menuitemcheckbox' : 'menuitem'}
                aria-checked={checkable ? entry.checked : undefined}
                disabled={entry.disabled}
                tabIndex={-1}
                onClick={() => {
                  close();
                  entry.onSelect();
                }}
                className={`focus-ring-inset w-full text-left px-2 h-8 pointer-coarse:h-11 rounded-control text-small flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none ${
                  entry.danger
                    ? 'text-danger-strong hover:bg-danger-soft focus-visible:bg-danger-soft'
                    : 'text-text hover:bg-fill focus-visible:bg-fill'
                }`}
              >
                {checkable ? (
                  <Check size={16} aria-hidden="true" className={`shrink-0 ${entry.checked ? 'text-accent-strong' : 'text-transparent'}`} />
                ) : entry.icon ? (
                  <span aria-hidden="true" className={`inline-flex shrink-0 [&_svg]:size-4 ${entry.danger ? '' : 'text-muted'}`}>
                    {entry.icon}
                  </span>
                ) : null}
                {entry.label}
              </button>
            );
          })}
        </div>
      </Popover>
    </div>
  );
}
