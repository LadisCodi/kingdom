# Road to MVP — the development plan

> **What this file is.** The ordered plan for designing, specifying and building
> the pillars the 2026-09-02 competitive review found missing, and the register
> of design decisions that have to be closed along the way.
>
> **Status: the plan is live. Phase 0 is BUILT; Phase 1 is half built — the
> daily chest ships, generated orders are blocked on decision 3. Phases 2–5
> are unstarted.** (2026-09-02)
>
> This file owns the *sequence* and the *gates*. It does not own designs — each
> pillar has its own doc in [`features/`](features/), listed in §8. The
> canonical backlog of what shipped and what is broken stays in
> [`00-design-intent.md`](00-design-intent.md); this file is what happens next.

## 0. The premise, stated plainly

**Kingdom is a disposable web prototype.** It exists to answer questions, not
to be shipped. Three consequences run through every phase:

1. **No real purchases, ever.** Monetisation is *simulated and instrumented*:
   nothing charges, everything is recorded. That is not a compromise forced by
   the prototype — it is the correct instrument for the question we are asking
   (§1.2). It comes with a reading rule that must be repeated every time
   someone looks at the numbers: **an intent is not a conversion.** A tap on a
   free "buy" button measures desire with the price friction removed, which is
   an upper bound and nothing else.
2. **The city stays client-authoritative.** We are not porting the sim to the
   server. The sim is written so it *could* be — pure TS, injected `now`,
   counter/hash RNG with integer arithmetic — and that property is worth
   keeping, but a prototype that spends six weeks earning trust it does not
   need is a prototype that answers nothing. What *does* get server authority
   is the social layer and the intent log (§0.1), because those are the two
   places where a lying client destroys the data instead of just the save.
3. **Some questions are out of scope and stay out.** CPI, IPM, real cohorted
   D30, measured ARPDAU, and the pixel-vs-3D-cartoon creative test are *not*
   MVP questions. They belong to the validation plan in the 2026-09-01 brief
   audit and need real user acquisition, not a better prototype. Saying so here
   is what stops the MVP from quietly growing into a soft launch.

### 0.1 Supabase is the server

The repo already has `@supabase/supabase-js`, anonymous sign-ins and one
RLS-guarded table (`supabase/schema.sql`). That is enough, because of one thing
that is easy to miss: **a Postgres function marked `security definer` is server
authority.** It runs with the function owner's rights, not the caller's, so it
can enforce a rule the client cannot bypass — a daily help cap, a guild
membership check, a contribution that may only ever increase — without anybody
writing or hosting a game server.

So the architecture for the whole plan is:

| Concern | Where it lives | Authority |
|---|---|---|
| City simulation, economy, delves, events | client, `src/sim/` | client (accepted) |
| Save | `public.saves`, RLS by `auth.uid()` | per-player |
| Neighbours, guilds, help, collective bars | Postgres tables + `security definer` RPC | **server** |
| Purchase-intent log, telemetry | Postgres tables, insert-only RPC | **server** |

The limit, said out loud so nobody is surprised later: Postgres validates the
rules of the *social* layer — caps, membership, monotonic counters — not the
economy of a city. A player who edits their own wallet in devtools can inflate
their own contribution. In a prototype with named playtesters that is an
acceptable risk; in a product it is not, and the fix is the sim on the server,
which is exactly why the sim's purity is worth not breaking in the meantime.

## 1. What this MVP has to answer

Three questions, in priority order. Every phase gate below is written as
evidence for one of them.

### 1.1 Does the loop hold for thirty days?

The brief audit's central correction was that Kingdom's problem is **months
active, not ARPDAU** — internal RPD $0.48 against $5.03–5.84 in the quadrant,
with an ARPDAU that already beats Township's. The competitive review then found
that everything in the game is authored once with a hard ceiling: five ruins,
ten landmarks, a tech tree exhausted in three hours, fifty quests and then the
pill disappears.

So the question is not "is it fun" — it is **"on day 14, is there still
something to want that nobody had to author by hand?"** Phases 1 and 2 exist
for this. The evidence is real sessions by real playtesters over real weeks,
not a designer's playthrough.

### 1.2 Where would people pay?

