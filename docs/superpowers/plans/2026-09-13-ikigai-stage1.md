# Ikigai — план реализации этапа 1 («Ядро»)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Рабочий веб-сайт Ikigai для одного пользователя: Сегодня, Календарь, Доски, Цели, Мечты, Напоминания, Списки, Блокнот, Настройки; данные хранятся в браузере; затем облако Supabase, Telegram-бот и утренняя сводка.

**Architecture:** Статический SPA (Vite + React + TS). Весь доступ к данным идёт через интерфейс `Store` (list/put/remove/subscribe) с двумя реализациями: `LocalStore` (Dexie/IndexedDB, работает без интернета и без регистраций) и `SupabaseStore` (облако, одна таблица `rows` с jsonb). Доменная логика — чистые функции в `src/lib/domain/*` с тестами. Бот и утренняя сводка — Supabase Edge Functions (Deno), используют копию доменных функций из `supabase/functions/_shared`.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind CSS 4, react-router-dom 7, dexie 4, @dnd-kit/core + @dnd-kit/sortable, date-fns 4, lucide-react, nanoid, vitest, @testing-library/react, fake-indexeddb, @supabase/supabase-js 2.

Спецификация: `docs/superpowers/specs/2026-09-13-ikigai-design.md`. Стиль «Путь воина» — см. раздел 3 спецификации.

**Правила для исполнителя:**
- Интерфейс полностью на русском. Тексты в sentence case, без восклицательных знаков в системных сообщениях.
- Никаких градиентов, теней-свечений. Тонкие линии, золото как единственный акцент, алый — для важного.
- Node: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"` перед командами, если `node` не найден.
- Коммит после каждой задачи. Сообщение коммита заканчивается строкой `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Никогда не запускать команды, которые могут удалить существующие файлы (`--overwrite`, `rm -rf` вне `node_modules`/`dist`).**

---

## Структура файлов

```
ikigai/
  index.html, package.json, vite.config.ts, tsconfig.json, vitest.config.ts, .env.example, .gitignore
  src/
    main.tsx                       — точка входа, роутер
    App.tsx                        — маршруты
    styles/globals.css             — Tailwind + токены стиля
    lib/types.ts                   — типы сущностей, Schema, CollectionName
    lib/ids.ts                     — newId(), nowISO()
    lib/dates.ts                   — todayISO(), форматирование дат по-русски, weekRange
    lib/kanji.ts                   — иероглифы разделов
    lib/domain/reminders.ts        — reminderOccursOn, nextOccurrence, daysUntil
    lib/domain/tasks.ts            — tasksForDate, carriedOverTasks, planVsFact, minutesBetween
    lib/domain/goals.ts            — goalProgress
    lib/domain/digest.ts           — buildMorningDigest, shouldSendMorning, localClock
    data/store.ts                  — интерфейс Store + Emitter
    data/local.ts                  — LocalStore (Dexie)
    data/supabase.ts               — SupabaseStore (этап «облако»)
    data/index.ts                  — выбор store по env
    data/hooks.ts                  — useCollection, useProfile, useStoreStatus
    data/seed.ts                   — демо-данные
    data/exportImport.ts           — экспорт/импорт JSON
    app/Shell.tsx                  — каркас: сайдбар, топбар, мобильная панель
    app/Sidebar.tsx, app/MobileNav.tsx, app/TopBar.tsx, app/nav.ts
    components/ui/Button.tsx, Input.tsx, Select.tsx, Modal.tsx, SidePanel.tsx,
      ProgressBar.tsx, Kanji.tsx, EmptyState.tsx, Toast.tsx, Checkbox.tsx, IconPicker.tsx
    features/tasks/useTaskActions.ts, TaskEditor.tsx, TaskCard.tsx, TaskTimer.tsx
    features/quick/QuickCapture.tsx
    features/search/SearchDialog.tsx
    features/today/TodayPage.tsx, Timeline.tsx
    features/calendar/CalendarPage.tsx, MonthView.tsx, WeekView.tsx, DayView.tsx
    features/boards/BoardsPage.tsx, BoardView.tsx, ColumnView.tsx
    features/goals/GoalsPage.tsx, GoalTree.tsx, GoalDetail.tsx, GoalEditor.tsx
    features/dreams/DreamsPage.tsx, DreamCard.tsx, DreamEditor.tsx
    features/reminders/RemindersPage.tsx, ReminderEditor.tsx
    features/lists/ListsPage.tsx, ListDetail.tsx
    features/notes/NotesPage.tsx, NoteEditor.tsx
    features/settings/SettingsPage.tsx
    features/auth/LoginPage.tsx    — только для облака
  supabase/
    migrations/0001_init.sql
    functions/_shared/domain.ts    — копия reminders + digest
    functions/_shared/tg.ts        — отправка в Telegram
    functions/_shared/ai.ts        — разбор сообщения через Anthropic
    functions/_shared/db.ts        — доступ к таблице rows
    functions/telegram-webhook/index.ts
    functions/cron-tick/index.ts
  docs/SETUP.md                    — пошаговая инструкция подключения облака и бота (для владельца)
```

---

### Task 0: Инициализация проекта

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`, `.env.example`, `src/main.tsx`, `src/App.tsx`, `src/styles/globals.css`

- [ ] **Step 1: git init и scaffold**

Каркас Vite react-ts уже создан в папке (package.json, src/, index.html, tsconfig*.json, vite.config.ts). Не пересоздавать. Установить зависимости:

```bash
cd ~/Desktop/ikigai
npm i react-router-dom dexie @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities date-fns lucide-react nanoid @supabase/supabase-js
npm i -D tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/jest-dom jsdom fake-indexeddb @types/node
```

- [ ] **Step 2: Конфиги**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], globals: true },
});
```

`src/test-setup.ts`:
```ts
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
```

В `tsconfig.app.json` добавить `"baseUrl": ".", "paths": { "@/*": ["src/*"] }` внутри `compilerOptions`. В `package.json` scripts добавить `"test": "vitest run"`.

`.env.example`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`.gitignore`: добавить `.env`, `.env.local`, `supabase/.temp`.

- [ ] **Step 3: Стиль (globals.css)**

`index.html`: `<html lang="ru">`, `<title>Ikigai</title>`, в `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&family=Inter:wght@400;500;600&family=Noto+Serif+JP:wght@500;700&display=swap" rel="stylesheet">
```

`src/styles/globals.css`:
```css
@import "tailwindcss";

@theme {
  --color-bg: #0F0F10;
  --color-surface: #19191B;
  --color-surface-2: #202023;
  --color-border: #2A2A2C;
  --color-text: #ECECEC;
  --color-muted: #8A8A8E;
  --color-gold: #C9A227;
  --color-gold-dim: #8C7119;
  --color-crimson: #C8102E;
  --font-serif: "Noto Serif JP", serif;
  --font-display: "Cinzel", serif;
  --font-sans: "Inter", system-ui, sans-serif;
  --radius-card: 8px;
}

html, body, #root { height: 100%; }
body { background: var(--color-bg); color: var(--color-text); font-family: var(--font-sans); }
h1, h2, h3 { font-family: var(--font-serif); }
* { transition: background-color 150ms, border-color 150ms, color 150ms; }
::selection { background: var(--color-gold); color: #0F0F10; }
.scroll-thin::-webkit-scrollbar { width: 6px; }
.scroll-thin::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 3px; }
```

- [ ] **Step 4: main.tsx и App.tsx (заглушка)**

`src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

`src/App.tsx` временно:
```tsx
export default function App() {
  return <div className="p-8 font-display text-gold tracking-[0.3em]">IKIGAI</div>;
}
```

Удалить из каркаса лишнее: `src/App.css`, `src/index.css`, `src/assets/react.svg`, `public/vite.svg` (если есть).

- [ ] **Step 5: Проверка и коммит**

Run: `npm run build && npm test`
Expected: сборка без ошибок; vitest сообщает «No test files found» (это нормально).

```bash
git add -A && git commit -m "chore: scaffold Vite + React + Tailwind project

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 1: Типы, идентификаторы, даты, иероглифы

**Files:**
- Create: `src/lib/types.ts`, `src/lib/ids.ts`, `src/lib/dates.ts`, `src/lib/kanji.ts`, `src/lib/dates.test.ts`

- [ ] **Step 1: types.ts**

```ts
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
}

export interface Dream extends Base {
  title: string;
  description?: string;
  imageDataUrl?: string;   // локально: data URL; в облаке: путь в Storage
  category?: string;
  doneAt?: string;         // ISO date
  goalId?: ID;
}

export interface Goal extends Base {
  title: string;
  description?: string;
  horizon: Horizon;
  parentId?: ID;
  dreamId?: ID;
  startDate?: string;      // 'YYYY-MM-DD'
  endDate?: string;
  status: GoalStatus;
}

export interface Board extends Base { title: string; position: number; }
export interface Column extends Base { boardId: ID; title: string; kind: ColumnKind; position: number; }

export interface Task extends Base {
  title: string;
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

export interface List extends Base { title: string; icon: string; position: number; pinned: boolean; }
export interface ListItem extends Base {
  listId: ID; text: string; note?: string; url?: string; price?: number; doneAt?: string; position: number;
}

export interface NoteFolder extends Base { title: string; position: number; }
export interface Note extends Base { folderId?: ID; title: string; body: string; source: Source; }

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
}

export type CollectionName = keyof Schema;
export type Row<K extends CollectionName> = Schema[K];

export const COLLECTIONS: CollectionName[] = [
  'profiles', 'dreams', 'goals', 'boards', 'columns', 'tasks',
  'reminders', 'lists', 'listItems', 'noteFolders', 'notes',
];
```

- [ ] **Step 2: ids.ts**

```ts
import { nanoid } from 'nanoid';
export const newId = () => nanoid(12);
export const nowISO = () => new Date().toISOString();
```

- [ ] **Step 3: dates.test.ts (падающий тест)**

```ts
import { describe, it, expect } from 'vitest';
import { toDateISO, formatDayRu, weekRange, addDaysISO, timeToMinutes } from './dates';

