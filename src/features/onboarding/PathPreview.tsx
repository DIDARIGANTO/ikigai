import { Circle, CircleCheck } from 'lucide-react';

export interface PathNode {
  key: string;
  /** Что это за звено: «Мечта», «Цель на год»… */
  kind: string;
  /** Что человек уже вписал; пусто — звено ещё не собрано. */
  value?: string;
  /** Эмодзи, выбранное человеком, — стоит в строке перед значением. */
  emoji?: string;
  /** Уточнение под значением: когда и сколько. */
  meta?: string;
  /** Готово (уже сохранено), сейчас (заполняется на этом шаге) или впереди. */
  status: PathStatus;
}

export type PathStatus = 'done' | 'current' | 'todo';

const STATUS_TEXT: Record<PathStatus, string> = { done: 'готово', current: 'сейчас', todo: 'впереди' };

function StatusIcon({ status }: { status: PathStatus }) {
  if (status === 'done') return <CircleCheck size={16} aria-hidden="true" className="text-accent-strong" />;
  if (status === 'current') return <Circle size={16} strokeWidth={2} aria-hidden="true" className="text-accent-strong" />;
  return <Circle size={16} aria-hidden="true" className="text-control-border" />;
}

/**
 * Цепочка знакомства «мечта → цель → неделя → шаг»: простой вертикальный список. Слева значок
 * состояния 16 px (готово — галочка акцентом, сейчас — кольцо акцентом, впереди — пустой круг),
 * звенья соединены линией 1 px; справа название звена 14 px и вписанное значение 13 px.
 */
export function PathPreview({ nodes, className = '' }: { nodes: PathNode[]; className?: string }) {
  return (
    <ol aria-label="Твой путь" className={className}>
      {nodes.map((n, i) => {
        const status = n.status;
        const next = nodes[i + 1];
        return (
          <li key={n.key} className="relative flex gap-3 pb-5 last:pb-0">
            {next ? (
              <span
                aria-hidden="true"
                className={`absolute left-2 top-5.5 bottom-0.5 w-px -translate-x-1/2 ${
                  status === 'done' && next.status === 'done' ? 'bg-accent' : 'bg-border-strong'
                }`}
              />
            ) : null}
            <span className="mt-0.5 inline-flex shrink-0">
              <StatusIcon status={status} />
            </span>
            <span className="min-w-0">
              <span className={`block text-body font-medium ${status === 'todo' ? 'text-muted' : 'text-text'}`}>
                {n.kind}
                <span className="sr-only">: {STATUS_TEXT[status]}</span>
              </span>
              {n.value && status !== 'todo' ? (
                <span className="mt-0.5 block text-small text-muted break-words">
                  {n.emoji ? <span className="mr-1.5 font-emoji">{n.emoji}</span> : null}
                  {n.value}
                </span>
              ) : null}
              {n.value && n.meta && status !== 'todo' ? <span className="block text-small text-muted tabular-nums">{n.meta}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
