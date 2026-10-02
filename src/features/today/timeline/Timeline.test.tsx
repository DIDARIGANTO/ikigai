import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { Task } from '@/lib/types';
import { ToastProvider } from '@/components/ui/Toast';
import { dateAt, HOUR_PX, PAD_PX, STRIP_PX } from '@/lib/domain/timeline';

const ctx = vi.hoisted(() => ({
  tasks: [] as Task[],
  goals: [],
  columns: [],
  save: vi.fn(async () => {}),
  start: vi.fn(async () => {}),
  finish: vi.fn(async () => {}),
  skip: vi.fn(async () => {}),
}));
vi.mock('@/features/tasks/TaskActionsContext', () => ({ useTaskActionsCtx: () => ctx }));

import { Timeline } from '../Timeline';

const TODAY = '2026-09-30';
const TOMORROW = '2026-10-01';
const t = (p: Partial<Task>): Task => ({
  id: 't', createdAt: '', updatedAt: 'v1', title: 'x', area: 'personal', status: 'todo',
  rescheduleCount: 0, source: 'web', kind: 'task', position: 0, date: TODAY, ...p,
});
const at = (hh: number, mm = 0) => dateAt(TODAY, hh * 60 + mm).toISOString();

function setup(tasks: Task[], date = TODAY) {
  ctx.tasks = tasks;
  const onCreate = vi.fn();
  const onOpenTask = vi.fn();
  render(
    <ToastProvider>
      <Timeline date={date} embedded onCreate={onCreate} onOpenTask={onOpenTask} />
    </ToastProvider>,
  );
  return { onCreate, onOpenTask };
}

/** Будущий день: свёрнута только ночь (00–06), дальше — ровные часы по 56 px. У jsdom прямоугольники нулевые. */
const futureY = (min: number) => PAD_PX + STRIP_PX + ((min - 360) / 60) * HOUR_PX;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 30, 15, 42));
  ctx.save.mockClear();
  ctx.start.mockClear();
  ctx.skip.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Timeline: клавиатура', () => {
  it('стрелки переносят на 15 минут, Shift+стрелки меняют длительность, изменения объявляются', () => {
    setup([t({ id: 'w', title: 'Тренировка', date: TOMORROW, plannedStart: '07:00', plannedMinutes: 60 })], TOMORROW);
    const block = screen.getByRole('button', { name: /^Тренировка, 07:00–08:00/ });
    block.focus();
    fireEvent.keyDown(block, { key: 'ArrowDown' });
    expect(ctx.save).toHaveBeenLastCalledWith(expect.objectContaining({ plannedStart: '07:15', plannedMinutes: 60 }));
    expect(screen.getByText('Тренировка: перенесено на 07:15')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('button', { name: /^Тренировка, 07:15–08:15/ }), { key: 'ArrowDown', shiftKey: true });
    expect(ctx.save).toHaveBeenLastCalledWith(expect.objectContaining({ plannedStart: '07:15', plannedMinutes: 75 }));
    expect(screen.getByText('Тренировка: теперь 07:15–08:30')).toBeInTheDocument();
  });

  it('короче 15 минут не сжать — только объявление', () => {
    setup([t({ id: 'w', title: 'Звонок', date: TOMORROW, plannedStart: '09:00', plannedMinutes: 15 })], TOMORROW);
    fireEvent.keyDown(screen.getByRole('button', { name: /^Звонок, 09:00–09:15/ }), { key: 'ArrowUp', shiftKey: true });
    expect(ctx.save).not.toHaveBeenCalled();
    expect(screen.getByText('Звонок: короче 15 минут нельзя')).toBeInTheDocument();
  });
});