describe('dates', () => {
  it('toDateISO formats a Date as YYYY-MM-DD in local time', () => {
    expect(toDateISO(new Date(2026, 8, 13))).toBe('2026-09-13');
  });
  it('formatDayRu returns Russian weekday and date', () => {
    expect(formatDayRu('2026-09-13')).toBe('воскресенье, 13 сентября');
  });
  it('weekRange returns Monday..Sunday', () => {
    expect(weekRange('2026-09-13')).toEqual({ start: '2026-09-07', end: '2026-09-13' });
    expect(weekRange('2026-09-14')).toEqual({ start: '2026-09-14', end: '2026-09-20' });
  });
  it('addDaysISO adds days', () => {
    expect(addDaysISO('2026-09-30', 1)).toBe('2026-10-01');
  });
  it('timeToMinutes parses HH:mm', () => {
    expect(timeToMinutes('09:30')).toBe(570);
  });
});
```

Run: `npm test` → FAIL (модуль не найден).

- [ ] **Step 4: dates.ts**

```ts
import { format, parseISO, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';

export const toDateISO = (d: Date) => format(d, 'yyyy-MM-dd');
export const todayISO = () => toDateISO(new Date());
export const parseDate = (iso: string) => parseISO(iso);

export const formatDayRu = (iso: string) => format(parseISO(iso), 'EEEE, d MMMM', { locale: ru });
export const formatShortRu = (iso: string) => format(parseISO(iso), 'd MMM', { locale: ru });
export const formatMonthRu = (iso: string) => format(parseISO(iso), 'LLLL yyyy', { locale: ru });

export const weekRange = (iso: string) => {
  const d = parseISO(iso);
  return {
    start: toDateISO(startOfWeek(d, { weekStartsOn: 1 })),
    end: toDateISO(endOfWeek(d, { weekStartsOn: 1 })),
  };
};

export const addDaysISO = (iso: string, n: number) => toDateISO(addDays(parseISO(iso), n));

export const timeToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const minutesToTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const greetingRu = (hour: number) =>
  hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
```

- [ ] **Step 5: kanji.ts**

```ts
export const KANJI = {
  today: '今', calendar: '暦', boards: '板', goals: '志', dreams: '夢',
  reminders: '鐘', lists: '録', notes: '記', analytics: '測', codex: '道', settings: '設',
} as const;
export type SectionKey = keyof typeof KANJI;
```

- [ ] **Step 6: Тесты и коммит**

Run: `npm test` → PASS (5 тестов).

```bash
git add -A && git commit -m "feat: entity types, ids, date helpers, kanji map

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Доменная логика (чистые функции, TDD)

**Files:**
- Create: `src/lib/domain/reminders.ts`, `reminders.test.ts`, `tasks.ts`, `tasks.test.ts`, `goals.ts`, `goals.test.ts`

- [ ] **Step 1: reminders.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { reminderOccursOn, nextOccurrence, daysUntil } from './reminders';
import type { Reminder } from '@/lib/types';

const base = { id: 'r', createdAt: '', updatedAt: '', text: 'x', time: undefined } as const;
const r = (date: string, repeat: Reminder['repeat']): Reminder => ({ ...base, date, repeat });

describe('reminderOccursOn', () => {
  it('none: only on its date', () => {
    expect(reminderOccursOn(r('2026-09-13', 'none'), '2026-09-13')).toBe(true);
    expect(reminderOccursOn(r('2026-09-13', 'none'), '2026-09-14')).toBe(false);
  });
  it('daily: every day from start', () => {
    expect(reminderOccursOn(r('2026-09-13', 'daily'), '2026-09-20')).toBe(true);
    expect(reminderOccursOn(r('2026-09-13', 'daily'), '2026-09-12')).toBe(false);
  });
  it('weekly: same weekday', () => {
    expect(reminderOccursOn(r('2026-09-13', 'weekly'), '2026-09-20')).toBe(true);
    expect(reminderOccursOn(r('2026-09-13', 'weekly'), '2026-09-21')).toBe(false);
  });
  it('monthly: same day of month', () => {
    expect(reminderOccursOn(r('2026-01-31', 'monthly'), '2026-03-31')).toBe(true);
    expect(reminderOccursOn(r('2026-01-31', 'monthly'), '2026-02-28')).toBe(false);
  });
  it('yearly: same month and day', () => {
    expect(reminderOccursOn(r('1994-03-14', 'yearly'), '2026-03-14')).toBe(true);
    expect(reminderOccursOn(r('1994-03-14', 'yearly'), '2026-03-15')).toBe(false);
  });
});

describe('nextOccurrence / daysUntil', () => {
  it('yearly next occurrence after today', () => {
    expect(nextOccurrence(r('1994-03-14', 'yearly'), '2026-09-13')).toBe('2027-03-14');
    expect(daysUntil(r('1994-03-14', 'yearly'), '2026-09-13')).toBe(182);
  });
  it('none in the past returns null', () => {
    expect(nextOccurrence(r('2026-01-01', 'none'), '2026-09-13')).toBeNull();
  });
  it('today counts as 0 days', () => {
    expect(daysUntil(r('2026-09-13', 'none'), '2026-09-13')).toBe(0);
  });
});
```

- [ ] **Step 2: reminders.ts**

```ts
import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Reminder } from '@/lib/types';
import { addDaysISO } from '@/lib/dates';

export function reminderOccursOn(r: Reminder, dateISO: string): boolean {
  if (dateISO < r.date) return false;
  if (r.repeat === 'none') return r.date === dateISO;
  if (r.repeat === 'daily') return true;
  const a = parseISO(r.date), b = parseISO(dateISO);
  if (r.repeat === 'weekly') return a.getDay() === b.getDay();
  if (r.repeat === 'monthly') return a.getDate() === b.getDate();
  return a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); // yearly
}

/** Ближайшая дата (включая fromISO), когда напоминание сработает; null если больше не сработает. */
export function nextOccurrence(r: Reminder, fromISO: string): string | null {
  if (r.repeat === 'none') return r.date >= fromISO ? r.date : null;
  let d = fromISO < r.date ? r.date : fromISO;
  for (let i = 0; i < 400; i++) {
    if (reminderOccursOn(r, d)) return d;
    d = addDaysISO(d, 1);
  }
  return null;
}

export function daysUntil(r: Reminder, fromISO: string): number | null {
  const next = nextOccurrence(r, fromISO);
  return next ? differenceInCalendarDays(parseISO(next), parseISO(fromISO)) : null;
}
```

Run: `npm test` → PASS.

- [ ] **Step 3: tasks.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { tasksForDate, carriedOverTasks, planVsFact, minutesBetween, sortByPlannedStart } from './tasks';
import type { Task } from '@/lib/types';

const t = (p: Partial<Task>): Task => ({
  id: 't', createdAt: '', updatedAt: '', title: 'x', area: 'personal', status: 'todo',
  rescheduleCount: 0, source: 'web', kind: 'task', position: 0, ...p,
});

describe('tasks', () => {
  it('tasksForDate filters by date', () => {
    const a = t({ id: 'a', date: '2026-09-13' }), b = t({ id: 'b', date: '2026-09-14' });
    expect(tasksForDate([a, b], '2026-09-13').map(x => x.id)).toEqual(['a']);
  });
  it('carriedOverTasks = unfinished tasks dated before today', () => {
    const old = t({ id: 'o', date: '2026-09-10' });
    const oldDone = t({ id: 'd', date: '2026-09-10', status: 'done' });
    const today = t({ id: 'n', date: '2026-09-13' });
    expect(carriedOverTasks([old, oldDone, today], '2026-09-13').map(x => x.id)).toEqual(['o']);
  });
  it('minutesBetween rounds to whole minutes', () => {
    expect(minutesBetween('2026-09-13T10:00:00Z', '2026-09-13T11:35:30Z')).toBe(96);
  });
  it('planVsFact returns both when available', () => {
    const task = t({ plannedMinutes: 60, actualStart: '2026-09-13T10:00:00Z', actualEnd: '2026-09-13T11:35:00Z' });
    expect(planVsFact(task)).toEqual({ planned: 60, actual: 95 });
    expect(planVsFact(t({}))).toBeNull();
  });
  it('sortByPlannedStart puts timed tasks first in time order', () => {
    const a = t({ id: 'a', plannedStart: '14:00' }), b = t({ id: 'b' }), c = t({ id: 'c', plannedStart: '09:00' });
    expect(sortByPlannedStart([a, b, c]).map(x => x.id)).toEqual(['c', 'a', 'b']);
  });
});
```

- [ ] **Step 4: tasks.ts**

```ts
import type { Task } from '@/lib/types';

export const tasksForDate = (tasks: Task[], dateISO: string) => tasks.filter(t => t.date === dateISO);

export const carriedOverTasks = (tasks: Task[], todayISO: string) =>
  tasks.filter(t => !!t.date && t.date < todayISO && (t.status === 'todo' || t.status === 'doing'));

export const minutesBetween = (aISO: string, bISO: string) =>
  Math.round((new Date(bISO).getTime() - new Date(aISO).getTime()) / 60000);

export function planVsFact(t: Task): { planned: number; actual: number } | null {
  if (!t.plannedMinutes || !t.actualStart || !t.actualEnd) return null;
  return { planned: t.plannedMinutes, actual: minutesBetween(t.actualStart, t.actualEnd) };
}

export const sortByPlannedStart = (tasks: Task[]) =>
  [...tasks].sort((a, b) => {
    if (a.plannedStart && b.plannedStart) return a.plannedStart.localeCompare(b.plannedStart);
    if (a.plannedStart) return -1;
    if (b.plannedStart) return 1;
    return a.position - b.position;
  });

export const runningTask = (tasks: Task[]) => tasks.find(t => t.status === 'doing');
```

Run: `npm test` → PASS.

- [ ] **Step 5: goals.test.ts и goals.ts**

```ts
// goals.test.ts
import { describe, it, expect } from 'vitest';
import { goalProgress, childGoals } from './goals';
import type { Goal, Task } from '@/lib/types';

const g = (p: Partial<Goal>): Goal => ({ id: 'g', createdAt: '', updatedAt: '', title: 'g', horizon: 'month', status: 'active', ...p });
const t = (p: Partial<Task>): Task => ({ id: 't', createdAt: '', updatedAt: '', title: 't', area: 'work', status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: 0, ...p });

describe('goalProgress', () => {
  it('is 0 with nothing linked', () => {
    expect(goalProgress(g({ id: 'a' }), [], [])).toBe(0);
  });
  it('counts done tasks and done subgoals equally', () => {
    const goals = [g({ id: 'a' }), g({ id: 'b', parentId: 'a', status: 'done' }), g({ id: 'c', parentId: 'a' })];
    const tasks = [t({ id: '1', goalId: 'a', status: 'done' }), t({ id: '2', goalId: 'a' })];
    expect(goalProgress(goals[0], goals, tasks)).toBe(0.5); // 2 of 4
  });
  it('is 1 when goal itself is done', () => {
    expect(goalProgress(g({ id: 'a', status: 'done' }), [], [])).toBe(1);
  });
  it('childGoals returns direct children', () => {
    const goals = [g({ id: 'a' }), g({ id: 'b', parentId: 'a' })];
    expect(childGoals(goals, 'a').map(x => x.id)).toEqual(['b']);
  });
});
```

```ts
// goals.ts
import type { Goal, Task } from '@/lib/types';

export const childGoals = (goals: Goal[], parentId: string) => goals.filter(g => g.parentId === parentId);

export function goalProgress(goal: Goal, goals: Goal[], tasks: Task[]): number {
  if (goal.status === 'done') return 1;
  const subs = childGoals(goals, goal.id);
  const own = tasks.filter(t => t.goalId === goal.id && t.status !== 'skipped');
  const total = subs.length + own.length;
  if (total === 0) return 0;
  const done = subs.filter(s => s.status === 'done').length + own.filter(t => t.status === 'done').length;
  return done / total;
}

export const HORIZON_LABEL: Record<Goal['horizon'], string> = {
  years: 'Несколько лет', year: 'Год', month: 'Месяц', week: 'Неделя',
};
```

Run: `npm test` → PASS.

- [ ] **Step 6: Коммит**

```bash
git add -A && git commit -m "feat: domain logic for reminders, tasks, goals with tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Утренняя сводка и «пора ли отправлять» (чистые функции)

**Files:**
- Create: `src/lib/domain/digest.ts`, `src/lib/domain/digest.test.ts`

- [ ] **Step 1: digest.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { buildMorningDigest, shouldSendMorning, localClock } from './digest';

describe('localClock', () => {
  it('returns date and HH:mm in the given timezone', () => {
    expect(localClock(new Date('2026-09-13T03:05:00Z'), 'Asia/Almaty')).toEqual({ date: '2026-09-13', time: '08:05' });
    expect(localClock(new Date('2026-09-12T20:30:00Z'), 'Asia/Almaty')).toEqual({ date: '2026-09-13', time: '01:30' });
  });
});

describe('shouldSendMorning', () => {
  const tz = 'Asia/Almaty';
  it('sends when local time >= morningTime and not sent today', () => {
    expect(shouldSendMorning(new Date('2026-09-13T04:02:00Z'), tz, '09:00', null)).toBe(true);
  });
  it('does not send before morningTime', () => {
    expect(shouldSendMorning(new Date('2026-09-13T03:55:00Z'), tz, '09:00', null)).toBe(false);
  });
  it('does not send twice the same day', () => {
    expect(shouldSendMorning(new Date('2026-09-13T04:02:00Z'), tz, '09:00', '2026-09-13')).toBe(false);
  });
  it('does not send if more than 2 hours late (missed window)', () => {
    expect(shouldSendMorning(new Date('2026-09-13T07:00:00Z'), tz, '09:00', null)).toBe(false);
  });
});

describe('buildMorningDigest', () => {
  it('renders all sections in order', () => {
    const text = buildMorningDigest({
      dateLabel: 'воскресенье, 13 сентября',
      weekGoal: { title: 'Запустить сайт', progress: 0.4 },
      timed: [{ id: 't1', title: 'Тренировка', plannedStart: '07:00', plannedMinutes: 60 }],
      untimed: [{ id: 't2', title: 'Позвонить маме' }],
      reminders: [{ text: 'ДР Асель', yearly: true }],
      carried: [{ id: 't3', title: 'Отчёт' }],
      principle: 'Дисциплина — это свобода',
    });
    expect(text).toContain('☀️ Доброе утро. Сегодня воскресенье, 13 сентября');
    expect(text).toContain('🎯 Цель недели: Запустить сайт — 40%');
    expect(text).toContain('07:00 · Тренировка (60 мин)');
    expect(text).toContain('• Позвонить маме');
    expect(text).toContain('🎂 ДР Асель');
    expect(text).toContain('↩️ Перенесено со вчера');
    expect(text).toContain('道 Дисциплина — это свобода');
  });
  it('omits empty sections', () => {
    const text = buildMorningDigest({ dateLabel: 'x', timed: [], untimed: [], reminders: [], carried: [] });
    expect(text).not.toContain('Цель недели');
    expect(text).toContain('Задач на сегодня нет');
  });
});
```

