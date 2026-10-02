import { useMemo, useState } from 'react';
import { Bell, Cake, CalendarClock, CalendarPlus, ChevronRight, Pencil, Plus, Repeat2, Trash2 } from 'lucide-react';
import type { Reminder } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Menu } from '@/components/ui/Menu';
import type { MenuEntry } from '@/components/ui/Menu';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCollection, useRepo } from '@/data/hooks';
import { formatShortRu, todayISO } from '@/lib/dates';
import { newId, nowISO } from '@/lib/ids';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { ReminderEditor } from './ReminderEditor';
import { groupReminders, postponeDate, REPEAT_LABEL, shortDays, soonest } from './grouping';
import type { Postpone, ReminderEntry } from './grouping';

const FOCUS = 'focus-ring-inset';
/** Ежегодное событие ближе недели — «скоро»: число дней ярче. */
const SOON_DAYS = 7;

type Kind = 'yearly' | 'repeat' | 'once';

const kindOf = (r: Reminder): Kind => (r.repeat === 'yearly' ? 'yearly' : r.repeat === 'none' ? 'once' : 'repeat');

/** Вид напоминания — приглушённая иконка 16 px: торт — ежегодное, стрелки по кругу — повтор, колокольчик — разовое. */
const KIND: Record<Kind, { Icon: typeof Bell; label: string }> = {
  yearly: { Icon: Cake, label: 'Ежегодное' },
  repeat: { Icon: Repeat2, label: 'Повторяется' },
  once: { Icon: Bell, label: 'Напоминание' },
};

function KindIcon({ kind }: { kind: Kind }) {
  const { Icon, label } = KIND[kind];
  return <Icon size={16} aria-label={label} role="img" className="shrink-0 text-muted" />;
}

/** Строка «Скоро»: иконка, текст 14 px и справа моноширинное «через 12 дн.». */
function SoonRow({ entry, onOpen }: { entry: ReminderEntry; onOpen: (r: Reminder) => void }) {
  const { reminder, days } = entry;
  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => onOpen(reminder)}
        className={`flex h-10 w-full items-center gap-3 px-4 text-left hover:bg-fill ${FOCUS}`}
      >
        <KindIcon kind={kindOf(reminder)} />
        <span className="min-w-0 flex-1 truncate text-body text-text">{reminder.text}</span>
        <span className="shrink-0 font-mono text-small text-muted-strong tabular-nums">{shortDays(days ?? 0)}</span>
      </button>
    </li>
  );
}

/**
 * Строка ведомости 40 px с линией снизу: иконка, текст, подпись повтора, дата и время моноширинными цифрами, меню.
 * Сама строка открывает редактор; в меню — перенос разового напоминания и удаление.
 */
function Row({ entry, actions }: { entry: ReminderEntry; actions: RowActions }) {
  const { reminder, next } = entry;
  const once = reminder.repeat === 'none';

  const entries: MenuEntry[] = [
    { type: 'item', label: 'Изменить', icon: <Pencil size={14} />, onSelect: () => actions.open(reminder) },
    ...(once
      ? ([
          { type: 'item', label: 'Перенести на завтра', icon: <CalendarClock size={14} />, onSelect: () => actions.postpone(reminder, 'tomorrow') },
          { type: 'item', label: 'Перенести на неделю', icon: <CalendarPlus size={14} />, onSelect: () => actions.postpone(reminder, 'week') },
        ] satisfies MenuEntry[])
      : []),
    { type: 'separator' },
    { type: 'item', label: 'Удалить', icon: <Trash2 size={14} />, danger: true, onSelect: () => actions.remove(reminder) },
  ];

  return (
    <li className="group flex items-center border-b border-border pr-2 last:border-b-0 hover:bg-fill focus-within:bg-fill">
      <button
        type="button"
        onClick={() => actions.open(reminder)}
        className={`flex min-h-10 min-w-0 flex-1 items-center gap-3 py-2 pl-4 pr-2 text-left ${FOCUS}`}
      >
        <KindIcon kind={kindOf(reminder)} />
        <span className="min-w-0 flex-1 truncate text-body text-text">{reminder.text}</span>
        {once ? null : (
          <span className="hidden shrink-0 text-small text-muted sm:inline">{REPEAT_LABEL[reminder.repeat]}</span>
        )}
        <span className="shrink-0 whitespace-nowrap text-small text-muted-strong">{formatShortRu(next ?? reminder.date)}</span>
        {reminder.time ? <span className="w-11 shrink-0 text-right font-mono text-small text-muted tabular-nums">{reminder.time}</span> : null}
      </button>
      <Menu label={`Действия: ${reminder.text}`} entries={entries} size="sm" triggerClassName="hover-reveal" />
    </li>
  );
}

