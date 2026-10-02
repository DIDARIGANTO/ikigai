import { describe, it, expect, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/Toast';
import { MemoryStore } from '@/data/memory';
import { getStore, setStore } from '@/data';
import type { Task } from '@/lib/types';
import { applyChanges, created, deleted, inverse, revertChanges, updated, useUndoable } from './undo';
import type { RowChange } from './undo';

const task = (p: Partial<Task> = {}): Task => ({
  id: 't1', createdAt: '', updatedAt: '', title: 'Позвонить', area: 'personal', status: 'todo',
  rescheduleCount: 0, source: 'web', kind: 'task', position: 0, ...p,
});

describe('undo — чистые функции', () => {
  let store: MemoryStore;
  beforeEach(() => {
    store = new MemoryStore();
  });

  it('created → revert удаляет строку', async () => {
    const changes = [created('tasks', task())];
    await applyChanges(store, changes);
    expect(await store.list('tasks')).toHaveLength(1);
    await revertChanges(store, changes);
    expect(await store.list('tasks')).toHaveLength(0);
  });

  it('updated → revert возвращает прежнюю версию', async () => {
    const before = task();
    await store.put('tasks', before);
    const changes = [updated('tasks', before, { ...before, status: 'done' })];
    await applyChanges(store, changes);
    expect((await store.list('tasks'))[0].status).toBe('done');
    await revertChanges(store, changes);
    expect((await store.list('tasks'))[0].status).toBe('todo');
  });

  it('deleted → revert кладёт строку обратно со всеми полями', async () => {
    const row = task({ goalId: 'g', notes: 'n' });
    await store.put('tasks', row);
    await applyChanges(store, [deleted('tasks', row)]);
    expect(await store.list('tasks')).toHaveLength(0);
    await revertChanges(store, [deleted('tasks', row)]);
    expect((await store.list('tasks'))[0]).toMatchObject({ id: 't1', goalId: 'g', notes: 'n' });
  });

  it('inverse переворачивает порядок и пары', () => {
    const a = task({ id: 'a' });
    const b = task({ id: 'b' });
    const changes: RowChange[] = [created('tasks', a), deleted('tasks', b)];
    expect(inverse(changes)).toEqual([
      { name: 'tasks', before: null, after: b },
      { name: 'tasks', before: a, after: null },
    ]);
  });

  it('пакет из нескольких строк отменяется целиком', async () => {
    const a = task({ id: 'a' });
    const b = task({ id: 'b', status: 'doing', actualStart: 'x' });
    await store.put('tasks', a);
    await store.put('tasks', b);
    const changes = [updated('tasks', b, { ...b, status: 'done', actualEnd: 'y' }), updated('tasks', a, { ...a, status: 'doing', actualStart: 'y' })];
    await applyChanges(store, changes);
    await revertChanges(store, changes);
    const rows = await store.list('tasks');
    expect(rows.find(r => r.id === 'a')?.status).toBe('todo');
    expect(rows.find(r => r.id === 'b')?.status).toBe('doing');
    expect(rows.find(r => r.id === 'b')?.actualEnd).toBeUndefined();
  });
});

function Harness({ changes }: { changes: RowChange[] }) {
  const commit = useUndoable();
  return (
    <button type="button" onClick={() => void commit('Задача удалена', changes)}>
      go
    </button>
  );
}

describe('useUndoable', () => {
  it('показывает тост с «Отменить» и восстанавливает строку', async () => {
    const store = new MemoryStore();
    setStore(store);
    const row = task();
    await store.put('tasks', row);
    render(
      <ToastProvider>
        <Harness changes={[deleted('tasks', row)]} />
      </ToastProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByText('go'));
    });
    expect(await screen.findByText('Задача удалена')).toBeInTheDocument();
    expect(await getStore().list('tasks')).toHaveLength(0);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    });
    await waitFor(async () => expect(await getStore().list('tasks')).toHaveLength(1));
    expect(await screen.findByText('Отменено')).toBeInTheDocument();
  });
});
