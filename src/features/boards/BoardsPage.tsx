import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Board } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { useToast } from '@/components/ui/Toast';
import { useCollection, useRepo } from '@/data/hooks';
import { newId, nowISO } from '@/lib/ids';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import { useTaskEditor } from '@/features/tasks/TaskEditor';
import { BoardView } from './BoardView';
import { KINDS, KIND_LABEL } from './boardOps';
import { Menu } from '@/components/ui/Menu';
import { Segmented } from '@/components/ui/Segmented';
import { NameDialog } from './NameDialog';

type Dialog = { mode: 'new' } | { mode: 'rename'; board: Board } | null;

export function BoardsPage() {
  const boards = useCollection('boards');
  const { tasks } = useTaskActionsCtx();
  const allColumns = useCollection('columns');
  const { put, remove } = useRepo();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [dialog, setDialog] = useState<Dialog>(null);
  const { open, editor } = useTaskEditor();

  const sorted = useMemo(() => [...boards].sort((a, b) => a.position - b.position), [boards]);
  /** Незакрытые задачи каждой доски — число рядом с названием в переключателе. */
  const openCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (!t.boardId || t.status === 'done' || t.status === 'skipped') continue;
      map.set(t.boardId, (map.get(t.boardId) ?? 0) + 1);
    }
    return map;
  }, [tasks]);
  const requested = params.get('board');
  const board = sorted.find(b => b.id === requested) ?? sorted[0];

  const select = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params);
      next.set('board', id);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  // Доски приходят из хранилища не сразу: пустой список в первый миг — это загрузка, а не «досок нет».
  const loadedOnce = useRef(false);

  // Ссылка на удалённую (или чужую) доску не должна висеть в адресе: приводим её к той доске, что показана.
  useEffect(() => {
    if (sorted.length) loadedOnce.current = true;
    if (!requested || requested === board?.id) return;
    if (!board && !loadedOnce.current) return;
    const next = new URLSearchParams(params);
    if (board) next.set('board', board.id);
    else next.delete('board');
    setParams(next, { replace: true });
  }, [requested, board, sorted.length, params, setParams]);

  const createBoard = async (title: string) => {
    const now = nowISO();
    const id = newId();
    await put('boards', { id, title, position: (sorted.at(-1)?.position ?? -1) + 1, createdAt: now, updatedAt: now });
    // Три колонки новой доски — те же, что заводит `ensureDefaults`.
    for (const [i, kind] of KINDS.entries()) {
      await put('columns', {
        id: newId(), boardId: id, title: KIND_LABEL[kind], kind, position: i, createdAt: now, updatedAt: now,
      });
    }
    select(id);
    toast('Доска создана');
  };

  const renameBoard = async (target: Board, title: string) => {
    await put('boards', { ...target, title });
  };

  const deleteBoard = async (target: Board) => {
    if (!(await confirm(`Удалить доску «${target.title}»? Задачи останутся, но потеряют доску.`))) return;
    for (const task of tasks) {
      if (task.boardId === target.id) await put('tasks', { ...task, boardId: undefined, columnId: undefined });
    }
    for (const column of allColumns) {
      if (column.boardId === target.id) await remove('columns', column.id);
    }
    await remove('boards', target.id);
    const next = sorted.find(b => b.id !== target.id);
    if (next) select(next.id);
    toast('Доска удалена');
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Доски"
        icon={<SectionIcon k="boards" size={20} />}
        description="Колонки, по которым движется работа"
      />

      {sorted.length ? (
        <div className="mt-6 flex items-center gap-2 min-w-0">
          {/* Переключатель досок — сегменты; на узком экране дорожка прокручивается вбок. */}
          <Segmented
            kind="tabs"
            label="Доски"
            value={board?.id ?? ''}
            onChange={select}
            className="min-w-0"
            options={sorted.map(b => {
              const open = openCount.get(b.id) ?? 0;
              return {
                value: b.id,
                label: b.title,
                count: open || undefined,
                ariaLabel: open ? `${b.title}, открытых задач: ${open}` : undefined,
              };
            })}
          />
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setDialog({ mode: 'new' })}>
            <Plus size={16} aria-hidden="true" />
            Доска
          </Button>
          {board ? (
            <Menu
              label={`Доска «${board.title}»`}
              className="ml-auto shrink-0"
              entries={[
                { type: 'item', label: 'Переименовать', icon: <Pencil size={14} />, onSelect: () => setDialog({ mode: 'rename', board }) },
                { type: 'separator' },
                { type: 'item', label: 'Удалить доску', icon: <Trash2 size={14} />, danger: true, onSelect: () => void deleteBoard(board) },
              ]}
            />
          ) : null}
        </div>
      ) : null}

      {board ? (
        <div className="mt-5">
          <BoardView key={board.id} board={board} onOpenTask={task => open(task)} />
        </div>
      ) : (
        <EmptyState
          k="boards"
          title="Пока нет досок"
          description="Доска — это колонки, по которым движется работа: надо, в работе, готово"
          action={
            <Button variant="primary" onClick={() => setDialog({ mode: 'new' })}>
              Создать доску
            </Button>
          }
        />
      )}

      {dialog?.mode === 'new' ? (
        <NameDialog
          title="Новая доска"
          label="Название"
          placeholder="Например, учёба"
          submitLabel="Создать"
          onSubmit={title => void createBoard(title)}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog?.mode === 'rename' ? (
        <NameDialog
          title="Переименовать доску"
          label="Название"
          initial={dialog.board.title}
          onSubmit={title => void renameBoard(dialog.board, title)}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {editor}
    </div>
  );
}
