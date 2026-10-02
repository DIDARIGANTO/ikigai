/**
 * Чистые помощники бота: без Deno, без сети, без зависимостей.
 * Вынесены отдельно, чтобы их можно было проверить тестами веб-проекта
 * (см. `src/lib/domain/botRender.test.ts`).
 */

export interface ParsedItem {
  type: 'task' | 'reminder' | 'list_item' | 'note';
  title: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  minutes?: number;
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  list_name?: string;
  area?: 'work' | 'personal';
  goal_id?: string;
}

/** Telegram разбирает наши сообщения как HTML, поэтому любой текст от ИИ и от пользователя экранируется. */
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const TYPE_ICON = { task: '📌', reminder: '🔔', list_item: '🛒', note: '📝' } as const;
export const TYPE_LABEL = { task: 'Задача', reminder: 'Напоминание', list_item: 'В список', note: 'Заметка' } as const;
export const REPEAT_LABEL: Record<string, string> = {
  daily: 'ежедневно',
  weekly: 'еженедельно',
  monthly: 'ежемесячно',
  yearly: 'ежегодно',
};

/** Черновик разбора: показывается перед сохранением, вместе с кнопками «Сохранить / Изменить / Отмена». */
export function renderDraft(items: ParsedItem[]): string {
  const lines = items.map(i => {
    const when = [i.date, i.time].filter(Boolean).join(' ');
    const extra =
      i.type === 'list_item'
        ? ` → ${esc(i.list_name ?? 'Купить')}`
        : i.repeat && i.repeat !== 'none'
          ? ` · ${REPEAT_LABEL[i.repeat] ?? i.repeat}`
          : '';
    return `${TYPE_ICON[i.type]} <b>${TYPE_LABEL[i.type]}</b>${when ? ` · ${esc(when)}` : ''}${extra}\n${esc(i.title)}`;
  });
  return `Вот что я понял:\n\n${lines.join('\n\n')}`;
}
