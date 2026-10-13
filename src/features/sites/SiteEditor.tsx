import { useState } from 'react';
import type { Site } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { todayISO } from '@/lib/dates';
import { SITE_STATUSES, statusOf } from '@/lib/domain/sites';
import type { SiteStatus } from '@/lib/domain/sites';
import { parsePrice } from '@/features/lists/money';

/** Поля сайта, которые правит редактор; остальное (id, метки времени) страница сохраняет сама. */
export type SiteFields = Pick<Site, 'title' | 'note' | 'status' | 'client' | 'price' | 'doneAt'>;

/** Этап в выпадающем списке: для сайта он «реализован», а не «реализованные», как у вкладки. */
const STAGE_OPTION: Record<SiteStatus, string> = {
  meeting: 'Согласовать встречу',
  work: 'В работе',
  payment: 'Жду оплату',
  done: 'Реализован',
};

/**
 * Редактор сайта: этап, название, клиент, сумма сделки, «что это» и — у реализованного — дата сдачи.
 * Название обязательно. «Сохранить» применяет всё, «Отмена» ничего не меняет.
 */
export function SiteEditor({
  site,
  defaultStatus,
  onSave,
  onDelete,
  onClose,
}: {
  site: Site | null;
  /** Статус нового сайта: тот, на чьей вкладке нажали «+». */
  defaultStatus: SiteStatus;
  onSave: (fields: SiteFields) => Promise<void> | void;
  onDelete: (site: Site) => Promise<void> | void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(site?.title ?? '');
  const [note, setNote] = useState(site?.note ?? '');
  const [status, setStatus] = useState<SiteStatus>(site ? statusOf(site) : defaultStatus);
  const [client, setClient] = useState(site?.client ?? '');
  const [price, setPrice] = useState(site?.price != null ? String(site.price) : '');
  // Дата заранее — сегодняшняя: переключил на «Реализован» — и она уже стоит.
  const [doneAt, setDoneAt] = useState(site?.doneAt ?? todayISO());

  const submit = async () => {
    const name = title.trim();
    if (!name) return;
    let amount: number | undefined;
    if (price.trim()) {
      const parsed = parsePrice(price);
      if (!parsed || parsed <= 0) {
        toast('Сумма не распознана', { kind: 'error' });
        return;
      }
      amount = parsed;
    }
    await onSave({
      title: name,
      note: note.trim() || undefined,
      status,
      client: client.trim() || undefined,
      price: amount,
      doneAt: status === 'done' ? doneAt || todayISO() : undefined,
    });
    onClose();
  };

  const remove = async () => {
    if (!site) return;
    onClose();
    await onDelete(site);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={site ? 'Сайт' : 'Новый сайт'}
      footer={
        <div className="flex w-full items-center gap-2">
          {site ? (
            <Button variant="danger-quiet" className="mr-auto -ml-2" onClick={() => void remove()}>
              Удалить
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose} className={site ? '' : 'ml-auto'}>
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
        <Select label="Статус" value={status} onChange={e => setStatus(e.target.value as SiteStatus)}>
          {SITE_STATUSES.map(st => (
            <option key={st} value={st}>
              {STAGE_OPTION[st]}
            </option>
          ))}
        </Select>
        <Input label="Название" autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Например, сайт кофейни" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Клиент" value={client} onChange={e => setClient(e.target.value)} placeholder="Чей сайт" />
          <Input label="Сумма" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="200000" className="tabular-nums" />
        </div>
        {status === 'done' ? <Input label="Когда реализован" type="date" value={doneAt} onChange={e => setDoneAt(e.target.value)} /> : null}
        <Input label="Заметка" value={note} onChange={e => setNote(e.target.value)} placeholder="Что за сайт, о чём договорились" />
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Сохранить
        </button>
      </form>
    </Modal>
  );
}
