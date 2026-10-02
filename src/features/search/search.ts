import type { Debt, Dream, Goal, List, ListItem, Note, Reminder, Task } from '@/lib/types';
import type { SectionKey } from '@/lib/icons';
import { formatShortRu, todayISO } from '@/lib/dates';
import { nextOccurrence } from '@/lib/domain/reminders';
import { DIRECTION_LABEL, isClosed, leftOf } from '@/lib/domain/debts';
import { formatDebtAmount } from '@/features/debts/money';

export type SearchKind = 'task' | 'note' | 'listItem' | 'goal' | 'dream' | 'reminder' | 'debt';

export interface SearchHit {
  /** Уникальный ключ строки: вид + идентификатор. */
  key: string;
  kind: SearchKind;
  id: string;
  title: string;
  subtitle?: string;
  /** Куда вести по выбору. У задач пусто: они открываются в редакторе. */
  to?: string;
}

export interface SearchGroup {
  kind: SearchKind;
  label: string;
  icon: SectionKey;
  hits: SearchHit[];
  /** Сколько нашлось всего — чтобы показать «и ещё N». */
  total: number;
}

export interface SearchData {
  tasks: Task[];
  notes: Note[];
  listItems: ListItem[];
  lists: List[];
  goals: Goal[];
  dreams: Dream[];
  reminders: Reminder[];
  debts: Debt[];
}

export const MAX_PER_GROUP = 8;

/** Без учёта регистра и разницы е/ё — иначе «мама» не найдёт «мамё»-варианты. */
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

const hit = (hay: string | undefined, needle: string) => !!hay && norm(hay).includes(needle);

/** Первая непустая строка текста — подпись для заметки. */
function firstLine(body: string): string | undefined {
  const line = body
    .split('\n')
    .map(s => s.trim())
    .find(Boolean);
  if (!line) return undefined;
  return line.length > 70 ? `${line.slice(0, 69)}…` : line;
}

const HORIZON_LABEL: Record<Goal['horizon'], string> = {
  years: 'Годы',
  year: 'Год',
  month: 'Месяц',
  week: 'Неделя',
};

const safeDate = (iso: string | undefined): string | undefined => {
  if (!iso) return undefined;
  try {
    return formatShortRu(iso);
  } catch {
    return iso;
  }
};

interface GroupSpec {
  kind: SearchKind;
  label: string;
  icon: SectionKey;
  collect: (q: string, data: SearchData) => SearchHit[];
}

const SPECS: GroupSpec[] = [
  {
    kind: 'task',
    label: 'Задачи',
    icon: 'task',
    collect: (q, d) =>
      d.tasks
        .filter(t => hit(t.title, q) || hit(t.notes, q))
        .map(t => ({
          key: `task:${t.id}`,
          kind: 'task' as const,
          id: t.id,
          title: t.title,
          subtitle: safeDate(t.date) ?? (t.status === 'done' ? 'сделана' : 'без даты'),
        })),
  },
  {
    kind: 'note',
    label: 'Заметки',
    icon: 'notes',
    collect: (q, d) =>
      d.notes
        .filter(n => hit(n.title, q) || hit(n.body, q))
        .map(n => ({
          key: `note:${n.id}`,
          kind: 'note' as const,
          id: n.id,
          title: n.title || 'Без названия',
          subtitle: firstLine(n.body),
          to: `/notes?note=${n.id}`,
        })),
  },
  {
    kind: 'listItem',
    label: 'Пункты списков',
    icon: 'lists',
    collect: (q, d) =>
      d.listItems
        .filter(i => hit(i.text, q))
        .map(i => ({
          key: `listItem:${i.id}`,
          kind: 'listItem' as const,
          id: i.id,
          title: i.text,
          subtitle: d.lists.find(l => l.id === i.listId)?.title,
          to: `/lists/${i.listId}`,
        })),
  },
  {
    kind: 'goal',
    label: 'Цели',
    icon: 'goals',
    collect: (q, d) =>
      d.goals
        .filter(g => hit(g.title, q))
        .map(g => ({
          key: `goal:${g.id}`,
          kind: 'goal' as const,
          id: g.id,
          title: g.title,
          subtitle: HORIZON_LABEL[g.horizon],
          to: `/goals/${g.id}`,
        })),
  },
  {
    kind: 'dream',
    label: 'Мечты',
    icon: 'dreams',
    collect: (q, d) =>
      d.dreams
        .filter(m => hit(m.title, q))
        .map(m => ({
          key: `dream:${m.id}`,
          kind: 'dream' as const,
          id: m.id,
          title: m.title,
          subtitle: m.category,
          to: '/dreams',
        })),
  },
  {
    kind: 'reminder',
    label: 'Напоминания',
    icon: 'reminders',
    collect: (q, d) => {
      const today = todayISO();
      return d.reminders
        .filter(r => hit(r.text, q))
        .map(r => ({
          key: `reminder:${r.id}`,
          kind: 'reminder' as const,
          id: r.id,
          title: r.text,
          // Та же дата, что и на странице напоминаний: ближайшее срабатывание повтора.
          subtitle: safeDate(nextOccurrence(r, today) ?? r.date),
          to: '/reminders',
        }));
    },
  },
  {
    kind: 'debt',
    label: 'Долги',
    icon: 'debts',
    collect: (q, d) =>
      d.debts
        .filter(x => hit(x.person, q) || hit(x.note, q))
        .map(x => ({
          key: `debt:${x.id}`,
          kind: 'debt' as const,
          id: x.id,
          title: x.person,
          // «Мне должны · 40 000 ₸» или «Я должен · закрыт».
          subtitle: `${DIRECTION_LABEL[x.direction]} · ${isClosed(x) ? 'закрыт' : formatDebtAmount(leftOf(x), x.currency)}`,
          to: `/debts?debt=${x.id}`,
        })),
  },
];

/** Поиск по подстроке во всех разделах; максимум `MAX_PER_GROUP` строк на группу. */
export function buildSearch(query: string, data: SearchData): SearchGroup[] {
  const q = norm(query.trim());
  if (!q) return [];
  const groups: SearchGroup[] = [];
  for (const spec of SPECS) {
    const found = spec.collect(q, data);
    if (!found.length) continue;
    groups.push({
      kind: spec.kind,
      label: spec.label,
      icon: spec.icon,
      hits: found.slice(0, MAX_PER_GROUP),
      total: found.length,
    });
  }
  return groups;
}

/** Плоский список строк в порядке отображения — по нему ходят стрелки. */
export const flatHits = (groups: SearchGroup[]): SearchHit[] => groups.flatMap(g => g.hits);