Not *how much* — that needs a store. **Which surfaces have demand.** Today the
Gems `+` button is a no-op and three of the four things Gems buy are one-time
purchases, so there is nothing to have an opinion about. Phase 3 builds the
simulated store and the intent log, and the deliverable is a ranking of
surfaces by tap-through, with the intent-is-not-conversion caveat attached.

### 1.3 Is there a demo that carries the thesis?

The paid fog is filmable and nobody else has it. Phase 5 is the cut: the
smallest set of screens that shows *reveal → find → build → delve → the week's
guild goal*, with nothing half-built visible. Greenlight material.

**Explicitly not an MVP question:** how the social layer *feels* in the hands
of strangers. We are building it for real (Phase 4) but the prototype's
population is playtesters we know, so the answer will be about mechanics, not
about community.

## 2. Phase 0 · Firm ground — **BUILT 2026-09-02**

**Doc:** [`features/balancing-v3.md`](features/balancing-v3.md)

Nothing below can be balanced on top of a document that contradicts itself.
Four numbers and one dead dial:

- **Mana has three incompatible number sets** inside `magic.md` alone — cap
  100/130/160 with 10/13/16 per hour; then "the initial cap went to 50"; then a
  tunables table with 24/32/40 and 4/5/6. Mana is the session gate; the whole
  model hangs off it in both monetisation postures.
- **The tech tree is 20 techs in one doc and 24 for 6,600 Gold in another.**
- **The Townhall cycle is 60 s / 1 s in `harvest-loop.md` §2 and 10 s / 2 s in
  its own §7 table.**
- **The Gem faucet is 110 against its own budget of 75**, because eleven quests
  got Gem rewards without re-deriving the total. The paid accelerator is being
  given away.
- **`kingdom.maxBuilders` is authored 4 and nothing raises it past 1**, so all
  of `queue.ts`'s promotion logic is unreachable. Turning it on is the cheapest
  monetisation surface in the game (see §5).

