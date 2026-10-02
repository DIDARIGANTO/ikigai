import type { Store } from './store';
import { COLLECTIONS } from '@/lib/types';
import { normalizeRows, warnOnce } from './validate';
import { markExported } from './backup';

/** Сколько записей легло в хранилище, сколько из них починено и сколько отброшено как непригодные. */
export interface ImportResult {
  imported: number;
  skipped: number;
  repaired: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export async function exportAll(store: Store): Promise<string> {
  const out: Record<string, unknown[]> = {};
  for (const c of COLLECTIONS) out[c] = await store.list(c);
  return JSON.stringify({ app: 'ikigai', version: 1, exportedAt: new Date().toISOString(), data: out }, null, 2);
}

/** Скачать резервную копию и запомнить время — от него считает напоминание о копии. */
export async function downloadBackup(store: Store, filename = `ikigai-${new Date().toISOString().slice(0, 10)}.json`) {
  downloadText(filename, await exportAll(store));
}

/**
 * Файл приходит от пользователя, поэтому проверяем всё: это ли JSON, наш ли это экспорт
 * и годится ли каждая запись. Битые строки не валят импорт — их считаем и пропускаем.
 */
export async function importAll(store: Store, json: string): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Не удалось прочитать файл: это не JSON');
  }

  if (!isRecord(parsed) || parsed.app !== 'ikigai' || !isRecord(parsed.data)) {
    throw new Error('Это не файл экспорта Ikigai');
  }

  const data = parsed.data;
  let imported = 0;
  let skipped = 0;
  let repaired = 0;

  for (const c of COLLECTIONS) {
    const raw = data[c];
    if (!Array.isArray(raw)) continue;
    // Та же проверка, что и при чтении: в хранилище ложатся только строки правильной формы.
    const r = normalizeRows(c, raw);
    skipped += r.dropped;
    repaired += r.repaired;
    warnOnce(c, r.repaired, r.dropped, 'импорт');
    if (r.rows.length) {
      await store.putMany(c, r.rows as never);
      imported += r.rows.length;
    }
  }

  return { imported, skipped, repaired };
}

/** Скачивает текст файлом. Копии данных (`exportAll`) скачиваются только отсюда — время запоминается. */
export function downloadText(filename: string, text: string) {
  if (text.startsWith('{') && text.includes('"app": "ikigai"')) markExported();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
