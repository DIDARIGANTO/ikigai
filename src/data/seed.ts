import type { Store } from './store';
import { newId, nowISO } from '@/lib/ids';
import { todayISO, addDaysISO } from '@/lib/dates';

export async function ensureDefaults(store: Store) {
  const boards = await store.list('boards');
  if (boards.length) return;
  const now = nowISO();
  const mk = (title: string, position: number) => ({ id: newId(), title, position, createdAt: now, updatedAt: now });
  const work = mk('Работа', 0), personal = mk('Личное', 1);
  await store.putMany('boards', [work, personal]);
  const cols = [];
  for (const b of [work, personal]) {
    cols.push({ id: newId(), boardId: b.id, title: 'Надо', kind: 'todo' as const, position: 0, createdAt: now, updatedAt: now });
    cols.push({ id: newId(), boardId: b.id, title: 'В работе', kind: 'doing' as const, position: 1, createdAt: now, updatedAt: now });
    cols.push({ id: newId(), boardId: b.id, title: 'Готово', kind: 'done' as const, position: 2, createdAt: now, updatedAt: now });
  }
  await store.putMany('columns', cols);
  await store.putMany('lists', [{ id: newId(), title: 'Купить', icon: 'shopping-bag', position: 0, pinned: true, createdAt: now, updatedAt: now }]);
  await store.putMany('noteFolders', [{ id: newId(), title: 'Входящие', position: 0, createdAt: now, updatedAt: now }]);
}

export async function loadDemo(store: Store) {
  await ensureDefaults(store);
  const existingProfiles = await store.list('profiles');
  if (existingProfiles[0]?.demoLoaded) return;
  const now = nowISO(), today = todayISO();
  const boards = await store.list('boards');
  const columns = await store.list('columns');
  const todoCol = (boardId?: string) => (boardId ? columns.find(c => c.boardId === boardId && c.kind === 'todo')?.id : undefined);
  const work = boards.find(b => b.title === 'Работа') ?? boards[0];
  const personal = boards.find(b => b.title === 'Личное') ?? boards[0];
  const workId = work?.id;
  const personalId = personal?.id;
  const base = { createdAt: now, updatedAt: now };

  const dreamId = newId();
  await store.putMany('dreams', [
    { id: dreamId, title: 'Запустить своё приложение', category: 'Дело', ...base },
    { id: newId(), title: 'Пробежать полумарафон', category: 'Тело', ...base },
    { id: newId(), title: 'Побывать в Японии', category: 'Путешествия', ...base },
    { id: newId(), title: 'Купить квартиру', category: 'Дом', ...base },
    { id: newId(), title: 'Прочитать 50 книг', category: 'Разум', doneAt: undefined, ...base },
  ]);
  const gYear = newId(), gMonth = newId(), gWeek = newId();
  await store.putMany('goals', [
    { id: gYear, title: 'Выпустить Ikigai', horizon: 'year', dreamId, status: 'active', ...base },
    { id: gMonth, title: 'Собрать первую версию', horizon: 'month', parentId: gYear, status: 'active', ...base },
    { id: gWeek, title: 'Описать все разделы', horizon: 'week', parentId: gMonth, status: 'active', ...base },
  ]);
  await store.putMany('tasks', [
    { id: newId(), title: 'Тренировка', area: 'personal', boardId: personalId, columnId: todoCol(personalId), date: today, plannedStart: '07:00', plannedMinutes: 60, status: 'todo', rescheduleCount: 0, source: 'web', kind: 'workout', position: 0, important: true, ...base },
    { id: newId(), title: 'Глубокая работа над сайтом', area: 'work', boardId: workId, columnId: todoCol(workId), goalId: gWeek, date: today, plannedStart: '10:00', plannedMinutes: 120, status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: 1, ...base },
    { id: newId(), title: 'Позвонить маме', area: 'personal', boardId: personalId, columnId: todoCol(personalId), date: today, status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: 2, ...base },
    { id: newId(), title: 'Разобрать почту', area: 'work', boardId: workId, columnId: todoCol(workId), date: addDaysISO(today, -1), status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: 3, ...base },
  ]);
  await store.putMany('reminders', [
    { id: newId(), text: 'Оплатить интернет', date: today.slice(0, 8) + '05', repeat: 'monthly', ...base },
    { id: newId(), text: 'ДР мамы', date: '1972-' + addDaysISO(today, 12).slice(5), repeat: 'yearly', ...base },
  ]);
  const existingLists = await store.list('lists');
  const list = existingLists[0] ?? { id: newId(), title: 'Купить', icon: 'shopping-bag', position: 0, pinned: true, ...base };
  if (!existingLists.length) await store.putMany('lists', [list]);
  await store.putMany('listItems', [
    { id: newId(), listId: list.id, text: 'Наушники', price: 45000, position: 0, ...base },
    { id: newId(), listId: list.id, text: 'Кроссовки для бега', price: 60000, position: 1, ...base },
  ]);
  const existingFolders = await store.list('noteFolders');
  const folder = existingFolders[0] ?? { id: newId(), title: 'Входящие', position: 0, ...base };
  if (!existingFolders.length) await store.putMany('noteFolders', [folder]);
  await store.putMany('notes', [
    { id: newId(), folderId: folder.id, title: 'Идея', body: 'Каждое утро — 10 минут планирования до телефона.', source: 'web', ...base },
  ]);
  const profiles = await store.list('profiles');
  const p = profiles[0] ?? { id: 'me' as const, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, morningTime: '09:00', currency: 'KZT', ...base };
  await store.put('profiles', { ...p, weekGoalId: gWeek, demoLoaded: true, updatedAt: now });
}
