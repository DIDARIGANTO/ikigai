import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Flag, Plus, Send, Trash2, X } from 'lucide-react';
import type { Task } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { Button, IconButton } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Kbd } from '@/components/ui/Kbd';
import { isOverlayOpen } from '@/components/ui/overlay';
import { useCollection } from '@/data/hooks';
import { addDaysISO, todayISO } from '@/lib/dates';
import { nowISO } from '@/lib/ids';
import { created, deleted, updated } from '@/lib/undo';
import type { RowChange } from '@/lib/undo';
import { useShellActions } from '@/app/ShellActions';
import { GoalChip } from '@/features/goals/GoalChip';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import { useTaskEditor } from '@/features/tasks/TaskEditor';
import { columnFor, newTask } from '@/features/tasks/useTaskActions';
import { PickerMenu } from '@/features/tasks/PickerMenu';
import { boardPickerItems, goalPickerItems, listPickerItems, MENU_TRIGGER } from '@/features/tasks/pickers';
import { createdAgo, inboxCountText, inboxTasks, nextMondayISO, telegramNotes } from './inbox';
import type { InboxNote } from './inbox';

/** Тихие текстовые кнопки разбора: «Сегодня · Завтра · На неделе». */
const ACTION = 'px-2!';

function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

/** Клавиши разбора и их русская раскладка (J ↔ О и т. д.). */
const KEYS = {
  down: ['j', 'о', 'ArrowDown'],
  up: ['k', 'л', 'ArrowUp'],
  today: ['t', 'е'],
  tomorrow: ['d', 'в'],
  week: ['w', 'ц'],
  select: ['x', 'ч'],
  del: ['Delete', 'Backspace'],
  open: ['Enter'],
} as const;
const is = (key: string, names: readonly string[]) => names.includes(key) || names.includes(key.toLowerCase());

