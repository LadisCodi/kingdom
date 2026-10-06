-- The friends' Inbox (Docs/features/15-social.md §2.3): a player's messages,
-- each with an id unique in that Inbox that says what it is about —
-- `req:<from>` for a friend request, `acc:`/`dec:<from>:<ms>` for an answer.
-- Written only by the `social` edge function: RLS is on and there is no
-- policy. Friend requests expire after 48 hours; the function drops them and
-- marks their message expired the next time either player calls.

create table public.messages (
  user_id     uuid not null references auth.users (id) on delete cascade,
  id          text not null,
  kind        text not null,
  from_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null,
  read_at     timestamptz,
  state       text,
  primary key (user_id, id)
);

alter table public.messages enable row level security;
