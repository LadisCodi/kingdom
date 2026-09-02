# Feature: the social layer — neighbours, a guild, and one deadline a week

> Phase 4 of [`../road-to-mvp.md`](../road-to-mvp.md), and the largest project
> in the plan. **Status: designed, unstarted.**
>
> The 2026-09-02 competitive review's headline finding: **Kingdom has no social
> mechanic of any kind**, and the four that separate the titles which last from
> the ones that do not are a persistent guild, a weekly activity with a hard
> deadline, a collective bar with chests at thresholds, and daily help with a
> cap. `00-design-intent.md` files the whole area as *not started at all*.
>
> Companion docs: [`engine-seams.md`](engine-seams.md) §2 (modifiers), §5
> (the timeline this reuses wholesale), [`expeditions.md`](expeditions.md) §1
> (the contested landmark), [`magic.md`](magic.md) §4 (what a landmark pays).

## 0. What the review actually supports, and what it does not

Stated honestly, because the argument gets overclaimed easily: **the guild stack
does not buy monthly revenue.** Rise of Cultures has all four mechanics and sits
at $118K/month — InnoGames stopped its user acquisition and it is in harvest
mode. What the evidence supports is narrower and more useful:

> The two titles in this quadrant with genuinely long lives — Forge of Empires
> at €500M lifetime, Elvenar at €200M — are the two that have run the full stack
> for twelve and nine years. The one that shipped without a persistent guild,
> Sunrise Village, is the floor the brief audit identified.

The stack is not a revenue lever. It is **the infrastructure of duration**,
which is the variable the audit named as the real bottleneck — internal RPD
$0.48 against $5.03–5.84, with an ARPDAU that already beats Township's.

And at prototype population — five to ten named playtesters — this phase can
answer *"do the mechanics work and hold together"* and cannot answer *"does a
community form"*. That second question needs strangers, and it is out of scope
(`../road-to-mvp.md` §1).

---

## 1. Supabase is the server

The decisive fact: **a Postgres function marked `security definer` runs with the
function owner's rights, not the caller's.** So it can enforce a rule the client
cannot bypass — a daily cap, a membership check, a counter that may only
increase — with no game server written and none hosted. The repo already carries
`@supabase/supabase-js`, anonymous sign-ins, and one RLS-guarded table.

**The pattern for the whole phase:**

- **Tables are readable but never directly writable.** RLS grants `select` where
  the row is visible to you; **no client-side `insert`, `update` or `delete` on
  anything shared.**
- **Every mutation is an RPC** — one `security definer` function per action,
  which validates, applies the cap, and returns the new state.
- **Every mutation is idempotent**, keyed on a client-supplied id, so a retry on
  a flaky connection cannot double-spend a daily action or double-count a
  contribution.

### 1.1 The limit, said out loud

Postgres validates **the rules of the social layer** — caps, membership,
monotonic counters. It does not validate **the economy of a city**: the sim runs
on the client, so a player who edits their wallet in devtools can inflate what
they contribute. With named playtesters that is acceptable. In a product it is
not, and the fix is the sim on the server — which is exactly why the sim's
purity (pure TS, injected `now`, counter/hash RNG in integer arithmetic) is
worth not breaking in the meantime.

### 1.2 How external input reaches a deterministic sim

This is the subtle risk of the whole phase. The sim's load-bearing assertion is
that **a one-call offline replay equals stepped ticking**, and a gift arriving
from another player is input the replay knows nothing about.

> **Rule: server effects are drained at load, before the offline advance, and
> enter the state as ordinary modifiers with an explicit `expiresAt`.**

That is the same position and the same reasoning as `reconcileSchedule`, which
merges the authored catalogue into `state.schedule` at load and before the
replay (`save.ts:311`) precisely so that a window which opened during an absence
still fires. A drained gift is a live command with a definite timestamp; after
it lands, the replay is pure again. **Nothing may write into another player's
save.** RLS forbids it, and so does the determinism argument.

---

## 2. Identity

Today each browser gets an anonymous account and **clearing browser storage
orphans the save** — the README calls it a prototype limitation. A social layer
cannot be built on an identity that evaporates, and other players need something
to call you.

**Minimum viable identity:**

1. A **display name**, chosen once, unique-ish, stored in a `profiles` table
   keyed by `auth.uid()`.
2. **Optional email linking** on the existing anonymous account, for recovery.
   Supabase supports promoting an anonymous user, so this costs a form and no
   new infrastructure — and it stays optional, so the "just play" path survives.

**Not in scope:** avatars, friend requests, chat, moderation. Chat in
particular is a moderation liability that a prototype cannot staff, and none of
the mechanics below need it.

---

## 3. Neighbours and daily help

The cheapest retention mechanic in the genre. A player opens the game, taps
"help" on five villages, and leaves. Forge of Empires allows one action per
player per 24 h and pays blueprints; Elvenar's Neighbourly Help works the same;
the 4X titles cut other people's build timers. **It needs no guild — just a
list.**

### 3.1 The design

- **The list** is the player's guild plus a rotating handful of other active
  players, served by an RPC so the client never enumerates the user table.
