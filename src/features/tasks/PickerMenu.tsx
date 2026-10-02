import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Check, Search } from 'lucide-react';
import { Popover } from '@/components/ui/Popover';
import { normalize } from '@/lib/parse/quickParse';

export interface PickerItem {
  id: string;
  label: string;
  emoji?: string;
  icon?: ReactNode;
  /** Подпись группы (горизонт цели, доска): пункты одной группы идут подряд. */
  group?: string;
}

/**
 * Выпадающий выбор с произвольной кнопкой-триггером (чип «Доска ▾», строка свойства «Цель»).
 * Общий `Menu` умеет только кнопку «⋯», поэтому здесь — свой триггер и, по желанию, поиск.
 * Клавиатура: стрелки/Home/End по пунктам, из поиска ↓ — к первому пункту, Enter — выбрать первый найденный,
 * Esc закрывает и возвращает фокус на триггер. Кандидат в `components/ui`.
 */
export const PickerMenu = forwardRef<
  HTMLButtonElement,
  {
    items: PickerItem[];
    value?: string;
    onSelect: (id: string) => void;
    /** Имя меню для скринридера и подпись триггера, если в нём только иконка. */
    label: string;
    searchable?: boolean;
    placeholder?: string;
    /** Пункт «ничего» сверху (id — пустая строка). */
    noneLabel?: string;
    emptyText?: string;
    align?: 'start' | 'end';
    disabled?: boolean;
    className?: string;
    children: ReactNode;
    title?: string;
  }
>(function PickerMenu(
  { items, value, onSelect, label, searchable, placeholder = 'Найти', noneLabel, emptyText = 'Ничего не нашлось', align = 'start', disabled, className = '', children, title },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => trigger.current as HTMLButtonElement);

  const all = useMemo(() => (noneLabel ? [{ id: '', label: noneLabel } as PickerItem, ...items] : items), [items, noneLabel]);
  const shown = useMemo(() => {
    const nq = normalize(q.trim());
    return nq ? all.filter(i => i.id && normalize(i.label).includes(nq)) : all;
  }, [all, q]);

  const nodes = () => Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[data-pick]') ?? []);

  useEffect(() => {
    if (!open) return;
    const r = requestAnimationFrame(() => {
      if (searchable) search.current?.focus();
      else (nodes().find(n => n.getAttribute('aria-checked') === 'true') ?? nodes()[0])?.focus();
    });
    return () => cancelAnimationFrame(r);
  }, [open, searchable]);

  const close = (refocus = true) => {
    setOpen(false);
    setQ('');
    if (refocus) trigger.current?.focus();
  };

  const pick = (itemId: string) => {
    close();
    onSelect(itemId);
  };

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const all = nodes();
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (e.key === 'ArrowDown') next = i < 0 || i === all.length - 1 ? 0 : i + 1;
    else if (e.key === 'ArrowUp') {
      if (i <= 0 && searchable) {
        e.preventDefault();
        search.current?.focus();
        return;
      }
      next = i <= 0 ? all.length - 1 : i - 1;
    } else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = all.length - 1;
    else if (e.key === 'Tab') {
      close(false);
      return;
    } else if (searchable && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // Печать на пункте — продолжение поиска.
      search.current?.focus();
      return;
    }
    if (next < 0) return;
    e.preventDefault();
    all[next]?.focus();
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={e => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={className}
      >
        {children}
      </button>
      <Popover anchor={trigger} open={open} onClose={() => close(false)} align={align} className="w-64 max-w-[calc(100vw-2rem)] p-1">
        {searchable ? (
          <div className="relative mb-1">
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              ref={search}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={placeholder}
              aria-label={`${label}: поиск`}
              aria-controls={id}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  nodes()[0]?.focus();
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const first = shown.find(i => i.id) ?? shown[0];
                  if (first) pick(first.id);
                } else if (e.key === 'Tab') close(false);
              }}
              className="h-8 w-full rounded-control bg-fill pl-8 pr-3 text-small text-text placeholder:text-muted focus-field pointer-coarse:h-11"
            />
          </div>
        ) : null}
        <div ref={list} id={id} role="menu" aria-label={label} onKeyDown={onListKey} className="max-h-72 overflow-y-auto scroll-thin">
          {shown.length ? null : <p className="px-2 py-2 text-small text-muted">{emptyText}</p>}
          {shown.map((item, idx) => {
            const header = item.group && item.group !== shown[idx - 1]?.group ? item.group : null;
            const checked = (value ?? '') === item.id;
            return (
              <div key={item.id || 'none'} role="none">
                {header ? (
                  <div role="presentation" className="px-2 pt-2 pb-1 label-text text-muted">
                    {header}
                  </div>
                ) : null}
                <button
                  type="button"
                  data-pick=""
                  role="menuitemradio"
                  aria-checked={checked}
                  tabIndex={-1}
                  onClick={() => pick(item.id)}
                  className={`focus-ring-inset flex h-8 w-full items-center gap-2 rounded-control px-2 text-left text-small hover:bg-fill focus-visible:bg-fill pointer-coarse:h-11 ${
                    item.id ? 'text-text' : 'text-muted-strong'
                  }`}
                >
                  {item.emoji ? (
                    <span aria-hidden="true" className="font-emoji w-4 shrink-0 text-center">
                      {item.emoji}
                    </span>
                  ) : item.icon ? (
                    <span aria-hidden="true" className="inline-flex w-4 shrink-0 justify-center text-muted">
                      {item.icon}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {checked ? <Check size={14} aria-hidden="true" className="shrink-0 text-accent-strong" /> : null}
                </button>
              </div>
            );
          })}
        </div>
      </Popover>
    </>
  );
});
