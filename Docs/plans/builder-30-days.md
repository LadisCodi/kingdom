# Plan — the builder for thirty days

> **What this is.** The step-by-step implementation plan for
> [`../proposals/builder-30-days.md`](../proposals/builder-30-days.md): the
> order in which each building's **data**, then its **logic**, then its **UI**
> lands, so that every step ships on its own, keeps the 44 suites green and
> leaves a playable game behind it. It owns the *sequence* for this programme;
> designs will live in `features/` as each step closes, and open decisions in
> [`../open-questions.md`](../open-questions.md).
>
> **Status: steps 1–5 done; step 6 is next and its design is settled (§6).**
> Save version 30.

## 0. How the steps are cut

- **Data first, logic second, UI third, test throughout.** Every step opens by
  adding columns or rows to `balance/balance.xlsx` through
  `scripts/balance.mjs` (the importer refuses unknown columns, so the schema
  is the first commit), then the sim, then the sheet or card.
- **One boundary source per timed thing.** Anything new that finishes at a
  time is one `consider()` in `nextBoundary` and one branch in `applyDueAt`
  (`src/sim/commands.ts:416-430`, `:359-399`). Anything that accrues is
  handled in `runContinuous` and shifted by the offline cap in
  `save.ts:833-868`. Each step says which it is.
- **Additive save changes bump `SAVE_VERSION` and nothing else.** A migrator
  only where a step renames or reshapes. Each step names its save impact.
- **Every step ends with three tests:** the unit test of the rule, the
  one-call-equals-stepped replay of anything timed, and a row in the
  **thirty-day harness** (§1).
- **No step depends on the world map existing.** Where a block reaches for it
  (Watchtower), the step lands the building and the flag; the dials it moves
  land with the world map itself.

### The order

| Step | Lands | Unblocks | Size |
|---|---|---|---|
| 1 | the thirty-day harness | measuring every later step | 1–2 days |
| 2 | goods: the `Goods` sheet, the stockpile, goods in a price | 3, 4 | 1–2 days |
| 3 | the four workshops: queue, crew, sharing, rush | 4 | 4–6 days |
| 4 | levels 5–10 of every building, gated by goods | 6, 8, 9 | 2–3 days |
| 5 | adjacency v2: stat-typed rules | 6 | 2–3 days |
| 6 | Harmony and the decorations | 7 | 4–5 days |
| 7 | Townhall 5–10 | 8, 9, 10, 11 | 2–3 days |
| 8 | the Reliquary as a building | — | 2 days |
| 9 | the Tavern as a building | — | 2–3 days |
| 10 | the Watchtower (the building and the flag) | the world map, later | 1–2 days |
| 11 | the Dragon's Nest | — | 5–7 days |

Steps 2 → 3 → 4 are the spine and go in that order. 5 → 6 → 7 follow. 8, 9,
10 are independent of each other and of 11; they need only step 7's Townhall
ladder for their level gates.

## 1. Step 1 · The thirty-day harness — **DONE**

The proposal's pacing table (§1.3 there) is the acceptance test of the whole
programme, so it was written before anything it measures.

- **Test:** `tests/thirtyDays.test.ts`. A scripted player visits three times a
  day for 30 days (08:00, 14:00, 21:00 — so every night crosses the 8 h
  offline cap), plays only what the game grants and earns, and follows one
  fixed policy: claim quests, tap houses then resource cells until Mana runs
  out, train villagers into every roof, crew the emptiest building, upgrade
  the Townhall then build the next thing then upgrade the cheapest, research
  the cheapest startable node, claim any affordable landmark, push the fog.
  Every visit goes through the real save path (`serialize` → `deserialize`),
  so the offline cap is inside the measurement.
- **Not in `npm test`.** Thirty days is ~45 s against a suite that runs in
  one. `npm run harness` runs it; `KINGDOM_DAYS=7` shortens a run while the
  policy itself is being written.

### 1.1 The baseline it measured

The scripted player plays **both halves**: the city, and the ruins. Delving is
not optional colour — Knowledge comes only from claimed landmarks and cleared
ruins, and the Townhall's fourth level is `Charter III`, a Civics era-3
keystone priced in it. The late builder is behind the delve loop.

| Week | Townhall | Pop | Districts | Techs | Gold | Knowledge | Army | Ruins | Landmarks |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2 | 6 | 12 | 21 | 862,233 | 728 | 14 | 1 | 2 |
| 2 | 3 | 16 | 23 | 42 | 3,826,439 | 1,640 | 14 | 1 | 2 |
| 3 | 3 | 18 | 32 | 63 | 9,076,457 | 2,105 | 40 | 1 | 2 |
| 4 | 3 | 20 | 32 | 84 | 14,993,474 | 3,086 | 67 | 1 | 3 |
| 30 d | 3 | 20 | 32 | 90 | 16,774,884 | 3,091 | 67 | 1 | 3 |

At day 30: **457 of 1,470 cells uncovered**, 2 of 5 ruins found and 1 cleared,
3 of 10 landmarks claimed, 16 delves launched.

Four findings, now assertions in the harness:

- ~~**The Townhall stalls at 3 of 4, in week 2.** Level 4 is `Charter III`, and
  the Knowledge that buys it is territorial.~~ **Re-pinned 2026-09-08: that
  was the harness, not the game.** The scripted player researched the cheapest
  startable card and never reached `Magistracy` (the 154th-cheapest of 174),
  ending the month on three thousand Knowledge unspent. Told to research what
  the Townhall's card asks for — the rows above it, in order — it reaches
  **Townhall 4, the end of its sheet, in week 3**, builds 42 districts instead
  of 32 and buys 86 levels instead of 64. The late city is behind the
  Townhall's own ladder now, which is step 7.
