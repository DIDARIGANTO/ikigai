import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Goal, Task } from '@/lib/types';
import { goalProgress } from '@/lib/domain/goals';
import { buildGoalForest } from './meta';
import { cardClass } from '@/components/ui/Card';
import { FOCUS, GoalGlyph, HorizonChip, ProgressInline, goalTitleClass } from './parts';

/** Отступ уровня: подцель сдвигается на ширину шеврона и зазора. */
const INDENT = 24;

interface NodeProps {
  goal: Goal;
  depth: number;
  childrenOf: Map<string, Goal[]>;
  allGoals: Goal[];
  tasks: Task[];
  collapsed: Set<string>;
  toggle: (id: string) => void;
  open: (id: string) => void;
}

function GoalNode({ goal, depth, childrenOf, allGoals, tasks, collapsed, toggle, open }: NodeProps) {
  const kids = childrenOf.get(goal.id) ?? [];
  const expanded = kids.length > 0 && !collapsed.has(goal.id);
  const pct = Math.round(goalProgress(goal, allGoals, tasks) * 100);

  return (
    <li>
      {/* Строка 40 px с линией снизу; вся строка ведёт на страницу цели, для клавиатуры — ссылка в названии. */}
      <div
        onClick={() => open(goal.id)}
        className="group flex h-10 cursor-pointer items-center gap-2 border-b border-border pr-3 hover:bg-fill"
        style={{ paddingLeft: 8 + depth * INDENT }}
      >
        {kids.length > 0 ? (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              toggle(goal.id);
            }}
            aria-expanded={expanded}
            aria-label={expanded ? `Свернуть: ${goal.title}` : `Раскрыть: ${goal.title}`}
            className={`relative inline-flex size-6 shrink-0 items-center justify-center rounded-chip text-muted hover:bg-fill-strong hover:text-text pointer-coarse:before:absolute pointer-coarse:before:-inset-2.5 pointer-coarse:before:content-[''] ${FOCUS}`}
          >
            <ChevronRight size={14} className={`transition-transform duration-(--duration-base) ${expanded ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <span aria-hidden="true" className="size-6 shrink-0" />
        )}

        <GoalGlyph goal={goal} />
        <Link
          to={`/goals/${goal.id}`}
          onClick={e => e.stopPropagation()}
          className={`ml-1 min-w-0 flex-1 truncate rounded-sm text-body ${FOCUS} ${goalTitleClass(goal)}`}
        >
          {goal.title}
        </Link>

        <HorizonChip horizon={goal.horizon} compact />
        <ProgressInline pct={pct} label={`Прогресс цели «${goal.title}»`} barClass="hidden w-24 sm:block" />
      </div>

      {expanded ? (
        <ul>
          {kids.map(k => (
            <GoalNode
              key={k.id}
              goal={k}
              depth={depth + 1}
              childrenOf={childrenOf}
              allGoals={allGoals}
              tasks={tasks}
              collapsed={collapsed}
              toggle={toggle}
              open={open}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Дерево целей от корней к листьям.
 * `goals` — показываемые цели (уже отфильтрованные), `allGoals` — все: по ним считается прогресс,
 * иначе скрытая фильтром подцель пропала бы и из процентов.
 */
export function GoalTree({ goals, allGoals, tasks }: { goals: Goal[]; allGoals: Goal[]; tasks: Task[] }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  // Цель, чей родитель отфильтрован или потерян в цикле, поднимается в корни — иначе она исчезла бы.
  const { roots, childrenOf } = useMemo(() => buildGoalForest(goals), [goals]);

  const toggle = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    // Линия снизу у каждой строки; последняя прячется под рамкой карточки (-mb-px).
    <div className={`overflow-hidden ${cardClass()}`}>
      <ul className="stagger -mb-px">
        {roots.map(g => (
          <GoalNode
            key={g.id}
            goal={g}
            depth={0}
            childrenOf={childrenOf}
            allGoals={allGoals}
            tasks={tasks}
            collapsed={collapsed}
            toggle={toggle}
            open={id => navigate(`/goals/${id}`)}
          />
        ))}
      </ul>
    </div>
  );
}
