import type { ReactNode } from 'react';
import { AuthGate } from './features/auth/AuthGate';
import { makeSupabaseClient } from './data/supabase';

// Отдельный модуль: клиент Supabase попадает в сборку только облачного режима.
const client = makeSupabaseClient();

export default function CloudRoot({ children }: { children: ReactNode }) {
  if (!client) return <>{children}</>;
  return <AuthGate client={client}>{children}</AuthGate>;
}
