import { SEMANTIC_TONES, TONES } from './tones';
import type { Tone } from './tones';

/**
 * Полоса прогресса «Графита»: тонкая дорожка 3–4 px и заливка акцентом (150–220 мс, без пружины).
 * Цвет несёт смысл: декоративные тона сводятся к акценту, нейтральный и семантические сохраняются.
 */
export function ProgressBar({
  value,
  label,
  tone = 'accent',
  size = 'md',
  className = '',
}: {
  value: number;
  /** Что именно измеряет полоса — иначе скринридер прочитает только проценты. */
  label?: string;
  tone?: Tone;
  /** sm и md — 3 px (в строках и карточках), lg — 4 px (крупный итог). */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const h = { sm: 'h-0.75', md: 'h-0.75', lg: 'h-1' }[size];
  const fill = tone === 'neutral' || SEMANTIC_TONES.has(tone) ? TONES[tone].solid : TONES.accent.solid;
  return (
    <div
      className={`${h} bg-fill-strong rounded-bar overflow-hidden ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-bar transition-[width] duration-(--duration-slow) ease-out-soft ${fill}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