- [ ] **Step 2: digest.ts** (без зависимостей от других модулей — файл копируется в edge-функцию)

```ts
export interface DigestTask { id: string; title: string; plannedStart?: string; plannedMinutes?: number; }
export interface DigestInput {
  dateLabel: string;
  weekGoal?: { title: string; progress: number };
  timed: DigestTask[];
  untimed: DigestTask[];
  reminders: { text: string; time?: string; yearly?: boolean }[];
  carried: DigestTask[];
  principle?: string;
}

export function buildMorningDigest(i: DigestInput): string {
  const L: string[] = [`☀️ Доброе утро. Сегодня ${i.dateLabel}`, ''];
  if (i.weekGoal) L.push(`🎯 Цель недели: ${i.weekGoal.title} — ${Math.round(i.weekGoal.progress * 100)}%`, '');
  if (i.timed.length + i.untimed.length === 0) L.push('Задач на сегодня нет.');
  if (i.timed.length) {
    L.push('🕘 По времени:');
    for (const t of i.timed) L.push(`${t.plannedStart} · ${t.title}${t.plannedMinutes ? ` (${t.plannedMinutes} мин)` : ''}`);
    L.push('');
  }
  if (i.untimed.length) {
    L.push('📋 В течение дня:');
    for (const t of i.untimed) L.push(`• ${t.title}`);
    L.push('');
  }
  if (i.reminders.length) {
    L.push('🔔 Напоминания:');
    for (const r of i.reminders) L.push(`${r.yearly ? '🎂' : '•'} ${r.text}${r.time ? ` в ${r.time}` : ''}`);
    L.push('');
  }
  if (i.carried.length) {
    L.push('↩️ Перенесено со вчера:');
    for (const t of i.carried) L.push(`• ${t.title}`);
    L.push('');
  }
  if (i.principle) L.push(`道 ${i.principle}`);
  return L.join('\n').trim();
}

export function localClock(now: Date, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)!.value;
  const hour = get('hour') === '24' ? '00' : get('hour');
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${hour}:${get('minute')}` };
}

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** Отправлять, если в часовом поясе пользователя уже наступило morningTime (но прошло не больше 2 часов) и сегодня ещё не отправляли. */
export function shouldSendMorning(now: Date, timeZone: string, morningTime: string, lastSentDate: string | null): boolean {
  const { date, time } = localClock(now, timeZone);
  if (lastSentDate === date) return false;
  const diff = toMin(time) - toMin(morningTime);
  return diff >= 0 && diff <= 120;
}
```

- [ ] **Step 3: Тесты и коммит**

Run: `npm test` → PASS.

```bash
git add -A && git commit -m "feat: morning digest builder and send-window logic

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Слой данных — Store, LocalStore (Dexie), хуки, демо-данные

**Files:**
- Create: `src/data/store.ts`, `src/data/local.ts`, `src/data/local.test.ts`, `src/data/index.ts`, `src/data/hooks.ts`, `src/data/seed.ts`, `src/data/exportImport.ts`

- [ ] **Step 1: store.ts**

```ts
import type { CollectionName, Row } from '@/lib/types';

export type StoreStatus = 'ok' | 'saving' | 'offline';

export interface Store {
  list<K extends CollectionName>(name: K): Promise<Row<K>[]>;
  put<K extends CollectionName>(name: K, row: Row<K>): Promise<void>;
  putMany<K extends CollectionName>(name: K, rows: Row<K>[]): Promise<void>;
  remove<K extends CollectionName>(name: K, id: string): Promise<void>;
  subscribe(name: CollectionName | '*', cb: () => void): () => void;
  clearAll(): Promise<void>;
  status(): StoreStatus;
  onStatus(cb: (s: StoreStatus) => void): () => void;
}

export class Emitter {
  private subs = new Map<string, Set<() => void>>();
  on(key: string, cb: () => void) {
    if (!this.subs.has(key)) this.subs.set(key, new Set());
    this.subs.get(key)!.add(cb);
    return () => { this.subs.get(key)?.delete(cb); };
  }
  emit(key: string) {
    this.subs.get(key)?.forEach(cb => cb());
    if (key !== '*') this.subs.get('*')?.forEach(cb => cb());
  }
}
```

- [ ] **Step 2: local.test.ts**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStore } from './local';

describe('LocalStore', () => {
  let store: LocalStore;
  beforeEach(async () => { store = new LocalStore('test-' + Math.random()); });

  it('puts, lists, removes', async () => {
    await store.put('boards', { id: 'b1', title: 'Работа', position: 0, createdAt: 'a', updatedAt: 'a' });
    expect((await store.list('boards')).map(b => b.title)).toEqual(['Работа']);
    await store.remove('boards', 'b1');
    expect(await store.list('boards')).toEqual([]);
  });

  it('notifies subscribers of the collection and of *', async () => {
    let n = 0, all = 0;
    store.subscribe('boards', () => n++);
    store.subscribe('*', () => all++);
    await store.put('boards', { id: 'b1', title: 'x', position: 0, createdAt: 'a', updatedAt: 'a' });
    expect(n).toBe(1); expect(all).toBe(1);
  });

  it('put with same id replaces', async () => {
    await store.put('boards', { id: 'b1', title: 'x', position: 0, createdAt: 'a', updatedAt: 'a' });
    await store.put('boards', { id: 'b1', title: 'y', position: 0, createdAt: 'a', updatedAt: 'b' });
    expect((await store.list('boards'))[0].title).toBe('y');
  });
});
```

- [ ] **Step 3: local.ts**

```ts
import Dexie, { type Table } from 'dexie';
import type { CollectionName, Row } from '@/lib/types';
import { COLLECTIONS } from '@/lib/types';
import { Emitter, type Store, type StoreStatus } from './store';

class IkigaiDB extends Dexie {
  constructor(name: string) {
    super(name);
    const stores: Record<string, string> = {};
    for (const c of COLLECTIONS) stores[c] = 'id';
    this.version(1).stores(stores);
  }
  table<K extends CollectionName>(name: K): Table<Row<K>, string> {
    return super.table(name) as Table<Row<K>, string>;
  }
}

export class LocalStore implements Store {
  private db: IkigaiDB;
  private em = new Emitter();
  constructor(name = 'ikigai') { this.db = new IkigaiDB(name); }

  async list<K extends CollectionName>(name: K) { return this.db.table(name).toArray(); }
  async put<K extends CollectionName>(name: K, row: Row<K>) { await this.db.table(name).put(row); this.em.emit(name); }
  async putMany<K extends CollectionName>(name: K, rows: Row<K>[]) { await this.db.table(name).bulkPut(rows); this.em.emit(name); }
  async remove<K extends CollectionName>(name: K, id: string) { await this.db.table(name).delete(id); this.em.emit(name); }
  subscribe(name: CollectionName | '*', cb: () => void) { return this.em.on(name, cb); }
  async clearAll() { for (const c of COLLECTIONS) await this.db.table(c).clear(); this.em.emit('*'); }
  status(): StoreStatus { return 'ok'; }
  onStatus() { return () => {}; }
}
```

Run: `npm test` → PASS.

- [ ] **Step 4: index.ts, hooks.ts**

```ts
// index.ts
import type { Store } from './store';
import { LocalStore } from './local';

let instance: Store | null = null;
export function getStore(): Store {
  if (!instance) instance = new LocalStore();
  return instance;
}
export function setStore(s: Store) { instance = s; }
```

```ts
// hooks.ts
import { useEffect, useState, useCallback } from 'react';
import type { CollectionName, Row, Profile } from '@/lib/types';
import { getStore } from './index';
import { nowISO } from '@/lib/ids';
import type { StoreStatus } from './store';

export function useCollection<K extends CollectionName>(name: K): Row<K>[] {
  const [rows, setRows] = useState<Row<K>[]>([]);
  useEffect(() => {
    let alive = true;
    const store = getStore();
    const load = () => store.list(name).then(r => { if (alive) setRows(r); });
    load();
    const unsub = store.subscribe(name, load);
    return () => { alive = false; unsub(); };
  }, [name]);
  return rows;
}

export const DEFAULT_PROFILE: Profile = {
  id: 'me', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Almaty',
  morningTime: '09:00', currency: 'KZT', createdAt: nowISO(), updatedAt: nowISO(),
};

export function useProfile(): [Profile, (patch: Partial<Profile>) => Promise<void>] {
  const profiles = useCollection('profiles');
  const profile = profiles[0] ?? DEFAULT_PROFILE;
  const update = useCallback(async (patch: Partial<Profile>) => {
    await getStore().put('profiles', { ...profile, ...patch, id: 'me', updatedAt: nowISO() });
  }, [profile]);
  return [profile, update];
}

export function useStoreStatus(): StoreStatus {
  const [s, setS] = useState<StoreStatus>(getStore().status());
  useEffect(() => getStore().onStatus(setS), []);
  return s;
}

/** Универсальные операции записи с автоматическими updatedAt. */
export function useRepo() {
  const store = getStore();
  return {
    put: <K extends CollectionName>(name: K, row: Row<K>) => store.put(name, { ...row, updatedAt: nowISO() }),
    remove: <K extends CollectionName>(name: K, id: string) => store.remove(name, id),
  };
}
```

- [ ] **Step 5: seed.ts**

```ts
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
  const now = nowISO(), today = todayISO();
  const boards = await store.list('boards');
  const columns = await store.list('columns');
  const todoCol = (boardId: string) => columns.find(c => c.boardId === boardId && c.kind === 'todo')!.id;
  const work = boards.find(b => b.title === 'Работа')!, personal = boards.find(b => b.title === 'Личное')!;
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
    { id: newId(), title: 'Тренировка', area: 'personal', boardId: personal.id, columnId: todoCol(personal.id), date: today, plannedStart: '07:00', plannedMinutes: 60, status: 'todo', rescheduleCount: 0, source: 'web', kind: 'workout', position: 0, important: true, ...base },
    { id: newId(), title: 'Глубокая работа над сайтом', area: 'work', boardId: work.id, columnId: todoCol(work.id), goalId: gWeek, date: today, plannedStart: '10:00', plannedMinutes: 120, status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: 1, ...base },
    { id: newId(), title: 'Позвонить маме', area: 'personal', boardId: personal.id, columnId: todoCol(personal.id), date: today, status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: 2, ...base },
    { id: newId(), title: 'Разобрать почту', area: 'work', boardId: work.id, columnId: todoCol(work.id), date: addDaysISO(today, -1), status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: 3, ...base },
  ]);
  await store.putMany('reminders', [
    { id: newId(), text: 'Оплатить интернет', date: today.slice(0, 8) + '05', repeat: 'monthly', ...base },
    { id: newId(), text: 'ДР мамы', date: '1970-' + addDaysISO(today, 12).slice(5), repeat: 'yearly', ...base },
  ]);
  const list = (await store.list('lists'))[0];
  await store.putMany('listItems', [
    { id: newId(), listId: list.id, text: 'Наушники', price: 45000, position: 0, ...base },
    { id: newId(), listId: list.id, text: 'Кроссовки для бега', price: 60000, position: 1, ...base },
  ]);
  const folder = (await store.list('noteFolders'))[0];
  await store.putMany('notes', [
    { id: newId(), folderId: folder.id, title: 'Идея', body: 'Каждое утро — 10 минут планирования до телефона.', source: 'web', ...base },
  ]);
  const profiles = await store.list('profiles');
  const p = profiles[0] ?? { id: 'me' as const, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, morningTime: '09:00', currency: 'KZT', ...base };
  await store.put('profiles', { ...p, weekGoalId: gWeek, demoLoaded: true, updatedAt: now });
}
```

- [ ] **Step 6: exportImport.ts**

```ts
import type { Store } from './store';
import { COLLECTIONS, type CollectionName } from '@/lib/types';

export async function exportAll(store: Store): Promise<string> {
  const out: Record<string, unknown[]> = {};
  for (const c of COLLECTIONS) out[c] = await store.list(c);
  return JSON.stringify({ app: 'ikigai', version: 1, exportedAt: new Date().toISOString(), data: out }, null, 2);
}

export async function importAll(store: Store, json: string) {
  const parsed = JSON.parse(json) as { app: string; data: Record<CollectionName, unknown[]> };
  if (parsed.app !== 'ikigai') throw new Error('Это не файл экспорта Ikigai');
  for (const c of COLLECTIONS) {
    const rows = parsed.data[c];
    if (Array.isArray(rows) && rows.length) await store.putMany(c, rows as never);
  }
}

