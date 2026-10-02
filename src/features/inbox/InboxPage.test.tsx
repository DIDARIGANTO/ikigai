import { describe, it, expect } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/Toast';
import { MemoryStore } from '@/data/memory';
import { setStore } from '@/data';
import type { Task } from '@/lib/types';
import { todayISO, addDaysISO } from '@/lib/dates';
import { TaskActionsProvider } from '@/features/tasks/TaskActionsContext';
import { InboxPage } from './InboxPage';

const at = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
const task = (id: string, title: string, h: number, p: Partial<Task> = {}): Task => ({
  id, title, createdAt: at(h), updatedAt: at(h), area: 'personal', status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: 0, ...p,
});

async function setup() {
  const store = new MemoryStore();
  setStore(store);
  await store.put('tasks', task('a', 'Первая', 1));
  await store.put('tasks', task('b', 'Вторая', 2));
  await store.put('tasks', task('c', 'С датой', 3, { date: todayISO() }));
  await store.put('noteFolders', { id: 'f', title: 'Входящие', position: 0, createdAt: at(9), updatedAt: at(9) });
  await store.put('notes', { id: 'n', folderId: 'f', title: 'Книга', body: 'Книга', source: 'telegram', createdAt: at(1), updatedAt: at(1) });
  render(
    <ToastProvider>
      <TaskActionsProvider>
        <InboxPage />
      </TaskActionsProvider>
    </ToastProvider>,
  );
  await screen.findByText('Первая');
  return store;
}

const key = async (k: string) => {
  await act(async () => {
    fireEvent.keyDown(window, { key: k });
  });
};

describe('InboxPage', () => {
  it('показывает только задачи без даты и доски и заметки из Telegram', async () => {
    await setup();
    expect(screen.getByText('Вторая')).toBeInTheDocument();
    expect(screen.queryByText('С датой')).not.toBeInTheDocument();
    expect(await screen.findByText('Заметки из Telegram')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('J — вниз, T — на сегодня, D — на завтра', async () => {
    const store = await setup();
    await key('j');
    await key('t');
    await waitFor(async () => expect((await store.list('tasks')).find(t => t.id === 'b')?.date).toBe(todayISO()));
    await key('d');
    await waitFor(async () => expect((await store.list('tasks')).find(t => t.id === 'a')?.date).toBe(addDaysISO(todayISO(), 1)));
    await waitFor(() => expect(screen.queryByText('Первая')).not.toBeInTheDocument());
  });

  it('Delete удаляет, «Отменить» возвращает', async () => {
    const store = await setup();
    await key('Delete');
    await waitFor(async () => expect((await store.list('tasks')).some(t => t.id === 'a')).toBe(false));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    });
    await waitFor(async () => expect((await store.list('tasks')).find(t => t.id === 'a')?.title).toBe('Первая'));
    expect(await screen.findByText('Первая')).toBeInTheDocument();
  });

  it('X выбирает строки, действие применяется ко всем выбранным', async () => {
    const store = await setup();
    await key('x');
    await key('j');
    await key('x');
    expect(screen.getByRole('toolbar', { name: 'Действия с выбранными' })).toHaveTextContent('Выбрано 2');
    await key('t');
    await waitFor(async () => {
      const rows = await store.list('tasks');
      expect(rows.filter(t => t.date === todayISO()).map(t => t.id).sort()).toEqual(['a', 'b', 'c']);
    });
    expect(screen.getByText('На сегодня: 2')).toBeInTheDocument();
  });

  it('заметку из Telegram можно превратить в задачу', async () => {
    const store = await setup();
    fireEvent.click(await screen.findByRole('button', { name: 'В задачу' }));
    await waitFor(async () => expect(await store.list('notes')).toHaveLength(0));
    expect((await store.list('tasks')).some(t => t.title === 'Книга' && t.source === 'telegram')).toBe(true);
  });

  it('клавиши молчат, пока фокус в поле ввода', async () => {
    const store = await setup();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    await act(async () => {
      fireEvent.keyDown(input, { key: 't' });
    });
    expect((await store.list('tasks')).find(t => t.id === 'a')?.date).toBeUndefined();
    input.remove();
  });
});
