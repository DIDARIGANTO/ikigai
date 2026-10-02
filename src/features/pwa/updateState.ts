import { useSyncExternalStore } from 'react';

/**
 * Состояние обновления приложения: сервис-воркер новой версии скачан и ждёт.
 * Живёт вне React — регистрация воркера происходит до отрисовки.
 */
let apply: (() => Promise<void>) | null = null;
const subs = new Set<() => void>();

export function setUpdateReady(fn: (() => Promise<void>) | null) {
  apply = fn;
  subs.forEach(cb => cb());
}

export function useUpdateReady(): (() => Promise<void>) | null {
  return useSyncExternalStore(
    cb => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => apply,
    () => null,
  );
}
