import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Palette, PanelLeftClose, PanelLeftOpen, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import { ListIcon } from '@/components/ui/ListIcon';
import { LogoMark, Wordmark } from '@/components/ui/LogoMark';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { useCollection, useStoreStatus } from '@/data/hooks';
import { InboxBadge } from '@/features/inbox/InboxBadge';
import { useShellActions } from './ShellActions';
import { NAV, NAV_GROUPS, SETTINGS_NAV } from './nav';
import type { NavItem } from './nav';
import { nextStyle, styleDef, useStyle } from './style';

const STORAGE_KEY = 'ikigai.sidebar';

/** Без сохранённого выбора на планшете (уже 1024 px) меню начинается свёрнутым — не съедает треть экрана. */
function readCollapsed(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) return v === 'collapsed';
  } catch {
    /* приватный режим */
  }
  return typeof window !== 'undefined' && window.innerWidth < 1024;
}

function writeCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? 'collapsed' : 'expanded');
  } catch {
    /* приватный режим — состояние просто не запомнится */
  }
}

/** Строка меню: 32 px, радиус 2, текст 14 px. Свёрнутое меню — квадрат 32 × 32 по центру столбца. */
const ROW = 'relative flex h-8 items-center rounded-md text-body font-medium focus-ring';
const IDLE = 'text-muted-strong hover:bg-fill hover:text-text';
const ACTIVE = 'bg-fill-strong text-text';

function rowLayout(collapsed: boolean) {
  return collapsed ? `${ROW} w-8 mx-auto justify-center` : `${ROW} gap-2.5 px-2`;
}

/** Квадратная кнопка-иконка 32 px в подвале меню. */
const ICON_BTN =
  'h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md text-muted hover:bg-fill hover:text-text focus-ring';

function Item({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  if (item.soon) {
    return (
      <div
        className={`${rowLayout(collapsed)} text-muted cursor-default`}
        title={`${item.label} — скоро`}
        aria-disabled="true"
      >
        <SectionIcon k={item.key} size={16} />
        {collapsed ? null : (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            <span className="text-caption font-normal">скоро</span>
          </>
        )}
      </div>
    );
  }
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      viewTransition
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) => `${rowLayout(collapsed)} ${isActive ? ACTIVE : IDLE}`}
    >
      {({ isActive }) => (
        <>
          <SectionIcon k={item.key} size={16} className={isActive ? 'text-accent-strong' : 'text-muted'} />
          {collapsed ? null : <span className="flex-1 truncate">{item.label}</span>}
          {item.key === 'inbox' ? <InboxBadge collapsed={collapsed} /> : null}
        </>
      )}
    </NavLink>
  );
}

const STATUS_TEXT = { ok: 'Сохранено', saving: 'Сохранение…', offline: 'Не сохранено', error: 'Не сохраняется' } as const;
const STATUS_DOT = { ok: 'bg-success', saving: 'bg-muted', offline: 'bg-warning', error: 'bg-danger' } as const;

/** Стиль — одна кнопка-иконка, которая перебирает пять образов по кругу (полный выбор с превью — в Настройках). */
function StyleCycle() {
  const [style, setStyle] = useStyle();
  const next = nextStyle(style);
  return (
    <button
      type="button"
      onClick={() => setStyle(next)}
      aria-label={`Стиль: ${styleDef(style).name}. Переключить на «${styleDef(next).name}»`}
      title={`Стиль: ${styleDef(style).name}`}
      className={ICON_BTN}
    >
      <Palette size={16} aria-hidden="true" />
    </button>
  );
}

const BY_KEY = new Map(NAV.map(n => [n.key, n]));

