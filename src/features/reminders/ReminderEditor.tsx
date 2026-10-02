import { useState } from 'react';
import type { Reminder, Repeat } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { todayISO } from '@/lib/dates';
import { REPEAT_OPTIONS } from './grouping';

export function ReminderEditor({
  reminder,
  onSave,
  onDelete,
  onClose,
}: {
  reminder: Reminder | null;
  onSave: (patch: Pick<Reminder, 'text' | 'date' | 'time' | 'repeat'>) => Promise<void> | void;
  onDelete: (reminder: Reminder) => Promise<void> | void;
  onClose: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [text, setText] = useState(reminder?.text ?? '');
  const [date, setDate] = useState(reminder?.date ?? todayISO());
  const [time, setTime] = useState(reminder?.time ?? '');
  const [repeat, setRepeat] = useState<Repeat>(reminder?.repeat ?? 'none');

  const submit = async () => {
    const t = text.trim();
    if (!t || !date) return;
    await onSave({ text: t, date, time: time || undefined, repeat });
    toast('Сохранено');
    onClose();
  };

  const remove = async () => {
    if (!reminder) return;
    if (!(await confirm(`Удалить напоминание «${reminder.text}»?`))) return;
    await onDelete(reminder);
    toast('Напоминание удалено');
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={reminder ? 'Напоминание' : 'Новое напоминание'}
      footer={
        <div className="flex w-full items-center gap-2">
          {reminder ? (
            <Button variant="danger-quiet" className="mr-auto -ml-2" onClick={() => void remove()}>
              Удалить
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose} className={reminder ? '' : 'ml-auto'}>
            Отмена
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!text.trim() || !date}>
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
        <Input
          label="Текст"
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="О чём напомнить"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Дата" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <Input label="Время" type="time" value={time} onChange={e => setTime(e.target.value)} />
        </div>

        {/* Подсказка про ежегодный повтор стоит у самого поля даты — она о том, что туда вписать. */}
        {repeat === 'yearly' ? (
          <p className="-mt-2 text-caption text-muted">
            Укажи любую дату с нужным днём и месяцем, например дату рождения
          </p>
        ) : null}

        <Select label="Повтор" value={repeat} onChange={e => setRepeat(e.target.value as Repeat)}>
          {REPEAT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
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