- **The cap**: one help per target per 24 h, and `help.dailyTargets` targets per
  day (start at 5). Both enforced in the RPC, both idempotent.
- **Helping pays the helper immediately**: Mana — cheap to grant, always wanted,
  and already priced in seconds of the player's own production so it never goes
  stale — plus event points while an event is running
  ([`event-archetype.md`](event-archetype.md) §3.2), which is what ties the two
  pillars together.
- **Helping leaves the target a gift**, not a mutation: a row in
  `pending_effects` that their client drains at next load (§1.2) and applies as
  a `buildSpeed` modifier for a fixed window. The target needs no live session,
  and their save is never touched by anyone else.

`buildSpeed` is one of the four stats [`event-archetype.md`](event-archetype.md)
§2.1 adds to `ModifierStat`, which is why that widening comes first.

### 3.2 Decision 8, answered

*Does helping touch the other player's state, or only your own?* **Only your
own, plus a queued gift they claim.** It is cheaper, it needs no presence, it
cannot corrupt a save, and it keeps the determinism rule intact. The cost is
that a gift is not instant, which nobody will notice in a game played in two or
three visits a day.

---

## 4. The guild

- **Persistent**, 10 members for the prototype, two roles: leader and member.
- Membership rows in Postgres; joining, leaving and kicking are RPCs.
- **No chat** (§2).
- **One guild per player.**

### 4.1 Decision 7, answered — and a scope cut

*Cooperative, or ranked between guilds?* The design's own line points at ranked:
*"the best guild of the week is the best-managed economy."* That is the softest
form of competition available and it is coherent with a game that refuses PvP.

**But with five to ten playtesters there is no league**, and shipping a
leaderboard with two entries teaches us nothing and looks broken.

> **MVP ships the cooperative bar. The league is designed and deferred.**

The design is small when the bar exists: guild score for the week is the bar's
final value, and a league is a table of those with promotion and relegation
between tiers. That is a Phase-6 row, not an MVP feature, and it is recorded in
`../road-to-mvp.md` §9 so it does not get rediscovered.

---

## 5. The weekly, and why it is nearly free

> **The guild week is a timeline template.** Not a new scheduler.

`EVENTS` already contains a recurring window with a hard deadline — the
Conjunction, 48 hours on a 7-day period, with stable occurrence ids
`<template>#<n>`, phases that persist so it cannot pay twice, and
reconciliation before the offline advance so a window that opened *and* closed
during an absence still fires. A guild week is the same shape with a longer
duration:

```jsonc
{ "id": "guildWeek", "startsAt": "<epoch monday>",
  "durationMs": 604800000, "periodMs": 604800000 }
```

The occurrence id is what the server keys the bar on, which means **client and
server agree on which week it is without a clock negotiation** — the property
`engine-seams.md` §5 built occurrence ids for in the first place.

### 5.1 What contributes

*"The best-managed economy wins the week."* So contributions are the things a
player was going to do anyway, submitted as they happen:

| Contribution | Weight source |
|---|---|
| An **order** completed ([`habit-loop.md`](habit-loop.md)) | its reward tier |
| A **delve depth** extracted | depth × tier |
| A **landmark** claimed, a **ruin** first-cleared | flat, large |
| Resources **donated** to the guild | a fraction of the city's hourly rate |
| A **help** given | flat, small |

Weights are priced against **the contributor's own production rate**, not in
absolute units, so a Townhall-1 player and a Townhall-3 player contribute
comparable *shares* of their capacity. That is the rule `../road-to-mvp.md` §10
asks of every new number, and here it is also what stops the bar from being a
measure of who started playing first.

### 5.2 The bar and the chests

- One **collective bar** per guild per occurrence.
- **Chests at thresholds**, paid **the moment the threshold is crossed**, to
  every member — not at the close. Instant feedback, and nobody has to be online
  at midnight on Sunday.
- The bar **resets** with the next occurrence. Nothing is taken: chests already
  paid stay paid.
- Server-side the bar is a **monotonic counter**: the RPC refuses a decrease,
  and each contribution carries a client id so a retry is a no-op.

### 5.3 The deadline is the feature

Promise 1 authorises this in as many words — *pressure comes from opportunity
that expires… never from loss of property* — and
[`event-archetype.md`](event-archetype.md) §5 makes the same argument at length.
A week that does not close is a checklist.

---

## 6. The contested landmark, as the week's first content

Backlog **gap 1**: `defended: true` is authored on four of the ten landmarks,
claiming is gated on `landmarks.cleared`, and **nothing in the codebase ever
writes that field.** So the 100,000-Gold far ring is unreachable, and combat has
no job outside a dungeon — which the backlog itself calls out as the thing it
most wants fixed.

### 6.1 Decision 9, answered — one mechanic that scales from 1 to 10 players

*Full expedition sheet, or a lighter pass that spends army power?* **Neither, and
both:**

> **Commit army power to a siege that resolves at the week's deadline.**

- A player **commits units** to the landmark. They are unavailable for delves
  while committed — a real cost, and the first time the army has to be
  *allocated* rather than merely owned.
