import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Ellipsis, Plus } from 'lucide-react';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { Modal } from '@/components/ui/Modal';
import { StylePicker } from '@/components/ui/StylePicker';
import { useShellActions } from './ShellActions';
import { MOBILE_NAV, NAV, SETTINGS_NAV, navItemForPath } from './nav';
import type { NavItem } from './nav';

const MAIN = MOBILE_NAV.map(key => NAV.find(n => n.key === key)!).filter(Boolean);
const REST = [...NAV.filter(n => !MOBILE_NAV.includes(n.key)), SETTINGS_NAV];

const SLOT = 'relative flex flex-col items-center justify-center gap-1 min-w-0 text-micro font-medium focus-ring-inset';

function Tab({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      viewTransition
      className={({ isActive }) => `${SLOT} ${isActive ? 'text-text' : 'text-muted'}`}
    >
      {({ isActive }) => (
        <>
          <SectionIcon k={item.key} size={20} className={isActive ? 'text-accent-strong' : ''} />
          <span className="max-w-full truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

/**
 * Нижняя панель телефона: плоская полоса на всю ширину с волосяной линией сверху и безопасной зоной снизу.
 * Четыре направления и в центре — квадратная кнопка «+» быстрой записи. Остальные разделы — в листе «Ещё».
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { openQuick } = useShellActions();
  const current = navItemForPath(pathname).key;
  // «Ещё» подсвечивается, когда открыт раздел из листа.
  const inRest = REST.some(r => r.key === current);

  return (
    <>
      <nav
        aria-label="Основные разделы"
        className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-panel pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid h-14 grid-cols-5 items-stretch">
          <Tab item={MAIN[0]} />
          <Tab item={MAIN[1]} />
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={openQuick}
              aria-label="Новая запись"
              title="Новая запись"
              className="h-11 w-11 rounded-card bg-accent text-on-accent inline-flex items-center justify-center hover:bg-accent-hover focus-ring"
            >
              <Plus size={20} aria-hidden="true" />
            </button>
          </div>
          <Tab item={MAIN[2]} />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ещё разделы"
            aria-haspopup="dialog"
            className={`${SLOT} ${inRest ? 'text-text' : 'text-muted'}`}
          >
            <Ellipsis size={20} aria-hidden="true" className={inRest ? 'text-accent-strong' : ''} />
            <span>Ещё</span>
          </button>
        </div>
      </nav>

      <Modal open={open} onClose={() => setOpen(false)} title="Разделы">
        <ul className="-mx-1 divide-y divide-border">
          {REST.map(item => {
            const active = item.key === current;
            return (
              <li key={item.key}>
                {item.soon ? (
                  <div aria-disabled="true" className="flex h-11 items-center gap-3 px-1 text-body text-muted">
                    <SectionIcon k={item.key} size={20} />
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="text-caption">скоро</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => {
                      setOpen(false);
                      navigate(item.to, { viewTransition: true });
                    }}
                    className="flex h-11 w-full items-center gap-3 rounded-md px-1 text-left text-body text-text hover:bg-fill focus-ring-inset"
                  >
                    <SectionIcon k={item.key} size={20} className={active ? 'text-accent-strong' : 'text-muted'} />
                    <span className={`flex-1 truncate ${active ? 'font-medium' : ''}`}>{item.label}</span>
                    <ChevronRight size={16} aria-hidden="true" className="text-muted" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 label-text text-muted">Стиль</p>
          <StylePicker compact />
        </div>
      </Modal>
    </>
  );
}
