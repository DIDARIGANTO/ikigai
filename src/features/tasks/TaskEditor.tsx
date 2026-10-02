import { useCallback, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, Target, X } from 'lucide-react';
import type { Area, Column, Goal, Horizon, Task } from '@/lib/types';
import { SidePanel } from '@/components/ui/SidePanel';
import { Button, IconButton } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { DateQuickChips } from '@/components/ui/DateField';
import { FIELD, Textarea } from '@/components/ui/Input';
import { rememberFocus } from '@/components/ui/overlay';
import { Segmented } from '@/components/ui/Segmented';
import type { SegmentOption } from '@/components/ui/Segmented';
import { Switch } from '@/components/ui/Switch';
import { useCollection } from '@/data/hooks';
import { planVsFact } from '@/lib/domain/tasks';
import { durationLabel } from '@/lib/parse/quickParse';
import { created, updated } from '@/lib/undo';
import { useTaskActionsCtx } from './TaskActionsContext';
import { columnFor, newTask } from './useTaskActions';
import { EmojiButton } from './EmojiButton';
import { PickerMenu } from './PickerMenu';
import { boardPickerItems, goalPickerItems } from './pickers';
import { planFactBar } from './planFact';

// oxlint-disable-next-line react/only-export-components -- список длительностей общий с быстрой записью
export const DURATIONS = [15, 30, 45, 60, 90, 120];

const HORIZONS: { key: Horizon; label: string }[] = [
  { key: 'years', label: 'Годы' },
  { key: 'year', label: 'Год' },
  { key: 'month', label: 'Месяц' },
  { key: 'week', label: 'Неделя' },
];

/** Активные цели, сгруппированные по горизонту, — для выпадающего списка. */
// oxlint-disable-next-line react/only-export-components -- группировка целей общая с быстрой записью
export function goalGroups(goals: Goal[]) {
  const active = goals.filter(g => g.status === 'active');
  return HORIZONS.map(h => ({ ...h, items: active.filter(g => g.horizon === h.key) })).filter(g => g.items.length > 0);
}

interface Form {
  title: string;
  emoji: string | undefined;
  notes: string;
  area: Area;
  boardId: string;
  columnId: string;
  goalId: string;
  date: string;
  plannedStart: string;
  plannedMinutes: number | undefined;
  important: boolean;
  kind: Task['kind'];
}

const toForm = (task: Task | null, defaults?: Partial<Task>): Form => {
  const t = { ...(defaults ?? {}), ...(task ?? {}) } as Partial<Task>;
  return {
    title: t.title ?? '',
    emoji: t.emoji,
    notes: t.notes ?? '',
    area: t.area ?? 'personal',
    boardId: t.boardId ?? '',
    columnId: t.columnId ?? '',
    goalId: t.goalId ?? '',
    date: t.date ?? '',
    plannedStart: t.plannedStart ?? '',
    plannedMinutes: t.plannedMinutes,
    important: !!t.important,
    kind: t.kind ?? 'task',
  };
};

/** Сфера — простой переключатель без цветных точек: цвет в «Графите» не украшение. */
// oxlint-disable-next-line react/only-export-components -- варианты сферы общие с быстрой записью
export const AREA_OPTIONS: SegmentOption<Area>[] = [
  { value: 'work', label: 'Работа' },
  { value: 'personal', label: 'Личное' },
];

const KIND_OPTIONS: SegmentOption<Task['kind']>[] = [
  { value: 'task', label: 'Задача' },
  { value: 'workout', label: 'Тренировка' },
];

/** Тип колонки, соответствующий статусу задачи. */
const kindForStatus = (status: Task['status'] | undefined): Column['kind'] =>
  status === 'done' ? 'done' : status === 'doing' ? 'doing' : 'todo';

/**
 * Колонка для сохраняемой задачи: выбранная вручную, при неизменной доске — прежняя,
 * при смене доски — колонка под текущий статус, у новой задачи — «надо сделать».
 */