export function downloadText(filename: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
```

- [ ] **Step 7: Тесты и коммит**

Run: `npm test && npx tsc -p tsconfig.app.json --noEmit` → PASS, без ошибок типов.

```bash
git add -A && git commit -m "feat: Store interface, Dexie LocalStore, hooks, seed and export

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: UI-компоненты и каркас (сайдбар, топбар, мобильная панель, маршруты)

**Files:**
- Create: `src/components/ui/{Button,Input,Select,Checkbox,Modal,SidePanel,ProgressBar,Kanji,EmptyState,Toast,IconPicker}.tsx`, `src/app/{nav.ts,Shell.tsx,Sidebar.tsx,TopBar.tsx,MobileNav.tsx}`
- Modify: `src/App.tsx`

- [ ] **Step 1: Базовые компоненты**

`Button.tsx`:
```tsx
import type { ButtonHTMLAttributes } from 'react';
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ variant = 'secondary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const v = {
    primary: 'bg-gold text-bg hover:bg-[#d9b23a] font-medium',
    secondary: 'border border-border text-text hover:border-gold hover:text-gold',
    ghost: 'text-muted hover:text-text',
    danger: 'border border-crimson text-crimson hover:bg-crimson hover:text-text',
  }[variant];
  return <button className={`px-3 h-9 rounded-card text-sm inline-flex items-center gap-2 disabled:opacity-40 ${v} ${className}`} {...p} />;
}
```

`Input.tsx` / `Select.tsx` — обёртки над `<input>`/`<select>` с классами `w-full h-9 px-3 rounded-card bg-surface border border-border focus:border-gold outline-none text-sm` и необязательным `label` (label — 12px, цвет muted, над полем). `Checkbox.tsx` — квадрат 18px с золотой галочкой (lucide `Check`), при `checked` фон золотой.

`Modal.tsx`: затемнение `bg-black/60`, окно `bg-surface border border-border rounded-card max-w-lg w-full p-5`, закрытие по Esc и клику на фон, `title` в serif. `SidePanel.tsx`: правая панель шириной 420px (на мобильном — во весь экран), тот же стиль, закрытие по Esc.

`ProgressBar.tsx`:
```tsx
export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={`h-1.5 bg-border rounded-full overflow-hidden ${className}`} role="progressbar" aria-valuenow={pct}>
      <div className="h-full bg-gold rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}
```

`Kanji.tsx`: `<span className="font-serif text-gold/80">{KANJI[k]}</span>`.

`EmptyState.tsx`: иероглиф крупно (48px, gold/40), заголовок serif, строка описания muted, кнопка действия.

`Toast.tsx`: контекст `ToastProvider` + хук `useToast()` → `toast(text, { kind?: 'ok'|'error' })`, показ снизу справа 3 с, ошибка — алая рамка.

`IconPicker.tsx`: сетка из 16 иконок lucide по имени: `shopping-bag, book, film, gift, plane, dumbbell, home, car, music, heart, star, briefcase, coffee, camera, gamepad-2, list`. Экспортировать `ICONS: Record<string, LucideIcon>` и `<ListIcon name />`.

- [ ] **Step 2: nav.ts**

```ts
import type { SectionKey } from '@/lib/kanji';
export interface NavItem { key: SectionKey; label: string; to: string; soon?: boolean; }
export const NAV: NavItem[] = [
  { key: 'today', label: 'Сегодня', to: '/' },
  { key: 'calendar', label: 'Календарь', to: '/calendar' },
  { key: 'boards', label: 'Доски', to: '/boards' },
  { key: 'goals', label: 'Цели', to: '/goals' },
  { key: 'dreams', label: 'Мечты', to: '/dreams' },
  { key: 'reminders', label: 'Напоминания', to: '/reminders' },
  { key: 'lists', label: 'Списки', to: '/lists' },
  { key: 'notes', label: 'Блокнот', to: '/notes' },
  { key: 'analytics', label: 'Аналитика', to: '/analytics', soon: true },
  { key: 'codex', label: 'Кодекс', to: '/codex', soon: true },
];
export const MOBILE_NAV: SectionKey[] = ['today', 'calendar', 'boards', 'notes'];
```

- [ ] **Step 3: Sidebar.tsx**

- Ширина 240px, `bg-surface border-r border-border`, сворачивается до 64px кнопкой внизу (состояние в `localStorage['ikigai.sidebar']`).
- Вверху логотип: `IKIGAI` (font-display, gold, tracking 0.3em, 18px) и под ним `生き甲斐` (serif, muted, 11px).
- Пункты из `NAV`: иероглиф + название; активный — `text-gold` с золотой полоской слева 2px; `soon` — muted, некликабельный, бейдж «скоро» 10px.
- После «Списки» — закреплённые списки (`useCollection('lists').filter(l => l.pinned)`) с их иконками, ссылка `/lists/:id`, отступ слева.
- Внизу: «Настройки» (`/settings`) и индикатор статуса хранилища (`useStoreStatus`): точка золотая «Сохранено», алая «Не сохранено».

- [ ] **Step 4: TopBar.tsx и MobileNav.tsx**

TopBar: слева заголовок раздела (serif 20px + иероглиф), справа кнопка поиска (lucide `Search`, откроет `SearchDialog` — Task 12) и `+ Быстрая запись` (primary; откроет `QuickCapture` — Task 6). Горячие клавиши: `N` — быстрая запись, `/` — поиск (не срабатывают, если фокус в поле ввода).

MobileNav: `fixed bottom-0`, видна `md:hidden`, 5 кнопок: 4 из `MOBILE_NAV` + «Ещё» (открывает Modal со всеми остальными пунктами и настройками). Активный — золотой.

- [ ] **Step 5: Shell.tsx и App.tsx**

Shell: `grid md:grid-cols-[auto_1fr] h-full`; Sidebar (`hidden md:flex`), справа `TopBar` + `<main className="p-4 md:p-8 pb-24 md:pb-8 overflow-y-auto scroll-thin">` с `<Outlet />`; `MobileNav`. При монтировании вызывает `ensureDefaults(getStore())` и, если профиля нет, — `loadDemo`. Оборачивает в `ToastProvider`.

App.tsx: маршруты `/`, `/calendar`, `/boards`, `/goals`, `/goals/:id`, `/dreams`, `/reminders`, `/lists`, `/lists/:id`, `/notes`, `/settings`, `/analytics`, `/codex` (для двух последних — страница-заглушка «Скоро» с иероглифом). Пока страницы не написаны — компонент `Placeholder` с названием раздела.

- [ ] **Step 6: Проверка в браузере и коммит**

Run: `npm run dev` и открыть http://localhost:5173. Проверить: сайдбар, переходы, сворачивание, мобильная панель при ширине < 768px. `npx tsc -p tsconfig.app.json --noEmit` без ошибок.

```bash
git add -A && git commit -m "feat: UI kit, app shell with sidebar, top bar and mobile nav

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Задачи — действия, редактор, карточка, таймер, быстрая запись

**Files:**
- Create: `src/features/tasks/useTaskActions.ts`, `useTaskActions.test.ts`, `TaskEditor.tsx`, `TaskCard.tsx`, `TaskTimer.tsx`, `src/features/quick/QuickCapture.tsx`

- [ ] **Step 1: useTaskActions.test.ts** (тестируем чистую часть — `taskOps`)

```ts
import { describe, it, expect } from 'vitest';
import { taskOps } from './useTaskActions';
import type { Task } from '@/lib/types';

const t = (p: Partial<Task>): Task => ({ id: 't', createdAt: '', updatedAt: '', title: 'x', area: 'work', status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: 0, ...p });

describe('taskOps', () => {
  it('start sets doing and actualStart', () => {
    const r = taskOps.start(t({}), '2026-09-13T05:00:00Z');
    expect(r.status).toBe('doing'); expect(r.actualStart).toBe('2026-09-13T05:00:00Z');
  });
  it('finish sets done and actualEnd; keeps actualStart', () => {
    const r = taskOps.finish(t({ status: 'doing', actualStart: 'a' }), 'b');
    expect(r).toMatchObject({ status: 'done', actualStart: 'a', actualEnd: 'b' });
  });
  it('finish without start still marks done', () => {
    expect(taskOps.finish(t({}), 'b').status).toBe('done');
  });
  it('reschedule changes date and increments counter', () => {
    const r = taskOps.reschedule(t({ date: '2026-09-12' }), '2026-09-13');
    expect(r.date).toBe('2026-09-13'); expect(r.rescheduleCount).toBe(1);
  });
  it('reopen returns to todo and clears actuals', () => {
    const r = taskOps.reopen(t({ status: 'done', actualStart: 'a', actualEnd: 'b' }));
    expect(r).toMatchObject({ status: 'todo', actualStart: undefined, actualEnd: undefined });
  });
});
```

- [ ] **Step 2: useTaskActions.ts**

```ts
import { useCallback } from 'react';
import type { Task, Column } from '@/lib/types';
import { useCollection, useRepo } from '@/data/hooks';
import { newId, nowISO } from '@/lib/ids';
import { useToast } from '@/components/ui/Toast';

export const taskOps = {
  start: (t: Task, at: string): Task => ({ ...t, status: 'doing', actualStart: at }),
  finish: (t: Task, at: string): Task => ({ ...t, status: 'done', actualEnd: at }),
  reschedule: (t: Task, date: string): Task => ({ ...t, date, rescheduleCount: t.rescheduleCount + 1 }),
  reopen: (t: Task): Task => ({ ...t, status: 'todo', actualStart: undefined, actualEnd: undefined }),
  skip: (t: Task): Task => ({ ...t, status: 'skipped' }),
};

export function newTask(p: Partial<Task> & { title: string }): Task {
  const now = nowISO();
  return { id: newId(), area: 'personal', status: 'todo', rescheduleCount: 0, source: 'web', kind: 'task', position: Date.now(), createdAt: now, updatedAt: now, ...p };
}

/** Переносит задачу в колонку нужного типа на её доске (для синхронизации статуса и канбана). */
export function columnFor(columns: Column[], boardId: string | undefined, kind: Column['kind']) {
  return columns.find(c => c.boardId === boardId && c.kind === kind)?.id;
}

export function useTaskActions() {
  const { put, remove } = useRepo();
  const tasks = useCollection('tasks');
  const columns = useCollection('columns');
  const { toast } = useToast();

  const save = useCallback((t: Task) => put('tasks', t), [put]);

  const start = useCallback(async (t: Task) => {
    const running = tasks.find(x => x.status === 'doing' && x.id !== t.id);
    if (running) { toast(`Сначала закончи «${running.title}»`, { kind: 'error' }); return; }
    await save({ ...taskOps.start(t, nowISO()), columnId: columnFor(columns, t.boardId, 'doing') ?? t.columnId });
  }, [tasks, columns, save, toast]);

  const finish = useCallback((t: Task) =>
    save({ ...taskOps.finish(t, nowISO()), columnId: columnFor(columns, t.boardId, 'done') ?? t.columnId }), [columns, save]);

  const reopen = useCallback((t: Task) =>
    save({ ...taskOps.reopen(t), columnId: columnFor(columns, t.boardId, 'todo') ?? t.columnId }), [columns, save]);

  const toggleDone = useCallback((t: Task) => (t.status === 'done' ? reopen(t) : finish(t)), [reopen, finish]);
  const reschedule = useCallback((t: Task, date: string) => save(taskOps.reschedule(t, date)), [save]);
  const skip = useCallback((t: Task) => save(taskOps.skip(t)), [save]);
  const del = useCallback((t: Task) => remove('tasks', t.id), [remove]);

  return { tasks, save, start, finish, reopen, toggleDone, reschedule, skip, del };
}
```

Run: `npm test` → PASS.

- [ ] **Step 3: TaskEditor.tsx**

`<TaskEditor task={Task | null} defaults={Partial<Task>} onClose />` в `SidePanel`. Поля: название (autofocus), заметка (textarea), сфера (Работа/Личное — две кнопки-переключателя), доска (Select из `boards`; при смене — columnId = колонка todo этой доски), цель (Select из активных `goals`, группировка по горизонту, «Без цели»), дата (`<input type="date">`), время (`type="time"`), длительность (Select: 15/30/45/60/90/120/180 мин или пусто), важная (Checkbox, алая метка), тип (Задача/Тренировка). Кнопки: «Сохранить» (primary, Enter), «Удалить» (danger, с confirm), «Отмена». При сохранении новой задачи — `newTask({...})`, иначе `save({...task, ...form})`. Если у задачи заполнены actualStart/actualEnd — показать строку «план N мин / факт M мин» (`planVsFact`).

- [ ] **Step 4: TaskCard.tsx и TaskTimer.tsx**

TaskCard: `bg-surface border border-border rounded-card px-3 py-2` с полоской слева 3px (`border-l-gold`, важная — `border-l-crimson`, готово — `border-l-border` и заголовок `line-through text-muted`). Содержимое: Checkbox (toggleDone), заголовок, мелко: время `07:00 · 60 мин`, иероглиф 志 + название цели, если есть; тренировка — иконка `Dumbbell` алая. Клик по заголовку — `onOpen(task)`. Идущая задача — золотая рамка `ring-1 ring-gold`. Справа — `<TaskTimer task />`.

TaskTimer: если `todo` — кнопка `▶ Начать` (ghost, gold); если `doing` — таймер `mm:ss` от `actualStart` (обновление раз в секунду через `setInterval`) и кнопка `■ Закончить` (primary); если `done` — «план/факт» текстом, если есть.

- [ ] **Step 5: QuickCapture.tsx**

Modal «Быстрая запись». Переключатель типа (4 кнопки): Задача / Напоминание / Пункт списка / Заметка. Одно поле текста (autofocus). Дополнительно по типу:
- Задача: дата (по умолчанию сегодня), время, длительность, доска, цель, сфера. Сохранение → `newTask`.
- Напоминание: дата, время, повтор (Select: Один раз/Ежедневно/Еженедельно/Ежемесячно/Ежегодно).
- Пункт списка: Select списка.
- Заметка: сохраняется во «Входящие» (`noteFolders` с title «Входящие», иначе первая папка), заголовок — первая строка.
Enter — сохранить, Esc — закрыть. После сохранения — toast «Сохранено» и очистка поля (окно остаётся, чтобы записать ещё; Esc закрывает).

Экспортировать `QuickCaptureProvider` + `useQuickCapture()` → `{ open(type?) }`; подключить в Shell, кнопка в TopBar и клавиша `N` вызывают `open()`.

- [ ] **Step 6: Проверка и коммит**

`npm test`, `npx tsc -p tsconfig.app.json --noEmit`. В браузере: быстрая запись создаёт задачу (проверить через DevTools → Application → IndexedDB → ikigai → tasks).

```bash
git add -A && git commit -m "feat: task actions, editor, card with timer, quick capture

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Страница «Сегодня»

**Files:**
- Create: `src/features/today/TodayPage.tsx`, `src/features/today/Timeline.tsx`
- Modify: `src/App.tsx` (маршрут `/`)

- [ ] **Step 1: TodayPage.tsx**

Данные: `useTaskActions()`, `useCollection('reminders')`, `useCollection('goals')`, `useProfile()`. `today = todayISO()`.

Разметка сверху вниз:
1. Шапка: `greetingRu(new Date().getHours())` (serif 28px) и `formatDayRu(today)` (muted). Справа — «Сделано 3 из 7» + `ProgressBar` (по задачам на сегодня, кроме skipped).
2. Карточка «Цель недели» (если `profile.weekGoalId` и цель найдена): 志, название, `ProgressBar(goalProgress)`, ссылка «Открыть» → `/goals/:id`.
3. Блок «Перенесено со вчера» (если `carriedOverTasks(tasks, today).length`): алая полоска слева; для каждой задачи — название и кнопки «На сегодня» (`reschedule(t, today)`), «Выбрать дату» (input date inline), «Отменить» (`skip`).
4. Две колонки на md+: слева `<Timeline />`, справа «В течение дня» — задачи без `plannedStart` (`TaskCard`), под ними «Напоминания»: `reminders.filter(r => reminderOccursOn(r, today))` — строка с 🔔/🎂 (yearly) и временем.
5. Кнопка «+ Задача на сегодня» внизу колонки → `TaskEditor` с `defaults={{ date: today }}`.

Пустое состояние (нет задач вообще): `EmptyState` с 今, «День ещё не спланирован», кнопка «Добавить задачу».

- [ ] **Step 2: Timeline.tsx**

Часы 06:00–24:00 по 56px на час, слева подписи времени (muted 11px), тонкие горизонтальные линии `border-border`. Задачи с `plannedStart`: абсолютно спозиционированные блоки `top = (minutes - 360) / 60 * 56`, `height = max(28, plannedMinutes/60*56)`, стиль как TaskCard (компактный: заголовок + время + TaskTimer). Наложения — располагать блоки в 2 колонки, если пересекаются по времени (простая проверка соседей). Линия «сейчас»: алая линия 1px с точкой слева, обновляется раз в минуту; при монтировании прокрутить так, чтобы «сейчас» было в верхней трети. Клик по пустому месту — создать задачу с `plannedStart` = ближайшие 30 минут от клика (`TaskEditor` с defaults).

- [ ] **Step 3: Проверка и коммит**

В браузере: демо-задачи на таймлайне, «Разобрать почту» в блоке «Перенесено», кнопки Начать/Закончить работают, после «Закончить» виден «план/факт».

```bash
git add -A && git commit -m "feat: Today page with timeline, carried-over tasks and reminders

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Календарь (месяц / неделя / день, перетаскивание по дням)

**Files:**
- Create: `src/features/calendar/CalendarPage.tsx`, `MonthView.tsx`, `WeekView.tsx`, `DayView.tsx`

- [ ] **Step 1: CalendarPage.tsx**

Состояние: `view: 'month'|'week'|'day'` (в URL `?view=`), `cursor` (дата ISO, по умолчанию сегодня). Шапка: «‹ Сегодня ›», заголовок (`formatMonthRu` / диапазон недели / `formatDayRu`), переключатель вида (3 кнопки). Данные: `useTaskActions`, `useCollection('reminders')`. Обёртка `DndContext` (@dnd-kit/core): `onDragEnd` → если `over.id` — дата (`day:YYYY-MM-DD`) и задача имела другую дату → `reschedule(task, date)`.

- [ ] **Step 2: MonthView.tsx**

Сетка 7 колонок, недели с понедельника, 6 строк, дни соседних месяцев — muted. Заголовки «Пн … Вс». Каждая ячейка — `useDroppable({ id: 'day:'+iso })`, подсветка золотой рамкой при наведении перетаскиваемого. Внутри: число (сегодня — золотой кружок), до 3 задач компактными строками (`useDraggable({ id: task.id })`, точка цвета: золото/алый важная/muted готово), «+N ещё», напоминания на этот день — строкой с 🔔 (без перетаскивания). Клик по ячейке — переход в вид «день» на эту дату; клик по задаче — `TaskEditor`.

- [ ] **Step 3: WeekView.tsx**

7 колонок-дней (droppable), в каждой — заголовок «пн 14» (сегодня — золотой) и список `TaskCard` компактного вида (draggable), напоминания дня под ними. Кнопка «+» в заголовке дня → `TaskEditor` с `defaults={{ date }}`.

- [ ] **Step 4: DayView.tsx**

Переиспользует `Timeline` из Task 7 (принимает `date` пропсом — вынести `date` в проп Timeline, по умолчанию сегодня) плюс список задач без времени и напоминаний дня.

- [ ] **Step 5: Проверка и коммит**

Перетащить задачу на другой день в месяце и неделе — дата меняется, `rescheduleCount` растёт (видно в IndexedDB).

```bash
git add -A && git commit -m "feat: calendar with month, week and day views and drag-to-reschedule

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Доски (канбан)

**Files:**
- Create: `src/features/boards/BoardsPage.tsx`, `BoardView.tsx`, `ColumnView.tsx`

- [ ] **Step 1: BoardsPage.tsx**

Вкладки досок сверху (по `position`), активная — золотое подчёркивание; кнопка «+ Доска» (prompt-модалка с названием: создаёт доску и три колонки Надо/В работе/Готово, как в `ensureDefaults`). Меню доски (⋯): переименовать, удалить (с confirm; задачи доски получают `boardId/columnId = undefined`). Выбранная доска в URL `?board=`.

- [ ] **Step 2: BoardView.tsx + ColumnView.tsx**

`DndContext` + для каждой колонки `SortableContext` (@dnd-kit/sortable) по задачам колонки, отсортированным по `position`. Горизонтальный скролл колонок (`flex gap-4 overflow-x-auto`), ширина колонки 280px. Заголовок колонки: название, счётчик, меню (переименовать, тип колонки Select todo/doing/done, удалить — только если пустая). Кнопка «+ Колонка» справа. Внизу колонки «+ Карточка» — инлайн-поле: Enter создаёт `newTask({ title, boardId, columnId, area: board.title === 'Работа' ? 'work' : 'personal' })`.

`onDragEnd`: определить целевую колонку (over — задача или колонка), вычислить новую `position` (между соседями: среднее, или `last+1000`), сохранить; если `kind` целевой колонки `done` → `taskOps.finish`, если `todo` и задача была done → `taskOps.reopen`, если `doing` → `status='doing'` без actualStart (таймер только по кнопке). Карточка — `TaskCard` (компактная: без таймера, с чекбоксом и датой), клик → `TaskEditor`.

- [ ] **Step 3: Проверка и коммит**

Перетаскивание между колонками меняет статус; создание карточки инлайн; новая доска появляется с тремя колонками.

```bash
git add -A && git commit -m "feat: kanban boards with sortable columns and cards

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Цели

**Files:**
- Create: `src/features/goals/GoalsPage.tsx`, `GoalTree.tsx`, `GoalDetail.tsx`, `GoalEditor.tsx`

- [ ] **Step 1: GoalsPage.tsx**

Вкладки: «Дерево», «Несколько лет», «Год», «Месяц», «Неделя» (`?tab=`). Фильтр статуса: Активные / Достигнутые / Все. Кнопка «+ Цель» → `GoalEditor` (horizon по текущей вкладке). Пустое состояние: 志, «Первая цель начинается с мечты», кнопки «Создать цель» и «Открыть мечты».

Вкладка горизонта: карточки целей: название, даты, `ProgressBar(goalProgress)`, «N шагов · M сделано», родитель (если есть) muted, бейдж «Цель недели» золотой. Клик → `/goals/:id`.

- [ ] **Step 2: GoalTree.tsx**

Рекурсивное дерево от корней (`!parentId`): строка с треугольником раскрытия, иероглиф горизонта (years 遠, year 年, month 月, week 週), название, прогресс тонким баром справа (ширина 120px), процент. Отступ 20px на уровень. Клик → `/goals/:id`.

- [ ] **Step 3: GoalDetail.tsx** (маршрут `/goals/:id`)

Шапка: название (serif 24px), горизонт, даты, статус (Select: активна/достигнута/отменена), «Цель недели» — переключатель (только для `week`; пишет `profile.weekGoalId`), кнопка «Изменить» (GoalEditor), «Удалить» (confirm; у подцелей `parentId = undefined`, у задач `goalId = undefined`).
Прогресс: большой `ProgressBar` + «сделано X из Y».
Блок «Мечта»: если `dreamId` — карточка мечты с ссылкой на `/dreams`.
Блок «Подцели»: список `childGoals` с прогрессом; «+ Подцель» → GoalEditor с `parentId`, горизонт на ступень ниже (years→year→month→week).
Блок «Шаги»: задачи с `goalId === id` (`TaskCard`), сортировка: незавершённые сверху по дате; «+ Шаг» → `TaskEditor` с `defaults={{ goalId: id, area: 'work' }}`.

- [ ] **Step 4: GoalEditor.tsx**

Modal: название, описание, горизонт (Select), родительская цель (Select из целей более высокого горизонта; «Без родителя»), мечта (Select из `dreams`, «Не связана»), даты начала и окончания, сохранить/отмена.

- [ ] **Step 5: Проверка и коммит**

Демо: дерево «Выпустить Ikigai → Собрать первую версию → Описать все разделы»; «Цель недели» видна на «Сегодня». Добавление шага создаёт задачу с 志.

```bash
git add -A && git commit -m "feat: goals with horizon tabs, tree, detail and editor

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Мечты, Напоминания

**Files:**
- Create: `src/features/dreams/DreamsPage.tsx`, `DreamCard.tsx`, `DreamEditor.tsx`, `src/features/reminders/RemindersPage.tsx`, `ReminderEditor.tsx`

- [ ] **Step 1: Мечты**

DreamsPage: шапка «Исполнено N из 100» + `ProgressBar(N/100)`; фильтр по категории (чипы из существующих категорий); переключатель «Скрыть исполненные»; кнопка «+ Мечта». Сетка `grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4`.

DreamCard: картинка (`imageDataUrl`, `aspect-[4/3] object-cover`; без картинки — иероглиф 夢 крупно на `bg-surface-2`), название serif, категория muted, если `doneAt` — золотая рамка и бейдж «Исполнено · дата»; если `goalId` — строка 志 «Цель: …» со ссылкой. Кнопки при наведении: «Исполнено» (галочка → `doneAt = todayISO()`; повторно — снять), «Сделать целью» (создаёт `Goal{ title: dream.title, horizon: 'year', dreamId }`, записывает `dream.goalId`, переходит на `/goals/:id`; если goalId уже есть — просто переход), «Изменить».

DreamEditor: Modal: название, описание, категория (Input с datalist из существующих), картинка (`<input type="file" accept="image/*">` → сжать до 800px по ширине через canvas → dataURL; предпросмотр; «Убрать»), сохранить/удалить.

- [ ] **Step 2: Напоминания**

RemindersPage: список, сгруппированный: «Сегодня», «Ближайшие 7 дней», «Позже», «Ежегодные» (yearly — отдельно, отсортированы по `daysUntil`, показывать «через N дней»), «Прошедшие» (none с датой < сегодня, свёрнуто). Для каждого: 🔔/🎂, текст, дата ближайшего срабатывания (`nextOccurrence`), время, повтор словом (muted). Клик → ReminderEditor. «+ Напоминание».

ReminderEditor: Modal: текст, дата, время, повтор (Select), сохранить/удалить. Подсказка под датой для yearly: «Укажи любую дату с нужным днём и месяцем, например дату рождения».

- [ ] **Step 3: Проверка и коммит**

```bash
git add -A && git commit -m "feat: dreams gallery with make-a-goal, reminders with recurrence

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Списки, Блокнот, Поиск

**Files:**
- Create: `src/features/lists/ListsPage.tsx`, `ListDetail.tsx`, `src/features/notes/NotesPage.tsx`, `NoteEditor.tsx`, `src/features/search/SearchDialog.tsx`

- [ ] **Step 1: Списки**

ListsPage (`/lists`): сетка карточек списков: иконка (`ListIcon`), название, «сделано X из Y», сумма «Осталось: 105 000 ₸» если есть цены, значок закрепления. «+ Список» → Modal: название + `IconPicker`. Клик → `/lists/:id`.

ListDetail (`/lists/:id`): шапка: иконка, название (клик — переименовать инлайн), переключатель «Закрепить в меню» (`pinned`), меню: удалить список (с пунктами). Если есть цены: карточка «Осталось купить: X ₸ · Куплено на: Y ₸» (валюта из профиля, форматирование `Intl.NumberFormat('ru-RU')`). Поле «+ Пункт» вверху (Enter → создать). Список незавершённых пунктов (Checkbox → `doneAt`), у пункта: текст (клик — редактирование инлайн), цена, ссылка (иконка `ExternalLink`), заметка (иконка → раскрыть). Кнопка «⋯» → Modal с полями заметка/ссылка/цена/удалить. Внизу свёрнутый блок «Готово (N)».

- [ ] **Step 2: Блокнот**

NotesPage (`/notes`): три зоны на md+: папки (200px) | список заметок (300px) | редактор. На мобильном — по одной зоне с кнопкой «назад». Папки: «Все», затем `noteFolders` по position, «+ Папка», переименование/удаление (заметки удалённой папки → `folderId = undefined`). Список: поиск по заголовку и тексту, сортировка по `updatedAt` desc, строка: заголовок (или первая строка body), дата, папка; бейдж «из Telegram» при `source === 'telegram'`. «+ Заметка» создаёт пустую в текущей папке и открывает редактор.

NoteEditor: заголовок (Input без рамки, serif 20px), тело — `<textarea>` на всю высоту, поддержка `- [ ]` чекбоксов не нужна — простой textarea (YAGNI). Автосохранение с debounce 500 мс. Панель действий: «→ Задача» (открывает `TaskEditor` с `title` = заголовок, `notes` = тело), «→ Цель» (GoalEditor с названием), «→ В список» (выбор списка → создать пункт с заголовком), «Переместить в папку», «Удалить».

- [ ] **Step 3: SearchDialog.tsx**

Modal с полем ввода (autofocus). Ищет по подстроке (без учёта регистра) в задачах (title, notes), заметках (title, body), пунктах списков (text), целях (title), мечтах (title), напоминаниях (text). Результаты сгруппированы с иероглифами, максимум 8 на группу; стрелки/Enter — навигация; выбор: задача → TaskEditor, заметка → `/notes?note=id`, пункт → `/lists/:listId`, цель → `/goals/:id`, мечта → `/dreams`, напоминание → `/reminders`. Подключить к TopBar и клавише `/`.

- [ ] **Step 4: Проверка и коммит**

```bash
git add -A && git commit -m "feat: custom lists with prices, notebook with folders, global search

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Настройки, экспорт/импорт, финальная полировка этапа «локально»

**Files:**
- Create: `src/features/settings/SettingsPage.tsx`
- Modify: `src/app/Shell.tsx`

- [ ] **Step 1: SettingsPage.tsx**

Секции:
- «Основное»: часовой пояс (Select из `Intl.supportedValuesOf('timeZone')` с текущим сверху), время утренней сводки (`type="time"`), валюта (Select: KZT ₸, RUB ₽, USD $, EUR €). Сохранение сразу через `useProfile()[1]`.
- «Telegram»: пока облако не подключено — текст «Бот работает после подключения облака (см. инструкцию SETUP.md в папке проекта)». После Task 15 — здесь появится привязка.
- «Данные»: «Экспорт в JSON» (`downloadText('ikigai-'+todayISO()+'.json', await exportAll(store))`), «Импорт из JSON» (file input → `importAll`, confirm «Данные из файла добавятся к текущим»), «Удалить демо-данные» (виден при `profile.demoLoaded`: удаляет все записи, кроме profiles, boards, columns, lists с title «Купить», noteFolders; ставит `demoLoaded=false`), «Стереть всё» (danger, двойной confirm, `clearAll` + `ensureDefaults`).
- «О приложении»: «Ikigai · 生き甲斐 · версия 0.1».

- [ ] **Step 2: Полировка**

- Подтверждения удаления везде через общий `confirmDialog(text)` (Modal, возвращает Promise<boolean>) — заменить `window.confirm`.
- Заголовок вкладки браузера: `document.title = 'Ikigai · ' + название раздела`.
- Favicon: `public/favicon.svg` — иероглиф 生 золотом на угольном фоне.
- Проверить на ширине 375px все страницы: нет горизонтального скролла, панели раскрываются во весь экран.
- `npm run build` без предупреждений о размере > 1 МБ (иначе — `React.lazy` для страниц календаря и досок).

- [ ] **Step 3: Коммит**

```bash
git add -A && git commit -m "feat: settings with export/import, polish and favicon

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

**Контрольная точка:** сайт полностью работает локально. Показать пользователю через `npm run dev`.

---

### Task 14: Облако — схема Supabase, SupabaseStore, вход

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `src/data/supabase.ts`, `src/features/auth/LoginPage.tsx`, `docs/SETUP.md`
- Modify: `src/data/index.ts`, `src/App.tsx`, `src/features/settings/SettingsPage.tsx`

- [ ] **Step 1: 0001_init.sql**

```sql
create table if not exists public.rows (
  collection text not null,
  id text not null,
  user_id uuid not null default auth.uid(),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id, user_id)
);
create index if not exists rows_user_collection on public.rows (user_id, collection);
create index if not exists rows_task_date on public.rows ((data->>'date')) where collection = 'tasks';

