// deno-lint-ignore-file no-explicit-any
// Разбор свободного текста на структурированные элементы через Anthropic Claude.
import type { ParsedItem } from './render.ts';

const KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

export type { ParsedItem };

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

export async function parseMessage(
  text: string,
  ctx: { nowLocal: string; timezone: string; lists: string[]; goals: { id: string; title: string }[]; correction?: string },
): Promise<ParsedItem[]> {
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
    // Вебхук Telegram ждёт ответа: без таймаута зависший запрос к ИИ съест весь лимит функции.
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${await r.text()}`);
  const j = await r.json() as { content?: { type: string; input?: { items?: unknown } }[] };
  const use = (j.content ?? []).find((c: any) => c.type === 'tool_use');
  return sanitizeItems(use?.input?.items);
}

const TYPES = new Set(['task', 'reminder', 'list_item', 'note']);

/** Модель может вернуть что угодно, поэтому в базу уходят только элементы известного типа с непустым названием. */
export function sanitizeItems(items: unknown): ParsedItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((i: any) => i && typeof i === 'object' && TYPES.has(i.type) && typeof i.title === 'string' && i.title.trim())
    .map((i: any) => ({ ...i, title: String(i.title).trim().slice(0, 200) })) as ParsedItem[];
}