- **The builder is finished by week 4** — the last week adds no building.
- **It is not the purse that stops it.** This player ends on 16.8 M Gold.
- **What starves is the ground.** At the designed session length a player
  uncovers under a third of the province in a month, so they meet a minority
  of the ruins and landmarks the Knowledge drip is made of. The drip tops out
  near 8/h against the 30/h a fully claimed province gives.

The consequence for this programme: the city's own ladder has to be priced in
what the city produces — goods (§2–§3) and ground (§6) — because the currency
that gates it today is paced by exploration, and exploration is paced by the
thumb.

### 1.2 What it found on the way — a sim bug, fixed

The harness could not finish: a 30-day run took **355 seconds**, all of it in
offline catch-up. `advanceWorkers` asked *which cells can this building work*
and *who has claimed one* for every worker on every worker event, both
O(cells × workers).

| Crew | 8 h catch-up, before | after |
|---|---|---|
| 6 | 43 ms | 40 ms |
| 12 | 1,170 ms | 158 ms |
| 18 | 5,661 ms | 500 ms |
| 24 | **12,773 ms** | **766 ms** |

A Townhall-3 city houses 30 villagers, so this was a player-facing freeze on
opening the game after a night away, reachable in normal play — the harness
hit it on day 16. Fixed in `src/sim/workers.ts` with a per-advance index of
those two lookups, updated in O(1) per step. Behaviour is provably unchanged:
one-call and stepped replay both fingerprint identically to the pre-fix run,
and the harness prints the same table. The 30-day run is now 43 s.

## 2. Step 2 · Goods — **DONE**

The stockpile before the producer, so prices can name a good and the dev bar
can grant one.

- **Data:** a `Goods` sheet — `id, name, tier, input_gold/wood/food/stone,
  input_mana, input_good, input_good_amount, work_seconds`. Four rows:

  | Good | One item is made of | Work (one villager) |
  |---|---|---|
  | **Planks** | 10 Wood | 20 min |
  | **Cut Stone** | 10 Stone | 30 min |
  | **Iron** | 20 Stone + 200 Gold | 60 min |
  | **Runestone** | 2 Cut Stone + 20 Mana | 3 h |

  `Districts` gained `upgrade_cost_goods_per_level`, a text column written
  `|Planks:2|Planks:4,CutStone:2` — levels separated by `|`, goods by `,`,
  entry 0 the price of reaching level 2, like every other per-level column.
  **Every row is blank**: goods are charged from step 4.
- **Sim:** `GoodId` and `state.city.goods`, a counter map and deliberately not
  a `CurrencyId` — the Fragments precedent, so the plank stays at five.
  `src/sim/goods.ts` holds the stockpile maths and `goodsCostForLevel`;
  `upgradeGoodsCost` prices a level; `upgradeDistrict` now has **two
  refusals**, `NotEnoughResources` and `NotEnoughGoods`, because the answer to
  each is a different errand — a trip to the map, or a queue at a workshop.
- **UI:** the upgrade button carries the goods beside the currencies through
  `costExtra`, the slot that already existed for priced things that are not
  wallet rows. `?dev` grants ten of each.
- **Art:** `Iron` shares the retired ore cell, already drawn; `Planks`,
  `CutStone` and `Runestone` are named in `tests/icons.test.ts`'s
  `AWAITING_ART` until their sheet is cut.
- **Save:** additive (`Cities[0].Goods`), version **29**, no migrator — a save
  written before goods existed reads an empty stockpile, which is what a city
  with no workshop holds anyway.
- **Tests:** `tests/goods.test.ts` — the stockpile, the recipes, the per-level
  indexing, both refusals in order, and the save round trip including the
  pre-29 shape.

## 3. Step 3 · The workshops — **DONE**

Four districts — Carpenter, Mason's Yard, Smelter, Rune Carver — each making
one good, and the first producer in the game that is a crew from the start.

- **Data:** four `Districts` rows, 1×1, `max_level` 10, crew
  `1,2,3,3,4,4,5,5,6,6` and queue `3…12` by level, count caps
  `0,0,0,0,1,1,1,2,2,2` (one at TH5, two at TH8). Two new columns, `produces`
  and `queue_length_per_level`, and the importer refuses a row that has one
  without the other. Unlock technologies: `Engineering` for the Carpenter and
  the Mason's Yard, `Mining` for the Smelter, `Attunement II` for the Rune
  Carver.
- **The rule:** nothing happens without a worker. A workshop with no villager
  assigned does not advance — no hand production, no collect tap.
- **The sharing:** with `n` villagers and `k = min(n, queued)` items in
  progress, each item gains `n / k` worker-seconds a second. Two on one item
  halve it; two on two items finish both in the same time; three on two
  finish both in two thirds. Throughput is always `n` item-seconds a second,
  so one more villager is always faster.
- **Exactness:** progress is worker-MILLISECONDS, never a deadline, and the
  anchor advances in whole `k`-ms chunks — the tax-anchor trick — so replay
  and stepped ticking agree to the millisecond. A completion is one
  `consider()` in `nextBoundary` and one branch in `applyDueAt`; the crews run
  in `runContinuous`, and `save.ts` pauses their anchor at the 8-hour cap with
  the workers.
