import type { InputHTMLAttributes } from 'react';
import { addDaysISO, todayISO } from '@/lib/dates';
import { Chip } from './Chip';
import { Input } from './Input';

type NativeProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'>;

/** Быстрые даты: «Сегодня / Завтра / +1 нед» — маленькие нейтральные чипы. Нативное поле рядом остаётся запасным выбором. */
export function DateQuickChips({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
}) {
  const today = todayISO();
  const options = [
    { label: 'Сегодня', iso: today },
    { label: 'Завтра', iso: addDaysISO(today, 1) },
    { label: '+1 нед', iso: addDaysISO(value || today, 7), relative: true },
  ];
  return (
    <div role="group" aria-label="Быстрый выбор даты" className={`flex flex-wrap gap-1 ${className}`}>
      {options.map(o => (
        <Chip
          key={o.label}
          size="sm"
          selected={!o.relative && value === o.iso}
          onClick={() => onChange(o.iso)}
          aria-label={o.relative ? 'Через неделю' : undefined}
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

/** Поле даты: нативный выбор на русском (`lang="ru"`) и, по желанию, быстрые чипы под ним. */
export function DateField({
  value,
  onChange,
  quick = false,
  label,
  ...p
}: NativeProps & { value: string; onChange: (iso: string) => void; quick?: boolean; label?: string }) {
  return (
    <div className="w-full">
      <Input {...p} label={label} type="date" lang="ru" value={value} onChange={e => onChange(e.target.value)} />
      {quick ? <DateQuickChips value={value} onChange={onChange} className="mt-2" /> : null}
    </div>
  );
}

/** Поле времени: 24-часовой формат по `lang="ru"`, табличные цифры. */
export function TimeField({
  value,
  onChange,
  label,
  ...p
}: NativeProps & { value: string; onChange: (hhmm: string) => void; label?: string }) {
  return <Input {...p} label={label} type="time" lang="ru" value={value} onChange={e => onChange(e.target.value)} />;
}
