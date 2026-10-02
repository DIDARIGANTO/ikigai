import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Palette, Plus, Search, Send } from 'lucide-react';
import { nextStyle, styleDef, useStyle } from '@/app/style';
import type { StyleId } from '@/app/style';
import { useToast } from '@/components/ui/Toast';
import { getStore } from '@/data';
import { downloadText, exportAll } from '@/data/exportImport';
import { todayISO } from '@/lib/dates';
import type { SectionKey } from '@/lib/icons';
import { useQuickCapture } from '@/features/quick/QuickCapture';
import { rememberFocus, useFocusTrap, useOverlay } from '@/components/ui/overlay';
import { useCollection } from '@/data/hooks';
import { Kbd } from '@/components/ui/Kbd';
import { BACKDROP } from '@/components/ui/Modal';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import { useTaskEditor } from '@/features/tasks/TaskEditor';
import { buildSearch, MAX_PER_GROUP } from './search';
import type { SearchHit } from './search';
import { pushRecent, rankCommands, readRecent, writeRecent } from './commands';
import type { Command } from './commands';

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

type Row =
  | { type: 'command'; key: string; cmd: Command }
  | { type: 'hit'; key: string; hit: SearchHit; icon: SectionKey };

interface RowSection {
  key: string;
  label: string;
  rows: Row[];
  /** Справа от заголовка: «показаны 8 из 12». */
  note?: string;
}

const HIT_ICON: Record<SearchHit['kind'], SectionKey> = {
  task: 'task',
  note: 'notes',
  listItem: 'lists',
  goal: 'goals',
  dream: 'dreams',
  reminder: 'reminders',
  debt: 'debts',
};

/** Значок строки — простая иконка 16 px без подложки; у активной строки — цвета текста. */
function RowIcon({ row, active }: { row: Row; active: boolean }) {
  let icon: ReactNode;
  if (row.type === 'hit') icon = <SectionIcon k={row.icon} size={16} />;
  else {
    const k = row.cmd.icon;
    if (k === 'plus') icon = <Plus size={16} />;
    else if (k === 'style') icon = <Palette size={16} />;
    else if (k === 'export') icon = <Download size={16} />;
    else if (k === 'telegram') icon = <Send size={16} />;
    else icon = <SectionIcon k={k} size={16} />;
  }
  return (
    <span aria-hidden="true" className={`inline-flex size-4 shrink-0 items-center justify-center [&_svg]:size-4 ${active ? 'text-text' : 'text-muted'}`}>
      {icon}
    </span>
  );
}

