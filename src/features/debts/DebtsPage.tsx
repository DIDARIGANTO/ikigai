import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Archive, Check, ChevronRight, Coins, Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import type { Debt, DebtDirection, DebtPayment } from '@/lib/types';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Menu } from '@/components/ui/Menu';
import type { MenuEntry } from '@/components/ui/Menu';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { useCollection, useProfile } from '@/data/hooks';
import { formatShortRu, todayISO } from '@/lib/dates';
import {
  addPayment,
  balanceOf,
  DIRECTION_LABEL,
  dueOf,
  forgive,
  isClosed,
  leftOf,
  paidOf,
  paidRatio,
  reopen,
  settle,
  splitDebts,
  totalsOf,
} from '@/lib/domain/debts';
import type { Due } from '@/lib/domain/debts';
import { newId, nowISO } from '@/lib/ids';
import { created, deleted, updated, useUndoable } from '@/lib/undo';
import { plural } from '@/features/lists/money';
import { DebtEditor } from './DebtEditor';
import type { DebtFields } from './DebtEditor';
import { PaymentDialog } from './PaymentDialog';
import { formatDebtAmount, formatTotals } from './money';

const FOCUS = 'focus-ring-inset';

/** Что сказать о сроке: просрочено — красным, скоро — янтарным, потом — просто дата. */
function dueLabel(due: Due, dueDate: string): { text: string; className: string } | null {
  const days = due.days ?? 0;
  switch (due.state) {
    case 'overdue':
      return { text: `просрочено на ${-days} ${plural(-days, ['день', 'дня', 'дней'])}`, className: 'text-danger-strong' };
    case 'soon':
      return {
        text: days === 0 ? 'срок сегодня' : days === 1 ? 'срок завтра' : `срок через ${days} дн.`,
        className: 'text-warning-strong',
      };
    case 'later':
      return { text: `до ${formatShortRu(dueDate)}`, className: 'text-muted' };
    default:
      return null;
  }
}

interface RowActions {
  open: (d: Debt) => void;
  settle: (d: Debt) => void;
  pay: (d: Debt) => void;
  forgive: (d: Debt) => void;
  reopen: (d: Debt) => void;
  remove: (d: Debt) => void;
}

/**
 * Строка открытого долга: имя и остаток моноширинными цифрами, ниже — «за что» или дата, сколько уже вернули и срок.
 * Строка открывает редактор, «Погасить» гасит остаток одним возвратом, в меню — частичный возврат, закрытие, удаление.
 */
