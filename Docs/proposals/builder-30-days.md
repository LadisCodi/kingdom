# Proposal — the builder for thirty days

> **What this is.** A menu of building content for the city half of the game,
> sized so a player has something to build, upgrade and wait for every day for
> **at least 30 days**. It is a **proposal**, not a feature doc: each block
> below is a candidate, with options and a recommendation, for you to pick from
> and turn into an implementation plan. Nothing here is built. Numbers are a
> first pass and say so.
>
> **Comparables** used throughout: **Elvenar** (Culture, goods manufactories,
> chapters), **Kingshot** (Town Center as the one ladder to L30, the Tavern,
> troop tiers, "requires X at level N" chains), **Whiteout Survival** (the
> Furnace ladder, pets as a long-timer companion system).

## 0. Where the builder stands today

| | Today | Lasts |
|---|---|---|
| Townhall | 4 levels (5 sealed) | ~day 3 |
| Sawmill / Quarry / Farm / Docks | 4 / 3 / 2 / 2 levels | day 2–4 |
| Housing | 3 levels, cap 9 | day 3 |
| Sanctum, four halls | 5 levels | week 1 |
| Tomes | 3 eras + a sealed era 4; ~8 weeks of Knowledge for the whole tree | the only thing that already reaches week 4 |
| Wonders | designed, not built; the endless ladder | — |

The city runs out of things to build in the first week; what carries a player
to day 30 today is research and the collection. The blocks below give the
**city** its own 30-day ladder and make the other systems hang off buildings
the player can see.

**Rules every block respects** ([`../README.md`](../README.md)):

- Nothing owned is ever taken (no decay, no destruction, Harmony is a gate
  not a drain).
- Wallets buy comfort and breadth: every building and every good is earnable.
- Played in visits: every new timer is hours to days, never minutes to babysit.
- Rewards priced in production, not units.
- **No new wallet row.** Goods are a stockpile counter; Harmony is a city
  stat; an egg is an item.
- The offline cap limits production, never a timer — each block says which it is.
- **Manual → automation.** The province's producers start under the player's
  thumb and are handed to a crew; the workshops are the first producer that
  is a crew from the start — a villager, or nothing.

## 1. Levels 6–10 for every existing building

### 1.1 The ladder

| Building | Today | Proposed | Levels 6–10 buy |
|---|---|---|---|
| **Townhall** | 4 (5 sealed) | **10** | count caps, the gate for every other L6+ |
| **Housing** | 3 | 10 | residents 2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 20 |
| **Sawmill / Quarry / Farm / Docks** | 4 / 3 / 2 / 2 | 10 | L1–5: workers and radius (as today). L6–10: **yield per delivery** and **strike speed**, not crew — the plot has ~60 trees, more workers than cells is waste |
| **Market** | 1 | 10 | sale price +3%/level; a **goods** tab at L5 |
| **Sanctum** | 5 | 10 | capacity and regen keep the curve (+32 / +36 … per level) |
| **Four halls** | 5 | 10 | army cap +8/level; L8 unlocks a fourth unit tier |
| **FarmLands** | 1 | 1 | stays a cell |

### 1.2 What gates a level

Three gate layers, so the ladder is paced by three different clocks:

| Levels | Gate | Clock |
|---|---|---|
| 1–5 | Townhall level + a technology (as today) | hours, Knowledge |
| 6–7 | Townhall level + **refined goods** (§2) | days — workshop queues |
| 8–10 | Townhall level + refined goods + **Harmony** (§4) | days — plot and decorations |

- The Townhall itself: L5–10 need goods, Harmony and time; **no more
  keystones**. The tomes keep eras 1–3 and the sealed era 4 as the research
  endgame; the Townhall ladder is decoupled from them past L4.
  - *Alternative:* Charters IV–IX as keystones for TH5–10. Six more eras of
    nodes to author (~40 each). Not recommended.
- Upgrade times: L6 ~4 h, L8 ~12 h, L10 ~36 h for the Townhall; half that for
  a district. Kingshot's Town Center runs 1–3 days a level in the 20s. Timers
  resolve in the uncapped tail (invariant 2).
- Upgrade costs: ×1.7 per level above 5, paid in Wood/Stone **plus** goods.
  Every L6+ upgrade needs at least one good, so the workshops are never
  optional.

### 1.3 Thirty-day pacing target

| Week | Townhall | Player is doing |
|---|---|---|
| 1 | TH1 → TH5 | today's game: fog, tree, first ruins |
| 2 | TH6 → TH7 | first workshops, first goods, Watchtower, Reliquary |
| 3 | TH8 | Harmony arrives: decorations, plot expansions, Tavern |
| 4 | TH9 | Dragon's Nest, second workshop tier, halls to 8 |
| 5+ | TH10 | Wonders take over as the endless ladder |

