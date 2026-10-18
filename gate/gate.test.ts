// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { COOKIE_MAX_AGE, COOKIE_NAME, FAIL_DELAY_MS, LOGIN_PATH, handleGate, signCookie, verifyCookie } from './gate.ts';
import type { GateDeps } from './gate.ts';

const PASSWORD = 'правильная лошадь 42';
const SECRET = 'a'.repeat(64);
const NOW = Date.UTC(2026, 9, 18, 12, 0, 0);
const BASE = 'https://ikigai.example';
const DAY = 86_400_000;

const noWait = async (_ms: number) => {};
function deps(over: Partial<GateDeps> = {}): GateDeps {
  return { password: PASSWORD, secret: SECRET, now: () => NOW, sleep: noWait, ...over };
}

const page = (path = '/', headers: Record<string, string> = {}) =>
  new Request(BASE + path, { headers: { accept: 'text/html,application/xhtml+xml', ...headers } });
const asset = (path: string, headers: Record<string, string> = {}) => new Request(BASE + path, { headers: { accept: '*/*', ...headers } });

/** Как это делает страница: «Authorization: Basic base64(логин:пароль)» в UTF-8. */
const basic = (password: string, user = 'ikigai') => 'Basic ' + Buffer.from(`${user}:${password}`, 'utf8').toString('base64');
const signIn = (authorization?: string, init: RequestInit = {}) =>
  new Request(BASE + LOGIN_PATH, { method: 'POST', headers: authorization ? { authorization, accept: 'application/json' } : { accept: 'application/json' }, ...init });
const login = (password: string, user?: string) => signIn(basic(password, user));

/** Вход с верным паролем → строка «имя=значение» из Set-Cookie, как её вернёт браузер. */
async function loginCookie(d = deps()): Promise<string> {
  const res = await handleGate(login(PASSWORD), d);
  return res!.headers.get('set-cookie')!.split(';')[0];
}

describe('signCookie / verifyCookie', () => {
  const exp = Math.floor(NOW / 1000) + 3600;

  it('accepts a cookie it signed, until it expires', async () => {
    const value = await signCookie(SECRET, exp);
    expect(await verifyCookie(SECRET, value, NOW)).toBe(true);
    expect(await verifyCookie(SECRET, value, (exp - 1) * 1000)).toBe(true);
    expect(await verifyCookie(SECRET, value, exp * 1000)).toBe(false);
  });

  it('refuses a cookie signed with another secret (changing the secret logs everyone out)', async () => {
    const value = await signCookie(SECRET, exp);
    expect(await verifyCookie('b'.repeat(64), value, NOW)).toBe(false);
  });

  it('refuses a cookie whose expiry was edited', async () => {
    const [, sig] = (await signCookie(SECRET, exp)).split('.');
    expect(await verifyCookie(SECRET, `${exp + 10 * 365 * 86400}.${sig}`, NOW)).toBe(false);
  });

  it('refuses a flipped signature and anything of the wrong shape', async () => {
    const [e, sig] = (await signCookie(SECRET, exp)).split('.');
    const flipped = sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0');
    for (const bad of [`${e}.${flipped}`, '', undefined, 'abc', 'abc.def', `${e}.`, `.${sig}`, `${e}.${sig}.x`, `${e}.${'z'.repeat(64)}`, ` ${e}.${sig}`, `${e}.${sig.toUpperCase()}`]) {
      expect(await verifyCookie(SECRET, bad, NOW)).toBe(false);
    }
  });
});

