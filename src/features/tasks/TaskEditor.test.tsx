import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { clearStore, setStore } from '@/data';
import { MemoryStore } from '@/data/memory';

const commit = vi.fn(async (_text: string | null, _changes: unknown[]) => {});
vi.mock('./TaskActionsContext', () => ({
  useTaskActionsCtx: () => ({ columns: [], goals: [], commit, del: vi.fn() }),
}));

import { TaskEditor } from './TaskEditor';

beforeEach(() => {
  commit.mockClear();
  setStore(new MemoryStore());
});
afterEach(() => clearStore());

const setup = (onClose = vi.fn()) => {
  render(<TaskEditor task={null} onClose={onClose} />);
  return onClose;
};
const note = () => screen.getByLabelText('Заметка');
const title = () => screen.getByLabelText('Название задачи');
const save = () => screen.getByRole('button', { name: 'Сохранить' });
const saved = () => (commit.mock.calls[0][1][0] as { after: { title: string; notes?: string } }).after;

describe('TaskEditor: сохранение', () => {
  it('пока нет ни названия, ни заметки, «Сохранить» недоступно и сказано почему', () => {
    setup();
    expect(save()).toBeDisabled();
    expect(screen.getByText('Нужно название или заметка')).toBeInTheDocument();
  });

  it('одной заметки достаточно: её первая строка становится названием, а заметка остаётся целиком', async () => {
    const onClose = setup();
    const text = 'мир отель звонок\nренк, бильярдный\nбанный клуб встреча';
    fireEvent.change(note(), { target: { value: text } });
    expect(save()).toBeEnabled();
    expect(screen.queryByText('Нужно название или заметка')).not.toBeInTheDocument();
    fireEvent.click(save());
    await vi.waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
    expect(commit.mock.calls[0][0]).toBe('Задача создана');
    expect(saved()).toMatchObject({ title: 'мир отель звонок', notes: text });
    expect(onClose).toHaveBeenCalled();
  });

  it('заметка из одной строки, ставшая названием, не дублируется', async () => {
    setup();
    fireEvent.change(note(), { target: { value: 'Позвонить в отель' } });
    fireEvent.click(save());
    await vi.waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
    expect(saved().title).toBe('Позвонить в отель');
    expect(saved().notes).toBeUndefined();
  });

  it('названием, которое ввели, пользуются как есть, заметка остаётся заметкой', async () => {
    setup();
    fireEvent.change(title(), { target: { value: 'Созвон' } });
    fireEvent.change(note(), { target: { value: 'отель, бильярд' } });
    fireEvent.click(save());
    await vi.waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
    expect(saved()).toMatchObject({ title: 'Созвон', notes: 'отель, бильярд' });
  });

  it('Enter в пустом названии сохраняет задачу по заметке', async () => {
    setup();
    fireEvent.change(note(), { target: { value: 'Купить билеты\nна пятницу' } });
    fireEvent.keyDown(title(), { key: 'Enter' });
    await vi.waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
    expect(saved().title).toBe('Купить билеты');
  });

  it('пустая заметка из пробелов не считается', () => {
    setup();
    fireEvent.change(note(), { target: { value: '  \n  ' } });
    expect(save()).toBeDisabled();
  });
});
