/** Самое длинное название, которое выводим из заметки: дальше оно перестаёт помещаться в строке задачи. */
const MAX = 80;

/**
 * Название для задачи, у которой есть только заметка (например, надиктованная): её первая непустая строка,
 * без лишних пробелов. Слишком длинную режем по границе слова и помечаем многоточием, а саму заметку не трогаем.
 */
export function titleFromNote(notes: string): string {
  const line =
    notes
      .split('\n')
      .map(l => l.replace(/\s+/g, ' ').trim())
      .find(Boolean) ?? '';
  if (line.length <= MAX) return line;
  const cut = line.slice(0, MAX - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space >= MAX / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