## 2. Workshops — refined goods

### 2.1 The goods

Elvenar runs three tiers of goods; Kingshot runs one late good (Truegold).
Recommendation: **one tier of three goods, and one late good**.

| Good | Made from | Workshop | Used by |
|---|---|---|---|
| **Planks** | Wood | **Carpenter** | building levels 6–10 |
| **Cut Stone** | Stone | **Mason's Yard** | building levels 6–10 |
| **Iron** | Stone from iron veins + Gold | **Smelter** | halls L6+, units tier 4, the Dragon's Nest |
| **Runestone** *(tier 2)* | Cut Stone + Mana | **Rune Carver** | relic levels 4–5, Wonder levels, the Sanctum L8+ |

- Goods are **not wallet rows**. They are a stockpile shown in the workshop
  card and in the build sheet next to the price, like ingredients.
- Runestone is the only good that touches the collection. It gives the
  workshops a reason to exist past the building ladder and gives Mana a
  **second sink** (OQ-44's ceiling problem shrinks).
  - *Alternative:* three tiers as Elvenar (9 goods). Nine more art pieces and
    a Trader. Not for 30 days.

### 2.2 How a workshop works — workers are the engine

- The player fills a **queue** of goods. Each queue item is one good with a
  fixed amount of work (first pass: Planks 20 min, Cut Stone 30 min, Iron
  60 min, Runestone 3 h of one worker). Inputs are paid when the item is
  queued.
- **Nothing happens without a worker.** A workshop with no villager assigned
  does not advance: the queue waits. No hand production, no collect tap — the
  worker is the only engine, and it is what the player is building Housing
  for.
- Workers come from Housing population and are assigned like a Sawmill's
  crew. A worked item is delivered to the stockpile the moment it finishes.

**Workers share the queue, so one more is always faster.**

- The crew spreads **evenly over the items being worked** — at most one item
  per worker, front of the queue first. A worker with no item of its own
  helps on another.
- Item speed = workers on it. Two workers on one 1-hour item finish it in
  30 minutes; two workers on two 1-hour items finish both in 1 hour; three
  workers on two items finish both in 40 minutes. Throughput is always
  `workers × 1 item-hour per hour`, whatever the queue holds.
- For the sim this is a piecewise-constant rate per item that changes only
  when an item finishes or the crew changes — one `consider()` in
  `nextBoundary`, like a strike.

**Levels buy crew and queue.**

| Level | Workers | Queue |
|---|---|---|
| 1 | 1 | 3 |
| 2 | 2 | 4 |
| 4 | 3 | 6 |
| 6 | 4 | 8 |
| 8 | 5 | 10 |
| 10 | 6 | 12 |

- Levels never shorten an item's work. Speed is villagers; the pressure to
  house more of them is the point.

**Offline.**

- Worked production is **production**: it stops at the 8 h offline cap, as a
  Sawmill's crew does ([`../features/04-harvest.md`](../features/04-harvest.md)
  §8). A player away twelve hours comes back to eight hours of goods,
  delivered; the queue past that waits.

**Other.**

- A tap on the workshop opens its queue. It does not hurry work.
- **Gems finish the item being worked**, priced on the time it has left — the
  same rush rule as a build ([`../features/14-monetization.md`](../features/14-monetization.md)
  §2.2: 720 Gems an hour, pro rata). Only the item in progress; never the
  queue behind it, never a worker slot.
- Count cap: 1 of each workshop at TH5, 2 at TH8.

### 2.3 Unlocks

| Workshop | Unlock | Townhall |
|---|---|---|
| Carpenter, Mason's Yard | `Engineering` (Civics era 3) | TH5 |
| Smelter | `Mining` | TH6 |
| Rune Carver | `Attunement II` | TH8 |

## 3. Dragon's Nest — élite units on a long timer

- A district, one per city, unlocked at TH7 by a Warfare technology
  (`Beastcraft`, new, era 3).
- **An egg incubates for X days** (first pass: 3 days; 5 and 7 for higher
  eggs). A pure **timer**, uncapped, one egg at a time. Gems shorten it.
- Eggs come from **outside the city**: the deepest depth of a ruin, event
  tracks, the world map. Never from the store.
- The hatched creature is an **élite unit**: a fifth troop type with its own
  slot in the party, power ≈ 3× a champion, one at a time in a delve.
- The creature **levels by feeding Food** — the late-game Food sink the
  economy lacks. Nest level caps the creature's level.
