import { useCallback, useEffect, useState } from 'react';

/**
 * Защита данных браузера от автоматической очистки (`navigator.storage.persist`).
 * Без неё Safari может стереть IndexedDB сайта через 7 дней без визитов,
 * а Chrome и Firefox — при нехватке места на диске.
 */

const ASKED_KEY = 'ikigai.persistAsked';

type StorageManagerLike = {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
};

function manager(): StorageManagerLike | null {
  try {
    return (typeof navigator !== 'undefined' && (navigator.storage as StorageManagerLike | undefined)) || null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
const changed = () => listeners.forEach(cb => cb());

/** Поддерживает ли браузер запрос на защиту хранилища. */
export function persistSupported(): boolean {
  const m = manager();
  return !!m && typeof m.persist === 'function' && typeof m.persisted === 'function';
}

/** Просит браузер защитить данные. `null` — браузер такое не умеет. */
export async function requestPersist(): Promise<boolean | null> {
  const m = manager();
  if (!m?.persist) return null;
  try {
    if (await m.persisted?.()) return true;
    const ok = await m.persist();
    try {
      localStorage.setItem(ASKED_KEY, ok ? 'granted' : 'denied');
    } catch {
      // Приватный режим: запомнить не получится, спросим в следующий раз.
    }
    return ok;
  } catch (e) {
    console.warn('Ikigai: не удалось запросить защиту хранилища', e);
    return false;
  } finally {
    changed();
  }
}

function alreadyAsked(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Один раз за всё время просит защиту — после первого действия пользователя:
 * Firefox показывает вопрос, и без жеста он выглядел бы как навязчивое окно.
 * Отказ не повторяем сами: в настройках есть кнопка «Запросить защиту».
 */
export function requestPersistOnFirstInteraction() {
  if (!persistSupported() || alreadyAsked() || typeof window === 'undefined') return;
  const events = ['pointerdown', 'keydown'] as const;
  const once = () => {
    events.forEach(e => window.removeEventListener(e, once, true));
    void requestPersist();
  };
  events.forEach(e => window.addEventListener(e, once, { capture: true, passive: true }));
}

export interface StorageInfo {
  /** Браузер умеет защищать хранилище. */
  supported: boolean;
  /** `null` — ещё не знаем (или браузер не говорит). */
  persisted: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
  /** Запросить защиту вручную; возвращает итог. */
  request: () => Promise<boolean | null>;
}

async function readInfo(): Promise<Pick<StorageInfo, 'persisted' | 'usageBytes' | 'quotaBytes'>> {
  const m = manager();
  let persisted: boolean | null = null;
  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;
  try {
    if (m?.persisted) persisted = await m.persisted();
  } catch {
    persisted = null;
  }
  try {
    const est = m?.estimate ? await m.estimate() : null;
    usageBytes = est?.usage ?? null;
    quotaBytes = est?.quota ?? null;
  } catch {
    // Оценка места — лишь подсказка.
  }
  return { persisted, usageBytes, quotaBytes };
}

export function useStorageInfo(): StorageInfo {
  const [info, setInfo] = useState<Pick<StorageInfo, 'persisted' | 'usageBytes' | 'quotaBytes'>>({
    persisted: null,
    usageBytes: null,
    quotaBytes: null,
  });
  useEffect(() => {
    let alive = true;
    const load = () => void readInfo().then(i => alive && setInfo(i));
    load();
    listeners.add(load);
    return () => {
      alive = false;
      listeners.delete(load);
    };
  }, []);
  const request = useCallback(() => requestPersist(), []);
  return { supported: persistSupported(), ...info, request };
}

/** «12,3 МБ» — для подписи в настройках. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} Б`;
  const units = ['КБ', 'МБ', 'ГБ'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toLocaleString('ru-RU', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${units[i]}`;
}
