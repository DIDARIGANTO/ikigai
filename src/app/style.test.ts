import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  applyStyle,
  DEFAULT_STYLE,
  isStyleId,
  nextStyle,
  readStyle,
  resetStyleCache,
  setStyle,
  STYLE_KEY,
  STYLES,
  styleDef,
  writeStyle,
} from './style';

function mockSystemDark(dark: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: dark && query.includes('dark'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('style', () => {
  const realMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    resetStyleCache();
    delete document.documentElement.dataset.style;
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = '';
  });

  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  it('knows five styles in the agreed order, each with a scheme', () => {
    expect(STYLES.map(s => s.id)).toEqual(['signal', 'graphite', 'light', 'craft', 'hardcore']);
    expect(STYLES.map(s => s.scheme)).toEqual(['dark', 'dark', 'light', 'light', 'dark']);
    expect(new Set(STYLES.map(s => s.name)).size).toBe(5);
  });

  it('defaults to «Сигнал» and ignores junk in storage', () => {
    expect(DEFAULT_STYLE).toBe('signal');
    expect(readStyle()).toBe('signal');
    localStorage.setItem(STYLE_KEY, 'purple');
    expect(readStyle()).toBe('signal');
    expect(isStyleId('craft')).toBe(true);
    expect(isStyleId('purple')).toBe(false);
    expect(isStyleId(undefined)).toBe(false);
  });

  it('persists every style', () => {
    for (const s of STYLES) {
      writeStyle(s.id);
      expect(localStorage.getItem(STYLE_KEY)).toBe(s.id);
      expect(readStyle()).toBe(s.id);
    }
  });

  it('carries over the old theme choice while there is no style yet', () => {
    localStorage.setItem('ikigai.theme', 'light');
    expect(readStyle()).toBe('light');
    localStorage.setItem('ikigai.theme', 'dark');
    expect(readStyle()).toBe('signal');
    mockSystemDark(true);
    localStorage.setItem('ikigai.theme', 'system');
    expect(readStyle()).toBe('signal');
    mockSystemDark(false);
    expect(readStyle()).toBe('light');
    // чтение ничего не записывает
    expect(localStorage.getItem(STYLE_KEY)).toBeNull();
  });

  it('a saved style wins over the old theme', () => {
    localStorage.setItem('ikigai.theme', 'light');
    localStorage.setItem(STYLE_KEY, 'hardcore');
    expect(readStyle()).toBe('hardcore');
  });

  it('applies data-style, data-theme, color-scheme and theme-color', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
    document.documentElement.style.setProperty('--color-canvas', '#12111A');
    applyStyle('craft');
    expect(document.documentElement.dataset.style).toBe('craft');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(meta.content.toLowerCase()).toBe('#12111a');
    // стили ещё не загружены (в тесте их нет) — берётся холст образа из реестра
    document.documentElement.style.removeProperty('--color-canvas');
    applyStyle('hardcore');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(meta.content).toBe(styleDef('hardcore').canvas);
    meta.remove();
  });

  it('setStyle persists and applies at once', () => {
    setStyle('graphite');
    expect(localStorage.getItem(STYLE_KEY)).toBe('graphite');
    expect(document.documentElement.dataset.style).toBe('graphite');
    expect(document.documentElement.dataset.theme).toBe('dark');
    setStyle('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('nextStyle walks all five and wraps around', () => {
    let id = STYLES[0].id;
    const seen = [id];
    for (let i = 0; i < STYLES.length; i++) {
      id = nextStyle(id);
      seen.push(id);
    }
    expect(seen).toEqual(['signal', 'graphite', 'light', 'craft', 'hardcore', 'signal']);
  });

  it('survives storage that throws', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readStyle()).toBe(DEFAULT_STYLE);
    expect(() => writeStyle('craft')).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });
});
