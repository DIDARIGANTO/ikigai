import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/features/errors/BannerStack';
import { useUpdateReady } from './updateState';

/** «Доступна новая версия · Обновить» — когда новый сервис-воркер скачан и ждёт. */
export function UpdateBanner() {
  const apply = useUpdateReady();
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!apply || hidden) return null;
  return (
    <Banner
      icon={<RefreshCw size={16} />}
      onDismiss={() => setHidden(true)}
      action={
        <Button
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void apply();
          }}
        >
          Обновить
        </Button>
      }
    >
      Доступна новая версия
    </Banner>
  );
}
