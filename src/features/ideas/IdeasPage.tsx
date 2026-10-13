import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, Lightbulb, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Idea } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Menu } from '@/components/ui/Menu';
import type { MenuEntry } from '@/components/ui/Menu';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { Segmented } from '@/components/ui/Segmented';
import { useCollection } from '@/data/hooks';
import { formatShortRu } from '@/lib/dates';
import {
  IDEA_MOVE_LABEL,
  IDEA_STATUS_LABEL,
  IDEA_STATUSES,
  moveIdea,
  NEXT_IDEA_STATUS,
  splitIdeas,
  statusOf,
} from '@/lib/domain/ideas';
import type { IdeaStatus } from '@/lib/domain/ideas';
import { newId, nowISO } from '@/lib/ids';
import { created, deleted, updated, useUndoable } from '@/lib/undo';
import { IdeaEditor } from './IdeaEditor';
import type { IdeaFields } from './IdeaEditor';

const FOCUS = 'focus-ring-inset';

interface RowActions {
  open: (i: Idea) => void;
  move: (i: Idea, to: IdeaStatus) => void;
  remove: (i: Idea) => void;
}

/**
 * Строка идеи: лампочка, название, заметка (две строки), когда записана и откуда пришла. Вся строка открывает редактор;
 * при наведении есть кнопка «дальше» (новая → в работе → реализована), а перенос на любой этап, изменить и удалить — в меню справа.
 */
function IdeaRow({ idea, actions }: { idea: Idea; actions: RowActions }) {
  const status = statusOf(idea);
  const next = NEXT_IDEA_STATUS[status];
  const meta = [formatShortRu(idea.createdAt.slice(0, 10)), idea.source === 'telegram' ? 'из Telegram' : null].filter(Boolean).join(' · ');
  const entries: MenuEntry[] = [
    { type: 'item', label: 'Изменить', icon: <Pencil size={14} />, onSelect: () => actions.open(idea) },
    ...IDEA_STATUSES.filter(st => st !== status).map<MenuEntry>(st => ({
      type: 'item',
      label: IDEA_MOVE_LABEL[st],
      icon: st === 'done' ? <Check size={14} /> : <ArrowRight size={14} />,
      onSelect: () => actions.move(idea, st),
    })),
    { type: 'separator' },
    { type: 'item', label: 'Удалить', icon: <Trash2 size={14} />, danger: true, onSelect: () => actions.remove(idea) },
  ];
  return (
    <li className="group flex items-center border-b border-border pr-2 last:border-b-0 hover:bg-fill focus-within:bg-fill">
      <button
        type="button"
        onClick={() => actions.open(idea)}
        aria-label={`Идея: ${idea.title}`}
        className={`flex min-h-14 min-w-0 flex-1 items-start gap-3 py-3 pl-4 pr-2 text-left ${FOCUS}`}
      >
        <span aria-hidden="true" className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-mark bg-fill-strong text-muted-strong">
          <Lightbulb size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-body font-medium text-text">{idea.title}</span>
          {idea.note ? <span className="mt-0.5 line-clamp-2 break-words text-small text-muted-strong">{idea.note}</span> : null}
          <span className="mt-0.5 block text-caption text-muted">{meta}</span>
        </span>
      </button>
      {next ? (
        <Button
          variant="ghost"
          size="sm"
          className="hover-reveal shrink-0 max-sm:px-2"
          aria-label={`Перенести в «${IDEA_STATUS_LABEL[next]}»: ${idea.title}`}
          title={`Перенести в «${IDEA_STATUS_LABEL[next]}»`}
          onClick={() => actions.move(idea, next)}
        >
          {next === 'done' ? <Check size={16} aria-hidden="true" className="sm:hidden" /> : <ArrowRight size={16} aria-hidden="true" className="sm:hidden" />}
          <span className="max-sm:hidden">{IDEA_MOVE_LABEL[next]}</span>
        </Button>
      ) : null}
      <Menu label={`Действия: ${idea.title}`} entries={entries} size="sm" triggerClassName="hover-reveal" />
    </li>
  );
}

/** Что сказать на пустой вкладке. */
const EMPTY: Record<IdeaStatus, { title: string; description: string }> = {
  new: { title: 'Новых идей нет', description: 'Запиши мысль в строке выше: одна строка и Enter, остальное допишешь потом.' },
  work: { title: 'В работе пока ничего нет', description: 'Когда берёшься за идею, перенеси её сюда.' },
  done: { title: 'Реализованных идей пока нет', description: 'Когда идея доведена до дела, перенеси её сюда.' },
};

