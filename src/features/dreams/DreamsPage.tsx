import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { Dream } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Switch } from '@/components/ui/Switch';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { useCollection, useRepo } from '@/data/hooks';
import { newId, nowISO } from '@/lib/ids';
import { todayISO } from '@/lib/dates';
import { DreamCard } from './DreamCard';
import { DreamEditor } from './DreamEditor';
import { categoryLook } from './categories';
import { dreamProgress } from '@/lib/domain/life';
import type { Tone } from '@/components/ui/tones';

/** Сколько мечт в списке «сто мечт» — цель раздела. */
const TARGET = 100;

/** Значение «все категории»: с нулевым символом — не совпадёт ни с одной настоящей категорией. */
const ALL = '\u0000все';


/** Фильтр по категории: нейтральный чип с точкой цвета и счётчиком. */
function FilterChip({
  active,
  label,
  count,
  tone,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  tone?: Tone;
  onClick: () => void;
}) {
  return (
    <Chip selected={active} onClick={onClick} tone={tone}>
      {label}
      <span className={`font-mono tabular-nums ${active ? 'text-muted-strong' : 'text-muted'}`}>{count}</span>
    </Chip>
  );
}

export function DreamsPage() {
  const dreams = useCollection('dreams');
  const goals = useCollection('goals');
  const tasks = useCollection('tasks');
  const { put, remove } = useRepo();
  const navigate = useNavigate();
  const toast = useToast();

  const [category, setCategory] = useState(ALL);
  const [hideDone, setHideDone] = useState(false);
  // null — редактор закрыт, { dream: null } — создание новой мечты.
  const [params, setParams] = useSearchParams();
  // `?new=1` — «Записать мечту» снаружи (чек-лист «Первые шаги», «Моя жизнь»): редактор открыт сразу.
  const [editing, setEditing] = useState<{ dream: Dream | null } | null>(() => (params.has('new') ? { dream: null } : null));

  useEffect(() => {
    if (!params.has('new')) return;
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
  }, [params, setParams]);

  const sorted = useMemo(
    () => [...dreams].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.title.localeCompare(b.title)),
    [dreams],
  );
  const categories = useMemo(
    () => [...new Set(sorted.map(d => d.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)),
    [sorted],
  );
  const visible = useMemo(
    () => sorted.filter(d => (category === ALL || d.category === category) && !(hideDone && d.doneAt)),
    [sorted, category, hideDone],
  );

  const doneCount = sorted.filter(d => d.doneAt).length;

  const toggleDone = (dream: Dream) => {
    const restore = () => void put('dreams', dream);
    void put('dreams', { ...dream, doneAt: dream.doneAt ? undefined : todayISO() });
    if (dream.doneAt) toast('Отметка снята', { kind: 'info', action: { label: 'Вернуть', onClick: restore } });
    else toast(`Мечта исполнена: ${dream.title}`, { action: { label: 'Отменить', onClick: restore } });
  };

  // Цель мечты: по прямой ссылке или по обратной (цель помнит, из какой мечты выросла).
  const goalFor = (dream: Dream) => goals.find(g => (dream.goalId ? g.id === dream.goalId : g.dreamId === dream.id));

  const makeGoal = async (dream: Dream) => {
    const existing = goalFor(dream);
    if (existing) {
      navigate(`/goals/${existing.id}`);
      return;
    }
    const id = newId();
    const now = nowISO();
    await put('goals', {
      id,
      title: dream.title,
      horizon: 'year',
      dreamId: dream.id,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await put('dreams', { ...dream, goalId: id });
    toast('Цель создана');
    navigate(`/goals/${id}`);
  };

  const save = async (patch: Pick<Dream, 'title' | 'emoji' | 'description' | 'category' | 'imageDataUrl' | 'goalId'>) => {
    const current = editing?.dream;
    const now = nowISO();
    await put('dreams', current ? { ...current, ...patch } : { id: newId(), createdAt: now, updatedAt: now, ...patch });
  };

  const countIn = (c: string) => sorted.filter(d => d.category === c).length;
  // Главная кнопка одна — в шапке; в пустом состоянии та же команда вторичной кнопкой.
  const addButton = (label: string, variant: 'primary' | 'secondary' = 'primary') => (
    <Button variant={variant} onClick={() => setEditing({ dream: null })}>
      <Plus size={16} aria-hidden="true" />
      {label}
    </Button>
  );

  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader
        title="Мечты"
        icon={<SectionIcon k="dreams" size={20} />}
        tone="lilac"
        description="Список ста мечт: большие и маленькие, каждую можно сделать целью"
        actions={addButton('Мечта')}
      />

      {sorted.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            compact
            className="py-10"
            k="dreams"
            title="Список из ста мечт"
            description="Запиши то, чего хочется по-настоящему. Любую мечту потом можно превратить в цель со сроком и шагами."
            action={addButton('Записать первую мечту', 'secondary')}
          />
        </Card>
      ) : (
        <>
          <section aria-label="Исполненные мечты" className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
              <p className="flex items-baseline gap-2">
                <span className="font-mono text-display font-medium tabular-nums text-text">{doneCount}</span>
                <span className="text-display text-muted">из</span>
                <span className="font-mono text-display font-medium tabular-nums text-muted">{TARGET}</span>
                <span className="ml-1 text-small text-muted">исполнено</span>
              </p>
              <p className="text-small text-muted">
                записано <span className="font-mono tabular-nums text-text">{sorted.length}</span>
              </p>
            </div>
            <ProgressBar value={doneCount / TARGET} label="Исполненные мечты" className="mt-3" />
          </section>

          <div className="mb-4 mt-6 flex flex-wrap items-center gap-x-3 gap-y-3">
            <div
              role="group"
              aria-label="Категории"
              className="-mx-4 flex w-[calc(100%+2rem)] min-w-0 items-center gap-2 overflow-x-auto px-4 pb-0.5 scroll-thin sm:mx-0 sm:w-auto sm:flex-1 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
            >
              <FilterChip active={category === ALL} label="Все" count={sorted.length} onClick={() => setCategory(ALL)} />
              {categories.map(c => (
                <FilterChip
                  key={c}
                  active={category === c}
                  label={c}
                  count={countIn(c)}
                  tone={categoryLook(c).name}
                  onClick={() => setCategory(c)}
                />
              ))}
            </div>
            <div className="ml-auto">
              <Switch checked={hideDone} onChange={setHideDone} label={<span className="text-small text-muted-strong">Скрыть исполненные</span>} />
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="border-t border-border py-10 text-center text-small text-muted">Под фильтр ничего не подходит</p>
          ) : (
            <div className="stagger grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map(d => (
                <DreamCard
                  key={d.id}
                  dream={d}
                  goal={goalFor(d)}
                  progress={dreamProgress(d, goals, tasks)}
                  onToggleDone={toggleDone}
                  onMakeGoal={d => void makeGoal(d)}
                  onEdit={dream => setEditing({ dream })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {editing ? (
        <DreamEditor
          key={editing.dream?.id ?? 'new'}
          dream={editing.dream}
          categories={categories}
          goals={goals}
          onSave={save}
          onDelete={dream => remove('dreams', dream.id)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
