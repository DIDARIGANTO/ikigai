import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '.wt/**'],
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    // По умолчанию Vitest подменяет CSS пустой строкой; тест токенов (src/styles/styles.test.ts) читает globals.css как текст.
    css: { include: [/globals\.css/] },
    // Локальный .env с ключами облака не должен влиять на тесты: они проверяют приложение в локальном режиме.
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_TELEGRAM_BOT: '' },
  },
});
