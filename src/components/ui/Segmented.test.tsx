import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Segmented } from './Segmented';

const OPTIONS = [
  { value: 'month', label: 'Месяц' },
  { value: 'week', label: 'Неделя' },
  { value: 'day', label: 'День', count: 3 },
] as const;

function Harness({ kind }: { kind?: 'radio' | 'tabs' }) {
  const [v, setV] = useState<'month' | 'week' | 'day'>('week');
  return <Segmented label="Вид" kind={kind} value={v} onChange={setV} options={[...OPTIONS]} />;
}

describe('Segmented', () => {
  it('is a radiogroup with one checked radio and a single tab stop', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Вид' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Неделя' })).toHaveAttribute('aria-checked', 'true');
    expect(radios.filter(r => r.tabIndex === 0)).toHaveLength(1);
  });

  it('selects on click', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'Месяц' }));
    expect(screen.getByRole('radio', { name: 'Месяц' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Неделя' })).toHaveAttribute('aria-checked', 'false');
  });

  it('moves and selects with arrows, wraps, and supports Home/End', () => {
    render(<Harness />);
    const week = screen.getByRole('radio', { name: 'Неделя' });
    week.focus();
    fireEvent.keyDown(week, { key: 'ArrowRight' });
    const day = screen.getByRole('radio', { name: /День/ });
    expect(day).toHaveAttribute('aria-checked', 'true');
    expect(day).toHaveFocus();
    fireEvent.keyDown(day, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Месяц' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Месяц' }), { key: 'End' });
    expect(screen.getByRole('radio', { name: /День/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(screen.getByRole('radio', { name: /День/ }), { key: 'Home' });
    expect(screen.getByRole('radio', { name: 'Месяц' })).toHaveAttribute('aria-checked', 'true');
  });

  it('renders counts', () => {
    render(<Harness />);
    expect(screen.getByRole('radio', { name: /День/ })).toHaveTextContent('3');
  });

  it('as tabs: tablist with aria-selected', () => {
    render(<Harness kind="tabs" />);
    expect(screen.getByRole('tablist', { name: 'Вид' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Неделя' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Месяц' }));
    expect(screen.getByRole('tab', { name: 'Месяц' })).toHaveAttribute('aria-selected', 'true');
  });
});
