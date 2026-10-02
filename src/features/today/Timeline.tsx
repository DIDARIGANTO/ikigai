import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import type { Task } from '@/lib/types';
import { addDaysISO, todayISO } from '@/lib/dates';
import { tasksForDate } from '@/lib/domain/tasks';
import {
  buildRows,
  contentHeight,
  factFromDoneAt,
  factGeometry,
  formatRange,
  hhmm,
  layoutBlocks,
  minutesOnDate,
  missedState,
  nudge,
  pickScrollTarget,
  yAt,
} from '@/lib/domain/timeline';
import type { DragMode, Row } from '@/lib/domain/timeline';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import { useTaskEditor } from '@/features/tasks/TaskEditor';
import { columnFor } from '@/features/tasks/useTaskActions';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTimelineDrag } from './timeline/useTimelineDrag';
import { TimelineBlockView } from './timeline/TimelineBlockView';
import { GUTTER_PX, RIGHT_PX, laneStyle } from './timeline/blockLook';

type Range = { start: number; end: number };

/** Автопрокрутка к «главному» месту дня работает, пока человек сам не тронул шкалу, и не дольше пары секунд. */
const AUTO_SCROLL_MS = 2000;

/**
 * Минуты «сейчас»; часы читаются при отрисовке, а таймер лишь просит перерисовать —
 * раз в минуту, поэтому линия не отстаёт и не тикает лишний раз.
 */
