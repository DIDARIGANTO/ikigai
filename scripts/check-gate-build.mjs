// Проверка СОБРАННОЙ Vercel функции пароля (то, что уезжает на сервер), а не исходников. Нужна потому, что тесты и `vercel dev`
// работают с исходниками, а Vercel собирает TypeScript в .js и оставляет пути импортов как написаны: однажды из-за этого
// выложенный сайт отвечал ошибкой 500 (MIDDLEWARE_INVOCATION_FAILED), хотя все тесты были зелёными.
//
// Запуск из папки проекта (ничего не выкладывает, нужен вход в Vercel):
//   npx vercel pull --yes --environment=production && npx vercel build --prod && node scripts/check-gate-build.mjs
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const entry = resolve(import.meta.dirname, '../.vercel/output/functions/middleware.func/middleware.js');
process.env.SITE_PASSWORD = 'build-check phrase 2026';
process.env.SITE_GATE_SECRET = 'f'.repeat(64);

let mod;
try {
  mod = await import(pathToFileURL(entry).href);
} catch (error) {
  console.error(`Не удалось загрузить собранную функцию ${entry}:\n${error}\nСначала: npx vercel pull --yes --environment=production && npx vercel build --prod`);
  process.exit(1);
}

const middleware = mod.default;
const BASE = 'https://ikigai.example';
const basic = password => 'Basic ' + Buffer.from(`ikigai:${password}`).toString('base64');
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(ok ? '  ✓' : '  ✗', name, extra);
  if (!ok) failed++;
};
const passes = res => res.headers.get('x-middleware-next') === '1';

check('экспорт по умолчанию — функция, config.runtime = nodejs', typeof middleware === 'function' && mod.config?.runtime === 'nodejs');

let res = await middleware(new Request(`${BASE}/`, { headers: { accept: 'text/html' } }));
const html = await res.text();
check('страница без пароля → 401 с окном пароля', res.status === 401 && html.includes('type="password"') && !html.includes('id="root"'), `(код ${res.status})`);

res = await middleware(new Request(`${BASE}/sw.js`));
check('файл приложения без пароля → 401', res.status === 401, `(код ${res.status})`);

res = await middleware(new Request(`${BASE}/robots.txt`));
check('robots.txt без пароля пропускается к сайту', passes(res));

const started = Date.now();
res = await middleware(new Request(`${BASE}/__gate`, { method: 'POST', headers: { authorization: basic('wrong password here') } }));
check('неверный пароль → 401 JSON и пауза около секунды', res.status === 401 && (await res.json()).error === 'wrong' && Date.now() - started >= 900, `(${Date.now() - started} мс)`);

res = await middleware(new Request(`${BASE}/__gate`, { method: 'POST', headers: { authorization: basic(process.env.SITE_PASSWORD) } }));
const setCookie = res.headers.get('set-cookie') ?? '';
check('верный пароль → 204 и cookie (__Host-, HttpOnly, Secure, Lax, 90 дней)', res.status === 204 && /^__Host-ikigai-gate=/.test(setCookie) && /HttpOnly/.test(setCookie) && /Secure/.test(setCookie) && /SameSite=Lax/.test(setCookie) && /Max-Age=7776000/.test(setCookie));
const cookie = setCookie.split(';')[0];

res = await middleware(new Request(`${BASE}/settings`, { headers: { cookie, accept: 'text/html' } }));
check('с cookie страница пропускается к сайту', passes(res), `(код ${res.status})`);

res = await middleware(new Request(`${BASE}/assets/index-abc.js`, { headers: { cookie } }));
check('с cookie файл пропускается к сайту', passes(res));

res = await middleware(new Request(`${BASE}/`, { headers: { cookie: `__Host-ikigai-gate=9999999999.${'0'.repeat(64)}`, accept: 'text/html' } }));
check('подделанная cookie → 401', res.status === 401);

delete process.env.SITE_PASSWORD;
res = await middleware(new Request(`${BASE}/`, { headers: { accept: 'text/html' } }));
check('без пароля в настройках сайт закрыт для всех → 503', res.status === 503, `(код ${res.status})`);

console.log(failed ? `\nПровалено проверок: ${failed}` : '\nВсе проверки собранной функции пройдены');
process.exit(failed ? 1 : 0);
