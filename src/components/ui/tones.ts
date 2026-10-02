/**
 * Тона палитры как готовые классы Tailwind (строки целиком — чтобы сборщик их нашёл).
 * «Графит»: цвет — это смысл, а не украшение. Декоративные тона (indigo … sun) показываются
 * точкой 6 px или полосой 2 px (`solid`), а не заливкой; `soft` — едва заметный тон,
 * `strong` — текст и иконка (≥ 4.5:1). Семантические тона (accent, danger) могут иметь
 * тональную подложку.
 */
export type Tone =
  | 'neutral'
  | 'accent'
  | 'indigo'
  | 'mint'
  | 'rose'
  | 'amber'
  | 'lilac'
  | 'sky'
  | 'lime'
  | 'coral'
  | 'sun'
  | 'danger';

export interface ToneClasses {
  soft: string;
  strong: string;
  solid: string;
}

export const TONES: Record<Tone, ToneClasses> = {
  neutral: { soft: 'bg-fill', strong: 'text-muted-strong', solid: 'bg-muted' },
  accent: { soft: 'bg-accent-soft', strong: 'text-accent-strong', solid: 'bg-accent' },
  indigo: { soft: 'bg-indigo-soft', strong: 'text-indigo-strong', solid: 'bg-indigo' },
  mint: { soft: 'bg-mint-soft', strong: 'text-mint-strong', solid: 'bg-mint' },
  rose: { soft: 'bg-rose-soft', strong: 'text-rose-strong', solid: 'bg-rose' },
  amber: { soft: 'bg-amber-soft', strong: 'text-amber-strong', solid: 'bg-amber' },
  lilac: { soft: 'bg-lilac-soft', strong: 'text-lilac-strong', solid: 'bg-lilac' },
  sky: { soft: 'bg-sky-soft', strong: 'text-sky-strong', solid: 'bg-sky' },
  lime: { soft: 'bg-lime-soft', strong: 'text-lime-strong', solid: 'bg-lime' },
  coral: { soft: 'bg-coral-soft', strong: 'text-coral-strong', solid: 'bg-coral' },
  sun: { soft: 'bg-sun-soft', strong: 'text-sun-strong', solid: 'bg-sun' },
  danger: { soft: 'bg-danger-soft', strong: 'text-danger-strong', solid: 'bg-danger' },
};

/** Тона со смыслом (выбор, статус): им можно тональную подложку. Остальные — точка или полоса. */
export const SEMANTIC_TONES: ReadonlySet<Tone> = new Set<Tone>(['accent', 'danger']);

/** Декоративный тон: цвет только точкой 6 px / полосой 2 px, без заливки. */
export const isDecorativeTone = (tone: Tone): boolean => tone !== 'neutral' && !SEMANTIC_TONES.has(tone);

/** Тона для пользовательских меток (точки, полосы): по порядку, без нейтрального и семантических. */
export const PLAYFUL_TONES: Tone[] = ['indigo', 'mint', 'rose', 'amber', 'lilac', 'sky', 'lime', 'coral', 'sun'];

/** Стабильный тон по строке (id, название): одна и та же метка всегда одного цвета. */
export function toneFor(seed: string | undefined): Tone {
  if (!seed) return 'neutral';
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return PLAYFUL_TONES[Math.abs(h) % PLAYFUL_TONES.length];
}
