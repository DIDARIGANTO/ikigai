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
  },
});
