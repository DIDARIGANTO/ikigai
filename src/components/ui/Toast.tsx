import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, CircleAlert, X } from 'lucide-react';

export type ToastKind = 'ok' | 'error' | 'info';
export interface ToastAction {
  label: string;
  onClick: () => void;
}
export interface ToastOptions {
  kind?: ToastKind;
  /** Кнопка в уведомлении — например, «Отменить» после удаления. */
  action?: ToastAction;
  /** Сколько миллисекунд показывать. По умолчанию 3 с, с действием — 6 с. */
  duration?: number;
}
export type ToastFn = (text: string, options?: ToastOptions) => void;

interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
  action?: ToastAction;
  duration: number;
}

const ToastCtx = createContext<ToastFn>(() => {});

// oxlint-disable-next-line react/only-export-components -- хук живёт рядом со своим провайдером
export function useToast(): ToastFn {
  return useContext(ToastCtx);
}

const LIFETIME = 3000;
const LIFETIME_WITH_ACTION = 6000;

/** Одно уведомление: свой таймер, который замирает, пока на уведомление навели курсор или фокус. */
function ToastView({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const left = useRef(item.duration);
  const started = useRef(0);

  useEffect(() => {
    if (paused) return;
    started.current = Date.now();
    const t = window.setTimeout(() => onDone(item.id), left.current);
    return () => {
      window.clearTimeout(t);
      left.current -= Date.now() - started.current;
    };
  }, [paused, item.id, onDone]);

  const Icon = item.kind === 'error' ? CircleAlert : item.kind === 'ok' ? Check : null;
  return (
    <div
      role={item.kind === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="animate-pop pointer-events-auto flex min-h-10 max-w-[min(26rem,100%)] items-center gap-2 rounded-control border border-border bg-raised py-1 pl-3 pr-1 text-small text-text shadow-(--shadow-pop)"
    >
      {Icon ? (
        <Icon
          size={16}
          aria-hidden="true"
          className={`shrink-0 ${item.kind === 'error' ? 'text-danger-strong' : 'text-success'}`}
        />
      ) : null}
      <span className="min-w-0 py-1 pr-1">{item.text}</span>
      {item.action ? (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            onDone(item.id);
          }}
          className="focus-ring h-8 shrink-0 rounded-md px-2 text-small font-medium text-accent-strong hover:bg-fill"
        >
          {item.action.label}
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Скрыть уведомление"
        onClick={() => onDone(item.id)}
        className="focus-ring inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-fill hover:text-text"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Уведомления снизу по центру: приподнятая плашка с линией и тенью, 13 px; действие — текстовая ссылка.
 * `toast('Задача удалена', { action: { label: 'Отменить', onClick: undo } })` — шаблон отмены.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const done = useCallback((id: number) => setItems(prev => prev.filter(i => i.id !== id)), []);

  const toast = useCallback<ToastFn>((text, options) => {
    const id = nextId.current++;
    const duration = options?.duration ?? (options?.action ? LIFETIME_WITH_ACTION : LIFETIME);
    // Не больше трёх сразу: старые уходят, чтобы не закрывать экран.
    setItems(prev => [...prev.slice(-2), { id, text, kind: options?.kind ?? 'ok', action: options?.action, duration }]);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed z-[60] inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6 px-4 flex flex-col items-center gap-2 pointer-events-none"
      >
        {items.map(i => (
          <ToastView key={i.id} item={i} onDone={done} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
