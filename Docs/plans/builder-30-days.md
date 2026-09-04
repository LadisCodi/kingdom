# Plan — the builder for thirty days

> **What this is.** The step-by-step implementation plan for
> [`../proposals/builder-30-days.md`](../proposals/builder-30-days.md): the
> order in which each building's **data**, then its **logic**, then its **UI**
> lands, so that every step ships on its own, keeps the 44 suites green and
> leaves a playable game behind it. It owns the *sequence* for this programme;
> designs will live in `features/` as each step closes, and open decisions in
> [`../open-questions.md`](../open-questions.md).
>
> **Status: steps 1–3 done.** Save version 29.

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
| 4 | levels 6–7 of every building, gated by goods | 6, 8, 9 | 2–3 days |
| 5 | adjacency v2: stat-typed rules | 6 | 2–3 days |
| 6 | Harmony and the decorations | 7 | 4–5 days |
| 7 | levels 8–10 and Townhall 5–10, gated by Harmony | 8, 9, 10, 11 | 2–3 days |
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

| Week | Townhall | Population | Districts | Maxed | Techs | Gold | Knowledge |
|---|---|---|---|---|---|---|---|
| 1 | 2 | 6 | 12 | 4 | 21 | 903,175 | 208 |
| 2 | 3 | 16 | 22 | 7 | 41 | 4,317,320 | 855 |
| 3 | 3 | 18 | 31 | 13 | 62 | 9,394,060 | 1,134 |
| 4 | 3 | 19 | 32 | 13 | 83 | 15,122,155 | 1,951 |
| 30 d | 3 | 20 | 32 | 15 | 89 | 16,849,389 | 1,806 |

Four findings, now assertions in the harness:

- **The Townhall stalls at 3 of 4, in week 2**, and nothing in the city can
  move it: `Charter III` wants every built Civics era-3 major, and those are
  priced in Knowledge.
- **The builder is finished by week 4** — the last week adds no building at
  all.
- **Gold outgrows every sink**: 16.8 M in hand against a whole tech tree of
  550,165 and a whole fog of 194,142.
- **Knowledge stays scarce** — 1,806 — because the drip is territorial and
  this player never delves.

Together they are the case for the programme: the city's ladder has to be
priced in something the city itself produces (goods, §2–§3) and in ground
(Harmony, §6), not in Knowledge, and it has to have somewhere for the Gold to
go.

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

## 4. Step 4 · Levels 6–7, gated by goods

- **Data:** every producer row's `max_level` → 10 and its per-level arrays
  extended to 10 (`Districts`): Housing residents `2,4,6,8,10,12,14,16,18,20`;
  Sawmill/Quarry/Farm/Docks workers and radius **frozen at their L5 value**
  from L6; halls `army_cap_per_level` +8 a level; Sanctum cap/regen
  continuing the curve (also in `mana.sanctum_cap_per_level`,
  `mana.sanctum_per_hour_per_level`, `Settings`). `upgrade_cost_goods_per_level`
  filled from level 6. `required_townhall_level_per_level` set for 6–7 (TH6,
  TH7 — those Townhall levels arrive in step 7; until then the card says
  *Your Townhall must reach level 6*, which is true).
- **Two new per-level district stats:** `yield_per_delivery_per_level` and
  `strike_speed_per_level` (list columns, empty = 1.0). `DistrictDef` gains
  both; `workerYield` (`upgrades.ts:147`) and the strike cadence in
  `harvest.ts` read the crew's district level as a **base-stage** term of the
  pipeline (base → ranks → modifiers), never as a modifier — the rule in
  `CLAUDE.md` ("don't re-express upgrade levels as modifiers").
- **Sim:** `upgradeDeltas` (`districtCard.ts:93-140`) learns yield and speed
  so the card shows what L6 buys.
- **Save:** none (levels are data).
- **Tests:** `levelGates.test.ts` extended: L6 needs goods and TH6; a producer
  at L6 delivers more per trip and strikes faster; `costs.test.ts` checks the
  ×1.7 curve above 5 against the sheet; the harness moves to TH5 in week 1
  and holds there (TH6 does not exist yet).
- **Art:** level sprites 6–10 can be one "advanced" frame per building for
  now; the check only insists no emoji fallback.
- **Done when:** every building except FarmLands has ten rows of data and the
  Townhall ladder is the only thing stopping L6.

## 5. Step 5 · Adjacency v2

Decorations (step 6) need a non-Gold rule, so the resolver grows first.

- **Data:** `Adjacency` sheet gains `stat` and `magnitude`; `gold_per_minute`
  stays for the Housing row. Rows for the proposal's §8 table whose buildings
  exist after step 3: Carpenter/MasonsYard/Smelter–Quarry/Sawmill `workTime
  −0.10`, RuneCarver–Sanctum `workTime −0.10`, hall–hall `trainTime −0.10`,
  Market–workshop `salePrice +0.10` (per good, so the rule carries the good).
  Importer validation at `scripts/balance.mjs:671-682` extends to the new
  columns.
- **Sim:** `AdjacencyRule` (`definitions.ts:176-181`) gains
  `stat: AdjacencyStat | null` and `magnitude`; `adjacencyEffect`
  (`adjacency.ts:40-51`) returns a per-stat sum; `districtAdjacency` stays the
  Gold view for taxes (`population.ts:50`). A `adjacencyBonus(state, district,
  stat)` helper, clamped to `[0, +0.25]` for bonuses and to base for penalties,
  is read at the call site that owns each stat: workshop rate (step 3),
  `trainSeconds` (`army.ts:79`), `salePrice` (`upgrades.ts:202`). **Not** a
  modifier: it is positional and computed on read.
