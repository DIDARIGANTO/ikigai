import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { useCollection } from '@/data/hooks';
import type { Task } from '@/lib/types';
import { DaySummaryCard, shouldShowSummary } from './DaySummaryCard';
import { makeTask, renderToday } from './testUtils';

const D = '2026-09-30';
const at = (hhmm: string) => new Date(`${D}T${hhmm}:00`).toISOString();
afterEach(cleanup);

/** Как на странице: закрытый день приходит из коллекции. */
function Harness({ tasks }: { tasks: Task[] }) {
  const logs = useCollection('dailyLogs');
  return <DaySummaryCard tasks={tasks} date={D} log={logs.find(l => l.id === D)} />;
}

describe('DaySummaryCard', () => {
  const tasks = [
    makeTask({ date: D, status: 'done', goalId: 'g', plannedMinutes: 60, actualStart: at('09:00'), actualEnd: at('10:12') }),
    makeTask({ date: D, status: 'skipped' }),
  ];

  it('closes the day: writes a DailyLog with energy and shows the calm closing message', async () => {
    const { store } = await renderToday(<Harness tasks={tasks} />);
    expect(screen.getByText('×1.2')).toBeInTheDocument();

    // Цифры — моноширинными, без цветных плиток; энергия — сегменты 1–5, пока ничего не выбрано.
    expect(screen.getAllByText('1:12', { selector: 'dd' })).toHaveLength(2);
    expect(screen.getByText('×1.2')).toHaveClass('font-mono');
    expect(screen.getByTestId('day-summary').innerHTML).not.toMatch(/bg-[a-z]+-soft/);
    const group = screen.getByRole('radiogroup', { name: 'Энергия' });
    expect(screen.getAllByRole('radio').map(r => r.textContent)).toEqual(['1', '2', '3', '4', '5']);
    expect(screen.getAllByRole('radio').some(r => r.getAttribute('aria-checked') === 'true')).toBe(false);
    const good = screen.getByRole('radio', { name: '4 — Хорошо' });
    fireEvent.click(good);
    expect(good).toHaveAttribute('aria-checked', 'true');
    // Стрелка вправо — следующее значение.
    fireEvent.keyDown(good, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: '5 — Заряжен' })).toHaveAttribute('aria-checked', 'true');
    expect(group).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Закрыть день' }));
    await waitFor(async () => {
      const [log] = await store.list('dailyLogs');
      expect(log).toMatchObject({
        id: D,
        date: D,
        energy: 5,
        done: 1,
        skipped: 1,
        moved: 0,
        accuracy: 1.2,
        focusMinutes: 72,
        goalMinutes: 72,
      });
      expect(typeof log.closedAt).toBe('string');
    });
    expect(await screen.findByText('День закрыт. Хороший вечер')).toBeInTheDocument();
    expect(screen.getByTestId('day-closed')).toHaveTextContent('энергия 5/5');

    // «Изменить» возвращает форму, повторное закрытие обновляет ту же запись.
    fireEvent.click(screen.getByRole('button', { name: 'Изменить' }));
    fireEvent.click(screen.getByRole('radio', { name: '3 — Ровно' }));
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть день' }));
    await waitFor(async () => {
      const logs = await store.list('dailyLogs');
      expect(logs).toHaveLength(1);
      expect(logs[0].energy).toBe(3);
    });
  });
});

describe('shouldShowSummary', () => {
  const open = makeTask({ date: D });
  const done = makeTask({ date: D, status: 'done' });
  it('shows from 20:00, when every task is closed, or when the day is closed', () => {
    expect(shouldShowSummary(19, [open, done])).toBe(false);
    expect(shouldShowSummary(20, [open])).toBe(true);
    expect(shouldShowSummary(10, [done, { ...open, status: 'skipped' }])).toBe(true);
    expect(shouldShowSummary(10, [])).toBe(false);
    expect(
      shouldShowSummary(9, [open], {
        id: D, date: D, done: 0, skipped: 0, moved: 0, focusMinutes: 0, goalMinutes: 0, closedAt: '', createdAt: '', updatedAt: '',
      }),
    ).toBe(true);
  });
});