alter table public.rows enable row level security;
create policy "owner select" on public.rows for select using (auth.uid() = user_id);
create policy "owner insert" on public.rows for insert with check (auth.uid() = user_id);
create policy "owner update" on public.rows for update using (auth.uid() = user_id);
create policy "owner delete" on public.rows for delete using (auth.uid() = user_id);

-- служебные таблицы бота (доступны только service role — RLS без политик)
create table if not exists public.bot_links (
  code text primary key,
  user_id uuid not null,
  expires_at timestamptz not null
);
alter table public.bot_links enable row level security;
create policy "owner insert link" on public.bot_links for insert with check (auth.uid() = user_id);

create table if not exists public.bot_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  chat_id text not null,
  payload jsonb not null,
  source_text text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
alter table public.bot_drafts enable row level security;

create table if not exists public.sent_digests (
  user_id uuid not null,
  kind text not null,
  date date not null,
  attempts int not null default 0,
  sent boolean not null default false,
  primary key (user_id, kind, date)
);
alter table public.sent_digests enable row level security;

create table if not exists public.ai_usage (
  user_id uuid not null,
  date date not null,
  count int not null default 0,
  primary key (user_id, date)
);
alter table public.ai_usage enable row level security;

alter publication supabase_realtime add table public.rows;
```

- [ ] **Step 2: supabase.ts**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CollectionName, Row } from '@/lib/types';
import { COLLECTIONS } from '@/lib/types';
import { Emitter, type Store, type StoreStatus } from './store';

type Pending = { op: 'put' | 'remove'; collection: CollectionName; id: string; data?: unknown };
const PENDING_KEY = 'ikigai.pending';

export class SupabaseStore implements Store {
  private cache = new Map<CollectionName, Map<string, unknown>>();
  private loaded = new Set<CollectionName>();
  private em = new Emitter();
  private _status: StoreStatus = 'ok';
  private statusSubs = new Set<(s: StoreStatus) => void>();
  private pending: Pending[] = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]');

  constructor(public client: SupabaseClient, private userId: string) {
    client.channel('rows').on('postgres_changes', { event: '*', schema: 'public', table: 'rows', filter: `user_id=eq.${userId}` }, (p) => {
      const rec = (p.new ?? p.old) as { collection: CollectionName; id: string; data?: unknown };
      const m = this.map(rec.collection);
      if (p.eventType === 'DELETE') m.delete(rec.id); else m.set(rec.id, rec.data);
      this.em.emit(rec.collection);
    }).subscribe();
    setInterval(() => this.flush(), 30000);
    window.addEventListener('online', () => this.flush());
  }

  private map(name: CollectionName) {
    if (!this.cache.has(name)) this.cache.set(name, new Map());
    return this.cache.get(name)!;
  }
  private setStatus(s: StoreStatus) { this._status = s; this.statusSubs.forEach(cb => cb(s)); }
  private savePending() { localStorage.setItem(PENDING_KEY, JSON.stringify(this.pending)); this.setStatus(this.pending.length ? 'offline' : 'ok'); }

  async list<K extends CollectionName>(name: K): Promise<Row<K>[]> {
    if (!this.loaded.has(name)) {
      const { data, error } = await this.client.from('rows').select('id,data').eq('collection', name);
      if (error) throw error;
      const m = this.map(name);
      for (const r of data) m.set(r.id, r.data);
      this.loaded.add(name);
    }
    return [...this.map(name).values()] as Row<K>[];
  }

  async put<K extends CollectionName>(name: K, row: Row<K>) {
    this.map(name).set(row.id, row); this.em.emit(name);
    await this.exec({ op: 'put', collection: name, id: row.id, data: row });
  }
  async putMany<K extends CollectionName>(name: K, rows: Row<K>[]) { for (const r of rows) await this.put(name, r); }
  async remove<K extends CollectionName>(name: K, id: string) {
    this.map(name).delete(id); this.em.emit(name);
    await this.exec({ op: 'remove', collection: name, id });
  }

  private async exec(p: Pending) {
    this.setStatus('saving');
    try {
      await this.send(p);
      this.setStatus(this.pending.length ? 'offline' : 'ok');
    } catch {
      this.pending.push(p); this.savePending();
    }
  }
  private async send(p: Pending) {
    if (p.op === 'put') {
      const { error } = await this.client.from('rows').upsert({ collection: p.collection, id: p.id, user_id: this.userId, data: p.data, updated_at: new Date().toISOString() });
      if (error) throw error;
    } else {
      const { error } = await this.client.from('rows').delete().eq('collection', p.collection).eq('id', p.id);
      if (error) throw error;
    }
  }
  async flush() {
    if (!this.pending.length) return;
    const queue = [...this.pending]; this.pending = [];
    for (const p of queue) { try { await this.send(p); } catch { this.pending.push(p); } }
    this.savePending();
  }

  subscribe(name: CollectionName | '*', cb: () => void) { return this.em.on(name, cb); }
  async clearAll() {
    for (const c of COLLECTIONS) { this.map(c).clear(); this.em.emit(c); }
    await this.client.from('rows').delete().eq('user_id', this.userId);
  }
  status() { return this._status; }
  onStatus(cb: (s: StoreStatus) => void) { this.statusSubs.add(cb); return () => { this.statusSubs.delete(cb); }; }
}

export function makeSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}
```

