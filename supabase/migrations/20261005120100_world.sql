-- The world server's tables (Docs/plans/online-server.md §3). A board is one
-- document with a version, written only by the `world` edge function: no
-- client reads or writes either table — RLS is on and there is no policy.

create table public.boards (
  id          text primary key,
  doc         jsonb not null,
  version     integer not null default 0,
  updated_at  timestamptz not null default now()
);

create table public.seats (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  board_id  text not null references public.boards (id) on delete cascade,
  seat      smallint not null check (seat between 0 and 5),
  unique (board_id, seat)
);

alter table public.boards enable row level security;
alter table public.seats enable row level security;

-- Write a board back only if nobody wrote it since it was read.
create function public.update_board(p_id text, p_doc jsonb, p_version integer)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with written as (
    update public.boards
       set doc = p_doc, version = p_version + 1, updated_at = now()
     where id = p_id and version = p_version
    returning 1
  )
  select exists (select 1 from written);
$$;

-- A new board and the player's seat on it, together; false if either is taken.
create function public.create_board(p_doc jsonb, p_user uuid, p_seat smallint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.boards (id, doc) values (p_doc->>'id', p_doc);
  insert into public.seats (user_id, board_id, seat) values (p_user, p_doc->>'id', p_seat);
  return true;
exception when unique_violation then
  return false;
end;
$$;

revoke all on function public.update_board(text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.create_board(jsonb, uuid, smallint) from public, anon, authenticated;
grant execute on function public.update_board(text, jsonb, integer) to service_role;
grant execute on function public.create_board(jsonb, uuid, smallint) to service_role;
