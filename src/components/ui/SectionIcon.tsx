import { SECTION_ICONS } from '@/lib/icons';
import type { SectionKey } from '@/lib/icons';

/** Иконка раздела. Цвет наследуется от родителя — задавайте его на месте вызова. */
export function SectionIcon({
  k,
  size = 16,
  className = '',
}: {
  k: SectionKey;
  size?: number;
  className?: string;
}) {
  const Cmp = SECTION_ICONS[k];
  return <Cmp size={size} aria-hidden="true" className={`shrink-0 ${className}`.trim()} />;
}
