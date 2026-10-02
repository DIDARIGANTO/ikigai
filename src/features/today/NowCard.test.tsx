import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { NowCard, pickNext } from './NowCard';
import { makeTask, renderToday } from './testUtils';

const D = '2026-09-30';
const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

afterEach(cleanup);

describe('NowCard', () => {
  it('shows the overrun as warning text and a 2 px rule, without a filled card, and extends the plan by 15 minutes', async () => {
    const running = makeTask({ title: 'Глубокая работа', date: D, status: 'doing', actualStart: minsAgo(72), plannedMinutes: 60 });
    const { store } = await renderToday(
      <NowCard tasks={[running]} dayTasks={[running]} nowMin={600} date={D} onOpen={() => {}} />,
      { tasks: [running] },
    );
    const card = screen.getByTestId('now-running');
    expect(within(card).getByText('+12 мин сверх плана')).toBeInTheDocument();
    expect(within(card).getByText('+12 мин сверх плана').className).toContain('text-warning-strong');
    expect(card.className).not.toMatch(/bg-[a-z]+-soft|amber|danger|rose/);
    expect(card.querySelector('.bg-warning')).not.toBeNull();
    expect(card.querySelector('[data-over]')).not.toBeNull();
    expect(within(card).getByText(/^1:12:\d\d$/)).toHaveClass('font-mono');

    fireEvent.click(within(card).getByRole('button', { name: /Ещё 15 мин/ }));
    await waitFor(async () => expect((await store.list('tasks'))[0].plannedMinutes).toBe(75));
  });

  it('is calm and shows the time left while within the plan', async () => {
    const running = makeTask({ date: D, status: 'doing', actualStart: minsAgo(20), plannedMinutes: 60 });
    await renderToday(<NowCard tasks={[running]} dayTasks={[running]} nowMin={600} date={D} onOpen={() => {}} />);
    const card = screen.getByTestId('now-running');
    expect(card.className).not.toMatch(/bg-[a-z]+-soft/);
    expect(within(card).getByText('Осталось 40 мин')).toBeInTheDocument();
    expect(card.querySelector('[data-over]')).toBeNull();
    expect(card.querySelector('.bg-warning')).toBeNull();
    expect(within(card).getByRole('button', { name: 'Открыть' })).toBeInTheDocument();
  });

  it('labels the next task: «Следующая задача» without time, «Пропущено» after its planned slot', async () => {
    const loose = makeTask({ title: 'Позвонить маме', date: D });
    await renderToday(<NowCard tasks={[loose]} dayTasks={[loose]} nowMin={600} date={D} onOpen={() => {}} />);
    expect(within(screen.getByTestId('now-next')).getByText('Следующая задача')).toBeInTheDocument();
    cleanup();
    const early = makeTask({ title: 'Зарядка', date: D, plannedStart: '07:00', plannedMinutes: 30 });
    await renderToday(<NowCard tasks={[early]} dayTasks={[early]} nowMin={600} date={D} onOpen={() => {}} />);
    const card = screen.getByTestId('now-next');
    expect(within(card).getByText('Пропущено · можно начать сейчас')).toBeInTheDocument();
    expect(within(card).getByText('07:00–07:30')).toHaveClass('font-mono');
  });

  it('offers three example chips on an empty day that create untimed tasks for today', async () => {
    const onAdd = vi.fn();
    const { store } = await renderToday(
      <NowCard tasks={[]} dayTasks={[]} nowMin={600} date={D} onOpen={() => {}} onAdd={onAdd} />,
    );
    expect(screen.getByRole('heading', { name: 'На сегодня пока ничего' })).toBeInTheDocument();
    const chips = within(screen.getByRole('list', { name: 'Быстро добавить' })).getAllByRole('button');
    expect(chips.map(c => c.textContent)).toEqual(['Прогулка', 'Разобрать почту', 'Читать']);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить задачу' }));
    expect(onAdd).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Прогулка/ }));
    await waitFor(async () => {
      const [t] = await store.list('tasks');
      expect(t).toMatchObject({ title: 'Прогулка', date: D, plannedMinutes: 30, status: 'todo' });
      expect(t.plannedStart).toBeUndefined();
    });
  });
});

describe('pickNext', () => {
  const t7 = makeTask({ date: D, plannedStart: '07:00', plannedMinutes: 60 });
  const t10 = makeTask({ date: D, plannedStart: '10:00', plannedMinutes: 120 });
  const loose = makeTask({ date: D });
  const important = makeTask({ date: D, important: true });

  it('prefers the upcoming (or ongoing by plan) timed task', () => {
    expect(pickNext([t7, t10, loose], 9 * 60)).toBe(t10);
    expect(pickNext([t7, t10, loose], 11 * 60)).toBe(t10);
  });
  it('then an untimed task, important first', () => {
    expect(pickNext([t7, t10, loose, important], 13 * 60)).toBe(important);
  });
  it('then a missed timed task', () => {
    expect(pickNext([t7, t10], 13 * 60)).toBe(t10);
  });
  it('ignores closed tasks', () => {
    expect(pickNext([{ ...t10, status: 'done' }, { ...loose, status: 'skipped' }], 9 * 60)).toBeUndefined();
  });
});
