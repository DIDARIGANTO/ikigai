import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Dream, Goal } from '@/lib/types';
import { NorthStar } from './NorthStar';
import { SkyHeader } from './SkyHeader';
import { makeTask } from './testUtils';

const goal = (id: string, title: string): Goal => ({ id, title }) as unknown as Goal;
const dream = { id: 'd1', title: 'Своя мастерская', emoji: '🛠️' } as unknown as Dream;

describe('SkyHeader', () => {
  it('показывает приветствие по имени и сводку «план · факт · сделано» моноширинными цифрами', () => {
    const now = new Date(2026, 9, 1, 10, 0).getTime();
    render(<SkyHeader now={now} name="Дидар" summary={{ planned: 180, actual: 0, done: 1, total: 3 }} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Дидар');
    expect(screen.getByText('3:00')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Сделано за сегодня' })).toHaveAttribute('aria-valuenow', '33');
  });

  it('без задач сводку не рисует', () => {
    render(<SkyHeader now={Date.now()} summary={{ planned: 0, actual: 0, done: 0, total: 0 }} />);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('NorthStar', () => {
  const chain = {
    dream,
    goals: [goal('g1', 'Открыть мастерскую'), goal('g2', 'Найти помещение')],
    nextStep: makeTask({ id: 't1', title: 'Обзвонить арендодателей' }),
  };

  it('цепочка «мечта › цель › шаг» текстом; шаг открывает редактор задачи', () => {
    const onOpenTask = vi.fn();
    render(
      <MemoryRouter>
        <NorthStar chain={chain} onOpenTask={onOpenTask} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Мечта: Своя мастерская/ })).toHaveAttribute('href', '/dreams');
    expect(screen.getByRole('link', { name: /Цель недели: Найти помещение/ })).toHaveAttribute('href', '/goals/g2');
    fireEvent.click(screen.getByRole('button', { name: /Шаг: Обзвонить арендодателей/ }));
    expect(onOpenTask).toHaveBeenCalledWith(chain.nextStep);
  });

  it('на телефоне остаются два последних пункта', () => {
    render(
      <MemoryRouter>
        <NorthStar chain={chain} onOpenTask={() => {}} />
      </MemoryRouter>,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items.slice(0, 2).every(li => li.className.includes('hidden sm:flex'))).toBe(true);
    expect(items.slice(2).some(li => li.className.includes('hidden'))).toBe(false);
  });

  it('без цели недели — ссылка выбрать её', () => {
    render(
      <MemoryRouter>
        <NorthStar chain={{ goals: [] }} onOpenTask={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Выбери цель недели/ })).toHaveAttribute('href', '/goals?tab=week');
  });
});