- **Cost:** inputs are paid when an item is QUEUED, and refunded in full on
  cancel. Runestone takes Mana, the first non-tap Mana sink.
- **Gems** finish the item in progress, priced on the time left at the current
  crew (`rush.seconds_per_gem`, as a build). Only that item: the queue behind
  it is not for sale, and neither is a worker slot.
- **UI:** `src/ui/workshopSection.ts` on the district card — what it makes and
  out of what, the crew line (which says in words when there is nobody there),
  the queue as slots with the front ones running, and one button.
- **Art:** the world sprites are drawn (`carpenter_l1/_l4/_l8` and friends);
  the 16 px menu icons are named in `AWAITING_ART`. Two crews are cast from
  the character pack (stonemasons, forge hands); the Carpenter and Rune Carver
  have no work loop in it yet and are named in `tests/characters.test.ts`.
- **Reachability:** the count cap starts at TH5, and the Townhall ladder is
  step 7 — so until then a workshop is only reachable through `?dev`, which
  gained a Townhall button for exactly this.
- **Tests:** `tests/workshops.test.ts` — the no-crew rule, the four sharing
  cases and the throughput identity, queue length and payment, the Mana
  recipe, replay-equals-ticking, the offline cap, the save, and the rush.

## 4. Step 4 · Levels 6–10, gated by goods — **DONE**

Fifteen buildings reach level 10: Housing, the four producers, the Sanctum,
the four halls, the four workshops and the Market. The two exceptions are the
Townhall, whose ladder is step 7, and the crop plot, which is a cell rather
than a building.

- **The step landed levels 5 to 10, not 6 to 7.** The plan assumed level 5
  existed everywhere and it did not — Housing stopped at 3, the Farm and the
  Docks at 2, the Quarry at 3. So levels 3–5 are authored too: workers
  `3,5,7,9,11` and one more ring of reach on every producer, Housing to 10
  residents. Level 5 asks for TH4, which makes it the first thing the live
  game gained.
- **Data:** `max_level` → 10 with per-level arrays authored to 10; halls
  `army_cap_per_level` +8 a level to 68; `mana.sanctum_cap_per_level` and
  `…_per_hour_per_level` continued to 352 and 42; producers' workers and reach
  **frozen at their L5 value** from L6. `upgrade_cost_goods_per_level` filled
  for 6–10 on every one of the fourteen (§7 in
  [`../features/buildings.md`](../features/buildings.md) §4.11 is the table).
  `required_townhall_level_per_level` is the level itself from 6 (TH6 → TH10),
  and `required_tech_per_level` is padded with nothing: **no late level asks
  for a technology.**
- **A piecewise curve, which the plan did not have.** The old single
  `upgrade_cost_level_growth` per row cannot say "1.5 to level 5 and 1.7 after
  it", and continuing a 20-second duration curve to level 10 gives an
  eight-minute upgrade on day 20. So three new columns —
  `upgrade_cost_late_level_growth`, `upgrade_duration_late_seconds`,
  `upgrade_duration_late_level_growth` — pivot at `city.late_upgrade_from_level`
  (6). Cost is continuous at the pivot; the wait restarts at its own base, 2 h,
  and grows ×1.7 to about 17 h at level 10. The importer refuses a row that
  reaches the pivot without them. Design:
  [`../features/05-city-and-districts.md`](../features/05-city-and-districts.md)
  §3.1.
- **The haul is ADDED units, not a multiplier.** `extra_units_per_delivery_per_level`
  (+1 a level from 6) rather than the planned `yield_per_delivery_per_level`:
  a chunk is 1 to 5 units and `Math.round(1 × 1.2)` is 1, so a percentage
  rounds away to nothing. It is the shape `WorkerLoad` already uses.
  `strike_speed_per_level` stays a multiplier (+10% a level) because it
  divides a cadence measured in whole seconds. Both are read in
  `effectiveWorkerStrike` and `workerStrikeMs` off the crew's own building as
  **base-stage** terms, never as modifiers, and neither reaches the tap.
  `cityGatherPerSecond` reads both, so a reward priced in production sees the
  late city.
- **UI:** `upgradeDeltas` shows `per delivery` and `swing`; the card's area
  block shows the real cadence; `levelStars` becomes a numeral past five
  levels, which also fixes the workshops' ten-star row.
- **Save:** none (levels are data).
- **Tests:** `levelGates.test.ts` — no late level asks a technology, every one
  asks its own Townhall level, and a Sawmill at 5 is refused first for the
  Townhall and then for goods; a late producer hauls more and swings faster at
  every level, and the tap is untouched. `costs.test.ts` — the ×1.7 late
  curve on all fourteen, 2 h at 6 and ~17 h at 10, and every level below the
  pivot is bit-identical to the old curve. `goods.test.ts` — nothing is
  charged below the pivot and every late level charges something.
- **What the harness says.** The city now buys levels in weeks 4 and 5, where
  before it bought nothing (a `levels` column was added to measure it: 51 →
  58 → 61). It also buys them EARLIER: the scripted player upgrades where it
  used to build, so weeks 1–2 end on 11 and 21 buildings instead of 12 and 23.
  But **the ladder stops at level 4**: level 5 asks for TH4 and this player
  ends on TH3, so the goods wall at level 6 is authored and unreached. Step
  7's Townhall ladder is what opens both — the finding is now an assertion.
