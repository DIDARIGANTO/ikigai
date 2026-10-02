// deno-lint-ignore-file no-explicit-any
// Доступ к базе от имени service role: RLS здесь не действует, поэтому
// каждый запрос обязан фильтровать по user_id вручную.
import { createClient } from 'npm:@supabase/supabase-js@2';

export const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

export async function rows<T = any>(userId: string, collection: string): Promise<T[]> {
  const { data, error } = await db.from('rows').select('data').eq('user_id', userId).eq('collection', collection);
  if (error) throw error;
  return (data ?? []).map(r => r.data as T);
}

export async function putRow(userId: string, collection: string, row: { id: string; [key: string]: unknown }) {
  const { error } = await db
    .from('rows')
    .upsert({ collection, id: row.id, user_id: userId, data: row, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function profileByChat(chatId: string) {
  const { data } = await db
    .from('rows')
    .select('user_id,data')
    .eq('collection', 'profiles')
    .eq('data->>telegramChatId', chatId)
    .maybeSingle();
  return data ? { userId: data.user_id as string, profile: data.data as any } : null;
}

export const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);
export const nowISO = () => new Date().toISOString();
