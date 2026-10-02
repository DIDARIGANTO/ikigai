/**
 * Строки из многострочного поля: без пустых, без маркеров списка («- », «• », «1. », «[ ] »),
 * без повторов. Вставка из заметок превращается в аккуратные названия.
 */
export function parseLines(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw
      .replace(/^\s*(?:[-*•–—]|\d+[.)]|\[[ xX]?\])\s*/, '')
      .trim()
      .slice(0, 200);
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}
