import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, ListChecks, Network, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Goal, GoalStatus, Task } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { burst } from '@/components/ui/Burst';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { useCollection, useProfile, useRepo } from '@/data/hooks';
import { todayISO } from '@/lib/dates';
import { childGoals, goalProgress, HORIZON_LABEL } from '@/lib/domain/goals';
import { formatHours, goalChain, goalFamily, goalHours, weekRange } from '@/lib/domain/life';
import { TaskCard } from '@/features/tasks/TaskCard';
import { useTaskEditor } from '@/features/tasks/TaskEditor';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import { useGoalEditor } from './GoalEditor';
import { GoalChain } from './GoalChain';
import { StepComposer, SubgoalComposer } from './Composers';
import { markCelebrated, readCelebrated, shouldCelebrate } from './celebrate';
import { HORIZON_ICON, STATUS_LABEL, goalDatesLabel, nextHorizon } from './meta';
import { FOCUS, GoalGlyph, HorizonChip, ProgressInline, goalTitleClass } from './parts';

/** Незавершённые сверху, внутри — по дате (без даты в конец), затем по порядку. */
function sortSteps(a: Task, b: Task): number {
  const openA = a.status === 'todo' || a.status === 'doing';
  const openB = b.status === 'todo' || b.status === 'doing';
  if (openA !== openB) return openA ? -1 : 1;
  if (a.date !== b.date) return (a.date ?? '9999').localeCompare(b.date ?? '9999');
  return a.position - b.position;
}

/** Подцель — строка 40 px с линией снизу: значок, название, горизонт, полоса и процент. */
function SubGoalRow({ goal, goals, tasks }: { goal: Goal; goals: Goal[]; tasks: Task[] }) {
  const navigate = useNavigate();
  const pct = Math.round(goalProgress(goal, goals, tasks) * 100);
  return (
    <li
      onClick={() => navigate(`/goals/${goal.id}`)}
      className="group flex h-10 cursor-pointer items-center gap-3 border-b border-border px-2 hover:bg-fill"
    >
      <GoalGlyph goal={goal} />
      <Link
        to={`/goals/${goal.id}`}
        onClick={e => e.stopPropagation()}
        className={`min-w-0 flex-1 truncate rounded-sm text-body ${FOCUS} ${goalTitleClass(goal)}`}
      >
        {goal.title}
      </Link>
      <HorizonChip horizon={goal.horizon} compact />
      <ProgressInline pct={pct} label={`Прогресс цели «${goal.title}»`} barClass="hidden w-20 sm:block" />
    </li>
  );
}

/** Строка «подпись — значение» в боковой карточке. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-4 text-body">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-text tabular-nums">{children}</dd>
    </div>
  );
}

/** Ячейка ряда цифр: подпись 13 px и значение моноширинными цифрами 20 px. */
function Stat({
  label,
  children,
  className = '',
  ref,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={ref} className={`min-w-0 border-border py-3 ${className}`}>
      <dt className="text-small text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-xl font-medium leading-7 tabular-nums text-text">{children}</dd>
    </div>
  );
}

const NONE = <span className="text-muted">—</span>;

/** «1,5 ч» → число моноширинными цифрами, единица — обычным шрифтом, приглушённо. */
function Amount({ text }: { text: string }) {
  const cut = text.lastIndexOf(' ');
  if (cut < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, cut)}
      <span className="ml-1 font-sans text-small font-normal text-muted">{text.slice(cut + 1)}</span>
    </>
  );
}

