# 3 · The economy — currencies and taxes

> **Scope.** Every currency and its job, where the city's Gold comes from, and
> the stores a building keeps what it makes in until the player collects it.
> Mana is [`08-magic.md`](08-magic.md); the collection's cards
> are [`09-relics.md`](09-relics.md); the Knowledge bar and buying Knowledge
> are [`07-research.md`](07-research.md) §3.
>
> **Status: built**, building stores included (§3.2).

## 1. One job each

- The city runs on Gold, Food, Wood and Stone.
- Mana is what magic costs.
- Stardust comes out of dungeons and pays a hero's ascension toll.
- Knowledge fills a bar with time and is poured into research.

| Currency | Source | Buys | Scope | On the plank? |
|---|---|---|---|---|
| **Gold** | housing rent, **gold mountains**, quests | fog, buildings, upgrades, expedition supplies, landmark claims | city | yes |
| **Food** | berries, game, shoals, crops | villagers, expedition supplies | city | yes |
| **Wood** | forest | buildings | city | yes |
| **Stone** | mountains, iron mountains | buildings, deep supplies | city | yes |
| **Mana** | time, capped | every tap on the ground · **casting a spell** | city | a gauge, not a coin |
| **Knowledge** | time, 1/h up to 10 · lumps · bought with Gold or Gems | pouring into technologies · investing in guild structures | kingdom | its own tab under the plank |
| **Stardust** | dungeons · hero calls | the toll on a hero's ascension | kingdom | no — reads on the roster |
| **Hero XP** | dungeons · lairs · the Survey's paid column | hero levels, on any hero | kingdom | no — reads on the roster |
| **Cards** | packs — every room, every boss, the event, the Survey, offers | the collection's five albums, one per relic, which level them; wiped each season ([`09-relics.md`](09-relics.md)) | kingdom | no — an album, not a row |
| **Gems** | quests, first clears, the Survey (both columns), the simulated store | power, comfort and breadth | player | yes |
| **Silver key** | 500 Gems, or a free call's ad | one call on the common banner | player | no — a price on a button |
| **Gold key** | 1,500 Gems, a free call's ad or the Survey | one call on the golden banner | player | no — a price on a button |

- Eleven wallet rows; five on the plank; three of them for the whole first hour.
- Adding a wallet row needs an argument. The usual alternatives: a
  per-collectible counter (the Fragments precedent) or event points as a
  counter ([`13-events.md`](13-events.md) §2.1).
- **Hero XP took a row** because it is spent on *any* hero: a per-hero counter
  would leave a freshly pulled hero at level 1 with nothing to level it
  ([`10-heroes.md`](10-heroes.md) §4).
- **The keys took the row.** A counter would have worked for holding them, but
  a key is a **price**, and a price is what a wallet row is for: the button
  that spends one renders its cost and its short state from the wallet, the
  way every other price in the game does. Two rows rather than one because
  the two banners must be able to cost differently
  ([`10-heroes.md`](10-heroes.md) §6.1).
- A key never reaches the plank: it is spent at the banner and nowhere else.
- **Refined goods follow that rule**: Planks, Cut Stone, Iron and Runestone
  are a stockpile counter, not a wallet row
  ([`17-workshops-and-goods.md`](17-workshops-and-goods.md) §1).

### 1.1 Knowledge and Stardust

| Name | Job | Source | Scope |
|---|---|---|---|
| **Knowledge** | what research is paid in | time, 1/h up to 10 · lumps · Gold · Gems | **kingdom** |
| **Stardust** | the toll on a hero's ascension | dungeons · hero calls | **kingdom** |
| **Hero XP** | levels of heroes | dungeons · lairs | **kingdom** |

- Knowledge is kingdom-scoped; it survives a region reset.
- Stardust and Hero XP are kingdom-scoped too.
- In docs and code the key is `Stardust`; *Polvo estelar* is the localised
  string.

## 2. Feature identity and currency

- A cell's feature is not its currency: `HarvestSpec.id` vs
  `HarvestSpec.currencyId`.
- Berry bushes, wild game and fish shoals all pay **Food**: 1, 3 and 2 a tap.
- A bare mountain pays **Stone** at 1; an iron mountain pays Stone at 5; a gold
  mountain pays **Gold**.
- The feature keeps its own art, tech gates, taps-to-exhaust, respawn timers and
  whether it is finite.
- Cell-scoped upgrades hang on the feature id: **Butchery** on game, **Big
  Nets** on shoals. Both move Food.
