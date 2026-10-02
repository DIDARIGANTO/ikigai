import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import type { Area } from '@/lib/types';
import { newTask } from '@/features/tasks/useTaskActions';
import { useTaskActionsCtx } from '@/features/tasks/TaskActionsContext';

/** Примеры на пустой день: одно нажатие — задача на сегодня без времени, с оценкой. */
// oxlint-disable-next-line react/only-export-components -- примеры нужны и тестам
export const EXAMPLES: { title: string; minutes: number; area: Area }[] = [
  { title: 'Прогулка', minutes: 30, area: 'personal' },
  { title: 'Разобрать почту', minutes: 20, area: 'work' },
  { title: 'Читать', minutes: 30, area: 'personal' },
];

/** Три чипа-примера, простым текстом. Уже добавленный пример второй раз не предлагаем. */
export function ExampleChips({ date, className = '' }: { date: string; className?: string }) {
  const { save } = useTaskActionsCtx();
  const toast = useToast();
  const [added, setAdded] = useState<string[]>([]);
  const left = EXAMPLES.filter(e => !added.includes(e.title));
  if (!left.length) return null;

  return (
    <ul className={`flex flex-wrap gap-2 ${className}`} aria-label="Быстро добавить">
      {left.map(e => (
        <li key={e.title}>
          <Chip
            onClick={() => {
              setAdded(a => [...a, e.title]);
              void save(newTask({ title: e.title, date, plannedMinutes: e.minutes, area: e.area })).then(() =>
                toast(`Добавлено на сегодня: ${e.title}`),
              );
            }}
          >
            {e.title}
          </Chip>
        </li>
      ))}
    </ul>
  );
}

/** Пустой день, без задач вовсе: заголовок, одна строка, примеры и «Добавить задачу». */
export function FreeDay({ date, onAdd }: { date: string; onAdd?: () => void }) {
  return (
    <Card className="animate-in p-5" aria-labelledby="free-day-title" data-testid="now-free">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-56">
          <h2 id="free-day-title" className="text-h2 font-semibold text-text">
            На сегодня пока ничего
          </h2>
          <p className="mt-1 text-small text-muted">Добавь задачу или начни с одного из примеров.</p>
        </div>
        {onAdd ? (
          <Button variant="secondary" onClick={onAdd} className="max-sm:w-full">
            <Plus size={16} aria-hidden="true" />
            Добавить задачу
          </Button>
        ) : null}
      </div>
      <ExampleChips date={date} className="mt-4" />
    </Card>
  );
}
