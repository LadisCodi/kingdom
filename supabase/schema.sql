-- Kingdom cloud saves: one row per (anonymous) player, RLS-guarded.
-- Run once in the Supabase SQL editor, then enable Anonymous sign-ins under
-- Authentication → Sign In / Up → Anonymous.

create table public.saves (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  data         jsonb not null,
  game_version text,
  updated_at   timestamptz not null default now()
);

alter table public.saves enable row level security;

create policy "players manage own save" on public.saves
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
