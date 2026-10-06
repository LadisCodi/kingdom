-- Trading with friends: the wish board (Docs/features/15-social.md §2.4).
-- A wish names what its owner needs and what they give for it; the server
-- holds the stake while it is open, and every lot that lands on a player —
-- a filled need, a filled wish's stake, a stake back — is a delivery, in
-- the order it was owed, until the client acknowledges it. Written only by
-- the `social` edge function: RLS is on and there is no policy.

create table public.wishes (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  need        jsonb not null,
  give        jsonb not null,
  created_at  timestamptz not null,
  state       text not null default 'open',
  filled_by   uuid references auth.users (id) on delete set null,
  filled_at   timestamptz
);
create index wishes_open on public.wishes (user_id) where state = 'open';
create index wishes_filled_by on public.wishes (filled_by, filled_at) where filled_by is not null;

create table public.deliveries (
  seq         bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  lot         jsonb not null,
  why         text not null
);
create index deliveries_user on public.deliveries (user_id, seq);

alter table public.messages add column lots jsonb;

alter table public.wishes enable row level security;
alter table public.deliveries enable row level security;