export function InboxPage() {
  const { tasks, goals, columns, commit } = useTaskActionsCtx();
  const boards = useCollection('boards');
  const lists = useCollection('lists');
  const notes = useCollection('notes') as InboxNote[];
  const folders = useCollection('noteFolders');
  const { openQuick } = useShellActions();
  const { open: openEditor, editor } = useTaskEditor();

  const items = useMemo(() => inboxTasks(tasks), [tasks]);
  const tgNotes = useMemo(() => telegramNotes(notes, folders), [notes, folders]);
  const total = items.length + tgNotes.length;

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState(0);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  // Выбор и курсор живут только среди того, что ещё во «Входящих».
  const sel = useMemo(() => items.filter(t => selected.has(t.id)), [items, selected]);
  const activeIndex = Math.min(active, Math.max(0, items.length - 1));
  const activeTask = items[activeIndex];

  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  const monday = nextMondayISO(today);
  const goalItems = useMemo(() => goalPickerItems(goals), [goals]);
  const boardItems = useMemo(() => boardPickerItems(boards), [boards]);
  const listItems = useMemo(() => listPickerItems(lists), [lists]);

  const count = (n: number, word: string) => (n > 1 ? `${word}: ${n}` : word);
  const done = useCallback(() => setSelected(new Set()), []);

  const setDate = useCallback(
    async (list: Task[], date: string, label: string) => {
      if (!list.length) return;
      await commit(count(list.length, label), list.map(t => updated('tasks', t, { ...t, date })));
      done();
    },
    [commit, done],
  );

  const toBoard = useCallback(
    async (list: Task[], boardId: string) => {
      const board = boards.find(b => b.id === boardId);
      if (!list.length || !board) return;
      await commit(
        count(list.length, `На доске «${board.title}»`),
        list.map(t => updated('tasks', t, { ...t, boardId, columnId: columnFor(columns, boardId, 'todo') })),
      );
      done();
    },
    [boards, columns, commit, done],
  );

  const toGoal = useCallback(
    async (list: Task[], goalId: string) => {
      if (!list.length) return;
      const goal = goals.find(g => g.id === goalId);
      await commit(goal ? `Цель: ${goal.title}` : 'Без цели', list.map(t => updated('tasks', t, { ...t, goalId: goalId || undefined })));
    },
    [commit, goals],
  );

  const remove = useCallback(
    async (list: Task[]) => {
      if (!list.length) return;
      await commit(
        list.length > 1 ? `Удалено: ${list.length}` : 'Задача удалена',
        list.map(t => deleted('tasks', t)),
      );
      done();
    },
    [commit, done],
  );

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Клавиатурный разбор: J/K — по строкам, T/D/W — дата, X — выбрать, Del — удалить, Enter — открыть.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (isTyping(e.target) || isOverlayOpen() || document.activeElement?.closest('[role="dialog"],[role="menu"]')) return;
      // Кнопки и чипы сами обрабатывают Enter и пробел.
      const onControl = (e.target as HTMLElement | null)?.closest?.('button, a, input');
      if (!items.length) return;
      const target = sel.length ? sel : activeTask ? [activeTask] : [];
      const move = (delta: number) => {
        const i = Math.max(0, Math.min(items.length - 1, activeIndex + delta));
        setActive(i);
        rowRefs.current.get(items[i].id)?.focus();
      };
      let handled = true;
      if (is(e.key, KEYS.down)) move(1);
      else if (is(e.key, KEYS.up)) move(-1);
      else if (is(e.key, KEYS.today)) void setDate(target, today, 'На сегодня');
      else if (is(e.key, KEYS.tomorrow)) void setDate(target, tomorrow, 'На завтра');
      else if (is(e.key, KEYS.week)) void setDate(target, monday, 'На следующую неделю');
      else if (is(e.key, KEYS.select) && activeTask) toggle(activeTask.id);
      else if (is(e.key, KEYS.del)) void remove(target);
      else if (is(e.key, KEYS.open) && activeTask && !onControl) openEditor(activeTask);
      else if (e.key === 'Escape' && sel.length) done();
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, sel, activeTask, activeIndex, today, tomorrow, monday, setDate, remove, toggle, done, openEditor]);

  const noteToTask = (n: InboxNote) =>
    commit('Добавлено в задачи', [
      created('tasks', newTask({ title: n.title, notes: n.body && n.body !== n.title ? n.body : undefined, source: 'telegram' })),
      deleted('notes', n),
    ]);
  const noteToList = (n: InboxNote, listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return;
    const stamp = nowISO();
    const changes: RowChange[] = [
      created('listItems', { id: `${n.id}-li`, createdAt: stamp, updatedAt: stamp, listId, text: n.title, note: n.body && n.body !== n.title ? n.body : undefined, position: Date.now() }),
      deleted('notes', n),
    ];
    return commit(`В списке «${list.title}»`, changes);
  };
  const keepNote = (n: InboxNote) => commit('Оставлено в заметках', [updated('notes', n, { ...n, triagedAt: nowISO() } as InboxNote)]);

  const now = new Date();

  return (
    <div className="animate-in space-y-6">
      <PageHeader
        title="Входящие"
        icon={<SectionIcon k="inbox" size={20} />}
        description={
          total ? (
            <span>
              <span className="font-mono tabular-nums text-text">{total}</span> {inboxCountText(total).replace(/^\d+\s/, '')}
            </span>
          ) : (
            inboxCountText(0)
          )
        }
        actions={
          <>
            {items.length ? (
              <p
                className="mr-2 hidden items-center gap-1 text-caption text-muted lg:flex"
                aria-label="Клавиши разбора: J и K — по строкам, T — сегодня, D — завтра, W — на неделе, X — выбрать, Delete — удалить"
              >
                <Kbd>J</Kbd>
                <Kbd>K</Kbd>
                <span className="mr-2">по строкам</span>
                <Kbd>T</Kbd>
                <Kbd>D</Kbd>
                <Kbd>W</Kbd>
                <span className="mr-2">дата</span>
                <Kbd>X</Kbd>
                <span className="mr-2">выбрать</span>
                <Kbd>Del</Kbd>
              </p>
            ) : null}
            <Button variant="secondary" onClick={openQuick}>
              <Plus size={16} aria-hidden="true" />
              Записать
            </Button>
          </>
        }
      />

      {sel.length ? (
        <div
          role="toolbar"
          aria-label="Действия с выбранными"
          className="sticky top-2 z-10 flex flex-wrap items-center gap-1 rounded-control border border-border bg-raised p-1 shadow-(--shadow-pop)"
        >
          <span className="px-2 text-small font-medium text-text">
            Выбрано <span className="font-mono tabular-nums">{sel.length}</span>
          </span>
          <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
          <Button variant="ghost" size="sm" className={ACTION} onClick={() => void setDate(sel, today, 'На сегодня')}>
            Сегодня
          </Button>
          <Button variant="ghost" size="sm" className={ACTION} onClick={() => void setDate(sel, tomorrow, 'На завтра')}>
            Завтра
          </Button>
          <Button variant="ghost" size="sm" className={ACTION} onClick={() => void setDate(sel, monday, 'На следующую неделю')}>
            На неделе
          </Button>
          <PickerMenu label="Доска" items={boardItems} onSelect={id => void toBoard(sel, id)} className={MENU_TRIGGER}>
            Доска
            <ChevronDown size={14} aria-hidden="true" className="text-muted" />
          </PickerMenu>
          <PickerMenu label="Цель" searchable noneLabel="Без цели" items={goalItems} onSelect={id => void toGoal(sel, id)} className={MENU_TRIGGER}>
            Цель
            <ChevronDown size={14} aria-hidden="true" className="text-muted" />
          </PickerMenu>
          <Button variant="danger-quiet" size="sm" className={ACTION} onClick={() => void remove(sel)}>
            Удалить
          </Button>
          <IconButton size="sm" aria-label="Снять выбор" onClick={done} className="ml-auto">
            <X size={16} />
          </IconButton>
        </div>
      ) : null}

      {items.length ? (
        <ul aria-label="Задачи во входящих" className="divide-y divide-border border-y border-border">
          {items.map((t, i) => {
            const goal = goals.find(g => g.id === t.goalId);
            const isSel = selected.has(t.id);
            return (
              <li
                key={t.id}
                ref={el => {
                  if (el) rowRefs.current.set(t.id, el);
                  else rowRefs.current.delete(t.id);
                }}
                tabIndex={-1}
                data-active={i === activeIndex || undefined}
                aria-current={i === activeIndex || undefined}
                onFocus={() => setActive(i)}
                onMouseDown={() => setActive(i)}
                className={`group focus-ring-inset relative flex min-h-11 flex-wrap items-center gap-x-3 px-2 transition-colors duration-(--duration-fast) max-sm:pb-1.5 ${
                  isSel ? 'bg-fill-strong' : 'hover:bg-fill focus-visible:bg-fill'
                }`}
              >
                <div className="flex h-11 min-w-0 flex-1 basis-72 items-center gap-3">
                  <span className={`inline-flex ${sel.length ? '' : 'hover-reveal'}`}>
                    <Checkbox checked={isSel} onChange={() => toggle(t.id)} aria-label={`Выбрать: ${t.title}`} />
                  </span>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {t.emoji ? (
                      <span aria-hidden="true" className="font-emoji shrink-0 text-base leading-none">
                        {t.emoji}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openEditor(t)}
                      className="focus-ring min-w-0 truncate rounded-sm text-left text-body text-text"
                    >
                      {t.title}
                    </button>
                    {t.important ? <Flag size={14} role="img" aria-label="Важное" className="shrink-0 text-important-strong" /> : null}
                    <span className="shrink-0 text-caption text-muted">{createdAgo(t.createdAt, now)}</span>
                    {t.source === 'telegram' ? (
                      <span title="Из Telegram" className="inline-flex shrink-0 text-muted">
                        <Send size={14} role="img" aria-label="Из Telegram" />
                      </span>
                    ) : null}
                    {goal ? <GoalChip goal={goal} className="max-sm:hidden" /> : null}
                  </div>
                </div>

                <div
                  role="group"
                  aria-label={`Разобрать: ${t.title}`}
                  className="hover-reveal flex items-center gap-0.5 sm:-mr-1 max-sm:w-full max-sm:overflow-x-auto max-sm:pl-5 max-sm:[scrollbar-width:none]"
                >
                  <Button variant="ghost" size="sm" className={ACTION} onClick={() => void setDate([t], today, 'На сегодня')}>
                    Сегодня
                  </Button>
                  <Button variant="ghost" size="sm" className={ACTION} onClick={() => void setDate([t], tomorrow, 'На завтра')}>
                    Завтра
                  </Button>
                  <Button variant="ghost" size="sm" className={ACTION} onClick={() => void setDate([t], monday, 'На следующую неделю')}>
                    На неделе
                  </Button>
                  <PickerMenu label="Доска" items={boardItems} onSelect={id => void toBoard([t], id)} align="end" className={MENU_TRIGGER}>
                    Доска
                    <ChevronDown size={14} aria-hidden="true" className="text-muted" />
                  </PickerMenu>
                  <PickerMenu
                    label="Цель"
                    searchable
                    noneLabel="Без цели"
                    value={t.goalId}
                    items={goalItems}
                    onSelect={id => void toGoal([t], id)}
                    align="end"
                    className={MENU_TRIGGER}
                  >
                    Цель
                    <ChevronDown size={14} aria-hidden="true" className="text-muted" />
                  </PickerMenu>
                  <IconButton
                    size="sm"
                    aria-label={`Удалить: ${t.title}`}
                    title="Удалить"
                    onClick={() => void remove([t])}
                    className="hover:text-danger-strong!"
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {tgNotes.length ? (
        <section aria-labelledby="inbox-tg">
          <h2 id="inbox-tg" className="mb-2 flex items-center gap-2 px-2 label-text text-muted-strong">
            Заметки из Telegram
            <span className="font-mono text-caption font-normal tabular-nums text-muted">{tgNotes.length}</span>
          </h2>
          <ul className="divide-y divide-border border-y border-border">
            {tgNotes.map(n => (
              <li key={n.id} className="group flex min-h-11 flex-wrap items-center gap-x-3 pr-2 pl-9 hover:bg-fill max-sm:pb-1.5">
                <div className="flex h-11 min-w-0 flex-1 basis-72 items-center gap-2">
                  <p className="min-w-0 truncate text-body text-text">{n.title}</p>
                  <span className="shrink-0 text-caption text-muted">{createdAgo(n.createdAt, now)}</span>
                  {n.body && n.body !== n.title ? <span className="min-w-0 truncate text-caption text-muted max-sm:hidden">{n.body}</span> : null}
                </div>
                <div className="hover-reveal -ml-2 flex items-center gap-0.5 sm:-mr-1 sm:ml-0 max-sm:w-full max-sm:overflow-x-auto max-sm:[scrollbar-width:none]">
                  <Button variant="ghost" size="sm" className={ACTION} onClick={() => void noteToTask(n)}>
                    В задачу
                  </Button>
                  {lists.length ? (
                    <PickerMenu label="В список" items={listItems} onSelect={id => void noteToList(n, id)} align="end" className={MENU_TRIGGER}>
                      В список
                      <ChevronDown size={14} aria-hidden="true" className="text-muted" />
                    </PickerMenu>
                  ) : null}
                  <Button variant="ghost" size="sm" className={ACTION} onClick={() => void keepNote(n)}>
                    Оставить
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {total === 0 ? (
        <EmptyState title="Входящие пусты" description="Новое записывай клавишей N — оно подождёт здесь." className="border-y border-border" />
      ) : null}

      {editor}
    </div>
  );
}