function OpenRow({ debt, today, actions }: { debt: Debt; today: string; actions: RowActions }) {
  const left = leftOf(debt);
  const paid = paidOf(debt);
  const due = dueLabel(dueOf(debt, today), debt.dueDate ?? '');
  const verb = debt.direction === 'owedToMe' ? 'вернули' : 'отдано';

  const entries: MenuEntry[] = [
    { type: 'item', label: 'Изменить', icon: <Pencil size={14} />, onSelect: () => actions.open(debt) },
    { type: 'item', label: 'Частичный возврат…', icon: <Coins size={14} />, onSelect: () => actions.pay(debt) },
    { type: 'item', label: 'Закрыть без оплаты', icon: <Archive size={14} />, onSelect: () => actions.forgive(debt) },
    { type: 'separator' },
    { type: 'item', label: 'Удалить', icon: <Trash2 size={14} />, danger: true, onSelect: () => actions.remove(debt) },
  ];

  return (
    <li className="group flex items-center border-b border-border pr-2 last:border-b-0 hover:bg-fill focus-within:bg-fill">
      <button
        type="button"
        onClick={() => actions.open(debt)}
        className={`flex min-h-14 min-w-0 flex-1 flex-col justify-center gap-1 py-2.5 pl-4 pr-2 text-left ${FOCUS}`}
      >
        <span className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1 truncate text-body font-medium text-text">{debt.person}</span>
          <span className="shrink-0 font-mono text-body tabular-nums text-text">{formatDebtAmount(left, debt.currency)}</span>
        </span>
        <span className="flex items-center gap-x-3 text-small text-muted">
          <span className="min-w-0 flex-1 truncate">{debt.note ?? `с ${formatShortRu(debt.date)}`}</span>
          {due ? <span className={`shrink-0 whitespace-nowrap ${due.className}`}>{due.text}</span> : null}
        </span>
        {paid > 0 ? (
          <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <ProgressBar
              value={paidRatio(debt)}
              size="sm"
              className="min-w-0 sm:flex-1"
              label={`${debt.person}: ${verb} ${formatDebtAmount(paid, debt.currency)} из ${formatDebtAmount(debt.amount, debt.currency)}`}
            />
            <span className="shrink-0 font-mono text-caption tabular-nums text-muted">
              {verb} {formatDebtAmount(paid, debt.currency)} из {formatDebtAmount(debt.amount, debt.currency)}
            </span>
          </span>
        ) : null}
      </button>
      <Button
        variant="ghost"
        size="sm"
        className="hover-reveal shrink-0 max-sm:px-2"
        aria-label={`Погасить долг: ${debt.person}`}
        title="Погасить полностью"
        onClick={() => actions.settle(debt)}
      >
        <Check size={16} aria-hidden="true" className="sm:hidden" />
        <span className="max-sm:hidden">Погасить</span>
      </Button>
      <Menu label={`Действия: ${debt.person}`} entries={entries} size="sm" triggerClassName="hover-reveal" />
    </li>
  );
}

