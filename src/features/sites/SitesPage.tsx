import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, Coins, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Site, SitePayment } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Menu } from '@/components/ui/Menu';
import type { MenuEntry } from '@/components/ui/Menu';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Segmented } from '@/components/ui/Segmented';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { useCollection, useProfile } from '@/data/hooks';
import { formatShortRu, todayISO } from '@/lib/dates';
import {
  addSitePayment,
  isPaidUp,
  leftOf,
  MOVE_LABEL,
  moveTo,
  NEXT_STATUS,
  paidOf,
  paidRatio,
  SITE_STATUSES,
  siteMonogram,
  splitSites,
  STATUS_LABEL,
  statusOf,
  totalLeft,
} from '@/lib/domain/sites';
import type { SiteStatus } from '@/lib/domain/sites';
import { formatDebtAmount } from '@/features/debts/money';
import { PaymentDialog } from '@/features/debts/PaymentDialog';
import { newId, nowISO } from '@/lib/ids';
import { created, deleted, updated, useUndoable } from '@/lib/undo';
import { SiteEditor } from './SiteEditor';
import type { SiteFields } from './SiteEditor';

const FOCUS = 'focus-ring-inset';

interface RowActions {
  open: (s: Site) => void;
  pay: (s: Site) => void;
  move: (s: Site, to: SiteStatus) => void;
  remove: (s: Site) => void;
}

/**
 * Строка сайта: плитка с буквой, название, клиент (у реализованного — с датой сдачи), заметка и деньги: сумма сделки,
 * а если что-то уже заплатили — остаток и сколько оплачено (с полосой). Вся строка открывает редактор; при наведении есть
 * «Платёж» и кнопка «дальше» (встреча → в работе → жду оплату → реализован), а перенос на любой этап, изменить и удалить — в меню справа.
 */