describe('handleGate: the site is closed by default', () => {
  it('shows the password page for a page request, never the app', async () => {
    const res = await handleGate(page('/settings?x=1'), deps());
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    expect(res!.headers.get('content-type')).toMatch(/text\/html/);
    const html = await res!.text();
    expect(html).toContain('type="password"');
    expect(html).toContain('name="password"');
    expect(html).toContain('autocomplete="current-password"');
    expect(html).toContain("fetch('/__gate'");
    expect(html).toContain('authorization');
    expect(html).toContain('lang="ru"');
    expect(html).toContain('name="viewport"');
  });

  it('keeps the page self-contained and does not echo the request back', async () => {
    const html = await (await handleGate(page('/<script>alert(1)</script>'), deps()))!.text();
    expect(html).not.toMatch(/(?:src|href|action)=["']https?:/);
    expect(html).not.toContain('alert(1)');
  });

  it('says no to everything else with a bare 401, not a page', async () => {
    const res = await handleGate(asset('/assets/index-abc123.js'), deps());
    expect(res!.status).toBe(401);
    expect(res!.headers.get('content-type')).toMatch(/text\/plain/);
    expect(await res!.text()).not.toContain('<');
  });

  it('answers HEAD and other methods without a cookie with 401 too', async () => {
    expect((await handleGate(new Request(BASE + '/', { method: 'HEAD' }), deps()))!.status).toBe(401);
    expect((await handleGate(new Request(BASE + '/x', { method: 'PUT', body: 'x' }), deps()))!.status).toBe(401);
    expect((await handleGate(new Request(BASE + LOGIN_PATH, { method: 'GET', headers: { accept: 'text/html' } }), deps()))!.status).toBe(401);
  });

  it('never lets a gate answer be cached, indexed or framed', async () => {
    const answers = [
      await handleGate(page(), deps()),
      await handleGate(asset('/assets/a.js'), deps()),
      await handleGate(login('wrong'), deps()),
      await handleGate(login(PASSWORD), deps()),
      await handleGate(page(), deps({ password: undefined })),
    ];
    for (const res of answers) {
      expect(res!.headers.get('cache-control')).toBe('no-store');
      expect(res!.headers.get('cdn-cache-control')).toBe('no-store');
      expect(res!.headers.get('vercel-cdn-cache-control')).toBe('no-store');
      expect(res!.headers.get('x-robots-tag')).toBe('noindex, nofollow');
      expect(res!.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res!.headers.get('x-frame-options')).toBe('DENY');
    }
  });

  it('lets only the harmless public files through without a password', async () => {
    for (const path of ['/robots.txt', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/apple-touch-icon.png']) {
      expect(await handleGate(asset(path), deps())).toBeNull();
    }
  });

  it('does not mistake lookalike paths for public files', async () => {
    const lookalikes = [
      '/', '/index.html', '/sw.js', '/assets/index.js', '/icons', '/iconsx/a.png', '/icons/../assets/a.js', '/robots.txt.bak',
      '/manifest.webmanifest/x', '/%69cons/../sw.js', '//sw.js', '/icons/..%2fassets/a.js', '/icons/%2e%2e%2fassets/a.js',
      '/icons/a%2fb.png', '/icons/a/b.png', '/icons/.hidden', '/icons/', '/icons/a\\b.png',
    ];
    for (const path of lookalikes) {
      const res = await handleGate(asset(path), deps());
      expect(res, path).not.toBeNull();
      expect(res!.status, path).toBe(401);
    }
  });

  it('only lets public files through for reading, not for writing', async () => {
    const res = await handleGate(new Request(BASE + '/robots.txt', { method: 'DELETE' }), deps());
    expect(res!.status).toBe(401);
  });
});

describe('handleGate: fails closed when it is not set up', () => {
  it('says 503 and how to fix it when there is no password', async () => {
    for (const password of [undefined, '']) {
      const res = await handleGate(page(), deps({ password }));
      expect(res!.status).toBe(503);
      expect(await res!.text()).toContain('site-password.sh');
    }
  });

  it('says 503 when there is no signing secret, even for public files', async () => {
    for (const secret of [undefined, '']) {
      expect((await handleGate(page(), deps({ secret })))!.status).toBe(503);
      expect((await handleGate(asset('/robots.txt'), deps({ secret })))!.status).toBe(503);
    }
  });

  it('never opens the app on a missing password, whatever the cookie says', async () => {
    const cookie = await loginCookie();
    const res = await handleGate(page('/', { cookie }), deps({ password: undefined }));
    expect(res!.status).toBe(503);
  });
});

describe('handleGate: signing in', () => {
  it('a wrong password gets 401, no cookie, and a pause', async () => {
    const sleep = vi.fn(noWait);
    const res = await handleGate(login('not it'), deps({ sleep }));
    expect(res!.status).toBe(401);
    expect(res!.headers.get('set-cookie')).toBeNull();
    expect(await res!.json()).toEqual({ error: 'wrong' });
    expect(sleep).toHaveBeenCalledWith(FAIL_DELAY_MS);
  });

  it('is exact: case, spaces and prefixes of the password do not count', async () => {
    for (const password of [PASSWORD.toUpperCase(), PASSWORD + ' ', ' ' + PASSWORD, PASSWORD.slice(0, -1), PASSWORD + 'x', '']) {
      const res = await handleGate(login(password), deps());
      expect(res!.status, JSON.stringify(password)).toBe(401);
    }
  });

  it('the right password gets a 204 and a locked-down cookie, without a pause', async () => {
    const sleep = vi.fn(noWait);
    const res = await handleGate(login(PASSWORD), deps({ sleep }));
    expect(res!.status).toBe(204);
    expect(sleep).not.toHaveBeenCalled();
    const cookie = res!.headers.get('set-cookie')!;
    expect(cookie.startsWith(`${COOKIE_NAME}=`)).toBe(true);
    expect(COOKIE_NAME.startsWith('__Host-')).toBe(true);
    for (const flag of ['Path=/', 'Secure', 'HttpOnly', 'SameSite=Lax', `Max-Age=${COOKIE_MAX_AGE}`]) expect(cookie).toContain(flag);
    expect(cookie).not.toMatch(/Domain=/i);
    expect(cookie).not.toContain(PASSWORD);
  });

  it('takes any user name, and a password with colons, spaces and Cyrillic letters as typed', async () => {
    expect((await handleGate(login(PASSWORD, 'whoever'), deps()))!.status).toBe(204);
    expect((await handleGate(login(PASSWORD, ''), deps()))!.status).toBe(204);
    const odd = 'один: два :три';
    expect((await handleGate(login(odd), deps({ password: odd })))!.status).toBe(204);
  });

  it('takes the scheme in any case', async () => {
    const lower = basic(PASSWORD).replace('Basic', 'basic');
    expect((await handleGate(signIn(lower), deps()))!.status).toBe(204);
  });

  it('treats a missing, foreign or broken Authorization header as a wrong password', async () => {
    const good = basic(PASSWORD).slice('Basic '.length);
    const bad = [
      signIn(),
      signIn('Bearer ' + good),
      signIn('Basic'),
      signIn('Basic '),
      signIn('Basic !!!not base64!!!'),
      signIn('Basic ' + Buffer.from('no colon here').toString('base64')),
      signIn('Basic ' + Buffer.from([0x69, 0x3a, 0xff, 0xfe]).toString('base64')), // не UTF-8
      signIn('Basic ' + 'QQ'.repeat(5000)),
    ];
    for (const req of bad) expect((await handleGate(req, deps()))!.status).toBe(401);
  });

  it('refuses an oversized Authorization header, even with the right password inside', async () => {
    const huge = 'x'.repeat(3000);
    expect((await handleGate(login(huge), deps({ password: huge })))!.status).toBe(401);
  });

  it('ignores a password sent in the body or in the address: only the header counts', async () => {
    const inBody = new Request(BASE + LOGIN_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({ password: PASSWORD }).toString(),
    });
    expect((await handleGate(inBody, deps()))!.status).toBe(401);
    const inUrl = new Request(`${BASE}${LOGIN_PATH}?password=${encodeURIComponent(PASSWORD)}`, { method: 'POST', headers: { accept: 'application/json' } });
    expect((await handleGate(inUrl, deps()))!.status).toBe(401);
  });

  it('only signs in on POST to the sign-in path', async () => {
    const withHeader = { authorization: basic(PASSWORD) };
    expect((await handleGate(new Request(BASE + LOGIN_PATH, { method: 'GET', headers: withHeader }), deps()))!.status).toBe(401);
    expect((await handleGate(new Request(BASE + '/', { method: 'POST', headers: withHeader }), deps()))!.status).toBe(401);
    expect((await handleGate(new Request(BASE + '/settings', { headers: { ...withHeader, accept: 'text/html' } }), deps()))!.status).toBe(401);
  });
});

describe('handleGate: the cookie opens the site', () => {
  it('lets a page and its files through once signed in', async () => {
    const cookie = await loginCookie();
    for (const path of ['/', '/settings', '/assets/index-abc123.js', '/sw.js', '/index.html']) {
      expect(await handleGate(asset(path, { cookie }), deps()), path).toBeNull();
    }
  });

  it('finds the cookie among others', async () => {
    const cookie = `theme=dark; ${await loginCookie()}; other=1`;
    expect(await handleGate(page('/', { cookie }), deps())).toBeNull();
  });

  it('closes again after the cookie expires', async () => {
    const cookie = await loginCookie();
    const later = deps({ now: () => NOW + (COOKIE_MAX_AGE + 60) * 1000 });
    expect((await handleGate(page('/', { cookie }), later))!.status).toBe(401);
    const stillFine = deps({ now: () => NOW + (COOKIE_MAX_AGE - 60) * 1000 });
    expect(await handleGate(page('/', { cookie }), stillFine)).toBeNull();
  });

  it('closes everywhere when the secret changes, and ignores a forged cookie', async () => {
    const cookie = await loginCookie();
    expect((await handleGate(page('/', { cookie }), deps({ secret: 'c'.repeat(64) })))!.status).toBe(401);
    const forged = `${COOKIE_NAME}=${Math.floor((NOW + 365 * DAY) / 1000)}.${'0'.repeat(64)}`;
    expect((await handleGate(page('/', { cookie: forged }), deps()))!.status).toBe(401);
  });

  it('a cookie with the right value under another name does not count', async () => {
    const value = (await loginCookie()).split('=')[1];
    expect((await handleGate(page('/', { cookie: `ikigai-gate=${value}` }), deps()))!.status).toBe(401);
  });

  it('keeps the page address as it was: the sign-in script reloads in place (a magic link keeps its #token)', async () => {
    const html = await (await handleGate(page('/'), deps()))!.text();
    expect(html).toContain('location.reload()');
  });
});
