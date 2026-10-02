# PWA: установка, оффлайн, обновления

- **Манифест** — `public/manifest.webmanifest` (статичный файл, правится руками). Цвета: `theme_color` #5145CD, `background_color` #F7F4EF. Ярлыки: «Новая задача» (`/?new=task`, открывает быструю запись — `src/features/pwa/ShortcutHandler.tsx`) и «Сегодня».
- **Иконки** — `public/icons/*` генерирует `npm run icons` (`scripts/make-icons.mjs`, sharp) из `public/favicon.svg`. После смены логотипа — перезапустить скрипт. Фон maskable/apple-иконок берётся из первой заливки в SVG, либо `ICON_BG=#hex npm run icons`.
- **Сервис-воркер** — генерирует `vite-plugin-pwa` (Workbox, `generateSW`) при `npm run build`; в разработке выключен. Файлы сборки с хешами — в precache (cache-first), навигация — network-first с запасной `index.html` из precache. Версия воркера меняется с каждой сборкой (список файлов с ревизиями внутри `sw.js`).
- **Регистрация** — `src/features/pwa/registerSW.ts`, только в production (`main.tsx`). Новая версия не включается сама: `UpdateBanner` показывает «Доступна новая версия · Обновить»; проверка обновлений раз в час.
- **Проверка** — `npm run build && npm run preview -- --port 5232`, в DevTools → Application: Manifest без ошибок, Service Worker активен; включить Offline и обновить страницу — приложение открывается.
