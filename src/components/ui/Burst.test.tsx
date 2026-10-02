import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Burst, EFFECTS_KEY, burst, effectsEnabled } from './Burst';

const canvases = () => document.body.querySelectorAll('canvas').length;

describe('праздничные эффекты', () => {
  beforeEach(() => {
    localStorage.removeItem(EFFECTS_KEY);
    // В jsdom нет 2d-контекста: залп создаёт холст и сразу останавливается — этого хватает для проверки.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });
  afterEach(() => {
    localStorage.removeItem(EFFECTS_KEY);
    vi.restoreAllMocks();
  });

  it('по умолчанию выключены: залп ничего не рисует', () => {
    expect(effectsEnabled()).toBe(false);
    burst({ x: 10, y: 10 });
    expect(canvases()).toBe(0);
  });

  it('<Burst fire> по умолчанию тоже ничего не рисует', () => {
    const { rerender } = render(<Burst fire={false} />);
    rerender(<Burst fire />);
    expect(canvases()).toBe(0);
  });

  it('включаются настройкой ikigai.effects = on', () => {
    localStorage.setItem(EFFECTS_KEY, 'on');
    expect(effectsEnabled()).toBe(true);
    burst({ x: 10, y: 10 });
    expect(canvases()).toBe(1);
  });

  it('любое другое значение — выключено', () => {
    localStorage.setItem(EFFECTS_KEY, 'off');
    expect(effectsEnabled()).toBe(false);
  });
});
