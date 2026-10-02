import { COLLECTIONS } from '@/lib/types';
import { markExported } from '@/data/backup';
import { getStore } from '@/data';

/** Имя базы браузерного хранилища (см. `LocalStore`). */
const DB_NAME = 'ikigai';

type Dump = Record<string, unknown[]>;

/**
 * Читает базу IndexedDB напрямую, в обход Dexie и проверки строк: при аварии
 * важнее унести всё как есть, даже битые записи, чем показать красивое.
 */
function readRawIndexedDB(): Promise<Dump> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB недоступен'));
      return;
    }
    // Без номера версии: открываем то, что есть, и ничего не создаём.
    const req = indexedDB.open(DB_NAME);
    req.onerror = () => reject(req.error ?? new Error('Не удалось открыть базу'));
    req.onblocked = () => reject(new Error('База занята другой вкладкой'));
    req.onupgradeneeded = () => {
      // Базы не было: пустую создавать не нужно.
      req.transaction?.abort();
    };
    req.onsuccess = () => {
      const db = req.result;
      const names = Array.from(db.objectStoreNames).filter(n => (COLLECTIONS as string[]).includes(n));
      const out: Dump = {};
      if (!names.length) {
        db.close();
        resolve(out);
        return;
      }
      const tx = db.transaction(names, 'readonly');
      for (const n of names) {
        const r = tx.objectStore(n).getAll();
        r.onsuccess = () => {
          out[n] = r.result as unknown[];
        };
      }
      tx.oncomplete = () => {
        db.close();
        resolve(out);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('Не удалось прочитать базу'));
      };
    };
  });
}

/** Читает данные через обычное хранилище (облако, память), если оно вообще живо. */
async function readViaStore(): Promise<Dump> {
  const store = getStore();
  const out: Dump = {};
  for (const c of COLLECTIONS) {
    try {
      out[c] = await store.list(c);
    } catch {
      // Одна коллекция не прочиталась — остальные всё равно уносим.
    }
  }
  return out;
}

const count = (d: Dump) => Object.values(d).reduce((n, rows) => n + rows.length, 0);

/**
 * Собирает копию данных любым доступным способом. Никогда не бросает:
 * в худшем случае возвращает файл с описанием ошибок вместо данных.
 */
export async function collectEmergencyExport(): Promise<{ json: string; rows: number }> {
  const errors: string[] = [];
  let data: Dump = {};
  try {
    data = await readRawIndexedDB();
  } catch (e) {
    errors.push(`indexedDB: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!count(data)) {
    try {
      const viaStore = await readViaStore();
      if (count(viaStore)) data = viaStore;
    } catch (e) {
      errors.push(`store: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const json = JSON.stringify(
    { app: 'ikigai', version: 1, exportedAt: new Date().toISOString(), emergency: true, errors, data },
    null,
    2,
  );
  return { json, rows: count(data) };
}

/** Скачивает аварийную копию. Не зависит от провайдеров и роутера. */
export async function downloadEmergencyExport(): Promise<number> {
  const { json, rows } = await collectEmergencyExport();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = `ikigai-copy-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  if (rows) markExported();
  return rows;
}

/** Короткое описание ошибки для блока «Подробности»: без стека, одна-две строки. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'statusText' in error) {
    const e = error as { status?: number; statusText?: string };
    return [e.status, e.statusText].filter(Boolean).join(' ');
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
