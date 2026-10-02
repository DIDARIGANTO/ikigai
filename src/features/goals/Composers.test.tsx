import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { setStore, clearStore } from '@/data';
import { MemoryStore } from '@/data/memory';
import { ToastProvider } from '@/components/ui/Toast';
import { TaskActionsProvider } from '@/features/tasks/TaskActionsContext';
import type { Goal } from '@/lib/types';
import { StepComposer, SubgoalComposer } from './Composers';

const T = '2026-09-30T08:00:00.000Z';
const goal: Goal = { id: 'y', title: 'Полумарафон', horizon: 'year', status: 'active', createdAt: T, updatedAt: T };

afterEach(() => clearStore());

function renderWith(ui: React.ReactNode) {
  const store = new MemoryStore();
  setStore(store);
  render(
    <ToastProvider>
      <TaskActionsProvider>{ui}</TaskActionsProvider>
    </ToastProvider>,
  );
  return store;
}

describe('goal composers', () => {
  it('breaks a goal into several subgoals of the next horizon at once', async () => {
    const store = renderWith(<SubgoalComposer goal={goal} />);
    fireEvent.change(screen.getByLabelText(/Разбить на подцели/), { target: { value: '- Бегать 3 раза\n\n- Забег 10 км\n' } });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить 2 подцели' }));
    await waitFor(async () => expect(await store.list('goals')).toHaveLength(2));
    const rows = (await store.list('goals')).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    expect(rows.map(r => [r.title, r.horizon, r.parentId])).toEqual([
      ['Бегать 3 раза', 'month', 'y'],
      ['Забег 10 км', 'month', 'y'],
    ]);
    expect(await screen.findByText('2 подцели добавлены')).toBeInTheDocument();
  });

  it('adds a step linked to the goal on Enter', async () => {
    const store = renderWith(<StepComposer goal={goal} />);
    const input = screen.getByLabelText('Новый шаг к цели «Полумарафон»');
    fireEvent.change(input, { target: { value: 'Купить кроссовки' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(async () => expect(await store.list('tasks')).toHaveLength(1));
    expect((await store.list('tasks'))[0]).toMatchObject({ title: 'Купить кроссовки', goalId: 'y', status: 'todo' });
    expect(input).toHaveValue('');
  });
});
