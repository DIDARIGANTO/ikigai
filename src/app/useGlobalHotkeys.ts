import { useEffect } from 'react';
import { isOverlayOpen } from '@/components/ui/overlay';
import { useShellActions } from './ShellActions';
import { useCurrentNav } from './nav';

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Глобальные клавиши каркаса: `N` — быстрая запись, `/` и `⌘K` / `Ctrl+K` — поиск и команды.
 * Молчат, пока пользователь печатает или открыт диалог. Заодно держит заголовок вкладки.
 */
export function useGlobalHotkeys() {
  const item = useCurrentNav();
  const { openQuick, openSearch } = useShellActions();

  // Вкладка браузера всегда показывает текущий раздел.
  useEffect(() => {
    document.title = `Ikigai · ${item.label}`;
  }, [item.label]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K — палитра команд, даже из поля ввода (по коду клавиши: работает и в русской раскладке).
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.code === 'KeyK' && !e.defaultPrevented) {
        if (isOverlayOpen() || document.activeElement?.closest('[role="dialog"]')) return;
        e.preventDefault();
        openSearch();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (isTypingTarget(e.target)) return;
      // Пока открыт диалог, глобальные хоткеи молчат.
      if (isOverlayOpen()) return;
      if (document.activeElement?.closest('[role="dialog"]')) return;
      if (e.key === '/') {
        e.preventDefault();
        openSearch();
      } else if (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') {
        e.preventDefault();
        openQuick();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openQuick, openSearch]);
}
