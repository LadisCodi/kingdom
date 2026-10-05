-- Playtest analytics (Docs/plans/analytics.md). Events are appended by the
-- signed-in player and read by nobody but the project's owner: the views live
-- in their own schema, which the API does not expose.

create table public.analytics_events (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id    uuid not null,
  seq           integer not null,
  at            timestamptz not null,
  received_at   timestamptz not null default now(),
  game_version  text,
  save_version  smallint,
  name          text not null check (char_length(name) <= 40),
  props         jsonb not null default '{}'::jsonb check (pg_column_size(props) <= 4096),
  th            smallint,
  quest         smallint,
  played_min    integer,
  scene         text check (char_length(scene) <= 40),
  offline       boolean not null default false,
  dev           boolean not null default false
);

create index analytics_events_user_at on public.analytics_events (user_id, at);
create index analytics_events_name_at on public.analytics_events (name, at);
create index analytics_events_session on public.analytics_events (session_id, seq);

alter table public.analytics_events enable row level security;

-- A player adds their own rows. Nothing else: no change, no delete, and of
-- reading only what a retry needs (below).
create policy "players append their own events" on public.analytics_events
  for insert to authenticated
  with check (user_id = auth.uid());

revoke all on public.analytics_events from anon;
revoke select, update, delete, truncate on public.analytics_events from authenticated;
grant insert on public.analytics_events to authenticated;
-- `on conflict (id) do nothing` — how a batch sent twice counts once — reads
-- the key, and RLS holds the row to a select policy as well: a player may see
-- the ids of their own events, and no other column, and nobody else's.
grant select (id) on public.analytics_events to authenticated;
create policy "players see their own event ids" on public.analytics_events
  for select to authenticated
  using (user_id = auth.uid());

-- Older than 90 days, gone. Run by hand or on a schedule.
create function public.prune_analytics()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.analytics_events where at < now() - interval '90 days' returning 1
  )
  select count(*)::integer from gone;
$$;
revoke all on function public.prune_analytics() from public, anon, authenticated;

-- ------------------------------------------------------------------ views

create schema analytics;
revoke all on schema analytics from public, anon, authenticated;

-- Every event a tester made, without dev sessions.
create view analytics.events with (security_invoker = true) as
  select * from public.analytics_events where not dev;

-- One row a player: who, since when, how much, how far.
create view analytics.v_testers with (security_invoker = true) as
  with latest as (
    select distinct on (user_id) user_id, th, quest, played_min, game_version
      from analytics.events order by user_id, at desc
  )
  select
    e.user_id,
    p.nickname,
    min(e.at) as first_seen,
    max(e.at) as last_seen,
    count(distinct e.session_id) as sessions,
    count(distinct (e.at at time zone 'utc')::date) as days_played,
    l.played_min,
    l.th,
    l.quest,
    count(*) filter (where e.name = 'research') as techs,
    count(*) filter (where e.name = 'purchased') as purchases,
    s.data->'Modules'->'player.payer'->>'Profile' as payer,
    l.game_version
  from analytics.events e
  join latest l using (user_id)
  left join public.profiles p using (user_id)
  left join public.saves s using (user_id)
  group by e.user_id, p.nickname, l.played_min, l.th, l.quest, l.game_version, s.data;

-- One row a session: when, how long, and what it opened on.
create view analytics.v_sessions with (security_invoker = true) as
  select
    e.session_id,
    e.user_id,
    p.nickname,
    min(e.at) as started,
    max(e.at) - min(e.at) as length,
    count(*) as events,
    (array_agg(e.name order by e.seq) filter (where e.name not in ('session_start', 'heartbeat', 'session_end')))[1] as first_action,
    max((e.props->>'away_ms')::bigint) filter (where e.name = 'session_start') as away_ms,
    min(e.th) as th,
    min(e.quest) as quest
  from analytics.events e
  left join public.profiles p using (user_id)
  group by e.session_id, e.user_id, p.nickname;

