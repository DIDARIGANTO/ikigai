import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom';
import { setStore, clearStore } from '@/data';
import { MemoryStore } from '@/data/memory';
import { ensureDefaults, loadDemo } from '@/data/seed';
import { WelcomeGate } from './WelcomeGate';

afterEach(() => clearStore());

function renderGate(path = '/') {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <>
            <WelcomeGate />
            <Outlet />
          </>
        ),
        children: [{ index: true, element: <p>Сегодня</p> }, { path: '*', element: <p>Нет такой</p> }],
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

async function freshDemoStore() {
  const store = new MemoryStore();
  await ensureDefaults(store);
  await loadDemo(store);
  setStore(store);
  return store;
}

describe('WelcomeGate', () => {
  it('walks a new person from name to a dream, a goal chain and a timed first step', async () => {
    const store = await freshDemoStore();
    renderGate();

    fireEvent.change(await screen.findByPlaceholderText('Имя'), { target: { value: 'Аня' } });
    // Номер шага — строкой, а цепочка слева — список с состояниями.
    expect(screen.getByText('Шаг 1 из 4')).toBeInTheDocument();
    expect(screen.getAllByRole('list', { name: 'Твой путь' })[0]).toHaveTextContent('Мечта: впереди');
    // «С чистого листа» выбрано по умолчанию — демо уйдёт.
    expect(screen.getByRole('radio', { name: /С чистого листа/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));

    expect(await screen.findByRole('heading', { name: 'Аня, о чём ты мечтаешь?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Пробежать полумарафон/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));

    expect(await screen.findByRole('heading', { name: 'Превратим в цель' })).toBeInTheDocument();
    expect(screen.getByLabelText('Цель на год')).toHaveValue('Пробежать полумарафон');
    fireEvent.click(screen.getByRole('button', { name: 'Создать цель' }));

    expect(await screen.findByRole('heading', { name: 'Готово, Аня' })).toBeInTheDocument();
    expect(screen.getAllByRole('list', { name: 'Твой путь' })[0]).toHaveTextContent('Первая задача: готово');

    const dreams = await store.list('dreams');
    const goals = await store.list('goals');
    const tasks = await store.list('tasks');
    // Демо убрано, осталось только своё.
    expect(dreams.map(d => d.title)).toEqual(['Пробежать полумарафон']);
    const year = goals.find(g => g.horizon === 'year')!;
    const week = goals.find(g => g.horizon === 'week')!;
    expect(goals).toHaveLength(2);
    expect(year).toMatchObject({ title: 'Пробежать полумарафон', dreamId: dreams[0].id, emoji: '🏃' });
    expect(week).toMatchObject({ title: 'Первый шаг', parentId: year.id });
    expect(dreams[0].goalId).toBe(year.id);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ title: 'Лёгкая пробежка 3 км', goalId: week.id, plannedStart: '09:00', plannedMinutes: 30 });
    let profile = (await store.list('profiles'))[0];
    expect(profile).toMatchObject({ name: 'Аня', weekGoalId: week.id, demoLoaded: false });
    expect(profile.onboarded).toBeUndefined();

    fireEvent.click(screen.getByRole('button', { name: 'Вот твой день' }));
    await waitFor(async () => {
      profile = (await store.list('profiles'))[0];
      expect(profile.onboarded).toBe(true);
    });
    expect(screen.queryByRole('dialog', { name: 'Знакомство с Ikigai' })).not.toBeInTheDocument();
  });

  it('keeps demo data when the person picks examples, and skipping marks onboarded', async () => {
    const store = await freshDemoStore();
    renderGate();
    fireEvent.click(await screen.findByRole('radio', { name: /С примерами/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));
    await screen.findByRole('heading', { name: 'О чём ты мечтаешь?' });
    expect((await store.list('dreams')).length).toBe(5);
    fireEvent.click(screen.getByRole('button', { name: 'Пропустить' }));
    await waitFor(async () => expect((await store.list('profiles'))[0].onboarded).toBe(true));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('stays away from people who already have their own data', async () => {
    const store = await freshDemoStore();
    const p = (await store.list('profiles'))[0];
    await store.put('profiles', { ...p, onboarded: false });
    const now = '2099-01-01T00:00:00.000Z';
    await store.put('tasks', {
      id: 'mine', title: 'Моя задача', area: 'work', status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: 0,
      createdAt: now, updatedAt: now,
    });
    renderGate();
    expect(await screen.findByText('Сегодня')).toBeInTheDocument();
    await new Promise(r => setTimeout(r, 30));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not show on a not-found page', async () => {
    await freshDemoStore();
    renderGate('/nope');
    expect(await screen.findByText('Нет такой')).toBeInTheDocument();
    await new Promise(r => setTimeout(r, 30));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
