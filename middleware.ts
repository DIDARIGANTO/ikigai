/// <reference types="node" />
// Вход Vercel Routing Middleware: пароль на весь сайт. Vercel вызывает этот файл перед каждым запросом к сайту.
// Вся логика и пояснения в gate/gate.ts; здесь только чтение настроек и «пропустить» на языке Vercel.
// Настройки задаёт scripts/site-password.sh (секретные переменные проекта на Vercel), в репозитории их нет.
//
// Свои файлы импортируем С РАСШИРЕНИЕМ .js (а не .ts): Vercel собирает TypeScript в .js-файлы и оставляет путь в импорте
// как написан, так что `./gate/gate.ts` на сервере не находится (ошибка MIDDLEWARE_INVOCATION_FAILED, сайт отвечал 500).
// TypeScript и Vitest сами сопоставляют `./gate/gate.js` с исходником gate.ts; проверка этого есть в middleware.test.ts.
import { next } from '@vercel/functions/middleware';
import { handleGate } from './gate/gate.js';

export const config = { runtime: 'nodejs' };

export default async function middleware(request: Request): Promise<Response> {
  const closed = await handleGate(request, {
    password: process.env.SITE_PASSWORD,
    secret: process.env.SITE_GATE_SECRET,
  });
  return closed ?? next();
}