- Four city materials is the ceiling, not the floor.

## 3. Housing rent

- Every housed villager pays `taxes.goldPerPopulationPerMinute` = 30 Gold/min,
  continuously.
- Each house accrues its own rent in whole units against its own anchor, into
  **its own store** (§3.2) — not into the wallet.
- Residents are auto-assigned: houses fill in build order as population grows.
  The only effect is which house their rent is stored in.
- Roofless villagers pay nothing; empty minutes are never banked.
- **TradeRoutes** raises the rate +10%/level. The **Tribute Crown** relic adds
  +X% per level, through the modifier layer ([`09-relics.md`](09-relics.md) §2).
- Housing capacity per level: `populationCapacityPerLevel`, 2 at level 1 and
  2 more a level, to 20 at level 10 (OQ-46).
- **A house's own level raises the rent its residents pay.**
  `buildings.taxBonusPerLevel` is a fraction of the base rate and a
  **total** at each level, indexed from level 1: +0% at 1, then +25% a level to
  +225% at 10. It scales the residents' rent only — adjacency stays flat Gold a
  minute.
- **The Townhall makes Gold of its own**, with nobody living in it, into
  its own store (§3.2), the way a house does: `goldPerMinutePerLevel`, 10 a
  minute at level 1 and 5,400 at 10. The city always has a source of Gold.
  - A level fact; no technology, relic or Harmony scales it.
  - **It is never raided** ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md)).
  - From level 2 it gives back about what the houses' rent would gain at the
    population the level is reached with.
