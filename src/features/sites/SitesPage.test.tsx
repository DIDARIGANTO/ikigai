import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Site } from '@/lib/types';
import { clearStore, setStore } from '@/data';
import { MemoryStore } from '@/data/memory';
import { ToastProvider } from '@/components/ui/Toast';
import { todayISO } from '@/lib/dates';
import { SitesPage } from './SitesPage';

const T = '2026-10-08T08:00:00.000Z';
const base = { createdAt: T, updatedAt: T };
const site = (over: Partial<Site> = {}): Site => ({ id: 's1', title: 'Кофейня Brew', ...base, ...over });

let store: MemoryStore;

beforeEach(async () => {
  store = new MemoryStore();
  await store.put('profiles', { id: 'me', timezone: 'Asia/Almaty', morningTime: '09:00', currency: 'KZT', ...base });
  setStore(store);
});
afterEach(() => clearStore());

function renderPage(url = '/sites') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <SitesPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
/** Строка сайта по названию: вся строка — кнопка, она открывает редактор. */
const row = (title: string) => screen.findByRole('button', { name: `Сайт: ${title}` });
const rowTitles = () => screen.queryAllByRole('button').map(b => b.getAttribute('aria-label') ?? '').filter(n => n.startsWith('Сайт: '));

describe('SitesPage', () => {
  it('shows an empty state with a way to start', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Сайтов пока нет' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Добавить сайт/ }));
    expect(await screen.findByRole('dialog', { name: 'Новый сайт' })).toBeInTheDocument();
  });

  it('adds a site by name, client, amount and note — there is no address field', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Сайт' }));
    expect(await screen.findByRole('dialog', { name: 'Новый сайт' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Адрес')).not.toBeInTheDocument();
    type('Название', ' Сайт кофейни ');
    type('Клиент', 'Асхат');
    type('Сумма', '200 000');
    type('Заметка', 'лендинг с меню');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(async () => expect(await store.list('sites')).toHaveLength(1));
    const [saved] = await store.list('sites');
    expect(saved).toMatchObject({ title: 'Сайт кофейни', client: 'Асхат', price: 200000, note: 'лендинг с меню', status: 'work' });
    expect(saved).not.toHaveProperty('url');
    const line = await row('Сайт кофейни');
    expect(line).toHaveTextContent('Асхат');
    expect(line).toHaveTextContent('лендинг с меню');
    expect(line).toHaveTextContent(/200\s000\s₸/);
  });

  it('cannot be saved without a name', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Сайт' }));
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    type('Название', 'Сайт кофейни');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeEnabled();
  });

  it('a click on a row opens the editor of that site', async () => {
    await store.put('sites', site({ client: 'Асхат' }));
    renderPage();
    fireEvent.click(await row('Кофейня Brew'));
    expect(await screen.findByRole('dialog', { name: 'Сайт' })).toBeInTheDocument();
    expect(screen.getByLabelText('Название')).toHaveValue('Кофейня Brew');
    expect(screen.getByLabelText('Клиент')).toHaveValue('Асхат');
  });

  it('has four tabs in the order of the work, with counts: «В работе» is open by default', async () => {
    await store.putMany('sites', [
      site({ id: 'a', title: 'Первый' }),
      site({ id: 'b', title: 'Второй', status: 'work' }),
      site({ id: 'm', title: 'Кофейня', status: 'meeting' }),
      site({ id: 'p', title: 'Автосалон', status: 'payment' }),
      site({ id: 'c', title: 'Сданный', status: 'done', doneAt: '2026-10-05' }),
    ]);
    renderPage();
    const tabs = await screen.findAllByRole('tab');
    // название и счётчик лежат в соседних элементах, пробел между ними рисует CSS
    expect(tabs.map(t => t.textContent)).toEqual(['Согласовать встречу1', 'В работе2', 'Жду оплату1', 'Реализованные1']);
    expect(screen.getByRole('tab', { name: /^В работе/ })).toHaveAttribute('aria-selected', 'true');
    expect(rowTitles()).toEqual(['Сайт: Второй', 'Сайт: Первый']);

    fireEvent.click(screen.getByRole('tab', { name: /^Согласовать встречу/ }));
    expect(await row('Кофейня')).toBeInTheDocument();
    expect(rowTitles()).toEqual(['Сайт: Кофейня']);
    fireEvent.click(screen.getByRole('tab', { name: /^Жду оплату/ }));
    expect(await row('Автосалон')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /^Реализованные/ }));
    expect(await row('Сданный')).toBeInTheDocument();
    expect(rowTitles()).toEqual(['Сайт: Сданный']);
  });

  it('keeps the tab in the address', async () => {
    await store.put('sites', site({ status: 'payment' }));
    renderPage('/sites?tab=payment');
    expect(await screen.findByRole('tab', { name: /^Жду оплату/ })).toHaveAttribute('aria-selected', 'true');
    expect(await row('Кофейня Brew')).toBeInTheDocument();
  });

  it('lists sites alphabetically', async () => {
    await store.putMany('sites', [site({ id: 'c', title: 'Хостинг' }), site({ id: 'a', title: 'авито' }), site({ id: 'b', title: 'Банк' })]);
    renderPage();
    await row('Банк');
    expect(rowTitles()).toEqual(['Сайт: авито', 'Сайт: Банк', 'Сайт: Хостинг']);
  });

  it('the button on a row moves the site to the next stage: meeting → work → payment → done (today is the delivery date)', async () => {
    await store.put('sites', site({ status: 'meeting' }));
    renderPage('/sites?tab=meeting');
    fireEvent.click(await screen.findByRole('button', { name: 'Перенести в «В работе»: Кофейня Brew' }));
    await waitFor(async () => expect((await store.list('sites'))[0].status).toBe('work'));
    await waitFor(() => expect(rowTitles()).toEqual([]));

    fireEvent.click(screen.getByRole('tab', { name: /^В работе/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Перенести в «Жду оплату»: Кофейня Brew' }));
    await waitFor(async () => expect((await store.list('sites'))[0].status).toBe('payment'));
    expect((await store.list('sites'))[0].doneAt).toBeUndefined();

    fireEvent.click(screen.getByRole('tab', { name: /^Жду оплату/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Перенести в «Реализованные»: Кофейня Brew' }));
    await waitFor(async () => expect((await store.list('sites'))[0].status).toBe('done'));
    expect((await store.list('sites'))[0].doneAt).toBe(todayISO());

    fireEvent.click(screen.getByRole('tab', { name: /^Реализованные/ }));
    expect(await screen.findByText(/реализован \d+ \p{L}+\.?$/u)).toBeInTheDocument();
    // у реализованного кнопки «дальше» нет
    expect(screen.queryByRole('button', { name: /^Перенести в/ })).not.toBeInTheDocument();
  });

  it('the menu moves a site to any other stage; leaving «реализован» clears the date', async () => {
    await store.put('sites', site({ status: 'done', doneAt: '2026-10-05' }));
    renderPage('/sites?tab=done');
    fireEvent.click(await screen.findByRole('button', { name: 'Действия: Кофейня Brew' }));
    // текущий этап в списке не повторяется
    expect(screen.queryByRole('menuitem', { name: 'Реализован' })).not.toBeInTheDocument();
    for (const name of ['Согласовать встречу', 'В работу', 'Жду оплату']) {
      expect(await screen.findByRole('menuitem', { name })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('menuitem', { name: 'В работу' }));
    await waitFor(async () => expect((await store.list('sites'))[0].status).toBe('work'));
    expect((await store.list('sites'))[0].doneAt).toBeUndefined();
  });

  it('a site added on a tab starts at that stage', async () => {
    await store.put('sites', site());
    renderPage('/sites?tab=payment');
    fireEvent.click(await screen.findByRole('button', { name: 'Сайт' }));
    expect(await screen.findByRole('dialog', { name: 'Новый сайт' })).toBeInTheDocument();
    expect(screen.getByLabelText('Статус')).toHaveValue('payment');
    type('Название', 'Автосалон Drive');
    type('Клиент', 'Айгуль');
    type('Сумма', '300 000');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(async () => expect(await store.list('sites')).toHaveLength(2));
    const added = (await store.list('sites')).find(s => s.id !== 's1');
    expect(added).toMatchObject({ status: 'payment', client: 'Айгуль', price: 300000, title: 'Автосалон Drive' });
    expect(added?.doneAt).toBeUndefined();
  });

  it('after saving, the page follows the site to its stage: a new site on another stage is not lost from view', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Сайт' }));
    fireEvent.change(screen.getByLabelText('Статус'), { target: { value: 'meeting' } });
    type('Название', 'Студия йоги');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await row('Студия йоги')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Согласовать встречу/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('changing the stage in the editor moves the page to that stage too', async () => {
    await store.put('sites', site());
    renderPage();
    fireEvent.click(await row('Кофейня Brew'));
    fireEvent.change(screen.getByLabelText('Статус'), { target: { value: 'payment' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    // вкладка переключается после записи, поэтому ждём, а не проверяем сразу
    await waitFor(() => expect(screen.getByRole('tab', { name: /^Жду оплату/ })).toHaveAttribute('aria-selected', 'true'));
    expect(await row('Кофейня Brew')).toBeInTheDocument();
  });

  it('the editor sets stage, client, amount and delivery date; the row shows them', async () => {
    await store.put('sites', site());
    renderPage();
    fireEvent.click(await row('Кофейня Brew'));
    expect(screen.getByLabelText('Статус')).toHaveValue('work');
    expect(screen.queryByLabelText('Когда реализован')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Статус'), { target: { value: 'done' } });
    type('Клиент', 'Асхат');
    type('Сумма', '150000');
    type('Когда реализован', '2026-10-05');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(async () =>
      expect((await store.list('sites'))[0]).toMatchObject({ status: 'done', client: 'Асхат', price: 150000, doneAt: '2026-10-05' }),
    );

    fireEvent.click(await screen.findByRole('tab', { name: /^Реализованные/ }));
    const line = await row('Кофейня Brew');
    expect(line).toHaveTextContent('Асхат · реализован 5 окт.');
    expect(line).toHaveTextContent(/150\s000\s₸/);
  });

  it('refuses an amount it cannot read and keeps the dialog open', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Сайт' }));
    type('Название', 'Сайт кофейни');
    type('Сумма', 'много');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText('Сумма не распознана')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Новый сайт' })).toBeInTheDocument();
    expect(await store.list('sites')).toHaveLength(0);
  });

  it('«Жду оплату» sums up what is expected', async () => {
    await store.putMany('sites', [
      site({ id: 'a', title: 'Первый', status: 'payment', price: 200000 }),
      site({ id: 'b', title: 'Второй', status: 'payment', price: 250000 }),
      site({ id: 'c', title: 'Без суммы', status: 'payment' }),
      site({ id: 'd', title: 'Чужая вкладка', status: 'work', price: 999 }),
    ]);
    renderPage('/sites?tab=payment');
    expect(await screen.findByText(/^Ждёшь: 450\s000\s₸$/)).toBeInTheDocument();
    // на других вкладках итога нет
    fireEvent.click(screen.getByRole('tab', { name: /^В работе/ }));
    await waitFor(() => expect(screen.queryByText(/^Ждёшь:/)).not.toBeInTheDocument());
  });

  it('empty tabs say what to do', async () => {
    await store.put('sites', site());
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: /^Согласовать встречу/ }));
    expect(await screen.findByRole('heading', { name: 'Встреч пока нет' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /^Жду оплату/ }));
    expect(await screen.findByRole('heading', { name: 'Оплаты не ждёшь' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /^Реализованные/ }));
    expect(await screen.findByRole('heading', { name: 'Реализованных сайтов пока нет' })).toBeInTheDocument();
    expect(screen.getByText(/перенеси его сюда/)).toBeInTheDocument();
  });

  it('edits a site from the menu', async () => {
    await store.put('sites', site());
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Действия: Кофейня Brew' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Изменить' }));
    expect(await screen.findByRole('dialog', { name: 'Сайт' })).toBeInTheDocument();
    type('Название', 'Кофейня Brew 2');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(async () => expect((await store.list('sites'))[0].title).toBe('Кофейня Brew 2'));
  });

  it('deleting offers undo', async () => {
    await store.put('sites', site());
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Действия: Кофейня Brew' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Удалить' }));
    await waitFor(async () => expect(await store.list('sites')).toHaveLength(0));
    fireEvent.click(await screen.findByRole('button', { name: 'Отменить' }));
    await waitFor(async () => expect(await store.list('sites')).toHaveLength(1));
  });

  it('opens the editor of a site from the search link', async () => {
    await store.put('sites', site());
    renderPage('/sites?site=s1');
    expect(await screen.findByRole('dialog', { name: 'Сайт' })).toBeInTheDocument();
    expect(screen.getByLabelText('Название')).toHaveValue('Кофейня Brew');
  });
});
