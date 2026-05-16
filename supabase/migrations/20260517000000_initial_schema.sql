create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('youtube')),
  provider_account_id text not null,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scopes text,
  raw_profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_account_id)
);

create table if not exists public.youtube_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connected_account_id uuid not null references public.connected_accounts(id) on delete cascade,
  youtube_channel_id text not null,
  title text not null,
  handle text,
  thumbnail_url text,
  subscriber_count bigint not null default 0,
  view_count bigint not null default 0,
  video_count bigint not null default 0,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, youtube_channel_id)
);

create table if not exists public.analytics_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_id uuid references public.youtube_channels(id) on delete cascade,
  platform text not null default 'youtube',
  date date not null,
  views bigint not null default 0,
  subscribers_gained bigint not null default 0,
  subscribers_lost bigint not null default 0,
  likes bigint not null default 0,
  comments bigint not null default 0,
  shares bigint not null default 0,
  estimated_minutes_watched numeric not null default 0,
  source text not null default 'youtube',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, channel_id, platform, date)
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_id uuid references public.youtube_channels(id) on delete cascade,
  platform text not null default 'youtube',
  external_id text not null,
  title text not null,
  content_type text not null default 'Video',
  url text,
  thumbnail_url text,
  published_at timestamptz,
  views bigint not null default 0,
  engagement_count bigint not null default 0,
  raw_metrics jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, external_id)
);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  connected_account_id uuid references public.connected_accounts(id) on delete set null,
  provider text not null default 'youtube',
  status text not null check (status in ('running', 'success', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'agent')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.connected_accounts enable row level security;
alter table public.youtube_channels enable row level security;
alter table public.analytics_daily enable row level security;
alter table public.content_items enable row level security;
alter table public.sync_runs enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

create policy "youtube_channels_select_own" on public.youtube_channels for select using (auth.uid() = user_id);
create policy "analytics_daily_select_own" on public.analytics_daily for select using (auth.uid() = user_id);
create policy "content_items_select_own" on public.content_items for select using (auth.uid() = user_id);
create policy "sync_runs_select_own" on public.sync_runs for select using (auth.uid() = user_id);

create policy "chat_threads_all_own" on public.chat_threads for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "chat_messages_all_own" on public.chat_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create index if not exists connected_accounts_user_provider_idx on public.connected_accounts (user_id, provider);
create index if not exists analytics_daily_user_date_idx on public.analytics_daily (user_id, date desc);
create index if not exists content_items_user_views_idx on public.content_items (user_id, views desc);
create index if not exists chat_threads_user_updated_idx on public.chat_threads (user_id, updated_at desc);
create index if not exists chat_messages_thread_created_idx on public.chat_messages (thread_id, created_at asc);
