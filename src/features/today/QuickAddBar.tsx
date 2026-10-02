import { useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Kbd } from '@/components/ui/Kbd';
import { useCollection } from '@/data/hooks';
import { parseQuick } from '@/lib/parse/quickParse';
import type { TokenKind } from '@/lib/parse/quickParse';
import { created } from '@/lib/undo';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';
import { columnFor, newTask } from '@/features/tasks/useTaskActions';
import { removeTokenKind } from '@/features/quick/capture';
import { HighlightInput, TokenChips } from '@/features/quick/parts';

/** Доска для задач из строки «Добавить» — по сфере: «Работа» или «Личное», если такие доски есть. */
const BOARD_FOR_AREA = { work: 'Работа', personal: 'Личное' } as const;

/**
 * Строка быстрого добавления на «Сегодня»: тот же разбор, что и в быстрой записи,
 * только дата по умолчанию — показанный день. «в 15 на 30м #работа созвон» → задача на 15:00.
 * Enter создаёт задачу (с «Отменить» в тосте), Esc очищает и снимает фокус.
 */
export function QuickAddBar({ date }: { date: string }) {
  const { columns, goals, commit } = useTaskActionsCtx();
  const boards = useCollection('boards');
  const [text, setText] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  const activeGoals = useMemo(() => goals.filter(g => g.status === 'active'), [goals]);
  const parsed = useMemo(
    () => parseQuick(text, { now: new Date(), goals: activeGoals, lists: [], defaultDate: date }),
    [text, activeGoals, date],
  );
  // Покупки и заметки здесь не нужны: строка на «Сегодня» создаёт только задачи, поэтому чипы — без «Покупки».
  const tokens = parsed.tokens.filter(t => t.kind !== 'kind' && t.kind !== 'list' && t.kind !== 'repeat');

  const add = async () => {
    const title = parsed.title.trim();
    if (!title) return;
    const area = parsed.area ?? 'personal';
    const boardId = boards.find(b => b.title === BOARD_FOR_AREA[area])?.id;
    await commit(parsed.date === date ? 'Добавлено' : 'Записано', [
      created(
        'tasks',
        newTask({
          title,
          emoji: parsed.emoji,
          date: parsed.date ?? date,
          plannedStart: parsed.time,
          plannedMinutes: parsed.minutes,
          important: parsed.important || undefined,
          goalId: parsed.goalId,
          area,
          boardId,
          columnId: boardId ? columnFor(columns, boardId, 'todo') : undefined,
        }),
      ),
    ]);
    setText('');
  };

  const remove = (kind: TokenKind) => {
    setText(t => removeTokenKind(t, parsed.tokens, kind));
    ref.current?.focus();
  };

  return (
    <div>
      <form
        className="group relative flex h-10 items-center gap-2 rounded-control border border-control-border bg-surface pl-9 pr-2 transition-colors duration-(--duration-fast) hover:border-muted focus-within:border-accent focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent focus-within:hover:border-accent"
        onSubmit={e => {
          e.preventDefault();
          void add();
        }}
      >
        <Plus
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <HighlightInput
          ref={ref}
          value={text}
          onValueChange={setText}
          tokens={tokens}
          textClass="text-body"
          onKeyDown={e => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setText('');
              ref.current?.blur();
            }
          }}
          aria-label="Добавить задачу на сегодня"
          placeholder="Добавить на сегодня…"
          enterKeyHint="done"
          autoComplete="off"
        />
        {/* Пусто — подсказка клавиши быстрой записи; есть текст — Enter добавит задачу. */}
        <span className={`inline-flex shrink-0 ${text.trim() ? '' : 'group-focus-within:invisible'}`}>
          <Kbd>{text.trim() ? '↵' : 'N'}</Kbd>
        </span>
      </form>
      <TokenChips tokens={tokens} onRemove={remove} className="mt-2 px-2" />
    </div>
  );
}
