create extension if not exists "pgcrypto";

create table if not exists public.servers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 32),
  owner_name text not null check (char_length(owner_name) between 1 and 24),
  created_at timestamptz not null default now()
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 28),
  created_at timestamptz not null default now(),
  unique (server_id, name)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author text not null check (char_length(author) between 1 and 24),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.servers enable row level security;
alter table public.channels enable row level security;
alter table public.messages enable row level security;

drop policy if exists "servers are public" on public.servers;
drop policy if exists "channels are public" on public.channels;
drop policy if exists "messages are public" on public.messages;

create policy "servers are public"
on public.servers for all
to anon, authenticated
using (true)
with check (true);

create policy "channels are public"
on public.channels for all
to anon, authenticated
using (true)
with check (true);

create policy "messages are public"
on public.messages for all
to anon, authenticated
using (true)
with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'servers'
  ) then
    alter publication supabase_realtime add table public.servers;
  end if;

  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'channels'
  ) then
    alter publication supabase_realtime add table public.channels;
  end if;

  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