- At the deadline the **sum of committed power** is scored against the
  landmark's authored threat through the same scoring pass a delve depth uses
  (`combat.ts`), with the same type chart and the same `guaranteedDepth`-style
  preview so a well-prepared siege never fails.
- If it falls, **`landmarks.cleared` is written for every contributor**, and
  everyone who committed gets the +10 Mana cap. If not, the units come home and
  the siege is available next week. **Nothing is lost** — the promise holds.

Why this is the right shape: **it is one command whose contributor count can be
one or ten.** A solo player can besiege the nearest defended landmark alone over
several weeks; a guild takes it in one. No second mechanic for the solo case, no
synchronous play required, no battle screen, and it gives the military
buildings the job outside dungeons the backlog asked for.

It also fixes the runway problem `knowledge.md` §6 flags — a player who never
delves makes no collection progress at all — because a siege is a second route
into the content chain that does not require a hero.

---

## 7. Schema sketch

Illustrative, not final. The shape is what matters: shared tables readable,
never client-writable; one RPC per action.

```sql
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null unique,
  guild_id uuid references public.guilds(id),
  created_at timestamptz not null default now()
);

create table public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  leader uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- one row per guild per timeline occurrence: the bar
create table public.guild_week (
  guild_id     uuid not null references public.guilds(id) on delete cascade,
  occurrence   text not null,              -- 'guildWeek#123'
  points       bigint not null default 0,  -- monotonic, RPC-only
  chests_paid  int    not null default 0,
  primary key (guild_id, occurrence)
);

-- idempotency + audit: what each member contributed
create table public.contributions (
  id         uuid primary key,             -- client-supplied
  guild_id   uuid not null,
  occurrence text not null,
  user_id    uuid not null references auth.users(id),
  kind       text not null,
  points     int  not null check (points > 0),
  created_at timestamptz not null default now()
);

-- gifts waiting to be drained by their target's client
create table public.pending_effects (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  from_user  uuid not null references auth.users(id),
  kind       text not null,                -- 'help'
  payload    jsonb not null,
  created_at timestamptz not null default now(),
  drained_at timestamptz
);

-- daily caps live here, not in the client
create table public.help_log (
  from_user uuid not null,
  to_user   uuid not null,
  day       date not null,
  primary key (from_user, to_user, day)
);
```

RPCs, all `security definer`: `set_display_name`, `create_guild`, `join_guild`,
`leave_guild`, `neighbour_list`, `give_help`, `contribute`, `drain_effects`,
`commit_units`, `resolve_siege`.

**What each RPC enforces** — the reason they exist rather than direct writes:
`give_help` enforces one per target per day and `help.dailyTargets` per day;
`contribute` enforces guild membership, a positive delta, the current occurrence,
and idempotency by row id; `drain_effects` stamps `drained_at` so a gift is
applied exactly once; `resolve_siege` may only run once per occurrence.

---

## 8. Build order

Each step is playable before the next exists.

1. `profiles`, display name, optional email linking. Nothing social yet — but
   the save stops evaporating, which is worth shipping on its own.
2. `neighbour_list` + `give_help` + `pending_effects` + `drain_effects`. The
   first social loop, with no guild.
3. `guilds`, membership RPCs, a roster screen.
4. `guildWeek` template in `events.json`, `guild_week` table, `contribute` from
   the five sources in §5.1, the bar, threshold chests.
5. The siege: `commit_units`, unit commitment in the client, `resolve_siege` at
   the deadline, `landmarks.cleared` written.
6. Only then: consider the league (§4.1) — and probably do not, at this
   population.

## 9. Exit gate

- Two playtesters in one guild each see the bar move because of what the other
  did.
- The daily help cap holds against a client that calls the RPC twice for the
  same target, and against a client that replays the same contribution id.
- A gift given while the target is offline is applied exactly once when they
  return, and **the replay assertion still holds** — one-call offline advance
  equals stepped ticking, with a drained gift in the state.
- A siege committed by one player over three weeks clears the same landmark a
  guild clears in one.
- No client can read the contributions of a guild it is not in.

## Open questions

- **Does a guild need a minimum size to score?** With ten playtesters, one guild
  of two and one of eight makes the bar meaningless. Either thresholds scale
  with member count — which invites roster-gaming — or the prototype runs a
  single guild. Leaning toward **one guild for the prototype**, and noting the
  scaling problem as a real design question for later.
- **What happens to committed units if a player leaves the guild mid-siege?**
  Cheapest answer: their commitment stays until the deadline and then returns to
  them. Anything else needs a withdrawal path nobody will use.
- **Donations of resources: which resources, and does it become a laundering
  loop?** The order rule applies — a contribution must never pay back what it
  asked for — but donations sit closer to that line than orders do.
- **Rate limits on a free Supabase project.** Five playtesters is nothing;
  `contribute` firing on every order and every depth is not. Batch contributions
  the way the telemetry queue batches ([`monetization-sim.md`](monetization-sim.md)
  §4), and say so before the first playtest rather than after it.
