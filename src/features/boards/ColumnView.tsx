import { Fragment, useRef, useState } from 'react';
import type { KeyboardEventHandler, PointerEventHandler } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Circle, CircleCheck, Clock3, GripVertical, Palette, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Column, ColumnKind, Task } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Chip';
import { Kbd } from '@/components/ui/Kbd';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { TONES, isDecorativeTone } from '@/components/ui/tones';
import type { Tone } from '@/components/ui/tones';
import { TaskCard } from '@/features/tasks/TaskCard';
import { KINDS, KIND_LABEL } from './boardOps';
import { Menu } from '@/components/ui/Menu';
import type { MenuEntry } from '@/components/ui/Menu';
import { columnTone } from './tone';
import { TonePopover } from './TonePicker';

const FOCUS = 'focus-ring';

/**
 * Значок типа колонки — единственный цвет в шапке и он по смыслу: «надо» — пустой приглушённый круг,
 * «в работе» — часы акцентом (идёт работа), «готово» — круг с галочкой цвета успеха.
 */
const KIND_ICON: Record<ColumnKind, { Icon: typeof Circle; color: string }> = {
  todo: { Icon: Circle, color: 'text-muted' },
  doing: { Icon: Clock3, color: 'text-accent-strong' },
  done: { Icon: CircleCheck, color: 'text-success' },
};

/**
 * Карточка колонки: мышью тянется целиком, пальцем и с клавиатуры — за ручку справа
 * (иначе жест уходит в прокрутку). Сам `<li>` остаётся пунктом списка, иначе список карточек
 * перестаёт читаться скринридером, поэтому роль кнопки переноса берёт ручка:
 * на ней и `attributes`, и узел-активатор, и `onKeyDown` — dnd-kit начинает клавиатурный перенос,
 * только когда нажатие пришло ровно в узел-активатор. Указательное нажатие остаётся на карточке:
 * по ней тянут мышью, а с ручки оно всплывает туда же, так что перенос не запускается дважды.
 */
function SortableCard({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', columnId: task.columnId, title: task.title },
  });

  // dnd-kit отдаёт слушателей нетипизированными (`Record<string, Function>`), поэтому разбираем их по одному.
  const onPointerDown = listeners?.onPointerDown as PointerEventHandler | undefined;
  const onKeyDown = listeners?.onKeyDown as KeyboardEventHandler | undefined;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="group/drag relative"
      onPointerDown={onPointerDown}
    >
      <div className={isDragging ? 'invisible' : ''}>
        <TaskCard task={task} compact onOpen={onOpen} className="cursor-grab active:cursor-grabbing pr-7" />
        {/* Ручка — шесть точек в правом верхнем углу: видна по наведению и фокусу, на сенсорном экране всегда. */}
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          onKeyDown={onKeyDown}
          aria-label={`Перетащить: ${task.title}`}
          style={{ touchAction: 'none' }}
          className={`absolute right-1 top-2 h-7 w-6 inline-flex items-center justify-center rounded-md text-muted hover:text-text hover:bg-fill cursor-grab active:cursor-grabbing [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/drag:opacity-100 focus-visible:opacity-100 pointer-coarse:before:absolute pointer-coarse:before:-inset-2.5 pointer-coarse:before:content-[''] ${FOCUS}`}
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
      </div>

      {/* Место, куда встанет карточка: тот же размер, тонкая пунктирная рамка акцентом. */}
      {isDragging ? (
        <div aria-hidden="true" className="absolute inset-0 rounded-tile border border-dashed border-accent" />
      ) : null}
    </li>
  );
}

/**
 * Черта на месте вставки — когда карточку ведут из соседней колонки.
 * Отрицательные поля гасят зазор списка: черта встаёт посередине щели и ничего не сдвигает.
 */
function DropLine() {
  return (
    <li
      aria-hidden="true"
      className="relative -my-1.5 h-0.5 rounded-bar bg-accent before:absolute before:-left-1 before:-top-0.75 before:h-2 before:w-2 before:rounded-mark before:border-2 before:border-accent before:bg-surface"
    />
  );
}

/** Строка «+ Карточка», которая раскрывается в поле ввода. Enter добавляет, Escape закрывает. */
function AddCard({ columnTitle, onCreate }: { columnTitle: string; onCreate: (title: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const submit = () => {
    const title = draft.trim();
    if (!title) return;
    onCreate(title);
    setDraft('');
  };

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className={`mt-2 w-full h-8 px-2 rounded-control text-small text-muted hover:bg-fill hover:text-text inline-flex items-center gap-2 ${FOCUS}`}
      >
        <Plus size={16} aria-hidden="true" />
        Карточка
      </button>
    );
  }

  return (
    <div className="animate-in mt-2 rounded-tile border border-accent bg-surface p-2 ring-1 ring-accent dark:bg-raised">
      <input
        autoFocus
        value={draft}
        placeholder="Что нужно сделать"
        aria-label={`Новая карточка в колонке «${columnTitle}»`}
        className="w-full bg-transparent px-0.5 text-body text-text placeholder:text-muted outline-none"
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft('');
            setAdding(false);
          }
        }}
        onBlur={() => {
          if (!draft.trim()) setAdding(false);
        }}
      />
      <div className="mt-2 flex items-center gap-2">
        <span className="mr-auto flex items-center gap-1 text-caption text-muted">
          <Kbd>Enter</Kbd>
          <span className="mr-1.5">добавить</span>
          <Kbd>Esc</Kbd>
          <span>закрыть</span>
        </span>
        {/* mousedown без фокуса: иначе поле теряет фокус и закрывается раньше клика. */}
        <Button
          variant="primary"
          size="sm"
          disabled={!draft.trim()}
          onMouseDown={e => e.preventDefault()}
          onClick={submit}
        >
          Добавить
        </Button>
      </div>
    </div>
  );
}