- **The Market joined the ladder too** (proposal §1.1), with one new column,
  `sale_price_per_level`: ten levels whose only purchase is the price it pays
  for a unit, +3% a level to +27%. Two Markets do not stack — the better one
  sets the price. **Its goods tab is deliberately NOT in**: a Market that
  bought refined goods for Gold would trade the scarce thing for the abundant
  one, and this player ends the month on 16.8 M unspent Gold
  ([`../features/17-workshops-and-goods.md`](../features/17-workshops-and-goods.md)
  §10).
- **Art:** the three-tier sprites already cover levels 6–10 (`_l8` serves
  8–10), landed ahead of this step.

## 5. Step 5 · Adjacency v2 — **DONE**

**The decision this step opened with (2026-09-07):** placement itself is
**free** — anywhere revealed, no plot bound, and no building required beside
another. The Housing rule that wanted a Townhall or another house edge-to-edge
is gone too (OQ-1 closed as *no*, and a plot ring was built and reverted).
**Adjacency is therefore the only thing that guides a layout, and it does it by
paying or charging, never by refusing.**

- **Data:** the `Adjacency` sheet is `district, neighbour, stat, magnitude`.
  `gold_per_minute` is **gone rather than kept beside them** — one mechanism,
  not two: the Housing row is now `goldPerMinute −1`. Either side may name a
  **group** — `AnyHall`, `AnyWorkshop`, `AnyProducer` — whose membership is
  derived from what a district already is, so the four halls sharing a rule is
  one row instead of twelve, and a fifth hall would need none. Six rows today:
  Housing↔Housing Gold −1, AnyHall↔AnyHall `trainTime −0.10`,
  Carpenter–Sawmill, MasonsYard–Quarry, Smelter–Quarry and RuneCarver–Sanctum
  `workTime −0.10`. The importer refuses an unknown stat or token, a magnitude
  of 0, a duplicate `(district, neighbour, stat)`, and a fraction past the
  clamp.
- **Sim:** `AdjacencyStat` and `AdjacencyGroup` in `definitions.ts`, with
  `ADJACENCY_GROUPS` as derived predicates and `ADJACENCY_CLAMP` at 0.25.
  `adjacencyEffect(state, id, loc, stat, excludeId)` sums the matching rules
  and clamps every fractional stat to ±25%, so no layout is ever wrong — only
  better. `adjacencyMultiplier` is the `1 + x` view a call site wants, and
  `adjacencyInEffect` the list a card lists. **Not** a modifier: an adjacency
  is positional and belongs at the base stage of the number it moves.
- **When a rule is priced — the rule this step establishes.** A **rate** read
  on demand (Gold a minute) is computed on read, so moving a house changes its
  rent at once. A **timer** is priced when it STARTS and stamped on the thing
  waiting: `TrainingItem.seconds` and `WorkshopItem.needMs`. A neighbour that
  arrives, moves or is demolished later must never reprice a wait already
  running — the rule research's time multiplier already followed.
- **UI:** `adjacencyReadout(stat, total)` in `game.ts` gives the label, the
  icon and the tone for one effect, and **the tone is not the sign** — a
  duration's −10% is good news. The placement ghost pushes one label per stat
  in both directions; the district card carries one badge per stat in effect,
  with the house keeping its own words for Gold. The workshop card and the
  training card both show the time the player is actually committing to.
- **Save:** version **30**, additive, no migrator — a pre-30 item has no stamp
  and falls back to the authored duration, which is what it was running on.
- **Tests:** `adjacency.test.ts` — the sheet's shape, group resolution from
  either column, the clamp under four neighbours, one stat not leaking into
  another, a military quarter training faster, a stamped wait surviving a
  neighbour's demolition and a save round trip, and a workshop item priced at
  the moment it is queued. `helpers.ts` now spaces the test halls two cells
  apart, so a test about a training LINE measures the authored duration
  instead of a layout.
- **What the harness says:** nothing changed at the week level — the scripted
  player does not lay out its city deliberately, which is exactly the point of
  a guidance mechanism. The place adjacency shows up is a player who chooses.

## 6. Step 6 · Harmony and the decorations

> **Settled 2026-09-08, after OQ-1 removed the ground as the scarce thing.**
> Harmony stays a **city total** — one supply, one demand, computed on read.
> Its decision content comes from **a count cap per decoration**, so reaching
> a Townhall's demand needs several KINDS of piece and each kind is priced in
> a different good; and from **adjacency**, so where a piece stands pays. The
> surplus bonus lands on **housing taxes**, as proposed.

### 6.1 The rule

- **Supply** is the `harmony_supply` of every **Built** decoration. A piece
  under construction supplies nothing yet.
- **Demand** is every district's `harmony_cost_per_level` at the level it
  holds — or at the level it is **upgrading to**, so two waits in flight
  cannot be spent against the same surplus.
- The column is the **TOTAL a building demands at that level, not an
  increment**, indexed from level 1 like `army_cap_per_level`. One column
  therefore states both the build gate (entry 0) and every upgrade gate, and
  nothing anywhere sums a prefix.
- A build or an upgrade may **start** only while
  `supply ≥ demand − what this building demands today + what it will demand`.
  Nothing reads Harmony after it starts: **a gate, never a drain**, so a
  deficit blocks the next thing and never punishes the last (promise 1).
- Supply only grows and demand only grows — there is no demolition — so a
  city is never pushed into deficit by anything but its own next purchase.

### 6.2 The surplus bonus

