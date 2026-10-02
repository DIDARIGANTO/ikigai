import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { DayTasksCard } from './DayTasksCard';
import { makeTask, renderToday } from './testUtils';

const D = '2026-09-30';
afterEach(cleanup);

describe('DayTasksCard', () => {
  it('schedules an untimed task into the nearest free slot', async () => {
    const busy = makeTask({ title: 'Созвон', date: D, plannedStart: '14:15', plannedMinutes: 45 });
    const loose = makeTask({ title: 'Позвонить маме', date: D, plannedMinutes: 30 });
    const { store } = await renderToday(
      <DayTasksCard tasks={[loose]} date={D} nowMin={14 * 60 + 5} onOpen={() => {}} onAdd={() => {}} />,
      { tasks: [busy, loose] },
    );
    // Контекст задач подгружается асинхронно — даём ему прочитать хранилище.
    await new Promise(r => setTimeout(r, 50));
    fireEvent.click(screen.getByRole('button', { name: 'Запланировать: Позвонить маме' }));
    const dialog = await screen.findByRole('dialog', { name: 'Свободное время' });
    expect(within(dialog).getAllByRole('button')[0]).toHaveTextContent('15:00–15:30');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /15:00–15:30/ }));
    await waitFor(async () => {
      const t = (await store.list('tasks')).find(x => x.id === loose.id);
      expect(t).toMatchObject({ plannedStart: '15:00', plannedMinutes: 30 });
    });
  });

  it('marks a task done from the checkbox', async () => {
    const t = makeTask({ title: 'Читать', date: D });
    const { store } = await renderToday(
      <DayTasksCard tasks={[t]} date={D} nowMin={600} onOpen={() => {}} onAdd={() => {}} />,
      { tasks: [t] },
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Отметить готово: Читать' }));
    await waitFor(async () => expect((await store.list('tasks'))[0].status).toBe('done'));
  });
});
