import { describe, it, expect } from 'vitest';
// Чистые помощники бота живут рядом с edge-функциями (Deno), но зависимостей от Deno не имеют,
// поэтому их можно проверять тем же тестовым прогоном, что и остальную доменную логику.
import { renderDraft, renderReminderAlert, renderSaved, renderUndone, esc, type ParsedItem } from '../../../supabase/functions/_shared/render.ts';

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

describe('renderDraft with a voice message', () => {
  it('shows what was heard above the draft, escaped', () => {
    const out = renderDraft([{ type: 'task', title: 'Позвонить маме' }], 'позвонить маме <срочно>');
    expect(out.startsWith('🎙 Услышал: «позвонить маме &lt;срочно&gt;»\n\nВот что я понял:')).toBe(true);
  });
});

describe('renderSaved', () => {
  it('lists what was written, one line per item, with the count', () => {
    const items: ParsedItem[] = [
      { type: 'task', title: 'Позвонить маме', date: '2026-10-03', time: '19:00' },
      { type: 'list_item', title: 'Хлеб' },
      { type: 'reminder', title: 'Оплатить интернет', date: '2026-10-05', repeat: 'monthly' },
      { type: 'note', title: 'Идея про бота' },
    ];
    expect(renderSaved(items)).toBe(
      '✅ Записал (4):\n'
        + '📌 Позвонить маме · 2026-10-03 19:00\n'
        + '🛒 Хлеб → Купить\n'
        + '🔔 Оплатить интернет · 2026-10-05 · ежемесячно\n'
        + '📝 Идея про бота',
    );
  });

  it('puts the recognised speech first and keeps Telegram HTML valid', () => {
    const out = renderSaved([{ type: 'task', title: 'Купить <молоко>' }], 'купить молоко & хлеб');
    expect(out).toBe('🎙 Услышал: «купить молоко &amp; хлеб»\n\n✅ Записал (1):\n📌 Купить &lt;молоко&gt;');
  });

  it('shortens a very long dictation so the message stays under the Telegram limit', () => {
    const out = renderSaved([{ type: 'task', title: 'Дело' }], 'слово '.repeat(400));
    expect(out.length).toBeLessThan(1000);
    expect(out).toContain('…»');
  });
});

describe('renderUndone', () => {
  it('says that nothing was written', () => {
    expect(renderUndone()).toBe('↩️ Отменено: ничего не записано.');
  });
});

describe('идея в ответах бота', () => {
  it('черновик и «записал» называют её идеей, с лампочкой', () => {
    const items: ParsedItem[] = [{ type: 'idea', title: 'Приложение для барберов' }];
    expect(renderDraft(items)).toContain('💡 <b>Идея</b>');
    expect(renderSaved(items)).toContain('💡 Приложение для барберов');
  });
});

describe('повтор «по будням» в ответах бота', () => {
  it('черновик и «записал» называют его по-русски', () => {
    const items: ParsedItem[] = [{ type: 'reminder', title: '50 исходящих', date: '2026-10-05', time: '10:00', repeat: 'weekdays' }];
    expect(renderDraft(items)).toContain('· по будням');
    expect(renderSaved(items)).toContain('· по будням');
  });
});

describe('renderReminderAlert', () => {
  it('«⏰» и текст напоминания', () => {
    expect(renderReminderAlert({ text: '50 исходящих' })).toBe('⏰ 50 исходящих');
  });

  it('экранирует HTML: текст пишет человек', () => {
    expect(renderReminderAlert({ text: 'Позвонить <Асхату> & маме' })).toBe('⏰ Позвонить &lt;Асхату&gt; &amp; маме');
  });
});
