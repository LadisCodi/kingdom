# Plan — analytics for playtesters

> **What this is.** What the game sends to the Supabase server about how it is
> played, how it gets there, and how it is read. It builds the pipeline
> [`../features/14-monetization.md`](../features/14-monetization.md) §4
> designs, and puts [`../playtest.md`](../playtest.md) §5's signals on it.
>
> **Status: steps 1–3 built**, live with the next release. Code:
> `src/analytics/`, `src/sim/analytics.ts`; table and views:
> `supabase/migrations/20261006090000_analytics.sql`.

## 1. Steps

| # | Step | What changes |
|---|---|---|
| 1 | **The table and the sender** | `analytics_events`; the client's queue and uploader; the envelope (§2) |
| 2 | **The events** | every event of §3, from the two places they come from (§4) |
| 3 | **The views** | the SQL views of §6 |
| 4 | **The first read** | a report from the views after the first week of testers |

- Steps 1–3 ship in one release; the server half goes out with it, by the
  release rule in `CLAUDE.md`.

## 2. The envelope

Every event is one row:

| Field | What it is |
|---|---|
| `id` | a uuid made by the client; the primary key |
| `user_id` | the signed-in Supabase user |
| `session_id` | a uuid made at each session start |
| `seq` | the event's number within its session |
| `at` | the game's clock (`Game.now`, the server's time) |
| `received_at` | the database's clock at insert |
| `game_version`, `save_version` | the build |
| `name` | the event (§3) |
| `props` | its fields, JSON |
| `th`, `quest`, `played_min` | Townhall level, the quest the player is on, minutes played to date |
| `scene` | `province`, `world`, or the overlay open |
| `offline` | true for what the replay of an absence produced |
| `dev` | true for a session with `?dev` |

- `played_min` is a new save field: milliseconds the game was visible,
  counted by the tick.
- A player is named by their nickname (`profiles`) once they have one; until
  then by their id.

## 3. The events

### 3.1 Sessions

| Event | Props |
|---|---|
| `session_start` | `away_ms`, what the absence produced (the welcome report's totals) |
| `heartbeat` | — ; every 60 s while the page is visible |
| `session_end` | `length_ms`; on hide |

- A session starts at load and when the page shows again after 5 minutes
  hidden.

### 3.2 Progression

| Event | Props |
|---|---|
| `quest_done` | `index`, `id` |
| `scene_done` | `id` |
| `door_opened` | `id` |
| `book_opened` | `tome` |
| `research` | `tech` |
| `townhall_level` | `level` |
| `world_joined` | `board`, `players` (humans on it) |
| `relic_restored` · `relic_levelled` | `relic`, `level` on a level |
| `relic_forged` | `relic`, `slot`, `gems` |
| `fragment_pack` | `gems`, `n` — the store's pack of random fragments |
| `premium_shrine` | `n` (which), `gems` |
| `relic_hosted` | `relic` — moved or put in a Shrine; `world` when in a Chapel |
| `relic_activated` | `relic`, `level`, `shrine_level`, `mana` — a city relic woken in its Shrine |
| `item_used` | `item`, `count` — one Use, ×N counted once; `job` (`queue`, `training`, `workshop`, `explorer`, `hex`) for a speed-up, `coin` for a choice chest |

### 3.3 The playtest signals

| Event | Props |
|---|---|
| `treasure_placed` · `treasure_picked` | `n`, `wait_ms` on a pick |
| `sighted` · `discovered` | `id`, `wait_ms` on a discovery |
| `reveal_unasked` | `cells` |
| `return_tap` | `kind` |
| `survey_opened` · `survey_claimed` | `level`, `paid` on a claim |
| `notice_opened` | `id` — `news:<group>`, `state:<name>` or `more` — and `count`, the news it read |
| `friends_named` · `friends_invited` | — |
| `crest_changed` | `tincture`, `charge` |
| `friend_request` · `friend_accept` · `friend_decline` · `friend_remove` | — (only those that took); `from: 'search'` on a request from the search popup |
| `inbox_cleared` | — |
| `wish_pinned` · `wish_filled` | `need`, `give` (lot keys: `m:Starmetal`, `f:<relic>:<slot>`) |
| `friend_helped` | `mana` (what the help banked; 0 at a full pool) |
| `friend_withdrawWish` | — |

### 3.4 The store

| Event | Props |
|---|---|
| `store_opened` | `from` — not a return from its own confirmation |
| `confirm_opened` | `sku`, `price_cents`, `from` — a price tapped opens it |
| `purchased` · `refused_no_credit` | `sku`, `price_cents`, `credit_cents` |
| `dismissed` | `sku` |
| `offer_opened` | `sku`, `trigger` — an offer's window opened (sim/offers.ts) |
| `gems_spent` | `sink`, `gems` — Gems spent in the store outside a product (`explorer`) |
| `ad_offer_shown` · `ad_watched` | `placement` |

### 3.5 The world and errors

| Event | Props |
|---|---|
| `world_cmd` | `kind`, `ok`, `why` |
| `client_error` | `message`, the top of the stack; at most 20 a session |

## 4. Where events come from

- **The sim:** `recordEvent` (`sim/events.ts`), the one place every tally is
  counted, also appends to a transient outbox on the state, never saved — as
  `pendingDiscoveries` is. The game drains it each tick. The sim stays pure:
  no clock, no network.
- **The game:** sessions, menus, the store, world commands and errors are
  emitted by `Game` and `main`.
- What the replay of an absence produces is sent, marked `offline`.

## 5. Sending

- **The table:** `analytics_events`, append-only. RLS lets a signed-in user
  insert rows whose `user_id` is theirs, and read back only the `id`s of
  their own — what `on conflict (id) do nothing` needs. No update or delete.
- **The queue:** events wait in memory and in localStorage, so a session's
  events left unsent go with the next one.
- **The upload:** a batch every 30 s, and at once when the page is hidden.
  Inserted ignoring duplicates on `id`, so a batch sent twice counts once.
- **Limits:** `props` at most 2 KB; at most 200 queued, the oldest dropped.
- **No cloud:** with no Supabase env, nothing is queued.
- **Kept for** 90 days: `select public.prune_analytics()` deletes the rest.
- **Privacy:** no personal data. Settings says that the prototype sends
  anonymous play data.

## 6. Reading

Views in the `analytics` schema — not exposed to the API — read from the
Supabase SQL editor, or by asking Claude, who queries them
(`npx supabase db query --linked "select * from analytics.v_testers"`) and
writes up what they show. `analytics.events` is every event without the dev
sessions:

| View | One row per | Shows |
|---|---|---|
| `v_testers` | player | nickname, first and last seen, sessions, play time, Townhall, quest, books, payer profile — from the events and the latest save |
| `v_sessions` | session | start, length, events, what it opened on |
| `v_retention` | day of first play | players, and how many came back on days 1, 3 and 7 |
| `v_ftue` | quest and scene | players who reached it, and the median minutes played to get there |
| `v_signals` | signal | counts and median waits (`playtest.md` §5) |
| `v_store_funnel` | SKU | each step of `14` §4, by payer profile |
| `v_world` | command kind | sent, accepted, refused by reason |
| `v_errors` | error message | count, players, last seen, build |

- Every view leaves out `dev` sessions.
- The numbers are read by [`../playtest.md`](../playtest.md) §4, and an
  intent is never a conversion (`14` §0).

## 7. Deliberately not in this design

- A live dashboard
- Export to the studio's BigQuery
- Linking a player across devices
- Events per tap, per tick or per camera move
- Anything a player types, beyond the nickname