function nextColumnId(columns: Column[], task: Task | null, boardId: string | undefined, picked: string): string | undefined {
  if (!boardId) return undefined;
  if (picked && columns.some(c => c.id === picked && c.boardId === boardId)) return picked;
  if (!task) return columnFor(columns, boardId, 'todo');
  if (task.boardId === boardId) return task.columnId;
  return columnFor(columns, boardId, kindForStatus(task.status));
}

/** Сетка строки свойства: подпись 13 px в колонке 96 px, значение справа. */
const PROP_GRID = 'grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-x-3 py-1';
const PROP_LABEL = 'flex min-h-8 items-center text-small text-muted';

/** Строка свойства документа: подпись слева, значение справа (и на телефоне тоже — колонка подписи узкая). */
function Prop({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className={PROP_GRID}>
      <span id={id} className={PROP_LABEL}>
        {label}
      </span>
      <div className="flex min-h-8 min-w-0 items-center" role="group" aria-labelledby={id}>
        {children}
      </div>
    </div>
  );
}

/**
 * Кнопка-«значение» свойства: как поле, но без рамки, пока на неё не навели. Без `max-w-full`: с отрицательным
 * отступом он обрезал бы подпись раньше времени; сжаться (и обрезать текст) кнопка может и так — как элемент flex.
 */
const VALUE_BTN =
  'focus-ring -ml-2 inline-flex h-8 min-w-0 items-center gap-1.5 rounded-control px-2 text-body hover:bg-fill aria-expanded:bg-fill pointer-coarse:h-11';

/** Подпись чипа длительности: коротко, чтобы шесть вариантов уместились в строку («1,5 ч», а не «1 ч 30 мин»). */
const chipDuration = (m: number) => (m < 60 ? `${m} мин` : `${(m / 60).toLocaleString('ru-RU')} ч`);

/** Поля даты и времени в строках свойств — ниже обычных (32 px), цифры табличные. */
const SMALL_FIELD = `${FIELD} h-8 tabular-nums pointer-coarse:h-10`;

