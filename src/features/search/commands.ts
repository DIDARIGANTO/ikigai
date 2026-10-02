import type { SectionKey } from '@/lib/icons';
import type { SearchHit } from './search';

/**
 * Команды палитры (⌘K): что сделать, а не что найти. Здесь только описание и ранжирование —
 * сами действия подставляет диалог (навигация, быстрая запись, тема, выгрузка).
 */
export type CommandAction =
  | { type: 'quick' }
  | { type: 'go'; to: string }
  | { type: 'style' }
  | { type: 'export' };

export interface Command {
  id: string;
  label: string;
  /** Иконка раздела в плитке строки. */
  icon: SectionKey | 'style' | 'export' | 'plus' | 'telegram';
  /** Синонимы: по ним тоже находится, но с меньшим весом. */
  keywords?: string[];
  action: CommandAction;
  /** Показывать ли при пустом запросе (самые частые). */
  suggested?: boolean;
}

const GO: { key: SectionKey; label: string; to: string; keywords: string[]; suggested?: boolean }[] = [
  { key: 'today', label: 'Сегодня', to: '/', keywords: ['today', 'день', 'главная'], suggested: true },
  { key: 'calendar', label: 'Календарь', to: '/calendar', keywords: ['calendar', 'неделя', 'месяц'], suggested: true },
  { key: 'boards', label: 'Доски', to: '/boards', keywords: ['boards', 'канбан', 'колонки'] },
  { key: 'goals', label: 'Цели', to: '/goals', keywords: ['goals', 'план'] },
  { key: 'dreams', label: 'Мечты', to: '/dreams', keywords: ['dreams', 'желания'] },
  { key: 'reminders', label: 'Напоминания', to: '/reminders', keywords: ['reminders', 'дни рождения', 'даты'] },
  { key: 'lists', label: 'Списки', to: '/lists', keywords: ['lists', 'покупки', 'купить'] },
  { key: 'notes', label: 'Блокнот', to: '/notes', keywords: ['notes', 'заметки'] },
  { key: 'debts', label: 'Долги', to: '/debts', keywords: ['debts', 'долг', 'должен', 'должны', 'займ', 'одолжил'] },
  { key: 'inbox', label: 'Входящие', to: '/inbox', keywords: ['inbox', 'разобрать'] },
  { key: 'life', label: 'Моя жизнь', to: '/life', keywords: ['life', 'сферы', 'баланс'] },
  { key: 'settings', label: 'Настройки', to: '/settings', keywords: ['settings', 'параметры'] },
];

export const COMMANDS: Command[] = [
  {
    id: 'quick',
    label: 'Новая задача',
    icon: 'plus',
    keywords: ['добавить', 'создать', 'запись', 'task'],
    action: { type: 'quick' },
    suggested: true,
  },
  ...GO.map<Command>(g => ({
    id: `go:${g.key}`,
    label: `Перейти: ${g.label}`,
    icon: g.key,
    keywords: g.keywords,
    action: { type: 'go', to: g.to },
    suggested: g.suggested,
  })),
  {
    id: 'style',
    label: 'Сменить стиль',
    icon: 'style',
    keywords: ['стиль', 'тема', 'оформление', 'образ', 'тёмная', 'светлая', 'сигнал', 'графит', 'крафт', 'хардкор', 'dark', 'light'],
    action: { type: 'style' },
    suggested: true,
  },
  {
    id: 'export',
    label: 'Экспортировать данные',
    icon: 'export',
    keywords: ['скачать', 'копия', 'резервная', 'бэкап', 'json', 'выгрузить'],
    action: { type: 'export' },
    suggested: true,
  },
  {
    id: 'telegram',
    label: 'Открыть настройки Telegram',
    icon: 'telegram',
    keywords: ['бот', 'телеграм', 'telegram'],
    action: { type: 'go', to: '/settings#settings-telegram' },
  },
];

/** Без регистра и без разницы е/ё. */
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

/**
 * Буквы запроса встречаются в названии по порядку («нвз» → «Новая задача»). Чем плотнее, тем выше.
 * Чтобы не ловить случайные совпадения, запрос — от трёх букв и первая буква — начало слова.
 */
function subsequence(q: string, text: string): number {
  if (q.length < 3) return 0;
  const starts = [0, ...Array.from(text.matchAll(/[\s:·,]+/g), m => (m.index ?? 0) + m[0].length)];
  let best = 0;
  for (const start of starts) {
    if (text[start] !== q[0]) continue;
    let pos = start;
    let gaps = 0;
    let ok = true;
    for (const ch of q.slice(1)) {
      const next = text.indexOf(ch, pos + 1);
      if (next < 0) {
        ok = false;
        break;
      }
      gaps += next - pos - 1;
      pos = next;
    }
    if (ok) best = Math.max(best, Math.max(1, 30 - gaps));
  }
  return best;
}

/**
 * Вес совпадения: начало названия > начало слова > подстрока > синоним > буквы по порядку.
 * «Перейти:» — служебное слово, поэтому название раздела после двоеточия считается началом.
 */
export function scoreCommand(query: string, cmd: Pick<Command, 'label' | 'keywords'>): number {
  const q = norm(query.trim());
  if (!q) return 1;
  const label = norm(cmd.label);
  const name = label.includes(':') ? label.slice(label.indexOf(':') + 1).trim() : label;
  if (label.startsWith(q) || name.startsWith(q)) return 100;
  const words = label.split(/[\s:·,]+/).filter(Boolean);
  if (words.some(w => w.startsWith(q))) return 80;
  if (label.includes(q)) return 60;
  const keywords = (cmd.keywords ?? []).map(norm);
  if (keywords.some(k => k.startsWith(q))) return 50;
  if (keywords.some(k => k.includes(q))) return 40;
  return subsequence(q, name);
}

/** Команды для запроса: при пустом — предложенные, иначе совпавшие по весу (при равенстве — исходный порядок). */
export function rankCommands(query: string, commands: Command[] = COMMANDS, limit = 6): Command[] {
  if (!query.trim()) return commands.filter(c => c.suggested).slice(0, limit);
  return commands
    .map((c, i) => ({ c, i, s: scoreCommand(query, c) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map(x => x.c);
}

/* Недавнее: последние открытые результаты поиска, в localStorage. */

export const RECENT_KEY = 'ikigai.palette.recent';
export const RECENT_MAX = 5;

/** Новый результат — в начало, без повторов, не больше `max`. */
export function pushRecent(list: SearchHit[], hit: SearchHit, max = RECENT_MAX): SearchHit[] {
  const { key, kind, id, title, subtitle, to } = hit;
  return [{ key, kind, id, title, subtitle, to }, ...list.filter(h => h.key !== key)].slice(0, max);
}

const isHit = (v: unknown): v is SearchHit =>
  !!v && typeof v === 'object' && typeof (v as SearchHit).key === 'string' && typeof (v as SearchHit).id === 'string' &&
  typeof (v as SearchHit).title === 'string' && typeof (v as SearchHit).kind === 'string';

export function readRecent(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): SearchHit[] {
  try {
    const raw = storage?.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isHit).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function writeRecent(list: SearchHit[], storage: Pick<Storage, 'setItem'> | undefined = safeStorage()) {
  try {
    storage?.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* приватный режим — недавнее просто не запомнится */
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
