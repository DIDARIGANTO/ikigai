import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { LogoMark } from '@/components/ui/LogoMark';
import { useShellActions } from './ShellActions';
import { useCurrentNav } from './nav';

/** Сколько прокрутить, чтобы шапка страницы ушла под панель и название раздела появилось в ней. */
const REVEAL_PX = 56;

/** Прокручена ли основная область дальше шапки страницы. */
function useScrolledPastHeader(): boolean {
  const [past, setPast] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    const main = document.getElementById('app-main');
    if (!main) return;
    const onScroll = () => setPast(main.scrollTop > REVEAL_PX);
    onScroll();
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, [pathname]);
  return past;
}

/**
 * Узкая верхняя панель — только на телефоне. На компьютере её роль играет боковое меню.
 * Заголовок страницы рисует `PageHeader`; название раздела проявляется здесь, лишь когда
 * шапка страницы уехала вверх, — чтобы на экране не было двух одинаковых заголовков.
 */
export function TopBar() {
  const item = useCurrentNav();
  const { openSearch } = useShellActions();
  const past = useScrolledPastHeader();

  return (
    <header className="md:hidden sticky top-0 z-30 h-12 shrink-0 bg-canvas border-b border-border flex items-center justify-between gap-3 pl-4 pr-2 pt-[env(safe-area-inset-top)] box-content">
      <div className="relative flex items-center gap-2 min-w-0 flex-1">
        <LogoMark size={20} className="text-text" />
        <span className="relative min-w-0 flex-1 h-5">
          <span
            aria-hidden={past}
            className={`wordmark-text absolute inset-0 text-body leading-5 transition-[opacity,translate] duration-(--duration-base) ${
              past ? 'opacity-0 -translate-y-1' : 'opacity-100'
            }`}
          >
            Ikigai
          </span>
          <span
            aria-hidden={!past}
            className={`title-text absolute inset-0 truncate text-body leading-5 transition-[opacity,translate] duration-(--duration-base) ${
              past ? 'opacity-100' : 'opacity-0 translate-y-1'
            }`}
          >
            {item.label}
          </span>
        </span>
      </div>
      {/* «+» живёт в нижней панели — здесь только поиск. */}
      <IconButton aria-label="Поиск" title="Поиск  /" onClick={openSearch} variant="ghost">
        <Search size={20} aria-hidden="true" />
      </IconButton>
    </header>
  );
}
