import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pin, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { EmptyState } from '@/components/ui/EmptyState';
import { cardClass } from '@/components/ui/Card';
import { EmojiPickerButton } from '@/components/ui/EmojiPicker';
import { FieldLabel, Input } from '@/components/ui/Input';
import { emojiIcon, listEmoji, ListIcon } from '@/components/ui/ListIcon';
import { TONES, isDecorativeTone } from '@/components/ui/tones';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useToast } from '@/components/ui/Toast';
import { useCollection, useProfile, useRepo } from '@/data/hooks';
import { newId, nowISO } from '@/lib/ids';
import type { List, ListItem } from '@/lib/types';
import { formatMoney, listTotals, progressLabel } from './money';
import { listTone } from '@/features/boards/tone';

function NewListModal({ open, onClose, nextPosition }: { open: boolean; onClose: () => void; nextPosition: number }) {
  const { put } = useRepo();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState<string | undefined>(undefined);

  const submit = async () => {
    const value = title.trim();
    if (!value) return;
    const now = nowISO();
    await put('lists', {
      id: newId(),
      title: value,
      icon: emojiIcon(emoji),
      position: nextPosition,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    });
    toast('Список создан');
    setTitle('');
    setEmoji(undefined);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый список"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!title.trim()}>
            Создать
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <FieldLabel htmlFor="new-list-title">Название</FieldLabel>
          <div className="flex items-center gap-2">
            <EmojiPickerButton value={emoji} onChange={setEmoji} label="Эмодзи списка" />
            <Input
              id="new-list-title"
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Купить, прочитать, посмотреть"
            />
          </div>
        </div>
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Создать
        </button>
      </form>
    </Modal>
  );
}

/**
 * Карточка списка: простая карточка с линией. Эмодзи — символ в строке (20 px), без эмодзи — приглушённая
 * иконка; название 14 px, «сделано 2 из 5» 13 px, полоса прогресса 3 px и остаток денег моноширинными цифрами.
 */
function ListCard({ list, items, currency }: { list: List; items: ListItem[]; currency: string }) {
  const totals = useMemo(() => listTotals(items), [items]);
  const ratio = totals.total ? totals.done / totals.total : 0;
  const tone = listTone(list);
  const emoji = listEmoji(list.icon);
  return (
    <Link
      to={`/lists/${list.id}`}
      className={`group flex min-h-32 flex-col p-4 focus-ring ${cardClass({ interactive: true })}`}
    >
      <div className="flex h-6 min-w-0 items-center gap-2">
        {emoji ? (
          <span aria-hidden="true" className="font-emoji w-5 shrink-0 text-center text-xl leading-none">
            {emoji}
          </span>
        ) : (
          <ListIcon name={list.icon} size={16} className="shrink-0 text-muted" />
        )}
        <h2 className="min-w-0 truncate text-title font-semibold text-text">{list.title}</h2>
        {isDecorativeTone(tone) ? <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-mark ${TONES[tone].solid}`} /> : null}
        {list.pinned ? (
          <span title="Закреплён в меню" className="ml-auto inline-flex shrink-0 text-muted">
            <Pin size={14} aria-hidden="true" />
            <span className="sr-only">Закреплён в меню</span>
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-small text-muted">{progressLabel(totals)}</p>

      <div className="mt-auto pt-4">
        <ProgressBar value={ratio} label={`Прогресс списка «${list.title}»: ${progressLabel(totals)}`} />
        {totals.hasPrices ? (
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="text-small text-muted">{totals.left ? 'Осталось' : 'Куплено на'}</span>
            <span className="truncate font-mono text-h2 font-medium text-text tabular-nums">
              {formatMoney(totals.left || totals.bought, currency)}
            </span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export function ListsPage() {
  const lists = useCollection('lists');
  const items = useCollection('listItems');
  const [profile] = useProfile();
  const [creating, setCreating] = useState(false);

  const ordered = useMemo(() => [...lists].sort((a, b) => a.position - b.position), [lists]);
  const byList = useMemo(() => {
    const map = new Map<string, ListItem[]>();
    for (const item of items) {
      const bucket = map.get(item.listId);
      if (bucket) bucket.push(item);
      else map.set(item.listId, [item]);
    }
    return map;
  }, [items]);

  const nextPosition = ordered.reduce((max, l) => Math.max(max, l.position + 1), 0);

  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader
        title="Списки"
        icon={<SectionIcon k="lists" size={20} />}
        description="Что купить, прочитать, посмотреть — с ценой, ссылкой и заметкой"
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" />
            Список
          </Button>
        }
      />

      {ordered.length ? (
        <div className="stagger mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map(list => (
            <ListCard key={list.id} list={list} items={byList.get(list.id) ?? []} currency={profile.currency} />
          ))}
        </div>
      ) : (
        <Card className="mt-6">
          <EmptyState
            compact
            k="lists"
            title="Списков пока нет"
            description="Заведи первый список — например «Купить» или «Прочитать»."
            action={
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                <Plus size={14} aria-hidden="true" />
                Список
              </Button>
            }
          />
        </Card>
      )}

      <NewListModal open={creating} onClose={() => setCreating(false)} nextPosition={nextPosition} />
    </div>
  );
}
