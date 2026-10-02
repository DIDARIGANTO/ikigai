import { describe, expect, it } from 'vitest';
import { NOTE_TEMPLATES, noteTemplate, wordCount, wordsLabel } from './templates';

describe('шаблоны заметок', () => {
  it('три шаблона: пустая, список дел, идея', () => {
    expect(NOTE_TEMPLATES.map(t => t.label)).toEqual(['Пустая', 'Список дел', 'Идея']);
  });

  it('пустая — действительно пустая', () => {
    expect(noteTemplate('blank')).toMatchObject({ title: '', body: '' });
  });

  it('список дел — строки с «- [ ]»', () => {
    const lines = noteTemplate('todo').body.split('\n');
    expect(lines).toHaveLength(3);
    for (const line of lines) expect(line.startsWith('- [ ] ')).toBe(true);
  });

  it('идея — заголовок и три вопроса простым текстом', () => {
    const idea = noteTemplate('idea');
    expect(idea.title).toBe('Идея');
    expect(idea.body.split('\n').filter(l => l.trim())).toHaveLength(3);
    expect(idea.body).not.toMatch(/[#*_]/);
  });
});

describe('счётчик слов', () => {
  it('считает только слова', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('  привет   мир ')).toBe(2);
    expect(wordCount('- [ ] купить хлеб\n- [ ] ')).toBe(2);
    expect(wordCount('В 2026 году')).toBe(3);
  });

  it('склоняет', () => {
    expect(wordsLabel(1)).toBe('1 слово');
    expect(wordsLabel(3)).toBe('3 слова');
    expect(wordsLabel(12)).toBe('12 слов');
    expect(wordsLabel(21)).toBe('21 слово');
    expect(wordsLabel(0)).toBe('0 слов');
  });
});