function Dialog({ onClose, onPickTask }: { onClose: () => void; onPickTask: (id: string) => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const quick = useQuickCapture();
  const [style, setStyle] = useStyle();
  const { tasks } = useTaskActionsCtx();
  const notes = useCollection('notes');
  const listItems = useCollection('listItems');
  const lists = useCollection('lists');
  const goals = useCollection('goals');
  const dreams = useCollection('dreams');
  const reminders = useCollection('reminders');
  const debts = useCollection('debts');

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<SearchHit[]>(() => readRecent());
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useOverlay(true, onClose);
  useFocusTrap(dialogRef, true);

  const groups = useMemo(
    () => buildSearch(query, { tasks, notes, listItems, lists, goals, dreams, reminders, debts }),
    [query, tasks, notes, listItems, lists, goals, dreams, reminders, debts],
  );

  /** Недавнее — только то, что ещё существует: удалённая заметка не должна висеть в списке. */
  const liveRecent = useMemo(() => {
    const alive = new Set<string>([
      ...tasks.map(t => `task:${t.id}`),
      ...notes.map(n => `note:${n.id}`),
      ...listItems.map(i => `listItem:${i.id}`),
      ...goals.map(g => `goal:${g.id}`),
      ...dreams.map(d => `dream:${d.id}`),
      ...reminders.map(r => `reminder:${r.id}`),
      ...debts.map(d => `debt:${d.id}`),
    ]);
    return recent.filter(h => alive.has(h.key));
  }, [recent, tasks, notes, listItems, goals, dreams, reminders, debts]);

  const sections = useMemo<RowSection[]>(() => {
    const out: RowSection[] = [];
    const commands = rankCommands(query);
    if (commands.length) {
      out.push({ key: 'commands', label: 'Команды', rows: commands.map(cmd => ({ type: 'command', key: `cmd:${cmd.id}`, cmd })) });
    }
    if (!query.trim()) {
      if (liveRecent.length) {
        out.push({
          key: 'recent',
          label: 'Недавнее',
          rows: liveRecent.map(hit => ({ type: 'hit', key: `recent:${hit.key}`, hit, icon: HIT_ICON[hit.kind] })),
        });
      }
      return out;
    }
    for (const g of groups) {
      out.push({
        key: g.kind,
        label: g.label,
        note: g.total > MAX_PER_GROUP ? `показаны ${MAX_PER_GROUP} из ${g.total}` : undefined,
        rows: g.hits.map(hit => ({ type: 'hit', key: hit.key, hit, icon: g.icon })),
      });
    }
    return out;
  }, [query, groups, liveRecent]);

  const rows = useMemo(() => sections.flatMap(sec => sec.rows), [sections]);
  const found = groups.reduce((n, g) => n + g.hits.length, 0);

  // Новый запрос — подсветка снова на первой строке. Правим состояние в рендере,
  // чтобы не гонять лишний проход через эффект.
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setActive(0);
  }

  // Подсветка не должна уезжать за край при ходьбе стрелками.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = useCallback(
    (cmd: Command) => {
      onClose();
      const a = cmd.action;
      if (a.type === 'quick') quick.open();
      else if (a.type === 'go') navigate(a.to);
      else if (a.type === 'style') {
        const next: StyleId = nextStyle(style);
        setStyle(next);
        toast(`Стиль: ${styleDef(next).name}`);
      } else if (a.type === 'export') {
        void exportAll(getStore()).then(
          json => {
            downloadText(`ikigai-${todayISO()}.json`, json);
            toast('Файл выгружен');
          },
          () => toast('Не удалось выгрузить данные', { kind: 'error' }),
        );
      }
    },
    [navigate, onClose, quick, setStyle, style, toast],
  );

  const pick = useCallback(
    (row: Row | undefined) => {
      if (!row) return;
      if (row.type === 'command') {
        run(row.cmd);
        return;
      }
      const { hit } = row;
      const next = pushRecent(recent, hit);
      setRecent(next);
      writeRecent(next);
      onClose();
      if (hit.kind === 'task') onPickTask(hit.id);
      else if (hit.to) navigate(hit.to);
    },
    [navigate, onClose, onPickTask, recent, run],
  );

  const onKeyDown = (e: ReactKeyboardEvent) => {
    // ⌘K / Ctrl+K внутри палитры — закрыть (как переключатель).
    if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') {
      e.preventDefault();
      onClose();
      return;
    }
    if (!rows.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => (i + 1) % rows.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => (i - 1 + rows.length) % rows.length);
    } else if (e.key === 'Home' && e.ctrlKey) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End' && e.ctrlKey) {
      e.preventDefault();
      setActive(rows.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(rows[active]);
    }
  };

  const optionId = (i: number) => `search-option-${i}`;
  // Сквозной номер первой строки каждой группы — по нему связываются строки и aria-activedescendant.
  const starts = sections.reduce<number[]>((acc, _g, gi) => {
    acc.push(gi === 0 ? 0 : acc[gi - 1] + sections[gi - 1].rows.length);
    return acc;
  }, []);
  const mod = isMac() ? '⌘' : 'Ctrl';

  return createPortal(
    <div
      data-overlay="backdrop"
      className={`${BACKDROP} flex items-start justify-center p-3 pt-[8dvh] sm:p-4 md:pt-[14dvh]`}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Поиск и команды"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        data-overlay="dialog"
        className="flex max-h-[76dvh] w-full max-w-160 flex-col overflow-hidden rounded-card border border-border bg-overlay shadow-(--shadow-overlay) focus:outline-none"
      >
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
          <Search size={16} aria-hidden="true" className="shrink-0 text-muted" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Команда или поиск"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="search-results"
            aria-expanded={rows.length > 0}
            aria-activedescendant={rows.length ? optionId(active) : undefined}
            placeholder="Команда или поиск"
            className="min-w-0 flex-1 bg-transparent text-h2 font-normal text-text outline-none placeholder:text-muted"
          />
          <span className="hidden sm:inline-flex"><Kbd>Esc</Kbd></span>
        </div>

        <div id="search-results" ref={listRef} className="min-h-0 flex-1 overflow-y-auto scroll-thin">
          {query.trim() && !rows.length ? (
            <div className="px-6 py-10 text-center">
              <p className="text-body font-medium text-text">Ничего не найдено</p>
              <p className="mt-1 text-small text-muted">Попробуй другое слово или часть слова.</p>
            </div>
          ) : (
            <div className="py-1.5">
              {sections.map((section, gi) => (
                <section key={section.key} className="px-1.5 pb-1">
                  <h2 className="flex items-center gap-2 px-2.5 pt-2 pb-1 label-text text-muted">
                    {section.label}
                    {section.note ? <span className="ml-auto font-normal tabular-nums">{section.note}</span> : null}
                  </h2>
                  {/* Строки не получают фокус: ходьба по ним идёт из поля ввода через aria-activedescendant. */}
                  <ul role="listbox" aria-label={section.label}>
                    {section.rows.map((row, hi) => {
                      const i = starts[gi] + hi;
                      const isActive = i === active;
                      const title = row.type === 'command' ? row.cmd.label : row.hit.title;
                      const subtitle =
                        row.type === 'command'
                          ? row.cmd.action.type === 'style'
                            ? `сейчас ${styleDef(style).name}`
                            : undefined
                          : row.hit.subtitle;
                      return (
                        <li
                          key={row.key}
                          id={optionId(i)}
                          role="option"
                          aria-selected={isActive}
                          data-active={isActive}
                          onMouseMove={() => setActive(i)}
                          onClick={() => pick(row)}
                          className={`flex h-9 cursor-pointer items-center gap-3 rounded-control px-2.5 text-left pointer-coarse:h-11 ${
                            isActive ? 'bg-fill-strong' : ''
                          }`}
                        >
                          <RowIcon row={row} active={isActive} />
                          <span className="flex min-w-0 flex-1 items-baseline gap-2">
                            <span className="min-w-0 shrink truncate text-body text-text">{title}</span>
                            {subtitle ? (
                              <span className="min-w-0 max-w-[50%] shrink-[2] truncate text-small text-muted">{subtitle}</span>
                            ) : null}
                          </span>
                          {row.type === 'command' && row.cmd.action.type === 'quick' && !isActive ? (
                            <span className="hidden shrink-0 sm:inline-flex">
                              <Kbd>N</Kbd>
                            </span>
                          ) : null}
                          <span className={`shrink-0 ${isActive ? 'visible' : 'invisible'}`}>
                            <Kbd>↵</Kbd>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              {!query.trim() && !liveRecent.length ? (
                <p className="px-4 pt-1 pb-2.5 text-caption text-muted">
                  Начни печатать — найдутся задачи, заметки, пункты списков, цели, мечты и напоминания.
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="hidden h-10 shrink-0 items-center gap-4 border-t border-border px-4 text-caption text-muted sm:flex">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex gap-0.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
            </span>
            выбрать
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            открыть
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>Esc</Kbd>
            закрыть
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 tabular-nums">
            {query.trim() && found ? (
              <>
                Найдено: <span className="font-mono">{found}</span>
              </>
            ) : (
              <>
                <span className="inline-flex gap-0.5">
                  <Kbd>{mod}</Kbd>
                  <Kbd>K</Kbd>
                </span>
                палитра
              </>
            )}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface SearchApi {
  open: () => void;
}

const Ctx = createContext<SearchApi>({ open: () => {} });

// oxlint-disable-next-line react/only-export-components -- хук живёт рядом со своим провайдером
export function useSearch(): SearchApi {
  return useContext(Ctx);
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { tasks } = useTaskActionsCtx();
  const { open: openTask, editor } = useTaskEditor();

  const api = useMemo<SearchApi>(
    () => ({
      open: () => {
        rememberFocus();
        setOpen(true);
      },
    }),
    [],
  );
  const close = useCallback(() => setOpen(false), []);
  const onPickTask = useCallback(
    (id: string) => {
      const task = tasks.find(t => t.id === id);
      if (task) openTask(task);
    },
    [tasks, openTask],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {open ? <Dialog onClose={close} onPickTask={onPickTask} /> : null}
      {editor}
    </Ctx.Provider>
  );
}
