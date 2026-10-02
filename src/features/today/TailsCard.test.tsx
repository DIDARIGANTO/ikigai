import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { TailsCard } from './TailsCard';
import { makeTask, renderToday } from './testUtils';

const D = '2026-09-30';
afterEach(cleanup);

describe('TailsCard', () => {
  it('renders nothing without tails', async () => {
    await renderToday(<TailsCard tasks={[]} today={D} />);
    expect(screen.queryByTestId('tails')).toBeNull();
  });

  it('moves one tail to tomorrow and marks another as not done, without red', async () => {
    const a = makeTask({ title: 'Почта', date: '2026-09-29' });
    const b = makeTask({ title: 'Отчёт', date: '2026-09-27' });
    const { store } = await renderToday(<TailsCard tasks={[a, b]} today={D} />, { tasks: [a, b] });
    const card = screen.getByTestId('tails');
    expect(card.innerHTML).not.toMatch(/danger|rose|amber|bg-[a-z]+-soft/);
    expect(within(card).getByText('со вчера')).toBeInTheDocument();

    const rowA = within(card).getByRole('group', { name: 'Что сделать с «Почта»' });
    fireEvent.click(within(rowA).getByRole('button', { name: 'Завтра' }));
    const rowB = within(card).getByRole('group', { name: 'Что сделать с «Отчёт»' });
    fireEvent.click(within(rowB).getByRole('button', { name: 'Не делал' }));

    await waitFor(async () => {
      const rows = await store.list('tasks');
      expect(rows.find(t => t.id === a.id)).toMatchObject({ date: '2026-10-01', rescheduleCount: 1 });
      expect(rows.find(t => t.id === b.id)).toMatchObject({ status: 'skipped' });
    });
  });

  it('moves every tail to today at once; a long list shows two rows until expanded', async () => {
    const tails = [1, 2, 3].map(i => makeTask({ title: `Хвост ${i}`, date: '2026-09-2' + i }));
    const { store } = await renderToday(<TailsCard tasks={tails} today={D} />, { tasks: tails });
    expect(screen.getByRole('region', { name: 'Незавершённое' })).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Показать ещё 1' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Хвост 2')).toBeInTheDocument();
    expect(screen.queryByText('Хвост 3')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText('Хвост 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Свернуть' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getAllByRole('button', { name: 'Перенести на сегодня' })[0]);
    await waitFor(async () => {
      const rows = await store.list('tasks');
      expect(rows.every(t => t.date === D)).toBe(true);
    });
    expect(await screen.findByText('Перенесено на сегодня: 3')).toBeInTheDocument();
  });
});