export function TaskEditor({
  task,
  defaults,
  onClose,
}: {
  task: Task | null;
  defaults?: Partial<Task>;
  onClose: () => void;
}) {
  const { columns, goals, commit, del } = useTaskActionsCtx();
  const boards = useCollection('boards');
  const [form, setForm] = useState<Form>(() => toForm(task, defaults));

  const set = useCallback(<K extends keyof Form>(key: K, v: Form[K]) => setForm(f => ({ ...f, [key]: v })), []);
  const goalItems = useMemo(() => goalPickerItems(goals), [goals]);
  const boardItems = useMemo(() => boardPickerItems(boards), [boards]);
  const boardColumns = useMemo(
    () => columns.filter(c => c.boardId === form.boardId).sort((a, b) => a.position - b.position),
    [columns, form.boardId],
  );
  const pf = task ? planVsFact(task) : null;
  const uid = useId();
  const goal = goals.find(g => g.id === form.goalId);
  const board = boards.find(b => b.id === form.boardId);
  const shownColumnId = nextColumnId(columns, task, form.boardId || undefined, form.columnId);
  const column = columns.find(c => c.id === shownColumnId);

  const submit = async () => {
    const title = form.title.trim();
    if (!title) return;
    const boardId = form.boardId || undefined;
    const patch = {
      title,
      emoji: form.emoji,
      notes: form.notes.trim() || undefined,
      area: form.area,
      boardId,
      // Колонку трогаем только при смене доски или ручном выборе: иначе задача прыгала бы в «Надо сделать».
      columnId: nextColumnId(columns, task, boardId, form.columnId),
      goalId: form.goalId || undefined,
      date: form.date || undefined,
      plannedStart: form.plannedStart || undefined,
      plannedMinutes: form.plannedMinutes,
      important: form.important,
      kind: form.kind,
    };
    if (task) await commit('Сохранено', [updated('tasks', task, { ...task, ...patch })]);
    else await commit('Задача создана', [created('tasks', newTask({ ...defaults, ...patch }))]);
    onClose();
  };

  const onDelete = async () => {
    if (!task) return;
    onClose();
    await del(task, { undo: true });
  };

  return (
    <SidePanel
      open
      onClose={onClose}
      title={<span className="text-small font-medium text-muted">{task ? 'Задача' : 'Новая задача'}</span>}
      footer={
        <div className="flex w-full items-center gap-2">
          {task ? (
            <Button variant="danger-quiet" onClick={() => void onDelete()} className="mr-auto -ml-3">
              Удалить
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose} className={task ? '' : 'ml-auto'}>
            Отмена
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!form.title.trim()}>
            Сохранить
          </Button>
        </div>
      }
    >
      <form
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        {/* Заголовок документа: эмодзи — маленькая кнопка в строке, название — крупно и без рамки. */}
        <div className="flex items-start gap-1.5">
          <EmojiButton value={form.emoji} onChange={e => set('emoji', e)} label="Эмодзи задачи" className="-ml-2" />
          <textarea
            aria-label="Название задачи"
            autoFocus={!task}
            rows={1}
            value={form.title}
            onChange={e => set('title', e.target.value.replace(/\n/g, ' '))}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Что нужно сделать"
            className="field-sizing-content min-h-8 min-w-0 flex-1 resize-none border-b border-transparent bg-transparent py-0.5 text-xl font-semibold text-text outline-none placeholder:text-muted focus:border-accent"
          />
        </div>

        <div className="mt-4">
          {pf ? <PlanFactRow planned={pf.planned} actual={pf.actual} /> : null}

          <Prop label="Дата" id={`${uid}-date`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="w-40">
                  <input
                    type="date"
                    lang="ru"
                    aria-label="Дата"
                    value={form.date}
                    onChange={e => set('date', e.target.value)}
                    className={SMALL_FIELD}
                  />
                </span>
                {form.date ? <ClearButton label="Убрать дату" onClick={() => set('date', '')} /> : null}
              </div>
              <DateQuickChips value={form.date} onChange={iso => set('date', iso)} className="mt-1.5 mb-1" />
            </div>
          </Prop>

          <Prop label="Время" id={`${uid}-time`}>
            <div className="flex items-center gap-1">
              <span className="w-32">
                <input
                  type="time"
                  lang="ru"
                  aria-label="Время начала"
                  value={form.plannedStart}
                  onChange={e => set('plannedStart', e.target.value)}
                  className={`${SMALL_FIELD} font-mono`}
                />
              </span>
              {form.plannedStart ? <ClearButton label="Убрать время" onClick={() => set('plannedStart', '')} /> : null}
            </div>
          </Prop>

          <Prop label="Длительность" id={`${uid}-dur`}>
            <div className="flex flex-wrap gap-1">
              {DURATIONS.map(d => (
                <Chip
                  key={d}
                  size="sm"
                  selected={form.plannedMinutes === d}
                  onClick={() => set('plannedMinutes', form.plannedMinutes === d ? undefined : d)}
                  className="tabular-nums"
                >
                  {chipDuration(d)}
                </Chip>
              ))}
              {form.plannedMinutes && !DURATIONS.includes(form.plannedMinutes) ? (
                <Chip size="sm" selected onClick={() => set('plannedMinutes', undefined)} className="tabular-nums">
                  {durationLabel(form.plannedMinutes)}
                </Chip>
              ) : null}
            </div>
          </Prop>

          <Prop label="Сфера" id={`${uid}-area`}>
            <Segmented labelledBy={`${uid}-area`} value={form.area} options={AREA_OPTIONS} onChange={a => set('area', a)} />
          </Prop>

          <Prop label="Тип" id={`${uid}-kind`}>
            <Segmented labelledBy={`${uid}-kind`} value={form.kind} options={KIND_OPTIONS} onChange={k => set('kind', k)} />
          </Prop>

          <Prop label="Доска" id={`${uid}-board`}>
            <div className="flex min-w-0 flex-wrap items-center gap-x-1">
              <PickerMenu
                label="Доска"
                items={boardItems}
                noneLabel="Без доски"
                value={form.boardId}
                onSelect={id => setForm(f => ({ ...f, boardId: id, columnId: '' }))}
                className={VALUE_BTN}
              >
                <span className={`truncate ${board ? 'text-text' : 'text-muted'}`}>{board?.title ?? 'Без доски'}</span>
                <ChevronDown size={14} aria-hidden="true" className="shrink-0 text-muted" />
              </PickerMenu>
              {board ? (
                <>
                  <span aria-hidden="true" className="text-muted">
                    ·
                  </span>
                  <PickerMenu
                    label="Колонка"
                    items={boardColumns.map(c => ({ id: c.id, label: c.title }))}
                    value={shownColumnId}
                    onSelect={id => set('columnId', id)}
                    className={`${VALUE_BTN.replace('-ml-2', '')} text-muted-strong`}
                  >
                    <span className="truncate">{column?.title ?? 'Колонка'}</span>
                    <ChevronDown size={14} aria-hidden="true" className="shrink-0 text-muted" />
                  </PickerMenu>
                </>
              ) : null}
            </div>
          </Prop>

          <Prop label="Цель" id={`${uid}-goal`}>
            <PickerMenu
              label="Цель"
              searchable
              placeholder="Найти цель"
              items={goalItems}
              noneLabel="Без цели"
              value={form.goalId}
              onSelect={id => set('goalId', id)}
              className={VALUE_BTN}
            >
              {goal ? (
                <>
                  {goal.emoji ? (
                    <span aria-hidden="true" className="font-emoji">
                      {goal.emoji}
                    </span>
                  ) : (
                    <Target size={16} aria-hidden="true" className="shrink-0 text-muted" />
                  )}
                  <span className="truncate text-text">{goal.title}</span>
                </>
              ) : (
                <span className="text-muted">Без цели</span>
              )}
              <ChevronDown size={14} aria-hidden="true" className="shrink-0 text-muted" />
            </PickerMenu>
          </Prop>

          <Prop label="Важное" id={`${uid}-imp`}>
            <Switch checked={form.important} onChange={v => set('important', v)} aria-label="Важная задача" />
          </Prop>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <label htmlFor={`${uid}-notes`} className="mb-1.5 block text-small text-muted">
            Заметка
          </label>
          <Textarea
            id={`${uid}-notes`}
            rows={4}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Детали, ссылки, шаги"
          />
        </div>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Сохранить
        </button>
      </form>
    </SidePanel>
  );
}

function ClearButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <IconButton size="sm" aria-label={label} title={label} onClick={onClick}>
      <X size={16} aria-hidden="true" />
    </IconButton>
  );
}

