import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CornerLeftUp, Flag, ListTree, Plus } from 'lucide-react';
import type { Goal, Horizon, Task } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { Card, cardClass } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useProfile } from '@/data/hooks';
import { goalProgress, HORIZON_LABEL } from '@/lib/domain/goals';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import { GoalTree } from './GoalTree';
import { useGoalEditor } from './GoalEditor';
import { HORIZON_ICON, HORIZON_ORDER, goalDatesLabel, pluralRu } from './meta';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { FOCUS, GoalGlyph, ProgressInline, goalTitleClass } from './parts';

type Tab = 'tree' | Horizon;
type Filter = 'active' | 'done' | 'all';

const TABS: { value: Tab; label: string; icon: ReactNode }[] = [
  { value: 'tree', label: 'Дерево', icon: <ListTree size={14} aria-hidden="true" /> },
  ...HORIZON_ORDER.map(h => {
    const Icon = HORIZON_ICON[h];
    return { value: h as Tab, label: HORIZON_LABEL[h], icon: <Icon size={14} aria-hidden="true" /> };
  }),
];

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'active', label: 'Активные' },
  { key: 'done', label: 'Достигнутые' },
  { key: 'all', label: 'Все' },
];

const isTab = (v: string | null): v is Tab => TABS.some(t => t.value === v);
const isFilter = (v: string | null): v is Filter => FILTERS.some(f => f.key === v);

const matches = (goal: Goal, filter: Filter) =>
  filter === 'all' ? true : filter === 'done' ? goal.status === 'done' : goal.status === 'active';

