import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Circle, CircleCheck, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { burst } from '@/components/ui/Burst';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useToast } from '@/components/ui/Toast';
import { useCollection, useProfile } from '@/data/hooks';
import { todayISO } from '@/lib/dates';
import { useTaskEditor } from '@/features/tasks/TaskEditor';
import { checklistSteps, checklistView } from './logic';
import type { ChecklistStep, StepKey } from './logic';

/** Отметки этого устройства: видел ли человек чек-лист незаконченным и когда всё сделал. */
const SEEN_KEY = 'ikigai.checklist.seenIncomplete';
const DONE_KEY = 'ikigai.checklist.doneAt';

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLS(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* приватный режим — просто не запомним */
  }
}

const COPY: Record<StepKey, { title: string; hint: (s: ChecklistStep) => string }> = {
  dreams: {
    title: 'Запиши три мечты',
    hint: s => (s.done ? 'Список мечт начат' : `Сейчас ${s.have ?? 0} из ${s.need ?? 3} — большие и маленькие`),
  },
  goal: { title: 'Поставь цель', hint: () => 'Мечта со сроком — например, на год' },
  week: { title: 'Выбери цель недели', hint: () => 'Она всю неделю будет на «Сегодня»' },
  timed: { title: 'Запланируй задачу со временем', hint: () => 'Шаг, у которого есть час в расписании' },
  telegram: { title: 'Подключи Telegram', hint: () => 'Быстрые записи и утренняя сводка' },
};

/** Ближайшие полчаса — время по умолчанию для первой задачи со временем. */
function nextHalfHour(now = new Date()): string {
  const m = now.getHours() * 60 + now.getMinutes();
  const next = Math.min(23 * 60 + 30, Math.ceil((m + 1) / 30) * 30);
  return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`;
}

/**
 * «Первые шаги» на «Сегодня»: пять шагов, которые отмечаются сами по данным
 * (три мечты → цель → цель недели → задача со временем → Telegram). «Сделать» ведёт туда,
 * где шаг делается. Всё сделано — праздник и сутки поздравления, потом карточка уходит.
 */
export function OnboardingChecklist() {
  const profiles = useCollection('profiles');
  const [profile, updateProfile] = useProfile();
  const dreams = useCollection('dreams');
  const goals = useCollection('goals');
  const tasks = useCollection('tasks');
  const navigate = useNavigate();
  const toast = useToast();
  const taskEditor = useTaskEditor();
  const ring = useRef<HTMLSpanElement>(null);
  const [now] = useState(() => Date.now());
  const [doneAt, setDoneAt] = useState<number | null>(() => {
    const v = Number(readLS(DONE_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  });
  const [seenIncomplete, setSeenIncomplete] = useState(() => readLS(SEEN_KEY) === '1');

  const loaded = profiles.length > 0;
  const steps = useMemo(() => checklistSteps({ profile, dreams, goals, tasks }), [profile, dreams, goals, tasks]);
  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;
  const view = loaded
    ? checklistView({ dismissed: !!profile.checklistDismissed, allDone, seenIncomplete, doneAt, now })
    : 'hidden';

  // «Видел незаконченным» — только если карточка простояла на экране: иначе первые миллисекунды,
  // пока данные ещё грузятся, приняли бы давнего пользователя за новичка.
  useEffect(() => {
    if (view !== 'progress' || seenIncomplete) return;
    const t = window.setTimeout(() => {
      writeLS(SEEN_KEY, '1');
      setSeenIncomplete(true);
    }, 1500);
    return () => window.clearTimeout(t);
  }, [view, seenIncomplete]);

  // Последний шаг сделан — праздник один раз, отметка времени — для суток поздравления.
  useEffect(() => {
    if (view !== 'celebrate' || doneAt !== null) return;
    const at = Date.now();
    writeLS(DONE_KEY, String(at));
    const t = window.setTimeout(() => {
      setDoneAt(at);
      if (ring.current) burst(ring.current, { count: 56, power: 8 });
    }, 80);
    return () => window.clearTimeout(t);
  }, [view, doneAt]);

  if (view === 'hidden') return taskEditor.editor;

  const dismiss = () => {
    void updateProfile({ checklistDismissed: true });
    toast('Первые шаги скрыты');
  };

  const act = (key: StepKey) => {
    if (key === 'dreams') navigate('/dreams?new=1');
    else if (key === 'goal') navigate('/goals?new=year');
    else if (key === 'week') {
      const week = goals.find(g => g.horizon === 'week' && g.status === 'active');
      navigate(week ? `/goals/${week.id}` : '/goals?tab=week&new=week');
    } else if (key === 'timed') {
      taskEditor.open(null, { date: todayISO(), plannedStart: nextHalfHour(), plannedMinutes: 30 });
    } else navigate('/settings#settings-telegram');
  };

  const hide = (
    <IconButton size="sm" aria-label="Скрыть первые шаги" title="Скрыть" onClick={dismiss}>
      <X size={16} />
    </IconButton>
  );

  if (view === 'celebrate') {
    return (
      <Card as="section" aria-label="Первые шаги" className="animate-in p-5">
        <div className="flex items-start gap-3">
          <span ref={ring} className="mt-0.5 inline-flex shrink-0 text-accent-strong">
            <CircleCheck size={16} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-title font-semibold text-text">Ты настроил Ikigai</h2>
            <p className="mt-0.5 text-small text-muted">Мечты, цели и день связаны. Эта карточка уйдёт сама завтра.</p>
          </div>
          {hide}
        </div>
      </Card>
    );
  }

  return (
    <Card as="section" aria-labelledby="onboarding-checklist-title" className="p-5">
      <div className="flex min-h-8 items-center gap-2">
        <h2 id="onboarding-checklist-title" className="min-w-0 flex-1 truncate text-title font-semibold text-text">
          Первые шаги{' '}
          <span className="ml-1 font-mono text-small font-normal tabular-nums text-muted">
            {doneCount}/{steps.length}
          </span>
        </h2>
        <Button variant="ghost" size="sm" onClick={dismiss} className="-mr-2 shrink-0">
          Скрыть
        </Button>
      </div>
      <span ref={ring} className="block">
        <ProgressBar value={doneCount / steps.length} size="sm" label="Первые шаги" className="mt-2" />
      </span>

      <ol className="mt-3">
        {steps.map(s => {
          const c = COPY[s.key];
          return (
            <li key={s.key} className="flex min-h-9 items-center gap-3 py-1">
              {s.done ? (
                <CircleCheck size={16} aria-hidden="true" className="shrink-0 text-accent-strong" />
              ) : (
                <Circle size={16} aria-hidden="true" className="mt-0.5 shrink-0 self-start text-muted" />
              )}
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-body ${s.done ? 'text-muted' : 'text-text'}`}>
                  {c.title}
                  <span className="sr-only">{s.done ? ' — сделано' : ''}</span>
                </span>
                {s.done ? null : <span className="block truncate text-small text-muted">{c.hint(s)}</span>}
              </span>
              {s.done ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => act(s.key)}
                  className="-mr-2 shrink-0 pointer-coarse:h-11"
                  aria-label={`Сделать: ${c.title}`}
                >
                  Сделать
                </Button>
              )}
            </li>
          );
        })}
      </ol>
      {taskEditor.editor}
    </Card>
  );
}
