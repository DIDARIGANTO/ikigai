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

/** Секция блока «Вернули долг» по её заголовку. */
const returnedBlock = (heading: HTMLElement) => heading.closest('section') as HTMLElement;

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
/** Суммы форматирует Intl с неразрывными пробелами: сравниваем по числу и знаку валюты. */
const money = (digits: string, prefix = '') => new RegExp(`^${prefix}${digits.split(' ').join('\\s')}\\s₸$`);

describe('DebtsPage', () => {
  it('shows three blocks even when empty: owed to me, I owe, returned', async () => {
    renderPage();
    for (const name of ['Мне должны', 'Я должен', 'Вернули долг']) {
      expect(await screen.findByRole('heading', { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    }
    expect(screen.getByText('Никто сейчас не должен.')).toBeInTheDocument();
    expect(screen.getByText('Ты никому не должен.')).toBeInTheDocument();
    expect(screen.getByText('Когда долг вернут, он окажется здесь.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить: мне должны' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить: я должен' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Итоги')).not.toBeInTheDocument();
  });

  it('records a debt: someone owes me, with the profile currency, and the totals follow', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить: мне должны' }));
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
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить: мне должны' }));
    type('Кто должен', 'Асхат');
    type('Сумма', 'много');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText('Сумма не распознана')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Новый долг' })).toBeInTheDocument();
    expect(await store.list('debts')).toHaveLength(0);
  });

  it('«Погасить» pays the rest at once, the return appears in «Вернули долг», and the toast can undo it', async () => {
    await store.put('debts', debt({ payments: [{ id: 'p1', date: '2026-10-05', amount: 20000 }] }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Погасить долг: Асхат' }));

    await waitFor(async () => expect(leftOf((await store.list('debts'))[0])).toBe(0));
    const [paid] = await store.list('debts');
    expect(paidOf(paid)).toBe(50000);
    expect(paid.payments).toHaveLength(2);
    const block = returnedBlock(await screen.findByRole('heading', { name: /^Вернули долг\s*2$/ }));
    expect(within(block).getAllByText('Асхат')).toHaveLength(2);
    expect(within(block).getByText(money('30 000'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Закрыты без оплаты/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    await waitFor(async () => expect(leftOf((await store.list('debts'))[0])).toBe(30000));
    await waitFor(() => expect(within(block).getAllByText('Асхат')).toHaveLength(1));
  });

  it('«Вернули долг» lists every return: who, which way, when, how much, and what is still left', async () => {
    await store.putMany('debts', [
      debt({ id: 'a', person: 'Асхат', payments: [{ id: 'p1', date: '2026-10-05', amount: 50000 }] }),
      debt({ id: 'b', person: 'Марат', direction: 'iOwe', amount: 12000, payments: [{ id: 'p2', date: '2026-10-03', amount: 12000 }] }),
      debt({ id: 'c', person: 'Айгуль' }),
      debt({ id: 'd', person: 'Ержан', amount: 40000, payments: [{ id: 'p3', date: '2026-10-07', amount: 10000 }] }),
    ]);
    renderPage();
    const block = returnedBlock(await screen.findByRole('heading', { name: /^Вернули долг\s*3$/ }));
    expect(within(block).getByText('мне вернули · 5 окт.')).toBeInTheDocument();
    expect(within(block).getByText('я вернул · 3 окт.')).toBeInTheDocument();
    expect(within(block).getByText(/^мне вернули · 7 окт\. · осталось 30\s000\s₸$/)).toBeInTheDocument();
    expect(within(block).getByText(money('50 000'))).toBeInTheDocument();
    expect(within(block).queryByText('Айгуль')).not.toBeInTheDocument();
    // порядок: недавний возврат выше
    const rows = within(block).getAllByRole('listitem').map(li => li.textContent ?? '');
    expect(rows[0]).toContain('Ержан');
    expect(rows[1]).toContain('Асхат');
    expect(rows[2]).toContain('Марат');
  });

  it('«Вернули долг» shows the latest five and can expand to all', async () => {
    await store.putMany(
      'debts',
      Array.from({ length: 7 }, (_, i) =>
        debt({ id: `r${i}`, person: `Должник ${i}`, payments: [{ id: `p${i}`, date: `2026-09-0${i + 1}`, amount: 50000 }] }),
      ),
    );
    renderPage();
    const block = returnedBlock(await screen.findByRole('heading', { name: /^Вернули долг/ }));
    expect(within(block).getAllByRole('listitem')).toHaveLength(5);
    fireEvent.click(within(block).getByRole('button', { name: 'Показать все 7' }));
    expect(within(block).getAllByRole('listitem')).toHaveLength(7);
    fireEvent.click(within(block).getByRole('button', { name: 'Свернуть' }));
    expect(within(block).getAllByRole('listitem')).toHaveLength(5);
  });

  it('a return can be written down in the block: a person without an open debt becomes an already returned debt', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить: вернули долг' }));
    expect(await screen.findByRole('dialog', { name: 'Вернули долг' })).toBeInTheDocument();
    type('Кто вернул', ' Марат ');
    expect(await screen.findByText('Такого долга в списке нет: запишу как уже возвращённый.')).toBeInTheDocument();
    type(/^Сумма/, '12 000');
    fireEvent.click(screen.getByRole('button', { name: 'Записать' }));

    await waitFor(async () => expect(await store.list('debts')).toHaveLength(1));
    const [saved] = await store.list('debts');
    expect(saved).toMatchObject({ direction: 'owedToMe', person: 'Марат', amount: 12000, currency: 'KZT' });
    expect(paidOf(saved)).toBe(12000);
    const block = returnedBlock(await screen.findByRole('heading', { name: /^Вернули долг\s*1$/ }));
    expect(within(block).getByText('Марат')).toBeInTheDocument();
    expect(within(block).getByText(money('12 000'))).toBeInTheDocument();
    // открытые колонки остались пустыми
    expect(screen.getByText('Никто сейчас не должен.')).toBeInTheDocument();
  });

  it('the empty block has its own button to write a return', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Записать возврат' }));
    expect(await screen.findByRole('dialog', { name: 'Вернули долг' })).toBeInTheDocument();
  });

  it('a return of someone with an open debt lands on that debt, suggesting the whole rest', async () => {
    await store.put('debts', debt());
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить: вернули долг' }));
    type('Кто вернул', 'асхат');
    expect(await screen.findByText(/Открытый долг: осталось 50\s000\s₸/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Сумма/)).toHaveValue('50000');
    fireEvent.click(screen.getByRole('button', { name: 'Записать' }));

    await waitFor(async () => expect(leftOf((await store.list('debts'))[0])).toBe(0));
    expect(await store.list('debts')).toHaveLength(1);
    const block = returnedBlock(await screen.findByRole('heading', { name: /^Вернули долг\s*1$/ }));
    expect(within(block).getByText('Асхат')).toBeInTheDocument();
    // долг ушёл из открытых
    await waitFor(() => expect(screen.getByText('Никто сейчас не должен.')).toBeInTheDocument());
  });

  it('a partial return keeps the debt open and shows what is left', async () => {
    await store.put('debts', debt());
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить: вернули долг' }));
    type('Кто вернул', 'Асхат');
    type(/^Сумма/, '20 000');
    fireEvent.click(screen.getByRole('button', { name: 'Записать' }));

    await waitFor(async () => expect(leftOf((await store.list('debts'))[0])).toBe(30000));
    const block = returnedBlock(await screen.findByRole('heading', { name: /^Вернули долг\s*1$/ }));
    expect(within(block).getByText(/осталось 30\s000\s₸/)).toBeInTheDocument();
    expect(await screen.findByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
  });

  it('refuses a return bigger than what is left and an unreadable sum, and keeps the dialog open', async () => {
    await store.put('debts', debt({ amount: 10000 }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить: вернули долг' }));
    type('Кто вернул', 'Асхат');
    type(/^Сумма/, '15000');
    fireEvent.click(screen.getByRole('button', { name: 'Записать' }));
    expect(await screen.findByText(/Больше остатка/)).toBeInTheDocument();
    type(/^Сумма/, 'много');
    fireEvent.click(screen.getByRole('button', { name: 'Записать' }));
    expect(await screen.findByText('Сумма не распознана')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Вернули долг' })).toBeInTheDocument();
    expect((await store.list('debts'))[0].payments).toEqual([]);
  });

  it('«Я вернул» writes a return the other way round', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить: вернули долг' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Я вернул' }));
    type('Кому вернул', 'Марат');
    type(/^Сумма/, '5000');
    fireEvent.click(screen.getByRole('button', { name: 'Записать' }));
    await waitFor(async () => expect(await store.list('debts')).toHaveLength(1));
    expect((await store.list('debts'))[0]).toMatchObject({ direction: 'iOwe', person: 'Марат', amount: 5000 });
    const block = returnedBlock(await screen.findByRole('heading', { name: /^Вернули долг\s*1$/ }));
    expect(within(block).getByText(/^я вернул · /)).toBeInTheDocument();
  });

  it('«Убрать возврат» in the journal takes that return back, and the debt is open again', async () => {
    await store.put('debts', debt({ payments: [{ id: 'p1', date: '2026-10-05', amount: 50000 }] }));
    renderPage();
    const block = returnedBlock(await screen.findByRole('heading', { name: /^Вернули долг\s*1$/ }));
    fireEvent.click(within(block).getByRole('button', { name: 'Действия: Асхат' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Убрать возврат' }));
    await waitFor(async () => expect((await store.list('debts'))[0].payments).toEqual([]));
    expect(await screen.findByRole('button', { name: 'Погасить долг: Асхат' })).toBeInTheDocument();
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
    const progress = await screen.findByRole('progressbar');
    expect(progress).toHaveAttribute('aria-valuenow', '40');
    // «вернули …» есть и в открытой строке, и в журнале: смотрим именно строку с индикатором
    expect(within(progress.closest('li') as HTMLElement).getByText(/вернули/)).toHaveTextContent(/20\s000\s₸\sиз\s50\s000\s₸/);
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

    fireEvent.click(await screen.findByRole('button', { name: /Закрыты без оплаты/ }));
    expect(await screen.findByText(/^Мне должны · закрыт без оплаты$/)).toBeInTheDocument();
    expect(within(returnedBlock(screen.getByRole('heading', { name: /^Вернули долг/ }))).queryByText('Асхат')).not.toBeInTheDocument();
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