- `ratio = supply / demand`, and three tiers on `taxRate`: `1.10 → +5%`,
  `1.25 → +10%`, `1.50 → +15%`. A **base-stage** term inside
  `effectiveTaxRate`, beside `marketSaleLevelMultiplier` — never a modifier.
- **With demand 0 there is no ratio and no bonus.** Otherwise one Garden at
  TH5 pays the top tier for the whole midgame, for free.
- Nothing new needs repricing: the tax anchor is already settled around every
  boundary batch and around a move (`population.ts:207`,
  `commands.ts:165, 387`), and a decoration completing IS a build completion.
- The harness ends the month on 16.8 M unspent Gold, so this bonus is a
  legibility win rather than a real reward — it pays where a player can SEE
  it, on the Townhall card. If it turns out to carry nothing, `surplus_tiers`
  is one setting and the stat it moves is one call site.

### 6.3 The six pieces

`max_level` 1, no crew, no tap, no upgrade — movable like anything else.

| Piece | Size | Supply | Build cost | Count cap, by Townhall level | Discovered by |
|---|---|---|---|---|---|
| **Garden** | 1×1 | 4 | 200 Wood · 100 Food | `0,0,0,0,4,6,8,10,12,14` | **Gardening** (Civics 3, under Engineering) |
| **Well** | 1×1 | 6 | 200 Stone · 1 Cut Stone | `0,0,0,0,0,2,4,6,8,10` | **Sculpture** (Civics 3, under Architecture) |
| **Orchard** | 2×1 | 12 | 2 Planks · 500 Food | `0,0,0,0,0,1,2,3,4,5` | **Gardening** |
| **Statue** | 1×1 | 10 | 2 Cut Stone · 5,000 Gold | `0,0,0,0,0,0,1,2,3,4` | **Sculpture** |
| **Plaza** | 2×2 | 30 | 4 Planks · 4 Cut Stone | `0,0,0,0,0,0,0,1,2,3` | **Paving** (Civics 3, under Guildhalls) |
| **Shrine** | 2×2 | 40 | 2 Runestone | `0,0,0,0,0,0,0,0,1,2` | **Sacred Grounds** (Civics 3, under Scriveners II) |

- The cap array is the **Townhall gate and the ceiling** in one, the way a
  workshop's already is (`0,0,0,0,1,1,1,2,2,2`), so no decoration needs a
  `required_townhall_level_per_level` of its own. **Discovery is a technology
  on top** (2026-09-08): four Civics era-3 cards open the pieces in pairs and
  singles, paired by material — plants under Gardening, cut stone under
  Sculpture, the Plaza under Paving, the Shrine under Sacred Grounds. A
  tech-locked building is hidden from the build sheet, so the page is where a
  piece is met; the count cap then says when it may stand.
- **Every piece past the Garden is priced in a good**, which is what makes a
  decoration cost the workshop queue rather than a walk to the map. The
  Shrine's Runestone is the Rune Carver's second customer.
- Most supply reachable at each Townhall level: TH5 **16**, TH6 **48**,
  TH7 **90**, TH8 **162**, TH9 **274**, TH10 **386**.

### 6.4 The demand, on the levels from 8

- `harmony_cost_per_level` = `,,,,,,,2,4,6` on all **fifteen** buildings that
  reach level 10 — +2 a level from 8, which is a ladder a player can read off
  a card. The Townhall's own is step 7's, along with its ladder.
- **Where that lands.** On the count caps as they stand today a maxed city is
  38 buildings and demands **228** against the **386** it can supply, a ratio
  of 1.69 — every tier reachable, with room. On step 7's intended caps
  (Housing 21, producers 5–6, two of each workshop) it is 59 buildings
  demanding **354**, plus the Townhall's own 30, for a ratio of **1.01** —
  and no tier reachable at all.
- So the surplus tiers are comfortable now and unreachable at full build-out,
  and **the gap between the two is step 7's to tune**: it is the step that
  authors both halves of the ratio, the caps and the Townhall's own demand,
  and it has the harness to measure them with. The shape to aim at is the
  first tier reachable by a maxed city and the top tier only by a city that
  chose to stay slim.
- Levels 8–10 are unreachable until step 7 lands the Townhall ladder, so this
  is authored-and-waiting exactly as step 4's goods wall is. It is authored
  **here** rather than in step 7 so that this step's gate is live, testable
  and measurable on its own.

### 6.5 Data

Three new `Districts` columns and one new `Settings` row:

- `harmony_supply` — a scalar. Blank = 0 = not a decoration.
- `harmony_cost_per_level` — a list, the total at each level, from level 1.
- `build_cost_goods` — a goods list (`Planks:2,CutStone:2`), the build's
  price in refined goods, which no building could name before. The
  `|`-separated per-level form already exists for upgrades; a build has one
  level, so this is one entry.
- `harmony.surplus_tiers` — `1.10:0.05|1.25:0.10|1.50:0.15`, a new **`tiers`**
  setting kind, because a threshold and its bonus are one fact and have to
  travel together. It is the first setting that is neither a number nor a
  list, so the export marks it a Text cell the way a list already is. There is deliberately **no `harmony.surplus_stat`**: the
  stat a bonus moves is a call site, so a setting whose only legal value is
  `taxRate` would be a knob that cannot turn.

The importer refuses: a row with `harmony_supply` that also has a level ladder,
a crew, a queue, residents or something it trains (a decoration is none of
those); a `harmony_cost_per_level` that falls between levels (it is a total);
tiers that are not ascending, or a threshold below 1.

### 6.6 Sim