- Reference: a Townhall-1 city with two level-1 Houses = 4 villagers ≈ 130
  Gold/min idle (120 rent + the Townhall's 10); the same city at Townhall 2
  ≈ 180.

### 3.1 Adjacency

**Adjacency is the only thing that guides a layout.** Placement itself is free
— anywhere revealed, no plot bound, no building required next to another
([`05-city-and-districts.md`](05-city-and-districts.md) §4) — so every rule
here pays or charges, and none refuses.

- A rule is `(district, neighbour, stat, magnitude)`, computed from locations
  on read. Footprints must share an **edge**; diagonal corner contact does not
  count.
- **Either side may name a kind instead of a building**: `AnyHall`,
  `AnyWorkshop`, `AnyProducer`, `AnyDecoration`. Membership is what a district
  already is, so a new hall needs no new row.
- Units are the stat's: `goldPerMinute` is flat Gold a minute, everything else
  is a **fraction** of the base. For a duration a negative magnitude is the
  good one.
- **No stat moves more than ±25%**, whatever piles up next door. That is what
  keeps a layout better-or-worse instead of right-or-wrong.
- A house's rent clamps at 0, never negative.
- While placing, every affected neighbour and the ghost itself show a compact
  signed label; a built card lists what its neighbours are doing to it.

| District | Next to | Moves | By |
|---|---|---|---|
| **Housing** | Housing | Gold a minute | **−1** each |
| **Housing** | a decoration | Gold a minute | **+1** each — the mirror of the row above ([`21-harmony.md`](21-harmony.md) §6) |
| **a hall** | another hall | training time | **−10%** each |
| **Carpenter** | Sawmill | work time | −10% |
| **Mason's Yard** | Quarry | work time | −10% |
| **Smelter** | Quarry | work time | −10% |
| **Rune Carver** | Sanctum | work time | −10% |

**When a rule is priced.** A rate read on demand — Gold a minute — is computed
every time it is read, so moving a house changes its rent at once. A **timer**
is priced when it STARTS and stored on the thing waiting: a trainee's seconds
and a workshop item's work are stamped when they are queued, so a neighbour
that arrives, moves or is replaced later never repriced a wait already
running. Research already worked this way.

- More rules arrive as `adjacency` entries; a new **stat** is one line in `AdjacencyStat`
  plus one call site.

### 3.2 Building stores

**What a building makes waits inside it until the player collects it.**

- Every building that makes Gold or harvests — the Townhall, Housing, Farm,
  Sawmill, Quarry, Docks — has a **store**. A house's rent lands in it; a worker's
  haul lands in it when the worker gets home.
- Capacity is per building, per level, in units: `buildings` ›
  `storageCapacityPerLevel`. All currencies count together: a Quarry keeps
  Stone and Gold in one store.
- Capacity is authored as **1 hour** of the building at full strength at
  level 1, rising by the same factor each level to **12 hours** at level 10
  (×1.32 a level: 1 h · 1 h 19 · 1 h 44 · 2 h 17 · 3 h · 4 h · 5 h 16 ·
  6 h 56 · 9 h 8 · 12 h).
  Full strength is a full house, a full crew, or the Townhall's own income at
  that level. Nothing but the building's level raises it (OQ-108).

| Building | Level 1 | Level 5 | Level 10 |
|---|---|---|---|
| Townhall | 600 Gold | 190,000 | 3,900,000 |
| Housing | 3,600 Gold | 110,000 | 1,400,000 |
| Farm | 1,400 | 15,000 | 360,000 |
| Sawmill | 1,100 | 12,000 | 290,000 |
| Quarry | 420 | 4,600 | 110,000 |
| Docks | 1,100 | 12,000 | 170,000 |

- A data rule requires a store on anything that makes Gold or harvests, and
  forbids one on anything else.

**A full store stops its building.**

- A full house stops accruing. Nothing is banked: collecting a full house
  restarts its rent from the tap.
- A full producer's crew waits by the door, idle. A haul already on its way
  lands whole, even over capacity (OQ-107).
- Collecting — or a raid emptying the store — sets the crew going again from
  that moment.

**Collecting.**

- A store is **ready** once it holds `storage.collectSeconds` (30) of what the
  building makes now — a house's rent, a crew at its main source — or is full.
- A building making nothing (no residents, no crew) is ready with anything in it.
- A tap on a building whose store is ready moves the **whole store** to the
  wallet. It is **free** — no Mana — and does nothing else.
- A tap on a building that is not ready opens its card, as always.
- The card has no Collect: its **Storage** tile reads what the store holds
  against its capacity (*120/8.6k*), in clay when full.
- Holding the pointer on a ready building collects once.
- Collecting is where a `collect` event (quests) and a first
  discovery of a currency are recorded — never when rent accrues or a haul
  lands.
- A collect pops `+N` per currency at the building and flies the haul to the
  header. Rent and hauls landing in a store pop nothing.

**The Tithe bypasses the store**: its taps pay rent straight into the wallet,
and a full house does not stop it ([`09-relics.md`](09-relics.md) §2.1).

**Raids take from the stores, never from the wallet**
([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md) §4). Collecting is
the defence.

**The collect bubble.**

- Over every building whose store is ready floats a parchment speech bubble:
  the UI tooltip's bubble living in the world — parchment lit from above, a
  thin brown rim, rounded, a tail pointing down at the roof, a soft shadow.
- It carries **one icon**: the currency the store holds most of.
- Drawn over the world (buildings, people, markers), under the DOM UI.
- It bobs gently, each building on its own phase; pops in when it appears;
  gives a small hop when a haul lands.
- Its rim turns **red** when the store is full: the building has stopped.
- **A tap or hold on the bubble is a tap on its building**: it collects the
  store, whatever cell lies behind it on screen.
- Mockup: [`../art/mockups/collect-bubbles-mockup.png`](../art/mockups/collect-bubbles-mockup.png).

**An absence is bounded by the stores.** There is no offline cap: the whole
absence is replayed, and each building stops when its store is full
([`04-harvest.md`](04-harvest.md) §8).

## 4. Villager training

- The Townhall trains villagers in a queue.
- Each press of Train pays its Food cost up front, priced as if everything
  already queued had delivered, and appends one villager.
- Villagers complete one at a time. A villager's wait depends on their place
  in the town (the population plus everyone queued ahead of them):
  `training.seconds` (20 s) × `training.villagerSecondsGrowth` (×1.07) per
  place. So the 1st takes 20 s, the 20th about 1 min, the 40th about 5 min
  and the 70th about 35 min. The wait is stamped when the villager's clock starts.
- The queue is limited only by Food and housing capacity; queued villagers
  count against the cap.
- Cost: authored for the first seven (`5, 20, 45, 100, 250, 500, 1000`), then `×1.1`
  per villager beyond: about 3,500 Food for the 20th, 23,000 for the 40th and
  405,000 for the 70th. The Townhall's levels ask for villagers
  ([`05-city-and-districts.md`](05-city-and-districts.md) §1).
- No tap hurries the queue.
- Timers take Gems ([`04-harvest.md`](04-harvest.md) §3.2).

## 5. A tap is priced in production, not in units

- A tap on the ground hands the player `tap.workSeconds` = 10 seconds of work
  on the thing tapped, floored at one unit.
- The rate a tap reads is the cell's own measured rate — its chunk over its
  rhythm ([`04-harvest.md`](04-harvest.md) §4) — never the city-wide total for
  that resource. Full design: [`04-harvest.md`](04-harvest.md) §3.
- `TapPower` buys the tap's duration: +20% a rank over four ranks.
- **Mana is spent only on taps on the ground** — trees, berries, crops, rocks,
  mountains, shoals: `tap.manaCost` = 1. A tap on a building never costs Mana
  (§3.2). Paying fog costs Gold. A tap refused by a tech gate costs no Mana.
- Every new reward follows the same rule: priced as a duration of the player's
  own production, not as an absolute amount. Quest rewards are currently
  absolute Gold amounts.

A full pool buys about the same slice of progress at every stage:

| City | tap | full pool | = production |
|---|---|---|---|
| 1 Sawmill L1, 3 workers, `TapPower` 0, pool 100 | 1 Wood | 100 Wood | **5.6 min** |
| 30 workers, `TapPower` 10, pool 332 | 3 Wood | ~1,000 Wood | **5.5 min** |

## 6. Where Gold goes

Flow: **housing rent → the house's store → a collect → Gold → fog, buildings
and research**.

| Sink | Size |
|---|---|
| The whole map's fog | 2,522,803,392 |
| The technology tree, 167 techs | 592,385 |
| A lair fight's supplies, per attempt | 25 → 1,000 by tier |
| Landmark claims | 2,000 · 10,000 (the Watchtower) · 25,000 ×5 · 100,000 ×4 |
| Buildings and upgrades | on a count and level curve |
| **Wonder levels** (designed, not built) | **unbounded** — [`16-wonders.md`](16-wonders.md) |

- The quest chain pays **16,215 Gold across 67 quests**
  ([`12-quests.md`](12-quests.md)).
- Every row except Wonder levels is one-time: landmark claims total
  **537,000**.
- The only unbounded sink is Wonder levels ([`16-wonders.md`](16-wonders.md)).

## 7. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Tax rate | 30 Gold/pop/min | `taxes.goldPerPopulationPerMinute` |
| House rent bonus per level | +0% then +25% a level, to +225% | `buildings.taxBonusPerLevel` |
| The Townhall's own Gold per level | 10 · 60 · 240 · 560 · 1,050 · 1,700 · 2,500 · 3,400 · 4,500 · 5,400 a minute | `buildings` › Townhall › `goldPerMinutePerLevel` |
| Seconds a tap is worth | **10 s of work** | `tap.workSeconds` |
| Tap Mana cost, ground taps only | 1 | `tap.manaCost` |
| Store capacity per level | 1 h of the building at level 1, ×1.32 a level to 12 h at level 10 (§3.2) | `buildings` › `storageCapacityPerLevel` |
| Ready to collect | 30 s of the building's current production | `storage.collectSeconds` |
| Housing capacity per level | 2 · 4 · 6 … 20 — contested, OQ-46 | `buildings` › Housing › `populationCapacityPerLevel` |
| Villager training | 20 s ×1.07 per villager already in town or queued; cost `5,20,45,100,250,500,1000` then ×1.1 — the Townhall's levels ask for villagers ([`05-city-and-districts.md`](05-city-and-districts.md) §1) | `training.*`, `city.populationCost*` |
| Collect cooldown | 0.5 s | `tap.collectCooldownSeconds` |
| Sale prices | Food 1 · Stone 2 · Wood 3 | `currencies.goldValue` |
| Adjacency rules | §3.1 | `adjacency` — `district`, `neighbor`, `stat`, `magnitude` |

## 8. Deliberately not in this design

- Berries, Meat and Fish as wallet rows.
- A currency-equivalence engine: cheapest-first payment order, change-making,
  a Food breakdown in the purse.
- Iron as a wallet row.
- A second purse for research.
- Generators and vaults.
- An offline cap: the stores are what bound an absence (§3.2).
- A Townhall level that multiplies the houses' rent: its Gold is its own.
- A tap that pulls rent forward. Only the Tithe does it
  ([`09-relics.md`](09-relics.md) §2.1).
- Silver.
- A library district or a scholar assignment as Knowledge sources.
- A Townhall tap that hurries villager training.

**Open questions:** OQ-46, OQ-107, OQ-108 in [`../open-questions.md`](../open-questions.md).
