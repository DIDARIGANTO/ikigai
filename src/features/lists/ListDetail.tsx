import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCheck, ChevronDown, CornerDownLeft, Palette, Pencil, Plus, SmilePlus, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { burst } from '@/components/ui/Burst';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { emojiIcon, listEmoji, ListIcon } from '@/components/ui/ListIcon';
import { Menu } from '@/components/ui/Menu';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { FIELD } from '@/components/ui/Input';
import { TONES, isDecorativeTone } from '@/components/ui/tones';
import { useToast } from '@/components/ui/Toast';
import { useCollection, useProfile, useRepo } from '@/data/hooks';
import { newId, nowISO } from '@/lib/ids';
import type { List, ListItem } from '@/lib/types';
import { listTone } from '@/features/boards/tone';
import { TonePopover } from '@/features/boards/TonePicker';
import { ItemModal } from './ListItemModal';
import { ItemRow } from './ListItemRow';
import type { ListTotals } from './money';
import { formatMoney, listTotals, splitTrailingPrice } from './money';

const FOCUS = 'focus-ring';

/** Заголовок H1, который по клику превращается в поле переименования. */
function TitleEditor({
  list,
  renaming,
  onStart,
  onDone,
}: {
  list: List;
  renaming: boolean;
  onStart: () => void;
  onDone: () => void;
}) {
  const { put } = useRepo();
  const [draft, setDraft] = useState(list.title);
  // Каждый новый заход в переименование начинается с актуального названия.
  const [wasRenaming, setWasRenaming] = useState(renaming);
  if (renaming !== wasRenaming) {
    setWasRenaming(renaming);
    if (renaming) setDraft(list.title);
  }

  const commit = async () => {
    onDone();
    const title = draft.trim();
    if (!title || title === list.title) return;
    await put('lists', { ...list, title });
  };

  return renaming ? (
    <input
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onDone();
        }
      }}
      aria-label="Название списка"
      className="w-full -mx-1.5 rounded-control border border-accent bg-surface px-1.5 [font:inherit] outline-2 outline-offset-1 outline-accent"
    />
  ) : (
    <button
      type="button"
      onClick={onStart}
      title="Нажми, чтобы переименовать"
      className={`-mx-1.5 rounded-control px-1.5 text-left break-words hover:bg-fill ${FOCUS}`}
    >
      {list.title}
    </button>
  );
}

/** Одна цифра сводки: подпись 13 px приглушённая, значение моноширинными цифрами. */
function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-small text-muted">{label}</dt>
      <dd className="mt-1 truncate font-mono text-h2 font-medium text-text tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * Шапка списка: эмодзи (символ 20 px) или приглушённая иконка, название (правится на месте) и меню;
 * под ней — плоская строка сводки «Осталось купить · Куплено на · Сделано» и полоса прогресса 3 px.
 */
