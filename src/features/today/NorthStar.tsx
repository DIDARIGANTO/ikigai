import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Task } from '@/lib/types';
import type { NorthStar as Chain } from '@/lib/domain/day';

const CRUMB =
  'focus-ring inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-sm hover:text-text pointer-coarse:min-h-11';

const Sep = () => <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-muted" />;

/** Эмодзи — содержимое, выбранное человеком: просто символ 14 px в строке, без подложки. */
function Emoji({ value }: { value?: string }) {
  return value ? (
    <span aria-hidden="true" className="font-emoji shrink-0 text-body leading-none">
      {value}
    </span>
  ) : null;
}

interface Crumb {
  key: string;
  /** Для скринридера и подсказки: «Мечта», «Цель», «Цель недели», «Шаг». */
  kind: string;
  title: string;
  emoji?: string;
  to?: string;
  onClick?: () => void;
}

/**
 * «Северная звезда» — одна строка-цепочка под приветствием: мечта › цели › шаг дня.
 * Простой текст с шевронами; последний пункт ярче. На телефоне видны только два последних пункта.
 * Шаг открывает редактор задачи. Нет цели недели — тихая ссылка выбрать её.
 */
export function NorthStar({ chain, onOpenTask }: { chain: Chain; onOpenTask: (t: Task) => void }) {
  const { dream, goals, nextStep } = chain;

  if (!goals.length) {
    return (
      <Link to="/goals?tab=week" className={`${CRUMB} text-small text-muted`}>
        Выбери цель недели
        <Sep />
      </Link>
    );
  }

  const week = goals[goals.length - 1];
  const crumbs: Crumb[] = [
    ...(dream ? [{ key: dream.id, kind: 'Мечта', title: dream.title, emoji: dream.emoji, to: '/dreams' }] : []),
    ...goals.slice(0, -1).map(g => ({ key: g.id, kind: 'Цель', title: g.title, emoji: g.emoji, to: `/goals/${g.id}` })),
    { key: week.id, kind: 'Цель недели', title: week.title, emoji: week.emoji, to: `/goals/${week.id}` },
    ...(nextStep
      ? [{ key: nextStep.id, kind: 'Шаг', title: nextStep.title, emoji: nextStep.emoji, onClick: () => onOpenTask(nextStep) }]
      : []),
  ];
  const lastIndex = crumbs.length - 1;

  return (
    <nav aria-label="Путь к мечте">
      <ol className="flex min-w-0 items-center gap-1.5 text-small text-muted">
        {crumbs.map((c, i) => {
          const last = i === lastIndex;
          // На телефоне — только два последних пункта.
          const visibility = i < lastIndex - 1 ? 'hidden sm:flex' : 'flex';
          const body: ReactNode = (
            <>
              <Emoji value={c.emoji} />
              <span className="min-w-0 truncate">{c.title}</span>
            </>
          );
          const cls = `${CRUMB} ${last ? 'text-text' : ''}`;
          return (
            <li key={c.key} className={`${visibility} min-w-0 items-center gap-1.5 ${last ? 'shrink' : 'shrink-[2] max-w-60'}`}>
              {c.to ? (
                <Link to={c.to} className={cls} title={`${c.kind}: ${c.title}`} aria-label={`${c.kind}: ${c.title}`}>
                  {body}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={c.onClick}
                  className={`${cls} text-left`}
                  title={`${c.kind}: ${c.title}`}
                  aria-label={`${c.kind}: ${c.title}`}
                >
                  {body}
                </button>
              )}
              {last ? null : <Sep />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
