import { registerSW } from 'virtual:pwa-register';
import { setUpdateReady } from './updateState';

/** Как часто спрашивать сервер о новой версии, пока вкладка открыта. */
const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * Регистрирует сервис-воркер (только в сборке). Новая версия не включается сама:
 * она ждёт, пока пользователь нажмёт «Обновить», — чтобы не перезагружать
 * страницу посреди ввода.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const updateSW = registerSW({
    onNeedRefresh() {
      setUpdateReady(() => updateSW(true));
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      setInterval(() => {
        if (navigator.onLine) void reg.update().catch(() => {});
      }, CHECK_EVERY_MS);
    },
    onRegisterError(e) {
      console.warn('Ikigai: сервис-воркер не зарегистрирован', e);
    },
  });
}
