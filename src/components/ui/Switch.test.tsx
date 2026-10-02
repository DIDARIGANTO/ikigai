import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Switch } from './Switch';

function Harness({ label }: { label?: string }) {
  const [on, setOn] = useState(false);
  return <Switch checked={on} onChange={setOn} label={label} aria-label={label ? undefined : 'Скрыть исполненные'} />;
}

describe('Switch', () => {
  it('is a switch that toggles aria-checked on click', () => {
    render(<Harness />);
    const sw = screen.getByRole('switch', { name: 'Скрыть исполненные' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('with a visible label: named by it, and clicking the label toggles', () => {
    render(<Harness label="Закрепить в меню" />);
    const sw = screen.getByRole('switch', { name: 'Закрепить в меню' });
    fireEvent.click(screen.getByText('Закрепить в меню'));
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('does nothing when disabled', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} aria-label="Тумблер" disabled />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
