import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { StylePicker } from './StylePicker';
import { resetStyleCache, STYLE_KEY, STYLES } from '@/app/style';

describe('StylePicker', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStyleCache();
    delete document.documentElement.dataset.style;
    delete document.documentElement.dataset.theme;
  });

  it('is a labelled group of five radios, «Сигнал» chosen by default', () => {
    render(<StylePicker />);
    const group = screen.getByRole('group', { name: 'Стиль оформления' });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(5);
    expect(radios.map(r => (r as HTMLInputElement).value)).toEqual(STYLES.map(s => s.id));
    expect(radios[0]).toBeChecked();
    expect(screen.getByRole('radio', { name: /^Хардкор/ })).not.toBeChecked();
  });

  it('shows the name and the one-line hint of every style', () => {
    render(<StylePicker />);
    for (const s of STYLES) {
      expect(screen.getByText(s.name)).toBeInTheDocument();
      expect(screen.getByText(s.hint)).toBeInTheDocument();
    }
  });

  it('choosing a style applies it to the page and remembers it', () => {
    render(<StylePicker />);
    fireEvent.click(screen.getByRole('radio', { name: /^Крафт/ }));
    expect(document.documentElement.dataset.style).toBe('craft');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(STYLE_KEY)).toBe('craft');
    expect(screen.getByRole('radio', { name: /^Крафт/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^Сигнал/ })).not.toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: /^Графит/ }));
    expect(document.documentElement.dataset.style).toBe('graphite');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('previews are drawn on the style’s own tokens', () => {
    const { container } = render(<StylePicker />);
    const scopes = Array.from(container.querySelectorAll('[data-style]')).map(el => el.getAttribute('data-style'));
    expect(scopes).toEqual(STYLES.map(s => s.id));
  });

  it('compact variant drops the hints but keeps all five', () => {
    render(<StylePicker compact />);
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(screen.queryByText(STYLES[0].hint)).not.toBeInTheDocument();
  });
});
