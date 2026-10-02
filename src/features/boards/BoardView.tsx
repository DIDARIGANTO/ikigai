import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { Announcements, DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type { Board, Column, ColumnKind, Task } from '@/lib/types';
import { useCollection, useRepo } from '@/data/hooks';
import { newId, nowISO } from '@/lib/ids';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { burst } from '@/components/ui/Burst';
import type { Tone } from '@/components/ui/tones';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import { newTask } from '@/features/tasks/useTaskActions';
import { TaskCard } from '@/features/tasks/TaskCard';
import { applyColumnKind, byPosition, dropIndex, dropPosition, resolveColumnId, KIND_LABEL, STEP } from './boardOps';
import { ColumnView } from './ColumnView';
import { NameDialog } from './NameDialog';

type Dialog = { mode: 'new' } | { mode: 'rename'; column: Column } | null;

export function BoardView({ board, onOpenTask }: { board: Board; onOpenTask: (task: Task) => void }) {
  const { tasks } = useTaskActionsCtx();
  const allColumns = useCollection('columns');
  const { put, remove } = useRepo();
  const toast = useToast();
  const confirm = useConfirm();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [hint, setHint] = useState<{ columnId: string; index: number } | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  const sensors = useSensors(
    // Небольшой порог: короткий клик по карточке открывает её, а не начинает перенос.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columns = useMemo(
    () => allColumns.filter(c => c.boardId === board.id).sort((a, b) => a.position - b.position),
    [allColumns, board.id],
  );

  /** Задачи доски, разложенные по колонкам и отсортированные по position. */
  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>(columns.map(c => [c.id, []]));
    for (const task of tasks) {
      if (task.boardId !== board.id) continue;
      const columnId = resolveColumnId(task, columns);
      if (columnId) map.get(columnId)?.push(task);
    }
    for (const list of map.values()) list.sort(byPosition);
    return map;
  }, [tasks, columns, board.id]);

  const columnOf = (taskId: string) => columns.find(c => grouped.get(c.id)?.some(t => t.id === taskId))?.id ?? null;

  /** Куда указывает курсор: колонка и карточка под ним (если это карточка). */
  const locate = (overId: string | null) => {
    if (!overId) return null;
    if (columns.some(c => c.id === overId)) return { columnId: overId, overTaskId: null as string | null };
    const columnId = columnOf(overId);
    return columnId ? { columnId, overTaskId: overId } : null;
  };

  // Подсказки для скринридера: при переносе вслух называем колонку, над которой сейчас карточка.
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Взяли карточку «${active.data.current?.title ?? active.id}»`,
    onDragOver: ({ over }) => {
      const target = locate(over ? String(over.id) : null);
      const column = target ? columns.find(c => c.id === target.columnId) : undefined;
      return column ? `Над колонкой «${column.title}»` : 'Вне колонок';
    },
    onDragEnd: ({ over }) => (over ? 'Карточка перенесена' : 'Перенос отменён'),
    onDragCancel: () => 'Перенос отменён',
  };

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setHint(null);
  };

  const onDragOver = (e: DragOverEvent) => {
    const id = String(e.active.id);
    const target = locate(e.over ? String(e.over.id) : null);
    // Внутри своей колонки подсказка не нужна: место карточки и так видно пунктиром.
    if (!target || target.columnId === columnOf(id)) {
      setHint(null);
      return;
    }
    const ordered = grouped.get(target.columnId) ?? [];
    setHint({ columnId: target.columnId, index: dropIndex(ordered, id, target.overTaskId) });
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const id = String(e.active.id);
    const target = locate(e.over ? String(e.over.id) : null);
    setActiveId(null);
    setHint(null);
    if (!target) return;

    const task = tasks.find(t => t.id === id);
    const column = columns.find(c => c.id === target.columnId);
    if (!task || !column) return;

    const ordered = grouped.get(column.id) ?? [];
    const position = dropPosition(ordered, id, target.overTaskId);
    const moved = { ...task, boardId: board.id, columnId: column.id, position };
    const next = applyColumnKind(moved, column.kind, nowISO());
    if (next.columnId === task.columnId && next.position === task.position && next.status === task.status) return;
    // Карточка доехала до «готово» — маленький тихий залп там, где её отпустили (один раз на перенос).
    const rect = e.active.rect.current.translated;
    if (column.kind === 'done' && task.status !== 'done' && rect) {
      burst({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, { count: 14, power: 5 });
    }
    await put('tasks', next);
  };

  const createTask = async (column: Column, title: string) => {
    const last = (grouped.get(column.id) ?? []).at(-1);
    const base = newTask({
      title,
      boardId: board.id,
      columnId: column.id,
      area: board.title === 'Работа' ? 'work' : 'personal',
      position: last ? last.position + STEP : 0,
    });
    await put('tasks', applyColumnKind(base, column.kind, nowISO()));
  };

  const createColumn = async (title: string) => {
    const now = nowISO();
    const position = (columns.at(-1)?.position ?? -1) + 1;
    await put('columns', { id: newId(), boardId: board.id, title, kind: 'todo', position, createdAt: now, updatedAt: now });
    toast('Колонка добавлена');
  };

  const renameColumn = async (column: Column, title: string) => {
    await put('columns', { ...column, title });
  };

  const setKind = async (column: Column, kind: ColumnKind) => {
    if (column.kind === kind) return;
    await put('columns', { ...column, kind });
    toast(`Тип колонки: ${KIND_LABEL[kind].toLowerCase()}`);
  };

  const setTone = async (column: Column, tone: Tone) => {
    if (column.tone === tone) return;
    await put('columns', { ...column, tone });
  };

  /** Сколько карточек доски закрыто — кольцо в шапке колонки «готово». */
  const progress = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const c of columns) {
      const n = grouped.get(c.id)?.length ?? 0;
      total += n;
      if (c.kind === 'done') done += n;
    }
    return { done, total };
  }, [columns, grouped]);

  const deleteColumn = async (column: Column) => {
    // Непустую колонку удалить нельзя: пункт меню для неё выключен, здесь остаётся молчаливая страховка.
    if ((grouped.get(column.id) ?? []).length) return;
    if (!(await confirm(`Удалить колонку «${column.title}»?`))) return;
    await remove('columns', column.id);
    toast('Колонка удалена');
  };

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : undefined;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        accessibility={{ announcements }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={e => void onDragEnd(e)}
        onDragCancel={() => {
          setActiveId(null);
          setHint(null);
        }}
      >
        {/* Доска прокручивается вбок внутри себя и выходит к краям основной области — страница вбок не едет. */}
        <div
          role="region"
          aria-label={`Колонки доски «${board.title}»`}
          className={`-mx-4 px-4 scroll-px-4 md:-mx-8 md:px-8 md:scroll-px-8 flex items-start gap-3 overflow-x-auto overscroll-x-contain scroll-thin pb-4 ${
            activeId || !columns.length ? '' : 'snap-x snap-mandatory sm:snap-none'
          }`}
        >
          {columns.map(column => (
            <ColumnView
              key={column.id}
              column={column}
              tasks={grouped.get(column.id) ?? []}
              insertAt={hint && hint.columnId === column.id ? hint.index : null}
              progress={column.kind === 'done' ? progress : undefined}
              dragging={activeId !== null}
              onOpenTask={onOpenTask}
              onTone={tone => void setTone(column, tone)}
              onCreate={title => void createTask(column, title)}
              onRename={() => setDialog({ mode: 'rename', column })}
              onKind={kind => void setKind(column, kind)}
              onDelete={() => void deleteColumn(column)}
            />
          ))}

          {/* «+ Колонка» — тихая кнопка-призрак на уровне шапок колонок. */}
          <Button
            variant="ghost"
            size="lg"
            onClick={() => setDialog({ mode: 'new' })}
            className="mt-px w-[85%] sm:w-60 shrink-0 snap-start justify-start! px-3"
          >
            <Plus size={16} aria-hidden="true" />
            Колонка
          </Button>
          {/* Правое поле прокрутки: без него последняя колонка упиралась бы в край. */}
          <span aria-hidden="true" className="w-px shrink-0" />
        </div>

        {/* Оверлей — в body: обёртка страницы с `animate-in` держит transform, и fixed-слой внутри неё уезжал бы вбок. */}
        {createPortal(
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div className="w-70.5 cursor-grabbing">
              <TaskCard task={activeTask} compact className="pr-7 ring-1! ring-accent! shadow-(--shadow-pop)!" />
            </div>
          ) : null}
        </DragOverlay>,
          document.body,
        )}
      </DndContext>

      {dialog?.mode === 'new' ? (
        <NameDialog
          title="Новая колонка"
          label="Название"
          placeholder="Например, на проверке"
          submitLabel="Создать"
          onSubmit={title => void createColumn(title)}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog?.mode === 'rename' ? (
        <NameDialog
          title="Переименовать колонку"
          label="Название"
          initial={dialog.column.title}
          onSubmit={title => void renameColumn(dialog.column, title)}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}
