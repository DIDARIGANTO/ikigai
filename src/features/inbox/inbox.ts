import { addDays, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Note, NoteFolder, Task } from '@/lib/types';

/** Заметка из Telegram после разбора помечается `triagedAt` и уходит из «Входящих» (поле необязательное). */
export type InboxNote = Note & { triagedAt?: string };

export const INBOX_FOLDER = 'Входящие';

/** Русское склонение по числу: 1 запись, 2 записи, 5 записей. */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

/** Во «Входящих» — задачи без даты, без доски и ещё не начатые. */
export const isInboxTask = (t: Task) => !t.date && !t.boardId && t.status === 'todo';

/** Свежие сверху: разбирать начинают с того, что только что записали. */
export function inboxTasks(tasks: Task[]): Task[] {
  return tasks.filter(isInboxTask).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function inboxFolder(folders: NoteFolder[]): NoteFolder | undefined {
  // Как и бот: папка «Входящие», а если её переименовали — первая.
  return folders.find(f => f.title === INBOX_FOLDER) ?? [...folders].sort((a, b) => a.position - b.position)[0];
}

/** Заметки, пришедшие из Telegram в папку «Входящие» и ещё не разобранные. */
export function telegramNotes(notes: InboxNote[], folders: NoteFolder[]): InboxNote[] {
  const folder = inboxFolder(folders);
  if (!folder) return [];
  return notes
    .filter(n => n.source === 'telegram' && n.folderId === folder.id && !n.triagedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Ближайший понедельник строго после сегодняшнего дня — «на неделе». */
export function nextMondayISO(todayISO: string): string {
  const d = parseISO(todayISO);
  const dow = (d.getDay() + 6) % 7;
  return format(addDays(d, 7 - dow), 'yyyy-MM-dd');
}

/** «только что», «5 мин назад», «3 ч назад», «вчера», «4 дня назад», дальше — дата. */
export function createdAgo(iso: string, now: Date): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const min = Math.floor((now.getTime() - t) / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.ceil((startToday - t) / 86400000);
  if (days <= 1) return 'вчера';
  if (days < 7) return `${days} ${pluralRu(days, ['день', 'дня', 'дней'])} назад`;
  return format(new Date(t), new Date(t).getFullYear() === now.getFullYear() ? 'd MMM' : 'd MMM yyyy', { locale: ru });
}

/** «3 на разбор» — подпись под заголовком. */
export function inboxCountText(n: number): string {
  return n ? `${n} ${pluralRu(n, ['запись', 'записи', 'записей'])} на разбор` : 'Всё разобрано';
}
