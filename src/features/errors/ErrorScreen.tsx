import { useEffect, useState } from 'react';
import { Download, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Wordmark } from '@/components/ui/LogoMark';
import { describeError, downloadEmergencyExport } from './emergencyExport';

/**
 * Экран сбоя. Не зависит от провайдеров каркаса и роутера: рисуется и внутри
 * раздела (меню остаётся рабочим), и вместо всего приложения.
 * `fullPage` — растянуть на весь экран, когда каркаса нет.
 */
export function ErrorScreen({ error, fullPage = false }: { error: unknown; fullPage?: boolean }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    console.error('Ikigai: ошибка при отрисовке', error);
  }, [error]);

  const onDownload = async () => {
    setSaving(true);
    try {
      const rows = await downloadEmergencyExport();
      setSaved(rows ? `Копия скачана: записей — ${rows}.` : 'Данных для копии не нашлось.');
    } catch (e) {
      console.error('Ikigai: не удалось скачать копию', e);
      setSaved('Скачать копию не получилось. Попробуй перезагрузить страницу.');
    } finally {
      setSaving(false);
    }
  };

  const detail = describeError(error);

  return (
    <div
      role="alert"
      className={`flex items-center justify-center px-4 ${fullPage ? 'min-h-full py-16 bg-canvas' : 'py-12'}`}
    >
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <Wordmark size={24} />
        <h1 className="mt-10 text-h1 font-semibold text-text">Что-то пошло не так</h1>
        <p className="mt-2 text-body text-muted">
          Эта страница не смогла открыться. Твои данные на месте: перезагрузи страницу или сначала скачай копию, чтобы
          ничего не потерять.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button variant="primary" onClick={() => window.location.reload()}>
            <RotateCw size={16} aria-hidden="true" />
            Перезагрузить
          </Button>
          <Button onClick={() => void onDownload()} disabled={saving}>
            <Download size={16} aria-hidden="true" />
            {saving ? 'Собираем копию…' : 'Скачать копию данных'}
          </Button>
        </div>
        {saved ? (
          <p className="mt-3 text-small text-muted-strong" role="status">
            {saved}
          </p>
        ) : null}
        {!fullPage ? (
          <p className="mt-4 text-small text-muted">
            Или <a href="/" className="font-medium text-accent-strong hover:underline focus-ring rounded-sm">вернись на главную</a>.
          </p>
        ) : null}
        {detail ? (
          <details className="mt-6 w-full border-t border-border pt-4 text-left">
            <summary className="cursor-pointer text-small text-muted">Подробности для разработчика</summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-control border border-border bg-surface p-2 font-mono text-micro text-muted-strong whitespace-pre-wrap break-words">
              {detail}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}
