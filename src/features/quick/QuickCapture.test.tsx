import { describe, it, expect, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/Toast';
import { MemoryStore } from '@/data/memory';
import { setStore } from '@/data';
import { TaskActionsProvider } from '@/features/tasks/TaskActionsContext';
import { QuickCaptureProvider, useQuickCapture } from './QuickCapture';

let store: MemoryStore;
const stamp = '2026-01-01T00:00:00.000Z';

function Opener() {
  const { open } = useQuickCapture();
  return (
    <button type="button" onClick={() => open()}>
      open
    </button>
  );
}

async function setup() {
  store = new MemoryStore();
  setStore(store);
  await store.put('goals', { id: 'g1', title: 'Запустить сайт', emoji: '🚀', horizon: 'month', status: 'active', createdAt: stamp, updatedAt: stamp });
  await store.put('lists', { id: 'l1', title: 'Покупки', icon: 'cart', position: 0, pinned: false, createdAt: stamp, updatedAt: stamp });
  render(
    <ToastProvider>
      <TaskActionsProvider>
        <QuickCaptureProvider>
          <Opener />
        </QuickCaptureProvider>
      </TaskActionsProvider>
    </ToastProvider>,
  );
  fireEvent.click(screen.getByText('open'));
  const field = screen.getByLabelText('Текст записи') as HTMLInputElement;
  // Цели грузятся из хранилища асинхронно: ждём, пока разбор увидит цель.
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Задача' })).toBeInTheDocument());
  return field;
}

describe('QuickCapture', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('разбирает строку в чипы, сохраняет по Enter и не закрывается', async () => {
    const field = await setup();
    await waitFor(async () => expect(await store.list('goals')).toHaveLength(1));
    fireEvent.change(field, { target: { value: 'завтра в 15 на 30м #работа ^сайт ! позвонить маме' } });
    await screen.findByRole('button', { name: /Убрать: .*Запустить сайт/ });
    for (const name of ['15:00', '30 мин', 'Работа', 'Важное']) {
      expect(screen.getByRole('button', { name: `Убрать: ${name}` })).toBeInTheDocument();
    }
    // Строка назначения описывает поле; время в ней — отдельным моноширинным куском.
    expect(field).toHaveAccessibleDescription(/15:00 · 30 мин · Работа/);

    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter' });
    });
    await waitFor(async () => expect(await store.list('tasks')).toHaveLength(1));
    const [task] = await store.list('tasks');
    expect(task).toMatchObject({ title: 'позвонить маме', plannedStart: '15:00', plannedMinutes: 30, area: 'work', goalId: 'g1', important: true });
    expect(task.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Диалог открыт, поле пустое — можно записывать следующее.
    expect(field.value).toBe('');
    expect(screen.getByText('Записано')).toBeInTheDocument();
  });

  it('крестик на чипе убирает кусок из текста', async () => {
    const field = await setup();
    fireEvent.change(field, { target: { value: 'завтра созвон #работа' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Убрать: Завтра' }));
    expect(field.value).toBe('созвон #работа');
  });

  it('без даты и доски — во входящие', async () => {
    const field = await setup();
    fireEvent.change(field, { target: { value: 'разобрать фото' } });
    expect(screen.getByText('Во входящие')).toBeInTheDocument();
    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter' });
    });
    await waitFor(async () => expect(await store.list('tasks')).toHaveLength(1));
    const [task] = await store.list('tasks');
    expect(task.date).toBeUndefined();
    expect(task.boardId).toBeUndefined();
  });

  it('«купить» определяется как покупка, «Отменить» убирает созданное', async () => {
    const field = await setup();
    await waitFor(async () => expect(await store.list('lists')).toHaveLength(1));
    fireEvent.change(field, { target: { value: 'купить молоко 900 тг' } });
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Покупка' })).toHaveAttribute('aria-checked', 'true'));
    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter' });
    });
    await waitFor(async () => expect(await store.list('listItems')).toHaveLength(1));
    expect((await store.list('listItems'))[0]).toMatchObject({ text: 'молоко', price: 900, listId: 'l1' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    });
    await waitFor(async () => expect(await store.list('listItems')).toHaveLength(0));
  });

  it('тип можно поменять вручную', async () => {
    const field = await setup();
    fireEvent.change(field, { target: { value: 'идея про подкаст' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Заметка' }));
    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter' });
    });
    await waitFor(async () => expect(await store.list('notes')).toHaveLength(1));
    expect(await store.list('tasks')).toHaveLength(0);
  });
});
