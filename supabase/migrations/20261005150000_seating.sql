-- Seating (Docs/plans/online-server.md §3): a player is on no board until
-- they first go out, under a nickname unique across the game; they then take
-- a rival's city on the newest board that still has one.

-- How many rivals' cities a board still has, kept by every write.
alter table public.boards
  add column bots smallint not null default 0,
  add column created_at timestamptz not null default now();

create function public.bots_in(p_doc jsonb)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select count(*)::smallint
    from jsonb_array_elements(p_doc->'seats') as s
   where jsonb_typeof(s) = 'object' and (s->>'bot')::boolean;
$$;

update public.boards set bots = public.bots_in(doc);
create index boards_open on public.boards (created_at desc) where bots > 0;

create or replace function public.update_board(p_id text, p_doc jsonb, p_version integer)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with written as (
    update public.boards
       set doc = p_doc, version = p_version + 1, bots = public.bots_in(p_doc), updated_at = now()
     where id = p_id and version = p_version
    returning 1
  )
  select exists (select 1 from written);
$$;

create or replace function public.create_board(p_doc jsonb, p_user uuid, p_seat smallint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.boards (id, doc, bots) values (p_doc->>'id', p_doc, public.bots_in(p_doc));
  insert into public.seats (user_id, board_id, seat) values (p_user, p_doc->>'id', p_seat);
  return true;
exception when unique_violation then
  return false;
end;
$$;

-- The newest board with a rival's city left to take.
create function public.open_board()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.boards where bots > 0 order by created_at desc limit 1;
$$;

-- A board written back with the player in a rival's former seat, together;
-- false if the board moved on or the seat or the player is taken.
create function public.take_seat(p_id text, p_doc jsonb, p_version integer, p_user uuid, p_seat smallint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.boards
     set doc = p_doc, version = p_version + 1, bots = public.bots_in(p_doc), updated_at = now()
   where id = p_id and version = p_version;
  if not found then
    return false;
  end if;
  insert into public.seats (user_id, board_id, seat) values (p_user, p_id, p_seat);
  return true;
exception when unique_violation then
  return false;
end;
$$;

-- Nicknames: one per player, unique whatever its case, chosen once.
create table public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  nickname    text not null check (char_length(nickname) between 3 and 16),
  created_at  timestamptz not null default now()
);
create unique index profiles_nickname on public.profiles (lower(nickname));
alter table public.profiles enable row level security;

-- The player's nickname: the one they have, else this one; null if taken.
create function public.claim_nickname(p_user uuid, p_nickname text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  mine text;
begin
  select nickname into mine from public.profiles where user_id = p_user;
  if mine is not null then
    return mine;
  end if;
  insert into public.profiles (user_id, nickname) values (p_user, p_nickname);
  return p_nickname;
exception when unique_violation then
  return null;
end;
$$;

revoke all on function public.update_board(text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.create_board(jsonb, uuid, smallint) from public, anon, authenticated;
revoke all on function public.open_board() from public, anon, authenticated;
revoke all on function public.take_seat(text, jsonb, integer, uuid, smallint) from public, anon, authenticated;
revoke all on function public.claim_nickname(uuid, text) from public, anon, authenticated;
grant execute on function public.update_board(text, jsonb, integer) to service_role;
grant execute on function public.create_board(jsonb, uuid, smallint) to service_role;
grant execute on function public.open_board() to service_role;
grant execute on function public.take_seat(text, jsonb, integer, uuid, smallint) to service_role;
grant execute on function public.claim_nickname(uuid, text) to service_role;
