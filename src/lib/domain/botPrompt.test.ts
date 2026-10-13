import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, MAX_ITEMS, sanitizeItems } from '../../../supabase/functions/_shared/prompt.ts';

const ctx = {
  nowLocal: '2026-10-02 10:30',
  timezone: 'Asia/Almaty',
  lists: ['Купить', 'Зал'],
  goals: [{ id: 'g1', title: 'Выпустить Ikigai' }],
};

describe('buildSystemPrompt', () => {
  it('tells the model the local time, the lists and the goals', () => {
    const p = buildSystemPrompt(ctx);
    expect(p).toContain('2026-10-02 10:30 (Asia/Almaty)');
    expect(p).toContain('Купить, Зал');
    expect(p).toContain('g1=Выпустить Ikigai');
  });

  it('falls back to the default list and "no goals" when there are none', () => {
    const p = buildSystemPrompt({ ...ctx, lists: [], goals: [] });
    expect(p).toContain('подходящий из списка пользователя: Купить)');
    expect(p).toContain('Цели: нет.');
  });

  it('knows about dictation: noise words, one item per task, spoken time', () => {
    const p = buildSystemPrompt(ctx);
    expect(p).toMatch(/надиктовано голосом/);
    expect(p).toMatch(/по одному элементу на каждое дело/);
    expect(p).toMatch(/в три дня» = 15:00/);
  });

  it('knows weekday repeats: «по будням» / «каждый будний день» → weekdays', () => {
    const p = buildSystemPrompt(ctx);
    expect(p).toMatch(/по будням/);
    expect(p).toMatch(/repeat=weekdays/);
  });

  it('knows ideas: «идея:» is an idea, «мысль:» stays a note', () => {
    const p = buildSystemPrompt(ctx);
    expect(p).toMatch(/«идея:»[^\n]*idea/);
    expect(p).toMatch(/«мысль:»[^\n]*note/);
  });

  it('adds the correction only when there is one', () => {
    expect(buildSystemPrompt(ctx)).not.toContain('поправил');
    expect(buildSystemPrompt({ ...ctx, correction: 'не в пятницу, а в субботу' })).toContain('«не в пятницу, а в субботу»');
  });
});

describe('sanitizeItems', () => {
  it('keeps only known types with a non-empty title and trims the title', () => {
    const out = sanitizeItems([
      { type: 'task', title: '  Позвонить маме  ', date: '2026-10-03' },
      { type: 'weird', title: 'x' },
      { type: 'note', title: '   ' },
      { type: 'list_item' },
      null,
      'строка',
      { type: 'list_item', title: 'Хлеб' },
    ]);
    expect(out).toEqual([{ type: 'task', title: 'Позвонить маме', date: '2026-10-03' }, { type: 'list_item', title: 'Хлеб' }]);
  });

  it('cuts long titles and caps the number of items', () => {
    const many = Array.from({ length: MAX_ITEMS + 10 }, (_, i) => ({ type: 'task', title: `Дело ${i}` }));
    expect(sanitizeItems(many)).toHaveLength(MAX_ITEMS);
    expect(sanitizeItems([{ type: 'note', title: 'я'.repeat(500) }])[0].title).toHaveLength(200);
  });

  it('keeps the idea type', () => {
    expect(sanitizeItems([{ type: 'idea', title: 'Приложение для барберов' }])).toEqual([{ type: 'idea', title: 'Приложение для барберов' }]);
  });

  it('keeps a known repeat and resets anything else to none', () => {
    const out = sanitizeItems([
      { type: 'reminder', title: 'a', repeat: 'weekdays' },
      { type: 'reminder', title: 'b', repeat: 'hourly' },
      { type: 'reminder', title: 'c' },
    ]);
    expect(out.map(i => i.repeat)).toEqual(['weekdays', 'none', undefined]);
  });

  it('is empty for anything that is not a list', () => {
    expect(sanitizeItems(undefined)).toEqual([]);
    expect(sanitizeItems({ type: 'task', title: 'x' })).toEqual([]);
  });
});
