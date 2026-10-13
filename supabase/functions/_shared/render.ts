/**
 * Чистые помощники бота: без Deno, без сети, без зависимостей.
 * Вынесены отдельно, чтобы их можно было проверить тестами веб-проекта
 * (см. `src/lib/domain/botRender.test.ts`).
 */

export interface ParsedItem {
  type: 'task' | 'reminder' | 'list_item' | 'note' | 'idea';
  title: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  minutes?: number;
  repeat?: 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';
  list_name?: string;
  area?: 'work' | 'personal';
  goal_id?: string;
}

/** Telegram разбирает наши сообщения как HTML, поэтому любой текст от ИИ и от пользователя экранируется. */
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const TYPE_ICON = { task: '📌', reminder: '🔔', list_item: '🛒', note: '📝', idea: '💡' } as const;
export const TYPE_LABEL = { task: 'Задача', reminder: 'Напоминание', list_item: 'В список', note: 'Заметка', idea: 'Идея' } as const;
export const REPEAT_LABEL: Record<string, string> = {
  daily: 'ежедневно',
  weekdays: 'по будням',
  weekly: 'еженедельно',
  monthly: 'ежемесячно',
  yearly: 'ежегодно',
};

/** Сколько знаков надиктованного текста показываем в ответе: у Telegram предел 4096 на всё сообщение. */
const HEARD_LIMIT = 800;

/** «🎙 Услышал: …» — что распознано из голосового; пусто, если сообщение было текстом. */
function heardBlock(heard: string | undefined): string {
  if (!heard) return '';
  const short = heard.length > HEARD_LIMIT ? `${heard.slice(0, HEARD_LIMIT - 1)}…` : heard;
  return `🎙 Услышал: «${esc(short)}»\n\n`;
}

const whenOf = (i: ParsedItem) => [i.date, i.time].filter(Boolean).join(' ');

const extraOf = (i: ParsedItem): string =>
  i.type === 'list_item'
    ? ` → ${esc(i.list_name ?? 'Купить')}`
    : i.repeat && i.repeat !== 'none'
      ? ` · ${REPEAT_LABEL[i.repeat] ?? i.repeat}`
      : '';

/** Черновик разбора: показывается перед сохранением, вместе с кнопками «Сохранить / Изменить / Отмена». */
export function renderDraft(items: ParsedItem[], heard?: string): string {
  const lines = items.map(i => {
    const when = whenOf(i);
    return `${TYPE_ICON[i.type]} <b>${TYPE_LABEL[i.type]}</b>${when ? ` · ${esc(when)}` : ''}${extraOf(i)}\n${esc(i.title)}`;
  });
  return `${heardBlock(heard)}Вот что я понял:\n\n${lines.join('\n\n')}`;
}

/**
 * Ответ режима «записывать сразу»: короткий список записанного, по строке на дело, и «Отменить» под ним.
 * Кнопки выбора не нужны — всё уже в приложении.
 */
export function renderSaved(items: ParsedItem[], heard?: string): string {
  const lines = items.map(i => {
    const when = whenOf(i);
    return `${TYPE_ICON[i.type]} ${esc(i.title)}${when ? ` · ${esc(when)}` : ''}${extraOf(i)}`;
  });
  return `${heardBlock(heard)}✅ Записал (${items.length}):\n${lines.join('\n')}`;
}

/** Напоминание, у которого наступило время: короткое сообщение, чтобы его было видно на экране блокировки. */
export const renderReminderAlert = (r: { text: string }): string => `⏰ ${esc(r.text)}`;

/** Текст после нажатия «Отменить» под записанным. */
export const renderUndone = (): string => '↩️ Отменено: ничего не записано.';
