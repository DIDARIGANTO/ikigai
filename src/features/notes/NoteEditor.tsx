import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Folder, FolderInput, ListPlus, Send, SquareCheck, Target, Trash2 } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { IconButton } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useRepo } from '@/data/hooks';
import type { Goal, Note, Task } from '@/lib/types';
import { MoveToFolderModal, ToListModal } from './NoteDialogs';
import { wordCount, wordsLabel } from './templates';

/** «30 сент., 14:05» — когда заметку меняли в последний раз. */
function shortDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch {
    return '';
  }
}

const SAVE_DELAY = 500;

type Sheet = 'list' | 'folder' | null;

/** Тихая кнопка панели (ghost): иконка 16 и подпись 13; на узком экране подпись прячется, имя даёт aria-label. */
function ToolButton({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control px-2 text-small font-medium text-muted focus-ring press pointer-coarse:h-10 ${
        danger ? 'hover:bg-danger-soft hover:text-danger-strong' : 'hover:bg-fill hover:text-text'
      }`}
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}

/** Стрелки ←/→ ходят по кнопкам панели (role="toolbar"), Home/End — к краям. */
function onToolbarKey(e: KeyboardEvent<HTMLDivElement>) {
  const all = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
  const i = all.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  let next = -1;
  if (e.key === 'ArrowRight') next = (i + 1) % all.length;
  else if (e.key === 'ArrowLeft') next = (i - 1 + all.length) % all.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = all.length - 1;
  if (next < 0) return;
  e.preventDefault();
  all[next].focus();
}

export function NoteEditor({
  note,
  folderTitle,
  folderEmoji,
  onDeleted,
  onBack,
  onToTask,
  onToGoal,
}: {
  note: Note;
  /** Название папки заметки — для строки над заголовком. */
  folderTitle?: string;
  folderEmoji?: string;
  onDeleted: () => void;
  onBack: () => void;
  onToTask: (defaults: Partial<Task>) => void;
  onToGoal: (defaults: Partial<Goal>) => void;
}) {
  const { put, remove } = useRepo();
  const toast = useToast();
  const confirm = useConfirm();

  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [saved, setSaved] = useState(true);
  const [sheet, setSheet] = useState<Sheet>(null);

  // Свежая версия заметки для записи: подписка обновляет её после каждого сохранения.
  const noteRef = useRef(note);
  useEffect(() => {
    noteRef.current = note;
  });
  const pending = useRef<{ title: string; body: string } | null>(null);
  // Номер последней правки: «Сохранено» показываем, только если после записи ничего не набрали.
  const editSeq = useRef(0);

  const flush = useCallback(() => {
    const patch = pending.current;
    pending.current = null;
    if (!patch) return;
    const seq = editSeq.current;
    const done = () => {
      if (editSeq.current === seq) setSaved(true);
    };
    const current = noteRef.current;
    if (patch.title === current.title && patch.body === current.body) {
      done();
      return;
    }
    void put('notes', { ...current, ...patch }).then(done);
  }, [put]);

  // Автосохранение: таймер перезапускается на каждое нажатие.
  useEffect(() => {
    const current = noteRef.current;
    if (title === current.title && body === current.body) {
      pending.current = null;
      editSeq.current += 1;
      setSaved(true);
      return;
    }
    pending.current = { title, body };
    editSeq.current += 1;
    setSaved(false);
    const timer = window.setTimeout(flush, SAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [title, body, flush]);

  // Уход с заметки не должен терять последние символы.
  useEffect(() => () => flush(), [flush]);

  const noteTitle = title.trim() || 'Без названия';

  const onDelete = async () => {
    if (!(await confirm(`Удалить заметку «${noteTitle}»?`))) return;
    pending.current = null;
    await remove('notes', note.id);
    toast('Заметка удалена');
    onDeleted();
  };

  const moveToFolder = async (folderId: string | undefined) => {
    // Пишем один раз вместе с несохранённым текстом, иначе две записи могут разойтись по времени.
    pending.current = null;
    setSaved(true);
    await put('notes', { ...noteRef.current, title, body, folderId });
    toast('Заметка перенесена');
    setSheet(null);
  };

  const words = wordCount(`${title} ${body}`);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-2 md:px-3">
        <IconButton size="sm" aria-label="К списку заметок" onClick={onBack} className="md:hidden">
          <ArrowLeft size={16} />
        </IconButton>
        {/* Тихая панель из кнопок-призраков: действия с заметкой не спорят с текстом. */}
        <div
          role="toolbar"
          aria-label="Действия с заметкой"
          onKeyDown={onToolbarKey}
          className="ml-auto flex min-w-0 items-center gap-0.5 overflow-x-auto scroll-thin"
        >
          <ToolButton
            icon={<SquareCheck size={16} aria-hidden="true" />}
            label="Задача"
            onClick={() => onToTask({ title: noteTitle, notes: body.trim() || undefined })}
          />
          <ToolButton
            icon={<Target size={16} aria-hidden="true" />}
            label="Цель"
            onClick={() => onToGoal({ title: noteTitle, description: body.trim() || undefined })}
          />
          <ToolButton icon={<ListPlus size={16} aria-hidden="true" />} label="В список" onClick={() => setSheet('list')} />
          <ToolButton
            icon={<FolderInput size={16} aria-hidden="true" />}
            label="Переместить"
            onClick={() => setSheet('folder')}
          />
          <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border-strong" />
          <ToolButton icon={<Trash2 size={16} aria-hidden="true" />} label="Удалить" danger onClick={() => void onDelete()} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scroll-thin px-5 pt-6 pb-4 md:px-12 md:pt-8">
        <div className="mx-auto flex w-full max-w-180 min-h-0 flex-1 flex-col">
          <p className="flex items-center gap-1.5 text-caption text-muted">
            {folderEmoji ? (
              <span aria-hidden="true" className="font-emoji leading-none">{folderEmoji}</span>
            ) : (
              <Folder size={12} aria-hidden="true" />
            )}
            {folderTitle ?? 'Без папки'}
            {note.source === 'telegram' ? (
              <span className="inline-flex items-center gap-1">
                · <Send size={12} aria-hidden="true" /> из Telegram
              </span>
            ) : null}
          </p>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            aria-label="Заголовок заметки"
            placeholder="Без названия"
            className="mt-2 w-full border-none bg-transparent text-h1 font-semibold text-text outline-none placeholder:text-muted"
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            aria-label="Текст заметки"
            placeholder="Мысли, идеи, черновики. Строка «- [ ] » — пункт списка дел."
            className="mt-4 min-h-60 w-full flex-1 resize-none border-none bg-transparent text-body leading-6 text-text outline-none scroll-thin placeholder:text-muted"
          />
        </div>
      </div>

      {/* Подвал: число слов моноширинными цифрами, когда меняли, и тихое «Сохранено». */}
      <div className="flex h-10 shrink-0 items-center border-t border-border px-5 text-caption text-muted md:px-12">
        <div className="mx-auto flex w-full max-w-180 items-center gap-3">
          <span className="whitespace-nowrap">
            <span className="font-mono tabular-nums">{words}</span> {wordsLabel(words).replace(/^\d+\s/, '')}
          </span>
          <span aria-hidden="true" className="max-sm:hidden">·</span>
          <span className="truncate max-sm:hidden">
            изменено <span className="font-mono tabular-nums">{shortDateTime(note.updatedAt)}</span>
          </span>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap" aria-live="polite">
            {saved ? <Check size={12} aria-hidden="true" /> : null}
            {saved ? 'Сохранено' : 'Сохраняю…'}
          </span>
        </div>
      </div>

      <ToListModal open={sheet === 'list'} noteTitle={noteTitle} onClose={() => setSheet(null)} />

      <MoveToFolderModal
        open={sheet === 'folder'}
        folderId={note.folderId}
        onMove={folderId => void moveToFolder(folderId)}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}
