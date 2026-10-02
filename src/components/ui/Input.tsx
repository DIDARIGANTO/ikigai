import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

/**
 * Общий вид полей «Сигнала»: высота 36, поверхность, граница поля ≥ 3:1, радиус 2, текст 14 px,
 * кольцо фокуса акцентом; `aria-invalid` — граница цвета ошибки.
 */
// oxlint-disable-next-line react/only-export-components -- общий класс полей для Select и DateField
export const FIELD =
  'w-full px-3 rounded-control bg-surface border border-control-border hover:border-muted text-text text-body placeholder:text-muted focus-field aria-invalid:border-danger disabled:opacity-50 disabled:hover:border-control-border';

/** Подпись над полем: капитель 11 px с трекингом (`label-text`). */
// oxlint-disable-next-line react/only-export-components -- общий класс подписи
export const LABEL = 'block mb-1.5 label-text text-muted-strong';

export function Input({
  label,
  className = '',
  id,
  ...p
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={fieldId} className={LABEL}>
          {label}
        </label>
      ) : null}
      {/* Даты и время — по-русски: «30.09.2026», 24 часа, а не «09/30/2026 AM». */}
      <input
        id={fieldId}
        lang={p.type === 'date' || p.type === 'time' || p.type === 'datetime-local' ? 'ru' : undefined}
        className={`${FIELD} h-9 ${className}`}
        {...p}
      />
    </div>
  );
}

export function Textarea({
  label,
  className = '',
  id,
  rows = 4,
  ...p
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={fieldId} className={LABEL}>
          {label}
        </label>
      ) : null}
      <textarea id={fieldId} rows={rows} className={`${FIELD} py-2 resize-y ${className}`} {...p} />
    </div>
  );
}

/** Подпись поля отдельно от него (когда поле — не Input: сегменты, чипы, плитки). */
export function FieldLabel({ htmlFor, id, children }: { htmlFor?: string; id?: string; children: ReactNode }) {
  return htmlFor ? (
    <label htmlFor={htmlFor} id={id} className={LABEL}>
      {children}
    </label>
  ) : (
    <span id={id} className={LABEL}>
      {children}
    </span>
  );
}
