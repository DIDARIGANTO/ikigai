// Пароль на весь сайт: Vercel Routing Middleware (см. ../middleware.ts и docs/DEPLOY.md).
// Здесь только логика на стандартных Request/Response, без пакетов Vercel, поэтому её проверяют обычные тесты.
// Решение «пропустить» — это null, всё остальное — готовый ответ.
//
// Как это устроено: без cookie сайт отвечает окном пароля (страницы) или голым 401 (файлы). Верный пароль выдаёт
// cookie с подписью HMAC. Подписывает случайный ключ SITE_GATE_SECRET, а не сам пароль: украденная cookie не даёт
// подобрать пароль, а смена ключа выкидывает все устройства. Данные приложения от этого не зависят: они лежат в
// Supabase за собственным входом и правилами доступа.
// Пароль приходит заголовком Authorization (Basic): Routing Middleware на Vercel не получает тело запроса
// (проверено в vercel dev: тело приходит пустым), а заголовки получает.

import { PAGE_CSP, loginPage, notConfiguredPage } from './pages.ts';

export const LOGIN_PATH = '/__gate';
export const COOKIE_NAME = '__Host-ikigai-gate';
/** Сколько живёт вход на одном устройстве (90 дней), потом пароль спросят снова. */
export const COOKIE_MAX_AGE = 90 * 24 * 60 * 60;
/** Пауза перед ответом «неверно»: перебор по одному паролю в секунду слишком медленный. */
export const FAIL_DELAY_MS = 1000;
const MAX_AUTH_HEADER = 2048;

// Без пароля открываются только безобидные файлы: браузеру и телефону они нужны для значка и установки приложения.
// Папка значков — строго один файл простого имени: никаких «..», закодированных слэшей и вложенных папок.
const PUBLIC_FILES = new Set(['/robots.txt', '/manifest.webmanifest', '/favicon.svg']);
const PUBLIC_ICON = /^\/icons\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface GateDeps {
  /** SITE_PASSWORD: пароль на сайт. */
  password: string | undefined;
  /** SITE_GATE_SECRET: случайный ключ подписи cookie. */
  secret: string | undefined;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const SECURITY_HEADERS = {
  'cache-control': 'no-store',
  'cdn-cache-control': 'no-store',
  'vercel-cdn-cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
};

function reply(body: string | null, status: number, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { ...SECURITY_HEADERS, ...headers } });
}
const htmlReply = (page: string, status: number) =>
  reply(page, status, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': PAGE_CSP });
const jsonReply = (data: unknown, status: number) => reply(JSON.stringify(data), status, { 'content-type': 'application/json' });
const textReply = (text: string, status: number) => reply(text, status, { 'content-type': 'text/plain; charset=utf-8' });

// ——— подпись ———

const encoder = new TextEncoder();

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

const toHex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], h => parseInt(h, 16));

/** Сравнение без раннего выхода: по времени ответа не понять, сколько байт совпало. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const COOKIE_SHAPE = /^(\d{1,12})\.([0-9a-f]{64})$/;
const cookieMessage = (expiresAt: number) => `cookie:v1:${expiresAt}`;

/** Значение cookie: «срок до (секунды).подпись». */
export async function signCookie(secret: string, expiresAtSec: number): Promise<string> {
  return `${expiresAtSec}.${toHex(await hmac(secret, cookieMessage(expiresAtSec)))}`;
}

export async function verifyCookie(secret: string, value: string | undefined, nowMs: number): Promise<boolean> {
  const match = value ? COOKIE_SHAPE.exec(value) : null;
  if (!match) return false;
  const expiresAt = Number(match[1]);
  const signed = sameBytes(await hmac(secret, cookieMessage(expiresAt)), fromHex(match[2]));
  return signed && expiresAt * 1000 > nowMs;
}

/** Пароль сверяется через подпись обеих строк: сравниваются одинаковые по длине значения, длина пароля не видна. */
async function samePassword(secret: string, given: string, expected: string): Promise<boolean> {
  return sameBytes(await hmac(secret, `pw:${given}`), await hmac(secret, `pw:${expected}`));
}

// ——— запрос ———

function readCookie(header: string | null, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

/** Пароль из «Authorization: Basic base64(логин:пароль)». Логин любой, пароль — всё после первого двоеточия. */
function readPassword(header: string | null): string {
  const match = header && header.length <= MAX_AUTH_HEADER ? /^Basic +([A-Za-z0-9+/]+={0,2})$/i.exec(header.trim()) : null;
  if (!match) return '';
  try {
    const bytes = Uint8Array.from(atob(match[1]), ch => ch.charCodeAt(0));
    const credentials = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const colon = credentials.indexOf(':');
    return colon < 0 ? '' : credentials.slice(colon + 1);
  } catch {
    return '';
  }
}

function isPublic(pathname: string, method: string): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false;
  return PUBLIC_FILES.has(pathname) || PUBLIC_ICON.test(pathname);
}

const cookieHeader = (value: string) => `${COOKIE_NAME}=${value}; Max-Age=${COOKIE_MAX_AGE}; Path=/; Secure; HttpOnly; SameSite=Lax`;

async function signIn(request: Request, password: string, secret: string, nowMs: number, sleep: (ms: number) => Promise<void>): Promise<Response> {
  const given = readPassword(request.headers.get('authorization'));
  if (given === '' || !(await samePassword(secret, given, password))) {
    await sleep(FAIL_DELAY_MS);
    return jsonReply({ error: 'wrong' }, 401);
  }
  return reply(null, 204, { 'set-cookie': cookieHeader(await signCookie(secret, Math.floor(nowMs / 1000) + COOKIE_MAX_AGE)) });
}

/** null — пропустить запрос к сайту, иначе готовый ответ. */
export async function handleGate(request: Request, deps: GateDeps): Promise<Response | null> {
  const { password, secret } = deps;
  // Нет пароля или ключа — сайт закрыт всем (а не открыт всем): забытая настройка не должна выставлять сайт наружу.
  if (!password || !secret) return htmlReply(notConfiguredPage(), 503);

  const nowMs = (deps.now ?? Date.now)();
  const sleep = deps.sleep ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const { pathname } = new URL(request.url);

  if (request.method === 'POST' && pathname === LOGIN_PATH) return signIn(request, password, secret, nowMs, sleep);
  if (isPublic(pathname, request.method)) return null;
  if (await verifyCookie(secret, readCookie(request.headers.get('cookie'), COOKIE_NAME), nowMs)) return null;

  return (request.headers.get('accept') ?? '').includes('text/html') ? htmlReply(loginPage(LOGIN_PATH), 401) : textReply('Доступ закрыт', 401);
}
