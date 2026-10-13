import { useState } from 'react';
import type { Idea } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { IDEA_STATUSES, statusOf } from '@/lib/domain/ideas';
import type { IdeaStatus } from '@/lib/domain/ideas';

/** Поля идеи, которые правит редактор; остальное (id, метки времени, откуда пришла) страница сохраняет сама. */
export type IdeaFields = Pick<Idea, 'title' | 'note' | 'status'>;

/** Этап в выпадающем списке: для идеи он «реализована», а не «реализованные», как у вкладки. */
const STAGE_OPTION: Record<IdeaStatus, string> = { new: 'Новая', work: 'В работе', done: 'Реализована' };

/**
 * Редактор идеи: название, заметка и этап. Название обязательно. «Сохранить» применяет всё, «Отмена» ничего не меняет.
 * Быстро записать идею можно и без него — строкой над списком.
 */
export function IdeaEditor({
  idea,
  defaultStatus,
  onSave,
  onDelete,
  onClose,
}: {
  idea: Idea | null;
  /** Этап новой идеи: тот, на чьей вкладке нажали «+». */
  defaultStatus: IdeaStatus;
  onSave: (fields: IdeaFields) => Promise<void> | void;
  onDelete: (idea: Idea) => Promise<void> | void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(idea?.title ?? '');
  const [note, setNote] = useState(idea?.note ?? '');
  const [status, setStatus] = useState<IdeaStatus>(idea ? statusOf(idea) : defaultStatus);

  const submit = async () => {
    const name = title.trim();
    if (!name) return;
    await onSave({ title: name, note: note.trim() || undefined, status });
    onClose();
  };

  const remove = async () => {
    if (!idea) return;
    onClose();
    await onDelete(idea);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={idea ? 'Идея' : 'Новая идея'}
      footer={
        <div className="flex w-full items-center gap-2">
          {idea ? (
            <Button variant="danger-quiet" className="mr-auto -ml-2" onClick={() => void remove()}>
              Удалить
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose} className={idea ? '' : 'ml-auto'}>
            Отмена
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={title.trim() === ''}>
            Сохранить
          </Button>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input label="Название" autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Что пришло в голову" />
        <Textarea label="Заметка" rows={5} value={note} onChange={e => setNote(e.target.value)} placeholder="Подробности, с чего начать, кому показать" />
        <Select label="Статус" value={status} onChange={e => setStatus(e.target.value as IdeaStatus)}>
          {IDEA_STATUSES.map(st => (
            <option key={st} value={st}>
              {STAGE_OPTION[st]}
            </option>
          ))}
        </Select>
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Сохранить
        </button>
      </form>
    </Modal>
  );
}