function useNowMinutes(active: boolean): number | null {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const bump = () => setTick(n => n + 1);
    let interval: number | undefined;
    const timeout = window.setTimeout(() => {
      bump();
      interval = window.setInterval(bump, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      window.clearTimeout(timeout);
      if (interval) window.clearInterval(interval);
    };
  }, [active]);

  if (!active) return null;
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/** Подпись свёрнутой полосы: часы пусты по плану, но там мог закончиться факт. */
const stripNote = (done: number) => (done ? `${done} сделано` : 'пусто');

export interface TimelineProps {
  /** День, который показывает шкала. По умолчанию сегодня; «Календарь» передаёт свой. */
  date?: string;
  /** Открыть задачу. Если не передать — Timeline откроет свой редактор. */
  onOpenTask?: (task: Task) => void;
  /** Создать задачу: `{ date, plannedStart, plannedMinutes }`. Если не передать — откроется свой редактор. */
  onCreate?: (defaults: Partial<Task>) => void;
  /** Шкала внутри карточки: без своей рамки и без кнопки «Задача» — их даёт карточка. */
  embedded?: boolean;
  /** Подсказка внутри шкалы, когда задач со временем нет. По умолчанию показывается. */
  emptyHint?: boolean;
  className?: string;
}

/** Сама шкала: получает уже готовые обработчики и своего редактора не заводит. */
function TimelineGrid({
  date,
  onOpenTask: openTask,
  onCreate: createAt,
  embedded = false,
  emptyHint = true,
  className,
}: {
  date: string;
  onOpenTask: (task: Task) => void;
  onCreate: (defaults: Partial<Task>) => void;
  embedded?: boolean;
  emptyHint?: boolean;
  className: string;
}) {
  const { tasks, goals, columns, save, start, finish, skip } = useTaskActionsCtx();
  const toast = useToast();
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const hintId = useId();

  const today = todayISO();
  const isToday = date === today;
  const nowMin = useNowMinutes(isToday);

  // Оптимистичные правки: блок сразу стоит на новом месте, не дожидаясь ответа хранилища.
  const [pending, setPending] = useState<Record<string, Range & { since: string }>>({});
  const [expandedState, setExpandedState] = useState<{ date: string; set: ReadonlySet<number> }>(() => ({
    date,
    set: new Set(),
  }));
  // Раскрытые полосы помнятся только для своего дня.
  const expanded = useMemo(
    () => (expandedState.date === date ? expandedState.set : new Set<number>()),
    [expandedState, date],
  );
  const setExpanded = (fn: (s: ReadonlySet<number>) => ReadonlySet<number>) =>
    setExpandedState(st => ({ date, set: fn(st.date === date ? st.set : new Set()) }));
  const [announce, setAnnounce] = useState('');
  const [hoverMin, setHoverMin] = useState<number | null>(null);

  const dayTasks = useMemo(() => tasksForDate(tasks, date), [tasks, date]);
  const blocks = useMemo(
    () =>
      layoutBlocks(
        dayTasks.map(t => {
          // Правка действует, пока хранилище не прислало новую версию задачи.
          const p = pending[t.id];
          return p && p.since === t.updatedAt ? { ...t, plannedStart: hhmm(p.start), plannedMinutes: p.end - p.start } : t;
        }),
      ),
    [dayTasks, pending],
  );
  const byId = useMemo(() => new Map(dayTasks.map(t => [t.id, t])), [dayTasks]);

  const rows: Row[] = useMemo(() => {
    const busy: Range[] = blocks.map(b => ({ start: b.startMin, end: b.endMin }));
    for (const t of dayTasks) {
      const f = factGeometry(t, date);
      if (f && f.end > f.start) busy.push({ start: f.start, end: f.end });
    }
    const hourOfNow = nowMin === null ? -1 : Math.floor(nowMin / 60);
    // Сегодня прошедшие пустые часы сворачиваются; в другие дни — только ночь, иначе пустой день стал бы одной полосой.
    const collapsible = (h: number) => {
      if (isToday && nowMin !== null) return h !== hourOfNow && ((h + 1) * 60 <= nowMin || h < 6);
      return h < 6;
    };
    return buildRows({ busy, collapsible, expanded });
  }, [blocks, dayTasks, date, isToday, nowMin, expanded]);

  const height = contentHeight(rows);

  // ——— сохранение с отменой ———

  const commitRange = useCallback(
    (task: Task, range: Range, mode: 'move' | 'resize', via: 'pointer' | 'key') => {
      const prev = task;
      const next: Task = {
        ...prev,
        plannedStart: hhmm(range.start),
        plannedMinutes:
          mode === 'move' && prev.plannedMinutes === undefined ? undefined : range.end - range.start,
      };
      setPending(p => ({ ...p, [task.id]: { ...range, since: task.updatedAt } }));
      void save(next);
      const text =
        mode === 'move' ? `Перенесено на ${hhmm(range.start)}` : `Теперь ${formatRange(range.start, range.end)}`;
      setAnnounce(`${task.title}: ${text.toLowerCase()}`);
      if (via === 'pointer') {
        toast(text, {
          action: {
            label: 'Отменить',
            onClick: () => {
              setPending(p => {
                const n = { ...p };
                delete n[task.id];
                return n;
              });
              void save(prev);
              setAnnounce(`${task.title}: вернулось на ${prev.plannedStart ?? ''}`);
            },
          },
        });
      }
    },
    [save, toast],
  );

  const undoable = useCallback(
    (text: string, prev: Task) => toast(text, { kind: 'ok', action: { label: 'Отменить', onClick: () => void save(prev) } }),
    [save, toast],
  );

  const { preview, begin, consumeClick } = useTimelineDrag(scroller, content, rows, {
    onCommit: (mode: DragMode, task, range) => {
      if (mode === 'create') {
        createAt({ date, plannedStart: hhmm(range.start), plannedMinutes: range.end - range.start });
        return;
      }
      const original = task ? byId.get(task.id) : undefined;
      if (original) commitRange(original, range, mode, 'pointer');
    },
    onTapEmpty: minute => {
      const slot = Math.min(Math.floor(minute / 30) * 30, 1410);
      createAt({ date, plannedStart: hhmm(slot), plannedMinutes: 30 });
    },
  });

  // ——— прокрутка к главному ———

  const target = useMemo(() => pickScrollTarget(blocks, nowMin), [blocks, nowMin]);
  const autoScroll = useRef({ until: 0, touched: false });
  useEffect(() => {
    autoScroll.current = { until: Date.now() + AUTO_SCROLL_MS, touched: false };
  }, [date]);
  useLayoutEffect(() => {
    const el = scroller.current;
    const a = autoScroll.current;
    if (!el || a.touched || Date.now() > a.until) return;
    const y = yAt(rows, target.min);
    el.scrollTop = Math.max(0, target.align === 'top' ? y - 16 : y - el.clientHeight / 3);
  }, [rows, target]);
  const touch = () => {
    autoScroll.current.touched = true;
  };

  // ——— клавиатура ———

  const onBlockKey = (task: Task, range: Range) => (e: KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const mode = e.shiftKey ? 'resize' : 'move';
    const next = nudge(range, mode, e.key === 'ArrowUp' ? -15 : 15);
    if (next.start === range.start && next.end === range.end) {
      setAnnounce(mode === 'move' ? `${task.title}: дальше некуда` : `${task.title}: короче 15 минут нельзя`);
      return;
    }
    const original = byId.get(task.id);
    if (original) commitRange(original, next, mode, 'key');
    const el = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => el.scrollIntoView?.({ block: 'nearest' }));
  };

  // ——— пропущенные ———

  const missedHandlers = (task: Task, range: Range) => ({
    onStart: () => void start(task),
    onMoveTo: (at: number | null) => {
      if (at === null) {
        void save({ ...task, date: addDaysISO(date, 1), rescheduleCount: task.rescheduleCount + 1 });
        undoable(`Перенесено на завтра, ${task.plannedStart ?? ''}`.trim(), task);
      } else {
        void save({ ...task, plannedStart: hhmm(at) });
        undoable(`Перенесено на ${hhmm(at)}`, task);
      }
    },
    onSkip: () => {
      void skip(task);
      undoable('Отмечено: не делал', task);
    },
    onDoneAt: (at: number) => {
      void save({
        ...task,
        ...factFromDoneAt(date, at, range.end - range.start),
        status: 'done',
        columnId: columnFor(columns, task.boardId, 'done') ?? task.columnId,
      });
      undoable(`Сделано в ${hhmm(at)}`, task);
    },
  });

  // ——— отрисовка ———

  const hours: number[] = [];
  for (const r of rows) if (r.kind === 'hours') for (let m = r.from; m < r.to; m += 60) hours.push(m);
  const nowVisible = nowMin !== null && !rows.some(r => r.kind === 'strip' && nowMin >= r.from && nowMin < r.to);
  const doneIn = (r: Row) =>
    dayTasks.filter(t => {
      if (t.status !== 'done' || !t.actualEnd) return false;
      const m = minutesOnDate(t.actualEnd, date);
      return m !== null && m >= r.from && m < r.to;
    }).length;

  const onBgPointerDown = (e: ReactPointerEvent) => {
    touch();
    begin(e, 'create', {});
  };
  const onBgPointerMove = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse' || preview) return;
    const top = content.current?.getBoundingClientRect().top ?? 0;
    const y = e.clientY - top;
    const row = rows.find(r => y >= r.top && y < r.top + r.height);
    if (!row || row.kind !== 'hours') return setHoverMin(null);
    const m = Math.floor((row.from + ((y - row.top) / row.height) * (row.to - row.from)) / 30) * 30;
    setHoverMin(m);
  };

  const createPreview = preview?.mode === 'create' ? preview : null;
  const empty = blocks.length === 0;

  return (
    <div className={className}>
      {embedded ? null : (
        <div className="mb-2 flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => createAt({ date })}>
            <Plus size={16} aria-hidden="true" />
            Задача
          </Button>
        </div>
      )}
      <p id={hintId} className="sr-only">
        Стрелки вверх и вниз переносят на 15 минут, Shift со стрелками меняет длительность, Enter открывает задачу.
      </p>
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
      <div
        ref={scroller}
        role="region"
        aria-label="Расписание по часам"
        onWheel={touch}
        onTouchStart={touch}
        onKeyDown={touch}
        className={`relative overflow-y-auto overflow-x-hidden overscroll-contain scroll-thin max-h-104 md:max-h-136 ${
          embedded ? '' : 'rounded-card border border-border bg-surface shadow-(--shadow-raised)'
        }`}
      >
        <div ref={content} className="relative select-none" style={{ height }}>
          {/* Линии часов — в волос, подписи — моноширинные. */}
          {hours.map(m => (
            <div
              key={m}
              aria-hidden="true"
              className="absolute right-0 border-t border-border/70"
              style={{ top: yAt(rows, m), left: GUTTER_PX }}
            />
          ))}
          {hours.map(m =>
            nowVisible && nowMin !== null && Math.abs(nowMin - m) < 20 ? null : (
              <span
                key={m}
                aria-hidden="true"
                className="absolute left-0 pr-2.5 text-right font-mono text-micro text-muted"
                style={{ top: yAt(rows, m) - 7, width: GUTTER_PX }}
              >
                {hhmm(m)}
              </span>
            ),
          )}

          {/* Пустое место: нажать — задача на получас, провести вниз — блок нужной длины. */}
          <div
            data-tl-bg=""
            aria-hidden="true"
            onPointerDown={onBgPointerDown}
            onPointerMove={onBgPointerMove}
            onPointerLeave={() => setHoverMin(null)}
            onContextMenu={e => e.preventDefault()}
            className="absolute inset-y-0 right-0 cursor-cell"
            style={{ left: GUTTER_PX }}
          />

          {hoverMin !== null && !preview ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute flex items-center gap-1 rounded-chip bg-fill px-2 text-caption text-muted"
              style={{ top: yAt(rows, hoverMin) + 2, height: 24, left: GUTTER_PX, right: RIGHT_PX + 6 }}
            >
              <Plus size={14} />
              <span className="font-mono">{hhmm(hoverMin)}</span>
            </div>
          ) : null}

          {/* Свёрнутые пустые часы: одна тонкая строка между линиями. */}
          {rows.map((r, i) =>
            r.kind === 'strip' ? (
              <button
                key={`s${r.from}`}
                type="button"
                aria-expanded={false}
                onClick={() => setExpanded(s => new Set(s).add(r.from))}
                className={`focus-ring-inset absolute right-0 z-10 flex items-center gap-1.5 border-t border-border/70 px-3 text-caption text-muted hover:bg-fill hover:text-muted-strong pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:-inset-y-2.5 pointer-coarse:before:content-[''] ${
                  i === rows.length - 1 ? 'border-b' : ''
                }`}
                style={{ top: r.top, height: r.height, left: GUTTER_PX }}
              >
                <ChevronDown size={14} aria-hidden="true" />
                <span className="font-mono">{formatRange(r.from, r.to)}</span>
                <span>· {stripNote(doneIn(r))}</span>
                <span className="sr-only">— показать часы</span>
              </button>
            ) : null,
          )}
          {[...expanded].map(from => {
            const r = rows.find(x => x.kind === 'hours' && from >= x.from && from < x.to);
            if (!r) return null;
            return (
              <button
                key={`e${from}`}
                type="button"
                aria-expanded={true}
                aria-label="Свернуть пустые часы"
                title="Свернуть пустые часы"
                onClick={() =>
                  setExpanded(s => {
                    const n = new Set(s);
                    n.delete(from);
                    return n;
                  })
                }
                className="focus-ring absolute z-10 inline-flex size-6 items-center justify-center rounded-chip text-muted hover:bg-fill hover:text-text pointer-coarse:before:absolute pointer-coarse:before:-inset-2.5 pointer-coarse:before:content-['']"
                style={{ top: yAt(rows, from) + 4, right: RIGHT_PX + 4 }}
              >
                <ChevronUp size={14} aria-hidden="true" />
              </button>
            );
          })}

          {empty && emptyHint && !createPreview ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute flex flex-col justify-center gap-0.5 rounded-control border border-dashed border-border-strong px-4"
              style={{ top: yAt(rows, target.min) + 4, height: 64, left: GUTTER_PX, right: RIGHT_PX + 6 }}
            >
              <span className="text-small font-medium text-muted-strong">Свободное расписание</span>
              <span className="text-caption text-muted">
                <span className="pointer-coarse:hidden">Проведите вниз по часам — появится блок нужной длины</span>
                <span className="hidden pointer-coarse:inline">Нажмите на час, чтобы запланировать</span>
              </span>
            </div>
          ) : null}

          {/* Блоки. */}
          <div className="pointer-events-none absolute inset-0">
            {blocks.map(b => {
              const live = preview && preview.taskId === b.task.id ? preview : null;
              const range = { start: b.startMin, end: b.endMin };
              const shown = live ? { start: live.start, end: live.end } : range;
              const original = byId.get(b.task.id) ?? b.task;
              const missed = missedState(b.task, { date, today, nowMin }).missed;
              return (
                <TimelineBlockView
                  key={b.task.id}
                  block={b}
                  range={shown}
                  rows={rows}
                  date={date}
                  nowMin={nowMin}
                  missed={missed && !live}
                  goal={b.task.goalId ? goals.find(g => g.id === b.task.goalId) : undefined}
                  state={live ? 'lifted' : 'idle'}
                  hintId={hintId}
                  onOpen={() => {
                    if (!consumeClick()) openTask(original);
                  }}
                  onBodyPointerDown={e => {
                    e.stopPropagation();
                    touch();
                    begin(e, 'move', { task: original, base: range });
                  }}
                  onGripPointerDown={e => {
                    e.stopPropagation();
                    touch();
                    begin(e, 'move', { task: original, base: range, immediate: true });
                  }}
                  onResizePointerDown={e => {
                    e.stopPropagation();
                    touch();
                    begin(e, 'resize', { task: original, base: range, immediate: true });
                  }}
                  onKeyDown={onBlockKey(original, range)}
                  onStart={() => void start(original)}
                  onFinish={() => void finish(original)}
                  missedHandlers={missedHandlers(original, range)}
                />
              );
            })}
            {/* Призрак на старом месте, пока блок едет. */}
            {preview && preview.mode !== 'create'
              ? blocks
                  .filter(b => b.task.id === preview.taskId)
                  .map(b => (
                    <div
                      key="ghost"
                      aria-hidden="true"
                      className="absolute rounded-control border border-dashed border-border-strong"
                      style={{
                        top: yAt(rows, b.startMin) + 1,
                        height: Math.max(yAt(rows, b.endMin) - yAt(rows, b.startMin) - 2, 22),
                        left: laneStyle(b.lane, b.lanes).left,
                        // Как у плана: справа остаётся место под дорожку факта.
                        width: `calc(${laneStyle(b.lane, b.lanes).width} - 6px)`,
                      }}
                    />
                  ))
              : null}
          </div>

          {/* Живая подпись времени у перетаскиваемого блока. */}
          {preview ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute z-40 inline-flex h-5 items-center rounded-chip border border-border-strong bg-raised px-1.5 font-mono text-caption text-text shadow-(--shadow-pop)"
              style={{
                top: Math.max(2, yAt(rows, preview.start) - 24),
                ...(() => {
                  const b = blocks.find(x => x.task.id === preview.taskId);
                  return b ? { left: `calc(${laneStyle(b.lane, b.lanes).left} + 6px)` } : { left: GUTTER_PX + 6 };
                })(),
              }}
            >
              {formatRange(preview.start, preview.end)}
            </div>
          ) : null}

          {createPreview ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute z-30 flex items-start rounded-control border border-accent bg-accent-soft px-3 py-1 text-small font-medium text-accent-strong"
              style={{
                top: yAt(rows, createPreview.start) + 1,
                height: Math.max(yAt(rows, createPreview.end) - yAt(rows, createPreview.start) - 2, 22),
                left: GUTTER_PX,
                right: RIGHT_PX + 6,
              }}
            >
              Новая задача
            </div>
          ) : null}

          {/* «Сейчас»: линия 1 px акцентом под блоками и время в маленьком нейтральном чипе слева. */}
          {nowVisible && nowMin !== null ? (
            <div
              className="pointer-events-none absolute inset-x-0 z-5"
              style={{ top: yAt(rows, nowMin) }}
              aria-hidden="true"
            >
              <div className="h-px bg-accent" style={{ marginLeft: GUTTER_PX }} />
              <span
                className="absolute -top-2.5 left-0 flex justify-end"
                style={{ width: GUTTER_PX }}
              >
                <span className="inline-flex h-5 items-center rounded-chip border border-border bg-surface px-1 font-mono text-micro text-accent-strong">
                  {hhmm(nowMin)}
                </span>
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Шкала со своим редактором — для страниц, которые не дали собственный. */
function TimelineWithEditor({
  date,
  onOpenTask,
  onCreate,
  embedded,
  emptyHint,
  className,
}: TimelineProps & { date: string; className: string }) {
  const fallback = useTaskEditor();
  return (
    <>
      <TimelineGrid
        date={date}
        embedded={embedded}
        emptyHint={emptyHint}
        className={className}
        onOpenTask={onOpenTask ?? ((t: Task) => fallback.open(t))}
        onCreate={onCreate ?? ((d: Partial<Task>) => fallback.open(null, d))}
      />
      {fallback.editor}
    </>
  );
}

export function Timeline({
  date = todayISO(),
  onOpenTask,
  onCreate,
  embedded = false,
  emptyHint = true,
  className = '',
}: TimelineProps) {
  // Свой редактор заводим, только если страница не открывает задачи сама, — иначе их было бы два.
  return onOpenTask && onCreate ? (
    <TimelineGrid
      date={date}
      onOpenTask={onOpenTask}
      onCreate={onCreate}
      embedded={embedded}
      emptyHint={emptyHint}
      className={className}
    />
  ) : (
    <TimelineWithEditor
      date={date}
      onOpenTask={onOpenTask}
      onCreate={onCreate}
      embedded={embedded}
      emptyHint={emptyHint}
      className={className}
    />
  );
}
