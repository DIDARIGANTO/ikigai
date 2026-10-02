import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './Button';
import { useFocusTrap, useOverlay } from './overlay';

/** Общий фон под слоями: простое затемнение без размытия — одинаковое у диалогов, панелей и поиска. */
export const BACKDROP = 'fixed inset-0 z-50 bg-backdrop';

/**
 * Диалог: на компьютере — карточка по центру, на телефоне — лист снизу.
 * Появляется через @starting-style (см. `[data-overlay]` в globals.css).
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useOverlay(open, onClose);
  useFocusTrap(dialogRef, open);
  if (!open) return null;

  return createPortal(
    <div
      data-overlay="backdrop"
      className={`${BACKDROP} flex items-end md:items-center justify-center p-0 md:p-6`}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        data-overlay="dialog"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Диалог'}
        className={`relative bg-surface border border-border shadow-(--shadow-overlay) rounded-t-sheet md:rounded-sheet max-w-lg w-full px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:pb-5 max-h-[92dvh] md:max-h-[88dvh] overflow-y-auto scroll-thin focus:outline-none ${className}`}
      >
        {/* Ручка листа — только на телефоне, как подсказка «можно закрыть». */}
        <span aria-hidden="true" className="md:hidden absolute left-1/2 top-2 h-1 w-9 -translate-x-1/2 rounded-bar bg-fill-strong" />
        {title ? (
          <div className="flex items-start justify-between gap-4 mb-4">
            <h2 id={titleId} className="pt-1.5 text-h2 font-semibold text-text">
              {title}
            </h2>
            <IconButton aria-label="Закрыть" onClick={onClose} className="-mr-2 -mt-1">
              <X size={16} aria-hidden="true" />
            </IconButton>
          </div>
        ) : null}
        {children}
        {footer ? <div className="mt-5 flex items-center justify-end gap-2">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