interface RowActions {
  open: (r: Reminder) => void;
  postpone: (r: Reminder, to: Postpone) => void;
  remove: (r: Reminder) => void;
}

/** Подпись группы: 13 px приглушённая, число моноширинными цифрами. */
function GroupHeading({ id, title, count }: { id: string; title: string; count: number }) {
  return (
    <h2 id={id} className="flex h-8 items-center gap-2 px-4 label-text text-muted">
      {title}
      <span className="font-mono tabular-nums">{count}</span>
    </h2>
  );
}

/** Группа ведомости: подпись и строки с тонкими линиями. */
function Section({ id, title, entries, actions }: { id: string; title: string; entries: ReminderEntry[]; actions: RowActions }) {
  if (!entries.length) return null;
  return (
    <section aria-labelledby={id} className="border-t border-border pt-1 first:border-t-0">
      <GroupHeading id={id} title={title} count={entries.length} />
      <ul>
        {entries.map(e => (
          <Row key={e.reminder.id} entry={e} actions={actions} />
        ))}
      </ul>
    </section>
  );
}

/** Ежегодные события: подпись над карточкой (как у «Скоро»), строки — имя, дата и сколько осталось. */
function YearlyCard({ entries, onOpen, onAdd }: { entries: ReminderEntry[]; onOpen: (r: Reminder) => void; onAdd: () => void }) {
  return (
    <section aria-labelledby="yearly-title">
      <h2 id="yearly-title" className="mb-2 flex items-center gap-2 label-text text-muted">
        Ежегодные
        {entries.length ? <span className="font-mono tabular-nums">{entries.length}</span> : null}
      </h2>
      <Card as="div" className="overflow-hidden">
        {entries.length ? (
          <ul>
            {entries.map(e => (
              <YearlyRow key={e.reminder.id} entry={e} onOpen={onOpen} />
            ))}
          </ul>
        ) : (
          <div className="px-4 py-3">
            <p className="text-small text-muted">Дни рождения и годовщины появятся здесь.</p>
            <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={onAdd}>
              <Plus size={16} aria-hidden="true" />
              Добавить
            </Button>
          </div>
        )}
      </Card>
    </section>
  );
}

function YearlyRow({ entry, onOpen }: { entry: ReminderEntry; onOpen: (r: Reminder) => void }) {
  const { reminder, next, days } = entry;
  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => onOpen(reminder)}
        className={`flex h-10 w-full items-center gap-3 px-4 text-left hover:bg-fill ${FOCUS}`}
      >
        <span className="min-w-0 flex-1 truncate text-body text-text">{reminder.text}</span>
        <span className="shrink-0 whitespace-nowrap text-small text-muted">{formatShortRu(next ?? reminder.date)}</span>
        {days !== null ? (
          <span
            className={`shrink-0 whitespace-nowrap font-mono text-small tabular-nums ${days <= SOON_DAYS ? 'text-text' : 'text-muted-strong'}`}
          >
            {shortDays(days)}
          </span>
        ) : null}
      </button>
    </li>
  );
}

