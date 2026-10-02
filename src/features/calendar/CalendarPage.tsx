import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { isOverlayOpen } from '@/components/ui/overlay';
import { useCollection } from '@/data/hooks';
import { formatDayRu, formatMonthRu, todayISO } from '@/lib/dates';
import { useTaskEditor } from '@/features/tasks/TaskEditor';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import { DayView } from './DayView';
import { MonthView } from './MonthView';
import { WeekGrid } from './WeekGrid';
import {
  VIEWS,
  calendarHotkey,
  isView,
  monthGrid,
  planSummary,
  remindersOn,
  sameMonth,
  shiftCursor,
  summaryLine,
  tasksByDate,
  weekGrid,
  weekTitleRu,
} from './grid';
import type { CalendarHotkey, CalendarView } from './grid';
import { useMedia } from './parts';

/** Листание: «Сегодня» — вторичная кнопка, рядом две кнопки-иконки «‹ ›». */
function Pager({ onPrev, onToday, onNext }: { onPrev: () => void; onToday: () => void; onNext: () => void }) {
  return (
    <div role="group" aria-label="Листать календарь" className="inline-flex items-center gap-1">
      <Button variant="secondary" size="sm" onClick={onToday} title="К сегодняшнему дню · T" className="mr-1 pointer-coarse:h-10">
        Сегодня
      </Button>
      <IconButton size="sm" aria-label="Назад" title="Назад · [" onClick={onPrev}>
        <ChevronLeft size={16} aria-hidden="true" />
      </IconButton>
      <IconButton size="sm" aria-label="Вперёд" title="Вперёд · ]" onClick={onNext}>
        <ChevronRight size={16} aria-hidden="true" />
      </IconButton>
    </div>
  );
}

const VIEW_OPTIONS = VIEWS.map((v, i) => ({ value: v.key, label: v.label, ariaLabel: `${v.label} · ${i + 1}` }));

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

/**
 * Клавиши страницы календаря: T — сегодня, [ и ] — листать, 1/2/3 — месяц, неделя, день.
 * Молчат, пока печатают, открыт диалог или всплывающее окно.
 */
// oxlint-disable-next-line react/only-export-components -- хук клавиш живёт рядом со страницей, которой он нужен
export function useCalendarHotkeys(onKey: (k: CalendarHotkey) => void) {
  const handler = useRef(onKey);
  useEffect(() => {
    handler.current = onKey;
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || isTypingTarget(e.target)) return;
      if (isOverlayOpen() || document.querySelector('[data-overlay="popover"]')) return;
      if (document.activeElement?.closest('[role="dialog"]')) return;
      const k = calendarHotkey(e);
      if (!k) return;
      e.preventDefault();
      handler.current(k);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}

export function CalendarPage() {
  const { tasks } = useTaskActionsCtx();
  const reminders = useCollection('reminders');
  const [params, setParams] = useSearchParams();
  const { open, editor } = useTaskEditor();

  const today = todayISO();
  const [cursor, setCursor] = useState(today);

  const param = params.get('view');
  const view: CalendarView = isView(param) ? param : 'month';

  const setView = useCallback(
    (v: CalendarView) => {
      const next = new URLSearchParams(params);
      next.set('view', v);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const byDate = useMemo(() => tasksByDate(tasks), [tasks]);
  const tasksFor = useCallback((iso: string) => byDate.get(iso) ?? [], [byDate]);
  const remindersFor = useCallback((iso: string) => remindersOn(reminders, iso), [reminders]);

  const days = useMemo(() => (view === 'month' ? monthGrid(cursor) : weekGrid(cursor)), [view, cursor]);

  const title =
    view === 'month' ? formatMonthRu(cursor) : view === 'week' ? weekTitleRu(cursor) : formatDayRu(cursor);

  const pickDay = (iso: string) => {
    setCursor(iso);
    setView('day');
  };

  useCalendarHotkeys(k => {
    if (k === 'today') setCursor(todayISO());
    else if (k === 'prev') setCursor(c => shiftCursor(c, view, -1));
    else if (k === 'next') setCursor(c => shiftCursor(c, view, 1));
    else setView(k);
  });

  const narrow = useMedia('(max-width: 639px)');

  // Итог под заголовком: «план 4 ч · сделано 2 из 5» за день, неделю или месяц.
  const summary = useMemo(() => {
    const range = view === 'day' ? [cursor] : view === 'week' ? days : days.filter(d => sameMonth(d, cursor));
    return summaryLine(planSummary(range.flatMap(d => tasksFor(d))));
  }, [view, cursor, days, tasksFor]);

  return (
    <div className="mx-auto max-w-[1120px] space-y-4 md:space-y-6">
      <PageHeader
        title={<span className="inline-block first-letter:uppercase">{title}</span>}
        // Сводка с числами — моноширинная; «Задач нет» — обычным текстом.
        description={<span className={`text-small ${/\d/.test(summary) ? 'font-mono' : ''}`}>{summary}</span>}
        className="gap-y-3"
        actions={
          // На телефоне переключатель вида — компактный, чтобы листание и вид помещались одной строкой.
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Pager
              onPrev={() => setCursor(c => shiftCursor(c, view, -1))}
              onToday={() => setCursor(today)}
              onNext={() => setCursor(c => shiftCursor(c, view, 1))}
            />
            <Segmented label="Вид календаря" value={view} options={VIEW_OPTIONS} onChange={setView} size={narrow ? 'sm' : 'md'} />
          </div>
        }
      />

      {view === 'week' ? (
        <WeekGrid
          days={days}
          tasksFor={tasksFor}
          remindersFor={remindersFor}
          onOpenTask={t => open(t)}
          onCreate={d => open(null, d)}
          onOpenDay={pickDay}
        />
      ) : view === 'day' ? (
        <DayView
          date={cursor}
          tasks={tasksFor(cursor)}
          reminders={remindersFor(cursor)}
          onOpenTask={t => open(t)}
          onCreate={d => open(null, { date: cursor, ...d })}
        />
      ) : (
        <MonthView
          cursor={cursor}
          days={days}
          tasksFor={tasksFor}
          remindersFor={remindersFor}
          onOpenTask={t => open(t)}
          onPickDay={pickDay}
          onCreate={iso => open(null, { date: iso })}
        />
      )}

      {editor}
    </div>
  );
}
