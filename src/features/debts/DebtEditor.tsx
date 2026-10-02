import { useState } from 'react';
import { X } from 'lucide-react';
import type { Debt, DebtDirection, DebtPayment } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Button, IconButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import type { SegmentOption } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { DIRECTION_LABEL } from '@/lib/domain/debts';
import { formatShortRu, todayISO } from '@/lib/dates';
import { parsePrice } from '@/features/lists/money';
import { currencyOptions, formatDebtAmount } from './money';

/** Поля долга, которые правит редактор; остальное (id, метки времени, закрытие) страница сохраняет сама. */
export type DebtFields = Pick<Debt, 'direction' | 'person' | 'amount' | 'currency' | 'date' | 'dueDate' | 'note' | 'payments'>;

const DIRECTION_OPTIONS: SegmentOption<DebtDirection>[] = [
  { value: 'owedToMe', label: DIRECTION_LABEL.owedToMe },
  { value: 'iOwe', label: DIRECTION_LABEL.iOwe },
];

/**
 * Редактор долга: направление, имя, сумма с валютой, даты и «за что». У существующего долга ниже видны возвраты —
 * лишний можно убрать. Всё применяется кнопкой «Сохранить»; «Отмена» ничего не меняет.
 */
export function DebtEditor({
  debt,
  defaultDirection,
  defaultCurrency,
  onSave,
  onDelete,
  onClose,
}: {
  debt: Debt | null;
  defaultDirection: DebtDirection;
  defaultCurrency: string;
  onSave: (fields: DebtFields) => Promise<void> | void;
  onDelete: (debt: Debt) => Promise<void> | void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? defaultDirection);
  const [person, setPerson] = useState(debt?.person ?? '');
  const [amount, setAmount] = useState(debt ? String(debt.amount) : '');
  const [currency, setCurrency] = useState(debt?.currency ?? defaultCurrency);
  const [date, setDate] = useState(debt?.date ?? todayISO());
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? '');
  const [note, setNote] = useState(debt?.note ?? '');
  const [payments, setPayments] = useState<DebtPayment[]>(debt?.payments ?? []);

  const canSave = person.trim() !== '' && amount.trim() !== '' && date !== '';

  const submit = async () => {
    const who = person.trim();
    if (!who || !date) return;
    const parsed = parsePrice(amount);
    if (!parsed || parsed <= 0) {
      // Окно не закрываем: сумму можно поправить.
      toast('Сумма не распознана', { kind: 'error' });
      return;
    }
    await onSave({
      direction,
      person: who,
      amount: parsed,
      currency,
      date,
      dueDate: dueDate || undefined,
      note: note.trim() || undefined,
      payments,
    });
    onClose();
  };

  const remove = async () => {
    if (!debt) return;
    onClose();
    await onDelete(debt);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={debt ? 'Долг' : 'Новый долг'}
      footer={
        <div className="flex w-full items-center gap-2">
          {debt ? (
            <Button variant="danger-quiet" className="mr-auto -ml-2" onClick={() => void remove()}>
              Удалить
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose} className={debt ? '' : 'ml-auto'}>
            Отмена
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!canSave}>
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
        <Segmented
          label="Чей долг"
          value={direction}
          onChange={setDirection}
          options={DIRECTION_OPTIONS}
          fullWidth
        />

        <Input
          label={direction === 'owedToMe' ? 'Кто должен' : 'Кому должен'}
          autoFocus
          value={person}
          onChange={e => setPerson(e.target.value)}
          placeholder="Имя"
        />

        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
          <Input
            label="Сумма"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="50000"
            className="tabular-nums"
          />
          <Select label="Валюта" value={currency} onChange={e => setCurrency(e.target.value)}>
            {currencyOptions(currency).map(o => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Дата долга" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <Input label="Вернуть до" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>

        <Input label="За что" value={note} onChange={e => setNote(e.target.value)} placeholder="Например, на ремонт" />

        {payments.length ? (
          <section aria-label="Возвраты">
            <h3 className="mb-1.5 label-text text-muted-strong">Возвраты</h3>
            <ul className="divide-y divide-border rounded-control border border-border">
              {payments.map(p => (
                <li key={p.id} className="flex h-10 items-center gap-3 pl-3 pr-1">
                  <span className="w-16 shrink-0 text-small text-muted">{formatShortRu(p.date)}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-body tabular-nums text-text">
                    {formatDebtAmount(p.amount, currency)}
                  </span>
                  {p.note ? <span className="hidden min-w-0 truncate text-small text-muted sm:inline">{p.note}</span> : null}
                  <IconButton
                    size="sm"
                    variant="ghost"
                    aria-label={`Убрать возврат от ${formatShortRu(p.date)}`}
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
