import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/** Стек открытых слоёв: Esc обрабатывает только верхний, глобальные хоткеи молчат. */
const stack: symbol[] = [];

/** Открыт ли хотя бы один диалог. */
export function isOverlayOpen(): boolean {
  return stack.length > 0;
}

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    el =>
      !el.hasAttribute('hidden') &&
      el.getAttribute('aria-hidden') !== 'true' &&
      el.getAttribute('aria-disabled') !== 'true',
  );
}

function focusedElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const el = document.activeElement;
  return el instanceof HTMLElement && el !== document.body ? el : null;
}

/** Куда вернуть фокус после следующего слоя. Провайдеры вызывают `rememberFocus()` в своём `open()`. */
let returnFocus: HTMLElement | null = null;

export function rememberFocus() {
  returnFocus = focusedElement();
}

function takeReturnFocus(): HTMLElement | null {
  const el = returnFocus;
  returnFocus = null;
  return el;
}

/** Кнопка закрытия — плохая цель для первого фокуса, её пропускаем. */
const CLOSE_LABEL = 'Закрыть';

/**
 * Куда поставить фокус при открытии:
 * 1. явно помеченное поле (`autofocus` / `data-autofocus`) — React не всегда
 *    отражает `autoFocus` в атрибут, поэтому ниже есть ещё две страховки;
 * 2. фокус уже внутри слоя (сработал React-овский `autoFocus`) — не трогаем;
 * 3. первое текстовое поле, иначе первый фокусируемый элемент, кроме «Закрыть»;
 * 4. «Закрыть», если больше ничего нет;
 * 5. сам контейнер с `tabIndex=-1`.
 */
function initialFocus(node: HTMLElement): HTMLElement {
  const marked = node.querySelector<HTMLElement>('[autofocus],[data-autofocus]');
  if (marked) return marked;

  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== node && node.contains(active)) return active;

  const items = focusableIn(node);
  // Поле ввода важнее кнопок: в редакторе сразу печатают (и так же ведёт себя autoFocus в StrictMode).
  const field = items.find(el => el.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea'));
  return field ?? items.find(el => el.getAttribute('aria-label') !== CLOSE_LABEL) ?? items[0] ?? node;
}

/**
 * Пока слой открыт: фокус уходит внутрь него, Tab/Shift+Tab ходят по кругу,
 * при закрытии фокус возвращается туда, откуда слой открыли.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, open: boolean) {
  // Что было в фокусе до открытия. Считать `activeElement` в эффекте нельзя: `autoFocus` внутри слоя
  // успевает сработать раньше. Поэтому слой, смонтированный сразу открытым (так делают быстрая запись,
  // поиск, редактор задачи, подтверждение), запоминает фокус ещё при первой отрисовке — до вставки в DOM.
  const [atMount] = useState(() => (open ? takeReturnFocus() ?? focusedElement() : null));
  const before = useRef<HTMLElement | null>(atMount);

  useEffect(() => {
    if (open) return;
    before.current = null;
    const remember = () => {
      const el = document.activeElement;
      before.current = el instanceof HTMLElement && el !== document.body ? el : before.current;
    };
    remember();
    document.addEventListener('focusin', remember);
    return () => document.removeEventListener('focusin', remember);
  }, [open]);

  useEffect(() => {
    const node = ref.current;
    if (!open || !node) return;

    // Слой может смонтироваться уже открытым (так делает подтверждение) — тогда эффект
    // выше ни разу не отработал и запоминать было нечему. Берём то, что в фокусе прямо
    // сейчас: фокус ещё не переведён внутрь слоя, так что это и есть вызвавшая кнопка.
    const active = document.activeElement;
    const restore =
      takeReturnFocus() ??
      before.current ??
      (active instanceof HTMLElement && active !== document.body && !node.contains(active) ? active : null);

    initialFocus(node).focus();

    // Слушаем на самом слое: при вложенных слоях событие получит только тот,
    // внутри которого сейчас фокус.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.defaultPrevented) return;
      const items = focusableIn(node);
      if (!items.length) {
        // Ходить некуда — держим фокус на самом контейнере.
        e.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      // С контейнера (tabIndex=-1) Shift+Tab ушёл бы наружу — заворачиваем в конец.
      if (e.shiftKey && (active === first || active === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      // Элемент мог пересоздаться (карточка после правки) — тогда ищем его двойника по data-focus-key.
      const key = restore?.dataset.focusKey;
      const target =
        restore && restore.isConnected
          ? restore
          : key
            ? document.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(key)}"]`)
            : null;
      // Синхронно: в StrictMode эффект тут же перезапустится и вернёт фокус внутрь слоя,
      // а отложенный возврат перехватил бы его обратно.
      target?.focus({ preventScroll: true });
    };
  }, [ref, open]);
}

/** Esc закрывает верхний слой; пока слой открыт, страница за ним не прокручивается. */
export function useOverlay(open: boolean, onClose: () => void) {
  // колбэк обычно приходит инлайном — держим свежий в ref, чтобы не переподписываться
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const token = Symbol('overlay');
    stack.push(token);

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (stack[stack.length - 1] !== token) return; // не верхний слой — не наше дело
      e.stopImmediatePropagation();
      e.preventDefault();
      onCloseRef.current();
    };

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = stack.lastIndexOf(token);
      if (i !== -1) stack.splice(i, 1);
      document.body.style.overflow = prev;
    };
  }, [open]);
}