/** «План · факт» — строка цифр моноширинным; перерасход — тёплым цветом, без заливок. */
function PlanFactRow({ planned, actual }: { planned: number; actual: number }) {
  const bar = planFactBar(planned, actual);
  return (
    <div className={PROP_GRID}>
      <span className={PROP_LABEL}>План · факт</span>
      <p className="flex min-h-8 flex-wrap items-center gap-x-2 text-small" title={bar.title}>
        <span className="font-mono tabular-nums text-text">
          {planned} / {actual} мин
        </span>
        {bar.over ? <span className="text-warning-strong">на {actual - planned} мин дольше</span> : null}
      </p>
    </div>
  );
}

export interface TaskEditorTarget {
  task: Task | null;
  defaults?: Partial<Task>;
}

/**
 * Небольшой помощник для страниц: `const { open, editor } = useTaskEditor();`
 * — `open(task)` правит задачу, `open(null, { date })` создаёт новую, `editor` рисуется в разметке.
 */
// oxlint-disable-next-line react/only-export-components -- хук живёт рядом со своим редактором
export function useTaskEditor() {
  const [target, setTarget] = useState<TaskEditorTarget | null>(null);
  const open = useCallback((task: Task | null = null, defaults?: Partial<Task>) => {
    rememberFocus();
    setTarget({ task, defaults });
  }, []);
  const close = useCallback(() => setTarget(null), []);
  const editor = target ? (
    <TaskEditor key={target.task?.id ?? 'new'} task={target.task} defaults={target.defaults} onClose={close} />
  ) : null;
  return { open, close, editor };
}
