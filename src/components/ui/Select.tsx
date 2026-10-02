import { useId } from 'react';
import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { FIELD, LABEL } from './Input';

/** Нативный выпадающий список в общем оформлении полей (36 px, шеврон 16 px). `fieldSize="sm"` — 32 px для фильтров в строке. */
export function Select({
  label,
  className = '',
  id,
  children,
  fieldSize = 'md',
  wrapperClassName = '',
  ...p
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; fieldSize?: 'sm' | 'md'; wrapperClassName?: string }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={`${fieldSize === 'sm' ? 'relative' : 'w-full'} ${wrapperClassName}`}>
      {label ? (
        <label htmlFor={fieldId} className={LABEL}>
          {label}
        </label>
      ) : null}
      <div className="relative">
        <select
          id={fieldId}
          className={`${FIELD} ${fieldSize === 'sm' ? 'h-8 pl-2.5 pr-8 text-small' : 'h-9 pr-9'} appearance-none cursor-pointer ${className}`}
          {...p}
        >
          {children}
        </select>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted ${fieldSize === 'sm' ? 'right-2' : 'right-2.5'}`}
        />
      </div>
    </div>
  );
}
