import { useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Search, SmilePlus } from 'lucide-react';
import { EMOJI_CATEGORIES, EMOJI_NAMES, searchEmoji } from './emojiData';
import { Popover } from './Popover';
import { Segmented } from './Segmented';
import type { Tone } from './tones';

const COLS = 8;

/**
 * Панель выбора эмодзи: поиск по-русски, вкладки категорий, сетка 8 колонок.
 * Стрелки ходят по сетке, Enter выбирает. Возвращает строку эмодзи или `undefined` («Убрать»).
 */
export function EmojiPicker({
  value,
  onChange,
  autoFocus = true,
}: {
  value?: string;
  onChange: (emoji: string | undefined) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState(EMOJI_CATEGORIES[0].key);
  const grid = useRef<HTMLDivElement>(null);
  const gridId = useId();

  const found = useMemo(() => searchEmoji(query), [query]);
  const searching = query.trim().length > 0;
  const items = searching ? found : (EMOJI_CATEGORIES.find(c => c.key === cat)?.items ?? []);

  const cells = () => Array.from(grid.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const all = cells();
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS }[e.key];
    let next = step === undefined ? -1 : i + step;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = all.length - 1;
    if (next < 0 || next >= all.length) return;
    e.preventDefault();
    all[next].focus();
  };

  return (
    <div className="w-[min(20.5rem,calc(100vw-2rem))] p-3">
      <label className="flex h-8 items-center gap-2 rounded-control border border-border bg-surface px-2.5 focus-within:outline-2 focus-within:outline-accent">
        <Search size={14} aria-hidden="true" className="shrink-0 text-muted" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              cells()[0]?.focus();
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (items[0]) onChange(items[0]);
            }
          }}
          placeholder="Найти: кофе, спорт, дом…"
          aria-label="Поиск эмодзи"
          aria-controls={gridId}
          className="h-full min-w-0 flex-1 bg-transparent text-small text-text outline-none placeholder:text-muted"
        />
      </label>

      {searching ? null : (
        <Segmented
          kind="tabs"
          label="Категории эмодзи"
          value={cat}
          onChange={setCat}
          size="sm"
          iconOnly
          fullWidth
          className="mt-2"
          options={EMOJI_CATEGORIES.map(c => ({
            value: c.key,
            label: c.label,
            icon: <span className="font-emoji text-base leading-none">{c.tab}</span>,
            controls: gridId,
          }))}
        />
      )}

      <p className="mt-3 mb-1 px-0.5 text-caption font-medium text-muted" aria-live="polite">
        {searching ? (found.length ? `Найдено: ${found.length}` : 'Ничего не нашлось') : EMOJI_CATEGORIES.find(c => c.key === cat)?.label}
      </p>
      <div
        ref={grid}
        id={gridId}
        role={searching ? 'listbox' : 'tabpanel'}
        aria-label="Эмодзи"
        onKeyDown={onGridKey}
        className="grid grid-cols-8 gap-0.5"
      >
        {items.map(e => (
          <button
            key={e}
            type="button"
            role={searching ? 'option' : undefined}
            aria-selected={searching ? e === value : undefined}
            aria-label={EMOJI_NAMES[e]?.split(' ')[0] ?? e}
            title={EMOJI_NAMES[e]?.split(' ')[0]}
            onClick={() => onChange(e)}
            className={`focus-ring font-emoji flex aspect-square items-center justify-center rounded-control text-xl leading-none hover:bg-fill ${
              e === value ? 'bg-fill-strong ring-1 ring-inset ring-accent' : ''
            }`}
          >
            {e}
          </button>
        ))}
      </div>

      {value ? (
        <div className="mt-2 flex justify-end border-t border-border pt-2">
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="focus-ring h-8 rounded-md px-2 text-small font-medium text-muted-strong hover:bg-fill hover:text-text"
          >
            Убрать эмодзи
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Эмодзи как содержимое — просто символ без цветной подложки (карточки, строки). `tone` — для совместимости. */
export function EmojiBadge({
  emoji,
  tone = 'neutral',
  size = 'md',
  className = '',
}: {
  emoji: string;
  tone?: Tone;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-tone={tone}
      className={`font-emoji inline-flex shrink-0 items-center justify-center leading-none ${
        size === 'sm' ? 'size-5 text-sm' : 'size-6 text-base'
      } ${className}`}
    >
      {emoji}
    </span>
  );
}

/**
 * Кнопка, открывающая выбор эмодзи: нейтральный квадрат с линией. Без эмодзи — иконка «добавить».
 * `fallback` — что показать вместо пустой иконки (например, значок раздела).
 */
export function EmojiPickerButton({
  value,
  onChange,
  tone = 'neutral',
  size = 40,
  label = 'Эмодзи',
  fallback,
  className = '',
}: {
  value?: string;
  onChange: (emoji: string | undefined) => void;
  tone?: Tone;
  size?: 36 | 40 | 48;
  label?: string;
  fallback?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const box = { 36: 'size-9 rounded-control text-lg', 40: 'size-10 rounded-control text-xl', 48: 'size-12 rounded-control text-2xl' }[size];
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={value ? `${label}: ${value}. Изменить` : `${label}: выбрать`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        data-tone={tone}
        className={`focus-ring group relative inline-flex shrink-0 items-center justify-center leading-none border border-border bg-surface hover:bg-fill ${box} ${
          value ? '' : 'text-muted hover:text-text'
        } ${className}`}
      >
        {value ? <span className="font-emoji">{value}</span> : (fallback ?? <SmilePlus size={18} aria-hidden="true" />)}
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} align="start" role="dialog" label="Выбор эмодзи">
        <EmojiPicker
          value={value}
          onChange={e => {
            onChange(e);
            setOpen(false);
            anchor.current?.focus();
          }}
        />
      </Popover>
    </>
  );
}
