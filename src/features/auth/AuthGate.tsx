import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { clearStore, setStore } from '@/data';
import { SupabaseStore } from '@/data/supabase';
import { LoginPage } from './LoginPage';

/**
 * Текущее облачное хранилище. Живёт на уровне модуля, как и сам `setStore`:
 * хранилище одно на всё приложение, а не на экземпляр компонента.
 */
let active: { userId: string; store: SupabaseStore } | null = null;

function ensureStore(client: SupabaseClient, userId: string) {
  if (active?.userId === userId) return;
  active?.store.dispose();
  const store = new SupabaseStore(client, userId);
  active = { userId, store };
  // Shell готовит данные заново для каждого нового экземпляра хранилища,
  // поэтому смена пользователя не наследует дефолты и демо-данные прошлого.
  setStore(store);
}

function releaseStore() {
  if (!active) return;
  active.store.dispose();
  active = null;
  clearStore();
}

/**
 * Облачный режим: без сессии показываем вход, с сессией — подставляем `SupabaseStore`
 * в общий доступ к данным ещё до того, как отрисуется Shell.
 */
export function AuthGate({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void client.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  // Хранилище готовим во время отрисовки, а не в эффекте: дочерние страницы
  // запрашивают данные сразу при монтировании и не должны увидеть пустой store.
  if (session) ensureStore(client, session.user.id);
  else releaseStore();

  if (!ready) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <span className="text-small text-muted">Загрузка</span>
      </div>
    );
  }

  if (!session) return <LoginPage client={client} />;
  return <>{children}</>;
}
