import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useShellActions } from '@/app/ShellActions';

/**
 * Ярлык установленного приложения «Новая задача» открывает `/?new=task`:
 * показываем быструю запись один раз и убираем параметр из адреса,
 * чтобы обновление страницы не открывало её снова.
 */
export function ShortcutHandler() {
  const [params, setParams] = useSearchParams();
  const { openQuick } = useShellActions();
  const handled = useRef(false);
  const wanted = params.get('new') === 'task';

  useEffect(() => {
    if (!wanted || handled.current) return;
    handled.current = true;
    openQuick();
    setParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.delete('new');
        return next;
      },
      { replace: true },
    );
  }, [wanted, openQuick, setParams]);

  return null;
}
