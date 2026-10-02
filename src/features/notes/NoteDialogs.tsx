import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Folder } from 'lucide-react';
import { EmojiPickerButton } from '@/components/ui/EmojiPicker';
import { FieldLabel, Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useCollection, useRepo } from '@/data/hooks';
import { newId, nowISO } from '@/lib/ids';
import type { NoteFolder } from '@/lib/types';

/** Переименование и удаление папки. Заметки удалённой папки остаются без папки. */
export function FolderModal({ folder, onClose }: { folder: NoteFolder; onClose: () => void }) {
  const { put, remove } = useRepo();
  const notes = useCollection('notes');
  const toast = useToast();
  const confirm = useConfirm();
  const [title, setTitle] = useState(folder.title);
  const [emoji, setEmoji] = useState(folder.emoji);

  const submit = async () => {
    const value = title.trim();
    if (!value) return;
    await put('noteFolders', { ...folder, title: value, emoji });
    onClose();
  };

  const onDelete = async () => {
    const inside = notes.filter(n => n.folderId === folder.id);
    const tail = inside.length ? ` Заметки (${inside.length}) останутся без папки.` : '';
    if (!(await confirm(`Удалить папку «${folder.title}»?${tail}`))) return;
    for (const note of inside) await put('notes', { ...note, folderId: undefined });
    await remove('noteFolders', folder.id);
    toast('Папка удалена');
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Папка"
      footer={
        <div className="flex w-full items-center gap-2">
          <Button variant="danger-quiet" onClick={() => void onDelete()} className="mr-auto -ml-2">
            Удалить
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!title.trim()}>
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
        <FieldLabel htmlFor="folder-title">Название</FieldLabel>
        <div className="flex items-center gap-2">
          <EmojiPickerButton value={emoji} onChange={setEmoji} label="Эмодзи папки" fallback={<Folder size={16} aria-hidden="true" />} />
          <Input id="folder-title" autoFocus value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Сохранить
        </button>
      </form>
    </Modal>
  );
}

/** Создание папки. `nextPosition` держит порядок списка слева. */
export function NewFolderModal({
  open,
  onClose,
  nextPosition,
}: {
  open: boolean;
  onClose: () => void;
  nextPosition: number;
}) {
  const { put } = useRepo();
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState<string | undefined>(undefined);

  const submit = async () => {
    const value = title.trim();
    if (!value) return;
    const now = nowISO();
    await put('noteFolders', {
      id: newId(),
      title: value,
      position: nextPosition,
      ...(emoji ? { emoji } : {}),
      createdAt: now,
      updatedAt: now,
    });
    setTitle('');
    setEmoji(undefined);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новая папка"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!title.trim()}>
            Создать
          </Button>
        </>
      }
    >
      <form
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        <FieldLabel htmlFor="new-folder-title">Название</FieldLabel>
        <div className="flex items-center gap-2">
          <EmojiPickerButton value={emoji} onChange={setEmoji} label="Эмодзи папки" fallback={<Folder size={16} aria-hidden="true" />} />
          <Input
            id="new-folder-title"
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Идеи, работа, цитаты"
          />
        </div>
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Создать
        </button>
      </form>
    </Modal>
  );
}

/** «→ В список»: выбор списка, пунктом становится заголовок заметки. */
export function ToListModal({ open, noteTitle, onClose }: { open: boolean; noteTitle: string; onClose: () => void }) {
  const { put } = useRepo();
  const toast = useToast();
  const lists = useCollection('lists');
  const listItems = useCollection('listItems');
  const [listId, setListId] = useState('');

  const submit = async () => {
    const target = listId || lists[0]?.id;
    if (!target) {
      toast('Сначала создай список', { kind: 'error' });
      return;
    }
    const now = nowISO();
    const position = listItems.filter(i => i.listId === target).reduce((m, i) => Math.max(m, i.position + 1), 0);
    await put('listItems', { id: newId(), listId: target, text: noteTitle, position, createdAt: now, updatedAt: now });
    toast(`Пункт добавлен в «${lists.find(l => l.id === target)?.title ?? 'список'}»`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить в список"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!lists.length}>
            Добавить
          </Button>
        </>
      }
    >
      <Select label="Список" value={listId || lists[0]?.id || ''} onChange={e => setListId(e.target.value)} autoFocus>
        {lists.length ? null : <option value="">Нет списков</option>}
        {lists.map(l => (
          <option key={l.id} value={l.id}>
            {l.title}
          </option>
        ))}
      </Select>
      <p className="mt-3 text-caption text-muted">Пунктом станет заголовок заметки: «{noteTitle}».</p>
    </Modal>
  );
}

/** Перенос заметки в папку: сам перенос делает редактор — вместе с несохранённым текстом. */
export function MoveToFolderModal({
  open,
  folderId,
  onMove,
  onClose,
}: {
  open: boolean;
  folderId: string | undefined;
  onMove: (folderId: string | undefined) => void;
  onClose: () => void;
}) {
  const folders = useCollection('noteFolders');
  const [value, setValue] = useState(folderId ?? '');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Переместить в папку"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={() => onMove(value || undefined)}>
            Переместить
          </Button>
        </>
      }
    >
      <Select label="Папка" value={value} onChange={e => setValue(e.target.value)} autoFocus>
        <option value="">Без папки</option>
        {[...folders]
          .sort((a, b) => a.position - b.position)
          .map(f => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
      </Select>
    </Modal>
  );
}
