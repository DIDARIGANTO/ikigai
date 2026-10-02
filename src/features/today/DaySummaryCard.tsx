import { useId, useRef, useState } from 'react';
import { MoonStar, PencilLine } from 'lucide-react';
import type { DailyLog, Task } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { burst } from '@/components/ui/Burst';
import { useRepo } from '@/data/hooks';
import { nowISO } from '@/lib/ids';
import { dayStats, formatAccuracy } from '@/lib/domain/day';

type Energy = NonNullable<DailyLog['energy']>;

/** Энергия за день: цифры 1–5, словами — только подсказка рядом. */
// oxlint-disable-next-line react/only-export-components -- шкала нужна и тестам
export const ENERGY: { value: Energy; label: string }[] = [
  { value: 1, label: 'Без сил' },
  { value: 2, label: 'Тяжело' },
  { value: 3, label: 'Ровно' },
  { value: 4, label: 'Хорошо' },
  { value: 5, label: 'Заряжен' },
];

/** Минуты как «1:12» — моноширинными цифрами, как в сводке шапки; ноль — прочерк. */
function hm(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (!m) return '—';
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/** Показывать ли «Итог дня»: с 20:00, когда всё закрыто, или если день уже закрыт. */
// oxlint-disable-next-line react/only-export-components -- правило проверяется тестами
export function shouldShowSummary(hour: number, dayTasks: Task[], log?: DailyLog): boolean {
  if (log) return true;
  if (hour >= 20) return true;
  return dayTasks.length > 0 && dayTasks.every(t => t.status === 'done' || t.status === 'skipped');
}

/** Выбор энергии 1–5: сегменты с цифрами, рядом — подпись выбранного значения. */
function EnergyPicker({ value, onChange }: { value?: Energy; onChange: (v: Energy) => void }) {
  const labelId = useId();
  const current = ENERGY.find(e => e.value === value);
  return (
    <div className="flex items-center gap-3">
      <span id={labelId} className="text-small text-muted">
        Энергия
      </span>
      <Segmented
        labelledBy={labelId}
        value={value ? String(value) : ''}
        onChange={v => onChange(Number(v) as Energy)}
        options={ENERGY.map(e => ({ value: String(e.value), label: String(e.value), ariaLabel: `${e.value} — ${e.label}` }))}
        className="font-mono"
      />
      <span aria-hidden="true" className="min-w-16 text-small text-muted">
        {current?.label ?? ''}
      </span>
    </div>
  );
}

/** Ячейка сводки: подпись 13 px и значение моноширинным; подсказка — для наведения и скринридера. */
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-surface px-5 py-3" title={hint}>
      <dt className="text-small text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-h2 font-medium tabular-nums text-text">{value}</dd>
      {hint ? <dd className="sr-only">{hint}</dd> : null}
    </div>
  );
}

/**
 * «Итог дня»: сделано / перенесено / не делал, точность плана, фокус и минуты на цели,
 * энергия 1–5 и «Закрыть день». Закрытый день — короткая сводка с «Изменить».
 */
export function DaySummaryCard({ tasks, date, log }: { tasks: Task[]; date: string; log?: DailyLog }) {
  const { put } = useRepo();
  const [editing, setEditing] = useState(false);
  const [justClosed, setJustClosed] = useState(false);
  const [energy, setEnergy] = useState<Energy | undefined>(log?.energy);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const stats = dayStats(tasks, date);

  const close = async () => {
    const now = nowISO();
    const row: DailyLog = {
      id: date,
      date,
      done: stats.done,
      skipped: stats.skipped,
      moved: stats.moved,
      focusMinutes: stats.focusMinutes,
      goalMinutes: stats.goalMinutes,
      closedAt: now,
      createdAt: log?.createdAt ?? now,
      updatedAt: now,
      ...(energy ? { energy } : {}),
      ...(stats.accuracy !== null ? { accuracy: stats.accuracy } : {}),
    };
    if (closeBtn.current) burst(closeBtn.current, { count: 70, power: 11 });
    await put('dailyLogs', row);
    setEditing(false);
    setJustClosed(true);
  };

  if (log && !editing) {
    const recap = [
      `сделано ${log.done}`,
      log.moved ? `перенесено ${log.moved}` : '',
      log.skipped ? `пропущено ${log.skipped}` : '',
      log.focusMinutes ? `фокус ${hm(log.focusMinutes)}` : '',
      log.accuracy ? `план ${formatAccuracy(log.accuracy)}` : '',
      log.energy ? `энергия ${log.energy}/5` : '',
    ].filter(Boolean);
    return (
      <Card className="animate-in p-5" aria-label="Итог дня" data-testid="day-closed">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <MoonStar size={16} aria-hidden="true" className="shrink-0 text-muted" />
          <div className="min-w-0 flex-1 basis-48">
            <p className="text-title font-semibold text-text" role="status">
              {justClosed ? 'День закрыт. Хороший вечер' : 'День закрыт'}
            </p>
            <p className="mt-0.5 text-small tabular-nums text-muted first-letter:uppercase">{recap.join(' · ')}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="-mr-3"
            onClick={() => {
              setEnergy(log.energy);
              setEditing(true);
              setJustClosed(false);
            }}
          >
            <PencilLine size={16} aria-hidden="true" />
            Изменить
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="animate-in p-5" aria-label="Итог дня" data-testid="day-summary">
      <CardHeader title="Итог дня" icon={<MoonStar size={16} />} />
      <p className="text-small text-muted">Цифры за сегодня. Отметь энергию и закрой день.</p>

      <dl className="-mx-5 mt-4 grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-3">
        <Stat label="Сделано" value={`${stats.done}`} />
        <Stat label="Перенесено" value={`${stats.moved}`} />
        <Stat label="Пропущено" value={`${stats.skipped}`} />
        <Stat
          label="Точность плана"
          value={stats.accuracy !== null ? formatAccuracy(stats.accuracy) : '—'}
          hint={stats.accuracy !== null ? 'Факт к плану, медиана' : 'Нужны оценка времени и таймер'}
        />
        <Stat label="Фокус" value={hm(stats.focusMinutes)} />
        <Stat label="На цели" value={hm(stats.goalMinutes)} />
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <EnergyPicker value={energy} onChange={setEnergy} />
        <div className="flex items-center gap-2">
          {editing ? (
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Отмена
            </Button>
          ) : null}
          <Button ref={closeBtn} variant="primary" onClick={() => void close()}>
            Закрыть день
          </Button>
        </div>
      </div>
    </Card>
  );
}
