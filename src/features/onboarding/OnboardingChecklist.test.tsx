import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { setStore, clearStore } from '@/data';
import { MemoryStore } from '@/data/memory';
import { ToastProvider } from '@/components/ui/Toast';
import { TaskActionsProvider } from '@/features/tasks/TaskActionsContext';
import { OnboardingChecklist } from './OnboardingChecklist';

const T = '2026-09-30T08:00:00.000Z';
const base = { createdAt: T, updatedAt: T };

beforeEach(() => localStorage.clear());
afterEach(() => clearStore());

function renderIt() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <TaskActionsProvider>
          <OnboardingChecklist />
        </TaskActionsProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('OnboardingChecklist', () => {
  it('ticks steps from data and hides on «Скрыть»', async () => {
    const store = new MemoryStore();
    await store.put('profiles', { id: 'me', timezone: 'Asia/Almaty', morningTime: '09:00', currency: 'KZT', ...base });
    await store.putMany('dreams', ['a', 'b', 'c'].map(id => ({ id, title: id, ...base })));
    await store.put('goals', { id: 'g', title: 'Цель', horizon: 'year', status: 'active', ...base });
    setStore(store);
    renderIt();

    expect(await screen.findByRole('heading', { name: /Первые шаги 2\/5/ })).toBeInTheDocument();
    expect(screen.getByText(/Запиши три мечты/)).toHaveTextContent('сделано');
    expect(screen.getByRole('button', { name: 'Сделать: Выбери цель недели' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Сделать: Поставь цель' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Скрыть' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: /Первые шаги/ })).not.toBeInTheDocument());
    expect((await store.list('profiles'))[0].checklistDismissed).toBe(true);
  });

  it('celebrates when the last step lands after being seen incomplete', async () => {
    localStorage.setItem('ikigai.checklist.seenIncomplete', '1');
    const store = new MemoryStore();
    await store.put('profiles', {
      id: 'me', timezone: 'Asia/Almaty', morningTime: '09:00', currency: 'KZT', weekGoalId: 'w', telegramChatId: '1', ...base,
    });
    await store.putMany('dreams', ['a', 'b', 'c'].map(id => ({ id, title: id, ...base })));
    await store.put('goals', { id: 'w', title: 'Неделя', horizon: 'week', status: 'active', ...base });
    await store.put('tasks', {
      id: 't', title: 'Шаг', area: 'work', status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: 0, plannedStart: '09:00', ...base,
    });
    setStore(store);
    renderIt();
    expect(await screen.findByRole('heading', { name: 'Ты настроил Ikigai' })).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem('ikigai.checklist.doneAt')).toBeTruthy());
  });
});