- **UI:** the ghost labels (`game.ts:1804-1822`, `:1857-1876`) already push
  `yieldCells` with an icon and tone; they learn a stat icon beside Gold. The
  card badge (`districtCard.ts:180-198`) lists every rule in effect.
- **Save:** none.
- **Tests:** `adjacency.test.ts` — a stat rule resolves, clamps, follows a
  move; a penalty never drops below base; the Gold rule is unchanged.
- **Blocked on: OQ-48** (this *is* OQ-48) and **OQ-1** (the bounded plot —
  adjacency is a puzzle only on a bounded plot; the rules ship either way).
- **Done when:** a Carpenter beside a Sawmill measurably finishes Planks
  faster in the harness.

## 6. Step 6 · Harmony and the decorations

- **Data:** `Districts` gains `harmony_supply` (a decoration's supply) and
  `harmony_cost_per_level` (list). Six decoration rows — Garden, Well,
  Orchard, Statue, Plaza, Shrine — `max_level` 1, no crew, no tap, footprints
  as proposed, costs in currencies and goods, `required_townhall_level_per_level`
  for their TH gate. Every existing row's `harmony_cost_per_level` is empty
  until step 7. `Settings` gains `harmony.surplus_tiers`
  (`1.10:0.05|1.25:0.10|1.50:0.15`) and `harmony.surplus_stat` (`taxRate`).
- **Sim:** `src/sim/harmony.ts`: `harmonySupply(state)` sums built
  decorations' supply; `harmonyDemand(state)` sums every built district's
  `harmony_cost_per_level[level]`; `harmonyBlock(state, def, level)` returns
  `'NeedsHarmony'` when `supply < demand + cost`. Checked in `placementBlock`
  (`districts.ts:55-120`) for a build and in `upgradeDistrict`
  (`commands.ts:185-189`) for an upgrade. A **gate, never a drain**: nothing
  reads Harmony after the build starts. Surplus tier → a term in `taxRate`
  (`upgrades.ts:206`) at the base stage. Adjacency row Housing–decoration
  `+1 Gold/min` lands here as data.
- **UI:** the build menu header shows `supply / demand`; a decoration category
  tab; the card of a gated building says *Needs N more Harmony*; the ghost
  shows the supply a decoration adds.
- **Save:** none (derived from built districts). Bump not needed.
- **Tests:** `harmony.test.ts` — supply and demand from the built set; a build
  refused at `supply < demand + cost`; a built building never blocks on a
  later deficit; the surplus tier moves taxes; a decoration moved keeps its
  supply. `move.test.ts`: decorations are movable.
- **Blocked on: OQ-1** (the plot has to be bounded for Harmony to cost
  ground) and **OQ-71** (plot expansions — the pressure valve; can ship after,
  not before the playtest).
- **Art:** six pieces. Store decorations are *not* in this step
  (`14-monetization.md` decides them, OQ-26).
- **Done when:** the harness at week 3 spends plot on decorations to reach the
  next level.

## 7. Step 7 · Levels 8–10, and Townhall 5–10

- **Data:** Townhall `max_level` 10, `required_tech_per_level`
  `,CharterII,CharterIII,,,,,,` (nothing past 4), `upgrade_cost_goods_per_level`
  from 5, `harmony_cost_per_level` from 8, `upgrade_duration_seconds` growth
  retuned so L6 ≈ 4 h, L8 ≈ 12 h, L10 ≈ 36 h. Every `max_count_per_townhall_level`
  array extended to 10 entries (Housing `2,4,6,9,11,13,15,17,19,21`; producers
  to 5–6; workshops `0,0,0,0,1,1,1,2,2,2`). Every row's `harmony_cost_per_level`
  filled for 8–10 and for the §5–§7 buildings. `required_townhall_level_per_level`
  for 8–10.
- **Sim:** nothing new — the gates from steps 2, 4 and 6 compose. Check
  `levelIndexed` callers assume nothing about array length 5.
- **UI:** `levelStars` (`districtCard.ts:43`) at ten levels — a numeral, not
  ten stars. The Townhall card lists what the next level unlocks (count caps)
  as today (`:133-136`).
- **Save:** none.
- **Tests:** `levelGates.test.ts`: TH5 needs goods, TH8 needs Harmony, no
  Townhall level past 4 needs a technology; `costs.test.ts` the durations;
  the harness: TH5 week 1, TH7 week 2, TH8 week 3, TH9 week 4 — **this is the
  step where the pacing table becomes an assertion.**
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
- **Docs, in the same commit as the code:** step 2–4 close into a new
  `features/17-workshops-and-goods.md` and an update to
  [`../features/buildings.md`](../features/buildings.md); step 5 into
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
| 4 | Producers' L6+ buy yield and speed, not crew | proposal §1.1 |
| 5 | The `Adjacency` sheet gains `stat` and `magnitude` | **OQ-48** |
| 6 | Harmony surplus bonus lands on taxes | proposal §4.1; **OQ-1** for the plot |
| 7 | Townhall 5–10 gated by goods and Harmony, not keystones | proposal §1.2 |
| 8 | Runestone and the Reliquary L9 recipe as the province route past relic L3 | **OQ-7**, **OQ-9** |
| 9 | The banner moves from the store to the Tavern | proposal §11; `14-monetization.md` §2.1 |
| 11 | A creature slot sits outside the Gem slot ladder | proposal §3; the slots rule in `07-research.md` §1 |
