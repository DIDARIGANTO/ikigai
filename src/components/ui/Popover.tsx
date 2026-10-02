import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode, RefObject } from 'react';

/**
 * Всплывающий слой у кнопки-якоря: рисуется в портале с `position: fixed`, поэтому не обрезается
 * прокруткой диалога. Сам выбирает сторону (снизу, а если не влезает — сверху) и прижимается к краю экрана.
 * Закрывается кликом мимо и Esc (Esc не долетает до диалога под ним). Фокус возвращается на якорь.
 */
export function Popover({
  anchor,
  open,
  onClose,
  children,
  align = 'end',
  className = '',
  role,
  label,
  id,
}: {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** По какому краю якоря выравнивать. */
  align?: 'start' | 'end';
  className?: string;
  role?: string;
  label?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Положение считаем прямо в DOM, до отрисовки кадра: без лишнего рендера и без «прыжка» слоя.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      if (!a) return;
      const gap = 6;
      const margin = 8;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const below = a.bottom + gap + h <= window.innerHeight - margin || a.top - gap - h < margin;
      const top = below ? a.bottom + gap : a.top - gap - h;
      const left = align === 'end' ? a.right - w : a.left;
      el.style.top = `${Math.max(margin, top)}px`;
      el.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - w - margin))}px`;
      el.style.setProperty('--origin', `${align === 'end' ? 'right' : 'left'} ${below ? 'top' : 'bottom'}`);
      el.style.visibility = 'visible';
    };
    place();
    // Содержимое может сменить высоту (поиск эмодзи) — тогда слой пересчитывает сторону.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    ro?.observe(el);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchor, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor.current?.contains(t)) return;
      onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Перехватываем на погружении: Esc закрывает только всплывающий слой, а не диалог под ним.
      e.stopPropagation();
      e.preventDefault();
      onCloseRef.current();
      anchor.current?.focus();
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, anchor]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      id={id}
      role={role}
      aria-label={label}
      data-overlay="popover"
      style={{ visibility: 'hidden' }}
      className={`fixed z-[70] rounded-card border border-border bg-overlay shadow-(--shadow-pop) ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
