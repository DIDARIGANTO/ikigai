import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { X } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import type { Tone } from '@/components/ui/tones';
import type { ParseToken, TokenKind } from '@/lib/parse/quickParse';
import { chipTokens } from './capture';

/**
 * Общие части быстрой записи (диалог и строка на «Сегодня»): подсветка распознанного прямо в поле
 * и чипы под ним. Подсветка нейтральная — плотная заливка и подчёркивание; цвет есть только
 * у точки 6 px на чипе, и он говорит о виде куска («когда», сфера, цель, деньги, важное).
 */

const KIND_TONE: Partial<Record<TokenKind, Tone>> = {
  date: 'sky',
  time: 'sky',
  duration: 'sky',
  repeat: 'sky',
  area: 'indigo',
  goal: 'lilac',
  list: 'lime',
  price: 'lime',
  important: 'rose',
};

/** Тон точки чипа — по виду распознанного, а не по значению. */
// oxlint-disable-next-line react/only-export-components -- тон токена нужен и строке «Сегодня»
export function tokenTone(t: ParseToken): Tone {
  return KIND_TONE[t.kind] ?? 'neutral';
}

/** Подсветка в поле: нейтральная заливка и такое же «кольцо» вместо отступов — текст не сдвигается. */
const MARK = 'rounded-sm bg-fill-strong text-transparent ring-2 ring-fill-strong underline decoration-muted underline-offset-4';

const EMOJI_HEAD = /^(\p{Extended_Pictographic}\S*)\s(.*)$/u;

/** Чипы распознанного: по одному на вид, точка вида слева, крестик убирает кусок из текста. */
export function TokenChips({
  tokens,
  onRemove,
  extra,
  className = '',
}: {
  tokens: ParseToken[];
  onRemove: (kind: TokenKind) => void;
  /** Чипы не из текста (доска, цель из «Подробнее»). */
  extra?: ReactNode;
  className?: string;
}) {
  const chips = chipTokens(tokens);
  if (!chips.length && !extra) return null;
  return (
    <ul aria-label="Распознано" className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {chips.map(t => {
        // Цель с эмодзи: эмодзи цели вместо точки, чтобы оно не обрезалось вместе с длинным названием.
        const m = t.kind === 'goal' ? EMOJI_HEAD.exec(t.label) : null;
        return (
          <li key={t.kind} className="min-w-0">
            <Chip
              tone={tokenTone(t)}
              icon={m ? <span className="font-emoji">{m[1]}</span> : undefined}
              onClick={() => onRemove(t.kind)}
              aria-label={`Убрать: ${t.label}`}
              title="Убрать из текста"
              className={`max-w-full ${t.kind === 'time' ? 'font-mono' : ''}`}
            >
              <span className="truncate max-w-40">{m ? m[2] : t.label}</span>
              <X size={12} aria-hidden="true" className="-mr-0.5 shrink-0 text-muted" />
            </Chip>
          </li>
        );
      })}
      {extra}
    </ul>
  );
}

/**
 * Поле с подсветкой: под прозрачным `<input>` лежит слой с тем же текстом, где распознанные куски
 * залиты тоном. Текст рисует само поле (каретка и выделение родные), слой только красит фон.
 * `textClass` — шрифт и размер, общие для поля и слоя.
 */
export const HighlightInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
    value: string;
    onValueChange: (v: string) => void;
    tokens: ParseToken[];
    textClass: string;
  }
>(function HighlightInput({ value, onValueChange, tokens, textClass, className = '', ...p }, ref) {
  const input = useRef<HTMLInputElement>(null);
  const layer = useRef<HTMLSpanElement>(null);
  useImperativeHandle(ref, () => input.current as HTMLInputElement);

  // Поле прокручивается вбок, когда текст длиннее — слой едет вместе с ним.
  const sync = useCallback(() => {
    if (layer.current && input.current) layer.current.style.translate = `${-input.current.scrollLeft}px 0`;
  }, []);
  useLayoutEffect(sync, [value, sync]);

  const parts: ReactNode[] = [];
  let at = 0;
  for (const t of [...tokens].filter(t => t.kind !== 'emoji').sort((a, b) => a.start - b.start)) {
    if (t.start < at) continue;
    if (t.start > at) parts.push(value.slice(at, t.start));
    parts.push(
      <mark key={t.start} className={MARK}>
        {value.slice(t.start, t.end)}
      </mark>,
    );
    at = t.end;
  }
  parts.push(value.slice(at));

  return (
    <div className={`relative min-w-0 flex-1 self-stretch ${className}`}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center overflow-hidden">
        <span ref={layer} className={`whitespace-pre text-transparent ${textClass}`}>
          {parts}
        </span>
      </div>
      <input
        ref={input}
        value={value}
        onChange={e => onValueChange(e.target.value)}
        onScroll={sync}
        onSelect={sync}
        onKeyUp={sync}
        className={`relative h-full w-full bg-transparent text-text placeholder:text-muted outline-none ${textClass}`}
        {...p}
      />
    </div>
  );
});