- `src/sim/harmony.ts` — `harmonySupply`, `harmonyDemand`,
  `harmonyBlock(state, def, targetLevel, district?)` and
  `harmonySurplusMultiplier`. Everything derived, nothing stored.
- Gates: `'NeedsHarmony'` in `placementBlock` (beside `CountLimit`, the other
  rule that is about the building rather than the cell) and in
  `upgradeDistrict`, whose refusals become **three** —
  `NotEnoughResources`, `NotEnoughGoods`, `NeedsHarmony`, each a different
  errand: the map, the workshop, the decorations.
- **Goods at build time.** `enqueueBuild` pays `build_cost_goods` when the
  build is QUEUED and `cancelQueueItem` refunds it in full — the rule a
  workshop item already follows. `EnqueueBuildResult` gains
  `'NotEnoughGoods'` and `'NeedsHarmony'`, which today would both collapse
  into `'InvalidCell'`.
- One `Adjacency` row, `Housing · AnyDecoration · goldPerMinute · +1` — the
  mirror of `Housing ↔ Housing −1`, and the local reason to put a piece among
  the houses. `AnyDecoration` is a fourth `ADJACENCY_GROUP`, its predicate
  `harmonySupply > 0`. The Sanctum's Mana rule (proposal §8) waits for a
  `manaPerHour` adjacency stat and is **not** in this step.
- No boundary and no accrual: Harmony is neither timed nor produced.

### 6.7 UI

- The Build sheet grows a **Harmony header** — `supply / demand`, and either
  the tier that pays or the next one to reach — and a **Decorations** section
  under the buildings. The header appears from the Townhall level the first
  piece unlocks, not from the first point supplied: it is the one place the
  mechanic is explained rather than merely counted, and the card that sends
  the player here names a number this sheet would otherwise never mention.
- A card whose piece or level is gated says **_Needs N more Harmony_** in the
  ribbon that already says what lifts a count cap, so the player never enters
  placement only to be refused there.
- The placement ghost shows the supply a decoration adds, next to the
  adjacency labels it already pushes.
- The Townhall card shows the same line, where the taxes it moves are read;
  a decoration's own card says what it supplies, since a card with no crew, no
  queue and no tap would otherwise be empty.
- Refined goods ride beside the currencies in all three places a build is
  priced — the card, the menu and the placement bar — and Harmony rides with
  them on the upgrade button: it is a **requirement quoted at the price**,
  which a chip says and a sentence beside the button does not.

### 6.8 Save

**Version 31, no migrator.** Nothing new is *serialized* — supply, demand and
the bonus are all derived from the built set. What changes is that a save can
now name a district id an older build cannot resolve, and `DefinitionID` is
read as a blind cast (`save.ts:560`), so the bump is what makes such a build
refuse the save rather than load it and find an undefined definition. An older
save needs nothing: it has no decoration in it.

### 6.9 Tests — `tests/harmony.test.ts`

- Supply and demand from the built set; a piece under construction supplies
  nothing; a district upgrading demands its TARGET level.
- A build and an upgrade refused at `supply < demand + cost`; a building
  already standing never blocks on a later deficit.
- The surplus tiers, and **no bonus at demand 0**.
- A decoration moved keeps its supply (`move.test.ts`); decorations are
  movable.
- Goods paid when a build is queued and refunded in full on cancel.
- `levelGates.test.ts`: a level-8 upgrade is refused for the Townhall first,
  then goods, then Harmony — the three errands in order.
- The harness gains a `harmony` column; the assertion it can carry today is
  that a player who cannot reach level 8 never builds a decoration, and step 7
  is where the row turns into pacing.

### 6.10 The commits, in order

| | Lands |
|---|---|
| **6a** — **DONE** | the schema — three `Districts` columns, the `tiers` setting, every refusal, `balance:export` → `balance`. Every cell blank but the tiers, and `tests/harmony.test.ts` guards the shape |
| **6b** — **DONE** | `harmony.ts`, both gates, goods at build time, the surplus term in `effectiveTaxRate` |
| **6c** — **DONE** | the six decoration rows, their identity in `definitions.ts`, `buildMenuOrder`, the `AnyDecoration` adjacency row |
| **6d** — **DONE** | the demand: `,,,,,,,2,4,6` on the fifteen |
| **6e** — **DONE** | the UI — the header, the section, the ribbon, the ghost, the Townhall card |
| **6f** | [`../features/18-harmony.md`](../features/18-harmony.md), the `buildings.md` rows, the harness column, `CLAUDE.md`'s data-or-code row |

- **Art: done.** All six world sprites exist (`garden_l1`, `well_l1`,
  `orchard_l1`, `statue_l1`, `plaza_l1`, `shrine_l1`). What is missing is the
  six 16 px menu icons — six slices in
  [`../art/ui/atlas.manifest.json`](../art/ui/atlas.manifest.json), or the six
  names in `AWAITING_ART` until the sheet is cut.
- **Done when:** a player at TH8 cannot buy a level 8 without decorations,
  the decorations cost the workshop queue to buy, and the Townhall card says
  what the surplus is paying.

## 7. Step 7 · Townhall 5–10

Levels 8–10 landed with step 4 and their Harmony demand with step 6; what is
left here is **the Townhall ladder**, which is the only thing standing between
the player and everything the two steps authored.

