import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Сервис-воркер генерирует Workbox: список файлов сборки с хешами попадает в него сам,
    // поэтому версия воркера меняется с каждой сборкой. Манифест — статичный файл в public/.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: false,
      includeAssets: ['favicon.svg', 'icons.svg', 'manifest.webmanifest', 'icons/*.png'],
      workbox: {
        // Код и стили с хешами в имени — из кеша (precache), страница — сначала из сети.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ikigai-pages',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 8 },
              // Без сети и без сохранённой страницы — оболочка приложения из precache.
              precacheFallback: { fallbackURL: '/index.html' },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: {
    rolldownOptions: {
      output: {
        // Библиотеки — отдельными файлами: они меняются реже кода приложения и дольше живут в кеше.
        // Перетаскивание нужно только доскам и календарю — его кусок грузится вместе с ними.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|cookie|set-cookie-parser)[\\/]/, priority: 30 },
            { name: 'dnd-kit', test: /node_modules[\\/]@dnd-kit[\\/]/, priority: 20 },
            { name: 'dexie', test: /node_modules[\\/]dexie[\\/]/, priority: 20 },
            { name: 'date-fns', test: /node_modules[\\/]date-fns[\\/]/, priority: 20 },
            { name: 'icons', test: /node_modules[\\/]lucide-react[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
});
