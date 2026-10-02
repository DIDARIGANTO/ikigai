import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { SEMANTIC_TONES, TONES } from './tones';
import type { Tone } from './tones';

/**
 * Чип — короткая метка (категория, горизонт, статус): высота 20/22, радиус 2, нейтральный контур.
 * Декоративный тон — точка 6 px перед подписью (если нет `icon`; переданная иконка — приглушённая).
 * Семантический тон (accent, danger) — тональная подложка.
 * С `onClick` становится кнопкой; `selected` — фильтр (aria-pressed): выбранный — плотная нейтральная заливка.
 */
export function Chip({
  tone = 'neutral',
  icon,
  size = 'md',
  selected,
  onClick,
  className = '',
  children,
  ...p
}: {
  tone?: Tone;
  icon?: ReactNode;
  size?: 'sm' | 'md';
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'className' | 'children'>) {
  const t = TONES[tone];
  const semantic = SEMANTIC_TONES.has(tone);
  const sizing = size === 'sm' ? 'h-5 gap-1 px-1.5 text-micro' : 'h-5.5 gap-1.5 px-2 text-caption';
  const base = `inline-flex shrink-0 items-center rounded-chip border font-medium whitespace-nowrap ${sizing}`;
  const neutral = 'border-border bg-transparent text-muted-strong';
  const tinted = `border-transparent ${t.soft} ${t.strong}`;
  const lead = icon ? (
    <span aria-hidden="true" className={`inline-flex shrink-0 [&_svg]:size-3 ${semantic ? '' : 'text-muted'}`}>
      {icon}
    </span>
  ) : tone !== 'neutral' && !semantic ? (
    <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-mark ${t.solid}`} />
  ) : null;

  if (!onClick) {
    return (
      <span title={p.title} className={`${base} ${semantic ? tinted : neutral} ${className}`}>
        {lead}
        {children}
      </span>
    );
  }
  const look =
    selected === undefined
      ? semantic
        ? `${tinted} hover:brightness-95 dark:hover:brightness-125`
        : `${neutral} hover:bg-fill hover:text-text`
      : selected
        ? 'border-border-strong bg-fill-strong text-text'
        : `${neutral} hover:bg-fill hover:text-text`;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`${base} focus-ring press relative pointer-coarse:before:absolute pointer-coarse:before:-inset-y-3 pointer-coarse:before:inset-x-0 pointer-coarse:before:content-[''] ${look} ${className}`}
      {...p}
    >
      {lead}
      {children}
    </button>
  );
}

/** Счётчик-бейдж: число в маленькой нейтральной плашке, моноширинные цифры. */
export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const look = SEMANTIC_TONES.has(tone) ? `${TONES[tone].soft} ${TONES[tone].strong}` : 'bg-fill-strong text-muted-strong';
  return (
    <span
      className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-chip px-1.5 font-mono text-micro font-medium tabular-nums ${look} ${className}`}
    >
      {children}
    </span>
  );
}