export function GoalDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { goals, tasks, save } = useTaskActionsCtx();
  const dreams = useCollection('dreams');
  const [profile, updateProfile] = useProfile();
  const { put, remove } = useRepo();
  const toast = useToast();
  const confirm = useConfirm();
  const goalEditor = useGoalEditor();
  const taskEditor = useTaskEditor();
  const ring = useRef<HTMLDivElement>(null);
  const [composing, setComposing] = useState(false);

  const goal = goals.find(g => g.id === id);
  const subs = useMemo(() => (goal ? childGoals(goals, goal.id) : []), [goals, goal]);
  const steps = useMemo(() => tasks.filter(t => t.goalId === id).sort(sortSteps), [tasks, id]);
  const progress = goal ? goalProgress(goal, goals, tasks) : 0;
  const status = goal?.status;

  // Первое достижение 100 % — праздник и предложение отметить цель достигнутой. Один раз на цель.
  useEffect(() => {
    if (!status || !shouldCelebrate({ id, progress, status, celebrated: readCelebrated() })) return;
    markCelebrated(id);
    if (ring.current) burst(ring.current, { count: 64, power: 9 });
    toast('Цель достигнута', {
      duration: 10000,
      action: {
        label: 'Отметить достигнутой',
        onClick: () => {
          const g = goals.find(x => x.id === id);
          if (g) void put('goals', { ...g, status: 'done' });
        },
      },
    });
  }, [id, progress, status, goals, put, toast]);

  if (!goal) {
    return (
      <EmptyState
        k="goals"
        title="Цель не найдена"
        description="Возможно, она была удалена."
        action={<Button onClick={() => navigate('/goals')}>К списку целей</Button>}
      />
    );
  }

  const chain = goalChain(goal, goals, dreams);
  const dream = chain.dream;
  const pct = Math.round(progress * 100);
  const dates = goalDatesLabel(goal);
  const isWeekGoal = profile.weekGoalId === goal.id;
  const HorizonIcon = HORIZON_ICON[goal.horizon];
  const week = weekRange(todayISO());
  const hoursWeek = goalHours(tasks, week.start, week.end, goalFamily(goals, goal.id));

  const setStatus = (s: GoalStatus) => void put('goals', { ...goal, status: s });

  const toggleWeekGoal = () => {
    void updateProfile({ weekGoalId: isWeekGoal ? undefined : goal.id });
    toast(isWeekGoal ? 'Цель недели снята' : 'Теперь это цель недели — она на «Сегодня»');
  };

  const onDelete = async () => {
    if (!(await confirm(`Удалить цель «${goal.title}»? Подцели и задачи останутся, но потеряют связь с ней.`))) return;
    for (const s of subs) await put('goals', { ...s, parentId: undefined });
    for (const t of tasks.filter(t => t.goalId === goal.id)) await save({ ...t, goalId: undefined });
    if (isWeekGoal) await updateProfile({ weekGoalId: undefined });
    await remove('goals', goal.id);
    toast('Цель удалена');
    navigate('/goals');
  };

  const stepsDone = steps.filter(t => t.status === 'done').length;
  const subsDone = subs.filter(s => s.status === 'done').length;
  const addSub = () => goalEditor.open(null, { parentId: goal.id, horizon: nextHorizon(goal.horizon) });

  return (
    <div className="mx-auto max-w-[1120px]">
      {/* Путь текстом: раздел, мечта и цели-предки; сама цель — заголовок ниже. */}
      <GoalChain home={{ to: '/goals', label: 'Цели' }} dream={dream} goals={chain.goals.slice(0, -1)} />

      <header className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <h1 id="goal-title" className="text-h1 font-semibold text-text break-words">
            {goal.emoji ? <span className="mr-2 font-emoji">{goal.emoji}</span> : null}
            {goal.title}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted">
            <span className="inline-flex items-center gap-1.5">
              <HorizonIcon size={14} aria-hidden="true" />
              {HORIZON_LABEL[goal.horizon]}
            </span>
            {dates ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{dates}</span>
              </>
            ) : null}
            {goal.status !== 'active' ? (
              <>
                <span aria-hidden="true">·</span>
                <span className={goal.status === 'done' ? 'text-success-strong' : 'text-danger-strong'}>{STATUS_LABEL[goal.status]}</span>
              </>
            ) : null}
          </p>
          {goal.description ? (
            <p className="mt-3 max-w-2xl text-body text-muted-strong whitespace-pre-wrap break-words">{goal.description}</p>
          ) : null}
        </div>
        <Button variant="secondary" size="sm" onClick={() => goalEditor.open(goal)} className="pointer-coarse:h-11">
          <Pencil size={14} aria-hidden="true" />
          Изменить
        </Button>
      </header>

      {/* Ряд цифр без подложки: ячейки разделены тонкими линиями. */}
      <dl className="mt-6 grid grid-cols-2 border-y border-border sm:grid-cols-4">
        <Stat ref={ring} label="Прогресс" className="pr-4">
          {pct}%
        </Stat>
        <Stat label="Часы за неделю" className="border-l pl-4">
          <Amount text={formatHours(hoursWeek)} />
        </Stat>
        <Stat label="Подцели" className="border-t pr-4 sm:border-l sm:border-t-0 sm:pl-4">
          {subs.length ? `${subsDone}/${subs.length}` : NONE}
        </Stat>
        <Stat label="Шаги" className="border-l border-t pl-4 sm:border-t-0">
          {steps.length ? `${stepsDone}/${steps.length}` : NONE}
        </Stat>
      </dl>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_288px]">
        <div className="min-w-0 space-y-8">
          <section aria-label="Шаги">
            <CardHeader
              title="Шаги"
              icon={<ListChecks size={16} />}
              action={
                <Button variant="ghost" size="sm" onClick={() => taskEditor.open(null, { goalId: goal.id, area: 'work' })}>
                  <Plus size={14} aria-hidden="true" />
                  Шаг
                </Button>
              }
            />
            <div className="mt-2">
              <StepComposer goal={goal} />
            </div>
            {steps.length ? (
              <ul className="stagger mt-3 space-y-2">
                {steps.map(t => (
                  <li key={t.id}>
                    <TaskCard task={t} goals={[]} onOpen={task => taskEditor.open(task)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-small text-muted">Каждый шаг — задача, привязанная к цели. Напиши первый и нажми Enter.</p>
            )}
          </section>

          <section aria-label="Подцели">
            <CardHeader
              title="Подцели"
              icon={<Network size={16} />}
              action={
                <Button variant="ghost" size="sm" onClick={addSub}>
                  <Plus size={14} aria-hidden="true" />
                  Подцель
                </Button>
              }
            />
            {subs.length ? (
              <ul className="stagger mt-2 border-t border-border">
                {subs.map(s => (
                  <SubGoalRow key={s.id} goal={s} goals={goals} tasks={tasks} />
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-small text-muted">Большую цель проще достигать через цели покороче.</p>
            )}
            <div className="mt-3">
              {composing || !subs.length ? (
                <SubgoalComposer goal={goal} onDone={() => setComposing(false)} />
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setComposing(true)} className="-ml-3">
                  <Network size={14} aria-hidden="true" />
                  Разбить на подцели
                </Button>
              )}
            </div>
          </section>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-6">
          <Card className="p-4">
            {goal.horizon === 'week' ? (
              <Switch
                checked={isWeekGoal}
                onChange={() => toggleWeekGoal()}
                label="Цель недели"
                description="Видна на «Сегодня»"
                className="mb-3 border-b border-border pb-3"
              />
            ) : null}
            <dl>
              <Fact label="Горизонт">{HORIZON_LABEL[goal.horizon]}</Fact>
              <Fact label="Срок">{dates ?? <span className="text-muted">не задан</span>}</Fact>
            </dl>

            <div className="mt-3 space-y-3">
              <Select label="Статус" value={goal.status} onChange={e => setStatus(e.target.value as GoalStatus)}>
                {(['active', 'done', 'dropped'] as GoalStatus[]).map(s => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>

              {dream ? (
                <Link
                  to="/dreams"
                  className={`-mx-2 flex items-center gap-3 rounded-control px-2 py-1.5 hover:bg-fill ${FOCUS}`}
                >
                  <span aria-hidden="true" className="inline-flex size-4 shrink-0 items-center justify-center">
                    {dream.emoji ? (
                      <span className="font-emoji text-base leading-none">{dream.emoji}</span>
                    ) : (
                      <SectionIcon k="dreams" size={16} className="text-muted" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-caption text-muted">Мечта</span>
                    <span className="block truncate text-body text-text">{dream.title}</span>
                  </span>
                  <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-muted" />
                </Link>
              ) : null}
            </div>

            <div className="mt-3 border-t border-border pt-3">
              <Button variant="danger-quiet" size="sm" className="-ml-3" onClick={() => void onDelete()}>
                <Trash2 size={14} aria-hidden="true" />
                Удалить цель
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      {goalEditor.editor}
      {taskEditor.editor}
    </div>
  );
}
