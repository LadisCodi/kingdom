-- The friends list (Docs/features/15-social.md §2.1). A player is known to
-- others by a friend code and the nickname the world board knows them by;
-- what they report of their progress is shown to their friends. Written only
-- by the `social` edge function: RLS is on and there is no policy.

alter table public.profiles
  add column code      text unique,
  add column townhall  smallint not null default 1,
  add column cells     integer not null default 0,
  add column seen_at   timestamptz;

create index profiles_seen on public.profiles (seen_at desc) where seen_at is not null;
create index profiles_nickname_prefix on public.profiles (lower(nickname) text_pattern_ops);

-- A request waiting for an answer, one way.
create table public.friend_requests (
  from_id     uuid not null references auth.users (id) on delete cascade,
  to_id       uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index friend_requests_to on public.friend_requests (to_id);

-- A friendship, kept both ways so each side reads its own list.
create table public.friendships (
  user_id     uuid not null references auth.users (id) on delete cascade,
  friend_id   uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;

-- Two players made friends, and the requests between them dropped, as one —
-- unless either already has p_max friends. Both profiles are locked in a
-- fixed order, so two answers at once cannot both slip under the cap.
create function public.befriend(p_a uuid, p_b uuid, p_max integer, p_at timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.profiles where user_id in (p_a, p_b) order by user_id for update;
  if not exists (select 1 from public.friendships where user_id = p_a and friend_id = p_b) then
    if (select count(*) from public.friendships where user_id = p_a) >= p_max then
      return 'full';
    end if;
    if (select count(*) from public.friendships where user_id = p_b) >= p_max then
      return 'theirFull';
    end if;
    insert into public.friendships (user_id, friend_id, created_at) values (p_a, p_b, p_at), (p_b, p_a, p_at);
  end if;
  delete from public.friend_requests
   where (from_id = p_a and to_id = p_b) or (from_id = p_b and to_id = p_a);
  return 'ok';
end;
$$;

revoke all on function public.befriend(uuid, uuid, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.befriend(uuid, uuid, integer, timestamptz) to service_role;