- [ ] **Step 3: index.ts — выбор хранилища; LoginPage; App**

`data/index.ts`: `export const cloudEnabled = !!import.meta.env.VITE_SUPABASE_URL`. Если `cloudEnabled`, `getStore()` бросает ошибку, пока не вызван `setStore(new SupabaseStore(client, userId))`.

`LoginPage.tsx`: логотип IKIGAI, поле email, кнопка «Получить ссылку для входа» → `client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } })`; текст «Проверь почту и перейди по ссылке». Ошибки — toast.

`App.tsx`: если `cloudEnabled` — `AuthGate`: подписка на `client.auth.onAuthStateChange`; без сессии → `LoginPage`; с сессией → `setStore(new SupabaseStore(client, session.user.id))` и рендер Shell. Кнопка «Выйти» — в Settings.

Миграция локальных данных в облако: в Settings при `cloudEnabled` и наличии данных в LocalStore (`new LocalStore().list('tasks')` не пусто) показать кнопку «Перенести данные из браузера в облако» → `importAll(cloudStore, await exportAll(localStore))`, затем `localStore.clearAll()`.

- [ ] **Step 4: docs/SETUP.md** (для владельца, по-русски, пошагово)

Разделы: 1) Создать проект Supabase (регион Frankfurt), скопировать URL и anon key в `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). 2) SQL Editor → вставить `supabase/migrations/0001_init.sql` → Run. 3) Authentication → Providers → Email: включить (magic link). URL Configuration → Site URL = адрес сайта. 4) Vercel: импортировать репозиторий, задать те же две переменные, деплой. 5) Telegram и бот — см. Task 15/16 (дописать в тех задачах). Каждый шаг — с точными названиями кнопок.

- [ ] **Step 5: Проверка и коммит**

Без `.env` сайт работает локально как раньше (`npm run build && npm run preview`). `npm test` PASS.

```bash
git add -A && git commit -m "feat: Supabase schema, cloud store with offline queue, magic-link login

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: Telegram-бот (edge-функция) с разбором через ИИ