**Gate — met.** `npm test` green (41 suites, 556 tests) and a reader can find
one number for each dial without choosing between three. Gap 3 turned out not
to reproduce and is struck; the builder dial is live and priced by nobody yet,
which is Phase 3's problem. Two questions outlived the pass and are logged as
open decisions: the Mana-refill price (→ decision 4's neighbourhood) and when
to re-derive the tree's Gold (→ eras, §9). **Cost:** one session, as predicted.

## 3. Phase 1 · The habit layer — **daily chest BUILT 2026-09-02**

**Doc:** [`features/habit-loop.md`](features/habit-loop.md)

Two mechanics, both cheap, both attacking question 1.1 directly.

- **A daily chest and a streak.** The only mechanic present in all six
  comparables and all three 4X titles, and Kingdom does not have it. The
  natural reward is **Mana** — already the thing a returning player wants — with
  Gems at the week markers, which is also the recurring Gem faucet
  `balancing-v2.md` §1.3 asked for and never got.
- **Generated orders.** Every sink in Kingdom is finite and already sized:
  6,600 Gold of tech tree against a quest chain that pays 12,075. When the tree
  is done — three hours — surplus resources have nowhere to go, and the Market
  only converts them into Gold, which also has nowhere to go. An order is
  "bring me X + Y + Z, take this reward", and it generates forever.

The reason orders are nearly free here: the quest **goal types are code but the
goals are data**, and the types we need already exist — `CollectResource`,
`SellGoods`, `CollectTaps`, `HoldResource`. A daily order set is a draw from the
seeded RNG over existing types with scaled amounts. It needs a *generator*, not
new types.

**Gate:** a player who has finished all authored content still has a reason to
open the game tomorrow, and it did not cost a designer an afternoon.
**Cost:** days.

**Half met.** The daily chest ships with a ladder that advances on days
*played* and therefore cannot be lost — decisions 1 and 2 closed. Generated
orders are still unstarted and blocked on decision 3 (which building they live
in), which is the one §8 marks as needing a decision rather than a preference.

## 4. Phase 2 · The event archetype

**Doc:** [`features/event-archetype.md`](features/event-archetype.md)

This is the pillar the brief audit called the moat, and it is half-built in the
best possible position. **The machinery exists and is verified**: `timeline.ts`
with persisted phases, catalogue reconciliation before the offline advance,
recurring templates with `periodMs` and stable occurrence ids
(`<template>#<n>`, materialised ±30 days), the modifier layer with `'season'`
and `'event'` already in the source enum, and the load-bearing assertion —
one-call replay equals stepped ticking — holding across a Conjunction window
that opens *and* closes during an absence.

What is missing is not the engine. It is **the archetype**, which is the thing
you author ten times a year: an event currency, a minigame with a roll resource
that regenerates, a grand-prize bar, a shop with rotating stock and one free
daily refresh, and a two-track pass on top. The game today has **one authored
event (the Conjunction) and zero banners.**

Two seam widenings come first, once, deliberately:

| Widening | Today | After |
|---|---|---|
| `ModifierStat` | closed union of 8 | plus build speed, research speed, training speed, delve speed, fog cost, Knowledge yield, Fragment yield |
| Schedule payloads | `grantModifier \| grantReward \| banner \| marker` | plus `eventTrack` (milestone ladder, two reward columns = the pass) and `eventShop` (stock rows + refresh cadence) |

**Gate — and this is the most important number in the whole plan:** author the
*second* event and time it. The first event is a build; the second is a
measurement. **That number is the marginal cost of a content drop, and it is
what decides whether this studio can sustain the ten-a-year cadence the genre
runs on.** Forge of Empires ships 6–7 major events a year, Elvenar 10. If our
second event costs a sprint, the answer to the audit's organisational finding
is already no, and better to know it in week six than in month nine.
**Cost:** weeks.

## 5. Phase 3 · Simulated monetisation

**Doc:** [`features/monetization-sim.md`](features/monetization-sim.md)

- **A store that does not charge.** Gem packs, the pass, the second builder,
  event-shop stock — real prices on the card, a real confirmation flow, and a
  grant with a visible `SIMULADO` marker so no playtester ever believes they
  bought something. Every step of the funnel logs: offer shown, card opened,
  confirmed, dismissed.
  *(The second builder already ships as a priced offer raised by a refused
  build — [`features/builders.md`](features/builders.md). What is left for
  this phase is the store CARD, and the point of keeping both is that a
  surface the player is sent to and one they stumble into answer different
  questions.)*
- **Rewarded video from one placement to five or six.** The current design is
  genuinely good — the ad pays a whole Mana pool, ten sanctuaries double the
  pool and therefore double every future ad, the offer only appears below half
  a pool, the cooldown is randomised 30–90 s so it is not a metronome. The
  problem is that it is *one* placement. Add: double a quest reward, refresh the
  event shop, skip a builder timer, a second daily chest.
- **Telemetry to Supabase**, insert-only, with the session and the wall-clock
  minute, so §1.1 and §1.2 have data instead of anecdote. No doc in the repo
  mentions an event pipeline today, which means there is currently no way to
  produce a D30 at all — and D30 thresholds are a written greenlight condition
  in the brief audit.

**Gate:** a one-page read-out that ranks surfaces by intent, from at least two
weeks of playtester sessions. **Cost:** days for the store, ongoing for the
read-out.

## 6. Phase 4 · The social layer

**Doc:** [`features/social-layer.md`](features/social-layer.md)

The pillar with the most weight in the review, and the largest project here.
Ordered so that each step is playable before the next exists:

1. **Real identity** — the anonymous account gains a name. Today clearing
   browser storage orphans the save; a social layer cannot be built on that.
2. **Neighbours and daily help with a cap.** A player opens the game, taps
   "help" on five villages and leaves. Forge of Empires gives one action per
   player per 24 h; the 4X titles cut other people's timers. Near-zero cost,
   very high daily retention, and it needs no guild — just a list.
3. **A persistent guild**, membership enforced in Postgres.
4. **A weekly activity with a hard deadline and a collective bar with chests at
   thresholds.** The combination every long-lived title in the quadrant has.
   Kingdom's design already names its own version — *"the best-managed economy
   wins the week"*.
5. **The contested landmark** (backlog gap 1) as that activity's first content.
   `defended: true` is authored, claiming is gated on `landmarks.cleared`, and
   nothing in the codebase ever writes that field — so the 100,000-Gold
   sanctuary ring is unreachable and combat has no job outside a dungeon.
   Clearing it collectively is a guild feature built on a scoring pass that
   already works.

**Gate:** two playtesters in one guild each see the bar move because of what
the other did, and the daily cap holds against a client that tries to spend it
twice. **Cost:** weeks.

## 7. Phase 5 · The cut

No new systems. Hide what is half-built, fix what reads as broken, script the
demo, film it. The one hard rule: **nothing in the demo may be a screen a
playtester cannot reach in the build.**

**Gate:** question 1.3 answered, by someone who is not on the team watching it
without narration.

## 8. Open decisions

The pillars are not all obviously compatible with the game as it stands. These
are the discussions to have, each with what it blocks. **A decision is closed
by editing its pillar doc, not by writing the answer here** — this list is the
index.

| # | Decision | Blocks | Where it gets settled |
|---|---|---|---|
| 1 | **What the daily chest pays**, and what a streak adds beyond it. Mana is the obvious answer; Gems at week markers doubles as the recurring faucet §2 needs. | Phase 1 | `habit-loop.md` |
| 2 | **Are orders a board or a character?** How many a day, do they expire, and does an expiring order violate promise 1? A deadline is not a loss — but a *daily* deadline reads as a chore, which is a different problem. | Phase 1 | `habit-loop.md` |
| 3 | **Does an event currency get a wallet row?** `currency-simplification.md` just cut eleven rows to seven on purpose. Adding one back needs an argument, and the alternative — event progress that is not a currency at all — may be better. | Phase 2 | `event-archetype.md` |
| 4 | **How is a pass "bought" in a game with no purchases?** And is it priced in Gems or is it its own SKU? This is where the simulated store and the event archetype meet. | Phases 2–3 | `monetization-sim.md` |
| 5 | **Do events have a closing date?** This is the A/B fork from the review. It is not a dial: a deadline is a content pipeline commitment. | Phase 2 | `event-archetype.md` |
| 6 | **Does cosmetic content exist at all?** Nothing in the game is cosmetic today, and it is the natural monetisation of the audience the audit identified as the money. Also a pipeline, not a dial. | Phase 3 | `monetization-sim.md` |
| 7 | **What is a guild in a game with no PvP** — purely cooperative, or ranked between guilds? The design's own line points at ranked-on-economy, which is the softest form of competition available and still needs a league. | Phase 4 | `social-layer.md` |
| 8 | **Does helping touch the other player's state, or only your own?** The cheap version pays the helper and leaves a modifier for the helped, which needs no live session on the other side. | Phase 4 | `social-layer.md` |
| 9 | **How is a defended landmark cleared** — the full expedition sheet with a hero and a party, or a lighter one-off that spends army power? Open since 2026-09-02 in `00-design-intent.md`. | Phase 4 | `expeditions.md` |
| 10 | **Does the 8 h offline cap limit event rewards?** Backlog gap 5, decided rather than flagged. Harmless while there is one event; a support ticket once there is a calendar. | Phase 2 | `engine-seams.md` §5 |
| 12 | **Does the world map ever allow raiding a player's city?** Promise 1 says "no raids" by name, so this is the Dinasty/Kingdom fork the audit named — it decides the audience, not the feature list. `map-scopes.md` §5 argues that contested *territory* gets the same session-time benefit without reopening the promise. | the whole shape of the game | `map-scopes.md` |
| 13 | **Is the province plot bounded?** A balance number, not a refactor — and the thing that makes placement a decision and adjacency matter. Cheap enough to land inside the MVP. | Phase 1 onward | `map-scopes.md` §7 |
| 14 | **Are 3★ relic ingredients world-map-only?** It ties the game's only week-scale arc to the most expensive layer in the plan. | Phase 4 | `relics-and-ingredients.md` §2 |
| 15 | **What Stardust is for once ingredients are the tier gate.** Two gates where one never closes is worse than either alone. | with the rename | `relics-and-ingredients.md` §8 |
| 11 | **How many systems can this game carry?** `heroes-and-gacha.md` files ten progression systems as a standing accepted risk. This plan adds four more. The currency half was cut on 2026-09-02; the systems half never was. | every phase | `road-to-mvp.md`, here |

Decision 11 is the one that should make everyone uncomfortable, so it gets said
directly: **this plan makes the game bigger, and the game was already flagged
as too big.** The defence is that the four additions are not new systems but
*shells around existing ones* — orders are quests, the daily chest is Mana, the
event track is the timeline, the guild weekly is a delve scoring pass. If any of
them turns out to need its own economy, its own currency and its own screen, it
has stopped being a shell and should be cut instead of shipped.

## 9. Deliberately after the MVP

Named here so nobody has to rediscover them, and so they stay out of scope.

- **Eras — now specified.** The tech tree, by its own doc, is *"more a
  checklist than a tree"*. The conversion is designed in
  [`features/tomes-and-research.md`](features/tomes-and-research.md): tomes as
  pages, and **tome tiers as per-branch eras**, which is cheaper and more
  specialisable than a global age ladder. Still after the MVP, but no longer an
  open question.
- **The world map.** [`features/map-scopes.md`](features/map-scopes.md) is the
  structural decision this plan sits inside: the province bounded and authored,
  temporary provinces as the event format, and a shared node graph for the
  social and contested layer. Not MVP — but §7 of that doc lists the four cheap
  things to spend now, because the save is the one artefact that cannot be
  changed retroactively.
- **Adjacency v2.** There is exactly **one** adjacency rule in the whole game
  (Housing next to Housing, −1 Gold/min) and this last pass added five more
  buildings competing for the same ground. It is pure data — the `Adjacency`
  sheet is directed pairs with one effect column. Widen the column beyond Gold
  once and author twenty rules: the most design depth per hour of work in the
  repository. Only after the MVP because it deepens play rather than extending
  it, and the MVP question is extension.
- **A region generator.** The 10-line `regionId` discriminator is in;
  restructuring `GameState` into `regions: Record<RegionId, RegionState>` was
  explicitly cut. That restructure plus a seeded map generator with authored
  *constraints* turns "a second region" from a project into a row — and Knowledge
  is already kingdom-scoped on purpose so it survives a region reset.
- **Leagues, cosmetics, a rotating-stock recycling shop, dynamic difficulty
  that rescales weekly.** All in the review; none of them answer an MVP
  question.

## 10. The rule that should govern every reward we author

The best balance decision in the project is `tap.boost_seconds`: a tap hands
you **45 seconds of what the thing you tapped is producing**, floored at the
authored yield. That means a full pool is worth the same fraction of progress at
every stage of the game, **with nothing re-derived per era** — 73 minutes
against one Sawmill, 97 against two, 120 against three.

Every reward this plan adds should follow it. **Quest rewards are absolute Gold
amounts in a spreadsheet, and they will go stale on their own by era three.** So
will delve hauls, chest contents and pass milestones if we author them the same
way. Pricing in *duration of the player's own production* is what makes a
reward table survive ten content drops without a rebalancing pass.

## 11. File map

| File | Owns |
|---|---|
| `road-to-mvp.md` | this plan: phases, gates, the decision index |
| `features/balancing-v3.md` | Phase 0 — the contradictions and the dead dials |
| `features/habit-loop.md` | Phase 1 — daily chest, streak, generated orders |
| `features/event-archetype.md` | Phase 2 — seam widenings, the archetype, the pass |
| `features/monetization-sim.md` | Phase 3 — simulated store, ad placements, telemetry |
| `features/social-layer.md` | Phase 4 — Supabase authority, neighbours, guild, collective bar |
| `features/builders.md` | the builder dial, and the first comfort purchase |
| `features/map-scopes.md` | **structural** — province, temporary provinces, world map, and how much PvP the promises allow |
| `features/relics-and-ingredients.md` | **structural** — the nine-piece ingredient set, the rarity split by source, Mana on both maps |
| `features/tomes-and-research.md` | **structural** — Knowledge as a clock, tomes as pages, tiers as eras, the Stardust rename |
| `00-design-intent.md` | what the game is, and the canonical backlog of what shipped |
| `features/engine-seams.md` | the seams every phase above builds on |
