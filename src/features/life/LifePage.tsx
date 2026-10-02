import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CircleCheck, Clock, Flame, Mountain, Plus, Sparkles } from 'lucide-react';
import type { Dream, Goal, Task } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { Segmented } from '@/components/ui/Segmented';
import { useCollection, useProfile } from '@/data/hooks';
import { todayISO } from '@/lib/dates';
import { contribution, dreamGoals, dreamProgress, formatHours, goalHours, goalsByHours, previousWeekRange, weekRange } from '@/lib/domain/life';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import { categoryLook } from '@/features/dreams/categories';
import { pluralRu } from '@/features/goals/meta';
import { GoalGlyph, HorizonChip, goalTitleClass } from '@/features/goals/parts';
import { HorizonPath } from './HorizonPath';

type Week = 'this' | 'last';

/** «Сто мечт» — цель списка мечт. */
const DREAMS_TARGET = 100;
/** Сколько мечт и строк целей показывать на обзоре. */
const DREAMS_SHOWN = 12;
const GOALS_SHOWN = 8;

/** Ссылка «Все …» в шапке блока: тихая, со стрелкой. */
function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="focus-ring inline-flex h-8 items-center gap-1 rounded-sm text-small text-muted hover:text-text">
      {children}
      <ArrowRight size={14} aria-hidden="true" />
    </Link>
  );
}

/** «1,5 ч» → число и единица отдельно: число моноширинное, единица — обычным шрифтом. */
function splitAmount(text: string): { value: string; unit?: string } {
  const cut = text.lastIndexOf(' ');
  return cut < 0 ? { value: text } : { value: text.slice(0, cut), unit: text.slice(cut + 1) };
}

/** Колонка итогов: подпись-капитель, число моноширинное 28/34, пояснение. */
function Stat({ label, value, unit, caption }: { label: string; value: ReactNode; unit?: ReactNode; caption: string }) {
  return (
    <div className="min-w-0 p-4 sm:p-5">
      <p className="label-text text-muted">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-mono text-display font-medium tabular-nums text-text">{value}</span>
        {unit ? <span className="text-small text-muted">{unit}</span> : null}
      </p>
      <p className="mt-1 text-small text-muted">{caption}</p>
    </div>
  );
}

/** Мечта строкой: эмодзи или иконка категории, название, полоса 3 px и процент. */
function DreamRow({ dream, progress, onOpen }: { dream: Dream; progress: number; onOpen: () => void }) {
  const done = !!dream.doneAt;
  const Icon = categoryLook(dream.category).icon;
  const pct = Math.round(progress * 100);
  return (
    <li onClick={onOpen} className="group flex h-10 cursor-pointer items-center gap-3 border-b border-border px-2 hover:bg-fill">
      <span aria-hidden="true" className="inline-flex size-4 shrink-0 items-center justify-center">
        {dream.emoji ? <span className="font-emoji text-base leading-none">{dream.emoji}</span> : <Icon size={16} className="text-muted" />}
      </span>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          onOpen();
        }}
        aria-label={`Мечта «${dream.title}»: ${done ? 'исполнена' : `${pct}%`}`}
        className={`focus-ring min-w-0 flex-1 truncate rounded-sm text-left text-body ${done ? 'text-muted' : 'text-text'}`}
      >
        {dream.title}
      </button>
      {done ? (
        <span className="flex shrink-0 items-center gap-1.5 text-small text-muted">
          <CircleCheck size={14} aria-hidden="true" className="text-accent-strong" />
          Исполнена
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-3">
          <ProgressBar value={progress} className="hidden w-20 sm:block" />
          <span className="w-10 text-right font-mono text-small tabular-nums text-muted">{pct}%</span>
        </span>
      )}
    </li>
  );
}

/** Цель и часы — строка таблицы: значок, название, горизонт, полоса часов и часы моноширинными цифрами. */
function GoalHoursRow({ goal, hours, max }: { goal: Goal; hours: number; max: number }) {
  const navigate = useNavigate();
  const { value, unit } = splitAmount(formatHours(hours));
  return (
    <li
      onClick={() => navigate(`/goals/${goal.id}`)}
      className="group flex h-10 cursor-pointer items-center gap-3 border-b border-border px-2 hover:bg-fill"
    >
      <GoalGlyph goal={goal} />
      <Link
        to={`/goals/${goal.id}`}
        onClick={e => e.stopPropagation()}
        className={`focus-ring min-w-0 flex-1 truncate rounded-sm text-body ${goalTitleClass(goal)}`}
      >
        {goal.title}
      </Link>
      <HorizonChip horizon={goal.horizon} compact />
      <ProgressBar value={max > 0 ? hours / max : 0} label={`Часы на цель «${goal.title}»`} className="hidden w-24 sm:block" />
      <span className="w-16 shrink-0 text-right">
        <span className="font-mono text-small tabular-nums text-text">{value}</span>
        {unit ? <span className="ml-1 text-small text-muted">{unit}</span> : null}
      </span>
    </li>
  );
}

