import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';
import type { ToastOptions } from './Toast';

function Trigger({ text, options }: { text: string; options?: ToastOptions }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast(text, options)}>
      показать
    </button>
  );
}

function setup(text: string, options?: ToastOptions) {
  render(
    <ToastProvider>
      <Trigger text={text} options={options} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'показать' }));
}

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('announces politely and disappears after the default 3 s', () => {
    setup('Сохранено');
    expect(screen.getByRole('status')).toHaveTextContent('Сохранено');
    expect(screen.getByRole('status').closest('[aria-live="polite"]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(3100));
    expect(screen.queryByText('Сохранено')).not.toBeInTheDocument();
  });

  it('runs the action (Undo) and closes', () => {
    const undo = vi.fn();
    setup('Задача удалена', { action: { label: 'Отменить', onClick: undo } });
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Задача удалена')).not.toBeInTheDocument();
  });

  it('lives longer with an action and pauses while hovered', () => {
    setup('Задача удалена', { action: { label: 'Отменить', onClick: () => {} } });
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText('Задача удалена')).toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByRole('status'));
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText('Задача удалена')).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByRole('status'));
    act(() => vi.advanceTimersByTime(2100));
    expect(screen.queryByText('Задача удалена')).not.toBeInTheDocument();
  });

  it('respects a custom duration and uses role=alert for errors', () => {
    setup('Не удалось', { kind: 'error', duration: 1000 });
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось');
    act(() => vi.advanceTimersByTime(1100));
    expect(screen.queryByText('Не удалось')).not.toBeInTheDocument();
  });

  it('can be dismissed by hand', () => {
    setup('Сохранено');
    fireEvent.click(screen.getByRole('button', { name: 'Скрыть уведомление' }));
    expect(screen.queryByText('Сохранено')).not.toBeInTheDocument();
  });
});
