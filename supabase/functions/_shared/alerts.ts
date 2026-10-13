/**
 * Рассылка напоминаний по времени. Чистый модуль (без Deno и сети): отправку в Telegram и запись в базу
 * подставляет `cron-tick`, а сама логика проверяется тестами веб-проекта (`src/lib/domain/botAlerts.test.ts`).
 */
import { dueReminders, type Reminder } from './domain.ts';
import { renderReminderAlert } from './render.ts';

/** Сколько раз за день пробуем прислать одно напоминание, прежде чем сдаться: тик идёт раз в минуту. */
export const MAX_ALERT_ATTEMPTS = 3;

export interface AlertDeps {
  /** Отправка в Telegram: `ok: false` — отказ с кодом 200, он тоже считается неудачей. */
  send: (text: string) => Promise<{ ok: boolean }>;
  /** Запоминает итог попытки за сегодня (`sent_digests`): без этого напоминание ушло бы снова в следующую минуту. */
  record: (reminderId: string, attempts: number, sent: boolean) => Promise<void>;
  /** Куда сообщить об исключении при отправке; по умолчанию молчим. */
  onError?: (e: unknown) => void;
}

export interface AlertInput {
  reminders: Reminder[];
  /** Местные дата и время пользователя (`localClock`). */
  now: { date: string; time: string };
  /** Что уже было сегодня: id напоминания → число попыток и ушло ли оно. */
  progress: ReadonlyMap<string, { attempts: number; sent: boolean }>;
}

/** Присылает напоминания, чьё время пришло, и возвращает, сколько ушло. Неудача по одному не мешает остальным. */
export async function sendDueReminders(input: AlertInput, deps: AlertDeps): Promise<number> {
  const finished = new Set<string>();
  for (const [id, p] of input.progress) {
    if (p.sent || p.attempts >= MAX_ALERT_ATTEMPTS) finished.add(id);
  }
  let sent = 0;
  for (const r of dueReminders(input.reminders, input.now, finished)) {
    const attempts = (input.progress.get(r.id)?.attempts ?? 0) + 1;
    let ok = false;
    try {
      ok = (await deps.send(renderReminderAlert(r))).ok;
    } catch (e) {
      deps.onError?.(e);
    }
    await deps.record(r.id, attempts, ok);
    if (ok) sent++;
  }
  return sent;
}
