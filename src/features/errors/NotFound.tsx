import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wordmark } from '@/components/ui/LogoMark';

/** Ссылка-кнопка в виде главной (монохромной) кнопки «Графита». */
const PRIMARY_LINK =
  'inline-flex h-9 items-center justify-center rounded-control bg-primary px-4 text-body font-medium text-on-primary hover:opacity-90 focus-ring press';

/** Неизвестный адрес: вместо молчаливого перехода на главную объясняем, что случилось. */
export function NotFound() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = 'Ikigai · Страница не найдена';
  }, []);
  return (
    <div className="flex items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <Wordmark size={24} />
        <p className="mt-10 font-mono text-small text-muted">404</p>
        <h1 className="mt-2 text-h1 font-semibold text-text">Такой страницы нет</h1>
        <p className="mt-2 text-body text-muted break-words">
          Адрес <span className="font-mono text-small text-muted-strong">{pathname}</span> никуда не ведёт. Возможно, ссылка
          устарела или в ней опечатка.
        </p>
        <Link to="/" className={`mt-6 ${PRIMARY_LINK}`}>
          На главную
        </Link>
      </div>
    </div>
  );
}
