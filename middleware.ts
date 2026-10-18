// Вход Vercel Routing Middleware: пароль на весь сайт. Vercel вызывает этот файл перед каждым запросом к сайту.
// Вся логика и пояснения в gate/gate.ts; здесь только чтение настроек и «пропустить» на языке Vercel.
// Настройки задаёт scripts/site-password.sh (секретные переменные проекта на Vercel), в репозитории их нет.
import { next } from '@vercel/functions/middleware';
import { handleGate } from './gate/gate.ts';

export default async function middleware(request: Request): Promise<Response> {
  const closed = await handleGate(request, {
    password: process.env.SITE_PASSWORD,
    secret: process.env.SITE_GATE_SECRET,
  });
  return closed ?? next();
}