function SiteRow({ site, currency, actions }: { site: Site; currency: string; actions: RowActions }) {
  const status = statusOf(site);
  const next = NEXT_STATUS[status];
  const paid = paidOf(site);
  const left = leftOf(site);
  const paidUp = isPaidUp(site);
  const money = (v: number) => formatDebtAmount(v, currency);
  const meta = [site.client, status === 'done' && site.doneAt ? `реализован ${formatShortRu(site.doneAt)}` : null].filter(Boolean).join(' · ');
  const entries: MenuEntry[] = [
    { type: 'item', label: 'Изменить', icon: <Pencil size={14} />, onSelect: () => actions.open(site) },
    ...(paidUp ? [] : ([{ type: 'item', label: 'Записать платёж…', icon: <Coins size={14} />, onSelect: () => actions.pay(site) }] satisfies MenuEntry[])),
    ...SITE_STATUSES.filter(st => st !== status).map<MenuEntry>(st => ({
      type: 'item',
      label: MOVE_LABEL[st],
      icon: st === 'done' ? <Check size={14} /> : <ArrowRight size={14} />,
      onSelect: () => actions.move(site, st),
    })),
    { type: 'separator' },
    { type: 'item', label: 'Удалить', icon: <Trash2 size={14} />, danger: true, onSelect: () => actions.remove(site) },
  ];
  return (
    <li className="group flex items-center border-b border-border pr-2 last:border-b-0 hover:bg-fill focus-within:bg-fill">
      <button
        type="button"
        onClick={() => actions.open(site)}
        aria-label={`Сайт: ${site.title}`}
        className={`flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pl-4 pr-2 text-left ${FOCUS}`}
      >
        <span
          aria-hidden="true"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-mark bg-fill-strong text-body font-medium text-muted-strong"
        >
          {siteMonogram(site)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-medium text-text">{site.title}</span>
          {meta ? <span className="block truncate text-small text-muted-strong">{meta}</span> : null}
          {site.note ? <span className="block truncate text-small text-muted">{site.note}</span> : null}
          {site.price && paid > 0 && !paidUp ? (
            <ProgressBar
              value={paidRatio(site)}
              size="sm"
              className="mt-1.5 max-w-64"
              label={`${site.title}: оплачено ${money(paid)} из ${money(site.price)}`}
            />
          ) : null}
        </span>
        {site.price ? (
          <span className="shrink-0 text-right">
            <span className={`block font-mono text-body tabular-nums ${paidUp ? 'text-success-strong' : 'text-text'}`}>
              {paid > 0 && !paidUp ? <span className="mr-1.5 font-sans text-caption text-muted">осталось</span> : null}
              {money(paid > 0 && !paidUp ? left : site.price)}
            </span>
            {paidUp ? (
              <span className="block text-caption text-muted">оплачено полностью</span>
            ) : paid > 0 ? (
              <span className="block font-mono text-caption tabular-nums text-muted">
                оплачено {money(paid)} из {money(site.price)}
              </span>
            ) : null}
          </span>
        ) : paid > 0 ? (
          <span className="shrink-0 text-right">
            <span className="block text-caption text-muted">оплачено</span>
            <span className="block font-mono text-body tabular-nums text-success-strong">{money(paid)}</span>
          </span>
        ) : null}
      </button>
      {paidUp ? null : (
        <Button
          variant="ghost"
          size="sm"
          className="hover-reveal shrink-0 max-sm:px-2"
          aria-label={`Записать платёж: ${site.title}`}
          title="Записать платёж"
          onClick={() => actions.pay(site)}
        >
          <Coins size={16} aria-hidden="true" className="sm:hidden" />
          <span className="max-sm:hidden">Платёж</span>
        </Button>
      )}
      {next ? (
        <Button
          variant="ghost"
          size="sm"
          className="hover-reveal shrink-0 max-sm:px-2"
          aria-label={`Перенести в «${STATUS_LABEL[next]}»: ${site.title}`}
          title={`Перенести в «${STATUS_LABEL[next]}»`}
          onClick={() => actions.move(site, next)}
        >
          {next === 'done' ? <Check size={16} aria-hidden="true" className="sm:hidden" /> : <ArrowRight size={16} aria-hidden="true" className="sm:hidden" />}
          <span className="max-sm:hidden">{MOVE_LABEL[next]}</span>
        </Button>
      ) : null}
      <Menu label={`Действия: ${site.title}`} entries={entries} size="sm" triggerClassName="hover-reveal" />
    </li>
  );
}

/** Что сказать на пустой вкладке. */
const EMPTY: Record<SiteStatus, { title: string; description: string; action: string }> = {
  meeting: {
    title: 'Встреч пока нет',
    description: 'Сюда попадают сайты, по которым нужно согласовать встречу с клиентом.',
    action: 'Добавить сайт',
  },
  work: { title: 'В работе пока ничего нет', description: 'Добавь сайт, над которым работаешь сейчас.', action: 'Добавить сайт' },
  payment: {
    title: 'Оплаты не ждёшь',
    description: 'Когда сайт сдан и ждёшь оплату, перенеси его сюда: суммы сложатся в итог.',
    action: 'Добавить сайт',
  },
  done: {
    title: 'Реализованных сайтов пока нет',
    description: 'Когда сайт оплачен и закрыт, перенеси его сюда.',
    action: 'Добавить реализованный сайт',
  },
};

export function SitesPage() {
  const sites = useCollection('sites');
  const [profile] = useProfile();
  const commit = useUndoable();
  const [params, setParams] = useSearchParams();

  const [editor, setEditor] = useState<{ site: Site | null } | null>(null);
  const [paying, setPaying] = useState<Site | null>(null);
  const groups = useMemo(() => splitSites(sites), [sites]);

  // Вкладка живёт в адресе (`/sites?tab=payment`): страницу можно обновить или отправить ссылкой. Без неё открыто «В работе».
  const tabParam = params.get('tab');
  const tab: SiteStatus = SITE_STATUSES.find(st => st === tabParam) ?? 'work';
  const setTab = (next: SiteStatus) =>
    setParams(
      p => {
        if (next === 'work') p.delete('tab');
        else p.set('tab', next);
        return p;
      },
      { replace: true },
    );
  const shown = groups[tab];
  const expected = totalLeft(groups.payment);

  // Ссылка из поиска: `/sites?site=<id>` открывает редактор этого сайта; редактор выводится из адреса, а не копируется в состояние.
  const wanted = params.get('site');
  const urlSite = wanted ? (sites.find(s => s.id === wanted) ?? null) : null;
  const current = editor ?? (urlSite ? { site: urlSite } : null);
  const closeEditor = () => {
    setEditor(null);
    if (wanted) {
      setParams(
        p => {
          p.delete('site');
          return p;
        },
        { replace: true },
      );
    }
  };

  const add = () => setEditor({ site: null });

  const save = async (fields: SiteFields) => {
    const existing = current?.site;
    const now = nowISO();
    if (existing) {
      await commit('Сохранено', [updated('sites', existing, { ...existing, ...fields })]);
    } else {
      await commit('Сайт добавлен', [created('sites', { id: newId(), createdAt: now, updatedAt: now, ...fields })]);
    }
    // Страница идёт за сайтом на его вкладку: иначе записанное на другом этапе пропало бы из виду.
    // Если редактор открыт по ссылке из поиска, адрес правит закрытие редактора, и вкладку не трогаем.
    if (!wanted && fields.status && fields.status !== tab) setTab(fields.status);
  };

  const savePayment = async (target: Site, payment: SitePayment) => {
    await commit('Платёж записан', [updated('sites', target, addSitePayment(target, payment))]);
  };

  const actions: RowActions = {
    open: s => setEditor({ site: s }),
    pay: s => setPaying(s),
    move: (s, to) => void commit(to === 'done' ? 'Сайт реализован' : `Перенесено: ${STATUS_LABEL[to]}`, [updated('sites', s, moveTo(s, to, todayISO()))]),
    remove: s => void commit('Сайт удалён', [deleted('sites', s)]),
  };

  const empty =
    tab === 'work' && sites.length === 0
      ? { ...EMPTY.work, title: 'Сайтов пока нет', description: 'Записывай сайты по этапам: встреча, работа, оплата, сдача.' }
      : EMPTY[tab];

  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader
        title="Сайты"
        icon={<SectionIcon k="sites" size={20} />}
        description="Сайты клиентов: от встречи до оплаты"
        actions={
          <Button variant="primary" onClick={add}>
            <Plus size={16} aria-hidden="true" />
            Сайт
          </Button>
        }
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <nav aria-label="Этапы сайтов" className="min-w-0 max-w-full">
          <Segmented
            label="Сайты"
            value={tab}
            onChange={setTab}
            kind="tabs"
            options={SITE_STATUSES.map(st => ({ value: st, label: STATUS_LABEL[st], count: groups[st].length }))}
          />
        </nav>
        {tab === 'payment' && expected > 0 ? (
          <p className="font-mono text-small tabular-nums text-muted-strong">Ждёшь: {formatDebtAmount(expected, profile.currency)}</p>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            compact
            k="sites"
            title={empty.title}
            description={empty.description}
            action={
              <Button variant="primary" size="sm" onClick={add}>
                <Plus size={16} aria-hidden="true" />
                {empty.action}
              </Button>
            }
          />
        </Card>
      ) : (
        <Card as="div" className="animate-in mt-4 overflow-hidden">
          <ul>
            {shown.map(s => (
              <SiteRow key={s.id} site={s} currency={profile.currency} actions={actions} />
            ))}
          </ul>
        </Card>
      )}

      {current ? (
        <SiteEditor
          key={current.site?.id ?? 'new'}
          site={current.site}
          defaultStatus={tab}
          currency={profile.currency}
          onSave={save}
          onDelete={s => actions.remove(s)}
          onClose={closeEditor}
        />
      ) : null}

      {paying ? (
        <PaymentDialog
          key={paying.id}
          title="Платёж"
          who={paying.title}
          left={paying.price ? leftOf(paying) : null}
          currency={profile.currency}
          onSave={p => savePayment(paying, p)}
          onClose={() => setPaying(null)}
        />
      ) : null}
    </div>
  );
}
