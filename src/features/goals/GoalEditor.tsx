import { useCallback, useMemo, useState } from 'react';
import type { Goal, Horizon } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { EmojiPickerButton } from '@/components/ui/EmojiPicker';
import { FieldLabel, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useCollection, useRepo } from '@/data/hooks';
import { HORIZON_LABEL } from '@/lib/domain/goals';
import { newId, nowISO } from '@/lib/ids';
import { HORIZON_ORDER, descendantIds } from './meta';

interface Form {
  title: string;
  emoji: string | undefined;
  description: string;
  horizon: Horizon;
  parentId: string;
  dreamId: string;
  startDate: string;
  endDate: string;
}

const toForm = (goal: Goal | null, defaults?: Partial<Goal>): Form => {
  const g = { ...(defaults ?? {}), ...(goal ?? {}) } as Partial<Goal>;
  return {
    title: g.title ?? '',
    emoji: g.emoji,
    description: g.description ?? '',
    horizon: g.horizon ?? 'year',
    parentId: g.parentId ?? '',
    dreamId: g.dreamId ?? '',
    startDate: g.startDate ?? '',
    endDate: g.endDate ?? '',
  };
};

export function GoalEditor({
  goal,
  defaults,
  onClose,
}: {
  goal: Goal | null;
  defaults?: Partial<Goal>;
  onClose: () => void;
}) {
  const goals = useCollection('goals');
  const dreams = useCollection('dreams');
  const { put } = useRepo();
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => toForm(goal, defaults));

  const set = useCallback(<K extends keyof Form>(key: K, v: Form[K]) => setForm(f => ({ ...f, [key]: v })), []);

  // Родителем может быть только цель более дальнего горизонта и не потомок правимой цели.
  const parentGroups = useMemo(() => {
    const forbidden = goal ? descendantIds(goals, goal.id) : new Set<string>();
    const level = HORIZON_ORDER.indexOf(form.horizon);
    return HORIZON_ORDER.slice(0, level)
      .map(h => ({ h, items: goals.filter(g => g.horizon === h && !forbidden.has(g.id)) }))
      .filter(g => g.items.length > 0);
  }, [goals, goal, form.horizon]);

  // Смена горизонта может сделать прежнего родителя недопустимым — тогда связь снимается.
  const changeHorizon = (h: Horizon) => {
    const parent = goals.find(g => g.id === form.parentId);
    const keep = parent && HORIZON_ORDER.indexOf(parent.horizon) < HORIZON_ORDER.indexOf(h);
    setForm(f => ({ ...f, horizon: h, parentId: keep ? f.parentId : '' }));
  };

  const submit = async () => {
    const title = form.title.trim();
    if (!title) return;
    const now = nowISO();
    const patch = {
      title,
      emoji: form.emoji,
      description: form.description.trim() || undefined,
      horizon: form.horizon,
      parentId: form.parentId || undefined,
      dreamId: form.dreamId || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
    };
    const next: Goal = goal
      ? { ...goal, ...patch }
      : { id: newId(), status: 'active', createdAt: now, updatedAt: now, ...defaults, ...patch };
    await put('goals', next);
    toast('Сохранено');
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={goal ? 'Цель' : 'Новая цель'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!form.title.trim()}>
            Сохранить
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <FieldLabel htmlFor="goal-title">Название</FieldLabel>
          <div className="flex items-center gap-2">
            <EmojiPickerButton value={form.emoji} onChange={e => set('emoji', e)} size={36} label="Эмодзи цели" />
            <Input
              id="goal-title"
              autoFocus
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Чего нужно достичь"
            />
          </div>
        </div>

        <Textarea
          label="Описание"
          rows={3}
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Зачем эта цель и что считается достижением"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Горизонт"
            value={form.horizon}
            onChange={e => changeHorizon(e.target.value as Horizon)}
          >
            {HORIZON_ORDER.map(h => (
              <option key={h} value={h}>
                {HORIZON_LABEL[h]}
              </option>
            ))}
          </Select>

          <Select label="Родительская цель" value={form.parentId} onChange={e => set('parentId', e.target.value)}>
            <option value="">Без родителя</option>
            {parentGroups.map(g => (
              <optgroup key={g.h} label={HORIZON_LABEL[g.h]}>
                {g.items.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>

        <Select label="Мечта" value={form.dreamId} onChange={e => set('dreamId', e.target.value)}>
          <option value="">Не связана</option>
          {dreams.map(d => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Начало" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
          <Input label="Окончание" type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
        </div>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Сохранить
        </button>
      </form>
    </Modal>
  );
}

export interface GoalEditorTarget {
  goal: Goal | null;
  defaults?: Partial<Goal>;
}

/**
 * Помощник для страниц: `const { open, editor } = useGoalEditor();`
 * — `open(goal)` правит цель, `open(null, { horizon, parentId })` создаёт новую.
 */
// oxlint-disable-next-line react/only-export-components -- хук живёт рядом со своим редактором
export function useGoalEditor() {
  const [target, setTarget] = useState<GoalEditorTarget | null>(null);
  const open = useCallback((goal: Goal | null = null, defaults?: Partial<Goal>) => setTarget({ goal, defaults }), []);
  const close = useCallback(() => setTarget(null), []);
  const editor = target ? (
    <GoalEditor key={target.goal?.id ?? 'new'} goal={target.goal} defaults={target.defaults} onClose={close} />
  ) : null;
  return { open, close, editor };
}
