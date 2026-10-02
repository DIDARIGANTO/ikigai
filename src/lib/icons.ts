import {
  BookOpen,
  Bell,
  CalendarDays,
  ChartColumn,
  Compass,
  HandCoins,
  Inbox,
  Kanban,
  ListChecks,
  NotebookPen,
  Settings,
  Sparkles,
  SquareCheck,
  Sun,
  Target,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Иконка раздела. Один источник правды для меню, заголовков, поиска и пустых состояний. */
export const SECTION_ICONS = {
  inbox: Inbox,
  life: Compass,
  today: Sun,
  calendar: CalendarDays,
  boards: Kanban,
  goals: Target,
  dreams: Sparkles,
  reminders: Bell,
  lists: ListChecks,
  notes: NotebookPen,
  debts: HandCoins,
  analytics: ChartColumn,
  codex: BookOpen,
  settings: Settings,
  task: SquareCheck,
} as const satisfies Record<string, LucideIcon>;

export type SectionKey = keyof typeof SECTION_ICONS;
