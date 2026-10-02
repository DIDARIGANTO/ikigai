/**
 * Напоминание о резервной копии. Данные живут только в этом браузере,
 * поэтому раз в две недели (или через неделю, если копии не было) мягко
 * предлагаем скачать файл. Отказ прячет напоминание до завтра.
 */

export const LAST_EXPORT_KEY = 'ikigai.lastExportAt';
export const NUDGE_DISMISSED_KEY = 'ikigai.backupNudgeDismissedAt';

const DAY = 24 * 60 * 60 * 1000;
export const EXPORT_MAX_AGE_DAYS = 14;
export const FIRST_EXPORT_AFTER_DAYS = 7;

function read(key: string): number | null {
  try {
    const v = localStorage.getItem(key);
    if (!v) return null;
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}

function write(key: string, at: Date) {
  try {
    localStorage.setItem(key, at.toISOString());
  } catch {
    // Приватный режим: напоминание просто повторится.
  }
}

export const readLastExportAt = () => read(LAST_EXPORT_KEY);
export const readNudgeDismissedAt = () => read(NUDGE_DISMISSED_KEY);
export const markExported = (at = new Date()) => write(LAST_EXPORT_KEY, at);
export const dismissNudge = (at = new Date()) => write(NUDGE_DISMISSED_KEY, at);

/** Целых дней между двумя моментами (не меньше нуля). */
export function daysBetween(from: number, to: number): number {
  return Math.max(0, Math.floor((to - from) / DAY));
}

const sameLocalDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

/**
 * Показывать ли напоминание. Все моменты — миллисекунды или `null`.
 * - данных нет → нет;
 * - сегодня уже отказались → нет;
 * - копия была → да, если ей больше 14 дней;
 * - копии не было → да, если первым данным больше 7 дней.
 */
export function shouldNudgeBackup(
  now: number,
  lastExportAt: number | null,
  firstDataAt: number | null,
  dismissedAt: number | null,
): boolean {
  if (firstDataAt === null) return false;
  if (dismissedAt !== null && sameLocalDay(dismissedAt, now)) return false;
  if (lastExportAt !== null) return now - lastExportAt > EXPORT_MAX_AGE_DAYS * DAY;
  return now - firstDataAt > FIRST_EXPORT_AFTER_DAYS * DAY;
}
