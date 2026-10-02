import type { Store } from './store';
import { LocalStore } from './local';
import { MemoryStore } from './memory';

/** Облако включено, только если заданы обе переменные окружения. Иначе — браузерное хранилище. */
export const cloudEnabled =
  !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

let instance: Store | null = null;

/** Есть ли в браузере IndexedDB вообще. Доступ к свойству тоже может бросить (запрет cookies). */
function hasIndexedDB(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Браузерное хранилище. Без IndexedDB — сразу память и статус `error`;
 * если база не откроется позже, `LocalStore` сам перейдёт в память.
 */
export function createLocalStore(name?: string): Store {
  if (!hasIndexedDB()) {
    console.error('Ikigai: IndexedDB недоступен, данные живут только в этой вкладке');
    return new MemoryStore({ error: 'Браузер не разрешает хранить данные (возможно, приватный режим)' });
  }
  try {
    return new LocalStore(name);
  } catch (e) {
    console.error('Ikigai: не удалось открыть хранилище браузера', e);
    return new MemoryStore({ error: 'Хранилище браузера недоступно' });
  }
}

export function getStore(): Store {
  if (!instance) {
    // В облачном режиме хранилище создаёт AuthGate после входа: до этого мы не знаем пользователя.
    if (cloudEnabled) throw new Error('Хранилище ещё не готово: нужен вход');
    instance = createLocalStore();
  }
  return instance;
}

/**
 * Каждый вход ставит новый экземпляр: подготовка данных (`Shell`) привязана
 * к его идентичности, поэтому чужие демо-данные и дефолты не переносятся.
 */
export function setStore(s: Store) {
  instance = s;
}

/** Выход из аккаунта: закрытое хранилище не должно остаться доступным через `getStore`. */
export function clearStore() {
  instance = null;
}
