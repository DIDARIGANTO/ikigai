import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/Toast';
import { ShellActionsProvider } from '@/app/ShellActions';
import { useGlobalHotkeys } from '@/app/useGlobalHotkeys';

function Hotkeys() {
  useGlobalHotkeys();
  return <input aria-label="поле" />;
}

function setup() {
  const openSearch = vi.fn();
  const openQuick = vi.fn();
  render(
    <MemoryRouter>
      <ToastProvider>
        <ShellActionsProvider value={{ openSearch, openQuick }}>
          <Hotkeys />
        </ShellActionsProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
  return { openSearch, openQuick };
}

describe('⌘K / Ctrl+K открывает палитру', () => {
  it('⌘K и Ctrl+K — открыть', () => {
    const { openSearch } = setup();
    fireEvent.keyDown(window, { key: 'k', code: 'KeyK', metaKey: true });
    fireEvent.keyDown(window, { key: 'k', code: 'KeyK', ctrlKey: true });
    expect(openSearch).toHaveBeenCalledTimes(2);
  });

  it('работает в русской раскладке и из поля ввода', () => {
    const { openSearch } = setup();
    const input = screen.getByLabelText('поле');
    input.focus();
    fireEvent.keyDown(input, { key: 'л', code: 'KeyK', ctrlKey: true });
    expect(openSearch).toHaveBeenCalledTimes(1);
  });

  it('без модификатора K ничего не делает, «/» по-прежнему открывает поиск', () => {
    const { openSearch, openQuick } = setup();
    fireEvent.keyDown(window, { key: 'k', code: 'KeyK' });
    expect(openSearch).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: '/', code: 'Slash' });
    expect(openSearch).toHaveBeenCalledTimes(1);
    expect(openQuick).not.toHaveBeenCalled();
  });

  it('молчит, пока открыт диалог', () => {
    const { openSearch } = setup();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const btn = document.createElement('button');
    dialog.appendChild(btn);
    document.body.appendChild(dialog);
    btn.focus();
    fireEvent.keyDown(btn, { key: 'k', code: 'KeyK', metaKey: true });
    expect(openSearch).not.toHaveBeenCalled();
    dialog.remove();
  });
});
