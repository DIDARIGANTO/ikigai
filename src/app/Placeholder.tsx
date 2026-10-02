import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { useCurrentNav } from './nav';

/** Раздел, который ещё не написан: шапка и короткое пояснение в карточке. */
export function Placeholder({ soon = false }: { soon?: boolean }) {
  const item = useCurrentNav();
  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader title={item.label} icon={<SectionIcon k={item.key} size={20} />} />
      <EmptyState
        k={item.key}
        title={soon ? 'Скоро здесь что-то будет' : 'Раздел в работе'}
        description={soon ? 'Раздел появится в одной из следующих версий.' : undefined}
        className="mt-6 rounded-card bg-surface shadow-(--shadow-raised)"
      />
    </div>
  );
}

export function Soon() {
  return <Placeholder soon />;
}
