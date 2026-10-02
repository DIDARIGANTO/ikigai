import { useEffect, useState } from 'react';
import { Bell, Cake, Flag } from 'lucide-react';
import type { Reminder, Task } from '@/lib/types';

// oxlint-disable-next-line react/only-export-components -- проверка статуса живёт рядом со строками, которые её рисуют
export const isClosed = (task: Task) => task.status === 'done' || task.status === 'skipped';

/**
 * Цвет смысла задачи — точка 6 px или полоса 2 px, никогда не заливка: работа — акцент, личное — бирюза,
 * тренировка — нейтрально, закрытая — приглушённая линия. Строки целиком — чтобы сборщик их нашёл.
 */
// oxlint-disable-next-line react/only-export-components -- цвет метки живёт рядом со строками, которые её рисуют
export function taskDot(task: Task): string {
  if (isClosed(task)) return 'bg-border-strong';
  if (task.kind === 'workout') return 'bg-muted';
  return task.area === 'work' ? 'bg-accent' : 'bg-personal';
}

/** Нейтральная плашка с линией в волос; закрытая — приглушена и зачёркнута. */
// oxlint-disable-next-line react/only-export-components -- классы плашки живут рядом со строками, которые её рисуют
export function chipTone(task: Task): string {
  return isClosed(task)
    ? 'border-border text-muted line-through decoration-muted/60'
    : 'border-border text-text hover:bg-fill hover:border-border-strong';
}

// oxlint-disable-next-line react/only-export-components -- проверка живёт рядом с иконкой, которая от неё зависит
export const isBirthday = (r: Reminder) => r.repeat === 'yearly';

/** Иконка напоминания: торт — у ежегодных (дни рождения), колокольчик — у остальных. Без подложки. */
export function ReminderIcon({ reminder, size = 12, className = '' }: { reminder: Reminder; size?: number; className?: string }) {
  return isBirthday(reminder) ? (
    <Cake size={size} role="img" aria-label="День рождения" className={`shrink-0 ${className}`} />
  ) : (
    <Bell size={size} role="img" aria-label="Напоминание" className={`shrink-0 ${className}`} />
  );
}

/** Плашка напоминания в сетке: нейтральная, с иконкой 12 px и временем. Не перетаскивается. */
export function ReminderChip({ reminder, className = '' }: { reminder: Reminder; className?: string }) {
  return (
    <div
      title={reminder.text}
      className={`flex h-5.5 min-w-0 items-center gap-1.5 rounded-chip border border-border px-1.5 text-caption text-muted-strong ${className}`}
    >
      <ReminderIcon reminder={reminder} className="text-muted" />
      {/* Время — первым, как у задач: в узкой клетке название обрезается, а время остаётся. */}
      {reminder.time ? <span className="shrink-0 font-mono text-muted">{reminder.time}</span> : null}
      <span className="truncate">{reminder.text}</span>
    </div>
  );
}

/**
 * Плашка задачи без логики переноса — её рисуют и ячейка месяца, и дорожка недели, и призрак под курсором:
 * точка 6 px по смыслу, время моноширинным (если есть), название; важная — флажок.
 */
export function TaskChipBody({ task }: { task: Task }) {
  return (
    <>
      <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-mark ${taskDot(task)}`} />
      {task.plannedStart ? (
        <span className="shrink-0 font-mono text-muted no-underline">{task.plannedStart}</span>
      ) : null}
      {task.emoji ? (
        <span aria-hidden="true" className="font-emoji shrink-0 no-underline">
          {task.emoji}
        </span>
      ) : null}
      <span className="min-w-0 truncate">{task.title}</span>
      {task.important && !isClosed(task) ? (
        <Flag size={12} aria-label="Важная" role="img" fill="currentColor" fillOpacity={0.2} className="shrink-0 text-important-strong" />
      ) : null}
    </>
  );
}

/** Минуты от полуночи «сейчас», с перерисовкой раз в минуту (только пока `active`). */
// oxlint-disable-next-line react/only-export-components -- хук часов живёт рядом с разметкой календаря
export function useNowMinutes(active = true): number {
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
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/** Узкий экран (телефон): неделя показывает окно из трёх дней, месяц — точки. */
// oxlint-disable-next-line react/only-export-components -- хук ширины живёт рядом с разметкой календаря
export function useMedia(query: string): boolean {
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  const [match, setMatch] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}