export function ColumnView({
  column,
  tasks,
  insertAt,
  progress,
  dragging = false,
  onOpenTask,
  onCreate,
  onRename,
  onKind,
  onTone,
  onDelete,
}: {
  column: Column;
  /** Задачи колонки по возрастанию position. */
  tasks: Task[];
  /** Индекс вставки для карточки из другой колонки, иначе null. */
  insertAt: number | null;
  /** Для колонки «готово»: сколько карточек доски уже закрыто из всех. */
  progress?: { done: number; total: number };
  /** Идёт перенос какой-нибудь карточки — пустые колонки зовут «перетащи сюда» ярче. */
  dragging?: boolean;
  onOpenTask: (t: Task) => void;
  onCreate: (title: string) => void;
  onRename: () => void;
  onKind: (kind: ColumnKind) => void;
  onTone: (tone: Tone) => void;
  onDelete: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: 'column', columnId: column.id } });
  const { Icon, color } = KIND_ICON[column.kind];
  const tone = columnTone(column);
  const empty = tasks.length === 0;
  const targeted = insertAt !== null || isOver;
  const header = useRef<HTMLElement>(null);
  const [picking, setPicking] = useState(false);

  const entries: MenuEntry[] = [
    { type: 'item', label: 'Переименовать', icon: <Pencil size={14} />, onSelect: onRename },
    { type: 'item', label: 'Цвет колонки', icon: <Palette size={14} />, onSelect: () => setPicking(true) },
    { type: 'label', label: 'Тип колонки' },
    ...KINDS.map<MenuEntry>(k => ({
      type: 'item',
      label: KIND_LABEL[k],
      checked: column.kind === k,
      onSelect: () => onKind(k),
    })),
    { type: 'separator' },
    {
      type: 'item',
      label: tasks.length ? 'Удалить: сначала опустошить' : 'Удалить колонку',
      icon: <Trash2 size={14} />,
      danger: true,
      disabled: tasks.length > 0,
      onSelect: onDelete,
    },
  ];

  return (
    <section
      aria-label={column.title}
      data-column-id={column.id}
      className={`w-[85%] sm:w-75 shrink-0 snap-start rounded-card border bg-fill dark:bg-surface transition-colors duration-(--duration-base) ease-out-soft ${
        targeted ? 'border-accent' : 'border-border'
      }`}
    >
      <header ref={header} className="h-10 pl-3 pr-1 flex items-center gap-2">
        <Icon size={16} aria-hidden="true" className={`shrink-0 ${color}`} />
        <h2 className="min-w-0 truncate text-title font-semibold text-text">
          {column.title}
          <span className="sr-only">, {KIND_LABEL[column.kind].toLowerCase()}</span>
        </h2>
        {/* Цвет, выбранный человеком, — только точка 6 px у названия. */}
        {isDecorativeTone(tone) ? <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-mark ${TONES[tone].solid}`} /> : null}
        <Badge>
          <span className="sr-only">карточек: </span>
          {tasks.length}
        </Badge>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {progress && progress.done > 0 ? (
            <ProgressRing
              value={progress.done / progress.total}
              size={16}
              stroke={2}
              label={`Готово ${progress.done} из ${progress.total} карточек доски`}
              className="mr-1"
            >
              <span aria-hidden="true" className="sr-only" />
            </ProgressRing>
          ) : null}
          <Menu label={`Колонка «${column.title}»`} entries={entries} size="sm" />
        </div>
      </header>
      <TonePopover
        anchor={header}
        open={picking}
        onClose={() => setPicking(false)}
        value={tone}
        onChange={onTone}
        title="Цвет колонки"
      />

      <div ref={setNodeRef} className="px-2 pb-2">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">
            {tasks.map((task, i) => (
              <Fragment key={task.id}>
                {insertAt === i ? <DropLine /> : null}
                <SortableCard task={task} onOpen={onOpenTask} />
              </Fragment>
            ))}
            {!empty && insertAt !== null && insertAt >= tasks.length ? <DropLine /> : null}
          </ul>
        </SortableContext>

        {/* Пустая колонка — тихое пунктирное место; во время переноса линия плотнее, под курсором — акцент. */}
        {empty ? (
          <div
            className={`h-20 rounded-tile border border-dashed flex items-center justify-center text-small transition-colors duration-(--duration-base) ${
              targeted
                ? 'border-accent text-accent-strong'
                : dragging
                  ? 'border-control-border text-muted-strong'
                  : 'border-border-strong text-muted'
            }`}
          >
            Перетащи сюда
          </div>
        ) : null}

        <AddCard columnTitle={column.title} onCreate={onCreate} />
      </div>
    </section>
  );
}
