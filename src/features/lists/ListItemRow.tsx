import { useRef, useState } from 'react';
import { ExternalLink, Pencil, SlidersHorizontal, StickyNote, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Menu } from '@/components/ui/Menu';
import { useToast } from '@/components/ui/Toast';
import { useRepo } from '@/data/hooks';
import { nowISO } from '@/lib/ids';
import type { ListItem } from '@/lib/types';
import { formatMoney } from './money';

/**
 * Строка пункта 40 px с линией снизу: отметка, название (переименование по клику), значки ссылки и заметки 14 px,
 * цена справа моноширинными цифрами и меню «⋯», которое проявляется при наведении.
 */
export function ItemRow({
  item,
  currency,
  onOpenDetails,
  onChecked,
}: {
  item: ListItem;
  currency: string;
  onOpenDetails: (item: ListItem) => void;
  /** Пункт только что отметили — строка передаёт себя, чтобы праздник вылетел из неё. */
  onChecked?: (item: ListItem, from: Element) => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  const { put, remove } = useRepo();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const [noteOpen, setNoteOpen] = useState(false);
  const done = !!item.doneAt;

  const commit = async () => {
    setEditing(false);
    const text = draft.trim();
    if (!text || text === item.text) {
      setDraft(item.text);
      return;
    }
    await put('listItems', { ...item, text });
  };

  const startEditing = () => {
    setDraft(item.text);
    setEditing(true);
  };

  const onDelete = async () => {
    if (!(await confirm(`Удалить пункт «${item.text}»?`))) return;
    await remove('listItems', item.id);
    toast('Пункт удалён');
  };

  return (
    <li className="group border-b border-border last:border-b-0">
      <div ref={row} className="flex min-h-10 items-center gap-2 pl-4 pr-2 hover:bg-fill">
        <Checkbox
          checked={done}
          className="mr-1"
          aria-label={done ? `Вернуть «${item.text}»` : `Отметить «${item.text}»`}
          onChange={next => {
            void put('listItems', { ...item, doneAt: next ? nowISO() : undefined });
            if (next && row.current) onChecked?.(item, row.current);
          }}
        />

        {editing ? (
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
                setDraft(item.text);
                setEditing(false);
              }
            }}
            aria-label="Название пункта"
            className="-ml-1.5 h-8 min-w-0 flex-1 rounded-control border border-accent bg-surface px-1.5 text-body outline-2 outline-offset-1 outline-accent"
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            title="Нажми, чтобы переименовать"
            className={`-ml-1.5 min-w-0 flex-1 truncate rounded-control px-1.5 py-1 text-left text-body focus-ring ${
              done ? 'text-muted line-through decoration-border-strong' : 'text-text'
            }`}
          >
            {item.text}
          </button>
        )}

        {item.url || item.note ? (
          <div className="flex shrink-0 items-center">
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`Ссылка: ${item.text}`}
                title={item.url}
                className="relative inline-flex h-8 w-8 items-center justify-center rounded-control text-muted hover:bg-fill hover:text-text focus-ring pointer-coarse:before:absolute pointer-coarse:before:-inset-1.5 pointer-coarse:before:content-['']"
              >
                <ExternalLink size={14} />
              </a>
            ) : null}
            {item.note ? (
              <IconButton
                size="sm"
                aria-label={noteOpen ? 'Скрыть заметку' : 'Показать заметку'}
                aria-expanded={noteOpen}
                onClick={() => setNoteOpen(o => !o)}
                className={noteOpen ? 'bg-fill text-text' : ''}
              >
                <StickyNote size={14} />
              </IconButton>
            ) : null}
          </div>
        ) : null}

        {typeof item.price === 'number' ? (
          <span
            className={`shrink-0 pl-2 font-mono text-body tabular-nums ${
              done ? 'text-muted line-through decoration-border-strong' : 'text-text'
            }`}
          >
            {formatMoney(item.price, currency)}
          </span>
        ) : null}

        <Menu
          label={`Настроить «${item.text}»`}
          size="sm"
          className="shrink-0"
          triggerClassName="hover-reveal"
          entries={[
            { type: 'item', label: 'Цена, ссылка, заметка', icon: <SlidersHorizontal size={14} />, onSelect: () => onOpenDetails(item) },
            { type: 'item', label: 'Переименовать', icon: <Pencil size={14} />, onSelect: startEditing },
            { type: 'separator' },
            { type: 'item', label: 'Удалить', icon: <Trash2 size={14} />, danger: true, onSelect: () => void onDelete() },
          ]}
        />
      </div>

      {noteOpen && item.note ? (
        <p className="animate-in mb-3 ml-11 mr-4 border-l-2 border-border-strong pl-3 text-small text-muted-strong whitespace-pre-wrap">
          {item.note}
        </p>
      ) : null}
    </li>
  );
}
