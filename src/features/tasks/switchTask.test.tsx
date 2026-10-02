import { describe, it, expect } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/Toast';
import { MemoryStore } from '@/data/memory';
import { setStore } from '@/data';
import type { Task } from '@/lib/types';
import { TaskActionsProvider, useTaskActionsCtx } from './TaskActionsContext';
import { TaskCard } from './TaskCard';

const stamp = '2026-01-01T00:00:00.000Z';
const task = (id: string, p: Partial<Task> = {}): Task => ({
  id, title: id, createdAt: stamp, updatedAt: stamp, area: 'work', status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: 0, ...p,
});

function Cards() {
  const { tasks } = useTaskActionsCtx();
  return (
    <>
      {[...tasks].sort((a, b) => a.id.localeCompare(b.id)).map(t => (
        <TaskCard key={t.id} task={t} />
      ))}
    </>
  );
}

async function setup(extra: Task[] = []) {
  const store = new MemoryStore();
  setStore(store);
  await store.put('tasks', task('Отчёт', { status: 'doing', actualStart: new Date(Date.now() - 600000).toISOString() }));
  await store.put('tasks', task('Созвон'));
  for (const t of extra) await store.put('tasks', t);
  render(
    <ToastProvider>
      <TaskActionsProvider>
        <Cards />
      </TaskActionsProvider>
    </ToastProvider>,
  );
  await screen.findByRole('button', { name: 'Начать: Созвон' });
  return store;
}

const get = async (store: MemoryStore, id: string) => (await store.list('tasks')).find(t => t.id === id)!;

describe('переключение задач', () => {
  it('вместо ошибки — «Сейчас идёт» с кнопкой «Переключиться»', async () => {
    const store = await setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Начать: Созвон' }));
    });
    expect(screen.getByText('Сейчас идёт «Отчёт»')).toBeInTheDocument();
    expect((await get(store, 'Созвон')).status).toBe('todo');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Переключиться' }));
    });
    await waitFor(async () => expect((await get(store, 'Созвон')).status).toBe('doing'));
    const prev = await get(store, 'Отчёт');
    expect(prev.status).toBe('done');
    expect(prev.actualEnd).toBeTruthy();
    // Конец одной и начало другой — один момент.
    expect(prev.actualEnd).toBe((await get(store, 'Созвон')).actualStart);
  });

  it('переключение отменяется одним шагом', async () => {
    const store = await setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Начать: Созвон' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Переключиться' }));
    });
    await screen.findByText('Переключились на «Созвон»');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    });
    await waitFor(async () => expect((await get(store, 'Созвон')).status).toBe('todo'));
    const prev = await get(store, 'Отчёт');
    expect(prev.status).toBe('doing');
    expect(prev.actualEnd).toBeUndefined();
  });

  it('галочка «готово» отменяется', async () => {
    const store = await setup();
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Отметить готово: Созвон'));
    });
    await waitFor(async () => expect((await get(store, 'Созвон')).status).toBe('done'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    });
    await waitFor(async () => expect((await get(store, 'Созвон')).status).toBe('todo'));
  });

  it('карточка показывает цель задачи', async () => {
    const store = new MemoryStore();
    setStore(store);
    await store.put('goals', { id: 'g', title: 'Запустить сайт', emoji: '🚀', horizon: 'month', status: 'active', createdAt: stamp, updatedAt: stamp });
    await store.put('tasks', task('Макет', { goalId: 'g' }));
    render(
      <ToastProvider>
        <TaskActionsProvider>
          <Cards />
        </TaskActionsProvider>
      </ToastProvider>,
    );
    expect(await screen.findByText('Запустить сайт')).toBeInTheDocument();
  });
});
