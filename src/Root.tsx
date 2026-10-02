import { Suspense, lazy } from 'react';
import { Outlet } from 'react-router-dom';
import { BannerStack } from './features/errors/BannerStack';
import { StorageBanner } from './features/errors/StorageBanner';
import { UpdateBanner } from './features/pwa/UpdateBanner';
import { cloudEnabled } from './data';

// Облако — отдельный кусок кода: в локальном режиме Supabase не скачивается вовсе.
const CloudRoot = lazy(() => import('./CloudRoot'));

/** Приложение и служебные плашки поверх него. Плашкам нужно хранилище — поэтому они внутри входа. */
function WithBanners() {
  return (
    <>
      <Outlet />
      <BannerStack>
        <StorageBanner />
        <UpdateBanner />
      </BannerStack>
    </>
  );
}

function Loading() {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <span className="text-sm text-muted">Загрузка…</span>
    </div>
  );
}

/** Корень: в облачном режиме всё приложение прячется за входом. */
export function Root() {
  if (!cloudEnabled) return <WithBanners />;
  return (
    <Suspense fallback={<Loading />}>
      <CloudRoot>
        <WithBanners />
      </CloudRoot>
    </Suspense>
  );
}
