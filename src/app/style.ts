import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * Стиль оформления — один из пяти готовых образов (docs/design/2026-10-02-styles.md). Выбор человека хранится
 * в localStorage; на <html> лежат `data-style` (образ: от него зависят токены в globals.css) и
 * `data-theme="light|dark"` (цветовая схема образа: нужна нативным элементам и вариантам `dark:`).
 * Тот же алгоритм повторён во встроенном скрипте index.html — он ставит образ до первой отрисовки, без вспышки.
 */
export type StyleId = 'signal' | 'graphite' | 'light' | 'craft' | 'hardcore';
export type Scheme = 'light' | 'dark';

export interface StyleDef {
  id: StyleId;
  name: string;
  /** Одна строка о характере образа — в карточке выбора. */
  hint: string;
  scheme: Scheme;
  /** Цвет холста (`--color-canvas`): метатег theme-color до загрузки стилей. Тест сверяет его с globals.css и index.html. */
  canvas: string;
}

/** Порядок — как в Настройках и при переборе кнопкой в меню. */
export const STYLES: readonly StyleDef[] = [
  { id: 'signal', name: 'Сигнал', hint: 'Чернила, бумага и лайм — как сайт S.A.T. Острые углы.', scheme: 'dark', canvas: '#080909' },
  { id: 'graphite', name: 'Графит', hint: 'Спокойный тёмный: графит и индиго. Как было раньше.', scheme: 'dark', canvas: '#0E0F11' },
  { id: 'light', name: 'Светлый', hint: 'Белая страница, чернила и лаймовый маркер.', scheme: 'light', canvas: '#F4F4F2' },
  { id: 'craft', name: 'Крафт', hint: 'Тёплая бумага, терракота, антиква и зерно — мастерская.', scheme: 'light', canvas: '#F4EDE0' },
  { id: 'hardcore', name: 'Хардкор', hint: 'Чёрное и жёлтое, моноширинный шрифт, жёсткие тени.', scheme: 'dark', canvas: '#000000' },
];

export const STYLE_KEY = 'ikigai.style';
/** Прежняя настройка «Тема» (светлая / как в системе / тёмная) — из неё переносим выбор, пока нового нет. */
const LEGACY_THEME_KEY = 'ikigai.theme';
export const DEFAULT_STYLE: StyleId = 'signal';
const DARK_QUERY = '(prefers-color-scheme: dark)';

const BY_ID = new Map<string, StyleDef>(STYLES.map(s => [s.id, s]));

export function isStyleId(v: unknown): v is StyleId {
  return typeof v === 'string' && BY_ID.has(v);
}

export function styleDef(id: StyleId): StyleDef {
  return BY_ID.get(id) as StyleDef;
}

/** Следующий образ по кругу. */
export function nextStyle(id: StyleId): StyleId {
  const i = STYLES.findIndex(s => s.id === id);
  return STYLES[(i + 1) % STYLES.length].id;
}

function systemPrefersDark(): boolean {
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

/**
 * Сохранённый выбор. Нет его — переносим старую «Тему»: светлая → «Светлый», «как в системе» — по системе
 * (светлая → «Светлый»), всё остальное — «Сигнал». В хранилище при этом ничего не пишем.
 */
export function readStyle(): StyleId {
  try {
    const v = localStorage.getItem(STYLE_KEY);
    if (isStyleId(v)) return v;
    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === 'light' || (legacy === 'system' && !systemPrefersDark())) return 'light';
  } catch {
    /* хранилище закрыто — берём образ по умолчанию */
  }
  return DEFAULT_STYLE;
}

export function writeStyle(id: StyleId) {
  try {
    localStorage.setItem(STYLE_KEY, id);
  } catch {
    /* приватный режим — выбор просто не запомнится */
  }
}

/** Ставит образ на <html>: атрибуты для токенов, color-scheme для нативных элементов и цвет строки состояния. */
export function applyStyle(id: StyleId, root: HTMLElement = document.documentElement) {
  const def = styleDef(id);
  root.dataset.style = id;
  root.dataset.theme = def.scheme;
  root.style.colorScheme = def.scheme;
  // Цвет полосы браузера — холст выбранного образа (метатегов два: для светлой и тёмной системы).
  const canvas = getComputedStyle(root).getPropertyValue('--color-canvas').trim() || def.canvas;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => {
    meta.content = canvas;
  });
}

// Маленькое внешнее хранилище: переключатели в меню и в настройках видят один и тот же выбор.
const listeners = new Set<() => void>();
let current: StyleId | null = null;

function getStyleSnapshot(): StyleId {
  if (current === null) current = readStyle();
  return current;
}

export function setStyle(id: StyleId) {
  current = id;
  writeStyle(id);
  applyStyle(id);
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Выбранный образ и функция смены. Следит за другими вкладками: выбрали там — здесь тоже поменяется. */
export function useStyle(): [StyleId, (id: StyleId) => void] {
  const style = useSyncExternalStore(subscribe, getStyleSnapshot, () => DEFAULT_STYLE);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STYLE_KEY && e.key !== null) return;
      current = readStyle();
      applyStyle(current);
      listeners.forEach(l => l());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const set = useCallback((next: StyleId) => setStyle(next), []);
  return [style, set];
}

/** Только для тестов: сбросить закэшированный выбор. */
export function resetStyleCache() {
  current = null;
}
