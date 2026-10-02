import { useEffect, useId, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, KeyboardEvent, ReactNode, RefObject } from 'react';
import { ArrowRight, Check, Clock3, Minus, Moon, Play, Sunrise } from 'lucide-react';
import type { Task } from '@/lib/types';
import { Popover } from '@/components/ui/Popover';
import { IconButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { hhmm, rescheduleOptions } from '@/lib/domain/timeline';
import { timeToMinutes } from '@/lib/dates';

export interface MissedHandlers {
  onStart: () => void;
  /** Новое начало сегодня (минуты) или `null` — завтра в то же время. */
  onMoveTo: (start: number | null) => void;
  onSkip: () => void;
  /** «Сделал в …» — минуты начала. */
  onDoneAt: (start: number) => void;
}

const MOVE_ICONS = { hour: <Clock3 />, evening: <Moon />, tomorrow: <Sunrise /> } as const;

/** Пункт в духе общего меню: строка 32 px, иконка 16 px приглушённая, справа — время моноширинным. */
function Item({
  icon,
  hint,
  children,
  ...p
}: { icon: ReactNode; hint?: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      data-menuitem=""
      className="focus-ring-inset flex h-8 w-full items-center gap-2 rounded-control px-2 text-left text-small text-text hover:bg-fill focus-visible:bg-fill pointer-coarse:h-11"
      {...p}
    >
      <span aria-hidden="true" className="inline-flex shrink-0 text-muted [&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint ? <span className="shrink-0 font-mono text-caption text-muted">{hint}</span> : null}
    </button>
  );
}

const Separator = () => <div role="separator" className="-mx-1 my-1 h-px bg-border" />;

/**
 * Что делать с блоком, время которого прошло: начать, перенести, отметить «сделал» задним числом или «не делал».
 * Без упрёков: задача просто пропущена. Вид — как у общего меню: строки, линии, стрелки ходят по пунктам.
 */
export function MissedActions({
  task,
  anchor,
  open,
  onClose,
  nowMin,
  duration,
  ...h
}: {
  task: Task;
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  nowMin: number;
  duration: number;
} & MissedHandlers) {
  const [doneAt, setDoneAt] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const uid = useId();

  useEffect(() => {
    if (!open) return;
    const r = requestAnimationFrame(() => box.current?.querySelector<HTMLElement>('[data-menuitem]')?.focus());
    return () => cancelAnimationFrame(r);
  }, [open]);

  const planned = task.plannedStart ?? hhmm(nowMin);
  const dismiss = () => {
    setDoneAt(null);
    onClose();
  };
  const close = (after: () => void) => () => {
    dismiss();
    anchor.current?.focus();
    after();
  };
  const options = rescheduleOptions(nowMin, duration);

  // Стрелки и Home/End ходят по пунктам, как в общем меню; в поле времени стрелки остаются его.
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.target instanceof HTMLElement) || !e.target.hasAttribute('data-menuitem')) return;
    const all = Array.from(box.current?.querySelectorAll<HTMLElement>('[data-menuitem]') ?? []);
    const i = all.indexOf(e.target);
    let next = -1;
    if (e.key === 'ArrowDown') next = i === all.length - 1 ? 0 : i + 1;
    else if (e.key === 'ArrowUp') next = i <= 0 ? all.length - 1 : i - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = all.length - 1;
    if (next < 0) return;
    e.preventDefault();
    all[next]?.focus();
  };

  return (
    <Popover
      anchor={anchor}
      open={open}
      onClose={dismiss}
      role="dialog"
      label={`«${task.title}»: время прошло`}
      className="w-64 p-1"
    >
      <div ref={box} onKeyDown={onKey}>
        <p className="px-2 pt-1.5 pb-1 text-caption text-muted">
          Было в <span className="font-mono text-muted-strong">{planned}</span>
        </p>
        <Item icon={<Play />} onClick={close(h.onStart)}>
          Начать сейчас
        </Item>

        <Separator />
        <p id={`${uid}-move`} className="px-2 pt-1.5 pb-1 text-caption text-muted">
          Перенести
        </p>
        <div role="group" aria-labelledby={`${uid}-move`}>
          {options.map(o => {
            const at = o.start === null ? planned : hhmm(o.start);
            return (
              <Item
                key={o.key}
                icon={MOVE_ICONS[o.key]}
                hint={at}
                aria-label={`${o.label} ${at}`}
                onClick={close(() => h.onMoveTo(o.start))}
              >
                {o.label}
              </Item>
            );
          })}
        </div>

        <Separator />
        {doneAt === null ? (
          <>
            <Item icon={<Check />} onClick={() => setDoneAt(planned)}>
              Сделал в…
            </Item>
            <Item icon={<Minus />} onClick={close(h.onSkip)}>
              Не делал
            </Item>
          </>
        ) : (
          <form
            className="flex items-end gap-2 p-2"
            onSubmit={e => {
              e.preventDefault();
              if (!/^\d{2}:\d{2}$/.test(doneAt)) return;
              close(() => h.onDoneAt(timeToMinutes(doneAt)))();
            }}
          >
            <Input
              label="Начал в"
              type="time"
              step={300}
              value={doneAt}
              autoFocus
              onChange={e => setDoneAt(e.target.value)}
              className="font-mono"
            />
            <IconButton type="submit" variant="primary" aria-label="Отметить сделанным">
              <ArrowRight size={16} aria-hidden="true" />
            </IconButton>
          </form>
        )}
      </div>
    </Popover>
  );
}
