import { createBrowserRouter } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { Shell } from './app/Shell';
import { Soon } from './app/Placeholder';
import { TodayPage } from './features/today/TodayPage';
import { NotFound } from './features/errors/NotFound';
import { RootRouteError, RouteError } from './features/errors/RouteError';
import { Root } from './Root';
import { PageFrame } from './PageFrame';
import {
  BoardsPage,
  CalendarPage,
  DebtsPage,
  DreamsPage,
  GoalDetail,
  GoalsPage,
  InboxPage,
  LifePage,
  ListDetail,
  ListsPage,
  NotesPage,
  RemindersPage,
  SettingsPage,
} from './pages';

/**
 * Дерево маршрутов. Ошибка страницы ловится безымянным маршрутом внутри каркаса —
 * меню остаётся рабочим; ошибка самого каркаса — корневым `errorElement`.
 */
export const routes: RouteObject[] = [
  {
    element: <Root />,
    errorElement: <RootRouteError />,
    children: [
      {
        element: <Shell />,
        children: [
          {
            element: <PageFrame />,
            errorElement: <RouteError />,
            children: [
              { index: true, element: <TodayPage /> },
              { path: 'inbox', element: <InboxPage /> },
              { path: 'life', element: <LifePage /> },
              { path: 'calendar', element: <CalendarPage /> },
              { path: 'boards', element: <BoardsPage /> },
              { path: 'goals', element: <GoalsPage /> },
              { path: 'goals/:id', element: <GoalDetail /> },
              { path: 'dreams', element: <DreamsPage /> },
              { path: 'reminders', element: <RemindersPage /> },
              { path: 'lists', element: <ListsPage /> },
              { path: 'lists/:id', element: <ListDetail /> },
              { path: 'notes', element: <NotesPage /> },
              { path: 'debts', element: <DebtsPage /> },
              { path: 'settings', element: <SettingsPage /> },
              { path: 'analytics', element: <Soon /> },
              { path: 'codex', element: <Soon /> },
              { path: '*', element: <NotFound /> },
            ],
          },
        ],
      },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
