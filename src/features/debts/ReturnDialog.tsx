import { useId, useState } from 'react';
import type { Debt, DebtDirection } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import type { SegmentOption } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import { leftOf, openDebtsFor } from '@/lib/domain/debts';
import type { ReturnInput } from '@/lib/domain/debts';
import { todayISO } from '@/lib/dates';
import { parsePrice } from '@/features/lists/money';
import { formatDebtAmount } from './money';

const DIRECTION_OPTIONS: SegmentOption<DebtDirection>[] = [
  { value: 'owedToMe', label: 'Мне вернули' },
  { value: 'iOwe', label: 'Я вернул' },
];

/**
 * «Вернули долг»: имя, сумма, дата. Если у этого человека есть открытый долг, возврат ложится на него и сумма по умолчанию —
 * весь остаток; больше остатка записать нельзя (опечатка в лишнем нуле не должна стать новым долгом). Нет такого долга в списке —
 * возврат записывается как уже возвращённый долг, чтобы он попал в историю.
 */
export function ReturnDialog({
  debts,
  defaultCurrency,
  onSave,
  onClose,
}: {
  debts: readonly Debt[];
  defaultCurrency: string;
  onSave: (input: ReturnInput) => Promise<void> | void;
  onClose: () => void;
}) {
  const toast = useToast();
  const listId = useId();
  const [direction, setDirection] = useState<DebtDirection>('owedToMe');
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);
  const [date, setDate] = useState(todayISO());

  const matches = openDebtsFor(debts, direction, person);
  const currency = matches[0]?.currency ?? defaultCurrency;
  const sameCurrency = matches.filter(d => d.currency === currency);
  const totalLeft = Math.round(sameCurrency.reduce((sum, d) => sum + leftOf(d), 0) * 100) / 100;
  // Пока сумму не трогали, предлагаем весь остаток найденного долга: полный возврат — одно нажатие.
  const shownAmount = amountTouched ? amount : sameCurrency.length ? String(totalLeft) : '';
  const names = [...new Set(debts.filter(d => d.direction === direction && leftOf(d) > 0 && !d.closedAt).map(d => d.person))];

  const hint = !person.trim()
    ? null
    : sameCurrency.length
      ? `${sameCurrency.length > 1 ? `Открытых долгов: ${sameCurrency.length}` : 'Открытый долг'}: осталось ${formatDebtAmount(totalLeft, currency)}. Возврат запишется по нему.`
      : 'Такого долга в списке нет: запишу как уже возвращённый.';

  const submit = async () => {
    const who = person.trim();
    if (!who || !date) return;
    const parsed = parsePrice(shownAmount);
    if (!parsed || parsed <= 0) {
      toast('Сумма не распознана', { kind: 'error' });
      return;
    }
    if (sameCurrency.length && parsed > totalLeft + 0.004) {
      toast(`Больше остатка: осталось ${formatDebtAmount(totalLeft, currency)}`, { kind: 'error' });
      return;
    }
    await onSave({ direction, person: who, amount: parsed, currency, date });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Вернули долг"
      footer={
        <div className="flex w-full items-center gap-2">
          <Button variant="ghost" onClick={onClose} className="ml-auto">
            Отмена
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!person.trim() || !shownAmount.trim() || !date}>
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
        <Segmented label="Кто кому вернул" value={direction} onChange={setDirection} options={DIRECTION_OPTIONS} fullWidth />

        <div>
          <Input
            label={direction === 'owedToMe' ? 'Кто вернул' : 'Кому вернул'}
            autoFocus
            list={listId}
            value={person}
            onChange={e => setPerson(e.target.value)}
            placeholder="Имя"
          />
          <datalist id={listId}>
            {names.map(n => (
              <option key={n} value={n} />
            ))}
          </datalist>
          {hint ? <p className="mt-1.5 text-small text-muted-strong">{hint}</p> : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`Сумма, ${currency}`}
            inputMode="decimal"
            value={shownAmount}
            onChange={e => {
              setAmount(e.target.value);
              setAmountTouched(true);
            }}
            placeholder="50000"
            className="tabular-nums"
          />
          <Input label="Дата" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Записать
        </button>
      </form>
    </Modal>
  );
}