- **Data:** Townhall `max_level` 10, `required_tech_per_level`
  `,CharterII,CharterIII,,,,,,` (nothing past 4), `upgrade_cost_goods_per_level`
  from 5, the late-curve columns (§3.1 of
  [`../features/05-city-and-districts.md`](../features/05-city-and-districts.md))
  set so L6 ≈ 4 h, L8 ≈ 12 h, L10 ≈ 36 h — twice a district's, since the
  Townhall is the clock every other ladder hangs from. Every
  `max_count_per_townhall_level` array extended to 10 entries (Housing
  `2,4,6,9,11,13,15,17,19,21`; producers to 5–6; workshops
  `0,0,0,0,1,1,1,2,2,2`). The Townhall's own `harmony_cost_per_level`,
  `,,,,,,,10,20,30` — the fourteen districts' is step 6's (§6.4), so what is
  left here is the building that gates them all.
- **Sim:** nothing new — the gates from steps 2, 4 and 6 compose.
- **UI:** the Townhall card lists what the next level unlocks (count caps) as
  today (`districtCard.ts:133-136`). `levelStars` already became a numeral in
  step 4.
- **Save:** none.
- **Tests:** `levelGates.test.ts`: TH5 needs goods, TH8 needs Harmony, no
  Townhall level past 4 needs a technology; `costs.test.ts` the durations;
  the harness: TH5 week 1, TH7 week 2, TH8 week 3, TH9 week 4 — **this is the
  step where the pacing table becomes an assertion**, and where step 4's
  goods wall is reached for the first time.
- **Done when:** the harness passes the whole pacing table with steps 2–7 in.

## 8. Step 8 · The Reliquary

- **Data:** one `Districts` row, 1×1, one per city, `required_tech` (in
  `definitions.ts`) `Consecration`, `max_level` 10, TH gate 3, goods from 6,
  Harmony from 8. New per-level columns on the row: `relic_level_cap_per_level`
  (`1,2,2,3,3,4,4,5,5,5`), plus `Settings` for the flat bonuses at 3, 5, 7, 9.
- **Sim:** `relicLevelCap(state)` reads the Reliquary's level (0 if unbuilt);
  `levelUpArtifact` refuses above it. `attune` (`artifacts.ts:177`) refuses
  with `'NoReliquary'` when none is built. Ingredient drop and Stardust bonuses
  are **modifiers** added by `syncArtifactModifiers`'s pattern (`:228`) from the
  building's level — they are stats that already exist (`stardustYield`;
  ingredient yield arrives with the ingredient rework). Trading (L5) and the
  weekly 3★ recipe (L9) are stubs until their systems exist; the step lands the
  gate values, not the systems.
- **Existing saves:** a save that already owns a relic is **granted a built
  Reliquary L1 next to the Townhall** by a migrator (a reshape of state, so a
  migrator, `save.ts:88-249` shape). Promise 1: nothing owned is taken.
- **UI:** the Relics nav tab (`navbar.ts:33-38`) hides until the Reliquary is
  built; the reliquary sheet opens from the building's card as well as the
  tab.
- **Save:** bump, plus the migrator.
- **Tests:** `artifacts.test.ts`: no attune without the building; the cap
  follows the level; the migrator on a v28 save with a relic. `chrome.test.ts`
  for the hidden tab.
- **Done when:** a fresh game meets relics only after building the Reliquary,
  and an old save loses nothing.

## 9. Step 9 · The Tavern

- **Data:** one row, 2×1, one per city, `max_level` 10, TH gate 4; a new
  Civics era-2 technology `Hospitality` (`Technologies` row, `node_x`/`node_y`
  authored on the Civics page). Per-level column `hero_level_cap_per_level`
  (`2,4,4,6,6,8,8,10,10,10`); `Settings` for XP bonus (L5) and the weekly free
  pull (L7).
- **Sim:** `heroLevelCap(state)` read by `levelUpHero` (`heroes.ts:67`);
  `pull()` (`:174`) refuses without a Tavern. The **rumour** (L3): one daily
  party quest priced in production — reuses the daily chest's scheduling
  (`12-quests.md` §3) and the quest goal types that exist; a new goal type only
  if none fits (that is code — see `CLAUDE.md`'s data-or-code table).
- **Banner relocation:** `bannerPanel()` (`bannerPanel.ts:15`) mounts in the
  Tavern's card instead of `storeSheet.ts:79`. **Blocked on the decision in
  the proposal §11** — `14-monetization.md` §2.1 has the banner as a store
  doorway; settle which before this commit.
- **Existing saves:** a save that owns a hero is granted a built Tavern L1
  (same migrator pattern as step 8).
- **UI:** the Tavern card: heroes owned, the banner, the rumour of the day.
- **Save:** bump, plus the migrator.
- **Tests:** `heroes.test.ts`-shape tests for the cap and the pull gate; the
  migrator; the rumour's reward priced in production (`faucet.test.ts`
  pattern).
- **Done when:** heroes arrive through a building, and the old save keeps its
  heroes.

## 10. Step 10 · The Watchtower

- **Data:** one row, 2×2, one per city, `required_tech` `Cartography`, TH gate
  5, `max_level` 10, goods from 6, Harmony from 8. Per-level columns
  `marches_per_level`, `vision_radius_per_level`, `march_speed_per_level`,
  `outposts_per_level` — authored now, read by nobody until the world map.
- **Sim:** `state.kingdom.worldMapUnlocked` is **derived**, not stored: a
  built Watchtower. `hasWatchtower(state)` is the one helper; the world map
  (`02-map-scopes.md`) reads its dials from the building level when it lands.
