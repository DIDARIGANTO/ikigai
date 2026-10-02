/** Шаблоны новой заметки — простой текст, без разметки: заметка остаётся обычной строкой. */
export type NoteTemplateKey = 'blank' | 'todo' | 'idea';

export interface NoteTemplate {
  key: NoteTemplateKey;
  label: string;
  /** Одна строка в меню: что внутри. */
  hint: string;
  title: string;
  body: string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  { key: 'blank', label: 'Пустая', hint: 'Чистый лист', title: '', body: '' },
  {
    key: 'todo',
    label: 'Список дел',
    hint: 'Три строки с галочками',
    title: 'Список дел',
    body: '- [ ] \n- [ ] \n- [ ] ',
  },
  {
    key: 'idea',
    label: 'Идея',
    hint: 'Заголовок и три вопроса',
    title: 'Идея',
    body: 'Что это?\n\n\nЗачем это мне?\n\n\nПервый маленький шаг:\n',
  },
];

export function noteTemplate(key: NoteTemplateKey): NoteTemplate {
  return NOTE_TEMPLATES.find(t => t.key === key) ?? NOTE_TEMPLATES[0];
}

/** Слова в тексте: всё, что между пробелами, кроме одиноких знаков вроде «-» и «[ ]». */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
}

/** «1 слово», «3 слова», «12 слов». */
export function wordsLabel(n: number): string {
  const a = n % 100;
  const b = n % 10;
  const form = a > 10 && a < 20 ? 'слов' : b === 1 ? 'слово' : b >= 2 && b <= 4 ? 'слова' : 'слов';
  return `${n} ${form}`;
}
