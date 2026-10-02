import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Check, ChevronDown, Dumbbell, Flag, GripVertical, Hourglass, Play, Square } from 'lucide-react';
import type { Goal } from '@/lib/types';
import { GoalChip } from '@/features/goals/GoalChip';
import { formatElapsed, useElapsed } from '@/features/tasks/TaskTimer';
import { isRunning } from '@/lib/domain/tasks';
import {
  durationLabel,
  earlyMinutes,
  factGeometry,
  formatRange,
  overrunMinutes,
  yAt,
} from '@/lib/domain/timeline';
import type { Row, TimelineBlock } from '@/lib/domain/timeline';
import { blockLook, laneStyle } from './blockLook';
import { MissedActions } from './MissedActions';
import type { MissedHandlers } from './MissedActions';

/** Минимальная высота блока: заголовок и время всегда в одну строку, и по нему удобно попасть пальцем. */
const MIN_BLOCK_PX = 44;
/** Если сосед снизу вплотную — блок не лезет на него, но и не становится тоньше этого. */
const FLOOR_BLOCK_PX = 24;
/** С этой высоты время — отдельной строкой под заголовком. */
const ROOMY_PX = 52;
/** С этой высоты заголовок и время в узком блоке встают в две строки. */
const STACK_PX = 38;
const GOAL_PX = 92;

/** Маленькая кнопка в блоке (24 px): поверхность и линия, на сенсорных — невидимое поле до 44 px. */
const MINI_BUTTON =
  "focus-ring press relative size-6 shrink-0 items-center justify-center rounded-chip border border-border-strong bg-surface text-muted-strong hover:bg-fill hover:text-text pointer-coarse:before:absolute pointer-coarse:before:-inset-2.5 pointer-coarse:before:content-['']";

export type BlockState = 'idle' | 'lifted' | 'ghost';

export interface BlockViewProps {
  block: TimelineBlock;
  range: { start: number; end: number };
  rows: Row[];
  date: string;
  nowMin: number | null;
  missed: boolean;
  goal?: Goal;
  state: BlockState;
  hintId: string;
  onOpen: () => void;
  onBodyPointerDown: (e: ReactPointerEvent) => void;
  onGripPointerDown: (e: ReactPointerEvent) => void;
  onResizePointerDown: (e: ReactPointerEvent) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  onStart: () => void;
  onFinish: () => void;
  missedHandlers: MissedHandlers;
}

/**
 * Блок расписания «план против факта»: нейтральная плашка с полосой смысла слева — план,
 * тонкая акцентная дорожка справа — факт. Переработка продолжает дорожку цветом предупреждения
 * и подписью «+12 мин», ранний финиш — «−10 мин».
 */
