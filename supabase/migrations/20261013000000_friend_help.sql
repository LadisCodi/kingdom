-- Daily help between friends (Docs/features/15-social.md §3): who helped
-- whom, and when — a friend once in any 24 hours, a few a day. The gift is a
-- delivery and the friend's note a message, in their own tables. Written
-- only by the `social` edge function: RLS is on and there is no policy.

create table public.helps (
  from_id  uuid not null references auth.users (id) on delete cascade,
  to_id    uuid not null references auth.users (id) on delete cascade,
  at       timestamptz not null
);
create index helps_from on public.helps (from_id, at);

alter table public.helps enable row level security;