/** «Вклад сегодня»: строка с минутами за день и, если есть, сделанные шаги строками ниже. */
function Contribution({ tasks, goals, today }: { tasks: Task[]; goals: Goal[]; today: string }) {
  const { items, minutes } = useMemo(() => contribution(tasks, today), [tasks, today]);
  const byId = useMemo(() => new Map(goals.map(g => [g.id, g])), [goals]);
  return (
    <Card className="px-4 sm:px-5">
      <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 py-2">
        <Flame size={16} aria-hidden="true" className="shrink-0 text-muted" />
        <h2 className="text-body font-semibold text-text">Вклад сегодня</h2>
        {/* На телефоне пояснение уходит второй строкой, минуты остаются рядом с заголовком. */}
        <span className="min-w-0 text-small text-muted max-sm:order-last max-sm:basis-full max-sm:pl-7">
          {items.length
            ? `${items.length} ${pluralRu(items.length, ['шаг', 'шага', 'шагов'])} к целям`
            : 'Сделанные сегодня шаги к целям появятся здесь'}
        </span>
        <span className="ml-auto font-mono text-small tabular-nums text-text">
          {minutes}
          <span className="ml-1 font-sans text-muted">мин</span>
        </span>
      </div>
      {items.length ? (
        <ul className="-mx-4 border-t border-border sm:-mx-5">
          {items.map(({ task, minutes: m }) => {
            const goal = task.goalId ? byId.get(task.goalId) : undefined;
            return (
              <li key={task.id} className="flex h-10 items-center gap-3 border-b border-border px-4 last:border-b-0 sm:px-5">
                {task.emoji ? (
                  <span aria-hidden="true" className="inline-flex size-4 shrink-0 items-center justify-center font-emoji text-base leading-none">
                    {task.emoji}
                  </span>
                ) : (
                  <CircleCheck size={16} aria-hidden="true" className="shrink-0 text-accent-strong" />
                )}
                <span className="min-w-0 flex-1 truncate text-body text-text">{task.title}</span>
                <span className="min-w-0 max-w-48 truncate text-small text-muted max-sm:hidden">
                  {goal ? `${goal.emoji ? `${goal.emoji} ` : ''}${goal.title}` : 'Цель удалена'}
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-small tabular-nums text-text">
                  {m}
                  <span className="ml-1 font-sans text-muted">мин</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Card>
  );
}

/**
 * «Моя жизнь» — вся картина на одном экране: сколько мечт исполнено, какие цели живые и сколько
 * часов ушло на них за неделю, вклад сегодняшнего дня и тропа горизонтов от лет к неделе.
 */
export function LifePage() {
  const { goals, tasks } = useTaskActionsCtx();
  const dreams = useCollection('dreams');
  const [profile] = useProfile();
  const navigate = useNavigate();
  const [week, setWeek] = useState<Week>('this');

  const today = todayISO();
  const range = week === 'this' ? weekRange(today) : previousWeekRange(today);

  const doneDreams = dreams.filter(d => d.doneAt).length;
  const active = useMemo(() => goals.filter(g => g.status === 'active'), [goals]);
  const hoursTotal = useMemo(() => goalHours(tasks, range.start, range.end), [tasks, range.start, range.end]);
  const ranked = useMemo(() => goalsByHours(goals, tasks, range.start, range.end), [goals, tasks, range.start, range.end]);
  const maxHours = ranked.reduce((m, r) => Math.max(m, r.hours), 0);

  const rings = useMemo(() => {
    const withP = dreams.map(d => ({ dream: d, progress: dreamProgress(d, goals, tasks) }));
    // Сначала то, что в пути (по прогрессу), потом не начатое, исполненное — в конце.
    const rank = (x: { dream: Dream; progress: number }) => (x.dream.doneAt ? 2 : x.progress > 0 ? 0 : 1);
    return withP.sort(
      (a, b) =>
        rank(a) - rank(b) ||
        b.progress - a.progress ||
        a.dream.createdAt.localeCompare(b.dream.createdAt) ||
        a.dream.title.localeCompare(b.dream.title),
    );
  }, [dreams, goals, tasks]);

  const openDream = (d: Dream) => {
    const g = dreamGoals(d, goals)[0];
    navigate(g ? `/goals/${g.id}` : '/dreams');
  };

  const name = profile.name?.trim();
  const weekLabel = week === 'this' ? 'эту неделю' : 'прошлую неделю';

  const header = (
    <PageHeader
      title="Моя жизнь"
      icon={<SectionIcon k="life" size={20} />}
      description={name ? `${name}, вот мечты, цели и время, которое ты им отдаёшь` : 'Мечты, цели и время, которое ты им отдаёшь'}
      actions={
        <Segmented<Week>
          label="Неделя"
          value={week}
          onChange={setWeek}
          options={[
            { value: 'this', label: 'Эта неделя' },
            { value: 'last', label: 'Прошлая' },
          ]}
        />
      }
    />
  );

  if (!dreams.length && !goals.length) {
    return (
      <div className="mx-auto max-w-[1120px]">
        <PageHeader title="Моя жизнь" icon={<SectionIcon k="life" size={20} />} description="Мечты, цели и время, которое ты им отдаёшь" />
        <Card className="mt-6">
          <EmptyState
            k="life"
            title="Здесь пока пусто"
            description="Начни с мечты — потом её можно превратить в цель и первый шаг."
            action={
              <Button variant="primary" onClick={() => navigate('/dreams?new=1')}>
                <Sparkles size={16} aria-hidden="true" />
                Записать мечту
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const hours = splitAmount(formatHours(hoursTotal));

  return (
    <div className="mx-auto max-w-[1120px]">
      {header}

      {/* Итоги — одна карточка в три колонки, разделённые тонкими линиями. */}
      <Card as="section" aria-label="Итоги" className="mt-6 grid grid-cols-3 divide-x divide-border">
        <Stat label="Мечты" value={doneDreams} unit={`из ${DREAMS_TARGET}`} caption="исполнено" />
        <Stat
          label="Цели"
          value={active.length}
          caption={pluralRu(active.length, ['активная', 'активные', 'активных'])}
        />
        <Stat label="Часы на цели" value={hours.value} unit={hours.unit} caption={`за ${weekLabel}`} />
      </Card>

      <div className="mt-6">
        <Contribution tasks={tasks} goals={goals} today={today} />
      </div>

      <Card className="mt-6 p-4 sm:p-5">
        <CardHeader
          title="Мечты"
          icon={<Sparkles size={16} />}
          meta={dreams.length ? `${dreams.length}` : undefined}
          action={<MoreLink to="/dreams">Все мечты</MoreLink>}
        />
        {rings.length ? (
          <ul className="mt-2 grid border-t border-border lg:grid-cols-2 lg:gap-x-8">
            {rings.slice(0, DREAMS_SHOWN).map(r => (
              <DreamRow key={r.dream.id} dream={r.dream} progress={r.progress} onOpen={() => openDream(r.dream)} />
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            k="dreams"
            title="Мечт пока нет"
            description="Запиши первую — прогресс появится, когда у неё будет цель."
            action={
              <Button variant="secondary" onClick={() => navigate('/dreams?new=1')}>
                <Plus size={16} aria-hidden="true" />
                Записать мечту
              </Button>
            }
          />
        )}
      </Card>

      <Card className="mt-6 p-4 sm:p-5">
        <CardHeader
          title="Цели и часы"
          icon={<Clock size={16} />}
          meta={week === 'this' ? 'эта неделя' : 'прошлая неделя'}
          action={<MoreLink to="/goals">Все цели</MoreLink>}
        />
        {ranked.length ? (
          <ul className="mt-2 border-t border-border">
            {ranked.slice(0, GOALS_SHOWN).map(r => (
              <GoalHoursRow key={r.goal.id} goal={r.goal} hours={r.hours} max={maxHours} />
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            k="goals"
            title="Активных целей нет"
            description="Мечта становится целью, когда у неё есть срок. Выбери мечту и нажми «Сделать целью»."
            action={
              <Button variant="secondary" onClick={() => navigate('/dreams')}>
                К мечтам
              </Button>
            }
          />
        )}
        {ranked.length && maxHours === 0 ? (
          <p className="mt-3 text-small text-muted">Часы появятся, когда запустишь таймер у задачи с целью и отметишь её сделанной.</p>
        ) : null}
      </Card>

      <Card className="mt-6 p-4 sm:p-5">
        <CardHeader title="Горизонты" icon={<Mountain size={16} />} meta="от лет к неделе" />
        <div className="mt-2 border-t border-border">
          <HorizonPath goals={goals} weekGoalId={profile.weekGoalId} />
        </div>
      </Card>
    </div>
  );
}
