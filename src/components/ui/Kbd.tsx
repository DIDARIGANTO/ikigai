/**
 * Подсказка клавиши: тонкий «колпачок» — линия 1 px, радиус 2, моноширинный 12 px.
 * С `className` цвета берутся от места вызова (линия — полупрозрачный цвет текста).
 */
export function Kbd({ children, className = '' }: { children: string; className?: string }) {
  return (
    <kbd
      aria-hidden="true"
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md border px-1.5 font-mono text-caption leading-none font-normal ${
        className ? `border-current/30 ${className}` : 'border-border-strong text-muted'
      }`}
    >
      {children}
    </kbd>
  );
}
