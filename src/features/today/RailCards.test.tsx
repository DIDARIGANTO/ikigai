import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Goal, Reminder } from '@/lib/types';
import { InboxCard, RemindersCard, WeekGoalCard } from './RailCards';
import { makeTask } from './testUtils';

afterEach(cleanup);

const T = '2026-09-01T00:00:00.000Z';
const reminder = (id: string, text: string, p: Partial<Reminder> = {}): Reminder => ({
  id,
  text,
  date: '2026-10-01',
  repeat: 'none',
  createdAt: T,
  updatedAt: T,
  ...p,
});

describe('RailCards', () => {
  it('week goal: a 3 px bar with a mono percentage and the next step as a plain row', () => {
    const goal = { id: 'g', title: 'Описать все разделы' } as Goal;
    render(
      <MemoryRouter>
        <WeekGoalCard goal={goal} progress={0.4} nextStep={makeTask({ title: 'Глубокая работа' })} onOpenTask={() => {}} />
      </MemoryRouter>,
    );
    const card = screen.getByRole('region', { name: 'Цель недели' });
    expect(within(card).getByRole('progressbar', { name: /Описать все разделы/ })).toHaveAttribute('aria-valuenow', '40');
    expect(within(card).getByText('40%')).toHaveClass('font-mono');
    expect(within(card).getByRole('button', { name: /Следующий шаг.*Глубокая работа/ })).toBeInTheDocument();
    expect(card.innerHTML).not.toMatch(/bg-[a-z]+-soft/);
  });

  it('reminders: plain icon rows with the time or date in mono', () => {
    render(
      <RemindersCard
        items={[
          { reminder: reminder('a', 'Оплатить интернет', { time: '09:00' }), days: 0, date: '2026-10-01' },
          { reminder: reminder('b', 'День рождения Айгерим', { repeat: 'yearly' }), days: 1, date: '2026-10-02' },
          { reminder: reminder('c', 'Продлить страховку'), days: 5, date: '2026-10-06' },
        ]}
      />,
    );
    expect(screen.getByText('09:00')).toHaveClass('font-mono');
    expect(screen.getByText('завтра')).toBeInTheDocument();
    expect(screen.getByText('06.10')).toHaveClass('font-mono');
    expect(screen.getByRole('img', { name: 'Ежегодное' })).toBeInTheDocument();
  });

  it('inbox: one row with a mono count', () => {
    render(
      <MemoryRouter>
        <InboxCard count={3} />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Входящие: 3 задачи разобрать' });
    expect(within(link).getByText('3')).toHaveClass('font-mono');
  });
});
