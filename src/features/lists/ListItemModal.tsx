import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useRepo } from '@/data/hooks';
import type { ListItem } from '@/lib/types';
import { parsePrice } from './money';

/** Подробности пункта: заметка, ссылка, цена. */
export function ItemModal({
  item,
  currency,
  onClose,
}: {
  item: ListItem;
  currency: string;
  onClose: () => void;
}) {
  const { put, remove } = useRepo();
  const toast = useToast();
  const confirm = useConfirm();
  const [note, setNote] = useState(item.note ?? '');
  const [url, setUrl] = useState(item.url ?? '');
  const [price, setPrice] = useState(item.price === undefined ? '' : String(item.price));

  const submit = async () => {
    const parsed = parsePrice(price);
    if (parsed === null) {
      // Прежняя цена остаётся, окно не закрываем — строку можно поправить.
      toast('Цена не распознана', { kind: 'error' });
      return;
    }
    await put('listItems', {
      ...item,
      note: note.trim() || undefined,
      url: url.trim() || undefined,
      price: parsed,
    });
    toast('Сохранено');
    onClose();
  };

  const onDelete = async () => {
    if (!(await confirm(`Удалить пункт «${item.text}»?`))) return;
    await remove('listItems', item.id);
    toast('Пункт удалён');
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={item.text}
      footer={
        <div className="flex w-full items-center gap-2">
          <Button variant="danger-quiet" onClick={() => void onDelete()} className="mr-auto -ml-2">
            Удалить
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={() => void submit()}>
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
        <Textarea
          label="Заметка"
          rows={3}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Что важно помнить об этом пункте"
        />
        <Input
          label="Ссылка"
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://"
        />
        <Input
          label={`Цена, ${currency}`}
          inputMode="decimal"
          value={price}
          onChange={e => setPrice(e.target.value)}
          placeholder="45000"
          className="tabular-nums"
        />
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Сохранить
        </button>
      </form>
    </Modal>
  );
}