/**
 * Боковое меню — плоская панель на всю высоту с волосяной линией справа (240 px; свёрнутое — 56 px).
 * Выбранный пункт — нейтральная заливка и иконка цветом акцента: без пилюль, полос и цветного фона.
 */
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const lists = useCollection('lists');
  const status = useStoreStatus();
  const { openQuick, openSearch } = useShellActions();
  const pinned = lists.filter(l => l.pinned).sort((a, b) => a.position - b.position);

  useEffect(() => {
    writeCollapsed(collapsed);
  }, [collapsed]);

  const toggle = useCallback(() => setCollapsed(c => !c), []);
  const collapseLabel = collapsed ? 'Развернуть меню' : 'Свернуть меню';

  return (
    <aside
      className={`hidden md:flex flex-col shrink-0 h-full bg-panel border-r border-border transition-[width] duration-(--duration-base) ease-out-soft ${
        collapsed ? 'w-14' : 'w-60'
      }`}
    >
      {/* Знак и словесная марка */}
      <div className={`h-14 shrink-0 flex items-center ${collapsed ? 'justify-center' : 'px-4'}`}>
        {collapsed ? <LogoMark size={22} className="text-text" /> : <Wordmark size={22} />}
      </div>

      {/* Действия: новая задача и поиск */}
      <div className={`shrink-0 space-y-2 pb-2 ${collapsed ? 'px-3' : 'px-2'}`}>
        {collapsed ? (
          <>
            <Button
              variant="primary"
              size="sm"
              onClick={openQuick}
              aria-label="Новая задача"
              title="Новая задача  N"
              className="w-8 px-0!"
            >
              <Plus size={16} aria-hidden="true" />
            </Button>
            <button type="button" onClick={openSearch} aria-label="Поиск" title="Поиск  /" className={ICON_BTN}>
              <Search size={16} aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <Button variant="primary" size="sm" onClick={openQuick} title="Новая задача  N" className="w-full pl-2.5 pr-1.5">
              <Plus size={16} aria-hidden="true" />
              <span className="flex-1 text-left">Новая задача</span>
              <Kbd className="text-current/60 ring-1 ring-inset ring-current/20">N</Kbd>
            </Button>
            <button
              type="button"
              onClick={openSearch}
              className="w-full h-8 pl-2.5 pr-1.5 flex items-center gap-2 rounded-control border border-border bg-surface text-body text-muted hover:border-border-strong hover:text-muted-strong focus-ring"
            >
              <Search size={16} aria-hidden="true" />
              <span className="flex-1 text-left">Поиск</span>
              <Kbd>/</Kbd>
            </button>
          </>
        )}
      </div>

      <nav aria-label="Разделы" className="flex-1 min-h-0 overflow-y-auto scroll-thin px-2 pb-3">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={gi ? 'mt-4' : 'mt-2'}>
            {collapsed ? (
              gi ? <div aria-hidden="true" className="mx-auto mb-2 h-px w-6 bg-border" /> : null
            ) : (
              <div className="px-2 pb-1.5 label-text text-muted">{group.label}</div>
            )}
            <div className="space-y-px">
              {group.keys.map(key => {
                const item = BY_KEY.get(key);
                if (!item) return null;
                return (
                  <div key={key}>
                    <Item item={item} collapsed={collapsed} />
                    {key === 'lists' && pinned.length ? (
                      <div className={`mt-px space-y-px ${collapsed ? '' : 'pl-4'}`}>
                        {pinned.map(list => (
                          <NavLink
                            key={list.id}
                            to={`/lists/${list.id}`}
                            viewTransition
                            title={collapsed ? list.title : undefined}
                            aria-label={collapsed ? list.title : undefined}
                            className={({ isActive }) => `${rowLayout(collapsed)} ${isActive ? ACTIVE : IDLE}`}
                          >
                            {({ isActive }) => (
                              <>
                                <ListIcon
                                  name={list.icon}
                                  size={16}
                                  className={`shrink-0 ${isActive ? 'text-accent-strong' : 'text-muted'}`}
                                />
                                {collapsed ? null : <span className="truncate">{list.title}</span>}
                              </>
                            )}
                          </NavLink>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={`shrink-0 border-t border-border py-2 ${collapsed ? 'px-3 space-y-1' : 'px-2 space-y-1'}`}>
        <Item item={SETTINGS_NAV} collapsed={collapsed} />

        <div className={`flex items-center gap-1 ${collapsed ? 'flex-col' : ''}`}>
          <div
            className={`flex items-center gap-2 h-8 text-caption text-muted ${collapsed ? 'justify-center w-8' : 'flex-1 min-w-0 px-2'}`}
            title={STATUS_TEXT[status]}
          >
            <span aria-hidden="true" className={`size-1.5 rounded-mark shrink-0 ${STATUS_DOT[status]}`} />
            {collapsed ? null : (
              <span aria-hidden="true" className={`truncate ${status === 'error' ? 'text-danger-strong' : ''}`}>
                {STATUS_TEXT[status]}
              </span>
            )}
            <span className="sr-only">Хранилище: {STATUS_TEXT[status]}</span>
          </div>
          <StyleCycle />
          <button type="button" onClick={toggle} aria-label={collapseLabel} title={collapseLabel} className={ICON_BTN}>
            {collapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
