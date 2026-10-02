import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './Button';
import { BACKDROP } from './Modal';
import { useFocusTrap, useOverlay } from './overlay';

/** Боковая панель редактора: на компьютере — плавающий лист справа, на телефоне — на весь экран. */
export function SidePanel({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  useOverlay(open, onClose);
  useFocusTrap(dialogRef, open);
  if (!open) return null;

  return createPortal(
    <div
      data-overlay="backdrop"
      className={`${BACKDROP} flex justify-end md:p-2`}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        ref={dialogRef}
        data-overlay="panel"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Панель'}
        className="bg-surface md:border md:border-border shadow-(--shadow-overlay) w-full md:w-[440px] h-full md:rounded-card flex flex-col overflow-hidden focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 md:pt-5">
          {title ? (
            <h2 id={titleId} className="pt-1.5 text-h2 font-semibold text-text">
              {title}
            </h2>
          ) : (
            <span aria-hidden="true" />
          )}
          <IconButton aria-label="Закрыть" onClick={onClose} className="-mr-2">
            <X size={16} aria-hidden="true" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin px-5 pb-5 pt-2">{children}</div>
        {footer ? (
          <div className="border-t border-border px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2">
            {footer}
          </div>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}