describe('Timeline: пропущенные блоки', () => {
  const missed = () => t({ id: 'm', title: 'Созвон', plannedStart: '13:00', plannedMinutes: 30 });

  it('«Не делал» пропускает задачу, отмена возвращает', () => {
    setup([missed()]);
    fireEvent.click(screen.getByRole('button', { name: '«Созвон»: пропущено — выбрать, что сделать' }));
    const dialog = screen.getByRole('dialog', { name: '«Созвон»: время прошло' });
    fireEvent.click(within(dialog).getByRole('button', { name: /Не делал/ }));
    expect(ctx.skip).toHaveBeenCalledWith(expect.objectContaining({ id: 'm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(ctx.save).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'm', status: 'todo' }));
  });

  it('«+1 час» переносит от ближайших 15 минут, «Завтра» — на следующий день', () => {
    setup([missed()]);
    fireEvent.click(screen.getByRole('button', { name: /пропущено — выбрать/ }));
    fireEvent.click(screen.getByRole('button', { name: '+1 час 16:45' }));
    expect(ctx.save).toHaveBeenLastCalledWith(expect.objectContaining({ plannedStart: '16:45', date: TODAY }));
    expect(screen.getByText('Перенесено на 16:45')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /пропущено — выбрать/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Завтра 13:00' }));
    expect(ctx.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ plannedStart: '13:00', date: TOMORROW, rescheduleCount: 1 }),
    );
  });

  it('«Сделал в…» записывает факт на задуманную длительность', () => {
    setup([missed()]);
    fireEvent.click(screen.getByRole('button', { name: /пропущено — выбрать/ }));
    fireEvent.click(screen.getByRole('button', { name: /Сделал в/ }));
    fireEvent.change(screen.getByLabelText('Начал в'), { target: { value: '13:10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отметить сделанным' }));
    expect(ctx.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'done', actualStart: at(13, 10), actualEnd: at(13, 40) }),
    );
  });

  it('«Начать сейчас» запускает таймер', () => {
    setup([missed()]);
    fireEvent.click(screen.getByRole('button', { name: /пропущено — выбрать/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Начать сейчас' }));
    expect(ctx.start).toHaveBeenCalledWith(expect.objectContaining({ id: 'm' }));
  });

  it('будущая и сделанная задачи не «пропущены»', () => {
    setup([
      t({ id: 'f', title: 'Потом', plannedStart: '18:00' }),
      t({ id: 'd', title: 'Готово', plannedStart: '09:00', status: 'done' }),
    ]);
    expect(screen.queryByRole('button', { name: /пропущено — выбрать/ })).toBeNull();
  });
});

describe('Timeline: план и факт', () => {
  it('переработка — «+12 мин», ранний финиш — «−10 мин»', () => {
    setup([
      t({ id: 'a', title: 'Тренировка', plannedStart: '07:00', plannedMinutes: 60, status: 'done', actualStart: at(7, 10), actualEnd: at(8, 12) }),
      t({ id: 'b', title: 'Работа', plannedStart: '10:00', plannedMinutes: 120, status: 'done', actualStart: at(10, 5), actualEnd: at(11, 50) }),
    ]);
    expect(screen.getByText(/\+12 мин/)).toBeInTheDocument();
    expect(screen.getByText(/−10 мин/)).toBeInTheDocument();
  });

  it('пустые прошедшие часы свёрнуты в полосу, её можно развернуть', () => {
    setup([t({ id: 'a', title: 'Вечер', plannedStart: '19:00' })]);
    const strip = screen.getByRole('button', { name: /00:00–15:00/ });
    fireEvent.click(strip);
    expect(screen.queryByRole('button', { name: /00:00–15:00/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Свернуть пустые часы' })).toBeInTheDocument();
  });
});

describe('Timeline: указатель', () => {
  const pointer = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', target: Element | Window, clientY: number) =>
    fireEvent[type](target, { clientY, clientX: 100, pointerId: 1, pointerType: 'mouse', button: 0 });

  it('провести по пустому месту — новый блок нужной длины', () => {
    const { onCreate } = setup([], TOMORROW);
    const bg = document.querySelector('[data-tl-bg]')!;
    pointer('pointerDown', bg, futureY(16 * 60) + 2);
    act(() => {
      pointer('pointerMove', window, futureY(16 * 60 + 30));
      pointer('pointerMove', window, futureY(17 * 60 + 30) + 2);
    });
    expect(screen.getByText('Новая задача')).toBeInTheDocument();
    pointer('pointerUp', window, futureY(17 * 60 + 30) + 2);
    expect(onCreate).toHaveBeenCalledWith({ date: TOMORROW, plannedStart: '16:00', plannedMinutes: 90 });
  });

  it('простое нажатие на пустое место — задача на получас', () => {
    const { onCreate } = setup([], TOMORROW);
    const bg = document.querySelector('[data-tl-bg]')!;
    pointer('pointerDown', bg, futureY(9 * 60 + 40));
    pointer('pointerUp', window, futureY(9 * 60 + 40));
    expect(onCreate).toHaveBeenCalledWith({ date: TOMORROW, plannedStart: '09:30', plannedMinutes: 30 });
  });

  it('перенос мышью сохраняет новое время и даёт отменить', () => {
    const task = t({ id: 'w', title: 'Тренировка', date: TOMORROW, plannedStart: '07:00', plannedMinutes: 60 });
    const { onOpenTask } = setup([task], TOMORROW);
    const block = screen.getByRole('button', { name: /^Тренировка, 07:00–08:00/ });
    pointer('pointerDown', block, futureY(7 * 60 + 10));
    act(() => {
      pointer('pointerMove', window, futureY(7 * 60 + 40));
      pointer('pointerMove', window, futureY(8 * 60 + 40));
    });
    pointer('pointerUp', window, futureY(8 * 60 + 40));
    fireEvent.click(block);
    expect(onOpenTask).not.toHaveBeenCalled();
    expect(ctx.save).toHaveBeenLastCalledWith(expect.objectContaining({ plannedStart: '08:30', plannedMinutes: 60 }));
    expect(screen.getByText('Перенесено на 08:30')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(ctx.save).toHaveBeenLastCalledWith(task);
  });

  it('клик без движения открывает задачу', () => {
    const task = t({ id: 'w', title: 'Тренировка', date: TOMORROW, plannedStart: '07:00', plannedMinutes: 60 });
    const { onOpenTask } = setup([task], TOMORROW);
    const block = screen.getByRole('button', { name: /^Тренировка, 07:00–08:00/ });
    pointer('pointerDown', block, futureY(7 * 60 + 10));
    pointer('pointerUp', window, futureY(7 * 60 + 10));
    fireEvent.click(block);
    expect(onOpenTask).toHaveBeenCalledWith(task);
    expect(ctx.save).not.toHaveBeenCalled();
  });
});