- **UI:** the building and its card, which says what each level will govern.
  No world-map screen in this step.
- **Save:** none.
- **Tests:** the row imports; the card renders; `hasWatchtower` follows the
  built set.
- **Done when:** the building exists and every world-map dial has a home.

## 11. Step 11 · The Dragon's Nest

The one new mechanic; last, and in three commits.

**11a — the egg and the incubation.**

- **Data:** one row, 2×2, one per city, TH gate 7, a new Warfare era-3
  technology `Beastcraft`; `max_level` 10; per-level `nest_slots_per_level`
  (`1,1,1,1,2,2,2,2,2,2`), `creature_level_cap_per_level` (+2/level). A new
  `Eggs` sheet: `id, incubation_seconds, creature`. Three rows (3, 5, 7 days).
- **Sim:** `state.kingdom.eggs: { id, startedAt, slot }[]`; `incubate` starts
  one; completion is **a timer** — `nextIncubationCompletion` is one
  `consider()`, one branch in `applyDueAt` that hatches. Uncapped tail
  (invariant 2). Gems shorten it pro rata (`rush.seconds_per_gem`).
- **Sources:** eggs are granted by the deepest depth of a ruin
  (`expeditions.ts:327-355` reward path) and by event tracks; **never** by the
  store.
- **Tests:** replay across a hatch; the 7-day egg across a 12 h absence pays in
  full.

**11b — the creature as a unit.**

- **Data:** a `Creatures` sheet: `id, power, atk, def, hp, level_growth,
  feed_food_base, feed_food_growth`. One creature row per egg.
- **Sim:** `UnitId` (`state.ts:40`) is a union — adding `'Creature'` kinds is
  code. A creature is a roster entry with a level; `armyPower` (`army.ts:36`)
  counts it; the party (`expeditions.ts:80` `unitSlots`) gains **one creature
  slot** outside the Gem-bought ladder (it is not a slot the player buys; it is
  the Nest's), a second at Nest L8. `combat.ts` stays pure: a creature is a
  `PartySlot` with its stats.
- **Feeding:** `feedCreature` pays Food, `feed_food_base × growth^level`, capped
  by the Nest's level. Food's late sink.
- **Tests:** a creature in the party changes the scoring pass; feeding refuses
  above the cap; Food is the only price.

**11c — the card.**

- **UI:** the Nest card: eggs incubating with countdowns derived from
  `startedAt`, the creature, its level and next feed, the party toggle.
- **Save:** additive across 11a–b (`kingdom.nest`), one bump.
- **Art:** the Nest, three eggs, one to three creatures.
- **Done when:** a player who clears a ruin's deepest depth in week 3 hatches
  a creature in week 4 and takes it into a delve.

## 12. Cross-cutting

- **`CLAUDE.md`'s data-or-code table** grows three rows when the steps close:
  a good = a `Goods` row; a decoration = a `Districts` row with
  `harmony_supply`; an egg or creature = a row. Code: a new `GoodId`,
  `AdjacencyStat` or creature kind.
- **Docs, in the same commit as the code:**
  [`../features/17-workshops-and-goods.md`](../features/17-workshops-and-goods.md)
  holds steps 2 and 3; step 4 closed into
  [`../features/buildings.md`](../features/buildings.md) §4.11 (the late
  ladder), `05-city-and-districts.md` §3.1 (the piecewise curve) and
  `04-harvest.md` §4 (the haul and the swing); step 5 into
  `03-economy.md` §3.1; step 6 into a new `features/18-harmony.md`; steps 8–10
  into `09-relics.md`, `10-heroes.md`, `02-map-scopes.md` and
  `buildings.md`; step 11 into `11-expeditions.md` and `buildings.md`. The
  proposal file is deleted when the last step closes.
- **Art pipeline:** every new building needs a sprite before its step merges;
  `tests/icons.test.ts` refuses emoji fallbacks.
- **Workbook:** every schema change is importer + JSON + `npm run
  balance:export` + `npm run balance`, in that order, as `CLAUDE.md` says.

## 13. Decisions to close before each step starts

| Before step | Decision | Where |
|---|---|---|
| 2 | Goods are city-scoped counters, not wallet rows | proposal §2.1; `03-economy.md` wallet rule |
| 3 | Runestone takes Mana as an input — the first non-tap Mana sink | OQ-44, `08-magic.md` §3 |
| 4 | Producers' L6+ buy haul and speed, not crew — as ADDED units, since a chunk is 1-5 units and a percentage of it rounds away | proposal §1.1 |
| 5 | The `Adjacency` sheet gains `stat` and `magnitude` | **OQ-48** |
| 6 | ~~Harmony surplus bonus lands on taxes; and what Harmony costs now the plot is unbounded~~ — **closed 2026-09-08**: a city total gated by a count cap per piece, every piece past the Garden priced in a good, and the surplus on taxes (§6) | proposal §4.1 |
| 7 | Townhall 5–10 gated by goods and Harmony, not keystones. **Level 4 keeps `Charter III`**: the late city stays behind the delve loop, which is what welds the two halves together (settled 2026-09-04) | proposal §1.2; `07-research.md` §3 |
| 8 | Runestone and the Reliquary L9 recipe as the province route past relic L3 | **OQ-7**, **OQ-9** |
| 9 | The banner moves from the store to the Tavern | proposal §11; `14-monetization.md` §2.1 |
| 11 | A creature slot sits outside the Gem slot ladder | proposal §3; the slots rule in `07-research.md` §1 |
