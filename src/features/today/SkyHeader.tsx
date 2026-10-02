import type { ReactNode } from 'react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { formatDayRu, greetingRu, toDateISO } from '@/lib/dates';
import { daypart, type DaySummary } from '@/lib/domain/day';

const DAYPART_LABEL = { dawn: 'Рассвет', day: 'День', dusk: 'Закат', night: 'Ночь' } as const;

/** Минуты как «3:00»; ноль — прочерк. */
function clock(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (!m) return '—';
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/** Пункт сводки: подпись (гротеском), значение моноширинным и (кроме последнего) разделитель «·». */
function Stat({ label, children, last = false }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <dt className={last ? 'sr-only' : ''}>{label}</dt>
      <dd className="font-mono text-text">
        {children}
        {last ? null : (
          <span aria-hidden="true" className="ml-2 font-sans text-muted">
            ·
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * Шапка «Сегодня»: слева дата-подпись и приветствие (28 px; регистр и шрифт — по образу, имя — акцентным словом), справа — сводка дня
 * «план 3:00 · факт — · 0/3» (цифры моноширинные) и тонкая полоса прогресса 3 px.
 * Ниже — цепочка «мечта › цель › шаг» (`children`). Без фона, градиентов и украшений.
 */
export function SkyHeader({
  now,
  name,
  summary,
  children,
}: {
  /** Текущее время (мс), округлённое до минуты. */
  now: number;
  name?: string;
  summary: DaySummary;
  /** Строка под приветствием — цепочка «мечта › цель › шаг». */
  children?: ReactNode;
}) {
  const d = new Date(now);
  const part = daypart(d.getHours());
  const greeting = greetingRu(d.getHours());
  const trimmed = name?.trim();
  const { planned, actual, done, total } = summary;

  return (
    <header className="animate-in" data-daypart={part} data-testid="sky">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          <p className="label-text text-muted">
            <span className="inline-block first-letter:uppercase">{formatDayRu(toDateISO(d))}</span>
            <span className="sr-only"> · {DAYPART_LABEL[part]}</span>
          </p>
          <h1 className="mt-1.5 text-display title-text text-text text-balance">
            {greeting}
            {trimmed ? (
              <>
                , <span className="accent-word ml-1">{trimmed}</span>
              </>
            ) : null}
          </h1>
        </div>

        {total ? (
          <div className="w-full sm:w-auto sm:min-w-56 sm:pb-1.5">
            <dl className="flex items-baseline gap-2 text-small tabular-nums text-muted sm:justify-end">
              <Stat label="план">{clock(planned)}</Stat>
              <Stat label="факт">{clock(actual)}</Stat>
              <Stat label="сделано" last>
                {done}/{total}
              </Stat>
            </dl>
            <ProgressBar value={done / total} size="sm" label="Сделано за сегодня" className="mt-2" />
          </div>
        ) : null}
      </div>
      {children ? <div className="mt-3 min-w-0">{children}</div> : null}
    </header>
  );
}
