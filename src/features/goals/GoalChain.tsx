import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Dream, Goal } from '@/lib/types';
import { HORIZON_SHORT } from './meta';

/**
 * Цепочка «Цели › Мечта › Год › Месяц» простым текстом с шевронами — без чипов и плиток.
 * Каждое звено ведёт на свою страницу. Эмодзи, выбранное человеком, стоит в строке перед названием.
 * `home` — первое звено-раздел («Цели»); `currentLast` — последнее звено и есть открытая страница.
 */
export function GoalChain({
  dream,
  goals,
  size = 'md',
  className = '',
  label = 'Цепочка цели',
  currentLast = false,
  home,
}: {
  dream?: Dream;
  goals: Goal[];
  size?: 'sm' | 'md';
  className?: string;
  label?: string;
  /** Последнее звено — страница, на которой мы стоим. */
  currentLast?: boolean;
  home?: { to: string; label: string };
}) {
  if (!home && !dream && !goals.length) return null;
  const text = size === 'sm' ? 'text-caption' : 'text-small';
  const link = `focus-ring min-w-0 truncate rounded-sm text-muted hover:text-text`;
  const emoji = (e?: string) => (e ? <span className="mr-1 font-emoji">{e}</span> : null);
  const items: { key: string; node: ReactNode }[] = [];
  if (home) {
    items.push({
      key: 'home',
      node: (
        <Link to={home.to} className={link}>
          {home.label}
        </Link>
      ),
    });
  }
  if (dream) {
    items.push({
      key: dream.id,
      node: (
        <Link to="/dreams" className={link} title={`Мечта: ${dream.title}`}>
          <span className="sr-only">Мечта: </span>
          {emoji(dream.emoji)}
          {dream.title}
        </Link>
      ),
    });
  }
  goals.forEach((g, i) => {
    const current = currentLast && i === goals.length - 1;
    items.push({
      key: g.id,
      node: (
        <Link
          to={`/goals/${g.id}`}
          className={current ? `${link} text-text` : link}
          title={`${HORIZON_SHORT[g.horizon]}: ${g.title}`}
          aria-current={current ? 'page' : undefined}
        >
          <span className="sr-only">{HORIZON_SHORT[g.horizon]}: </span>
          {emoji(g.emoji)}
          {g.title}
        </Link>
      ),
    });
  });
  return (
    <nav aria-label={label} className={className}>
      <ol className={`flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 ${text}`}>
        {items.map((it, i) => (
          <Fragment key={it.key}>
            {i > 0 ? (
              <li aria-hidden="true" className="flex items-center text-muted">
                <ChevronRight size={14} />
              </li>
            ) : null}
            <li className="flex min-w-0 items-center">{it.node}</li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
