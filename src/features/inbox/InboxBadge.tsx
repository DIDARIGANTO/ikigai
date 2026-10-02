import { Badge } from '@/components/ui/Chip';
import { useInboxCount } from './useInboxCount';

/** Счётчик у пункта «Входящие» в меню — нейтральный, моноширинный; в свёрнутом меню — точка на иконке. */
export function InboxBadge({ collapsed = false }: { collapsed?: boolean }) {
  const n = useInboxCount();
  if (!n) return null;
  if (collapsed) {
    return <span aria-hidden="true" className="absolute right-2 top-1.5 size-2 rounded-mark bg-accent ring-2 ring-panel" />;
  }
  return (
    <Badge className="ml-auto">
      <span className="sr-only">на разбор: </span>
      {n > 99 ? '99+' : n}
    </Badge>
  );
}
