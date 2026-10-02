import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/Toast';
import type { Task } from '@/lib/types';
import { allDone, useDayCelebration } from './useDayCelebration';
import { makeTask } from './testUtils';

const D = '2026-09-30';
afterEach(cleanup);

function Probe({ tasks, date = D }: { tasks: Task[]; date?: string }) {
  useDayCelebration(tasks, date);
  return null;
}
const wrap = (tasks: Task[], date?: string) => (
  <ToastProvider>
    <Probe tasks={tasks} date={date} />
  </ToastProvider>
);

describe('useDayCelebration', () => {
  const a = makeTask({ date: D });
  const b = makeTask({ date: D });

  it('celebrates when the last open task of the day gets done', async () => {
    const r = render(wrap([a, { ...b, status: 'done' }]));
    expect(screen.queryByText('Все задачи на сегодня сделаны')).toBeNull();
    r.rerender(wrap([{ ...a, status: 'done' }, { ...b, status: 'done' }]));
    expect(await screen.findByText('Все задачи на сегодня сделаны')).toBeInTheDocument();
  });

  it('stays quiet when the page opens on an already finished day or the day changes', () => {
    const r = render(wrap([]));
    r.rerender(wrap([{ ...a, status: 'done' }]));
    r.rerender(wrap([{ ...b, status: 'done' }], '2026-10-01'));
    expect(screen.queryByText('Все задачи на сегодня сделаны')).toBeNull();
  });

  it('allDone needs at least one done task and ignores skipped ones', () => {
    expect(allDone([])).toBe(false);
    expect(allDone([{ ...a, status: 'skipped' }])).toBe(false);
    expect(allDone([{ ...a, status: 'skipped' }, { ...b, status: 'done' }])).toBe(true);
    expect(allDone([a, { ...b, status: 'done' }])).toBe(false);
  });
});
