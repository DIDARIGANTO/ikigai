import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Debt } from '@/lib/types';
import { clearStore, setStore } from '@/data';
import { MemoryStore } from '@/data/memory';
import { ToastProvider } from '@/components/ui/Toast';
import { leftOf, paidOf } from '@/lib/domain/debts';
import { DebtsPage } from './DebtsPage';

const T = '2026-10-01T08:00:00.000Z';
const base = { createdAt: T, updatedAt: T };

function debt(over: Partial<Debt> = {}): Debt {
  return {
    id: 'd1', direction: 'owedToMe', person: 'Асхат', amount: 50000, currency: 'KZT', date: '2026-10-01', payments: [], ...base, ...over,
  };
}

let store: MemoryStore;

beforeEach(async () => {
  store = new MemoryStore();
  await store.put('profiles', { id: 'me', timezone: 'Asia/Almaty', morningTime: '09:00', currency: 'KZT', ...base });
  setStore(store);
});
afterEach(() => clearStore());

function renderPage(url = '/debts') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <DebtsPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
/** Суммы форматирует Intl с неразрывными пробелами: сравниваем по числу и знаку валюты. */
const money = (digits: string, prefix = '') => new RegExp(`^${prefix}${digits.split(' ').join('\\s')}\\s₸$`);

describe('DebtsPage', () => {
  it('shows an empty state with both ways to start', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Долгов пока нет' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Мне должны/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Я должен/ })).toBeInTheDocument();
  });

  it('records a debt: someone owes me, with the profile currency, and the totals follow', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Мне должны/ }));
    expect(await screen.findByRole('dialog', { name: 'Новый долг' })).toBeInTheDocument();
    expect(screen.getByLabelText('Кто должен')).toBeInTheDocument();
    type('Кто должен', '  Асхат ');
    type('Сумма', '50 000');
    type('Вернуть до', '2099-01-01');
    type('За что', 'на ремонт');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(async () => expect(await store.list('debts')).toHaveLength(1));
    const [saved] = await store.list('debts');
    expect(saved).toMatchObject({ direction: 'owedToMe', person: 'Асхат', amount: 50000, currency: 'KZT', dueDate: '2099-01-01', note: 'на ремонт', payments: [] });

    // итоги: «Мне должны» 50 000, «Баланс» +50 000
    const totals = await screen.findByLabelText('Итоги');
    expect(within(totals).getByText(money('50 000'))).toBeInTheDocument();
    expect(within(totals).getByText(money('50 000', '\\+'))).toBeInTheDocument();
    // строка в колонке «Мне должны» с «за что»
    expect(screen.getByText('на ремонт')).toBeInTheDocument();
  });

  it('records a debt in the other direction and shows the balance', async () => {
    await store.put('debts', debt());
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить: я должен' }));
    expect(await screen.findByLabelText('Кому должен')).toBeInTheDocument();
    type('Кому должен', 'Марат');
    type('Сумма', '12000');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const totals = await screen.findByLabelText('Итоги');
    await waitFor(() => expect(within(totals).getByText(money('12 000'))).toBeInTheDocument());
    // 50 000 − 12 000 = +38 000
    expect(within(totals).getByText(money('38 000', '\\+'))).toBeInTheDocument();
  });

  it('refuses a sum it cannot read and keeps the dialog open', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Мне должны/ }));
    type('Кто должен', 'Асхат');
    type('Сумма', 'много');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText('Сумма не распознана')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Новый долг' })).toBeInTheDocument();
    expect(await store.list('debts')).toHaveLength(0);
  });

  it('«Погасить» pays the rest at once, moves the debt to «Закрытые», and the toast can undo it', async () => {
    await store.put('debts', debt({ payments: [{ id: 'p1', date: '2026-10-05', amount: 20000 }] }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Погасить долг: Асхат' }));

    await waitFor(async () => expect(leftOf((await store.list('debts'))[0])).toBe(0));
    const [paid] = await store.list('debts');
    expect(paidOf(paid)).toBe(50000);
    expect(paid.payments).toHaveLength(2);
    expect(await screen.findByRole('button', { name: /Закрытые/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    await waitFor(async () => expect(leftOf((await store.list('debts'))[0])).toBe(30000));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Закрытые/ })).not.toBeInTheDocument());
  });

  it('a partial return lowers what is left and shows the progress', async () => {
    await store.put('debts', debt());
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Действия: Асхат' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Частичный возврат/ }));
    expect(await screen.findByRole('dialog', { name: 'Возврат' })).toBeInTheDocument();
    type(/Сумма/, '20 000');
    fireEvent.click(screen.getByRole('button', { name: 'Записать' }));

    await waitFor(async () => expect(leftOf((await store.list('debts'))[0])).toBe(30000));
    expect(await screen.findByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText(/вернули/)).toHaveTextContent(/20\s000\s₸\sиз\s50\s000\s₸/);
  });

  it('does not accept a return bigger than what is left', async () => {
    await store.put('debts', debt({ amount: 10000 }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Действия: Асхат' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Частичный возврат/ }));
    type(/Сумма/, '15000');
    fireEvent.click(screen.getByRole('button', { name: 'Записать' }));
    expect(await screen.findByText(/Больше остатка/)).toBeInTheDocument();
    expect((await store.list('debts'))[0].payments).toEqual([]);
  });

  it('closing without payment keeps the sum, and «Вернуть в открытые» brings it back', async () => {
    await store.put('debts', debt());
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Действия: Асхат' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Закрыть без оплаты' }));
    await waitFor(async () => expect((await store.list('debts'))[0].closedAt).toBeTruthy());

    fireEvent.click(await screen.findByRole('button', { name: /Закрытые/ }));
    expect(await screen.findByText(/^Мне должны · закрыт без оплаты$/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Действия: Асхат' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Вернуть в открытые' }));
    await waitFor(async () => expect((await store.list('debts'))[0].closedAt).toBeUndefined());
  });

  it('shows overdue and soon deadlines', async () => {
    await store.putMany('debts', [
      debt({ id: 'a', person: 'Асхат', dueDate: '2020-01-01' }),
      debt({ id: 'b', person: 'Марат', direction: 'iOwe', dueDate: '2099-01-01' }),
    ]);
    renderPage();
    expect(await screen.findByText(/просрочено на \d+ (день|дня|дней)/)).toBeInTheDocument();
    expect(screen.getByText(/^до \d+ янв\.$/)).toBeInTheDocument();
  });

  it('deleting asks nothing but offers undo', async () => {
    await store.put('debts', debt());
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Действия: Асхат' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Удалить' }));
    await waitFor(async () => expect(await store.list('debts')).toHaveLength(0));
    fireEvent.click(await screen.findByRole('button', { name: 'Отменить' }));
    await waitFor(async () => expect(await store.list('debts')).toHaveLength(1));
  });

  it('opens the editor of a debt from the search link, and a returned payment can be removed there', async () => {
    await store.put('debts', debt({ payments: [{ id: 'p1', date: '2026-10-05', amount: 20000 }] }));
    renderPage('/debts?debt=d1');
    expect(await screen.findByRole('dialog', { name: 'Долг' })).toBeInTheDocument();
    expect(screen.getByLabelText('Кто должен')).toHaveValue('Асхат');
    fireEvent.click(screen.getByRole('button', { name: /Убрать возврат/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(async () => expect((await store.list('debts'))[0].payments).toEqual([]));
  });
});
