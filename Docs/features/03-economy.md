# 3 · The economy — currencies and taxes

> **Scope.** Every currency and its job, where the city's Gold comes from, and
> the stores a building keeps what it makes in until the player collects it.
> Mana is [`08-magic.md`](08-magic.md); relic fragments are
> [`09-relics.md`](09-relics.md); the Knowledge bar and buying Knowledge are
> [`07-research.md`](07-research.md) §3; refined goods and precious materials
> are [`17-workshops-and-goods.md`](17-workshops-and-goods.md).
>
> **Status: built**, building stores included (§3.2).

## 1. One job each

- The city runs on Gold, Food, Wood and Stone.
- Mana is what magic and fights cost.
- Knowledge fills a bar with time and is poured into research.
- Stardust levels relics and tolls a hero's ascension; Hero XP levels heroes.
- Gems are the premium coin.

| Currency | Source | Buys | Scope | On the plank? |
|---|---|---|---|---|
| **Gold** | housing rent, the Townhall, **gold mountains**, quests, treasures, world districts | fog, buildings, technologies, troops, landmark claims | city | yes |
| **Food** | berries, game, shoals, crops | villagers, troops | city | yes |
| **Wood** | forest | buildings, troops | city | yes |
| **Stone** | mountains, iron mountains | buildings | city | yes |
| **Mana** | time, capped | taps on the ground · a city relic's activation · every fight · a world relic's spell · a Runestone | city | a gauge, not a coin |
| **Knowledge** | time, 1/h up to 10 · lumps · bought with Gold or Gems | pouring into technologies | kingdom | its own tab under the plank |
| **Stardust** | dungeons · quests · hero calls · the Survey · scouting | relic levels · a hero's ascension | kingdom | no — reads on the roster |
| **Hero XP** | lairs · dungeons · the Survey · scouting | hero levels, on any hero | kingdom | no — reads on the roster |
| **Gems** | quests, the Survey, scouting, the simulated store | power, comfort and breadth ([`14-monetization.md`](14-monetization.md) §1) | player | yes |

- **Nine wallet rows**; five on the plank; three of them for the whole first
  hour.
- Adding a wallet row needs an argument. The usual alternative is a counter
  beside the thing it belongs to:
  - relic fragments, a counter per relic ([`09-relics.md`](09-relics.md) §3);
  - refined goods and precious materials, a stockpile counter per good
    ([`17-workshops-and-goods.md`](17-workshops-and-goods.md) §1);
  - event points ([`13-events.md`](13-events.md) §2.1).
- **Hero XP is a row** because it is spent on *any* hero
  ([`10-heroes.md`](10-heroes.md) §4).
- **Items are not currencies.** Chests, speed-ups, boosts, Mana flasks,
  Knowledge tomes and the two hero keys are held in **the Bag** and leave it
  only by being used. Nothing is priced in items.

### 1.1 Scope

- **City**: Gold, Food, Wood, Stone, Mana.
- **Kingdom**: Knowledge, Stardust, Hero XP — they survive a region reset.
- **Player**: Gems.
- In docs and code the key is `Stardust`; *Polvo estelar* is the localised
  string.

## 2. Feature identity and currency

- A cell's feature is not its currency: `HarvestSpec.id` vs
  `HarvestSpec.currencyId`.
- Berry bushes, wild game and fish shoals all pay **Food**; a worker's strike
  takes 1, 3 and 2.
- A bare mountain and an iron mountain pay **Stone** (a strike takes 1 and 5);
  a gold mountain pays **Gold** (3).
- A tap pays `tap.workSeconds` of the cell's own work, floored at one unit
  (§5): every one of these pays 1 a tap at the base dials.
- The feature keeps its own art, tech gate, stock, recovery or respawn timer,
  and whether it is finite.
- A technology may aim at a feature id: `harvestYield` on Forest (Sawpits),
  Crops (Irrigation), Stone (Stonecutting), MountainIron (Iron Picks),
  MountainGold (Deep Mining) ([`04-harvest.md`](04-harvest.md) §7).
- Four city materials is the ceiling, not the floor.

## 3. Housing rent

- Every housed villager pays `taxes.goldPerPopulationPerMinute` = 30 Gold/min,
  continuously.
- Each house accrues its own rent in whole units against its own anchor, into
  **its own store** (§3.2) — not into the wallet.
- Residents are auto-assigned: houses fill in build order as population grows.
  The only effect is which house their rent is stored in.
- Roofless villagers pay nothing; empty minutes are never banked.
- What raises the rate:
  - **Trade Routes I–V**, +10% a rank (`taxRate`);
  - the Harmony surplus, +5% / +10% / +15% at the base stage
    ([`21-harmony.md`](21-harmony.md) §5);
  - the **Tribute Crown**, on houses inside its Shrine's aura while its window
    is open ([`09-relics.md`](09-relics.md) §2.1);
  - the Bag's **Rent boost**, +25% for 8 h.