-- D1, D3 and D7: of the players who first played on a day, how many played
-- again exactly that many days later.
create view analytics.v_retention with (security_invoker = true) as
  with days as (
    select distinct user_id, (at at time zone 'utc')::date as day from analytics.events where not offline
  ),
  firsts as (select user_id, min(day) as first_day from days group by user_id)
  select
    f.first_day,
    count(*) as players,
    count(*) filter (where exists (select 1 from days d where d.user_id = f.user_id and d.day = f.first_day + 1)) as d1,
    count(*) filter (where exists (select 1 from days d where d.user_id = f.user_id and d.day = f.first_day + 3)) as d3,
    count(*) filter (where exists (select 1 from days d where d.user_id = f.user_id and d.day = f.first_day + 7)) as d7
  from firsts f
  group by f.first_day
  order by f.first_day;

-- The first-time experience as a funnel: each quest and each scene, how many
-- players reached it, and the median minutes played to get there.
create view analytics.v_ftue with (security_invoker = true) as
  with steps as (
    select user_id, 'quest' as kind, (props->>'index')::int as ord, props->>'id' as step, min(played_min) as minutes
      from analytics.events where name = 'quest_done' group by user_id, props->>'index', props->>'id'
    union all
    select user_id, 'scene', null, props->>'id', min(played_min)
      from analytics.events where name = 'scene_done' group by user_id, props->>'id'
  )
  select
    kind,
    ord,
    step,
    count(distinct user_id) as players,
    percentile_cont(0.5) within group (order by minutes) as median_minutes
  from steps
  group by kind, ord, step
  order by kind, ord nulls last, players desc;

-- The playtest's signals (Docs/playtest.md §5): how often, by how many, and
-- how long the wait was.
create view analytics.v_signals with (security_invoker = true) as
  select
    name,
    count(*) as count,
    count(distinct user_id) as players,
    round((percentile_cont(0.5) within group (order by (props->>'wait_ms')::numeric) / 60000)::numeric, 1) as median_wait_min
  from analytics.events
  where name in ('treasure_placed', 'treasure_picked', 'sighted', 'discovered', 'reveal_unasked', 'return_tap',
                 'survey_opened', 'survey_claimed')
  group by name;

-- The store's funnel (14-monetization.md §4), by SKU and payer profile. An
-- intent is not a conversion.
create view analytics.v_store_funnel with (security_invoker = true) as
  select
    coalesce(e.props->>'sku', '(store)') as sku,
    s.data->'Modules'->'player.payer'->>'Profile' as payer,
    count(*) filter (where e.name = 'store_opened') as store_opened,
    count(*) filter (where e.name = 'confirm_opened') as confirm_opened,
    count(*) filter (where e.name = 'purchased') as purchased,
    count(*) filter (where e.name = 'dismissed') as dismissed,
    count(*) filter (where e.name = 'refused_no_credit') as refused_no_credit,
    count(distinct e.user_id) as players
  from analytics.events e
  left join public.saves s using (user_id)
  where e.name in ('store_opened', 'confirm_opened', 'purchased', 'dismissed', 'refused_no_credit')
  group by 1, 2
  order by players desc;

-- What players do on the world board, and why the server says no.
create view analytics.v_world with (security_invoker = true) as
  select
    props->>'kind' as kind,
    coalesce(props->>'why', 'ok') as outcome,
    count(*) as count,
    count(distinct user_id) as players
  from analytics.events
  where name = 'world_cmd'
  group by 1, 2
  order by kind, count desc;

-- Errors no tester reports.
create view analytics.v_errors with (security_invoker = true) as
  select
    props->>'message' as message,
    count(*) as count,
    count(distinct user_id) as players,
    max(at) as last_seen,
    max(game_version) as last_build,
    (array_agg(props->>'stack' order by at desc))[1] as stack
  from analytics.events
  where name = 'client_error'
  group by 1
  order by last_seen desc;
