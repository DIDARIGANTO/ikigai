import { describe, it, expect } from 'vitest';
// Чистые помощники бота живут рядом с edge-функциями (Deno), но зависимостей от Deno не имеют,
// поэтому их можно проверять тем же тестовым прогоном, что и остальную доменную логику.
import { renderDraft, esc, type ParsedItem } from '../../../supabase/functions/_shared/render.ts';

describe('esc', () => {
  it('escapes HTML special characters', () => {
    expect(esc('<b>1 & 2</b>')).toBe('&lt;b&gt;1 &amp; 2&lt;/b&gt;');
  });
});

describe('renderDraft', () => {
  it('renders a task with date and time', () => {
    const items: ParsedItem[] = [{ type: 'task', title: 'Позвонить маме', date: '2026-09-18', time: '19:00' }];
    expect(renderDraft(items)).toBe('Вот что я понял:\n\n📌 <b>Задача</b> · 2026-09-18 19:00\nПозвонить маме');
  });

  it('renders a yearly reminder with a Russian repeat label', () => {
    const items: ParsedItem[] = [{ type: 'reminder', title: 'ДР Асель', date: '2027-03-14', repeat: 'yearly' }];
    expect(renderDraft(items)).toContain('🔔 <b>Напоминание</b> · 2027-03-14 · ежегодно');
  });

  it('shows the target list for list items', () => {
    expect(renderDraft([{ type: 'list_item', title: 'Наушники' }])).toContain('🛒 <b>В список</b> → Купить');
    expect(renderDraft([{ type: 'list_item', title: 'Гантели', list_name: 'Зал' }])).toContain('→ Зал');
  });

  it('does not label repeat "none"', () => {
    expect(renderDraft([{ type: 'reminder', title: 'Оплатить свет', date: '2026-09-20', repeat: 'none' }]))
      .not.toContain('·  ');
  });

  it('escapes user and AI text so Telegram HTML stays valid', () => {
    const out = renderDraft([{ type: 'note', title: 'Идея: <канал> про 1 & 2' }]);
    expect(out).toContain('Идея: &lt;канал&gt; про 1 &amp; 2');
    expect(out).toContain('📝 <b>Заметка</b>');
  });

  it('separates several items with a blank line', () => {
    const items: ParsedItem[] = [
      { type: 'task', title: 'Зал', date: '2026-09-16', time: '07:00' },
      { type: 'task', title: 'Позвонить маме', date: '2026-09-18' },
    ];
    expect(renderDraft(items).split('\n\n')).toHaveLength(3);
  });
});