**Files:**
- Create: `supabase/functions/_shared/domain.ts`, `_shared/tg.ts`, `_shared/db.ts`, `_shared/ai.ts`, `supabase/functions/telegram-webhook/index.ts`, `supabase/config.toml`
- Modify: `src/features/settings/SettingsPage.tsx`, `docs/SETUP.md`

- [ ] **Step 1: _shared/domain.ts** — скопировать содержимое `src/lib/domain/digest.ts` и функции `reminderOccursOn`, `nextOccurrence` из `reminders.ts` (заменив импорт `addDaysISO` на локальную реализацию через `Date`). Без внешних зависимостей.

- [ ] **Step 2: _shared/tg.ts**

```ts
const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const api = (method: string, body: unknown) =>
  fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());

export type Button = { text: string; callback_data: string } | { text: string; url: string };
export const send = (chat_id: string, text: string, buttons?: Button[][]) =>
  api('sendMessage', { chat_id, text, parse_mode: 'HTML', reply_markup: buttons ? { inline_keyboard: buttons } : undefined });
export const edit = (chat_id: string, message_id: number, text: string, buttons?: Button[][]) =>
  api('editMessageText', { chat_id, message_id, text, parse_mode: 'HTML', reply_markup: buttons ? { inline_keyboard: buttons } : undefined });
export const answer = (callback_query_id: string, text?: string) => api('answerCallbackQuery', { callback_query_id, text });
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
```

- [ ] **Step 3: _shared/db.ts**

```ts
import { createClient } from 'npm:@supabase/supabase-js@2';
export const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

export async function rows<T = any>(userId: string, collection: string): Promise<T[]> {
  const { data, error } = await db.from('rows').select('data').eq('user_id', userId).eq('collection', collection);
  if (error) throw error;
  return data.map(r => r.data as T);
}
export async function putRow(userId: string, collection: string, row: { id: string }) {
  const { error } = await db.from('rows').upsert({ collection, id: row.id, user_id: userId, data: row, updated_at: new Date().toISOString() });
  if (error) throw error;
}
export async function profileByChat(chatId: string) {
  const { data } = await db.from('rows').select('user_id,data').eq('collection', 'profiles').eq('data->>telegramChatId', chatId).maybeSingle();
  return data ? { userId: data.user_id as string, profile: data.data as any } : null;
}
export const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);
export const nowISO = () => new Date().toISOString();
```

- [ ] **Step 4: _shared/ai.ts**

```ts
const KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

export interface ParsedItem {
  type: 'task' | 'reminder' | 'list_item' | 'note';
  title: string;
  date?: string;        // YYYY-MM-DD
  time?: string;        // HH:mm
  minutes?: number;
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  list_name?: string;
  area?: 'work' | 'personal';
  goal_id?: string;
}

const tool = {
  name: 'save_items',
  description: 'Сохранить разобранные элементы',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['task', 'reminder', 'list_item', 'note'] },
            title: { type: 'string' },
            date: { type: 'string' }, time: { type: 'string' }, minutes: { type: 'integer' },
            repeat: { type: 'string', enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'] },
            list_name: { type: 'string' }, area: { type: 'string', enum: ['work', 'personal'] }, goal_id: { type: 'string' },
          },
          required: ['type', 'title'],
        },
      },
    },
    required: ['items'],
  },
};

export async function parseMessage(text: string, ctx: { nowLocal: string; timezone: string; lists: string[]; goals: { id: string; title: string }[]; correction?: string }): Promise<ParsedItem[]> {
  const system = `Ты разбираешь сообщения владельца личного планировщика Ikigai на структурированные элементы.
Сейчас: ${ctx.nowLocal} (${ctx.timezone}). Неделя начинается с понедельника.
Правила:
- Дела с датой/временем или глаголом действия → task. «в пятницу» = ближайшая пятница; «на следующей неделе в среду» = среда следующей недели; «через неделю» = +7 дней. Без даты — task без date.
- «купить X» → list_item в список «Купить» (или другой подходящий из списка пользователя: ${ctx.lists.join(', ') || 'Купить'}).
- Дни рождения, «каждый год/месяц/день», годовщины, оплаты по числам → reminder с repeat. Для ДР ставь date текущего или следующего года.
- «мысль:», «идея:», размышления, всё, что не дело и не покупка → note.
- Работа, клиенты, проекты, отчёты → area work; остальное personal.
- Если явно относится к цели из списка — goal_id. Цели: ${ctx.goals.map(g => `${g.id}=${g.title}`).join('; ') || 'нет'}.
- Названия — коротко, с большой буквы, без точки в конце.
${ctx.correction ? `Пользователь поправил предыдущий разбор: «${ctx.correction}». Учти это.` : ''}`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5', max_tokens: 1024, system,
      tools: [tool], tool_choice: { type: 'tool', name: 'save_items' },
      messages: [{ role: 'user', content: text }],
    }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const use = j.content.find((c: any) => c.type === 'tool_use');
  return (use?.input?.items ?? []) as ParsedItem[];
}
```

- [ ] **Step 5: telegram-webhook/index.ts**

```ts
import { send, edit, answer, esc } from '../_shared/tg.ts';
import { db, rows, putRow, profileByChat, newId, nowISO } from '../_shared/db.ts';
import { parseMessage, type ParsedItem } from '../_shared/ai.ts';
import { localClock } from '../_shared/domain.ts';

const SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!;
const DAILY_AI_LIMIT = 200;

const TYPE_ICON = { task: '📌', reminder: '🔔', list_item: '🛒', note: '📝' } as const;
const TYPE_LABEL = { task: 'Задача', reminder: 'Напоминание', list_item: 'В список', note: 'Заметка' } as const;
const REPEAT_LABEL: Record<string, string> = { daily: 'ежедневно', weekly: 'еженедельно', monthly: 'ежемесячно', yearly: 'ежегодно' };

function renderDraft(items: ParsedItem[]) {
  const lines = items.map(i => {
    const when = [i.date, i.time].filter(Boolean).join(' ');
    const extra = i.type === 'list_item' ? ` → ${i.list_name ?? 'Купить'}` : i.repeat && i.repeat !== 'none' ? ` · ${REPEAT_LABEL[i.repeat]}` : '';
    return `${TYPE_ICON[i.type]} <b>${TYPE_LABEL[i.type]}</b>${when ? ` · ${when}` : ''}${extra}\n${esc(i.title)}`;
  });
  return `Вот что я понял:\n\n${lines.join('\n\n')}`;
}

async function aiAllowed(userId: string) {
  const date = new Date().toISOString().slice(0, 10);
  const { data } = await db.from('ai_usage').select('count').eq('user_id', userId).eq('date', date).maybeSingle();
  const count = data?.count ?? 0;
  if (count >= DAILY_AI_LIMIT) return false;
  await db.from('ai_usage').upsert({ user_id: userId, date, count: count + 1 });
  return true;
}

async function saveItems(userId: string, items: ParsedItem[]) {
  const now = nowISO();
  const base = { createdAt: now, updatedAt: now, source: 'telegram' as const };
  const lists = await rows<any>(userId, 'lists');
  const folders = await rows<any>(userId, 'noteFolders');
  const boards = await rows<any>(userId, 'boards');
  const columns = await rows<any>(userId, 'columns');
  for (const i of items) {
    if (i.type === 'task') {
      const board = boards.find(b => (i.area === 'work' ? b.title === 'Работа' : b.title === 'Личное')) ?? boards[0];
      const col = columns.find(c => c.boardId === board?.id && c.kind === 'todo');
      await putRow(userId, 'tasks', { id: newId(), title: i.title, area: i.area ?? 'personal', boardId: board?.id, columnId: col?.id, goalId: i.goal_id, date: i.date, plannedStart: i.time, plannedMinutes: i.minutes, status: 'todo', rescheduleCount: 0, kind: 'task', position: Date.now(), ...base });
    } else if (i.type === 'reminder') {
      await putRow(userId, 'reminders', { id: newId(), text: i.title, date: i.date ?? new Date().toISOString().slice(0, 10), time: i.time, repeat: i.repeat ?? 'none', ...base });
    } else if (i.type === 'list_item') {
      let list = lists.find(l => l.title.toLowerCase() === (i.list_name ?? 'купить').toLowerCase()) ?? lists.find(l => l.title === 'Купить') ?? lists[0];
      if (!list) { list = { id: newId(), title: 'Купить', icon: 'shopping-bag', position: 0, pinned: true, createdAt: now, updatedAt: now }; await putRow(userId, 'lists', list); lists.push(list); }
      await putRow(userId, 'listItems', { id: newId(), listId: list.id, text: i.title, position: Date.now(), createdAt: now, updatedAt: now });
    } else {
      const inbox = folders.find(f => f.title === 'Входящие') ?? folders[0];
      await putRow(userId, 'notes', { id: newId(), folderId: inbox?.id, title: i.title.slice(0, 80), body: i.title, ...base });
    }
  }
}

async function saveAsNote(userId: string, text: string) {
  const folders = await rows<any>(userId, 'noteFolders');
  const inbox = folders.find(f => f.title === 'Входящие') ?? folders[0];
  const now = nowISO();
  await putRow(userId, 'notes', { id: newId(), folderId: inbox?.id, title: text.slice(0, 80), body: text, source: 'telegram', createdAt: now, updatedAt: now });
}

Deno.serve(async (req) => {
  if (req.headers.get('x-telegram-bot-api-secret-token') !== SECRET) return new Response('forbidden', { status: 403 });
  const update = await req.json();

  // Кнопки
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = String(cq.message.chat.id);
    const [action, id] = String(cq.data).split(':');
    const link = await profileByChat(chatId);
    if (!link) { await answer(cq.id, 'Бот не привязан'); return new Response('ok'); }
    const { userId } = link;

    if (action === 'save' || action === 'cancel') {
      const { data: d } = await db.from('bot_drafts').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
      if (!d || d.status !== 'pending') { await answer(cq.id, 'Уже обработано'); return new Response('ok'); }
      if (action === 'save') { await saveItems(userId, d.payload as ParsedItem[]); await db.from('bot_drafts').update({ status: 'saved' }).eq('id', id); await edit(chatId, cq.message.message_id, `✅ Сохранено: ${(d.payload as ParsedItem[]).length}`); }
      else { await db.from('bot_drafts').update({ status: 'cancelled' }).eq('id', id); await edit(chatId, cq.message.message_id, '✖️ Отменено'); }
      await answer(cq.id);
    } else if (action === 'edit') {
      await answer(cq.id);
      await send(chatId, 'Напиши, что исправить, одним сообщением.');
    } else if (action === 'start' || action === 'finish') {
      const tasks = await rows<any>(userId, 'tasks');
      const t = tasks.find(x => x.id === id);
      if (!t) { await answer(cq.id, 'Задача не найдена'); return new Response('ok'); }
      if (action === 'start') {
        const running = tasks.find(x => x.status === 'doing' && x.id !== id);
        if (running) { await answer(cq.id, `Сначала закончи «${running.title}»`); return new Response('ok'); }
        await putRow(userId, 'tasks', { ...t, status: 'doing', actualStart: nowISO(), updatedAt: nowISO() });
        await answer(cq.id, '▶ Пошло');
        await send(chatId, `▶ ${esc(t.title)}`, [[{ text: '■ Закончить', callback_data: `finish:${t.id}` }]]);
      } else {
        await putRow(userId, 'tasks', { ...t, status: 'done', actualEnd: nowISO(), updatedAt: nowISO() });
        await answer(cq.id, '✓ Готово');
        await edit(chatId, cq.message.message_id, `✅ ${esc(t.title)}`);
      }
    }
    return new Response('ok');
  }

  const msg = update.message;
  if (!msg?.chat) return new Response('ok');
  const chatId = String(msg.chat.id);
  const text: string = msg.text ?? '';

  // Привязка
  if (text.startsWith('/start')) {
    const code = text.split(' ')[1];
    if (!code) { await send(chatId, 'Это личный бот Ikigai. Подключи его в настройках сайта.'); return new Response('ok'); }
    const { data: l } = await db.from('bot_links').select('*').eq('code', code).maybeSingle();
    if (!l || new Date(l.expires_at) < new Date()) { await send(chatId, 'Ссылка устарела. Создай новую в настройках сайта.'); return new Response('ok'); }
    const { data: p } = await db.from('rows').select('data').eq('user_id', l.user_id).eq('collection', 'profiles').maybeSingle();
    const profile = { ...(p?.data ?? { id: 'me', timezone: 'Asia/Almaty', morningTime: '09:00', currency: 'KZT', createdAt: nowISO() }), telegramChatId: chatId, updatedAt: nowISO() };
    await db.from('rows').upsert({ collection: 'profiles', id: 'me', user_id: l.user_id, data: profile, updated_at: nowISO() });
    await db.from('bot_links').delete().eq('code', code);
    await send(chatId, '⛩ Подключено. Пиши мне задачи, напоминания, покупки и мысли — я разложу их по местам. Утром в ' + profile.morningTime + ' пришлю сводку.');
    return new Response('ok');
  }

  const link = await profileByChat(chatId);
  if (!link) { await send(chatId, 'Это личный бот.'); return new Response('ok'); }
  const { userId, profile } = link;
  if (!text.trim()) { await send(chatId, 'Пока понимаю только текст.'); return new Response('ok'); }

  // Исправление предыдущего черновика
  const { data: pendingDraft } = await db.from('bot_drafts').select('*').eq('user_id', userId).eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (!(await aiAllowed(userId))) { await saveAsNote(userId, text); await send(chatId, 'Лимит ИИ на сегодня исчерпан. Сохранил как заметку во «Входящие».'); return new Response('ok'); }

  try {
    const lists = (await rows<any>(userId, 'lists')).map(l => l.title);
    const goals = (await rows<any>(userId, 'goals')).filter(g => g.status === 'active').map(g => ({ id: g.id, title: g.title }));
    const tz = profile.timezone ?? 'Asia/Almaty';
    const { date, time } = localClock(new Date(), tz);
    const sourceText = pendingDraft ? `${pendingDraft.source_text ?? ''}\n\nИсправление: ${text}` : text;
    const items = await parseMessage(sourceText, { nowLocal: `${date} ${time}`, timezone: tz, lists, goals, correction: pendingDraft ? text : undefined });
    if (!items.length) { await saveAsNote(userId, text); await send(chatId, 'Не понял, что это. Сохранил как заметку во «Входящие».'); return new Response('ok'); }
    if (pendingDraft) await db.from('bot_drafts').update({ status: 'cancelled' }).eq('id', pendingDraft.id);
    const { data: d } = await db.from('bot_drafts').insert({ user_id: userId, chat_id: chatId, payload: items, source_text: sourceText }).select('id').single();
    await send(chatId, renderDraft(items), [[
      { text: '✅ Сохранить', callback_data: `save:${d!.id}` },
      { text: '✏️ Изменить', callback_data: `edit:${d!.id}` },
      { text: '✖️ Отмена', callback_data: `cancel:${d!.id}` },
    ]]);
  } catch (e) {
    console.error(e);
    await saveAsNote(userId, text);
    await send(chatId, 'ИИ сейчас недоступен. Сохранил текст как заметку во «Входящие», ничего не потеряно.');
  }
  return new Response('ok');
});
```

