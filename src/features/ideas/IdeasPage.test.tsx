import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Idea } from '@/lib/types';
import { clearStore, setStore } from '@/data';
import { MemoryStore } from '@/data/memory';
import { ToastProvider } from '@/components/ui/Toast';
import { IdeasPage } from './IdeasPage';

const T = '2026-10-08T08:00:00.000Z';
const base = { createdAt: T, updatedAt: T };
const idea = (over: Partial<Idea> = {}): Idea => ({ id: 'i1', title: 'Приложение для барберов', source: 'web', ...base, ...over });

let store: MemoryStore;

beforeEach(async () => {
  store = new MemoryStore();
  await store.put('profiles', { id: 'me', timezone: 'Asia/Almaty', morningTime: '09:00', currency: 'KZT', ...base });
  setStore(store);
});
afterEach(() => clearStore());

function renderPage(url = '/ideas') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <IdeasPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
/** Строка идеи по названию: вся строка — кнопка, она открывает редактор. */
const row = (title: string) => screen.findByRole('button', { name: `Идея: ${title}` });
const rowTitles = () => screen.queryAllByRole('button').map(b => b.getAttribute('aria-label') ?? '').filter(n => n.startsWith('Идея: '));

describe('IdeasPage', () => {
  it('shows an empty state with a field to jot the first idea', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Идей пока нет' })).toBeInTheDocument();
    expect(screen.getByLabelText('Новая идея')).toBeInTheDocument();
  });

  it('jots an idea in one line: Enter saves it as a new one and clears the field', async () => {
    renderPage();
    const input = await screen.findByLabelText('Новая идея');
    fireEvent.change(input, { target: { value: '  Приложение для барберов ' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    await waitFor(async () => expect(await store.list('ideas')).toHaveLength(1));
    expect((await store.list('ideas'))[0]).toMatchObject({ title: 'Приложение для барберов', status: 'new', source: 'web' });
    expect(await row('Приложение для барберов')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('does not save an empty idea', async () => {
    renderPage();
    const input = await screen.findByLabelText('Новая идея');
    expect(screen.getByRole('button', { name: 'Записать' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(await store.list('ideas')).toHaveLength(0);
  });

  it('a quick idea goes to «Новые» even when another tab is open', async () => {
    await store.put('ideas', idea({ status: 'work' }));
    renderPage('/ideas?tab=work');
    const input = await screen.findByLabelText('Новая идея');
    fireEvent.change(input, { target: { value: 'Курс по продажам' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(await row('Курс по продажам')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Новые/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('has three tabs with counts: «Новые» is open by default; the tab lives in the address', async () => {
    await store.putMany('ideas', [
      idea({ id: 'a', title: 'Первая' }),
      idea({ id: 'b', title: 'Вторая', status: 'new' }),
      idea({ id: 'c', title: 'В работе', status: 'work' }),
      idea({ id: 'd', title: 'Готовая', status: 'done' }),
    ]);
    renderPage();
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map(t => t.textContent)).toEqual(['Новые2', 'В работе1', 'Реализованные1']);
    expect(screen.getByRole('tab', { name: /^Новые/ })).toHaveAttribute('aria-selected', 'true');
    expect(rowTitles()).toHaveLength(2);
    fireEvent.click(screen.getByRole('tab', { name: /^В работе/ }));
    expect(await row('В работе')).toBeInTheDocument();
    expect(rowTitles()).toEqual(['Идея: В работе']);
    fireEvent.click(screen.getByRole('tab', { name: /^Реализованные/ }));
    expect(await row('Готовая')).toBeInTheDocument();
  });

  it('shows the note, the date and where the idea came from', async () => {
    await store.put('ideas', idea({ note: 'Запись, напоминания и касса', source: 'telegram' }));
    renderPage();
    const line = await row('Приложение для барберов');
    expect(line).toHaveTextContent('Запись, напоминания и касса');
    expect(line).toHaveTextContent(/8 окт\./);
    expect(line).toHaveTextContent('из Telegram');
  });

  it('the button on a row moves the idea to the next stage: new → work → done', async () => {
    await store.put('ideas', idea());
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Перенести в «В работе»: Приложение для барберов' }));
    await waitFor(async () => expect((await store.list('ideas'))[0].status).toBe('work'));
    fireEvent.click(screen.getByRole('tab', { name: /^В работе/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Перенести в «Реализованные»: Приложение для барберов' }));
    await waitFor(async () => expect((await store.list('ideas'))[0].status).toBe('done'));
    fireEvent.click(screen.getByRole('tab', { name: /^Реализованные/ }));
    await row('Приложение для барберов');
    // у реализованной кнопки «дальше» нет
    expect(screen.queryByRole('button', { name: /^Перенести в/ })).not.toBeInTheDocument();
  });

  it('the menu moves an idea to any other stage', async () => {
    await store.put('ideas', idea({ status: 'done' }));
    renderPage('/ideas?tab=done');
    fireEvent.click(await screen.findByRole('button', { name: 'Действия: Приложение для барберов' }));
    expect(screen.queryByRole('menuitem', { name: 'Реализована' })).not.toBeInTheDocument();
    expect(await screen.findByRole('menuitem', { name: 'В новые' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'В работу' }));
    await waitFor(async () => expect((await store.list('ideas'))[0].status).toBe('work'));
  });

  it('the editor sets title, note and stage; the page follows the idea to its stage', async () => {
    await store.put('ideas', idea());
    renderPage();
    fireEvent.click(await row('Приложение для барберов'));
    expect(await screen.findByRole('dialog', { name: 'Идея' })).toBeInTheDocument();
    expect(screen.getByLabelText('Название')).toHaveValue('Приложение для барберов');
    type('Название', 'Приложение для барбершопов');
    type('Заметка', 'Запись и касса');
    fireEvent.change(screen.getByLabelText('Статус'), { target: { value: 'work' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(async () =>
      expect((await store.list('ideas'))[0]).toMatchObject({ title: 'Приложение для барбершопов', note: 'Запись и касса', status: 'work' }),
    );
    await waitFor(() => expect(screen.getByRole('tab', { name: /^В работе/ })).toHaveAttribute('aria-selected', 'true'));
    expect(await row('Приложение для барбершопов')).toBeInTheDocument();
  });

  it('«+ Идея» opens the editor on the current stage and needs a title', async () => {
    renderPage('/ideas?tab=work');
    fireEvent.click(await screen.findByRole('button', { name: 'Идея' }));
    expect(await screen.findByRole('dialog', { name: 'Новая идея' })).toBeInTheDocument();
    expect(screen.getByLabelText('Статус')).toHaveValue('work');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    type('Название', 'Курс по продажам');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(async () => expect(await store.list('ideas')).toHaveLength(1));
    expect((await store.list('ideas'))[0]).toMatchObject({ title: 'Курс по продажам', status: 'work', source: 'web' });
  });

  it('deleting offers undo', async () => {
    await store.put('ideas', idea());
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Действия: Приложение для барберов' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Удалить' }));
    await waitFor(async () => expect(await store.list('ideas')).toHaveLength(0));
    fireEvent.click(await screen.findByRole('button', { name: 'Отменить' }));
    await waitFor(async () => expect(await store.list('ideas')).toHaveLength(1));
  });

  it('opens the editor of an idea from the search link', async () => {
    await store.put('ideas', idea());
    renderPage('/ideas?idea=i1');
    expect(await screen.findByRole('dialog', { name: 'Идея' })).toBeInTheDocument();
    expect(screen.getByLabelText('Название')).toHaveValue('Приложение для барберов');
  });
});
