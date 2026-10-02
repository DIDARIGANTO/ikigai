import type { HTMLAttributes, ReactNode } from 'react';
import type { Tone } from './tones';

export type CardVariant = 'raised' | 'tonal' | 'flat';

/**
 * Тон карточки — тонкая полоса 2 px сверху (внутренняя тень, без сдвига раскладки), только если тон
 * передан явно. Цвет задаётся переменной: строки целиком — чтобы сборщик их нашёл.
 */
const RULE: Record<Tone, string> = {
  neutral: '',
  accent: '[--card-rule:var(--color-accent)]',
  indigo: '[--card-rule:var(--color-indigo)]',
  mint: '[--card-rule:var(--color-mint)]',
  rose: '[--card-rule:var(--color-rose)]',
  amber: '[--card-rule:var(--color-amber)]',
  lilac: '[--card-rule:var(--color-lilac)]',
  sky: '[--card-rule:var(--color-sky)]',
  lime: '[--card-rule:var(--color-lime)]',
  coral: '[--card-rule:var(--color-coral)]',
  sun: '[--card-rule:var(--color-sun)]',
  danger: '[--card-rule:var(--color-danger)]',
};

/**
 * Карточка «Графита»: поверхность, линия 1 px, радиус 4. Все варианты — одна поверхность:
 * `raised` и `tonal` — с тенью темы (в тёмной — только внутренний блик), `flat` — без тени,
 * для вложенных блоков. `tone` фон не красит: это полоса 2 px сверху.
 */
// oxlint-disable-next-line react/only-export-components -- классы нужны и там, где карточка — не <section>
export function cardClass({
  variant = 'raised',
  tone,
  interactive = false,
}: { variant?: CardVariant; tone?: Tone; interactive?: boolean } = {}): string {
  const rule = tone ? RULE[tone] : '';
  const shadow = rule
    ? variant === 'flat'
      ? 'shadow-[inset_0_2px_0_var(--card-rule)]'
      : 'shadow-[inset_0_2px_0_var(--card-rule),var(--shadow-raised)]'
    : variant === 'flat'
      ? ''
      : 'shadow-(--shadow-raised)';
  const hover = interactive ? 'transition-colors duration-(--duration-base) ease-out-soft hover:border-border-strong' : '';
  return `rounded-card border border-border bg-surface ${rule} ${shadow} ${hover}`;
}

export function Card({
  className = '',
  as: Tag = 'section',
  variant = 'raised',
  tone,
  interactive = false,
  ...p
}: HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'div' | 'article' | 'aside';
  variant?: CardVariant;
  tone?: Tone;
  /** Отзывается на наведение (линия плотнее) — для карточек, по которым кликают. */
  interactive?: boolean;
}) {
  return <Tag className={`${cardClass({ variant, tone, interactive })} ${className}`} {...p} />;
}

/** Шапка карточки: приглушённая иконка 16 px, заголовок раздела 14 px, справа — действие. */
export function CardHeader({
  title,
  icon,
  action,
  meta,
  tone: _tone = 'accent',
  className = '',
}: {
  title: ReactNode;
  icon?: ReactNode;
  /** Оставлен для совместимости: иконка шапки всегда нейтральная. */
  tone?: Tone;
  action?: ReactNode;
  /** Короткая подпись рядом с заголовком: счётчик, время. */
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-h-8 items-center gap-2 ${className}`}>
      {icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0 items-center text-muted [&_svg]:size-4">
          {icon}
        </span>
      ) : null}
      <h2 className="min-w-0 truncate text-title font-semibold text-text">{title}</h2>
      {meta ? <span className="shrink-0 font-numeral text-caption text-muted">{meta}</span> : null}
      {action ? <div className="ml-auto flex shrink-0 items-center gap-1">{action}</div> : null}
    </div>
  );
}
