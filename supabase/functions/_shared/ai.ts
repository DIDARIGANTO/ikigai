// deno-lint-ignore-file no-explicit-any
// Разбор свободного текста на структурированные элементы через Anthropic Claude.
import type { ParsedItem } from './render.ts';
import { buildSystemPrompt, sanitizeItems, type PromptContext } from './prompt.ts';

const KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

export type { ParsedItem };
export { sanitizeItems };

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
            type: { type: 'string', enum: ['task', 'reminder', 'list_item', 'note', 'idea'] },
            title: { type: 'string' },
            date: { type: 'string' }, time: { type: 'string' }, minutes: { type: 'integer' },
            repeat: { type: 'string', enum: ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly'] },
            list_name: { type: 'string' }, area: { type: 'string', enum: ['work', 'personal'] }, goal_id: { type: 'string' },
          },
          required: ['type', 'title'],
        },
      },
    },
    required: ['items'],
  },
};

export async function parseMessage(text: string, ctx: PromptContext): Promise<ParsedItem[]> {
  const system = buildSystemPrompt(ctx);

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5', max_tokens: 2048, system,
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
