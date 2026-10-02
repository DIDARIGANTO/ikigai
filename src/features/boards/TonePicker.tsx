import { useRef } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { Popover } from '@/components/ui/Popover';
import { TONES } from '@/components/ui/tones';
import type { Tone } from '@/components/ui/tones';
import { PICKABLE_TONES, TONE_LABEL } from './tone';

/**
 * Выбор тона палитры: ряд точек-образцов на нейтральных кнопках (radiogroup). Стрелки двигают выбор, Enter/пробел — выбрать.
 * Живёт в папке досок, но нужен и спискам — кандидат в общие компоненты.
 */
export function TonePicker({
  value,
  onChange,
  label,
  tones = PICKABLE_TONES,
  autoFocus = false,
}: {
  value: Tone;
  onChange: (tone: Tone) => void;
  label: string;
  tones?: Tone[];
  autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, tones.indexOf(value));

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = tones.length - 1;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = i === last ? 0 : i + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = i === 0 ? last : i - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next < 0) return;
    e.preventDefault();
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-1">
      {tones.map((t, i) => {
        const active = t === value;
        return (
          <button
            key={t}
            ref={el => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={TONE_LABEL[t]}
            title={TONE_LABEL[t]}
            autoFocus={autoFocus && i === index}
            tabIndex={i === index ? 0 : -1}
            onKeyDown={e => onKey(e, i)}
            onClick={() => onChange(t)}
            className={`focus-ring inline-flex size-8 items-center justify-center rounded-control ${
              active ? 'bg-fill-strong ring-1 ring-inset ring-border-strong' : 'hover:bg-fill'
            }`}
          >
            {/* Нейтральный — пустой кружок «без цвета», остальные — точка тона. */}
            <span
              aria-hidden="true"
              className={`size-3 rounded-mark ${t === 'neutral' ? 'border border-control-border' : TONES[t].solid}`}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Слой с выбором тона у кнопки-якоря — для пункта меню «Цвет колонки» / «Цвет обложки». */
export function TonePopover({
  anchor,
  open,
  onClose,
  value,
  onChange,
  title,
}: {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  value: Tone;
  onChange: (tone: Tone) => void;
  title: string;
}) {
  return (
    <Popover anchor={anchor} open={open} onClose={onClose} role="dialog" label={title} className="p-2">
      <p className="mb-2 px-1 label-text text-muted">{title}</p>
      <TonePicker
        label={title}
        value={value}
        autoFocus
        onChange={t => {
          onChange(t);
          onClose();
        }}
      />
    </Popover>
  );
}
