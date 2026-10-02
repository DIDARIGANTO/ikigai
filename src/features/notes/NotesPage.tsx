import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText, Folder, FolderPlus, Inbox, Lightbulb, ListChecks, Pencil, Search, Send } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { useCollection, useRepo } from '@/data/hooks';
import { formatShortRu } from '@/lib/dates';
import { newId, nowISO } from '@/lib/ids';
import type { Goal, Note, NoteFolder, Task } from '@/lib/types';
import { useGoalEditor } from '@/features/goals/GoalEditor';
import { useTaskEditor } from '@/features/tasks/TaskEditor';
import { FolderModal, NewFolderModal } from './NoteDialogs';
import { NoteEditor } from './NoteEditor';
import { NewNoteMenu } from './NewNoteMenu';
import { NOTE_TEMPLATES, noteTemplate } from './templates';
import type { NoteTemplateKey } from './templates';

type Pane = 'folders' | 'list' | 'editor';

const TEMPLATE_ICONS: Record<NoteTemplateKey, typeof FileText> = { blank: FileText, todo: ListChecks, idea: Lightbulb };

/** Заголовок строки в списке: своё название или первая строка текста. */
function rowTitle(note: Note): string {
  if (note.title.trim()) return note.title;
  const line = note.body
    .split('\n')
    .map(s => s.trim())
    .find(Boolean);
  return line ? (line.length > 60 ? `${line.slice(0, 59)}…` : line) : 'Без названия';
}

/** Две строки превью: текст без той строки, что уже стала заголовком. */
function rowPreview(note: Note): string {
  const lines = note.body
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  const rest = note.title.trim() ? lines : lines.slice(1);
  return rest.join(' ').slice(0, 180);
}

function shortDate(iso: string): string {
  try {
    return formatShortRu(iso.slice(0, 10));
  } catch {
    return '';
  }
}

const COLUMN_HEAD = 'flex h-12 shrink-0 items-center gap-2 border-b border-border px-4';
const FOCUS = 'focus-ring';

