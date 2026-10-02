-- Ikigai — начальная схема облака.
-- Скрипт можно запускать повторно: он не ломает уже созданные таблицы и данные.

-- Все записи приложения лежат в одной таблице: коллекция + id + сам объект в jsonb.
create table if not exists public.rows (
  collection text not null,
  id text not null,
  user_id uuid not null default auth.uid(),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id, user_id)
);
create index if not exists rows_user_collection on public.rows (user_id, collection);
create index if not exists rows_task_date on public.rows ((data->>'date')) where collection = 'tasks';

alter table public.rows enable row level security;
drop policy if exists "owner select" on public.rows;
drop policy if exists "owner insert" on public.rows;
drop policy if exists "owner update" on public.rows;
drop policy if exists "owner delete" on public.rows;
create policy "owner select" on public.rows for select using (auth.uid() = user_id);
create policy "owner insert" on public.rows for insert with check (auth.uid() = user_id);
create policy "owner update" on public.rows for update using (auth.uid() = user_id);
create policy "owner delete" on public.rows for delete using (auth.uid() = user_id);

-- служебные таблицы бота (доступны только service role — RLS без политик)
create table if not exists public.bot_links (
  code text primary key,
  user_id uuid not null,
  expires_at timestamptz not null
);
alter table public.bot_links enable row level security;
drop policy if exists "owner insert link" on public.bot_links;
create policy "owner insert link" on public.bot_links for insert with check (auth.uid() = user_id);

create table if not exists public.bot_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  chat_id text not null,
  payload jsonb not null,
  source_text text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
alter table public.bot_drafts enable row level security;

create table if not exists public.sent_digests (
  user_id uuid not null,
  kind text not null,
  date date not null,
  attempts int not null default 0,
  sent boolean not null default false,
  primary key (user_id, kind, date)
);
alter table public.sent_digests enable row level security;

create table if not exists public.ai_usage (
  user_id uuid not null,
  date date not null,
  count int not null default 0,
  primary key (user_id, date)
);
alter table public.ai_usage enable row level security;

-- Живые обновления для таблицы rows. Повторный запуск не должен падать с ошибкой.
do $$
begin
  alter publication supabase_realtime add table public.rows;
exception
  when duplicate_object then null;
  when undefined_object then null;
end
$$;
