import type { ReactNode } from 'react';
import type { Tone } from './tones';

export type TileSize = 32 | 40 | 48 | 64;

/** Нейтральный квадрат под иконкой: радиус 2, линия 1 px; иконка 16 px (20 px в крупных). */
const BOX: Record<TileSize, string> = {
  32: 'h-8 w-8 [&_svg]:size-4',
  40: 'h-10 w-10 [&_svg]:size-4',
  48: 'h-12 w-12 [&_svg]:size-5',
  64: 'h-16 w-16 [&_svg]:size-5',
};

/** Эмодзи — просто символ в строке, без подложки: 16 px, в крупных местах 18 px. */
const EMOJI: Record<TileSize, string> = {
  32: 'size-5 text-base',
  40: 'size-5 text-base',
  48: 'size-6 text-lg',
  64: 'size-6 text-lg',
};

/**
 * Плитка (задача, цель, мечта, список). «Графит»: без цветной подложки.
 * Эмодзи, выбранное человеком, — просто символ в строке; без эмодзи — иконка раздела
 * в нейтральном квадрате с линией. `tone` оставлен для совместимости и фон не красит.
 */
export function Tile({
  emoji,
  icon,
  tone: _tone = 'neutral',
  size = 40,
  label,
  className = '',
}: {
  emoji?: string;
  icon?: ReactNode;
  tone?: Tone;
  size?: TileSize;
  /** Подпись для скринридера; без неё плитка декоративная. */
  label?: string;
  className?: string;
}) {
  const a11y = { role: label ? 'img' : undefined, 'aria-label': label, 'aria-hidden': label ? undefined : true } as const;
  if (emoji) {
    return (
      <span
        {...a11y}
        className={`inline-flex shrink-0 select-none items-center justify-center leading-none font-emoji ${EMOJI[size]} ${className}`}
      >
        {emoji}
      </span>
    );
  }
  return (
    <span
      {...a11y}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-tile border border-border bg-transparent leading-none text-muted-strong ${BOX[size]} ${className}`}
    >
      {icon}
    </span>
  );
}
