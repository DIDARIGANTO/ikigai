// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import middleware from './middleware.ts';

const BASE = 'https://ikigai.example';
const PASSWORD = 'пароль для проверки 123';

afterEach(() => vi.unstubAllEnvs());

function configure(password = PASSWORD, secret = 's'.repeat(64)) {
  vi.stubEnv('SITE_PASSWORD', password);
  vi.stubEnv('SITE_GATE_SECRET', secret);
}

describe('middleware (the Vercel entry point)', () => {
  it('keeps the site closed to everyone while nothing is configured', async () => {
    configure('', '');
    const res = await middleware(new Request(BASE + '/', { headers: { accept: 'text/html' } }));
    expect(res.status).toBe(503);
    expect(res.headers.get('x-middleware-next')).toBeNull();
  });

  it('asks for the password, then lets the signed-in browser through to the site', async () => {
    configure();
    const closed = await middleware(new Request(BASE + '/settings', { headers: { accept: 'text/html' } }));
    expect(closed.status).toBe(401);
    expect(closed.headers.get('x-middleware-next')).toBeNull();

    const login = await middleware(
      new Request(BASE + '/__gate', {
        method: 'POST',
        headers: { authorization: 'Basic ' + Buffer.from('ikigai:' + PASSWORD, 'utf8').toString('base64') },
      }),
    );
    expect(login.status).toBe(204);

    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    const open = await middleware(new Request(BASE + '/settings', { headers: { cookie } }));
    expect(open.status).toBe(200);
    expect(open.headers.get('x-middleware-next')).toBe('1'); // так Vercel понимает «пропусти запрос к сайту»
  });

  it('passes the public files through even without a cookie', async () => {
    configure();
    const res = await middleware(new Request(BASE + '/manifest.webmanifest'));
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('imports its own files with .js, never .ts: Vercel compiles TypeScript to .js but keeps the path as written', () => {
    const shipped = ['middleware.ts', 'gate/gate.ts', 'gate/pages.ts'];
    for (const file of shipped) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      const relative = [...source.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)].map(m => m[1]);
      for (const path of relative) expect(path, `${file} imports ${path}`).toMatch(/\.js$/);
    }
  });

  it('asks for the Node.js runtime explicitly (Vercel warns that the default edge runtime is deprecated)', () => {
    const source = readFileSync(new URL('./middleware.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/export const config = \{ runtime: 'nodejs' \}/);
  });

  it('reads the very variable names that scripts/site-password.sh writes to Vercel', () => {
    const script = readFileSync(new URL('./scripts/site-password.sh', import.meta.url), 'utf8');
    expect(script).toContain('SITE_PASSWORD');
    expect(script).toContain('SITE_GATE_SECRET');
  });
});