`supabase/config.toml`:
```toml
[functions.telegram-webhook]
verify_jwt = false
[functions.cron-tick]
verify_jwt = false
```

- [ ] **Step 6: Привязка в настройках сайта**

SettingsPage, секция Telegram (при `cloudEnabled`): если `profile.telegramChatId` — «Подключено» + «Отключить» (убирает `telegramChatId`). Иначе кнопка «Подключить Telegram»: генерирует `code = newId()`, `insert into bot_links (code, user_id, expires_at = now+15min)` через `client.from('bot_links').insert(...)`, показывает ссылку `https://t.me/${import.meta.env.VITE_TELEGRAM_BOT}?start=${code}` (кнопка «Открыть Telegram» + текст «Ссылка действует 15 минут»). Добавить `VITE_TELEGRAM_BOT` в `.env.example`.

- [ ] **Step 7: SETUP.md — раздел «Telegram»**

1) @BotFather → /newbot → имя и username → скопировать токен. 2) В Supabase → Edge Functions → Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (любая длинная строка), `ANTHROPIC_API_KEY`, `CRON_SECRET`. 3) Деплой функций: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase functions deploy telegram-webhook --no-verify-jwt`, `... cron-tick --no-verify-jwt`. 4) Установить webhook (одна команда curl с `setWebhook?url=https://<ref>.supabase.co/functions/v1/telegram-webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>`). 5) На сайте: Настройки → Подключить Telegram → открыть ссылку → бот ответит «Подключено».

- [ ] **Step 8: Проверка и коммит**

Минимум: внимательная проверка типов вручную (Deno в проекте может отсутствовать). `npm test` PASS.

```bash
git add -A && git commit -m "feat: Telegram bot edge function with AI parsing and confirm-before-save

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 16: Утренняя сводка (cron-tick) и расписание

**Files:**
- Create: `supabase/functions/cron-tick/index.ts`, `supabase/migrations/0002_cron.sql`
- Modify: `docs/SETUP.md`

- [ ] **Step 1: cron-tick/index.ts**

```ts
import { db, rows } from '../_shared/db.ts';
import { send, esc } from '../_shared/tg.ts';
import { buildMorningDigest, shouldSendMorning, localClock, reminderOccursOn } from '../_shared/domain.ts';

const SECRET = Deno.env.get('CRON_SECRET')!;
const SITE = Deno.env.get('SITE_URL') ?? '';
const DAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const dateLabel = (iso: string) => { const d = new Date(iso + 'T00:00:00'); return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; };

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== SECRET) return new Response('forbidden', { status: 403 });
  const now = new Date();
  const { data: profiles } = await db.from('rows').select('user_id,data').eq('collection', 'profiles').not('data->>telegramChatId', 'is', null);
  let sent = 0;
  for (const p of profiles ?? []) {
    const userId = p.user_id as string, profile = p.data as any;
    const tz = profile.timezone ?? 'Asia/Almaty';
    const { date: today } = localClock(now, tz);
    const { data: rec } = await db.from('sent_digests').select('*').eq('user_id', userId).eq('kind', 'morning').eq('date', today).maybeSingle();
    if (rec?.sent || (rec?.attempts ?? 0) >= 3) continue;
    if (!shouldSendMorning(now, tz, profile.morningTime ?? '09:00', null)) continue;

    try {
      const tasks = await rows<any>(userId, 'tasks');
      const reminders = await rows<any>(userId, 'reminders');
      const goals = await rows<any>(userId, 'goals');
      const todays = tasks.filter(t => t.date === today && t.status !== 'skipped' && t.status !== 'done');
      const timed = todays.filter(t => t.plannedStart).sort((a, b) => a.plannedStart.localeCompare(b.plannedStart));
      const untimed = todays.filter(t => !t.plannedStart);
      const carried = tasks.filter(t => t.date && t.date < today && (t.status === 'todo' || t.status === 'doing'));
      const wg = goals.find(g => g.id === profile.weekGoalId);
      const wgTasks = tasks.filter(t => t.goalId === wg?.id && t.status !== 'skipped');
      const text = buildMorningDigest({
        dateLabel: dateLabel(today),
        weekGoal: wg ? { title: wg.title, progress: wgTasks.length ? wgTasks.filter(t => t.status === 'done').length / wgTasks.length : 0 } : undefined,
        timed, untimed,
        reminders: reminders.filter(r => reminderOccursOn(r, today)).map(r => ({ text: r.text, time: r.time, yearly: r.repeat === 'yearly' })),
        carried,
      });
      const buttons = timed.concat(untimed).slice(0, 8).map(t => [{ text: `▶ ${t.title.slice(0, 30)}`, callback_data: `start:${t.id}` }]);
      if (SITE) buttons.push([{ text: 'Открыть Ikigai', url: SITE }]);
      const res = await send(profile.telegramChatId, esc(text), buttons);
      if (!res.ok) throw new Error(JSON.stringify(res));
      await db.from('sent_digests').upsert({ user_id: userId, kind: 'morning', date: today, attempts: (rec?.attempts ?? 0) + 1, sent: true });
      sent++;
    } catch (e) {
      console.error(e);
      await db.from('sent_digests').upsert({ user_id: userId, kind: 'morning', date: today, attempts: (rec?.attempts ?? 0) + 1, sent: false });
    }
  }
  return Response.json({ sent });
});
```

Примечание: `esc(text)` экранирует HTML целиком — заголовки в сводке не используют теги, поэтому это безопасно.

- [ ] **Step 2: 0002_cron.sql**

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Замени <PROJECT_REF> и <CRON_SECRET> на свои значения перед запуском.
select cron.schedule(
  'ikigai-tick',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/cron-tick',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 3: SETUP.md — раздел «Утренняя сводка»**

1) Database → Extensions: включить `pg_cron` и `pg_net`. 2) Edge Functions → Secrets: добавить `SITE_URL` (адрес сайта). 3) SQL Editor: вставить `0002_cron.sql`, заменив `<PROJECT_REF>` и `<CRON_SECRET>`, Run. 4) Проверка: в Настройках поставить время сводки на «через 5 минут» и дождаться сообщения; вернуть 09:00.

- [ ] **Step 4: Коммит**

```bash
git add -A && git commit -m "feat: morning digest cron function and pg_cron schedule

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Самопроверка плана

**Покрытие спецификации (этап 1):** Сегодня (T7), Календарь (T8), Доски (T9), Цели (T10), Мечты (T11), Напоминания (T11), Списки (T12), Блокнот (T12), Быстрая запись (T6), Поиск (T12), Настройки + экспорт + демо (T13), стиль (T0, T5), раскладка и мобильная панель (T5), бот: привязка, разбор с подтверждением, кнопки Начать/Закончить, лимит ИИ, запасное сохранение в заметку (T15), утренняя сводка с защитой от дублей и повторами (T16), офлайн-очередь и индикатор «Не сохранено» (T14), RLS (T14), тесты домена (T2, T3, T4, T6). Аналитика и Кодекс — «скоро» (T5), как в спецификации.

**Согласованность имён:** `useTaskActions` → `{ tasks, save, start, finish, reopen, toggleDone, reschedule, skip, del }` используется в T7–T10; `taskOps` — T6/T9; `goalProgress(goal, goals, tasks)` — T7/T10/T16 (в T16 реализован инлайн по той же формуле для одной цели); `reminderOccursOn(r, date)` — T7/T8/T11/T16; `localClock` — T3/T15/T16; коллекции по `COLLECTIONS`; `ensureDefaults`/`loadDemo` — T4/T5/T13.
