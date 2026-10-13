// Отправка сообщений в Telegram Bot API.
import { esc } from './render.ts';

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

/** Ответ Telegram: `ok: false` приходит с кодом 200, поэтому проверять нужно тело. */
export interface TgResult { ok: boolean; description?: string; result?: unknown; }

const api = async (method: string, body: unknown): Promise<TgResult> => {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json() as Promise<TgResult>);
  // Без этого отказ Telegram (битый HTML, заблокированный бот) теряется молча.
  if (!res?.ok) console.error(`telegram ${method} failed: ${res?.description ?? JSON.stringify(res)}`);
  return res;
};

export type Button = { text: string; callback_data: string } | { text: string; url: string };

export const send = (chat_id: string, text: string, buttons?: Button[][]) =>
  api('sendMessage', { chat_id, text, parse_mode: 'HTML', reply_markup: buttons ? { inline_keyboard: buttons } : undefined });

export const edit = (chat_id: string, message_id: number, text: string, buttons?: Button[][]) =>
  api('editMessageText', { chat_id, message_id, text, parse_mode: 'HTML', reply_markup: buttons ? { inline_keyboard: buttons } : undefined });

export const answer = (callback_query_id: string, text?: string) =>
  api('answerCallbackQuery', { callback_query_id, text });

/** «Печатает…» в шапке чата: пока бот слушает и думает, человек видит, что запрос принят. */
export const typing = (chat_id: string) => api('sendChatAction', { chat_id, action: 'typing' });

/**
 * Скачать файл Telegram по `file_id` (голосовое, аудио). Bot API отдаёт файлы до 20 МБ.
 * Адрес содержит токен бота, поэтому его нигде не печатаем.
 */
export async function downloadFile(fileId: string): Promise<Blob | null> {
  const info = await api('getFile', { file_id: fileId });
  const path = (info.result as { file_path?: string } | undefined)?.file_path;
  if (!info.ok || !path) return null;
  const res = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${path}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    console.error(`telegram file download failed: ${res.status}`);
    return null;
  }
  return await res.blob();
}

export { esc };
