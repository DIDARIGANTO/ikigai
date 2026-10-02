import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from './Button';
import { Modal } from './Modal';

export interface ConfirmOptions {
  /** Надпись на подтверждающей кнопке. По умолчанию — «Удалить». */
  confirmLabel?: string;
  /** Надпись на кнопке отказа. */
  cancelLabel?: string;
  /** Красная кнопка для необратимых действий. По умолчанию — да. */
  danger?: boolean;
}

export type ConfirmFn = (text: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmCtx = createContext<ConfirmFn>(async () => false);

/** Подтверждение удаления: `if (!(await confirm('Удалить X?'))) return;` */
// oxlint-disable-next-line react/only-export-components -- хук живёт рядом со своим провайдером
export function useConfirm(): ConfirmFn {
  return useContext(ConfirmCtx);
}

/**
 * Первое предложение становится заголовком, остальное — пояснением под ним:
 * вызывающий передаёт один текст, диалог сам делит его на вопрос и последствия.
 */
function splitText(text: string): [string, string | null] {
  const trimmed = text.trim();
  const m = /^([\s\S]*?[?.!])\s+([\s\S]+)$/.exec(trimmed);
  return m ? [m[1], m[2]] : [trimmed, null];
}

interface Pending {
  text: string;
  options: ConfirmOptions;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  // Промис живёт вне состояния: React может вызвать обновление дважды, а resolve — один раз.
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (text, options) =>
      new Promise<boolean>(resolve => {
        // Если предыдущий вопрос ещё висит, считаем его отклонённым.
        resolver.current?.(false);
        resolver.current = resolve;
        setPending({ text, options: options ?? {} });
      }),
    [],
  );

  const settle = useCallback((result: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    setPending(null);
    resolve?.(result);
  }, []);

  // Переход в другой раздел отменяет незаданный вопрос: иначе диалог остался бы висеть
  // над чужой страницей и подтвердил бы действие, о котором там уже никто не помнит.
  // Провайдер живёт внутри BrowserRouter (см. main.tsx → App → Shell), так что хук доступен.
  const { pathname } = useLocation();
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    settle(false);
  }, [pathname, settle]);

  const [title, detail] = pending ? splitText(pending.text) : ['', null];
  const danger = pending?.options.danger ?? true;

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {pending ? (
        <Modal
          open
          onClose={() => settle(false)}
          title={title}
          className="max-w-md"
          footer={
            <>
              <Button onClick={() => settle(false)}>{pending.options.cancelLabel ?? 'Отмена'}</Button>
              <Button variant={danger ? 'danger' : 'primary'} onClick={() => settle(true)}>
                {pending.options.confirmLabel ?? 'Удалить'}
              </Button>
            </>
          }
        >
          {detail ? <p className="text-body text-muted">{detail}</p> : null}
        </Modal>
      ) : null}
    </ConfirmCtx.Provider>
  );
}