export function RemindersPage() {
  const reminders = useCollection('reminders');
  const { put, remove } = useRepo();
  const toast = useToast();
  const confirm = useConfirm();
  const today = todayISO();

  const [editing, setEditing] = useState<{ reminder: Reminder | null } | null>(null);
  const [showPast, setShowPast] = useState(false);

  const groups = useMemo(() => groupReminders(reminders, today), [reminders, today]);
  const soon = useMemo(() => soonest(reminders, today), [reminders, today]);
  const upcoming = groups.today.length + groups.week.length + groups.later.length;

  const save = async (patch: Pick<Reminder, 'text' | 'date' | 'time' | 'repeat'>) => {
    const current = editing?.reminder;
    const now = nowISO();
    await put(
      'reminders',
      current ? { ...current, ...patch } : { id: newId(), createdAt: now, updatedAt: now, ...patch },
    );
  };

  const open = (reminder: Reminder) => setEditing({ reminder });
  const add = () => setEditing({ reminder: null });

  // Отмена переноса — прежняя дата возвращается кнопкой в уведомлении.
  const actions: RowActions = {
    open,
    postpone: (reminder, to) => {
      const date = postponeDate(to, today);
      void put('reminders', { ...reminder, date });
      toast(`Перенесено на ${formatShortRu(date)}`, {
        action: { label: 'Отменить', onClick: () => void put('reminders', { ...reminder }) },
      });
    },
    // Общего `lib/undo` пока нет — удаление через подтверждение, как в редакторе.
    remove: reminder => {
      void (async () => {
        if (!(await confirm(`Удалить напоминание «${reminder.text}»?`))) return;
        await remove('reminders', reminder.id);
        toast('Напоминание удалено');
      })();
    },
  };

  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader
        title="Напоминания"
        icon={<SectionIcon k="reminders" size={20} />}
        description="Даты, о которых нельзя забыть"
        actions={
          <Button variant="primary" onClick={add}>
            <Plus size={16} aria-hidden="true" />
            Напоминание
          </Button>
        }
      />

      {reminders.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            compact
            k="reminders"
            title="Напоминаний пока нет"
            description="Сюда попадают платежи, дни рождения и всё, что повторяется."
            action={
              <Button variant="primary" size="sm" onClick={add}>
                <Plus size={16} aria-hidden="true" />
                Добавить напоминание
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            {soon.length ? (
              <section aria-labelledby="soon-title">
                <h2 id="soon-title" className="mb-2 label-text text-muted">
                  Скоро
                </h2>
                <Card as="div" className="overflow-hidden">
                  <ul>
                    {soon.map(e => (
                      <SoonRow key={e.reminder.id} entry={e} onOpen={open} />
                    ))}
                  </ul>
                </Card>
              </section>
            ) : null}

            <Card className="animate-in overflow-hidden" aria-label="Все напоминания">
              {upcoming ? (
                <>
                  <Section id="rem-today" title="Сегодня" entries={groups.today} actions={actions} />
                  <Section id="rem-week" title="Ближайшие 7 дней" entries={groups.week} actions={actions} />
                  <Section id="rem-later" title="Позже" entries={groups.later} actions={actions} />
                </>
              ) : (
                <p className="px-4 py-3 text-small text-muted">Ближайших напоминаний нет.</p>
              )}

              {groups.past.length ? (
                <section className="border-t border-border">
                  <button
                    type="button"
                    aria-expanded={showPast}
                    onClick={() => setShowPast(v => !v)}
                    className={`flex h-10 w-full items-center gap-2 px-4 text-left text-small font-medium text-muted hover:bg-fill hover:text-text ${FOCUS}`}
                  >
                    <ChevronRight
                      size={16}
                      aria-hidden="true"
                      className={`transition-transform duration-(--duration-base) ease-out-soft ${showPast ? 'rotate-90' : ''}`}
                    />
                    <h2>Прошедшие</h2>
                    <span className="font-mono tabular-nums">{groups.past.length}</span>
                  </button>
                  {showPast ? (
                    <ul className="animate-in border-t border-border">
                      {groups.past.map(e => (
                        <Row key={e.reminder.id} entry={e} actions={actions} />
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}
            </Card>
          </div>

          <YearlyCard entries={groups.yearly} onOpen={open} onAdd={add} />
        </div>
      )}

      {editing ? (
        <ReminderEditor
          key={editing.reminder?.id ?? 'new'}
          reminder={editing.reminder}
          onSave={save}
          onDelete={r => remove('reminders', r.id)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
