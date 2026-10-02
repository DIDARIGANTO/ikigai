import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CircleCheck } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { burst } from '@/components/ui/Burst';
import { Chip } from '@/components/ui/Chip';
import { EmojiPickerButton } from '@/components/ui/EmojiPicker';
import { FIELD, LABEL } from '@/components/ui/Input';
import { Wordmark } from '@/components/ui/LogoMark';
import { Segmented } from '@/components/ui/Segmented';
import { getStore } from '@/data';
import { removeDemoData } from '@/features/settings/dataOps';
import { addDaysISO, todayISO } from '@/lib/dates';
import type { Dream } from '@/lib/types';
import { DEFAULT_STEP, DREAM_SUGGESTIONS, WEEK_GOAL_TITLE, createFirstPath, patchProfile, saveDream } from './firstPath';
import { PathPreview } from './PathPreview';
import type { PathNode } from './PathPreview';

type Step = 0 | 1 | 2 | 3;
type Start = 'scratch' | 'demo';
type When = 'today' | 'tomorrow';

const STEPS = 4;

/** Поле знакомства: 40 px — главное поле формы. */
const BIG_FIELD = `${FIELD} h-10`;

/** Выбор «с нуля / с демо»: две карточки с линией и радиокнопкой, радиогруппа со стрелками. */
function StartChoice({ value, onChange }: { value: Start; onChange: (v: Start) => void }) {
  const labelId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const options: { v: Start; title: string; text: string }[] = [
    { v: 'scratch', title: 'С чистого листа', text: 'Только твои мечты и цели. Доски и список «Купить» останутся.' },
    { v: 'demo', title: 'С примерами', text: 'Пара демо-целей и задач, чтобы осмотреться. Убрать можно в настройках.' },
  ];
  const onKey = (e: KeyboardEvent, i: number) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const next = (i + 1) % options.length;
    refs.current[next]?.focus();
    onChange(options[next].v);
  };
  return (
    <div>
      <h2 id={labelId} className={LABEL}>
        С демо или с нуля?
      </h2>
      <div role="radiogroup" aria-labelledby={labelId} className="grid gap-3 sm:grid-cols-2">
        {options.map((o, i) => {
          const on = value === o.v;
          return (
            <button
              key={o.v}
              ref={el => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(o.v)}
              onKeyDown={e => onKey(e, i)}
              className={`focus-ring flex items-start gap-3 rounded-card border p-4 text-left transition-colors duration-(--duration-base) ease-out-soft ${
                on ? 'border-accent bg-fill' : 'border-border bg-surface hover:border-border-strong'
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border ${
                  on ? 'border-accent bg-accent' : 'border-control-border'
                }`}
              >
                {on ? <span className="size-1.5 rounded-full bg-on-accent" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-body font-medium text-text">{o.title}</span>
                <span className="mt-1 block text-small text-muted">{o.text}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Номер шага — простая строка моноширинными цифрами, а не точки. */
function StepCount({ step }: { step: Step }) {
  return (
    <p className="mb-3 font-mono text-small tabular-nums text-muted">
      Шаг {step + 1} из {STEPS}
    </p>
  );
}

/** Заголовок шага 24 px. В фокусе после смены шага — для скринридера. */
function StepTitle({ children, sub, icon }: { children: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        {icon}
        <h1 tabIndex={-1} className="min-w-0 text-h1 font-semibold text-text focus:outline-none">
          {children}
        </h1>
      </div>
      {sub ? <p className="mt-2 text-body text-muted">{sub}</p> : null}
    </div>
  );
}

function whenLabel(when: When, time: string, minutes: number): string {
  return `${when === 'today' ? 'Сегодня' : 'Завтра'}${time ? `, ${time}` : ''} · ${minutes} мин`;
}

/**
 * Знакомство в четыре шага: имя и старт → мечта → цель и первый шаг → праздник.
 * Каждый шаг можно пропустить; всё, что уже создано, остаётся. `onDone(openToday)` закрывает
 * знакомство и ставит `onboarded` (это делает родитель).
 */
export function WelcomeFlow({
  hasDemo,
  initialName = '',
  onDone,
}: {
  /** Есть ли демо-данные, от которых можно отказаться. */
  hasDemo: boolean;
  initialName?: string;
  onDone: (openToday: boolean) => void;
}) {
  const [step, setStep] = useState<Step>(0);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(initialName);
  const [start, setStart] = useState<Start>('scratch');
  const [dreamTitle, setDreamTitle] = useState('');
  const [emoji, setEmoji] = useState<string | undefined>();
  const [category, setCategory] = useState<string | undefined>();
  const [stepTitle, setStepTitle] = useState(DEFAULT_STEP);
  const [goalTitle, setGoalTitle] = useState('');
  const [when, setWhen] = useState<When>('tomorrow');
  const [time, setTime] = useState('09:00');
  const [minutes, setMinutes] = useState(30);
  const [dream, setDream] = useState<Dream | null>(null);
  const [created, setCreated] = useState(false);
  const demoHandled = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const celebrate = useRef<HTMLSpanElement>(null);
  const ids = { name: useId(), dream: useId(), goal: useId(), step: useId(), time: useId(), when: useId(), minutes: useId() };

  // Новый шаг — фокус на его заголовок или первое поле: клавиатура продолжает с начала шага.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const field = el.querySelector<HTMLElement>('[data-autofocus]');
    (field ?? el.querySelector<HTMLElement>('h1'))?.focus({ preventScroll: true });
    el.closest('[role="dialog"]')?.scrollTo?.({ top: 0 });
  }, [step]);

  // Праздник на последнем шаге.
  useEffect(() => {
    if (step !== 3 || !celebrate.current) return;
    const t = window.setTimeout(() => celebrate.current && burst(celebrate.current, { count: 64, power: 9 }), 120);
    return () => window.clearTimeout(t);
  }, [step]);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const submitName = (e?: FormEvent) =>
    void run(async () => {
      e?.preventDefault();
      const store = getStore();
      if (hasDemo && start === 'scratch' && !demoHandled.current) {
        demoHandled.current = true;
        await removeDemoData(store);
      }
      const trimmed = name.trim();
      await patchProfile(store, trimmed ? { name: trimmed } : {});
      setStep(1);
    });

  const submitDream = (e?: FormEvent) =>
    void run(async () => {
      e?.preventDefault();
      const title = dreamTitle.trim();
      if (!title) return;
      const saved = await saveDream(getStore(), dream?.id, { title, emoji, category });
      setDream(saved);
      if (!goalTitle || goalTitle === dream?.title) setGoalTitle(saved.title);
      setStep(2);
    });

  const submitGoal = (e?: FormEvent) =>
    void run(async () => {
      e?.preventDefault();
      if (!dream || created) {
        setStep(3);
        return;
      }
      const today = todayISO();
      await createFirstPath(getStore(), {
        dream,
        goalTitle,
        taskTitle: stepTitle,
        date: when === 'today' ? today : addDaysISO(today, 1),
        time,
        minutes,
      });
      setCreated(true);
      setStep(3);
    });

  const pickSuggestion = (s: (typeof DREAM_SUGGESTIONS)[number]) => {
    setDreamTitle(s.title);
    setEmoji(s.emoji);
    setCategory(s.category);
    setStepTitle(s.step);
  };

  // Мечта сохранена после шага 1, цель с неделей и задачей — после шага 2.
  const goalStatus = step === 3 && created ? 'done' : step === 2 ? 'current' : 'todo';
  const nodes: PathNode[] = [
    {
      key: 'dream',
      kind: 'Мечта',
      value: step >= 1 ? dreamTitle.trim() || undefined : undefined,
      emoji,
      status: step >= 2 ? 'done' : step === 1 ? 'current' : 'todo',
    },
    { key: 'goal', kind: 'Цель на год', value: step >= 2 ? goalTitle.trim() || undefined : undefined, emoji, status: goalStatus },
    { key: 'week', kind: 'Цель недели', value: step >= 2 ? WEEK_GOAL_TITLE : undefined, status: goalStatus },
    {
      key: 'task',
      kind: 'Первая задача',
      value: step >= 2 ? stepTitle.trim() || undefined : undefined,
      meta: whenLabel(when, time, minutes),
      status: goalStatus,
    },
  ];

  const greetingName = name.trim();
  const back = (to: Step, disabled = false) => (
    <IconButton variant="ghost" size="lg" onClick={() => setStep(to)} aria-label="Назад" disabled={disabled}>
      <ArrowLeft size={16} aria-hidden="true" />
    </IconButton>
  );

  return (
    <div ref={root} className="flex min-h-dvh">
      {/* Слева — цепочка, которая собирается по ходу ответов. */}
      <aside
        aria-label="Что получится"
        className="hidden w-88 shrink-0 flex-col border-r border-border bg-panel p-8 md:flex lg:w-104 lg:p-10"
      >
        <Wordmark size={24} />
        <div className="my-auto py-10">
          <p className="text-body font-semibold text-text">Твой путь</p>
          <p className="mb-6 mt-1 max-w-xs text-small text-muted">
            Мечта становится ближе, когда у неё есть цель, неделя и шаг со временем.
          </p>
          <PathPreview nodes={nodes} />
        </div>
      </aside>

      <section
        aria-label="Знакомство"
        className="flex min-w-0 flex-1 flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-8 md:py-8 lg:py-10"
      >
        {/* На широком экране строка вровень со знаком слева (та же высота и отступ сверху). */}
        <div className="flex h-11 items-center justify-between gap-3 md:h-6">
          <span className="md:hidden">
            <Wordmark size={24} />
          </span>
          <span aria-hidden="true" className="max-md:hidden" />
          {step < 3 ? (
            <Button variant="ghost" size="sm" onClick={() => onDone(false)} className="pointer-coarse:h-11">
              Пропустить
            </Button>
          ) : null}
        </div>

        <div key={step} className="animate-in mx-auto w-full max-w-120 py-6 md:my-auto md:py-12">
          <StepCount step={step} />
          {step === 0 ? (
            <form onSubmit={submitName} className="space-y-6">
              <StepTitle sub="Мечты, цели и твой день — в одном месте. Настройка займёт минуту.">Как тебя зовут?</StepTitle>
              <div>
                <label htmlFor={ids.name} className="sr-only">
                  Имя
                </label>
                <input
                  id={ids.name}
                  data-autofocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Имя"
                  autoComplete="given-name"
                  maxLength={40}
                  className={BIG_FIELD}
                />
              </div>
              {hasDemo ? <StartChoice value={start} onChange={setStart} /> : null}
              <Button type="submit" variant="primary" size="lg" disabled={busy} className="w-full sm:w-auto">
                Дальше
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </form>
          ) : null}

          {step === 1 ? (
            <form onSubmit={submitDream} className="space-y-6">
              <StepTitle sub="Одна мечта для начала — большая или совсем простая. Остальные можно добавить потом.">
                {greetingName ? `${greetingName}, о чём ты мечтаешь?` : 'О чём ты мечтаешь?'}
              </StepTitle>
              <div>
                <label htmlFor={ids.dream} className={LABEL}>
                  Мечта
                </label>
                <div className="flex items-center gap-2">
                  <EmojiPickerButton value={emoji} onChange={setEmoji} size={40} label="Эмодзи мечты" />
                  <input
                    id={ids.dream}
                    data-autofocus
                    value={dreamTitle}
                    onChange={e => setDreamTitle(e.target.value)}
                    placeholder="Например, увидеть северное сияние"
                    maxLength={120}
                    className={BIG_FIELD}
                  />
                </div>
                <div role="group" aria-label="Подсказки" className="mt-3 flex flex-wrap gap-2">
                  {DREAM_SUGGESTIONS.map(s => (
                    <Chip key={s.title} onClick={() => pickSuggestion(s)} selected={dreamTitle === s.title}>
                      {s.title}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {back(0)}
                <Button type="submit" variant="primary" size="lg" disabled={busy || !dreamTitle.trim()} className="flex-1 sm:flex-none">
                  Дальше
                  <ArrowRight size={16} aria-hidden="true" />
                </Button>
              </div>
            </form>
          ) : null}

          {step === 2 ? (
            <form onSubmit={submitGoal} className="space-y-6">
              <StepTitle sub="У цели есть срок, у недели — фокус, у дня — шаг со временем. Цель недели появится на «Сегодня».">
                Превратим в цель
              </StepTitle>
              <div>
                <label htmlFor={ids.goal} className={LABEL}>
                  Цель на год
                </label>
                <input
                  id={ids.goal}
                  data-autofocus
                  value={goalTitle}
                  onChange={e => setGoalTitle(e.target.value)}
                  maxLength={120}
                  className={BIG_FIELD}
                />
              </div>
              <div>
                <label htmlFor={ids.step} className={LABEL}>
                  Первая задача
                </label>
                <input
                  id={ids.step}
                  value={stepTitle}
                  onChange={e => setStepTitle(e.target.value)}
                  maxLength={120}
                  className={BIG_FIELD}
                />
                <p className="mt-1.5 text-small text-muted">Войдёт в цель недели «{WEEK_GOAL_TITLE}».</p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-3">
                <div>
                  <p id={ids.when} className={LABEL}>
                    День
                  </p>
                  <Segmented<When>
                    labelledBy={ids.when}
                    value={when}
                    onChange={setWhen}
                    options={[
                      { value: 'today', label: 'Сегодня' },
                      { value: 'tomorrow', label: 'Завтра' },
                    ]}
                  />
                </div>
                <div className="w-32 shrink-0">
                  <label htmlFor={ids.time} className={LABEL}>
                    Время
                  </label>
                  <input
                    id={ids.time}
                    type="time"
                    lang="ru"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className={`${FIELD} h-8 tabular-nums`}
                  />
                </div>
                <div>
                  <p id={ids.minutes} className={LABEL}>
                    Длительность
                  </p>
                  <Segmented<string>
                    labelledBy={ids.minutes}
                    value={String(minutes)}
                    onChange={v => setMinutes(Number(v))}
                    options={[15, 30, 60].map(m => ({ value: String(m), label: `${m} мин` }))}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {back(1, created)}
                <Button type="submit" variant="primary" size="lg" disabled={busy || !goalTitle.trim()} className="flex-1 sm:flex-none">
                  Создать цель
                  <ArrowRight size={16} aria-hidden="true" />
                </Button>
              </div>
            </form>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
              <StepTitle
                icon={
                  <span ref={celebrate} className="inline-flex shrink-0 text-accent-strong">
                    <CircleCheck size={24} aria-hidden="true" />
                  </span>
                }
                sub={
                  created
                    ? `Созданы мечта, цель на год, цель недели и первая задача на ${whenLabel(when, time, minutes).toLowerCase()}.`
                    : 'Всё на месте. Дальше — твой день.'
                }
              >
                {greetingName ? `Готово, ${greetingName}` : 'Готово'}
              </StepTitle>
              <PathPreview nodes={nodes} className="md:hidden" />
              <Button variant="primary" size="lg" onClick={() => onDone(true)} className="w-full sm:w-auto">
                Вот твой день
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
