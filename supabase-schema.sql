create extension if not exists "pgcrypto";

drop table if exists public.messages cascade;
drop table if exists public.conversation_members cascade;
drop table if exists public.conversations cascade;
drop table if exists public.friendships cascade;
drop table if exists public.channels cascade;
drop table if exists public.servers cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 1 and 24),
  email text not null,
  created_at timestamptz not null default now()
);

create unique index profiles_username_key on public.profiles (lower(username));
create unique index profiles_email_key on public.profiles (lower(email));

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (requester_id <> receiver_id),
  unique (requester_id, receiver_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('dm', 'group')),
  name text,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create policy "profiles can be seen by signed in users"
on public.profiles for select
to authenticated
using (true);

create policy "users create their own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "users update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "friends can be seen by either user"
on public.friendships for select
to authenticated
using (auth.uid() in (requester_id, receiver_id));

create policy "users can add a friendship involving them"
on public.friendships for insert
to authenticated
with check (auth.uid() in (requester_id, receiver_id));

create policy "users can see their conversations"
on public.conversations for select
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = conversations.id
      and cm.user_id = auth.uid()
  )
);

create policy "users can create conversations"
on public.conversations for insert
to authenticated
with check (created_by = auth.uid());

create policy "members can see conversation members"
on public.conversation_members for select
to authenticated
using (true);

create policy "creators can add conversation members"
on public.conversation_members for insert
to authenticated
with check (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_members.conversation_id
      and c.created_by = auth.uid()
  )
);

create policy "members can read messages"
on public.messages for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

create policy "members can send messages"
on public.messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.messages;
