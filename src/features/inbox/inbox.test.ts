import { describe, it, expect } from 'vitest';
import type { Note, NoteFolder, Task } from '@/lib/types';
import { createdAgo, inboxCountText, inboxFolder, inboxTasks, isInboxTask, nextMondayISO, telegramNotes } from './inbox';

const task = (p: Partial<Task>): Task => ({
  id: 'x', createdAt: '2026-09-30T00:00:00Z', updatedAt: '', title: 't', area: 'personal', status: 'todo',
  rescheduleCount: 0, source: 'web', kind: 'task', position: 0, ...p,
});
const folder = (id: string, title: string, position = 0): NoteFolder => ({ id, title, position, createdAt: '', updatedAt: '' });
const note = (p: Partial<Note>): Note => ({ id: 'n', createdAt: '2026-09-30T00:00:00Z', updatedAt: '', title: 'n', body: '', source: 'telegram', ...p });

describe('inbox', () => {
  it('isInboxTask: без даты, без доски, не начата', () => {
    expect(isInboxTask(task({}))).toBe(true);
    expect(isInboxTask(task({ date: '2026-10-01' }))).toBe(false);
    expect(isInboxTask(task({ boardId: 'b' }))).toBe(false);
    expect(isInboxTask(task({ status: 'done' }))).toBe(false);
    expect(isInboxTask(task({ status: 'doing' }))).toBe(false);
    expect(isInboxTask(task({ goalId: 'g' }))).toBe(true);
  });

  it('inboxTasks: свежие сверху', () => {
    const r = inboxTasks([
      task({ id: 'old', createdAt: '2026-09-01T00:00:00Z' }),
      task({ id: 'dated', date: '2026-09-30' }),
      task({ id: 'new', createdAt: '2026-09-30T10:00:00Z' }),
    ]);
    expect(r.map(t => t.id)).toEqual(['new', 'old']);
  });

  it('telegramNotes: только из Telegram, из «Входящих» и не разобранные', () => {
    const folders = [folder('f2', 'Идеи', 1), folder('f1', 'Входящие', 0)];
    const r = telegramNotes(
      [
        note({ id: 'a', folderId: 'f1' }),
        note({ id: 'b', folderId: 'f2' }),
        note({ id: 'c', folderId: 'f1', source: 'web' }),
        { ...note({ id: 'd', folderId: 'f1' }), triagedAt: '2026-09-30T00:00:00Z' },
      ],
      folders,
    );
    expect(r.map(n => n.id)).toEqual(['a']);
  });

  it('inboxFolder: по названию, иначе первая по порядку', () => {
    expect(inboxFolder([folder('a', 'Идеи', 1), folder('b', 'Входящие', 2)])?.id).toBe('b');
    expect(inboxFolder([folder('a', 'Идеи', 1), folder('b', 'Черновики', 0)])?.id).toBe('b');
    expect(inboxFolder([])).toBeUndefined();
  });

  it('nextMondayISO — строго после сегодня', () => {
    expect(nextMondayISO('2026-09-30')).toBe('2026-10-05'); // среда
    expect(nextMondayISO('2026-10-05')).toBe('2026-10-12'); // понедельник → следующий
    expect(nextMondayISO('2026-10-04')).toBe('2026-10-05'); // воскресенье
  });

  it('createdAgo', () => {
    const now = new Date(2026, 8, 30, 12, 0);
    const ago = (min: number) => new Date(now.getTime() - min * 60000).toISOString();
    expect(createdAgo(ago(0), now)).toBe('только что');
    expect(createdAgo(ago(5), now)).toBe('5 мин назад');
    expect(createdAgo(ago(180), now)).toBe('3 ч назад');
    expect(createdAgo(new Date(2026, 8, 29, 9).toISOString(), now)).toBe('вчера');
    expect(createdAgo(new Date(2026, 8, 26, 9).toISOString(), now)).toBe('4 дня назад');
    expect(createdAgo(new Date(2026, 8, 1, 9).toISOString(), now)).toBe('1 сент.');
    expect(createdAgo('bad', now)).toBe('');
  });

  it('inboxCountText', () => {
    expect(inboxCountText(0)).toBe('Всё разобрано');
    expect(inboxCountText(1)).toBe('1 запись на разбор');
    expect(inboxCountText(3)).toBe('3 записи на разбор');
    expect(inboxCountText(11)).toBe('11 записей на разбор');
  });
});
