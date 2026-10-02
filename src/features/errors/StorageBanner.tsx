import { useMemo, useState } from 'react';
import { DatabaseBackup, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getStore } from '@/data';
import { downloadBackup } from '@/data/exportImport';
import { useCollection, useStoreStatus } from '@/data/hooks';
import { daysBetween, dismissNudge, readLastExportAt, readNudgeDismissedAt, shouldNudgeBackup } from '@/data/backup';
import { Banner } from './BannerStack';
import { pluralDays } from './plural';

/** Самая ранняя отметка создания среди строк — «с какого дня здесь живут данные». */
function earliest(rows: readonly { createdAt: string }[]): number | null {
  let min: number | null = null;
  for (const r of rows) {
    const t = Date.parse(r.createdAt);
    if (Number.isFinite(t) && t > 0 && (min === null || t < min)) min = t;
  }
  return min;
}

/**
 * Плашки о сохранности данных:
 * - хранилище недоступно (статус `error`) — постоянная, с кнопкой копии;
 * - давно не было копии — раз в день, можно скрыть до завтра.
 */
export function StorageBanner() {
  const status = useStoreStatus();
  const profiles = useCollection('profiles');
  const tasks = useCollection('tasks');
  // Момент «сейчас» обновляется после скачивания или «скрыть» — заодно перечитываем localStorage.
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  // Предупреждение о сбое можно убрать до перезагрузки: на телефоне оно закрывает шапку,
  // а статус «Не сохраняется» остаётся в меню и в настройках.
  const [errorHidden, setErrorHidden] = useState(false);

  const nudge = useMemo(() => {
    const firstDataAt = earliest([...profiles, ...tasks]);
    const last = readLastExportAt();
    if (!shouldNudgeBackup(now, last, firstDataAt, readNudgeDismissedAt())) return null;
    return { days: last === null ? null : daysBetween(last, now) };
  }, [profiles, tasks, now]);

  const download = async () => {
    setBusy(true);
    try {
      await downloadBackup(getStore());
    } catch (e) {
      console.error('Ikigai: не удалось скачать копию', e);
    } finally {
      setBusy(false);
      setNow(Date.now());
    }
  };

  if (status === 'error') {
    if (errorHidden) return null;
    const reason = getStore().errorMessage?.();
    return (
      <Banner
        tone="danger"
        icon={<TriangleAlert size={16} />}
        onDismiss={() => setErrorHidden(true)}
        action={
          <Button size="sm" variant="primary" onClick={() => void download()} disabled={busy}>
            Скачать копию
          </Button>
        }
      >
        <p>Данные не сохраняются в этом браузере. Скачай копию, чтобы ничего не потерять.</p>
        {reason ? <p className="mt-0.5 hidden text-caption text-muted md:block">{reason}</p> : null}
      </Banner>
    );
  }

  if (!nudge) return null;
  return (
    <Banner
      icon={<DatabaseBackup size={16} />}
      onDismiss={() => {
        dismissNudge();
        setNow(Date.now());
      }}
      action={
        <Button size="sm" onClick={() => void download()} disabled={busy}>
          Скачать
        </Button>
      }
    >
      {nudge.days === null ? 'Копии данных ещё не было' : `Копия данных: ${pluralDays(nudge.days)} назад`}
    </Banner>
  );
}
