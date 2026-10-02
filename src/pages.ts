import { lazy } from 'react';

// «Сегодня» — стартовая страница, она в основном файле. Остальные разделы грузятся
// при первом переходе: так первый экран не ждёт кода календаря, досок и блокнота.
export const CalendarPage = lazy(() => import('./features/calendar/CalendarPage').then(m => ({ default: m.CalendarPage })));
export const BoardsPage = lazy(() => import('./features/boards/BoardsPage').then(m => ({ default: m.BoardsPage })));
export const GoalsPage = lazy(() => import('./features/goals/GoalsPage').then(m => ({ default: m.GoalsPage })));
export const GoalDetail = lazy(() => import('./features/goals/GoalDetail').then(m => ({ default: m.GoalDetail })));
export const DreamsPage = lazy(() => import('./features/dreams/DreamsPage').then(m => ({ default: m.DreamsPage })));
export const RemindersPage = lazy(() => import('./features/reminders/RemindersPage').then(m => ({ default: m.RemindersPage })));
export const ListsPage = lazy(() => import('./features/lists/ListsPage').then(m => ({ default: m.ListsPage })));
export const ListDetail = lazy(() => import('./features/lists/ListDetail').then(m => ({ default: m.ListDetail })));
export const NotesPage = lazy(() => import('./features/notes/NotesPage').then(m => ({ default: m.NotesPage })));
export const DebtsPage = lazy(() => import('./features/debts/DebtsPage').then(m => ({ default: m.DebtsPage })));
export const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
export const InboxPage = lazy(() => import('./features/inbox/InboxPage').then(m => ({ default: m.InboxPage })));
export const LifePage = lazy(() => import('./features/life/LifePage').then(m => ({ default: m.LifePage })));
