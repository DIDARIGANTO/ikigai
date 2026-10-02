import type { Area, Repeat } from '@/lib/types';
import { dateLabel, durationLabel, priceLabel, stripSpans } from '@/lib/parse/quickParse';
import type { ParseToken, QuickKind, QuickParse, TokenKind } from '@/lib/parse/quickParse';

/** Тип записи в диалоге быстрой записи. */
export type QuickType = 'task' | 'reminder' | 'listItem' | 'note';

export const kindToType = (k: QuickKind | undefined): QuickType =>
  k === 'reminder' ? 'reminder' : k === 'list_item' ? 'listItem' : k === 'note' ? 'note' : 'task';

/** Порядок чипов под полем — как читается фраза: когда, сколько, где, зачем. */
export const CHIP_ORDER: TokenKind[] = ['date', 'time', 'duration', 'repeat', 'area', 'goal', 'list', 'price', 'important'];

/** Убирает из текста все куски данного вида (крестик на чипе). */
export function removeTokenKind(text: string, tokens: ParseToken[], kind: TokenKind): string {
  return stripSpans(
    text,
    tokens.filter(t => t.kind === kind),
  );
}

/** Первый токен каждого вида — по нему рисуется чип. */
export function chipTokens(tokens: ParseToken[]): ParseToken[] {
  const seen = new Set<TokenKind>();
  const out: ParseToken[] = [];
  for (const kind of CHIP_ORDER) {
    const t = tokens.find(x => x.kind === kind);
    if (t && !seen.has(kind)) {
      seen.add(kind);
      out.push(t);
    }
  }
  return out;
}

export const REPEAT_TEXT: Record<Repeat, string> = {
  none: 'один раз',
  daily: 'каждый день',
  weekly: 'каждую неделю',
  monthly: 'каждый месяц',
  yearly: 'каждый год',
};

export interface Destination {
  /** Задача без даты и доски попадает во «Входящие». */
  inbox: boolean;
  text: string;
}

/**
 * Строка «куда попадёт запись»: «Во входящие», «Сегодня 15:00 · 30 мин · Работа»,
 * «В список «Покупки» · 150 000 ₸», «Напоминание · Завтра 09:00 · каждый месяц».
 */
export function destination(
  type: QuickType,
  p: Pick<QuickParse, 'date' | 'time' | 'minutes' | 'price' | 'repeat'> & { area?: Area },
  extra: { now: Date; boardTitle?: string; listTitle?: string; folderTitle?: string; today: string },
): Destination {
  const when = (date: string | undefined) => [date ? dateLabel(date, extra.now) : null, p.time ?? null].filter(Boolean).join(' ');
  if (type === 'note') return { inbox: false, text: `В заметки · «${extra.folderTitle ?? 'Входящие'}»` };
  if (type === 'listItem') {
    const parts = [extra.listTitle ? `В список «${extra.listTitle}»` : 'Нужен список'];
    if (p.price) parts.push(priceLabel(p.price));
    return { inbox: false, text: parts.join(' · ') };
  }
  if (type === 'reminder') {
    const parts = ['Напоминание', when(p.date ?? extra.today)];
    if (p.repeat && p.repeat !== 'none') parts.push(REPEAT_TEXT[p.repeat]);
    return { inbox: false, text: parts.join(' · ') };
  }
  if (!p.date && !extra.boardTitle) return { inbox: true, text: 'Во входящие' };
  const parts: string[] = [];
  const w = when(p.date);
  if (w) parts.push(w);
  if (p.minutes) parts.push(durationLabel(p.minutes));
  parts.push(p.area === 'work' ? 'Работа' : 'Личное');
  if (extra.boardTitle) parts.push(`доска «${extra.boardTitle}»`);
  return { inbox: false, text: parts.join(' · ') };
}

/** Заголовок заметки — первая строка, обрезанная до разумной длины. */
export function noteTitleFrom(body: string): string {
  const first = body.split('\n').map(s => s.trim()).find(Boolean) ?? '';
  return first.length > 80 ? `${first.slice(0, 79)}…` : first || 'Без названия';
}
