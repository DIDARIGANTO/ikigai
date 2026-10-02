import type { ReactNode } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { useCollection, useProfile } from '@/data/hooks';
import { toDateISO } from '@/lib/dates';
import { carriedOverTasks, sortByPlannedStart, tasksForDate } from '@/lib/domain/tasks';
import { goalProgress } from '@/lib/domain/goals';
import { daySummary, isInbox, northStarChain, upcomingReminders } from '@/lib/domain/day';
import { useTaskEditor } from '@/features/tasks/TaskEditor';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import { OnboardingChecklist } from '@/features/onboarding/OnboardingChecklist';
import { DaySummaryCard, shouldShowSummary } from './DaySummaryCard';
import { DayTasksCard } from './DayTasksCard';
import { NorthStar } from './NorthStar';
import { NowCard } from './NowCard';
import { QuickAddBar } from './QuickAddBar';
import { InboxCard, RemindersCard, WeekGoalCard } from './RailCards';
import { SkyHeader } from './SkyHeader';
import { TailsCard } from './TailsCard';
import { Timeline } from './Timeline';
import { useMinuteTick } from './useMinuteTick';
import { useDayCelebration } from './useDayCelebration';

/** Дата, час и минута дня из отметки времени — одним разом, без изменяемого `Date` в компоненте. */
function clock(ms: number) {
  const d = new Date(ms);
  return { today: toDateISO(d), hour: d.getHours(), nowMin: d.getHours() * 60 + d.getMinutes() };
}

export function TodayPage() {
  const { tasks, goals } = useTaskActionsCtx();
  const reminders = useCollection('reminders');
  const dreams = useCollection('dreams');
  const logs = useCollection('dailyLogs');
  const [profile] = useProfile();
  const { open, editor } = useTaskEditor();
  // Минутный тик: страница, оставленная открытой, сама переходит на новый день и меняет приветствие.
  const now = useMinuteTick();
  const { today, hour, nowMin } = clock(now);

  const dayTasks = sortByPlannedStart(tasksForDate(tasks, today));
  const carried = sortByPlannedStart(carriedOverTasks(tasks, today));
  const anytime = dayTasks.filter(t => !t.plannedStart);
  const timedCount = dayTasks.filter(t => t.plannedStart).length;
  const inboxCount = tasks.filter(isInbox).length;
  const upcoming = upcomingReminders(reminders, today);
  const summary = daySummary(tasks, today, now);
  const chain = northStarChain(goals, dreams, profile.weekGoalId, tasks, today);
  const weekGoal = chain.goals[chain.goals.length - 1];
  const weekProgress = weekGoal ? goalProgress(weekGoal, goals, tasks) : 0;
  useDayCelebration(dayTasks, today);

  const log = logs.find(l => l.id === today);
  const showSummary = shouldShowSummary(hour, dayTasks, log);

  const addForToday = () => open(null, { date: today });

  // Левая колонка на широком экране. На телефоне — одна колонка в порядке:
  // сейчас → быстрая запись → незавершённое → расписание → правая колонка → итог дня.
  const left: { key: string; node: ReactNode }[] = [
    { key: 'now', node: <NowCard tasks={tasks} dayTasks={dayTasks} nowMin={nowMin} date={today} onOpen={t => open(t)} onAdd={addForToday} /> },
    { key: 'quick', node: <QuickAddBar date={today} /> },
    { key: 'tails', node: carried.length ? <TailsCard tasks={carried} today={today} /> : null },
    {
      key: 'schedule',
      node: (
        <Card className="p-5" aria-label="Расписание">
          <CardHeader
            title="Расписание"
            icon={<CalendarClock size={16} />}
            meta={timedCount ? <span className="font-mono text-small">{timedCount}</span> : undefined}
            action={
              <Button variant="ghost" size="sm" onClick={addForToday}>
                <Plus size={16} aria-hidden="true" />
                Задача
              </Button>
            }
          />
          <Timeline date={today} embedded className="mt-3 -mx-2" onOpenTask={t => open(t)} onCreate={d => open(null, d)} />
        </Card>
      ),
    },
  ].filter(x => x.node);
  const rows = left.length + (showSummary ? 1 : 0);

  const rail = (
    <div className="stagger min-w-0 space-y-4 xl:col-start-2 xl:row-start-1" style={{ gridRowEnd: `span ${rows}` }}>
      <OnboardingChecklist />
      {weekGoal ? (
        <WeekGoalCard goal={weekGoal} progress={weekProgress} nextStep={chain.nextStep} onOpenTask={t => open(t)} />
      ) : null}
      <DayTasksCard tasks={anytime} date={today} nowMin={nowMin} onOpen={t => open(t)} onAdd={addForToday} />
      <RemindersCard items={upcoming} />
      <InboxCard count={inboxCount} />
    </div>
  );

  return (
    // relative — опора для скрытых подписей (sr-only): иначе их отсчитывает body, и низ страницы
    // растягивает документ, а вместе с ним уезжает боковое меню.
    <div className="relative mx-auto max-w-[1120px]">
      <SkyHeader now={now} name={profile.name} summary={summary}>
        <NorthStar chain={chain} onOpenTask={t => open(t)} />
      </SkyHeader>

      <div
        className="mt-6 flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start"
        style={{ gridTemplateRows: `repeat(${rows - 1}, auto) 1fr` }}
      >
        {left.map(x => (
          <div key={x.key} className="animate-in min-w-0 xl:col-start-1">
            {x.node}
          </div>
        ))}
        {rail}
        {showSummary ? (
          <div className="animate-in min-w-0 xl:col-start-1">
            <DaySummaryCard tasks={tasks} date={today} log={log} />
          </div>
        ) : null}
      </div>

      {editor}
    </div>
  );
}
