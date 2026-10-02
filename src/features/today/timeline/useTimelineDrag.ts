import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { Task } from '@/lib/types';
import { applyDrag, minuteAt } from '@/lib/domain/timeline';
import type { DragMode, Row } from '@/lib/domain/timeline';

/** Мышь «берёт» блок, сдвинувшись на 4 px; палец — после 250 мс удержания (иначе это прокрутка). */
const MOUSE_SLOP = 4;
const TOUCH_SLOP = 8;
const LONG_PRESS_MS = 250;
/** У краев прокрутки шкала сама едет за пальцем. */
const EDGE_PX = 40;
const MAX_SCROLL_STEP = 14;

export interface DragPreview {
  mode: DragMode;
  taskId?: string;
  start: number;
  end: number;
}

interface Session {
  mode: DragMode;
  task?: Task;
  base: { start: number; end: number };
  anchor: number;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  lastY: number;
  active: boolean;
  range: { start: number; end: number };
  timer?: number;
}

export interface DragCallbacks {
  /** Отпустили после перетаскивания: новое место блока или новый отрезок. */
  onCommit: (mode: DragMode, task: Task | undefined, range: { start: number; end: number }) => void;
  /** Короткое нажатие на пустое место (без перетаскивания) — минута под пальцем. */
  onTapEmpty: (minute: number) => void;
}

/**
 * Перетаскивание на указателях без библиотек: перенос блока, растягивание за низ, рисование нового блока.
 * Сама геометрия — в `applyDrag`; здесь только события, порог «взятия», долгое нажатие и автопрокрутка.
 */
export function useTimelineDrag(
  scroller: RefObject<HTMLDivElement | null>,
  content: RefObject<HTMLDivElement | null>,
  rows: Row[],
  callbacks: DragCallbacks,
) {
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const session = useRef<Session | null>(null);
  const rowsRef = useRef(rows);
  const cb = useRef(callbacks);
  const suppressClick = useRef(false);
  const frame = useRef(0);
  const detach = useRef<(() => void) | null>(null);

  useEffect(() => {
    rowsRef.current = rows;
    cb.current = callbacks;
  });

  const minuteAtClientY = useCallback(
    (clientY: number) => {
      const top = content.current?.getBoundingClientRect().top ?? 0;
      return minuteAt(rowsRef.current, clientY - top);
    },
    [content],
  );

  const update = useCallback(() => {
    const s = session.current;
    if (!s?.active) return;
    const range = applyDrag(s.mode, s.base, s.anchor, minuteAtClientY(s.lastY));
    if (range.start === s.range.start && range.end === s.range.end) return;
    s.range = range;
    setPreview({ mode: s.mode, taskId: s.task?.id, ...range });
  }, [minuteAtClientY]);

  // Автопрокрутка: пока палец у края, каждый кадр сдвигаем шкалу и пересчитываем положение блока.
  const tick = useRef<() => void>(() => {});
  useEffect(() => {
    tick.current = () => {
      const s = session.current;
      const el = scroller.current;
      if (!s?.active || !el) {
        frame.current = 0;
        return;
      }
      const r = el.getBoundingClientRect();
      let step = 0;
      if (s.lastY < r.top + EDGE_PX) step = -Math.min(MAX_SCROLL_STEP, Math.ceil((r.top + EDGE_PX - s.lastY) / 3));
      else if (s.lastY > r.bottom - EDGE_PX) step = Math.min(MAX_SCROLL_STEP, Math.ceil((s.lastY - (r.bottom - EDGE_PX)) / 3));
      if (step) {
        const before = el.scrollTop;
        el.scrollBy({ top: step });
        if (el.scrollTop !== before) update();
      }
      frame.current = requestAnimationFrame(() => tick.current());
    };
  });

  const end = useCallback(() => {
    const s = session.current;
    if (s?.timer) window.clearTimeout(s.timer);
    session.current = null;
    detach.current?.();
    detach.current = null;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    setPreview(null);
  }, []);

  useEffect(() => end, [end]);

  const activate = useCallback(() => {
    const s = session.current;
    if (!s || s.active) return;
    s.active = true;
    s.range = s.base;
    setPreview({ mode: s.mode, taskId: s.task?.id, ...s.base });
    update();
    if (s.pointerType !== 'mouse') navigator.vibrate?.(8);
    if (!frame.current) frame.current = requestAnimationFrame(() => tick.current());
  }, [update]);

  const begin = useCallback(
    (
      e: ReactPointerEvent,
      mode: DragMode,
      opts: { task?: Task; base?: { start: number; end: number }; immediate?: boolean },
    ) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (session.current) end();
      const anchor = minuteAtClientY(e.clientY);
      const base = opts.base ?? { start: anchor, end: anchor };
      const s: Session = {
        mode,
        task: opts.task,
        base,
        anchor,
        pointerId: e.pointerId,
        pointerType: e.pointerType || 'mouse',
        startX: e.clientX,
        startY: e.clientY,
        lastY: e.clientY,
        active: false,
        range: base,
      };
      session.current = s;
      const touch = s.pointerType !== 'mouse';

      // Палец: удержание 250 мс, потом блок «прилипает». Ручка и край растягивания берут сразу.
      if (opts.immediate) {
        e.preventDefault();
        activate();
      } else if (touch) {
        s.timer = window.setTimeout(activate, LONG_PRESS_MS);
      }

      const onMove = (ev: PointerEvent) => {
        const cur = session.current;
        if (!cur || ev.pointerId !== cur.pointerId) return;
        cur.lastY = ev.clientY;
        if (!cur.active) {
          const dist = Math.hypot(ev.clientX - cur.startX, ev.clientY - cur.startY);
          if (cur.pointerType === 'mouse') {
            if (dist > MOUSE_SLOP) activate();
          } else if (dist > TOUCH_SLOP) {
            // Палец поехал раньше, чем «взял» блок, — это прокрутка, не мешаем.
            end();
          }
          return;
        }
        ev.preventDefault();
        update();
      };
      const onUp = (ev: PointerEvent) => {
        const cur = session.current;
        if (!cur || ev.pointerId !== cur.pointerId) return;
        if (cur.active) {
          suppressClick.current = true;
          window.setTimeout(() => (suppressClick.current = false), 0);
          const { mode: m, task, range, base: b } = cur;
          end();
          if (range.start !== b.start || range.end !== b.end || m === 'create') cb.current.onCommit(m, task, range);
          return;
        }
        const wasEmpty = cur.mode === 'create';
        const minute = cur.anchor;
        end();
        if (wasEmpty) cb.current.onTapEmpty(minute);
      };
      const onCancel = (ev: PointerEvent) => {
        if (session.current && ev.pointerId === session.current.pointerId) end();
      };
      // Взятый пальцем блок не должен прокручивать страницу: гасим touchmove, пока идёт перетаскивание.
      const onTouchMove = (ev: TouchEvent) => {
        if (session.current?.active) ev.preventDefault();
      };
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape' && session.current) {
          ev.preventDefault();
          suppressClick.current = true;
          window.setTimeout(() => (suppressClick.current = false), 0);
          end();
        }
      };
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onKey, true);
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      detach.current = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKey, true);
        document.removeEventListener('touchmove', onTouchMove);
      };
    },
    [activate, end, minuteAtClientY, update],
  );

  /** Клик сразу после перетаскивания — не «открыть задачу». */
  const consumeClick = useCallback(() => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  }, []);

  return { preview, begin, consumeClick, minuteAtClientY };
}