- Housing capacity per level: `populationCapacityPerLevel`, 2 at level 1 and
  2 more a level, to 20 at level 10 (OQ-46).
- **A house's own level raises the rent its residents pay.**
  `buildings.taxBonusPerLevel` is a fraction of the base rate and a
  **total** at each level, indexed from level 1: +0% at 1, then +25% a level to
  +225% at 10. It scales the residents' rent only — adjacency stays flat Gold a
  minute.
- **The Townhall makes Gold of its own**, with nobody living in it, into its
  own store (§3.2): `goldPerMinutePerLevel`, 10 a minute at level 1 and 5,400
  at 10. The city always has a source of Gold.
  - Only `ownGold` technologies scale it (Civic Treasury I, +25%); no relic,
    boost or Harmony does.
  - **It is never raided** ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md)).
- Reference: a Townhall-1 city with two level-1 Houses = 4 villagers ≈ 130
  Gold/min idle (120 rent + the Townhall's 10); the same city at Townhall 2
  ≈ 180.

### 3.1 Adjacency

Placement is free — anywhere revealed, no building required next to another
([`05-city-and-districts.md`](05-city-and-districts.md) §4) — so every rule
here pays or charges, and none refuses.

- A rule is `(district, neighbour, stat, magnitude)`, computed from locations.
  Footprints must share an **edge**; diagonal corner contact does not count.
- **Either side may name a kind instead of a building**: `AnyHall`,
  `AnyWorkshop`, `AnyProducer`, `AnyDecoration`. Membership is what a district
  already is, so a new hall needs no new row.
- Units are the stat's: `goldPerMinute` is flat Gold a minute, everything else
  is a **fraction** of the base. For a duration a negative magnitude is the
  good one.
- **No fractional stat moves more than ±25%** (`ADJACENCY_CLAMP`), whatever
  piles up next door.
- A house's rent clamps at 0, never negative.
- While placing, every affected neighbour and the ghost itself show a compact
  signed label; a built card lists what its neighbours are doing to it.

| District | Next to | Moves | By |
|---|---|---|---|
| **Housing** | Housing | Gold a minute | **−1** each |
| **Housing** | a decoration | Gold a minute | **+1** each ([`21-harmony.md`](21-harmony.md) §6) |
| **a hall** | another hall | training time | **−10%** each |
| **Carpenter** | Sawmill | work time | −10% |
| **Mason's Yard** | Quarry | work time | −10% |
| **Smelter** | Quarry | work time | −10% |
| **Rune Carver** | Sanctum | work time | −10% |

**When a rule is priced.**

- A **rate** (Gold a minute) is computed every time it is read, so moving a
  house changes its rent at once.
- A **timer** is priced when it starts and stored on the thing waiting: a
  trainee's seconds and a workshop item's work. A neighbour that arrives,
  moves or is replaced later never reprices a wait already running.
- A new rule is an `adjacency` entry; a new **stat** is one line in
  `AdjacencyStat` plus one call site.

### 3.2 Building stores

**What a building makes waits inside it until the player collects it.**

- Every building that makes Gold or harvests — the Townhall, Housing, Farm,
  Sawmill, Quarry, Docks — has a **store**. A house's rent lands in it; a
  worker's haul lands in it when the worker gets home.
- Capacity is per building, per level, in units: `buildings` ›
  `storageCapacityPerLevel`. All currencies count together: a Quarry keeps
  Stone and Gold in one store.
- Capacity is authored as about **1 hour** of the building at full strength at
  level 1, rising to about **12 hours** at level 10. Full strength is a full
  house, a full crew, or the Townhall's own income at that level.
- The tree raises it by a share (`storageCapacity`): Granaries I–II (Farm),
  Woodsheds I (Sawmill), Smokehouses I (Docks), Strongroom I (Townhall and
  Housing), +25% each.

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
- A tap on a building that is not ready opens its card.
- The card has no Collect: its **Storage** tile reads what the store holds
  against its capacity (*120/8.6k*), in clay when full.
- Holding the pointer on a ready building collects once.
- Collecting is where a `collect` event (quests) and a first discovery of a
  currency are recorded — never when rent accrues or a haul lands.
- A collect pops `+N` per currency at the building and flies the haul to the
  header. Rent and hauls landing in a store pop nothing.

**Raids take from the stores, never from the wallet**
([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md) §4). Collecting is
the defence.

**The collect bubble.**

- Over every building whose store is ready floats a parchment speech bubble:
  parchment lit from above, a thin brown rim, rounded, a tail pointing down at
  the roof, a soft shadow.
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
  and the 70th about 35 min. The wait is stamped when the villager's clock
  starts. Schooling I trains them 20% faster.
- The queue is limited only by Food and housing capacity; queued villagers
  count against the cap.
- Cost: authored for the first thirteen
  (`5, 10, 20, 40, 70, 110, 160, 230, 320, 440, 600, 800, 1000`), then `×1.1`
  per villager beyond: about 1,950 Food for the 20th, 13,100 for the 40th and
  229,000 for the 70th. The Townhall's levels ask for villagers
  ([`05-city-and-districts.md`](05-city-and-districts.md) §1).
- No tap hurries the queue. Gems and Training speed-ups do
  ([`04-harvest.md`](04-harvest.md) §3.2).

## 5. A tap is priced in production, not in units

- A tap on the ground hands the player `tap.workSeconds` = 10 seconds of work
  on the thing tapped, floored at one unit.
- The rate a tap reads is the cell's own — its chunk over its rhythm
  ([`04-harvest.md`](04-harvest.md) §3) — never the city-wide total for that
  resource.
- What lengthens it: the Bag's **Harvest boost** (+50% for 1 h). The tree has
  a stat for it (`tapWorkSeconds`); no technology carries it.
- **Mana is spent on taps on the ground** — trees, berries, crops, mountains,
  shoals: `tap.manaCost` = 1. A tap on a building never costs Mana (§3.2).
  Paying fog costs Gold. A tap refused by a tech gate costs no Mana.
- Every new reward in the city's materials follows the same rule: priced as a
  duration of the player's own production — a Bag chest is 10 min, 1 h or 8 h
  of what the city makes of its coin (`bag.chestFloorPerHour` is the floor).
  Quest rewards are authored amounts.
- What a full pool of taps is worth against the crew is OQ-51 and OQ-126.

## 6. Where Gold goes

Flow: **housing rent → the house's store → a collect → Gold → fog, buildings,
research and troops**.

| Sink | Size |
|---|---|
| The whole map's fog | 2,522,803,392 ([`01-map-and-fog.md`](01-map-and-fog.md) §5) |
| The technologies, 188 in three books | 13,314,945 — Kingdom 5,669,345 · Atlas 7,630,700 · Sagas 14,900 |
| Landmark claims | 10,000 · 25,000 ×3 · 100,000 ×2 = **285,000** |
| Buildings and their levels | `costPerLevel`, dearer per later instance |
| Troops | each unit's `recruitCost` |
| **Wonder levels** (designed, not built) | **unbounded** — [`16-wonders.md`](16-wonders.md) |

- The quest chain pays **21,495 Gold across 89 quests**
  ([`12-quests.md`](12-quests.md)).
- Fog, technologies and landmark claims are one-time sinks.

## 7. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Tax rate | 30 Gold/pop/min | `taxes.goldPerPopulationPerMinute` |
| House rent bonus per level | +0% then +25% a level, to +225% | `buildings` › Housing › `taxBonusPerLevel` |
| The Townhall's own Gold per level | 10 · 60 · 240 · 560 · 1,050 · 1,700 · 2,500 · 3,400 · 4,500 · 5,400 a minute | `buildings` › Townhall › `goldPerMinutePerLevel` |
| Seconds a tap is worth | **10 s of work** | `tap.workSeconds` |
| Tap Mana cost, ground taps only | 1 | `tap.manaCost` |
| Store capacity per level | about 1 h of the building at level 1 to 12 h at level 10 (§3.2) | `buildings` › `storageCapacityPerLevel` |
| Ready to collect | 30 s of the building's current production | `storage.collectSeconds` |
| Housing capacity per level | 2 · 4 · 6 … 20 — OQ-46 | `buildings` › Housing › `populationCapacityPerLevel` |
| Villager training | 20 s ×1.07 per villager already in town or queued; cost `5,10,20,40,70,110,160,230,320,440,600,800,1000` then ×1.1 | `training.*`, `city.populationCost*` |
| Adjacency rules | §3.1 | `adjacency` — `district`, `neighbor`, `stat`, `magnitude` |

## 8. Deliberately not in this design

- Berries, Meat, Fish or Iron as wallet rows.
- Items, keys, fragments or refined goods as wallet rows.
- A currency-equivalence engine: cheapest-first payment order, change-making,
  a Food breakdown in the purse.
- Selling a resource for Gold.
- A second purse for research.
- Generators and vaults.
- An offline cap: the stores are what bound an absence (§3.2).
- A Townhall level that multiplies the houses' rent: its Gold is its own.
- A tap that pulls rent forward.
- Silver.
- A library district or a scholar assignment as Knowledge sources.
- A Townhall tap that hurries villager training.

**Open questions:** OQ-46, OQ-51, OQ-107, OQ-126 in
[`../open-questions.md`](../open-questions.md).