/** Строка закрытого долга: приглушённая, с направлением и тем, как он закрылся. */
function ClosedRow({ debt, actions }: { debt: Debt; actions: RowActions }) {
  const manual = !!debt.closedAt && leftOf(debt) > 0;
  const entries: MenuEntry[] = [
    { type: 'item', label: 'Изменить', icon: <Pencil size={14} />, onSelect: () => actions.open(debt) },
    ...(manual
      ? ([{ type: 'item', label: 'Вернуть в открытые', icon: <Undo2 size={14} />, onSelect: () => actions.reopen(debt) }] satisfies MenuEntry[])
      : []),
    { type: 'separator' },
    { type: 'item', label: 'Удалить', icon: <Trash2 size={14} />, danger: true, onSelect: () => actions.remove(debt) },
  ];
  return (
    <li className="group flex items-center border-b border-border pr-2 last:border-b-0 hover:bg-fill focus-within:bg-fill">
      <button
        type="button"
        onClick={() => actions.open(debt)}
        className={`flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2 pl-4 pr-2 text-left ${FOCUS}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body text-muted-strong">{debt.person}</span>
          <span className="block truncate text-small text-muted">
            {DIRECTION_LABEL[debt.direction]} · {manual ? 'закрыт без оплаты' : 'погашен'}
          </span>
        </span>
        <span className="shrink-0 font-mono text-body tabular-nums text-muted">{formatDebtAmount(debt.amount, debt.currency)}</span>
      </button>
      <Menu label={`Действия: ${debt.person}`} entries={entries} size="sm" triggerClassName="hover-reveal" />
    </li>
  );
}

/** Колонка одного направления: подпись с числом и суммой, кнопка «+» и строки. */
function Column({
  direction,
  debts,
  sums,
  fallbackCurrency,
  today,
  actions,
  onAdd,
}: {
  direction: DebtDirection;
  debts: Debt[];
  sums: Record<string, number>;
  fallbackCurrency: string;
  today: string;
  actions: RowActions;
  onAdd: (direction: DebtDirection) => void;
}) {
  const id = `debts-${direction}`;
  return (
    <section aria-labelledby={id} className="min-w-0">
      <div className="mb-2 flex items-center gap-2">
        <h2 id={id} className="flex min-w-0 items-center gap-2 label-text text-muted">
          {DIRECTION_LABEL[direction]}
          <span className="font-mono tabular-nums">{debts.length}</span>
        </h2>
        <span className="ml-auto truncate font-mono text-small tabular-nums text-muted-strong">
          {debts.length ? formatTotals(sums, fallbackCurrency) : ''}
        </span>
        <IconButton size="sm" variant="ghost" aria-label={`Добавить: ${DIRECTION_LABEL[direction].toLowerCase()}`} onClick={() => onAdd(direction)}>
          <Plus size={16} aria-hidden="true" />
        </IconButton>
      </div>
      <Card as="div" className="overflow-hidden">
        {debts.length ? (
          <ul>
            {debts.map(d => (
              <OpenRow key={d.id} debt={d} today={today} actions={actions} />
            ))}
          </ul>
        ) : (
          <div className="px-4 py-4">
            <p className="text-small text-muted">
              {direction === 'owedToMe' ? 'Никто сейчас не должен.' : 'Ты никому не должен.'}
            </p>
            <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={() => onAdd(direction)}>
              <Plus size={16} aria-hidden="true" />
              Записать долг
            </Button>
          </div>
        )}
      </Card>
    </section>
  );
}

/** Ячейка итога: подпись-капитель и суммы по валютам — первая крупно, остальные мельче. */
function Stat({ label, sums, fallbackCurrency, signed = false }: { label: string; sums: Record<string, number>; fallbackCurrency: string; signed?: boolean }) {
  const entries = Object.entries(sums);
  return (
    <div className="min-w-0 p-4 sm:p-5">
      <p className="label-text text-muted">{label}</p>
      {entries.length ? (
        entries.map(([cur, value], i) => (
          <p
            key={cur}
            className={`mt-1 truncate font-mono tabular-nums ${i === 0 ? 'text-h1 font-medium' : 'text-body'} ${
              signed ? (value > 0 ? 'text-success-strong' : 'text-danger-strong') : 'text-text'
            }`}
          >
            {signed && value > 0 ? '+' : ''}
            {formatDebtAmount(value, cur)}
          </p>
        ))
      ) : (
        <p className="mt-1 font-mono text-h1 font-medium tabular-nums text-muted">{signed ? '—' : formatDebtAmount(0, fallbackCurrency)}</p>
      )}
    </div>
  );
}

export function DebtsPage() {
  const debts = useCollection('debts');
  const [profile] = useProfile();
  const commit = useUndoable();
  const [params, setParams] = useSearchParams();
  const today = todayISO();

  const [editor, setEditor] = useState<{ debt: Debt | null; direction: DebtDirection } | null>(null);
  const [paying, setPaying] = useState<Debt | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const { open, closed } = useMemo(() => splitDebts(debts), [debts]);
  const totals = useMemo(() => totalsOf(debts), [debts]);
  const balance = useMemo(() => balanceOf(totals), [totals]);

  // Ссылка из поиска: `/debts?debt=<id>` открывает редактор этого долга; редактор выводится из адреса, а не копируется в состояние.
  const wanted = params.get('debt');
  const urlDebt = wanted ? (debts.find(d => d.id === wanted) ?? null) : null;
  const current = editor ?? (urlDebt ? { debt: urlDebt, direction: urlDebt.direction } : null);
  const closeEditor = () => {
    setEditor(null);
    if (wanted) {
      setParams(
        p => {
          p.delete('debt');
          return p;
        },
        { replace: true },
      );
    }
  };

  const add = (direction: DebtDirection) => setEditor({ debt: null, direction });

  const save = async (fields: DebtFields) => {
    const existing = current?.debt;
    const now = nowISO();
    if (existing) {
      await commit('Сохранено', [updated('debts', existing, { ...existing, ...fields })]);
    } else {
      await commit('Долг записан', [created('debts', { id: newId(), createdAt: now, updatedAt: now, ...fields })]);
    }
  };

  const savePayment = async (target: Debt, payment: DebtPayment) => {
    const next = addPayment(target, payment);
    await commit(isClosed(next) ? 'Долг погашен' : 'Возврат записан', [updated('debts', target, next)]);
  };

  const actions: RowActions = {
    open: d => setEditor({ debt: d, direction: d.direction }),
    settle: d => void commit('Долг погашен', [updated('debts', d, settle(d, today, newId()))]),
    pay: d => setPaying(d),
    forgive: d => void commit('Долг закрыт без оплаты', [updated('debts', d, forgive(d, nowISO()))]),
    reopen: d => void commit('Долг снова открыт', [updated('debts', d, reopen(d))]),
    remove: d => void commit('Долг удалён', [deleted('debts', d)]),
  };

  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader
        title="Долги"
        icon={<SectionIcon k="debts" size={20} />}
        description="Кто кому должен"
        actions={
          <Button variant="primary" onClick={() => add('owedToMe')}>
            <Plus size={16} aria-hidden="true" />
            Долг
          </Button>
        }
      />

      {debts.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            compact
            k="debts"
            title="Долгов пока нет"
            description="Записывай, кто должен тебе и кому должен ты: сумму, срок и возвраты по частям."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" size="sm" onClick={() => add('owedToMe')}>
                  <Plus size={16} aria-hidden="true" />
                  Мне должны
                </Button>
                <Button variant="secondary" size="sm" onClick={() => add('iOwe')}>
                  <Plus size={16} aria-hidden="true" />
                  Я должен
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <Card className="animate-in mt-6 grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0" aria-label="Итоги">
            <Stat label={DIRECTION_LABEL.owedToMe} sums={totals.owedToMe} fallbackCurrency={profile.currency} />
            <Stat label={DIRECTION_LABEL.iOwe} sums={totals.iOwe} fallbackCurrency={profile.currency} />
            <Stat label="Баланс" sums={balance} fallbackCurrency={profile.currency} signed />
          </Card>

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
            <Column
              direction="owedToMe"
              debts={open.owedToMe}
              sums={totals.owedToMe}
              fallbackCurrency={profile.currency}
              today={today}
              actions={actions}
              onAdd={add}
            />
            <Column
              direction="iOwe"
              debts={open.iOwe}
              sums={totals.iOwe}
              fallbackCurrency={profile.currency}
              today={today}
              actions={actions}
              onAdd={add}
            />
          </div>

          {closed.length ? (
            <section className="mt-6" aria-label="Закрытые долги">
              <Card as="div" className="overflow-hidden">
                <button
                  type="button"
                  aria-expanded={showClosed}
                  onClick={() => setShowClosed(v => !v)}
                  className={`flex h-10 w-full items-center gap-2 px-4 text-left text-small font-medium text-muted hover:bg-fill hover:text-text ${FOCUS}`}
                >
                  <ChevronRight
                    size={16}
                    aria-hidden="true"
                    className={`transition-transform duration-(--duration-base) ease-out-soft ${showClosed ? 'rotate-90' : ''}`}
                  />
                  <h2>Закрытые</h2>
                  <span className="font-mono tabular-nums">{closed.length}</span>
                </button>
                {showClosed ? (
                  <ul className="animate-in border-t border-border">
                    {closed.map(d => (
                      <ClosedRow key={d.id} debt={d} actions={actions} />
                    ))}
                  </ul>
                ) : null}
              </Card>
            </section>
          ) : null}
        </>
      )}

      {current ? (
        <DebtEditor
          key={current.debt?.id ?? `new-${current.direction}`}
          debt={current.debt}
          defaultDirection={current.direction}
          defaultCurrency={profile.currency}
          onSave={save}
          onDelete={d => actions.remove(d)}
          onClose={closeEditor}
        />
      ) : null}

      {paying ? (
        <PaymentDialog key={paying.id} debt={paying} onSave={p => savePayment(paying, p)} onClose={() => setPaying(null)} />
      ) : null}
    </div>
  );
}