- Nest levels 1–10: creature level cap +2/level; L5 a second nest slot (two
  eggs incubating); L8 a second creature in the party.
- Comparable: Whiteout's pets — a companion on a multi-day timer, fed with a
  surplus resource.
- Interaction with heroes ([`../features/10-heroes.md`](../features/10-heroes.md)):
  the creature is a unit, not a hero — no gacha, no Stardust.

## 4. Decorations and Harmony

### 4.1 The rule

- **Harmony is a city stat, not a currency**: `supply − demand`, computed on
  read, shown in the build menu header. Never spent, never lost.
- **Decorations supply Harmony**; **advanced buildings demand it**. Every
  building level 8+ and every §5–§7 building carries a `harmony_cost`.
- A build or upgrade with a Harmony cost may **start** only while
  `supply ≥ demand + cost`. Once built it never loses Harmony — a deficit
  blocks the next thing, it does not punish the last (promise 1).
- Elvenar's Culture works exactly so, plus a production bonus for surplus.
  Recommended surplus bonus, three tiers on **housing taxes**: ≥110% supply
  +5%, ≥125% +10%, ≥150% +15%. Read where it is spent: on the Townhall card.

### 4.2 The pieces

| Decoration | Footprint | Harmony | Cost | Unlock |
|---|---|---|---|---|
| Garden | 1×1 | 4 | Wood + Food | TH5 |
| Well | 1×1 | 6 | Cut Stone | TH6 |
| Orchard | 2×1 | 12 | Planks + Food | TH6 |
| Statue | 1×1 | 10 | Cut Stone + Gold | TH7 |
| Plaza | 2×2 | 30 | Planks + Cut Stone | TH8 |
| Shrine | 2×2 | 40 | Runestone | TH9 |
| Seasonal pieces | any | authored | event track | events |

- Decorations have no level, no crew, no tap. They are movable.
- **Store decorations** (Gems): same Harmony per tile as an earned piece of
  the same footprint, better art. Cosmetic breadth, promise 3.
- Harmony per tile is the real dial: it decides how much of the **plot** goes
  to decoration, which is what makes **plot expansions** (OQ-71) worth
  buying. Elvenar's whole late game is this tension. First pass: at TH10 a
  city needs ~25% of its plot in decoration.

## 5. Watchtower — the world map

- A district, one per city, 2×2, unlocked by `Cartography` at TH5.
- **L1 unlocks the world map** ([`../features/02-map-scopes.md`](../features/02-map-scopes.md)).
- Levels 1–10 move the world map's own dials:

| Level | Grants |
|---|---|
| 1 | the world map; 1 march at a time; vision radius 2 hexes around your outpost |
| 3 | a second march |
| 4, 7, 10 | +1 vision radius |
| 5 | march speed +10% (and +10% per level after) |
| 6 | a second outpost |
| 9 | a third march |

- Gates: TH level; L6+ need Iron; L8+ Harmony.
- Kingshot gates every world verb behind a building level; the Watchtower is
  that in one place instead of spread over three.

## 6. Reliquary — the relic system as a building

- Today the Reliquary is a **screen**; relics arrive from the first ruin
  cleared. Proposal: a 1×1 district, one per city, unlocked at TH3 by
  `Consecration`; **L1 unlocks attunement**.
- What levels may **not** do: grant attunement slots. Slots are Gems,
  everywhere, and by nothing else ([`../features/07-research.md`](../features/07-research.md) §1).
- What levels do:

| Level | Grants |
|---|---|
| 1 | attunement; the relic sheet |
| 2, 4, 6, 8, 10 | relic **level cap** +1 (a relic caps at L1 until the Reliquary grows — replaces nothing, delays the Stardust spend) |
| 3 | 1★ ingredient drops +10% |
| 5 | **ingredient trading** ([`../features/09-relics.md`](../features/09-relics.md) §6) |
| 7 | Stardust from delves +10% |
| 9 | a Runestone recipe for one 3★ ingredient a week — the province-only player's route past relic level 3 (OQ-7) |

- Cost: L6+ need Runestone; L8+ Harmony.
- *Option:* instead of a level cap, Reliquary levels raise the Stardust
  **discount**. Less legible. Not recommended.

## 7. Tavern — the hero system as a building

- A 2×1 district, one per city, unlocked at TH4 by a Civics technology
  (`Hospitality`, new, era 2). **L1 unlocks heroes and the banner**
  ([`../features/10-heroes.md`](../features/10-heroes.md)); the banner moves out
  of the store and into the Tavern, where Kingshot keeps it.
- Levels 1–10:

