import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MemoryStore } from '@/data/memory';
import { setStore } from '@/data';
import { ToastProvider } from '@/components/ui/Toast';
import { TaskActionsProvider } from '@/features/tasks/TaskActionsContext';
import type { Task } from '@/lib/types';

/** Свежая память вместо IndexedDB и все провайдеры «Сегодня». */
export async function renderToday(ui: ReactNode, seed: { tasks?: Task[] } = {}) {
  const store = new MemoryStore();
  if (seed.tasks) await store.putMany('tasks', seed.tasks);
  setStore(store);
  const r = render(
    <MemoryRouter>
      <ToastProvider>
        <TaskActionsProvider>{ui}</TaskActionsProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
  return { ...r, store };
}

let n = 0;
export const makeTask = (p: Partial<Task> = {}): Task => ({
  id: `t${++n}`,
  title: `Задача ${n}`,
  area: 'work',
  status: 'todo',
  rescheduleCount: 0,
  source: 'web',
  kind: 'task',
  position: n,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...p,
});
