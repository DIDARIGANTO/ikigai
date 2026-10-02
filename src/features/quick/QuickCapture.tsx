import { createContext, useCallback, useContext, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { ArrowRight, ChevronDown, Inbox, Plus } from 'lucide-react';
import type { Area, Repeat } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { rememberFocus } from '@/components/ui/overlay';
import { Segmented } from '@/components/ui/Segmented';
import type { SegmentOption } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { Kbd } from '@/components/ui/Kbd';
import { useCollection } from '@/data/hooks';
import { newId, nowISO } from '@/lib/ids';
import { todayISO } from '@/lib/dates';
import { parseQuick } from '@/lib/parse/quickParse';
import type { TokenKind } from '@/lib/parse/quickParse';
import { created } from '@/lib/undo';
import { AREA_OPTIONS, goalGroups } from '@/features/tasks/TaskEditor';
import { EmojiButton } from '@/features/tasks/EmojiButton';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import { columnFor, newTask } from '@/features/tasks/useTaskActions';
import { destination, kindToType, noteTitleFrom, removeTokenKind } from './capture';
import type { QuickType } from './capture';
import { HighlightInput, TokenChips } from './parts';

export type { QuickType } from './capture';

const TYPE_OPTIONS: SegmentOption<QuickType>[] = [
  { value: 'task', label: 'Задача' },
  { value: 'reminder', label: 'Напомнить', ariaLabel: 'Напоминание' },
  { value: 'listItem', label: 'Покупка' },
  { value: 'note', label: 'Заметка' },
];

const REPEATS: { key: Repeat; label: string }[] = [
  { key: 'none', label: 'Один раз' },
  { key: 'daily', label: 'Каждый день' },
  { key: 'weekly', label: 'Каждую неделю' },
  { key: 'monthly', label: 'Каждый месяц' },
  { key: 'yearly', label: 'Каждый год' },
];

const PLACEHOLDER: Record<QuickType, string> = {
  task: 'Что сделать?',
  reminder: 'О чём напомнить?',
  listItem: 'Что купить?',
  note: 'Мысль, идея, черновик',
};

const FIELD_ID = 'quick-capture-field';
const TEXT = 'text-h2 font-medium';

/** Время в строке назначения — моноширинным: «Завтра <15:00> · 30 мин · Работа». */
function withMonoTime(text: string): ReactNode {
  return text.split(/(\b\d{1,2}:\d{2}\b)/).map((part, i) =>
    i % 2 ? (
      <span key={i} className="font-mono">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/** Строка «Подробнее»: подпись 13 px в колонке 96 px, поле справа — как свойства в редакторе задачи. */
function DetailRow({ label, htmlFor, id, children }: { label: string; htmlFor?: string; id?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-x-3">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-small text-muted">
          {label}
        </label>
      ) : (
        <span id={id} className="text-small text-muted">
          {label}
        </span>
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function QuickCaptureDialog({ initialType, onClose }: { initialType: QuickType | null; onClose: () => void }) {
  const toast = useToast();
  const { columns, goals, commit } = useTaskActionsCtx();
  const boards = useCollection('boards');
  const lists = useCollection('lists');
  const listItems = useCollection('listItems');
  const folders = useCollection('noteFolders');

  const [text, setText] = useState('');
  const [typePick, setTypePick] = useState<QuickType | null>(initialType);
  const [emojiPick, setEmojiPick] = useState<string | undefined>();
  const [details, setDetails] = useState(false);
  // Выбор в «Подробнее». `null` — берём из текста.
  const [boardId, setBoardId] = useState('');
  const [columnId, setColumnId] = useState('');
  const [goalPick, setGoalPick] = useState<string | null>(null);
  const [areaPick, setAreaPick] = useState<Area | null>(null);
  const [repeatPick, setRepeatPick] = useState<Repeat | null>(null);
  const [listPick, setListPick] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const uid = useId();

  const activeGoals = useMemo(() => goals.filter(g => g.status === 'active'), [goals]);
  const groups = useMemo(() => goalGroups(goals), [goals]);
  const now = new Date();
  const parsed = useMemo(
    () => parseQuick(text, { now: new Date(), goals: activeGoals, lists }),
    [text, activeGoals, lists],
  );

  const type = typePick ?? kindToType(parsed.kind);
  const area: Area = areaPick ?? parsed.area ?? 'personal';
  const goalId = goalPick ?? parsed.goalId ?? '';
  const repeat: Repeat = repeatPick ?? parsed.repeat ?? 'none';
  const listId = listPick ?? parsed.listId ?? lists[0]?.id ?? '';
  const emoji = emojiPick ?? parsed.emoji;
  const board = boards.find(b => b.id === boardId);
  const boardColumns = columns.filter(c => c.boardId === boardId).sort((a, b) => a.position - b.position);
  const inboxFolder = folders.find(f => f.title === 'Входящие') ?? folders[0];
  const today = todayISO();

  const dest = destination(
    type,
    { ...parsed, area },
    { now, today, boardTitle: board?.title, listTitle: lists.find(l => l.id === listId)?.title, folderTitle: inboxFolder?.title },
  );

  const focusField = () => requestAnimationFrame(() => input.current?.focus());

  const removeToken = (kind: TokenKind) => {
    setText(t => removeTokenKind(t, parsed.tokens, kind));
    focusField();
  };

  const appendWord = (word: string) => {
    setText(t => (t.trim() ? `${t.trimEnd()} ${word} ` : `${word} `));
    focusField();
  };

  const reset = () => {
    setText('');
    setTypePick(null);
    setEmojiPick(undefined);
    setGoalPick(null);
    setAreaPick(null);
    setRepeatPick(null);
    focusField();
  };

  const save = async () => {
    const title = (type === 'note' ? parsed.title || text : parsed.title).trim();
    if (!title) return;
    const stamp = nowISO();
    const base = { id: newId(), createdAt: stamp, updatedAt: stamp };

    if (type === 'task') {
      await commit('Записано', [
        created(
          'tasks',
          newTask({
            title,
            emoji,
            area,
            date: parsed.date,
            plannedStart: parsed.time,
            plannedMinutes: parsed.minutes,
            important: parsed.important || undefined,
            goalId: goalId || undefined,
            boardId: boardId || undefined,
            columnId: boardId ? columnId || columnFor(columns, boardId, 'todo') : undefined,
          }),
        ),
      ]);
    } else if (type === 'reminder') {
      await commit('Записано', [
        created('reminders', { ...base, text: title, date: parsed.date ?? today, time: parsed.time, repeat }),
      ]);
    } else if (type === 'listItem') {
      if (!listId) {
        toast('Сначала создай список', { kind: 'error' });
        return;
      }
      const position = listItems.filter(i => i.listId === listId).reduce((m, i) => Math.max(m, i.position + 1), 0);
      await commit('Записано', [created('listItems', { ...base, listId, text: title, price: parsed.price, position })]);
    } else {
      await commit('Записано', [
        created('notes', { ...base, folderId: inboxFolder?.id, title: noteTitleFrom(title), body: title, source: 'web' }),
      ]);
    }
    reset();
  };

  // Enter в поле сохраняет и оставляет диалог открытым для следующей записи.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void save();
  };

  const extraChips: ReactNode[] = [];
  if (board && type === 'task') {
    extraChips.push(
      <li key="board">
        <Chip onClick={() => setBoardId('')} aria-label={`Убрать доску: ${board.title}`}>
          Доска «{board.title}»
        </Chip>
      </li>,
    );
  }

  const hasDate = parsed.tokens.some(t => t.kind === 'date');
  const showWhenHints = (type === 'task' || type === 'reminder') && !hasDate;

  return (
    <Modal
      open
      onClose={onClose}
      title="Быстрая запись"
      footer={
        <div className="flex w-full items-center gap-2">
          <p className="mr-auto hidden items-center gap-1 text-caption text-muted sm:flex">
            <Kbd>Enter</Kbd>
            <span className="mr-2">записать</span>
            <Kbd>Esc</Kbd>
            <span>закрыть</span>
          </p>
          <Button variant="ghost" onClick={onClose} className="max-sm:ml-auto">
            Закрыть
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!parsed.title.trim() && !(type === 'note' && text.trim())}>
            Записать
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex h-12 items-center gap-1 rounded-control border border-control-border bg-surface pl-2 pr-3 transition-colors duration-(--duration-fast) hover:border-muted focus-within:border-accent focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent">
          <EmojiButton
            value={emoji}
            onChange={e => {
              // Эмодзи из текста убираем вместе с выбором, иначе оно вернётся при следующем разборе.
              if (!e && parsed.emoji) setText(t => removeTokenKind(t, parsed.tokens, 'emoji'));
              setEmojiPick(e);
            }}
            label="Эмодзи записи"
          />
          <HighlightInput
            id={FIELD_ID}
            ref={input}
            autoFocus
            value={text}
            onValueChange={setText}
            tokens={parsed.tokens}
            textClass={TEXT}
            aria-label="Текст записи"
            aria-describedby={`${uid}-dest`}
            placeholder={PLACEHOLDER[type]}
            onKeyDown={onKeyDown}
            enterKeyHint="done"
            autoComplete="off"
          />
          <span className={`shrink-0 transition-opacity duration-(--duration-fast) ${text.trim() ? 'opacity-100' : 'opacity-0'}`}>
            <Kbd>↵</Kbd>
          </span>
        </div>

        <div className="flex min-h-6 items-center">
          {parsed.tokens.some(t => t.kind !== 'emoji' && t.kind !== 'kind') || extraChips.length ? (
            <TokenChips tokens={parsed.tokens} onRemove={removeToken} extra={extraChips.length ? extraChips : undefined} />
          ) : (
            <p className="text-caption text-muted">Пиши как говоришь: «завтра в 15 на 30м», #работа, ^цель, ! — важное</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p id={`${uid}-dest`} aria-live="polite" className="inline-flex min-w-0 items-center gap-1.5 text-small text-muted">
            {dest.inbox ? <Inbox size={14} aria-hidden="true" className="shrink-0" /> : <ArrowRight size={14} aria-hidden="true" className="shrink-0" />}
            <span className="truncate tabular-nums">{withMonoTime(dest.text)}</span>
          </p>
          {showWhenHints ? (
            <div className="ml-auto flex items-center gap-1" role="group" aria-label="Добавить дату">
              {['сегодня', 'завтра'].map(w => (
                <Chip key={w} icon={<Plus size={12} />} onClick={() => appendWord(w)}>
                  {w === 'сегодня' ? 'Сегодня' : 'Завтра'}
                </Chip>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Segmented label="Тип записи" value={type} options={TYPE_OPTIONS} onChange={setTypePick} />
          {type === 'note' ? null : (
            <button
              type="button"
              aria-expanded={details}
              aria-controls={`${uid}-details`}
              onClick={() => setDetails(d => !d)}
              className="focus-ring -mr-2 inline-flex h-8 items-center gap-1.5 rounded-control px-2 text-small font-medium text-muted-strong hover:bg-fill hover:text-text pointer-coarse:h-11"
            >
              Подробнее
              <ChevronDown
                size={14}
                aria-hidden="true"
                className={`transition-transform duration-(--duration-base) ease-out-soft ${details ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>

        {type !== 'note' && details ? (
          <div id={`${uid}-details`} className="animate-in space-y-2 border-t border-border pt-3">
            {type === 'task' ? (
              <>
                <DetailRow label="Доска" htmlFor={`${uid}-board`}>
                  <Select
                    id={`${uid}-board`}
                    value={boardId}
                    onChange={e => {
                      setBoardId(e.target.value);
                      setColumnId('');
                    }}
                  >
                    <option value="">Без доски</option>
                    {boards.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                      </option>
                    ))}
                  </Select>
                </DetailRow>
                {boardId ? (
                  <DetailRow label="Колонка" htmlFor={`${uid}-col`}>
                    <Select id={`${uid}-col`} value={columnId} onChange={e => setColumnId(e.target.value)}>
                      <option value="">Первая колонка</option>
                      {boardColumns.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </Select>
                  </DetailRow>
                ) : null}
                <DetailRow label="Цель" htmlFor={`${uid}-goal`}>
                  <Select id={`${uid}-goal`} value={goalId} onChange={e => setGoalPick(e.target.value)}>
                    <option value="">Без цели</option>
                    {groups.map(g => (
                      <optgroup key={g.key} label={g.label}>
                        {g.items.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.emoji ? `${item.emoji} ` : ''}
                            {item.title}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </DetailRow>
                <DetailRow label="Сфера" id={`${uid}-area`}>
                  <Segmented labelledBy={`${uid}-area`} value={area} options={AREA_OPTIONS} onChange={setAreaPick} />
                </DetailRow>
              </>
            ) : null}
            {type === 'reminder' ? (
              <DetailRow label="Повтор" htmlFor={`${uid}-repeat`}>
                <Select id={`${uid}-repeat`} value={repeat} onChange={e => setRepeatPick(e.target.value as Repeat)}>
                  {REPEATS.map(r => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </DetailRow>
            ) : null}
            {type === 'listItem' ? (
              <DetailRow label="Список" htmlFor={`${uid}-list`}>
                <Select id={`${uid}-list`} value={listId} onChange={e => setListPick(e.target.value)}>
                  {lists.length ? null : <option value="">Нет списков</option>}
                  {lists.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </Select>
              </DetailRow>
            ) : null}
            {type === 'task' || type === 'reminder' ? (
              <p className="pt-1 text-caption text-muted">
                Дату, время и длительность пиши словами: «в пт в 10 на 45м», «через неделю», «14.10».
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

interface QuickCaptureApi {
  open: (type?: QuickType) => void;
}

const Ctx = createContext<QuickCaptureApi>({ open: () => {} });

// oxlint-disable-next-line react/only-export-components -- хук живёт рядом со своим провайдером
export function useQuickCapture(): QuickCaptureApi {
  return useContext(Ctx);
}

export function QuickCaptureProvider({ children }: { children: ReactNode }) {
  // `false` — закрыто; `null` — открыто, тип определит текст; иначе — выбранный тип.
  const [state, setState] = useState<QuickType | null | false>(false);
  // typeof — защита от вызова прямо из onClick, где первым аргументом придёт событие.
  const open = useCallback((next?: QuickType) => {
    rememberFocus();
    setState(typeof next === 'string' ? next : null);
  }, []);
  const close = useCallback(() => setState(false), []);
  const api = useMemo<QuickCaptureApi>(() => ({ open }), [open]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {state !== false ? <QuickCaptureDialog initialType={state} onClose={close} /> : null}
    </Ctx.Provider>
  );
}
