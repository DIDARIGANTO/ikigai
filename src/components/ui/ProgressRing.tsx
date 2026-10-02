import type { ReactNode } from 'react';

/** «Графит»: один акцент — тона оставлены для совместимости и рисуются акцентом. */
const STROKES = {
  accent: 'stroke-accent',
  mint: 'stroke-accent',
  rose: 'stroke-accent',
  amber: 'stroke-accent',
  lilac: 'stroke-accent',
  sky: 'stroke-accent',
} as const;

/**
 * Кольцо прогресса: дуга акцентом 2–3 px на дорожке цвета линии.
 * В центр можно положить подпись (`children`), иначе — проценты моноширинными цифрами.
 */
export function ProgressRing({
  value,
  size = 48,
  stroke,
  label,
  tone = 'accent',
  children,
  className = '',
}: {
  /** Доля от 0 до 1. */
  value: number;
  size?: number;
  stroke?: number;
  /** Что измеряет кольцо — для скринридера. */
  label?: string;
  tone?: keyof typeof STROKES;
  children?: ReactNode;
  className?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const width = stroke ?? (size >= 40 ? 3 : 2);
  const r = (size - width) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={width} className="stroke-border-strong" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={width}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className={`${STROKES[tone]} transition-[stroke-dashoffset] duration-(--duration-slow) ease-out-soft`}
          style={pct === 0 ? { opacity: 0 } : undefined}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-mono font-medium tabular-nums text-text ${
          size >= 44 ? 'text-caption' : 'text-micro'
        }`}
      >
        {children ?? `${pct}%`}
      </span>
    </div>
  );
}
