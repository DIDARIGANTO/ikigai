import { useState } from 'react';
import { X } from 'lucide-react';
import type { Site, SitePayment } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Button, IconButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { formatShortRu, todayISO } from '@/lib/dates';
import { SITE_STATUSES, statusOf } from '@/lib/domain/sites';
import type { SiteStatus } from '@/lib/domain/sites';
import { parsePrice } from '@/features/lists/money';
import { formatDebtAmount } from '@/features/debts/money';

/** Поля сайта, которые правит редактор; остальное (id, метки времени) страница сохраняет сама. */
export type SiteFields = Pick<Site, 'title' | 'note' | 'status' | 'client' | 'price' | 'payments' | 'doneAt'>;

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
  currency,
  onSave,
  onDelete,
  onClose,
}: {
  site: Site | null;
  /** Статус нового сайта: тот, на чьей вкладке нажали «+». */
  defaultStatus: SiteStatus;
  /** Валюта профиля: в ней показаны платежи. */
  currency: string;
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
  const [payments, setPayments] = useState<SitePayment[]>(site?.payments ?? []);
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
      // Нет платежей — и поля нет: пустой список в каждой записи ни к чему.
      payments: payments.length ? payments : undefined,
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
        {payments.length ? (
          <section aria-label="Платежи">
            <h3 className="mb-1.5 label-text text-muted-strong">Платежи</h3>
            <ul className="divide-y divide-border rounded-control border border-border">
              {payments.map(p => (
                <li key={p.id} className="flex h-10 items-center gap-3 pl-3 pr-1">
                  <span className="w-16 shrink-0 text-small text-muted">{formatShortRu(p.date)}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-body tabular-nums text-text">{formatDebtAmount(p.amount, currency)}</span>
                  {p.note ? <span className="hidden min-w-0 truncate text-small text-muted sm:inline">{p.note}</span> : null}
                  <IconButton
                    size="sm"
                    variant="ghost"
                    aria-label={`Убрать платёж от ${formatShortRu(p.date)}`}
                    onClick={() => setPayments(list => list.filter(x => x.id !== p.id))}
                  >
                    <X size={16} aria-hidden="true" />
                  </IconButton>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Сохранить
        </button>
      </form>
    </Modal>
  );
}
