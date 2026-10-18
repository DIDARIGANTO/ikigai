import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Rule } from '@/lib/types';
import { clearStore, setStore } from '@/data';
import { MemoryStore } from '@/data/memory';
import { ToastProvider } from '@/components/ui/Toast';
import { RulesPage } from './RulesPage';

const T = '2026-10-15T08:00:00.000Z';
const base = { createdAt: T, updatedAt: T };
const rule = (over: Partial<Rule> = {}): Rule => ({ id: 'r1', text: 'Сон не меньше 7 часов', group: 'brain', position: 1, ...base, ...over });

let store: MemoryStore;

beforeEach(async () => {
  store = new MemoryStore();
  await store.put('profiles', { id: 'me', timezone: 'Asia/Almaty', morningTime: '09:00', currency: 'KZT', ...base });
  setStore(store);
});
afterEach(() => clearStore());

function renderPage(url = '/rules') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <RulesPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
/** Поле формулировки: название окна тоже «Правило», поэтому ищем именно текстовое поле. */
const textField = () => screen.getByRole('textbox', { name: 'Правило' });
/** Раздел страницы по его заголовку. */
const section = async (name: string) => ((await screen.findByRole('heading', { name: new RegExp(`^${name}`) })).closest('section') as HTMLElement);
const ruleRow = (text: string) => screen.findByRole('button', { name: `Правило: ${text}` });

describe('RulesPage', () => {
  it('shows the four sections in the owner\'s order, each with an example while it is empty', async () => {
    renderPage();
    const names = (await screen.findAllByRole('heading', { level: 2 })).map(h => h.textContent?.replace(/\d+$/, '').trim());
    expect(names).toEqual(['Мозг', 'Режим', 'Экономика', 'Спорт']);
    expect(screen.getByText('Например: каждый день читать 20 минут')).toBeInTheDocument();
    expect(screen.getByText('Например: подъём в 6:00, отбой до 23:00')).toBeInTheDocument();
    expect(screen.getByText('Например: 10% дохода откладывать сразу')).toBeInTheDocument();
    expect(screen.getByText('Например: тренировка три раза в неделю')).toBeInTheDocument();
  });

  it('writes a rule in its section with one line and Enter; the field is cleared', async () => {
    renderPage();
    const input = await screen.findByLabelText('Новое правило: Спорт');
    expect(screen.getByRole('button', { name: 'Записать правило: Спорт' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '  Тренировка три раза в неделю ' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    await waitFor(async () => expect(await store.list('rules')).toHaveLength(1));
    expect((await store.list('rules'))[0]).toMatchObject({ text: 'Тренировка три раза в неделю', group: 'sport' });
    expect(await ruleRow('Тренировка три раза в неделю')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('does not save an empty rule', async () => {
    renderPage();
    const input = await screen.findByLabelText('Новое правило: Мозг');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(await store.list('rules')).toHaveLength(0);
  });

  it('lists the rules of a section in the order they were written, numbered, with a count', async () => {
    await store.putMany('rules', [
      rule({ id: 'b2', text: 'Читать 20 минут', position: 2 }),
      rule({ id: 'b1', text: 'Сон не меньше 7 часов', position: 1, note: 'Иначе весь день в тумане' }),
      rule({ id: 's1', text: 'Тренировка три раза в неделю', group: 'sport', position: 1 }),
    ]);
    renderPage();
    const brain = await section('Мозг');
    expect(within(brain).getByRole('heading', { name: /^Мозг\s*2$/ })).toBeInTheDocument();
    const items = within(brain).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('1');
    expect(items[0]).toHaveTextContent('Сон не меньше 7 часов');
    expect(items[0]).toHaveTextContent('Иначе весь день в тумане');
    expect(items[1]).toHaveTextContent('Читать 20 минут');
    // пустой раздел показывает пример, раздел с правилами — нет
    expect(within(brain).queryByText(/^Например:/)).not.toBeInTheDocument();
    expect(within(await section('Спорт')).getAllByRole('listitem')).toHaveLength(1);
  });

  it('the editor changes text, reason and section; the rule moves to the end of the new section', async () => {
    await store.putMany('rules', [rule(), rule({ id: 's1', text: 'Бег по утрам', group: 'sport', position: 5 })]);
    renderPage();
    fireEvent.click(await ruleRow('Сон не меньше 7 часов'));
    expect(await screen.findByRole('dialog', { name: 'Правило' })).toBeInTheDocument();
    expect(textField()).toHaveValue('Сон не меньше 7 часов');
    fireEvent.change(textField(), { target: { value: 'Сон 8 часов' } });
    type('Зачем', 'Иначе весь день в тумане');
    fireEvent.change(screen.getByLabelText('Раздел'), { target: { value: 'regime' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(async () =>
      expect((await store.list('rules')).find(r => r.id === 'r1')).toMatchObject({ text: 'Сон 8 часов', note: 'Иначе весь день в тумане', group: 'regime' }),
    );
    expect(within(await section('Режим')).getByText('Сон 8 часов')).toBeInTheDocument();
  });

  it('«+ Правило» asks for the text and the section', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Правило' }));
    expect(await screen.findByRole('dialog', { name: 'Новое правило' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    fireEvent.change(textField(), { target: { value: '10% дохода откладывать сразу' } });
    fireEvent.change(screen.getByLabelText('Раздел'), { target: { value: 'economy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(async () => expect(await store.list('rules')).toHaveLength(1));
    expect((await store.list('rules'))[0]).toMatchObject({ text: '10% дохода откладывать сразу', group: 'economy' });
  });

  it('the menu moves a rule to another section', async () => {
    await store.put('rules', rule());
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Действия: Сон не меньше 7 часов' }));
    expect(screen.queryByRole('menuitem', { name: 'В «Мозг»' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'В «Спорт»' }));
    await waitFor(async () => expect((await store.list('rules'))[0].group).toBe('sport'));
  });

  it('deleting offers undo', async () => {
    await store.put('rules', rule());
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Действия: Сон не меньше 7 часов' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Удалить' }));
    await waitFor(async () => expect(await store.list('rules')).toHaveLength(0));
    fireEvent.click(await screen.findByRole('button', { name: 'Отменить' }));
    await waitFor(async () => expect(await store.list('rules')).toHaveLength(1));
  });

  it('opens the editor of a rule from the search link', async () => {
    await store.put('rules', rule());
    renderPage('/rules?rule=r1');
    expect(await screen.findByRole('dialog', { name: 'Правило' })).toBeInTheDocument();
    expect(textField()).toHaveValue('Сон не меньше 7 часов');
  });
});
