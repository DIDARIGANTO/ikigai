import { useMemo } from 'react';
import { useCollection } from '@/data/hooks';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import { inboxTasks, telegramNotes } from './inbox';
import type { InboxNote } from './inbox';

/** Сколько ждёт разбора: задачи без даты и доски плюс новые заметки из Telegram. */
export function useInboxCount(): number {
  const { tasks } = useTaskActionsCtx();
  const notes = useCollection('notes') as InboxNote[];
  const folders = useCollection('noteFolders');
  return useMemo(() => inboxTasks(tasks).length + telegramNotes(notes, folders).length, [tasks, notes, folders]);
}
