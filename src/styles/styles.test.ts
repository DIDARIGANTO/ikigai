import { describe, it, expect } from 'vitest';
import css from './globals.css?raw';
import indexHtml from '../../index.html?raw';
import { STYLES } from '@/app/style';

/** Токены каждого образа из globals.css: id → { имя переменной → значение }. «Сигнал» живёт в блоке `:root, [data-style="signal"]`. */
function parseBlocks(source: string): Map<string, Map<string, string>> {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = new Map<string, Map<string, string>>();
  const re = /(?:^|\n)\s*((?::root, )?\[data-style="([a-z]+)"\])\s*\{([^{}]*)\}/g;
  for (const m of clean.matchAll(re)) {
    const id = m[2];
    const vars = out.get(id) ?? new Map<string, string>();
    for (const decl of m[3].split(';')) {
      const i = decl.indexOf(':');
      if (i < 0) continue;
      const name = decl.slice(0, i).trim();
      if (name.startsWith('--')) vars.set(name, decl.slice(i + 1).trim());
    }
    out.set(id, vars);
  }
  return out;
}

/** Значения `@theme { … }` (вложенный @keyframes отбрасываем). */
function parseTheme(source: string): Map<string, string> {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const start = clean.indexOf('@theme {');
  let depth = 0;
  let end = start;
  for (let i = clean.indexOf('{', start); i < clean.length; i++) {
    if (clean[i] === '{') depth++;
    else if (clean[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  const body = clean.slice(clean.indexOf('{', start) + 1, end).replace(/@keyframes[^{]*\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, '');
  const vars = new Map<string, string>();
  for (const decl of body.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const name = decl.slice(0, i).trim();
    if (name.startsWith('--')) vars.set(name, decl.slice(i + 1).trim());
  }
  return vars;
}

const blocks = parseBlocks(css);
const theme = parseTheme(css);

const isHex = (v: string | undefined): v is string => !!v && /^#[0-9a-fA-F]{6}$/.test(v);

function luminance(hex: string): number {
  const ch = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('style tokens (globals.css)', () => {
  it('has one block per style', () => {
    expect([...blocks.keys()].sort()).toEqual(STYLES.map(s => s.id).sort());
  });

  it('every style defines exactly the same tokens as «Сигнал» (nothing missing, nothing extra)', () => {
    // Размеры текста и длительности переопределяют только «Крафт» и «Хардкор»: они лежат в отдельных блоках с тем же селектором.
    const own = (id: string) => [...(blocks.get(id)?.keys() ?? [])].filter(k => !k.startsWith('--text-') && !k.startsWith('--duration-')).sort();
    const base = own('signal');
    expect(base.length).toBeGreaterThan(90);
    for (const s of STYLES) {
      expect(own(s.id), `в образе «${s.name}» набор токенов расходится с «Сигналом»`).toEqual(base);
    }
  });

  it('@theme repeats the «Сигнал» values (they are the fallback before any style is applied)', () => {
    const signal = blocks.get('signal')!;
    let compared = 0;
    for (const [name, value] of signal) {
      if (!theme.has(name)) continue; // параметры (--fill-pct …) и характер живут только в блоках
      expect(theme.get(name), name).toBe(value);
      compared++;
    }
    expect(compared).toBeGreaterThan(60);
  });

  it('canvas colours match the registry in style.ts', () => {
    for (const s of STYLES) {
      expect(blocks.get(s.id)?.get('--color-canvas')?.toLowerCase(), s.name).toBe(s.canvas.toLowerCase());
    }
  });

  it('index.html boots the same schemes and canvases as the registry', () => {
    for (const s of STYLES) {
      const m = new RegExp(`${s.id}:\\s*\\['(light|dark)',\\s*'(#[0-9A-Fa-f]{6})'\\]`).exec(indexHtml);
      expect(m, `в index.html нет образа ${s.id}`).not.toBeNull();
      expect(m![1], s.name).toBe(s.scheme);
      expect(m![2].toLowerCase(), s.name).toBe(s.canvas.toLowerCase());
    }
  });

  describe.each(STYLES.map(s => [s.name, s.id] as const))('«%s»: контраст', (_name, id) => {
    const t = blocks.get(id)!;
    const get = (k: string) => {
      const v = t.get(`--color-${k}`);
      expect(isHex(v), `--color-${k} должен быть #RRGGBB, а он ${v}`).toBe(true);
      return v as string;
    };
    const surfaces = ['canvas', 'panel', 'surface', 'raised', 'overlay'];

    it('основной и вторичный текст ≥ 4.5:1 на каждой поверхности', () => {
      for (const surf of surfaces) {
        for (const ink of ['text', 'muted-strong', 'muted']) {
          expect(contrast(get(ink), get(surf)), `${ink} на ${surf}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it('граница полей ≥ 3:1 к карточке и холсту', () => {
      for (const surf of ['canvas', 'surface']) {
        expect(contrast(get('control-border'), get(surf)), `control-border на ${surf}`).toBeGreaterThanOrEqual(3);
      }
    });

    it('акцент: кольцо фокуса ≥ 3:1 к холсту и карточке, текст на акценте и на главной кнопке ≥ 4.5:1', () => {
      expect(contrast(get('accent'), get('canvas'))).toBeGreaterThanOrEqual(3);
      expect(contrast(get('accent'), get('surface'))).toBeGreaterThanOrEqual(3);
      expect(contrast(get('on-accent'), get('accent'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(get('on-primary'), get('primary'))).toBeGreaterThanOrEqual(4.5);
    });

    it('выделение текста читается', () => {
      const bg = t.get('--color-selection');
      const fg = t.get('--color-on-selection');
      if (isHex(bg) && isHex(fg)) expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });

    it('опасность: белый текст на заливке ≥ 4.5:1, текст «danger-strong» на поверхностях ≥ 4.5:1', () => {
      expect(contrast('#FFFFFF', get('danger'))).toBeGreaterThanOrEqual(4.5);
      for (const surf of ['canvas', 'surface', 'raised']) {
        for (const ink of ['danger-strong', 'important-strong', 'success-strong', 'warning-strong']) {
          expect(contrast(get(ink), get(surf)), `${ink} на ${surf}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it('метки-оттенки (точка, полоса) ≥ 3:1 к холсту и карточке', () => {
      for (const hue of ['indigo', 'mint', 'rose', 'amber', 'lilac', 'sky', 'lime', 'coral', 'sun']) {
        for (const surf of ['canvas', 'surface']) {
          expect(contrast(get(hue), get(surf)), `${hue} на ${surf}`).toBeGreaterThanOrEqual(3);
        }
      }
    });
  });
});