export function TimelineBlockView({
  block,
  range,
  rows,
  date,
  nowMin,
  missed,
  goal,
  state,
  hintId,
  onOpen,
  onBodyPointerDown,
  onGripPointerDown,
  onResizePointerDown,
  onKeyDown,
  onStart,
  onFinish,
  missedHandlers,
}: BlockViewProps) {
  const { task } = block;
  const running = isRunning(task);
  // Тикает раз в секунду только у идущей задачи: остальные блоки не перерисовываются.
  const seconds = useElapsed(task.actualStart, running);
  const [menuOpen, setMenuOpen] = useState(false);
  const missedBtn = useRef<HTMLButtonElement>(null);

  const look = blockLook(task, { running, missed });
  const lifted = state === 'lifted';
  const top = yAt(rows, range.start);
  const natural = yAt(rows, range.end) - top;
  const room = lifted ? Infinity : yAt(rows, block.nextStart) - top - 2;
  const height = Math.max(Math.min(Math.max(natural, MIN_BLOCK_PX), room), Math.min(natural, FLOOR_BLOCK_PX), FLOOR_BLOCK_PX);
  const roomy = height >= ROOMY_PX;
  // Две строки (заголовок над временем) — там, где высоты хватает, а ширины мало (узкая колонка, телефон).
  const stacked = height >= STACK_PX;

  const fact = lifted ? null : factGeometry(task, date);
  const planEnd = range.end;
  const over = fact ? overrunMinutes(planEnd, fact.end) : 0;
  const early = fact && task.status === 'done' ? earlyMinutes(planEnd, fact.end) : 0;
  const factY = (min: number) => yAt(rows, min) - top;

  const time = formatRange(range.start, range.end);
  const skipped = task.status === 'skipped';
  const label = `${task.title}, ${time}${task.important ? ', важная' : ''}${missed ? ', пропущено' : ''}${
    running ? ', идёт' : ''
  }${task.status === 'done' ? ', сделано' : ''}${skipped ? ', не делал' : ''}`;

  // Что помещается, решает ширина самого блока (контейнерные запросы), а не число колонок:
  // одна и та же колонка широкая на компьютере и узкая на телефоне.
  let action: ReactNode = null;
  if (missed && nowMin !== null) {
    action = (
      <button
        ref={missedBtn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        aria-label={`«${task.title}»: пропущено — выбрать, что сделать`}
        onClick={() => setMenuOpen(o => !o)}
        className={`focus-ring relative inline-flex h-6 items-center gap-0.5 rounded-chip px-1 text-caption font-medium text-warning-strong hover:bg-fill pointer-coarse:before:absolute pointer-coarse:before:-inset-2.5 pointer-coarse:before:content-[''] ${
          menuOpen ? 'bg-fill' : ''
        }`}
      >
        <Hourglass size={14} aria-hidden="true" className="@3xs:hidden" />
        <span aria-hidden="true" className="hidden pl-0.5 @3xs:inline">
          Пропущено
        </span>
        <ChevronDown size={14} aria-hidden="true" className="hidden @3xs:inline" />
      </button>
    );
  } else if (running) {
    action = (
      <span className="flex items-center gap-2">
        <span className="hidden font-mono text-caption text-accent-strong @3xs:inline" title="Идёт с начала работы">
          {formatElapsed(seconds)}
        </span>
        <button type="button" aria-label={`Закончить «${task.title}»`} onClick={onFinish} className={`${MINI_BUTTON} inline-flex`}>
          <Square size={10} fill="currentColor" aria-hidden="true" />
        </button>
      </span>
    );
  } else if (task.status === 'done') {
    action = <Check size={14} aria-hidden="true" className="hidden text-success-strong @3xs:inline" />;
  } else if (skipped) {
    action = <span className="hidden text-caption text-muted @3xs:inline">не делал</span>;
  } else {
    action = (
      <button
        type="button"
        aria-label={`Начать «${task.title}»`}
        onClick={onStart}
        className={`${MINI_BUTTON} hover-reveal hidden @3xs:inline-flex`}
      >
        <Play size={10} fill="currentColor" aria-hidden="true" />
      </button>
    );
  }

  const lead = task.emoji ? (
    <span aria-hidden="true" className="font-emoji shrink-0">
      {task.emoji}
    </span>
  ) : task.kind === 'workout' ? (
    <Dumbbell size={14} aria-hidden="true" className="shrink-0 text-muted" />
  ) : null;

  const title = (
    <span className={`flex min-w-0 items-center gap-1 text-small font-medium ${look.title} ${roomy ? 'flex-1' : ''}`} title={task.title}>
      {lead}
      <span className="min-w-0 truncate">{task.title}</span>
      {task.important ? (
        <Flag
          size={12}
          aria-hidden="true"
          fill="currentColor"
          fillOpacity={0.2}
          className={`ml-0.5 shrink-0 ${look.closed ? 'text-muted' : 'text-important-strong'}`}
        />
      ) : null}
    </span>
  );

  // Разница с планом: идёт или закончили позже — «+12 мин», раньше — «−10 мин».
  const delta =
    over > 0 ? (
      <span className="font-mono text-warning-strong">
        +{durationLabel(over)}
        <span className="sr-only"> сверх плана</span>
      </span>
    ) : early > 0 ? (
      <span className="font-mono text-success-strong">
        −{durationLabel(early)}
        <span className="sr-only"> раньше плана</span>
      </span>
    ) : null;

  const meta = (
    <span
      className={`shrink-0 items-baseline gap-2 text-caption text-muted ${!roomy && !stacked ? 'hidden @3xs:flex' : 'flex'}`}
    >
      <span className="font-mono">{time}</span>
      {delta}
    </span>
  );

  const actionSlot = action ? <span className="pointer-events-auto relative z-10 flex shrink-0 items-center">{action}</span> : null;

  return (
    <div
      data-tl-block={task.id}
      className={`pointer-events-none absolute ${lifted ? 'z-30' : 'z-10 motion-safe:transition-[top,height] duration-(--duration-slow) ease-out-soft'} ${
        state === 'ghost' ? 'opacity-35' : ''
      }`}
      style={{ top: top + 1, height: height - 2, ...laneStyle(block.lane, block.lanes) }}
    >
      {/* План: нейтральная плашка, смысл — полосой слева. */}
      <div
        className={`group @container pointer-events-auto absolute inset-y-0 left-0 right-1.5 overflow-hidden rounded-control border ${look.box} ${
          lifted ? 'cursor-grabbing shadow-(--shadow-pop)' : ''
        }`}
      >
        {running ? <span aria-hidden="true" className="absolute inset-0 bg-fill" /> : null}
        <span aria-hidden="true" className={`absolute inset-y-1 left-1 w-0.5 rounded-bar ${look.bar}`} />

        <button
          type="button"
          aria-label={label}
          aria-describedby={hintId}
          onClick={onOpen}
          onPointerDown={onBodyPointerDown}
          onKeyDown={onKeyDown}
          onContextMenu={e => e.preventDefault()}
          className="absolute inset-0 cursor-grab select-none rounded-control focus-ring-inset hover:bg-fill"
        />

        {roomy ? (
          <div className="pointer-events-none relative flex h-full min-w-0 flex-col py-1 pr-1 pl-3 pointer-coarse:pl-7">
            <div className="flex h-6 min-w-0 items-center gap-2">
              {title}
              {actionSlot}
            </div>
            {meta}
            {goal && height >= GOAL_PX ? (
              <span className="mt-auto hidden min-w-0 pb-0.5 @2xs:flex">
                <GoalChip goal={goal} />
              </span>
            ) : null}
          </div>
        ) : (
          <div className="pointer-events-none relative flex h-full min-w-0 items-center gap-2 pr-1 pl-3 pointer-coarse:pl-7">
            <div
              className={`flex min-w-0 flex-1 ${
                stacked ? 'flex-col @xs:flex-row @xs:items-baseline @xs:gap-2' : 'items-baseline gap-2'
              }`}
            >
              {title}
              {meta}
            </div>
            {actionSlot}
          </div>
        )}

        {/* Ручка для пальца: берёт блок сразу, без долгого нажатия. */}
        <span
          aria-hidden="true"
          onPointerDown={onGripPointerDown}
          className="absolute inset-y-0 left-2 hidden w-4 touch-none items-center justify-center text-muted pointer-coarse:flex"
        >
          <GripVertical size={14} />
        </span>

        {/* Нижний край — растянуть. */}
        {look.closed ? null : (
          <span
            aria-hidden="true"
            onPointerDown={onResizePointerDown}
            className="absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize touch-none items-end justify-center pb-1 pointer-coarse:h-4"
          >
            <span className="hover-reveal h-0.5 w-6 rounded-bar bg-border-strong" />
          </span>
        )}
      </div>

      {/* Факт: дорожка 3 px справа от плана — видно, раньше или позже начали и где закончили. */}
      {fact && fact.end > fact.start ? (
        <>
          {fact.start < planEnd ? (
            <span
              aria-hidden="true"
              className={`absolute right-0 w-0.75 rounded-bar bg-accent`}
              style={{ top: factY(fact.start), height: Math.max(3, factY(Math.min(fact.end, planEnd)) - factY(fact.start)) }}
            />
          ) : null}
          {over > 0 ? (
            <span
              aria-hidden="true"
              className={`absolute right-0 w-0.75 rounded-bar bg-warning`}
              style={{
                top: factY(Math.max(planEnd, fact.start)),
                height: Math.max(3, factY(fact.end) - factY(Math.max(planEnd, fact.start))),
              }}
            />
          ) : null}
        </>
      ) : null}

      {missed && nowMin !== null ? (
        <MissedActions
          task={task}
          anchor={missedBtn}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          nowMin={nowMin}
          duration={range.end - range.start}
          {...missedHandlers}
        />
      ) : null}
    </div>
  );
}
