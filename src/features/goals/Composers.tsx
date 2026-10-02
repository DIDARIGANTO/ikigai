import { useId, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { CornerDownLeft, Plus } from 'lucide-react';
import type { Goal, Horizon } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { FIELD } from '@/components/ui/Input';
import { Kbd } from '@/components/ui/Kbd';
import { useToast } from '@/components/ui/Toast';
import { useRepo } from '@/data/hooks';
import { newId, nowISO } from '@/lib/ids';
import { newTask } from '@/features/tasks/useTaskActions';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import { nextHorizon, pluralRu } from './meta';
import { HorizonChip } from './parts';
import { parseLines } from './lines';

/**
 * «Разбить на подцели»: несколько названий разом, по одному на строку.
 * Горизонт подцелей — на ступень ближе, родитель — эта цель. Вместо 8–10 кликов — один.
 */
export function SubgoalComposer({ goal, onDone }: { goal: Goal; onDone?: () => void }) {
  const { put } = useRepo();
  const toast = useToast();
  const [text, setText] = useState('');
  const id = useId();
  const horizon: Horizon = nextHorizon(goal.horizon);
  const titles = parseLines(text);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!titles.length) return;
    const now = nowISO();
    for (const [i, title] of titles.entries()) {
      // Разные метки времени — чтобы порядок строк сохранился в списке подцелей.
      const at = new Date(Date.parse(now) + i).toISOString();
      await put('goals', { id: newId(), title, horizon, parentId: goal.id, status: 'active', createdAt: at, updatedAt: at });
    }
    toast(`${titles.length} ${pluralRu(titles.length, ['подцель добавлена', 'подцели добавлены', 'подцелей добавлено'])}`);
    setText('');
    onDone?.();
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <form onSubmit={e => void submit(e)}>
      <label htmlFor={id} className="flex items-center gap-2 label-text text-muted-strong">
        Разбить на подцели
        <HorizonChip horizon={horizon} />
      </label>
      <textarea
        id={id}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={onKey}
        rows={3}
        placeholder={'По одной на строку, например:\nПробежать 10 км\nЗаписаться на забег'}
        className={`${FIELD} mt-1.5 resize-y py-2`}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-caption text-muted pointer-coarse:invisible">
          <span aria-hidden="true">
            <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> — добавить
          </span>
          <span className="sr-only">Ctrl и Enter — добавить</span>
        </span>
        <Button type="submit" variant="secondary" size="sm" disabled={!titles.length}>
          <Plus size={14} aria-hidden="true" />
          {titles.length
            ? `Добавить ${titles.length} ${pluralRu(titles.length, ['подцель', 'подцели', 'подцелей'])}`
            : 'Добавить'}
        </Button>
      </div>
    </form>
  );
}

/** Шаг одной строкой: название и Enter — задача, привязанная к цели. */
export function StepComposer({ goal }: { goal: Goal }) {
  const { save } = useTaskActionsCtx();
  const [title, setTitle] = useState('');
  const id = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    await save(newTask({ title: t, goalId: goal.id, area: 'work' }));
    setTitle('');
  };

  return (
    <form onSubmit={e => void submit(e)} className="relative">
      <label htmlFor={id} className="sr-only">
        Новый шаг к цели «{goal.title}»
      </label>
      <Plus size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        id={id}
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Новый шаг и Enter"
        maxLength={200}
        className={`${FIELD} h-9 pl-9 pr-10`}
      />
      <button
        type="submit"
        aria-label="Добавить шаг"
        disabled={!title.trim()}
        className="focus-ring absolute right-1 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-chip text-muted-strong hover:bg-fill hover:text-text disabled:text-muted disabled:hover:bg-transparent"
      >
        <CornerDownLeft size={14} />
      </button>
    </form>
  );
}