export function IdeasPage() {
  const ideas = useCollection('ideas');
  const commit = useUndoable();
  const [params, setParams] = useSearchParams();

  const [editor, setEditor] = useState<{ idea: Idea | null } | null>(null);
  const [quick, setQuick] = useState('');
  const groups = useMemo(() => splitIdeas(ideas), [ideas]);

  // Вкладка живёт в адресе (`/ideas?tab=work`): страницу можно обновить или отправить ссылкой. Без неё открыты «Новые».
  const tabParam = params.get('tab');
  const tab: IdeaStatus = IDEA_STATUSES.find(st => st === tabParam) ?? 'new';
  const setTab = (next: IdeaStatus) =>
    setParams(
      p => {
        if (next === 'new') p.delete('tab');
        else p.set('tab', next);
        return p;
      },
      { replace: true },
    );
  const shown = groups[tab];

  // Ссылка из поиска: `/ideas?idea=<id>` открывает редактор этой идеи; редактор выводится из адреса, а не копируется в состояние.
  const wanted = params.get('idea');
  const urlIdea = wanted ? (ideas.find(i => i.id === wanted) ?? null) : null;
  const current = editor ?? (urlIdea ? { idea: urlIdea } : null);
  const closeEditor = () => {
    setEditor(null);
    if (wanted) {
      setParams(
        p => {
          p.delete('idea');
          return p;
        },
        { replace: true },
      );
    }
  };

  const add = () => setEditor({ idea: null });

  const save = async (fields: IdeaFields) => {
    const existing = current?.idea;
    const now = nowISO();
    if (existing) {
      await commit('Сохранено', [updated('ideas', existing, { ...existing, ...fields })]);
    } else {
      await commit('Идея записана', [created('ideas', { id: newId(), createdAt: now, updatedAt: now, source: 'web', ...fields })]);
    }
    // Страница идёт за идеей на её вкладку: иначе записанная на другом этапе пропала бы из виду.
    // Если редактор открыт по ссылке из поиска, адрес правит закрытие редактора, и вкладку не трогаем.
    if (!wanted && fields.status && fields.status !== tab) setTab(fields.status);
  };

  /** Быстрая запись одной строкой: идея сразу «новая», а вкладка «Новые» открывается, чтобы её было видно. */
  const jot = async (e: FormEvent) => {
    e.preventDefault();
    const title = quick.trim();
    if (!title) return;
    const now = nowISO();
    setQuick('');
    await commit('Идея записана', [created('ideas', { id: newId(), createdAt: now, updatedAt: now, source: 'web', title, status: 'new' })]);
    if (tab !== 'new') setTab('new');
  };

  const actions: RowActions = {
    open: i => setEditor({ idea: i }),
    move: (i, to) => void commit(`Перенесено: ${IDEA_STATUS_LABEL[to]}`, [updated('ideas', i, moveIdea(i, to))]),
    remove: i => void commit('Идея удалена', [deleted('ideas', i)]),
  };

  const empty = tab === 'new' && ideas.length === 0 ? { title: 'Идей пока нет', description: EMPTY.new.description } : EMPTY[tab];

  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader
        title="Идеи"
        icon={<SectionIcon k="ideas" size={20} />}
        description="Всё, что пришло в голову"
        actions={
          <Button variant="primary" onClick={add}>
            <Plus size={16} aria-hidden="true" />
            Идея
          </Button>
        }
      />

      <form onSubmit={e => void jot(e)} className="mt-6 flex items-center gap-2">
        <Input aria-label="Новая идея" value={quick} onChange={e => setQuick(e.target.value)} placeholder="Новая идея: одна строка и Enter" autoComplete="off" />
        <Button type="submit" variant="secondary" disabled={quick.trim() === ''}>
          Записать
        </Button>
      </form>

      <nav aria-label="Этапы идей" className="mt-4 min-w-0 max-w-full">
        <Segmented
          label="Идеи"
          value={tab}
          onChange={setTab}
          kind="tabs"
          options={IDEA_STATUSES.map(st => ({ value: st, label: IDEA_STATUS_LABEL[st], count: groups[st].length }))}
        />
      </nav>

      {shown.length === 0 ? (
        <Card className="mt-4">
          <EmptyState compact k="ideas" title={empty.title} description={empty.description} />
        </Card>
      ) : (
        <Card as="div" className="animate-in mt-4 overflow-hidden">
          <ul>
            {shown.map(i => (
              <IdeaRow key={i.id} idea={i} actions={actions} />
            ))}
          </ul>
        </Card>
      )}

      {current ? (
        <IdeaEditor
          key={current.idea?.id ?? 'new'}
          idea={current.idea}
          defaultStatus={tab}
          onSave={save}
          onDelete={i => actions.remove(i)}
          onClose={closeEditor}
        />
      ) : null}
    </div>
  );
}
