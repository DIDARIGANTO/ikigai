import { useState } from 'react';
import type { Debt, DebtPayment } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { leftOf } from '@/lib/domain/debts';
import { todayISO } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { parsePrice } from '@/features/lists/money';
import { formatDebtAmount } from './money';

/**
 * Возврат части долга. Сумма по умолчанию — весь остаток; больше остатка записать нельзя:
 * лишнее было бы уже не возвратом, а новым долгом в другую сторону.
 */
export function PaymentDialog({
  debt,
  onSave,
  onClose,
}: {
  debt: Debt;
  onSave: (payment: DebtPayment) => Promise<void> | void;
  onClose: () => void;
}) {
  const toast = useToast();
  const left = leftOf(debt);
  const [amount, setAmount] = useState(String(left));
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');

  const submit = async () => {
    const parsed = parsePrice(amount);
    if (!parsed || parsed <= 0) {
      toast('Сумма не распознана', { kind: 'error' });
      return;
    }
    if (parsed > left + 0.004) {
      toast(`Больше остатка: осталось ${formatDebtAmount(left, debt.currency)}`, { kind: 'error' });
      return;
    }
    if (!date) return;
    await onSave({ id: newId(), date, amount: parsed, note: note.trim() || undefined });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Возврат"
      footer={
        <div className="flex w-full items-center gap-2">
          <Button variant="ghost" onClick={onClose} className="ml-auto">
            Отмена
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!amount.trim() || !date}>
            Записать
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
        <p className="text-body text-muted-strong">
          {debt.person}: осталось <span className="font-mono tabular-nums text-text">{formatDebtAmount(left, debt.currency)}</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`Сумма, ${debt.currency}`}
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="tabular-nums"
          />
          <Input label="Дата" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <Input label="Заметка" value={note} onChange={e => setNote(e.target.value)} placeholder="Например, перевод на карту" />
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Записать
        </button>
      </form>
    </Modal>
  );
}
