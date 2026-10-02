export type ID = string;

export interface Base {
  id: ID;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export type Horizon = 'years' | 'year' | 'month' | 'week';
export type GoalStatus = 'active' | 'done' | 'dropped';
export type TaskStatus = 'todo' | 'doing' | 'done' | 'skipped';
export type Area = 'work' | 'personal';
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type Source = 'web' | 'telegram';
export type ColumnKind = 'todo' | 'doing' | 'done';

export interface Profile extends Base {
  id: 'me';
  timezone: string;        // 'Asia/Almaty'
  morningTime: string;     // 'HH:mm'
  currency: string;        // 'KZT'
  telegramChatId?: string;
  weekGoalId?: ID;
  demoLoaded?: boolean;
  name?: string;              // как обращаться в приветствии
  onboarded?: boolean;        // пройдено знакомство
  checklistDismissed?: boolean; // скрыт чек-лист «первые шаги» на «Сегодня»
}

export interface Dream extends Base {
  title: string;
  emoji?: string;          // выбирает человек, показывается в плитке
  description?: string;
  imageDataUrl?: string;   // локально: data URL; в облаке: путь в Storage
  category?: string;
  doneAt?: string;         // ISO date
  goalId?: ID;
}

export interface Goal extends Base {
  title: string;
  emoji?: string;
  description?: string;
  horizon: Horizon;
  parentId?: ID;
  dreamId?: ID;
  startDate?: string;      // 'YYYY-MM-DD'
  endDate?: string;
  status: GoalStatus;
}

export interface Board extends Base { title: string; position: number; }
export interface Column extends Base { boardId: ID; title: string; kind: ColumnKind; position: number; tone?: string; /* тон палитры панели */ }

export interface Task extends Base {
  title: string;
  emoji?: string;
  notes?: string;
  area: Area;
  boardId?: ID;
  columnId?: ID;
  goalId?: ID;
  date?: string;           // 'YYYY-MM-DD'
  plannedStart?: string;   // 'HH:mm'
  plannedMinutes?: number;
  actualStart?: string;    // ISO datetime
  actualEnd?: string;      // ISO datetime
  status: TaskStatus;
  important?: boolean;
  rescheduleCount: number;
  source: Source;
  kind: 'task' | 'workout';
  position: number;
}

export interface Reminder extends Base {
  text: string;
  date: string;            // 'YYYY-MM-DD' — первая дата
  time?: string;           // 'HH:mm'
  repeat: Repeat;
}

export interface List extends Base { title: string; icon: string; position: number; pinned: boolean; tone?: string; /* тон обложки */ }
export interface ListItem extends Base {
  listId: ID; text: string; note?: string; url?: string; price?: number; doneAt?: string; position: number;
}

export interface NoteFolder extends Base { title: string; position: number; emoji?: string; }
export interface Note extends Base { folderId?: ID; title: string; body: string; source: Source; }

/** Чей долг: «Мне должны» или «Я должен». */
export type DebtDirection = 'owedToMe' | 'iOwe';

/** Возврат части долга или всего долга. */
export interface DebtPayment {
  id: ID;
  date: string;            // 'YYYY-MM-DD'
  amount: number;          // > 0, в валюте долга
  note?: string;
}

/**
 * Долг. Остаток считается из возвратов (`payments`), а не хранится: так он не расходится с историей.
 * Долг закрыт, когда выплачено всё или когда его закрыли вручную (`closedAt`: простили, списали).
 */
export interface Debt extends Base {
  direction: DebtDirection;
  person: string;          // кто должен мне / кому должен я
  amount: number;          // сумма долга
  currency: string;        // 'KZT'
  date: string;            // 'YYYY-MM-DD' — когда возник
  dueDate?: string;        // 'YYYY-MM-DD' — до какого числа вернуть
  note?: string;           // за что
  payments: DebtPayment[]; // возвраты по порядку
  closedAt?: string;       // ISO — закрыт без полной выплаты
}

/** Итог дня: закрывается вечером на «Сегодня». `id` — дата дня. */
export interface DailyLog extends Base {
  date: string;            // 'YYYY-MM-DD', совпадает с id
  energy?: 1 | 2 | 3 | 4 | 5;
  done: number;
  skipped: number;
  moved: number;
  accuracy?: number;       // медиана «факт / план»
  focusMinutes: number;
  goalMinutes: number;
  closedAt: string;        // ISO
}

export interface Schema {
  profiles: Profile;
  dreams: Dream;
  goals: Goal;
  boards: Board;
  columns: Column;
  tasks: Task;
  reminders: Reminder;
  lists: List;
  listItems: ListItem;
  noteFolders: NoteFolder;
  notes: Note;
  dailyLogs: DailyLog;
  debts: Debt;
}

export type CollectionName = keyof Schema;
export type Row<K extends CollectionName> = Schema[K];

export const COLLECTIONS: CollectionName[] = [
  'profiles', 'dreams', 'goals', 'boards', 'columns', 'tasks',
  'reminders', 'lists', 'listItems', 'noteFolders', 'notes', 'dailyLogs', 'debts',
];
