#!/usr/bin/env node
/**
 * Иконки приложения из `public/favicon.svg`. Перезапускаемый: после смены логотипа
 * достаточно `node scripts/make-icons.mjs` (или `npm run icons`).
 *
 *   public/icons/icon-192.png        — обычная иконка (прозрачные углы как в SVG)
 *   public/icons/icon-512.png
 *   public/icons/maskable-512.png    — на сплошном фоне, знак в безопасной зоне (80 %)
 *   public/icons/apple-touch-icon.png — 180×180, без прозрачности (iOS скругляет сам)
 *
 * Фон для maskable и apple — цвет первой фигуры с заливкой в SVG (фон логотипа),
 * иначе BG_FALLBACK. Можно задать явно: `ICON_BG=#080909 node scripts/make-icons.mjs`.
 */
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'public/favicon.svg');
const out = path.join(root, 'public/icons');
const BG_FALLBACK = '#080909';

const svg = await readFile(src);
const bg = process.env.ICON_BG ?? /<(?:rect|circle|path)[^>]*\sfill="(#[0-9a-fA-F]{3,8})"/.exec(svg.toString())?.[1] ?? BG_FALLBACK;

/** SVG в PNG нужного размера; плотность подбираем, чтобы не было мыла. */
const render = size => sharp(svg, { density: Math.max(72, Math.ceil((72 * size) / 64) * 2) }).resize(size, size).png();

/** Знак на сплошном фоне: `scale` — доля холста, которую занимает знак. */
async function onBackground(size, scale) {
  const inner = Math.round(size * scale);
  const logo = await render(inner).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: logo, gravity: 'center' }])
    .flatten({ background: bg })
    .png();
}

await mkdir(out, { recursive: true });
const jobs = [
  ['icon-192.png', render(192)],
  ['icon-512.png', render(512)],
  ['maskable-512.png', await onBackground(512, 0.8)],
  ['apple-touch-icon.png', await onBackground(180, 0.8)],
];
for (const [name, img] of jobs) {
  await img.toFile(path.join(out, name));
  console.log(`public/icons/${name}`);
}
console.log(`фон: ${bg}`);
