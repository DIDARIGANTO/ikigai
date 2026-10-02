import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Reminder, Task } from '@/lib/types';

const save = vi.fn(async (t: Task) => t);
const toggleDone = vi.fn();
vi.mock('@/features/tasks/TaskActionsContext', () => ({
  useTaskActionsCtx: () => ({ tasks: [], goals: [], save, toggleDone }),
}));

import { MonthView } from './MonthView';
import { DaySheet } from './DaySheet';
import { WeekGrid } from './WeekGrid';
import { useCalendarHotkeys } from './CalendarPage';
import { monthGrid, weekGrid } from './grid';

const task = (id: string, p: Partial<Task> = {}): Task => ({
  id, createdAt: '', updatedAt: '', title: id, area: 'work',
  status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: 0, ...p,
});
const reminder = (id: string, p: Partial<Reminder> = {}): Reminder => ({
  id, createdAt: '', updatedAt: '', text: id, date: '2026-09-14', repeat: 'none', ...p,
});

beforeEach(() => {
  save.mockClear();
  toggleDone.mockClear();
});

describe('MonthView: перенос с клавиатуры', () => {
  const t = task('Отчёт', { date: '2026-09-14' });
  const setup = () =>
    render(
      <MonthView
        cursor="2026-09-14"
        days={monthGrid('2026-09-14')}
        tasksFor={iso => (iso === t.date ? [t] : [])}
        remindersFor={() => []}
        onOpenTask={vi.fn()}
        onPickDay={vi.fn()}
        onCreate={vi.fn()}
      />,
    );
  const target = (c: HTMLElement) => c.querySelector('[data-kbd-target]')?.getAttribute('data-day');

  it('первым подсвечен собственный день задачи, стрелки двигают на день и неделю', async () => {
    const { container } = setup();
    const chip = screen.getByRole('button', { name: /Отчёт/ });
    chip.focus();
    fireEvent.keyDown(chip, { key: ' ' });
    expect(target(container)).toBe('2026-09-14');
    fireEvent.keyDown(chip, { key: 'ArrowRight' });
    expect(target(container)).toBe('2026-09-15');
    fireEvent.keyDown(chip, { key: 'ArrowDown' });
    expect(target(container)).toBe('2026-09-22');
    expect(screen.getByText('вторник, 22 сентября')).toBeInTheDocument();
    fireEvent.keyDown(chip, { key: ' ' });
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0]).toMatchObject({ date: '2026-09-22', rescheduleCount: 1 });
  });

  it('Esc отменяет, ничего не сохраняя', () => {
    const { container } = setup();
    const chip = screen.getByRole('button', { name: /Отчёт/ });
    fireEvent.keyDown(chip, { key: ' ' });
    fireEvent.keyDown(chip, { key: 'ArrowLeft' });
    fireEvent.keyDown(chip, { key: 'Escape' });
    expect(target(container)).toBeUndefined();
    expect(save).not.toHaveBeenCalled();
  });
});

describe('DaySheet', () => {
  it('показывает задачи, напоминания и итог дня; «Задача» создаёт на этот день', () => {
    const onCreate = vi.fn();
    render(
      <DaySheet
        mode="sheet"
        date="2026-09-14"
        tasks={[
          task('Спортзал', { plannedStart: '07:00', plannedMinutes: 60, status: 'done' }),
          task('Позвонить маме', { area: 'personal' }),
        ]}
        reminders={[reminder('ДР Ани', { repeat: 'yearly' })]}
        onClose={vi.fn()}
        onOpenTask={vi.fn()}
        onCreate={onCreate}
        onOpenDay={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: '14 сентября' });
    expect(within(dialog).getByText('план 1 ч · сделано 1 из 2')).toBeInTheDocument();
    expect(within(dialog).getByText('Спортзал')).toBeInTheDocument();
    expect(within(dialog).getByText('07:00')).toBeInTheDocument();
    expect(within(dialog).getByText('Позвонить маме')).toBeInTheDocument();
    expect(within(dialog).getByText('ДР Ани')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('День рождения')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByLabelText('Отметить готово: Позвонить маме'));
    expect(toggleDone).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole('button', { name: /Задача/ }));
    expect(onCreate).toHaveBeenCalledWith('2026-09-14');
  });

  it('пустой день — подсказка', () => {
    render(
      <DaySheet mode="sheet" date="2026-09-14" tasks={[]} reminders={[]} onClose={vi.fn()} onOpenTask={vi.fn()} onCreate={vi.fn()} onOpenDay={vi.fn()} />,
    );
    expect(screen.getByText(/ничего нет/)).toBeInTheDocument();
  });
});

describe('WeekGrid: клавиатура', () => {
  it('стрелка вниз сдвигает на 15 минут, Enter сохраняет', async () => {
    const t = task('Ревью', { date: '2026-09-14', plannedStart: '10:00', plannedMinutes: 30 });
    render(
      <WeekGrid
        days={weekGrid('2026-09-14')}
        tasksFor={iso => (iso === t.date ? [t] : [])}
        remindersFor={() => []}
        onOpenTask={vi.fn()}
        onCreate={vi.fn()}
        onOpenDay={vi.fn()}
      />,
    );
    const block = screen.getByRole('button', { name: /Ревью, 10:00–10:30/ });
    block.focus();
    fireEvent.keyDown(block, { key: 'ArrowDown' });
    fireEvent.keyDown(block, { key: 'ArrowRight', altKey: true });
    fireEvent.keyDown(block, { key: 'ArrowDown', shiftKey: true });
    expect(screen.getByText('вторник, 15 сентября, 10:15–11:00')).toBeInTheDocument();
    fireEvent.keyDown(block, { key: 'Enter' });
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0]).toMatchObject({ date: '2026-09-15', plannedStart: '10:15', plannedMinutes: 45, rescheduleCount: 1 });
  });
});

describe('useCalendarHotkeys', () => {
  function Probe({ onKey }: { onKey: (k: string) => void }) {
    useCalendarHotkeys(onKey);
    return <input aria-label="поле" />;
  }

  it('T, [, ], 1–3 — и молчит, пока печатают или открыто окно', () => {
    const onKey = vi.fn();
    render(<Probe onKey={onKey} />);
    fireEvent.keyDown(window, { code: 'KeyT', key: 'е' });
    fireEvent.keyDown(window, { code: 'BracketRight', key: 'ъ' });
    fireEvent.keyDown(window, { code: 'Digit2', key: '2' });
    expect(onKey.mock.calls.map(c => c[0])).toEqual(['today', 'next', 'week']);

    fireEvent.keyDown(screen.getByLabelText('поле'), { code: 'KeyT', key: 't' });
    fireEvent.keyDown(window, { code: 'KeyT', key: 't', metaKey: true });
    const pop = document.createElement('div');
    pop.dataset.overlay = 'popover';
    document.body.append(pop);
    fireEvent.keyDown(window, { code: 'BracketLeft', key: '[' });
    pop.remove();
    expect(onKey).toHaveBeenCalledTimes(3);
  });
});