export function NotesPage() {
  const notes = useCollection('notes');
  const folders = useCollection('noteFolders');
  const { put } = useRepo();
  const [params, setParams] = useSearchParams();
  const { open: openTask, editor: taskEditor } = useTaskEditor();
  const { open: openGoal, editor: goalEditor } = useGoalEditor();

  const [folderId, setFolderId] = useState<string>('all');
  const [query, setQuery] = useState('');
  // Открытая по ссылке заметка (`?note=`) на телефоне сразу показывает редактор.
  const [pane, setPane] = useState<Pane>(() => (params.get('note') ? 'editor' : 'list'));
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);

  const ordered = useMemo(() => [...folders].sort((a, b) => a.position - b.position), [folders]);
  const folderById = useMemo(() => new Map(folders.map(f => [f.id, f])), [folders]);
  const folderTitle = useCallback(
    (id: string | undefined) => (id ? folders.find(f => f.id === id)?.title : undefined),
    [folders],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter(n => (folderId === 'all' ? true : n.folderId === folderId))
      .filter(n => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [notes, folderId, query]);

  const selectedId = params.get('note');
  const selected = selectedId ? (notes.find(n => n.id === selectedId) ?? null) : null;

  const select = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(params);
      if (id) next.set('note', id);
      else next.delete('note');
      setParams(next, { replace: true });
      if (id) setPane('editor');
    },
    [params, setParams],
  );

  // Переход из поиска (`/notes?note=id`) должен сразу открыть редактор и на телефоне.
  // Сравнение с прошлым адресом в рендере дешевле эффекта с ещё одним проходом.
  const [lastSelected, setLastSelected] = useState(selectedId);
  if (selectedId !== lastSelected) {
    setLastSelected(selectedId);
    if (selectedId) setPane('editor');
  }

  const addNote = async (key: NoteTemplateKey = 'blank') => {
    const now = nowISO();
    const template = noteTemplate(key);
    const note: Note = {
      id: newId(),
      // «Все» — это не папка: новая заметка остаётся без папки, а не падает в первую.
      folderId: folderId === 'all' ? undefined : folderId,
      title: template.title,
      body: template.body,
      source: 'web',
      createdAt: now,
      updatedAt: now,
    };
    await put('notes', note);
    select(note.id);
  };

  const toTask = (defaults: Partial<Task>) => openTask(null, defaults);
  // Цель не создаём молча: открываем редактор с заголовком и текстом заметки.
  const toGoal = (defaults: Partial<Goal>) => openGoal(null, defaults);

  /** Строка папки 32 px: эмодзи символом в строке или приглушённая иконка, название, число заметок. */
  const folderRow = (id: string, label: string, count: number, editable: NoteFolder | null) => {
    const emoji = editable?.emoji;
    const active = folderId === id;
    return (
      <div key={id} className={`group flex items-center rounded-control ${active ? 'bg-fill-strong' : 'hover:bg-fill'}`}>
        <button
          type="button"
          aria-current={active ? 'true' : undefined}
          onClick={() => {
            setFolderId(id);
            setPane('list');
          }}
          className={`flex h-8 min-w-0 flex-1 items-center gap-2 rounded-control px-2 text-left text-body pointer-coarse:h-11 ${FOCUS} ${
            active ? 'text-text' : 'text-muted-strong hover:text-text'
          }`}
        >
          <span aria-hidden="true" className="inline-flex w-4 shrink-0 justify-center text-muted">
            {emoji ? (
              <span className="font-emoji text-sm leading-none">{emoji}</span>
            ) : id === 'all' ? (
              <Inbox size={16} />
            ) : (
              <Folder size={16} />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span
            className={`shrink-0 font-mono text-caption text-muted tabular-nums ${editable ? '[@media(hover:hover)]:group-hover:hidden [@media(hover:hover)]:group-focus-within:hidden max-[1023px]:hidden' : ''}`}
          >
            {count}
          </span>
        </button>
        {editable ? (
          <IconButton
            size="sm"
            aria-label={`Настроить папку «${editable.title}»`}
            onClick={() => setEditingFolder(editable.id)}
            className="mr-0.5 size-7! hidden! max-[1023px]:inline-flex! [@media(hover:hover)]:group-hover:inline-flex! [@media(hover:hover)]:group-focus-within:inline-flex!"
          >
            <Pencil size={14} />
          </IconButton>
        ) : null}
      </div>
    );
  };

  const editingFolderRow = editingFolder ? (ordered.find(f => f.id === editingFolder) ?? null) : null;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col h-[calc(100dvh-168px)] md:h-[calc(100dvh-72px)]">
      <PageHeader
        title="Блокнот"
        icon={<SectionIcon k="notes" size={20} />}
        description="Мысли, черновики и заметки из Telegram"
        actions={
          <NewNoteMenu onPick={key => void addNote(key)} />
        }
      />
      {/* Три панели в одной рамке с линией: папки · заметки · редактор, разделены тонкими линиями. */}
      <div className="mt-6 flex min-h-0 flex-1 overflow-hidden rounded-card border border-border bg-surface">
        {/* Папки */}
        <div
          className={`${pane === 'folders' ? 'flex' : 'hidden'} min-h-0 w-full flex-col md:flex md:w-52 md:shrink-0 md:border-r md:border-border`}
        >
          <div className={COLUMN_HEAD}>
            <h2 className="text-title font-semibold text-text">Папки</h2>
            <IconButton
              size="sm"
              aria-label="Новая папка"
              title="Новая папка"
              onClick={() => setCreatingFolder(true)}
              className="ml-auto -mr-2"
            >
              <FolderPlus size={16} />
            </IconButton>
          </div>
          <nav aria-label="Папки" className="min-h-0 flex-1 space-y-px overflow-y-auto scroll-thin p-2">
            {folderRow('all', 'Все заметки', notes.length, null)}
            {ordered.map(f => folderRow(f.id, f.title, notes.filter(n => n.folderId === f.id).length, f))}
          </nav>
        </div>

        {/* Список заметок */}
        <div
          className={`${pane === 'list' ? 'flex' : 'hidden'} min-h-0 w-full flex-col md:flex md:w-76 md:shrink-0 md:border-r md:border-border`}
        >
          <div className={COLUMN_HEAD}>
            <IconButton aria-label="К папкам" size="sm" onClick={() => setPane('folders')} className="-ml-2 md:hidden">
              <ArrowLeft size={16} />
            </IconButton>
            <label className="group flex h-8 min-w-0 flex-1 items-center gap-2 rounded-control bg-fill px-2.5 focus-within:outline-2 focus-within:outline-accent">
              <Search size={14} aria-hidden="true" className="shrink-0 text-muted" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                aria-label="Поиск по заметкам"
                placeholder="Поиск"
                className="min-w-0 flex-1 bg-transparent text-small outline-none placeholder:text-muted"
              />
            </label>
            <NewNoteMenu variant="icon" onPick={key => void addNote(key)} />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
            {visible.length ? (
              <ul>
                {visible.map(note => {
                  const active = note.id === selectedId;
                  const preview = rowPreview(note);
                  const folder = folderId === 'all' && note.folderId ? folderById.get(note.folderId) : undefined;
                  return (
                    <li key={note.id} className="border-b border-border">
                      {/* Строка заметки: заголовок 14 и дата моноширинными цифрами, ниже две строки превью. */}
                      <button
                        type="button"
                        aria-current={active ? 'true' : undefined}
                        onClick={() => select(note.id)}
                        className={`block min-h-14 w-full px-4 py-2.5 text-left focus-ring-inset ${active ? 'bg-fill-strong' : 'hover:bg-fill'}`}
                      >
                        <span className="flex items-baseline gap-3">
                          <span className="min-w-0 flex-1 truncate text-title font-semibold text-text">{rowTitle(note)}</span>
                          <span className="flex shrink-0 items-center gap-1.5 font-mono text-caption text-muted tabular-nums">
                            {note.source === 'telegram' ? <Send size={12} aria-label="Из Telegram" /> : null}
                            {shortDate(note.updatedAt)}
                          </span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 text-small text-muted">{preview || 'Нет текста'}</span>
                        {folder ? (
                          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-caption text-muted">
                            {folder.emoji ? (
                              <span aria-hidden="true" className="font-emoji leading-none">{folder.emoji}</span>
                            ) : (
                              <Folder size={12} aria-hidden="true" />
                            )}
                            <span className="truncate">{folder.title}</span>
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={query.trim() ? <Search size={16} /> : undefined}
                k={query.trim() ? undefined : 'notes'}
                title={query.trim() ? 'Ничего не найдено' : 'Заметок пока нет'}
                description={query.trim() ? 'Попробуй другое слово.' : 'Новая заметка — кнопкой сверху.'}
              />
            )}
          </div>
        </div>

        {/* Редактор */}
        <div className={`${pane === 'editor' ? 'flex' : 'hidden'} min-h-0 w-full min-w-0 flex-col md:flex md:flex-1`}>
          {selected ? (
            <NoteEditor
              key={selected.id}
              note={selected}
              folderTitle={folderTitle(selected.folderId)}
              folderEmoji={selected.folderId ? folderById.get(selected.folderId)?.emoji : undefined}
              onBack={() => setPane('list')}
              onDeleted={() => {
                select(null);
                setPane('list');
              }}
              onToTask={toTask}
              onToGoal={toGoal}
            />
          ) : (
            <EmptyState
              k="notes"
              title="Заметка не выбрана"
              description="Выбери заметку в списке или начни с шаблона."
              className="m-auto"
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {NOTE_TEMPLATES.map(t => {
                    const Icon = TEMPLATE_ICONS[t.key];
                    return (
                      <Button key={t.key} size="sm" onClick={() => void addNote(t.key)}>
                        <Icon size={16} aria-hidden="true" />
                        {t.label}
                      </Button>
                    );
                  })}
                </div>
              }
            />
          )}
        </div>
      </div>

      <NewFolderModal
        open={creatingFolder}
        onClose={() => setCreatingFolder(false)}
        nextPosition={ordered.reduce((m, f) => Math.max(m, f.position + 1), 0)}
      />
      {editingFolderRow ? (
        <FolderModal key={editingFolderRow.id} folder={editingFolderRow} onClose={() => setEditingFolder(null)} />
      ) : null}
      {taskEditor}
      {goalEditor}
    </div>
  );
}
