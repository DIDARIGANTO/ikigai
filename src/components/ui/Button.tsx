import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger' | 'danger-quiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Кнопки «Сигнала»: радиус 2, без свечения и пилюль.
 * `primary` — монохромная, как главная кнопка S.A.T (бумага на чернилах в тёмной теме, чернила на бумаге в светлой), одно главное действие на экране;
 * `secondary` — поверхность и линия; `tonal` — нейтральная заливка; `ghost` — без фона;
 * `danger` — только для подтверждения необратимого: сплошная заливка и белый текст (≥ 4.5:1);
 * `danger-quiet` — «Удалить» в углу редактора, где главное — сохранить.
 * Акцентный цвет — не для заливки кнопок: он для фокуса, выбранного и прогресса.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:opacity-90',
  secondary: 'bg-surface text-text border border-border-strong hover:bg-fill',
  tonal: 'bg-fill text-text hover:bg-fill-strong',
  ghost: 'text-muted-strong hover:text-text hover:bg-fill',
  danger: 'bg-danger text-white hover:opacity-90',
  'danger-quiet': 'text-danger-strong hover:bg-danger/10',
};

/** sm — 32 px (строки списков, панели), md — 36 px (по умолчанию), lg — 40 px (главное действие формы). */
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-small gap-1.5',
  md: 'h-9 px-3 text-body gap-1.5',
  lg: 'h-10 px-4 text-body gap-1.5',
};

const BASE =
  'focus-ring press btn-text rounded-control inline-flex items-center justify-center font-medium whitespace-nowrap select-none [&_svg]:shrink-0 disabled:opacity-40 disabled:pointer-events-none';

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(function Button({ variant = 'secondary', size = 'md', className = '', type = 'button', ...p }, ref) {
  return <button ref={ref} type={type} className={`${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`} {...p} />;
});

const ICON_SIZES: Record<ButtonSize, string> = {
  // Невидимое расширение до 44 px на сенсорных экранах — без сдвига раскладки.
  sm: 'h-8 w-8 pointer-coarse:before:-inset-1.5',
  md: 'h-9 w-9 pointer-coarse:before:-inset-1',
  lg: 'h-10 w-10 pointer-coarse:before:-inset-0.5',
};

const ICON_VARIANTS: Record<'ghost' | 'tonal' | 'primary' | 'secondary', string> = {
  ghost: 'text-muted hover:text-text hover:bg-fill',
  tonal: 'bg-fill text-muted-strong hover:text-text hover:bg-fill-strong',
  primary: 'bg-primary text-on-primary hover:opacity-90',
  secondary: 'bg-surface text-muted-strong border border-border-strong hover:text-text hover:bg-fill',
};

/** Квадратная кнопка-иконка (радиус 2). Требует aria-label. Иконка — 16 px (sm, md) или 20 px (lg). */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { size?: ButtonSize; variant?: keyof typeof ICON_VARIANTS }
>(function IconButton({ size = 'md', variant = 'ghost', className = '', type = 'button', ...p }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${ICON_SIZES[size]} relative shrink-0 rounded-control inline-flex items-center justify-center [&_svg]:shrink-0 disabled:opacity-40 disabled:pointer-events-none pointer-coarse:before:absolute pointer-coarse:before:content-[''] focus-ring press ${ICON_VARIANTS[variant]} ${className}`}
      {...p}
    />
  );
});