| Level | Grants |
|---|---|
| 1 | heroes, the banner, party of 1 |
| 2, 4, 6, 8, 10 | hero **level cap** +2 |
| 3 | a daily **rumour**: one free quest for the party, priced in production ([`../features/12-quests.md`](../features/12-quests.md) daily habit) |
| 5 | hero XP from delves +10% |
| 7 | a weekly free pull |
| 9 | a second rumour a day |

- Party slots stay Gems. The Tavern does not sell pulls; the banner does.
- Cost: L6+ Planks and Cut Stone; L8+ Harmony.

## 8. Adjacency — a small rule set

Principles, on top of what exists ([`../features/03-economy.md`](../features/03-economy.md) §3.1):

- Edge contact only; computed on read; shown in the ghost while placing.
- **One rule per building**, and it always moves **that building's own stat**.
- A bonus never exceeds +25% and a penalty never drops below the base
  (clamp at 0), so no layout is ever wrong, only better.
- No chains, no districts-of-districts, no road requirement (Elvenar's road is
  the rule we do not take).

| Building | Next to | Effect |
|---|---|---|
| Housing | Housing | −1 Gold/min per neighbour *(exists)* |
| Housing | a decoration | **+1 Gold/min** per neighbouring decoration — the mirror of the rule above |
| Carpenter | Sawmill | work time −10% |
| Mason's Yard | Quarry | work time −10% |
| Smelter | Quarry | work time −10% |
| Rune Carver | Sanctum | work time −10% |
| Sanctum | a decoration | Mana regen +5% per neighbouring decoration, max +20% (`Ley Lines`, already planned) |
| a hall | another hall | training time −10% per neighbouring hall — the military quarter |
| Tavern | Housing | Harmony +1 per neighbouring house |
| Market | a workshop | that good sells +10% |

- Everything above is a row on the `Adjacency` sheet if the sheet grows two
  columns: `stat` and `magnitude`, alongside today's Gold/min. OQ-48 is this
  decision.
- The plot is bounded, so adjacency competes with Harmony for ground. That is
  intended: the city is a puzzle again at TH8.

## 9. What each block costs

| Block | Data | Code | Art | New timer type | Offline class |
|---|---|---|---|---|---|
| §1 Levels 6–10 | rows | yield/speed per level as district stats; L6+ costs in goods | 6 more sprites per building | none | timer (as today) |
| §2 Workshops | 4 districts, recipes sheet | goods queue, crew shared across items, stockpile, goods in prices, rush on the item in progress | 4 buildings + 4 goods icons | **queue item** | production |
| §3 Dragon's Nest | 1 district, eggs, 1 unit type | incubation, feeding, party slot | nest, 3 eggs, 1–3 creatures | **incubation** | timer |
| §4 Harmony | 6 decorations, `harmony_cost` column | supply/demand stat, gate, surplus bonus | 6 pieces + seasonal | none | — |
| §5 Watchtower | 1 district | world-map dials read from a building level | 1 building | none | — |
| §6 Reliquary | 1 district | relic cap and drop hooks on a level | 1 building | none | — |
| §7 Tavern | 1 district, `Hospitality` | hero cap, rumours, banner relocation | 1 building | none | — |
| §8 Adjacency | sheet columns | stat-typed rules in the resolver | none | none | — |

Dependencies: §1's L6–7 need §2; L8–10 need §4. §5–§7 need only §1's TH
ladder. §3 needs §2 (Iron). §8 needs nothing.

## 10. Recommended core, and what to leave

**Core for a 30-day builder:** §1 + §2 + §4 + §8, then §5–§7 as the
"buildings that unlock systems" pass. §3 is the one genuinely new mechanic;
it is the best week-4 hook and the most expensive block.

Not in this proposal, deliberately:

- A road or connectivity requirement.
- Goods trading between players (the ingredient trade covers the social need).
- Building destruction, downgrades, or Harmony that drains.
- A second city.
- Any new wallet row.

## 11. Decisions this opens

- Townhall 5–10 gated by goods and Harmony, or by six more keystones (§1.2).
- One good tier plus Runestone, or Elvenar's three tiers (§2.1).
- Does Runestone touch relic levels, and how does that sit with OQ-7 and
  OQ-9 (§2.1, §6).
- Harmony surplus bonus on taxes, on all production, or none (§4.1).
- Whether the banner leaves the store for the Tavern (§7) —
  [`../features/14-monetization.md`](../features/14-monetization.md).
- The `Adjacency` sheet growing a `stat` column (§8, OQ-48).
- Plot expansions as the price of Harmony (§4.2, OQ-71).
