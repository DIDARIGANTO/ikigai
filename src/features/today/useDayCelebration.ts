import { useEffect, useRef } from 'react';
import type { Task } from '@/lib/types';
import { burst } from '@/components/ui/Burst';
import { useToast } from '@/components/ui/Toast';

/** Все задачи дня закрыты и хотя бы одна сделана. */
export function allDone(dayTasks: Task[]): boolean {
  const counted = dayTasks.filter(t => t.status !== 'skipped');
  return counted.length > 0 && counted.every(t => t.status === 'done');
}

/**
 * Праздник, когда человек закрыл последнюю задачу дня: залп и спокойное уведомление.
 * Срабатывает только на переходе «было что делать → всё сделано» внутри одного дня,
 * а не при открытии страницы с уже закрытым днём.
 */
export function useDayCelebration(dayTasks: Task[], date: string) {
  const toast = useToast();
  const prev = useRef<{ date: string; done: boolean; open: number } | null>(null);
  const done = allDone(dayTasks);
  const open = dayTasks.filter(t => t.status === 'todo' || t.status === 'doing').length;

  useEffect(() => {
    const p = prev.current;
    prev.current = { date, done, open };
    if (!p || p.date !== date) return;
    if (done && !p.done && p.open > 0) {
      burst({ x: window.innerWidth / 2, y: window.innerHeight / 3 }, { count: 90, power: 12 });
      toast('Все задачи на сегодня сделаны');
    }
  }, [date, done, open, toast]);
}
