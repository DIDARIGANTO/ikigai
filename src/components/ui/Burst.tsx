import { useCallback, useEffect, useRef } from 'react';

/**
 * Маленький праздник: разлёт конфетти из точки. Без зависимостей — один холст поверх страницы,
 * создаётся при первом залпе и убирается, когда частицы догорели.
 * По умолчанию выключено («Графит»: без конфетти): работает, только если человек включил
 * «Праздничные эффекты» в настройках (`localStorage['ikigai.effects'] === 'on'`). При prefers-reduced-motion — ничего.
 */
const TONES = ['--color-indigo', '--color-mint', '--color-rose', '--color-amber', '--color-lilac', '--color-sky', '--color-sun'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vr: number;
  color: string;
  life: number;
  shape: 0 | 1;
}

let canvas: HTMLCanvasElement | null = null;
let particles: Particle[] = [];
let frame = 0;

/** Ключ настройки «Праздничные эффекты». */
// oxlint-disable-next-line react/only-export-components -- ключ нужен экрану настроек
export const EFFECTS_KEY = 'ikigai.effects';

/** Включены ли «Праздничные эффекты». По умолчанию — нет. */
// oxlint-disable-next-line react/only-export-components -- проверка нужна обработчикам и настройкам
export function effectsEnabled(): boolean {
  try {
    return localStorage.getItem(EFFECTS_KEY) === 'on';
  } catch {
    return false;
  }
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function ensureCanvas(): CanvasRenderingContext2D | null {
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;pointer-events:none;z-index:90';
    document.body.appendChild(canvas);
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(innerWidth * dpr)) {
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function tick() {
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.vy += 0.32; // тяжесть
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 1;
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life / 18);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.shape === 0) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
    else {
      ctx.beginPath();
      ctx.arc(0, 0, p.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  if (particles.length) frame = requestAnimationFrame(tick);
  else {
    canvas.remove();
    canvas = null;
    frame = 0;
  }
}

export interface BurstOptions {
  /** Сколько частиц. По умолчанию 28 — «щелчок», не салют. */
  count?: number;
  /** Сила разлёта. */
  power?: number;
}

/** Залп из точки экрана (clientX/clientY) или из центра элемента. */
// oxlint-disable-next-line react/only-export-components -- императивный залп нужен обработчикам
export function burst(from: { x: number; y: number } | Element, { count = 28, power = 7 }: BurstOptions = {}) {
  if (typeof window === 'undefined' || !effectsEnabled() || reducedMotion()) return;
  const ctx = ensureCanvas();
  if (!ctx) return;
  const point =
    from instanceof Element
      ? (() => {
          const r = from.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })()
      : from;
  const style = getComputedStyle(document.documentElement);
  const colors = TONES.map(t => style.getPropertyValue(t).trim()).filter(Boolean);
  if (!colors.length) return;
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6;
    const speed = power * (0.55 + Math.random() * 0.75);
    particles.push({
      x: point.x,
      y: point.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      r: 3 + Math.random() * 3,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: colors[i % colors.length],
      life: 46 + Math.random() * 22,
      shape: Math.random() > 0.5 ? 0 : 1,
    });
  }
  if (!frame) frame = requestAnimationFrame(tick);
}

/** Хук для обработчиков: `const confetti = useConfetti(); confetti(e.currentTarget)`. */
// oxlint-disable-next-line react/only-export-components -- хук живёт рядом со своим залпом
export function useConfetti() {
  return useCallback((from: { x: number; y: number } | Element, options?: BurstOptions) => burst(from, options), []);
}

/**
 * Декларативный вариант: залп из места, где стоит компонент, когда `fire` становится true
 * (например, цель достигнута). Сам ничего не рисует в разметке.
 */
export function Burst({ fire, count, power }: { fire: boolean } & BurstOptions) {
  const ref = useRef<HTMLSpanElement>(null);
  const was = useRef(fire);
  useEffect(() => {
    if (fire && !was.current && ref.current) burst(ref.current, { count, power });
    was.current = fire;
  }, [fire, count, power]);
  return <span ref={ref} aria-hidden="true" className="pointer-events-none inline-block size-0" />;
}