function ListHeader({
  list,
  totals,
  currency,
  renaming,
  onStartRename,
  onDoneRename,
  onIcon,
  onTone,
  onDelete,
}: {
  list: List;
  totals: ListTotals;
  currency: string;
  renaming: boolean;
  onStartRename: () => void;
  onDoneRename: () => void;
  onIcon: () => void;
  onTone: () => void;
  onDelete: () => void;
}) {
  const { put } = useRepo();
  const tone = listTone(list);
  const emoji = listEmoji(list.icon);
  const ratio = totals.total ? totals.done / totals.total : 0;
  return (
    <section aria-label="Итоги списка">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onIcon}
          aria-label={emoji ? `Эмодзи списка: ${emoji}. Изменить` : 'Выбрать эмодзи списка'}
          className="focus-ring -ml-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-control text-muted hover:bg-fill hover:text-text"
        >
          {emoji ? <span className="font-emoji text-xl leading-none">{emoji}</span> : <ListIcon name={list.icon} size={20} />}
        </button>
        <h1 className="min-w-0 flex-1 text-h1 font-semibold text-text">
          <TitleEditor list={list} renaming={renaming} onStart={onStartRename} onDone={onDoneRename} />
        </h1>
        {isDecorativeTone(tone) ? <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-mark ${TONES[tone].solid}`} /> : null}
        <Menu
          label="Меню списка"
          className="shrink-0"
          entries={[
            { type: 'item', label: 'Переименовать', icon: <Pencil size={14} />, onSelect: onStartRename },
            { type: 'item', label: 'Изменить эмодзи', icon: <SmilePlus size={14} />, onSelect: onIcon },
            { type: 'item', label: 'Цвет метки', icon: <Palette size={14} />, onSelect: onTone },
            {
              type: 'item',
              label: 'Закрепить в меню',
              checked: list.pinned,
              onSelect: () => void put('lists', { ...list, pinned: !list.pinned }),
            },
            { type: 'separator' },
            { type: 'item', label: 'Удалить список', icon: <Trash2 size={14} />, danger: true, onSelect: onDelete },
          ]}
        />
      </div>

      <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
        {totals.hasPrices ? (
          <>
            <Stat label="Осталось купить" value={formatMoney(totals.left, currency)} />
            <Stat label="Куплено на" value={formatMoney(totals.bought, currency)} />
          </>
        ) : null}
        <Stat
          label="Сделано"
          value={
            <>
              {totals.done} <span className="font-sans font-normal text-muted">из</span> {totals.total}
            </>
          }
        />
      </dl>
      {totals.total ? <ProgressBar value={ratio} label="Прогресс списка" className="mt-4" /> : null}
    </section>
  );
}

export function ListDetail() {
  const { id = '' } = useParams();
  const lists = useCollection('lists');
  const allItems = useCollection('listItems');
  const [profile] = useProfile();
  const { put, remove } = useRepo();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [doneOpen, setDoneOpen] = useState(false);
  const [details, setDetails] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [toneOpen, setToneOpen] = useState(false);
  const toneAnchor = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const list = lists.find(l => l.id === id) ?? null;
  const items = useMemo(
    () => allItems.filter(i => i.listId === id).sort((a, b) => a.position - b.position),
    [allItems, id],
  );
  const open = items.filter(i => !i.doneAt);
  const done = items.filter(i => i.doneAt);
  const totals = useMemo(() => listTotals(items), [items]);
  const detailsItem = details ? (items.find(i => i.id === details) ?? null) : null;

  // Список мог быть удалён на другой вкладке — ждём загрузку, потом показываем пустое состояние.
  if (!list) {
    return lists.length ? (
      <EmptyState
        k="lists"
        title="Список не найден"
        description="Возможно, он был удалён."
        action={
          <Link
            to="/lists"
            className="inline-flex h-9 items-center justify-center rounded-control border border-border-strong bg-surface px-3 text-body font-medium text-text hover:bg-fill focus-ring press"
          >
            Ко всем спискам
          </Link>
        }
      />
    ) : null;
  }

  const draft = splitTrailingPrice(text);

  const add = async () => {
    const { text: value, price } = splitTrailingPrice(text);
    if (!value) return;
    const now = nowISO();
    const position = items.reduce((max, i) => Math.max(max, i.position + 1), 0);
    await put('listItems', {
      id: newId(),
      listId: list.id,
      text: value,
      ...(price !== undefined ? { price } : {}),
      position,
      createdAt: now,
      updatedAt: now,
    });
    setText('');
  };

  /** Отметили последний открытый пункт — список закрыт: маленький праздник. */
  const onChecked = (item: ListItem, from: Element) => {
    if (open.length !== 1 || open[0].id !== item.id) return;
    burst(from, { count: 36, power: 8 });
    toast(totals.hasPrices ? 'Список закрыт — всё куплено' : 'Список закрыт — всё готово');
  };

  const onDelete = async () => {
    const tail = items.length ? ` вместе с пунктами (${items.length})` : '';
    if (!(await confirm(`Удалить список «${list.title}»${tail}?`))) return;
    for (const item of items) await remove('listItems', item.id);
    await remove('lists', list.id);
    toast('Список удалён');
    navigate('/lists');
  };

  const openDetails = (itemId: string) => setDetails(itemId);

  return (
    <div className="mx-auto max-w-[880px]">
      <Link
        to="/lists"
        className={`-ml-2 inline-flex h-8 items-center gap-1.5 rounded-control px-2 text-small text-muted hover:bg-fill hover:text-text ${FOCUS}`}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Списки
      </Link>

      <div ref={toneAnchor} className="mt-3">
        <ListHeader
          list={list}
          totals={totals}
          currency={profile.currency}
          renaming={renaming}
          onStartRename={() => setRenaming(true)}
          onDoneRename={() => setRenaming(false)}
          onIcon={() => setIconOpen(true)}
          onTone={() => setToneOpen(true)}
          onDelete={() => void onDelete()}
        />
      </div>
      <TonePopover
        anchor={toneAnchor}
        open={toneOpen}
        onClose={() => setToneOpen(false)}
        value={listTone(list)}
        onChange={tone => void put('lists', { ...list, tone })}
        title="Цвет метки"
      />

      <div className="mt-6 space-y-4">
        <form
          className="group relative"
          onSubmit={e => {
            e.preventDefault();
            void add();
          }}
        >
          <Plus
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-text"
          />
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              // Явный обработчик: Enter добавляет пункт даже там, где браузер не отправляет форму сам.
              if (e.key === 'Enter') {
                e.preventDefault();
                void add();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setText('');
                inputRef.current?.blur();
              }
            }}
            aria-label="Новый пункт"
            aria-describedby="list-add-hint"
            placeholder="Новый пункт, можно с ценой"
            enterKeyHint="done"
            className={`${FIELD} h-10 pl-9 ${draft.price !== undefined && draft.text ? 'pr-40' : 'pr-12'}`}
          />
          <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {/* Разобранная цена — нейтральный чип с моноширинными цифрами. */}
            {draft.price !== undefined && draft.text ? (
              <Chip className="font-mono">{formatMoney(draft.price, profile.currency)}</Chip>
            ) : null}
            {text.trim() ? (
              <IconButton type="submit" size="sm" aria-label="Добавить пункт">
                <CornerDownLeft size={16} />
              </IconButton>
            ) : null}
          </div>
          <p id="list-add-hint" className={totals.hasPrices ? 'sr-only' : 'mt-2 text-small text-muted'}>
            Цену можно дописать в конце строки: «Наушники 45000» или «Куртка 150к».
          </p>
        </form>

        <Card className="overflow-hidden">
          {open.length ? (
            <ul>
              {open.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  currency={profile.currency}
                  onOpenDetails={i => openDetails(i.id)}
                  onChecked={onChecked}
                />
              ))}
            </ul>
          ) : done.length ? (
            <EmptyState compact icon={<CheckCheck size={16} />} title="Всё сделано" description="Новые пункты добавляются в строке сверху." />
          ) : (
            <EmptyState compact k="lists" title="Пунктов пока нет" description="Например: «Наушники 45000» — цена встанет сама." />
          )}
        </Card>

        {done.length ? (
          <section aria-label="Готово">
            <button
              type="button"
              onClick={() => setDoneOpen(o => !o)}
              aria-expanded={doneOpen}
              className={`-mx-2 inline-flex h-8 items-center gap-2 rounded-control px-2 text-small font-medium text-muted hover:bg-fill hover:text-text ${FOCUS}`}
            >
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={`transition-transform duration-(--duration-base) ease-out-soft ${doneOpen ? '' : '-rotate-90'}`}
              />
              Готово
              <span className="font-mono tabular-nums">{done.length}</span>
              {totals.bought > 0 ? (
                <span className="font-normal tabular-nums">· на {formatMoney(totals.bought, profile.currency)}</span>
              ) : null}
            </button>
            {doneOpen ? (
              <Card variant="flat" className="mt-2 overflow-hidden animate-in">
                <ul>
                  {done.map(item => (
                    <ItemRow key={item.id} item={item} currency={profile.currency} onOpenDetails={i => openDetails(i.id)} />
                  ))}
                </ul>
              </Card>
            ) : null}
          </section>
        ) : null}
      </div>

      <Modal open={iconOpen} onClose={() => setIconOpen(false)} title="Эмодзи списка" className="md:max-w-sm">
        <div className="-mx-3 -mb-3">
          <EmojiPicker
            value={listEmoji(list.icon)}
            onChange={emoji => {
              void put('lists', { ...list, icon: emojiIcon(emoji) });
              setIconOpen(false);
            }}
          />
        </div>
      </Modal>

      {detailsItem ? (
        <ItemModal
          key={detailsItem.id}
          item={detailsItem}
          currency={profile.currency}
          onClose={() => setDetails(null)}
        />
      ) : null}
    </div>
  );
}
