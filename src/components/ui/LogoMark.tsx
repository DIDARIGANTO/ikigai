/**
 * Знак Ikigai: четыре пересекающиеся окружности — «что любишь», «что умеешь», «что нужно миру»,
 * «за что платят». Контуры 1.5 px цветом текста (`currentColor`), маленькое общее пересечение
 * закрашено акцентом — это и есть икигай. Без плитки и без других цветов.
 */
const C = 14;
const R = 7.25;
const D = 5;
/** Угол общего пересечения четырёх кругов: точка (C ± T, C ± T). */
const T = 1.98;
const CORE =
  `M${C + T} ${C - T}A${R} ${R} 0 0 1 ${C + T} ${C + T}A${R} ${R} 0 0 1 ${C - T} ${C + T}` +
  `A${R} ${R} 0 0 1 ${C - T} ${C - T}A${R} ${R} 0 0 1 ${C + T} ${C - T}Z`;

export function LogoMark({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true" className={`shrink-0 ${className}`}>
      <g stroke="currentColor" strokeWidth="1.5">
        <circle cx={C} cy={C - D} r={R} vectorEffect="non-scaling-stroke" />
        <circle cx={C - D} cy={C} r={R} vectorEffect="non-scaling-stroke" />
        <circle cx={C + D} cy={C} r={R} vectorEffect="non-scaling-stroke" />
        <circle cx={C} cy={C + D} r={R} vectorEffect="non-scaling-stroke" />
      </g>
      {/* Пересечение — поверх контуров, чтобы акцентная точка читалась и на малых размерах. */}
      <path d={CORE} className="fill-accent" />
    </svg>
  );
}

/** Знак и словесная марка «Ikigai»: вес, регистр и трекинг — по образу (у «Сигнала» капитель, как марка S.A.T). */
export function Wordmark({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-text ${className}`}>
      <LogoMark size={size} />
      <span className={`wordmark-text ${size >= 32 ? 'text-h2' : 'text-body'}`}>Ikigai</span>
    </span>
  );
}
