import { useEffect, useState } from 'react';
import { Play, Square } from 'lucide-react';
import type { Task } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { isRunning, planVsFact } from '@/lib/domain/tasks';
import { useTaskActionsCtx } from './TaskActionsContext';

const pad = (n: number) => String(n).padStart(2, '0');

/** Секунды → `mm:ss`, а после часа — `h:mm:ss`. */
// oxlint-disable-next-line react/only-export-components -- формат таймера нужен и карточке «Сейчас»
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** Тикает раз в секунду, пока задача идёт; в остальных состояниях таймер не запускается. */
// oxlint-disable-next-line react/only-export-components -- хук таймера нужен и карточке «Сейчас»
export function useElapsed(sinceISO: string | undefined, running: boolean) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running || !sinceISO) return;
    const from = new Date(sinceISO).getTime();
    if (Number.isNaN(from)) return;
    const tick = () => setSeconds((Date.now() - from) / 1000);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sinceISO, running]);

  return seconds;
}

export function TaskTimer({ task, className = '' }: { task: Task; className?: string }) {
  const { start, finish } = useTaskActionsCtx();
  // Задача «в работе» с доски, но без запущенного таймера, — это ещё не отсчёт: ей нужна кнопка «Начать».
  const running = isRunning(task);
  const seconds = useElapsed(task.actualStart, running);

  if (running) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span aria-live="off" className="font-mono text-small tabular-nums text-accent-strong" title="Идёт с начала работы">
          {formatElapsed(seconds)}
        </span>
        <Button variant="secondary" size="sm" onClick={() => void finish(task)} title="Закончить">
          <Square size={14} fill="currentColor" aria-hidden="true" />
          <span className="hidden sm:inline">Закончить</span>
          <span className="sr-only sm:hidden">Закончить</span>
        </Button>
      </div>
    );
  }

  if (task.status === 'done') {
    const pf = planVsFact(task);
    if (!pf) return null;
    return (
      <span className={`font-mono text-caption text-muted tabular-nums whitespace-nowrap ${className}`}>
        план {pf.planned} мин · факт {pf.actual} мин
      </span>
    );
  }

  if (task.status !== 'todo' && task.status !== 'doing') return null;

  return (
    <Button variant="ghost" size="sm" className={className} onClick={() => void start(task)} title="Начать">
      <Play size={14} fill="currentColor" aria-hidden="true" />
      <span className="hidden sm:inline">Начать</span>
      <span className="sr-only sm:hidden">Начать</span>
    </Button>
  );
}