/** Строка цели на вкладке горизонта: 40 px, линия снизу; срок, шаги и родитель — приглушённо. */
function GoalRow({
  goal,
  goals,
  tasks,
  isWeekGoal,
  onOpen,
}: {
  goal: Goal;
  goals: Goal[];
  tasks: Task[];
  isWeekGoal: boolean;
  onOpen: () => void;
}) {
  const pct = Math.round(goalProgress(goal, goals, tasks) * 100);
  const steps = tasks.filter(t => t.goalId === goal.id && t.status !== 'skipped');
  const doneSteps = steps.filter(t => t.status === 'done').length;
  const parent = goal.parentId ? goals.find(g => g.id === goal.parentId) : undefined;
  const dates = goalDatesLabel(goal);

  return (
    <li
      onClick={onOpen}
      className="group flex h-10 cursor-pointer items-center gap-3 border-b border-border px-3 hover:bg-fill"
    >
      <GoalGlyph goal={goal} />
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <Link
          to={`/goals/${goal.id}`}
          onClick={e => e.stopPropagation()}
          className={`min-w-0 truncate rounded-sm text-body ${FOCUS} ${goalTitleClass(goal)}`}
        >
          {goal.title}
        </Link>
        {isWeekGoal ? (
          <Chip icon={<Flag size={12} />} className="max-sm:hidden">
            Цель недели
          </Chip>
        ) : null}
        {parent ? (
          <span className="flex min-w-0 items-center gap-1 text-small text-muted max-md:hidden" title={`Входит в цель «${parent.title}»`}>
            <CornerLeftUp size={14} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{parent.title}</span>
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-small text-muted tabular-nums max-sm:hidden">{dates ?? 'Без срока'}</span>
      <span
        className="w-12 shrink-0 text-right font-mono text-small tabular-nums text-muted max-sm:hidden"
        title={`${steps.length} ${pluralRu(steps.length, ['шаг', 'шага', 'шагов'])} · ${doneSteps} сделано`}
      >
        {doneSteps}/{steps.length}
      </span>
      <ProgressInline pct={pct} label={`Прогресс цели «${goal.title}»`} barClass="hidden w-20 sm:block" />
    </li>
  );
}

export function GoalsPage() {
  const { goals, tasks } = useTaskActionsCtx();
  const [profile] = useProfile();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { open, editor } = useGoalEditor();

  const tabParam = params.get('tab');
  const tab: Tab = isTab(tabParam) ? tabParam : 'tree';
  const filterParam = params.get('status');
  const filter: Filter = isFilter(filterParam) ? filterParam : 'active';

  // `?new=year` — создать цель снаружи (чек-лист «Первые шаги», «Моя жизнь»): сразу открыть редактор.
  const newParam = params.get('new');
  useEffect(() => {
    if (!newParam) return;
    const horizon = HORIZON_ORDER.includes(newParam as Horizon) ? (newParam as Horizon) : 'year';
    open(null, { horizon });
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
  }, [newParam, params, setParams, open]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };

  const visible = useMemo(() => goals.filter(g => matches(g, filter)), [goals, filter]);
  const onTab = useMemo(
    () => (tab === 'tree' ? visible : visible.filter(g => g.horizon === tab)),
    [visible, tab],
  );

  // Горизонт новой цели берётся из вкладки; на «Дереве» — год, самый ходовой срок.
  const newHorizon: Horizon = tab === 'tree' ? 'year' : tab;

  const header = (
    <PageHeader
      title="Цели"
      icon={<SectionIcon k="goals" size={20} />}
      tone="indigo"
      description="Мечта со сроком и шагами: от нескольких лет до недели"
      actions={
        <Button variant="primary" onClick={() => open(null, { horizon: newHorizon })}>
          <Plus size={16} aria-hidden="true" />
          Цель
        </Button>
      }
    />
  );

  const counts = useMemo(() => {
    const out: Record<Tab, number> = { tree: visible.length, years: 0, year: 0, month: 0, week: 0 };
    for (const g of visible) out[g.horizon] += 1;
    return out;
  }, [visible]);

  if (goals.length === 0) {
    return (
      <div className="mx-auto max-w-[1120px]">
        {header}
        <Card className="mt-6">
          <EmptyState
            compact
            className="py-10"
            k="goals"
            title="Целей пока нет"
            description="Цель — это мечта со сроком и шагами. Создай первую или начни со списка мечт."
            action={
              <div className="flex flex-col items-center gap-3">
                <Button variant="secondary" onClick={() => open(null, { horizon: 'year' })}>
                  <Plus size={16} aria-hidden="true" />
                  Создать цель
                </Button>
                <Link
                  to="/dreams"
                  className={`rounded-sm text-body font-medium text-accent-strong hover:underline ${FOCUS}`}
                >
                  Открыть мечты
                </Link>
              </div>
            }
          />
        </Card>
        {editor}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1120px]">
      {header}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Горизонты" className="min-w-0 max-w-full">
          <Segmented
            label="Горизонты"
            value={tab}
            onChange={t => setParam('tab', t)}
            kind="tabs"
            options={TABS.map(t => ({ ...t, count: counts[t.value] }))}
          />
        </nav>
        <Select
          fieldSize="sm"
          aria-label="Статус целей"
          value={filter}
          onChange={e => setParam('status', e.target.value)}
          className="w-36"
          wrapperClassName="shrink-0 max-sm:ml-auto"
        >
          {FILTERS.map(f => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-4">
        {onTab.length === 0 ? (
          <p className={`px-4 py-10 text-center text-small text-muted ${cardClass({ variant: 'flat' })}`}>
            {filter === 'done' ? 'Достигнутых целей пока нет' : 'Здесь пока пусто'}
          </p>
        ) : tab === 'tree' ? (
          <GoalTree goals={onTab} allGoals={goals} tasks={tasks} />
        ) : (
          <div className={`overflow-hidden ${cardClass()}`}>
            <ul className="stagger -mb-px">
              {onTab.map(g => (
                <GoalRow
                  key={g.id}
                  goal={g}
                  goals={goals}
                  tasks={tasks}
                  isWeekGoal={profile.weekGoalId === g.id}
                  onOpen={() => navigate(`/goals/${g.id}`)}
                />
              ))}
            </ul>
          </div>
        )}
      </div>

      {editor}
    </div>
  );
}
