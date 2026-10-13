# Buildings — every building, its job, and how high it goes

> **Scope.** The **content** of the city: every building the player can place
> or repair, what it does, what unlocks it, how many the city may own, and the
> level it reaches — with what each level adds and what gates it. The
> **system** — placement, moving, what a level costs, the Townhall as era
> gate — is [`05-city-and-districts.md`](05-city-and-districts.md);
> construction is [`06-construction.md`](06-construction.md); what workers do
> is [`04-harvest.md`](04-harvest.md).
>
> **Status.** Built: every building below is an entry of `buildings`
> (`src/sim/data/game/buildings.json`). Designed, not built: the three Wonders
> (§5, [`16-wonders.md`](16-wonders.md)).

## 1. Reading the tables

- **Count cap** is by Townhall level, TH1 / TH2 / TH3 / TH4 unless stated
  (`maxCountPerTownhallLevel`; a single number holds at every level).
- **Gate** on a level is what must be true to *start* that upgrade: a Townhall
  level (`requiredTownhallLevelPerLevel`), a technology, or both. Level 1 is
  the build; its gate is the unlock technology.
- **Technologies say what they open.** Every unlock and every level gate below
  is a technology's `unlocks` entry in `?dev=data#tree`, derived onto the
  building ([`tech-tree.md`](tech-tree.md)). *c3* is the Kingdom tree's
  chapter 3.
- **The tables stop at level 5.** Levels 6 to 10 are written once, in §4.11.
- **A cost shown is the first instance's.** A later one multiplies it
  ([`05-city-and-districts.md`](05-city-and-districts.md) §3.1).
- **Precious materials** (Starmetal, Heartwood, Moonglass) in a price are
  asked only once the Watchtower stands
  ([`05-city-and-districts.md`](05-city-and-districts.md) §3.2).
- Every building reveals its own ground and discovers 2 around it (the four
  halls, the Infirmary and the War Camp 1, the Watchtower 8); only the
  Townhall reveals a ring (§3). Decorations, Shrines and crop plots have no
  fog ring.
- Every building is movable, free and instantly, except the Townhall and the
  Watchtower.
- **The Build menu's tab** is the building's `buildTab`: Economy, Military or
  Decoration.

## 2. The city at a glance

| Building | Tab | Footprint | Unlock | Count cap | Max level | Job |
|---|---|---|---|---|---|---|
| **Townhall** | — | 2×2 | — | 1 | **10** | the era gate; trains villagers; makes Gold of its own into its store (10 a minute at L1); the map's origin |
| **Housing** | Economy | 1×1 | — | 2 / 4 / 6 / 9 → 21 | **10** | houses residents, who pay Gold — more of it at every level |
| **Crop plot** (`FarmLands`) | Economy | 1×1 | Agriculture (c2) | 6 / 6 / 12 / 16 → 28 | **1** | a plantable: plants a Crops cell, no builder ([`27-plantables.md`](27-plantables.md)) |
| **Farm** | Economy | 1×1 | Farming (c2) | 1 / 1 / 2 / 3 → 5 | **10** | crew works crop plots in reach |
| **Sawmill** | Economy | 1×1 | Saws (c2) | 1 / 2 / 3 / 4 → 6 | **10** | crew works forests in reach |
| **Quarry** | Economy | 1×1 | Masonry (c2) | 1 / 2 / 3 / 4 → 6 | **10** | crew works mountains in reach — rock and metal |
| **Docks** | Economy | 2×1 pier | Fishing (c3) | 1 / 2 / 3 / 4 → 6 | **10** | boats work shoals in reach |
| **Sanctum** | Economy | 2×2 | Consecration (c2) | 1 (+1 with Second Sanctum, c7) | **10** | Mana capacity and regeneration |
| **Tavern** | Economy | 2×1 | Hospitality (c2) | 1 | **5** (L2–5 by the Sagas) | hosts the banner; opens the Heroes tab and the Sagas; +10% Hero XP a level ([`22-progression.md`](22-progression.md) §6) |
| **Carpenter** | Economy | 2×2 | Joinery (c4) | 1 at TH4, 2 at TH8 | **10** | crew works Wood into Planks |
| **Mason's Yard** | Economy | 2×2 | Stone Dressing (c4) | 1 at TH4, 2 at TH8 | **10** | crew dresses Stone into Cut Stone |
| **Smelter** | Economy | 2×2 | Mining (c3) | 1 at TH4, 2 at TH8 | **10** | crew smelts ore into Iron |
| **Rune Carver** | Economy | 2×2 | Attunement II (c5) | 1 at TH4, 2 at TH8 | **10** | crew pours Mana into cut stone: Runestone |
| **Barracks** | Military | 2×2 | Warrior (c2) | 1 | **10** | army cap; trains Warriors |
| **Spear Hall** | Military | 2×2 | Spears (c4) | 1 | **10** | army cap; trains Lancers |
| **Shooting Grounds** | Military | 2×2 | Archery (c3) | 1 | **10** | army cap; trains Archers |
| **Stables** | Military | 2×2 | Cavalry (c5) | 1 | **10** | army cap; trains Cavalry |
| **Infirmary** | Military | 2×2 | Infirmary (c3) | 1 | **10** | beds for the wounded (§4.9) |
| **War Camp** | Military | 2×2 | Muster (the Atlas) | 1 | **5** | army slots on the world board, 1 a level ([`19-world-map.md`](19-world-map.md) §4) |
| **Flower patch** | Decoration | 1×1 | Village Pride (c2) | 3 at TH2 → 10 | **1** | supplies 1 Harmony |
| **Resting nook** | Decoration | 1×1 | Village Pride (c2) | 2 at TH2 → 10 | **1** | supplies 1 Harmony |
| **Lantern corner** | Decoration | 1×1 | Village Pride (c2) | 2 at TH2 → 10 | **1** | supplies 1 Harmony |
| **Topiary garden** | Decoration | 1×1 | Civic Pride (c3) | 2 at TH3 → 9 | **1** | supplies 1 Harmony |
| **Banner green** | Decoration | 1×1 | Civic Pride (c3) | 1 at TH3 → 8 | **1** | supplies 1 Harmony |
| **Bird garden** | Decoration | 1×1 | Civic Pride (c3) | 2 at TH3 → 9 | **1** | supplies 2 Harmony |
| **Garden** | Decoration | 1×1 | Gardening (c5) | 4 at TH5 → 14 | **1** | supplies 4 Harmony |
| **Well** | Decoration | 1×1 | Sculpture (c6) | 2 at TH6 → 10 | **1** | supplies 6 Harmony |
| **Orchard** | Decoration | 2×1 | Gardening (c5) | 1 at TH6 → 5 | **1** | supplies 12 Harmony |
| **Statue** | Decoration | 1×1 | Sculpture (c6) | 1 at TH7 → 4 | **1** | supplies 10 Harmony |
| **Plaza** | Decoration | 2×2 | Paving (c8) | 1 at TH8 → 3 | **1** | supplies 30 Harmony |
| **Shrine** | Decoration | 1×1 | the Thorned Shrine's ruin; then Sacred Masonry (c4) | 5 | **1** | holds and wakes one city relic — no Harmony, no Mana of its own ([`09-relics.md`](09-relics.md)) |
| **Watchtower** | — | 1×1 | its ruin, with the Watchtower's lens | 1 | **1** | sees 8 rings round it, +10 max Mana; opens the world door, the Atlas and precious prices ([`22-progression.md`](22-progression.md) §5) |
| **Wonders** ×3 *(designed)* | — | large | Townhall final level | 1 each | **none** | one stat, raised without end |

## 3. The Townhall

- The Townhall level is the era: it gates every count cap and every level gate
  in the tables below ([`05-city-and-districts.md`](05-city-and-districts.md) §1).
- Trains **villagers** in a queue: 20 s for the first and ×1.07 for each
  villager already in town or queued; Food cost `5, 10, 20, 40, 70, 110,
  160, 230, 320, 440, 600, 800, 1000` then ×1.1
  ([`03-economy.md`](03-economy.md) §4). Its own levels ask for villagers
  ([`05-city-and-districts.md`](05-city-and-districts.md) §1).
- Is the map's origin: fog price and build time are measured from it. It
  seeds the fog (reveal 1, then 3 from level 2; discover 2).
- Makes Gold of its own into its store — 10 a minute at level 1 to 5,400 at
  10 (`goldPerMinutePerLevel`) — which a raid never takes.
- Does not produce Mana, does not raise the army cap, cannot be moved.

### 3.1 The ladder to 10

- **Every level is gated by the tree**: the finale of chapter *n* opens
  Townhall *n + 1* ([`tech-tree.md`](tech-tree.md)).

| Reaching | Technology | Gold + Wood | Goods | Precious | Villagers | Wait |
|---|---|---|---|---|---|---|
| 2 | `Forestry` (c1) | 99 + 66 | — | — | 3 | 30 s |
| 3 | `Bureaucracy` (c2) | 6,000 + 330 | — | — | 5 | 2 min |
| 4 | `Magistracy` (c3) | 31,000 + 1,700 | — | 2 Starmetal | 12 | 8 min |
| 5 | `Charter` (c4) | 170,000 + 9,300 | 2 Planks · 2 Cut Stone | 5 Heartwood | 20 | 32 min |
| 6 | `Exchequer` (c5) | 380,000 + 21,000 | 4 Planks · 4 Cut Stone | — | 30 | 6 h |
| 7 | `Chancery` (c6) | 850,000 + 47,000 | 6 Planks · 6 Cut Stone · 2 Iron | — | 40 | 12 h |
| 8 | `Dominion` (c7) | 1.8M + 100,000 | 10 · 10 · 6 Iron | 10 of each | 50 | 24 h |
| 9 | `Sovereignty` (c8) | 4M + 220,000 | 14 · 14 · 10 Iron · 2 Runestone | 20 of each | 60 | 48 h |
| 10 | `Golden Age` (c9) | 8.3M + 460,000 | 20 · 20 · 14 Iron · 4 Runestone | 30 of each | 72 | 96 h |

- **Levels 8, 9 and 10 demand Harmony** — 10, 20, 30 in total
  ([`21-harmony.md`](21-harmony.md)).
- **The wait**: 30 s ×4 a level to level 5, then 6 h doubling a level from
  6 (`upgradeDuration*`, `city.lateUpgradeFromLevel`).
- **Pacing target** (the thirty-day harness asserts it with slack): 2 · day 1
  — 3 · day 2 — 4 · day 5 — 5 · day 7 — 6 · day 10 — 7 · day 14 — 8 · day 20
  — 9 · day 24 — 10 · day 30.

## 4. The districts

### 4.1 Housing

- Residents pay `taxes.goldPerPopulationPerMinute` = 30 Gold/min each, into
  the house's store; a tap collects it, free
  ([`03-economy.md`](03-economy.md) §3, §3.2).
- A level buys **room, rent and store**: +2 residents, +25% on what each
  resident pays (a total from level 1, `taxBonusPerLevel`), and a bigger store
  (`storageCapacityPerLevel`).
- Housing next to Housing: −1 Gold/min per neighbour; next to a decoration:
  +1 (`adjacency`).
- `Communities` (c3) adds +1 resident to every Housing.
- Build 15 Gold + 10 Wood, 20 s. Level 2: 66 Gold + 33 Wood + 11 Stone, 20 s;
  time ×1.5 per level. A repaired ruin takes 5 s.

| Level | Residents | Rent | Gate |
|---|---|---|---|
| 1 | 2 | — | — |
| 2 | 4 | +25% | `Urban Planning` (c2) |
| 3 | 6 | +50% | `Aqueducts` (c3) |
| 4 | 8 | +75% | TH3 · `Townhouses` (c4) |
| 5 | 10 | +100% | TH4 · `Terraces` (c5) |

### 4.2 The crop plot (`FarmLands`)

- A **plantable**, not a building: it plants a `Crops` feature, needs no
  builder and grows for the crop's `growSeconds` (5 s)
  ([`27-plantables.md`](27-plantables.md)). 1 Food per 8 s strike, stock 10,
  recovers in 60 s ([`04-harvest.md`](04-harvest.md) §2).
- Tapped by hand, or worked by a Farm whose area of influence covers it.
- 15 Gold + 10 Wood.

### 4.3 Farm

- Sends its crew to every crop plot inside its area of influence: **radius 1,
  3 workers, at every level** — at most 8 plots a Farm.
- Build 45 Gold + 30 Wood, 20 s. Level 2: 83 Gold + 55 Wood, 30 s; time ×1.5
  per level. A repaired ruin takes 5 s.

| Level | Work speed | Gate | Precious |
|---|---|---|---|
| 1 | ×1 | — | — |
| 2 | ×1.25 | TH2 | — |
| 3 | ×1.5 | TH3 · `Timber Framing` (c3) | — |
| 4 | ×1.75 | TH3 · `Architecture` (c4) | 2 Heartwood |
| 5 | ×2 | TH4 · `Ironmongery` (c5) | 3 Moonglass |

### 4.4 Sawmill

- Sends its crew to every forest inside its area of influence: **radius 2,
  3 workers, at every level** ([`04-harvest.md`](04-harvest.md) §2.1).
- Build 30 Gold + 20 Wood, 20 s. Level 2: 99 Gold + 66 Wood, 30 s; time ×1.5
  per level. A repaired ruin takes 5 s.

| Level | Work speed | Gate | Precious |
|---|---|---|---|
| 1 | ×1 | — | — |
| 2 | ×1.25 | TH1 | — |
| 3 | ×1.5 | TH2 · `Timber Framing` (c3) | — |
| 4 | ×1.75 | TH3 · `Architecture` (c4) | 2 Moonglass |
| 5 | ×2 | TH4 · `Ironmongery` (c5) | 3 Starmetal |

### 4.5 Quarry

- Sends its crew to every mountain inside its area of influence: bare rock
  pays Stone once `Pickaxes` is researched; an iron vein pays Stone and a gold
  mountain Gold once `Mining` is
  ([`01-map-and-fog.md`](01-map-and-fog.md) §3). **Radius 1, 3 workers, at
  every level.**
- Build 45 Gold + 30 Wood, 120 s. Level 2: 66 Gold + 44 Wood, 30 s; time ×1.5
  per level.

| Level | Work speed | Gate | Precious |
|---|---|---|---|
| 1 | ×1 | — | — |
| 2 | ×1.25 | TH2 | — |
| 3 | ×1.5 | TH3 · `Timber Framing` (c3) | — |
| 4 | ×1.75 | TH3 · `Architecture` (c4) | 2 Starmetal |
| 5 | ×2 | TH4 · `Ironmongery` (c5) | 3 Heartwood |

### 4.6 Docks

- A pier, one half on land and one on water. Its boats work every shoal inside
  its area of influence: 2 Food per 20 s strike, respawning in 90 s.
  **Radius 4, 3 boats, at every level.**
- Build 38 Gold + 25 Wood, 20 s. Level 2: 59 Gold + 39 Wood, 30 s; time ×1.5
  per level.

| Level | Work speed | Gate | Precious |
|---|---|---|---|
| 1 | ×1 | — | — |
| 2 | ×1.25 | — | — |
| 3 | ×1.5 | TH3 · `Timber Framing` (c3) | — |
| 4 | ×1.75 | TH3 · `Architecture` (c4) | 2 Heartwood |
| 5 | ×2 | TH4 · `Ironmongery` (c5) | 3 Moonglass |

### 4.7 Sanctum

- The Mana engine: each level adds capacity and regeneration
  ([`08-magic.md`](08-magic.md) §2).
- One per city; `Second Sanctum` (c7) allows a second.
- Build 9,000 Gold + 100 Stone, 90 s. Level 2: 17,000 Gold + 220 Stone, 120 s;
  time ×1.6 per level.

| Level | Capacity | Regen / h | Gate | Precious |
|---|---|---|---|---|
| 1 | +24 | +3 | — | — |
| 2 | +48 | +6 | TH2 | — |
| 3 | +72 | +9 | TH3 | — |
| 4 | +100 | +12 | TH3 · `Attunement II` (c5) | 2 Moonglass |
| 5 | +132 | +16 | TH4 · `Attunement III` (c6) | 3 Starmetal |

Levels 6–10 (`Attunement IV`, c8) continue the curve: capacity +168, +208,
+252, +300, +352 and regeneration +20, +25, +30, +36, +42 an hour
(`mana.sanctumCapPerLevel`, `sanctumPerHourPerLevel`).

### 4.8 The four military halls

- Each hall raises the **army cap** and trains its unit, queued at that hall
  ([`combat.md`](combat.md) §14). The cap is the sum over the four; all four at
  level 5 field 3,400 troops.
- **One unit, one hall:** every hall trains exactly one unit and every unit
  has exactly one hall (checked by `dataRules.ts`); the technology that
  unlocks a unit unlocks its hall.
- **A hall trains every rank of its unit its level allows**: II at level 3,
  III at 5, IV at 7, V at 9, each also behind its own technology
  ([`combat.md`](combat.md) §6).
- Two halls side by side train 10% faster (`adjacency`).

| Hall | Trains | Unlock | Build | Level 2 |
|---|---|---|---|---|
| **Barracks** | Warrior | `Warrior` (c2) | 3,600 G + 200 W, 60 s | 12,000 G + 500 W + 170 S, 90 s |
| **Spear Hall** | Lancer | `Spears` (c4) | 4,900 G + 200 W + 75 S, 120 s | 17,000 G + 660 W + 250 S, 120 s |
| **Shooting Grounds** | Archer | `Archery` (c3) | 4,900 G + 200 W + 75 S, 300 s | 17,000 G + 660 W + 250 S, 120 s |
| **Stables** | Cavalry | `Cavalry` (c5) | 8,600 G + 300 W + 180 S, 90 s | 29,000 G + 990 W + 580 S, 180 s |

Upgrades grow ×1.6 in time per level. The level ladder is the same for all
four:

| Level | Army cap | Gate | Precious |
|---|---|---|---|
| 1 | 150 | — | — |
| 2 | 250 | TH1 | — |
| 3 | 400 | TH2 | — |
| 4 | 600 | TH3 · `Warband II` (c4) | 2 of one material |
| 5 | 850 | TH3 · `Warband III` (c5) | 3 of another |

Levels 6–10 continue — 1,100, 1,400, 1,750, 2,150, 2,600 — so four halls at
ten field 10,400.

### 4.9 The Infirmary

- **Beds for the soldiers who came back hurt.** With no Infirmary built, every
  casualty of every fight is a death; with one, a tenth of them wait in its
  beds instead — more when a Field medic hero is in the party
  ([`combat.md`](combat.md) §4).
- Opened by the **`Infirmary` technology** (c3). One per city.
- **Beds per level** — 30, 50, 75, 105, 140, 180, 225, 275, 330, 400 — is the
  whole of what a level buys, and the ward's ceiling: what does not fit dies.
- Mending is **an order of any count of one troop, one wait**, in the
  Infirmary's own line, at `army.healCostShare` of the recruit price and
  `army.healTimeShare` of the recruit clock. It never competes with a hall's
  recruiting.
- Build 5,400 Gold + 200 Wood + 100 Stone, 60 s. Level 2: 18,000 Gold +
  660 Wood + 330 Stone, 120 s; time ×1.6 per level.
- Its levels have the halls' Townhall gates and no technology; levels 4 and 5
  ask 2 Moonglass and 3 Starmetal.

### 4.10 The four workshops

- Each makes one refined good from a queue its crew works; nothing is made
  without a villager assigned. Full design:
  [`17-workshops-and-goods.md`](17-workshops-and-goods.md).
- A level buys **crew and queue length** — 1 → 6 villagers, 3 → 12 slots —
  and never shortens an item's work.
- Below level 6 their only gate is the count cap by Townhall level: no
  workshop level asks for a technology, and none up to 5 for a Townhall level
  of its own. Levels 4 and 5 ask 2 and 3 of a precious material.
- Each works 10% faster beside its supplier: the Carpenter beside a Sawmill,
  the Mason's Yard and the Smelter beside a Quarry, the Rune Carver beside a
  Sanctum (`adjacency`).

| Workshop | Makes | Unlock | Build | Level 2 |
|---|---|---|---|---|
| **Carpenter** | Planks | `Joinery` (c4) | 5,400 G + 300 W, 60 s | 10,000 G + 550 W, 120 s |
| **Mason's Yard** | Cut Stone | `Stone Dressing` (c4) | 7,200 G + 250 W + 150 S, 90 s | 13,000 G + 440 W + 280 S, 180 s |
| **Smelter** | Iron | `Mining` (c3) | 12,000 G + 300 S, 120 s | 20,000 G + 550 S, 240 s |
| **Rune Carver** | Runestone | `Attunement II` (c5) | 24,000 G + 500 S, 180 s | 40,000 G + 830 S, 360 s |

Upgrades grow ×1.6 in time per level.

### 4.11 The late ladder — levels 6 to 10

Every building above that reaches level 10 climbs the same way, so it is
written once. The Townhall's own ladder is §3.1.

- **The gate is the Townhall level and a technology**: level 6 needs TH6,
  level 7 TH7, and so on to TH10; the technology for each is §6. The
  workshops and the Infirmary ask the Townhall level alone.
- **Every late level is priced in refined goods**
  ([`17-workshops-and-goods.md`](17-workshops-and-goods.md)), so no building
  reaches 10 without a workshop:

| Building | Levels 6 → 10 pay |
|---|---|
| Housing · Farm · Mason's Yard | 2 → 6 **Planks** |
| Sawmill · Docks | 3 → 7 **Planks** |
| Carpenter | 2 → 6 **Cut Stone** |
| Quarry · Smelter | 3 → 7 **Cut Stone** |
| the four halls · the Infirmary · Rune Carver | 2 → 6 **Iron** |
| Sanctum | 2, 3 **Cut Stone**, then 2, 3, 4 **Runestone** |

- **Levels 8, 9 and 10 also ask precious materials** — each of Starmetal,
  Heartwood and Moonglass: 2 · 4 · 6 for the producers and the workshops,
  4 · 8 · 12 for the halls, the Infirmary and the Sanctum. Housing asks none.
- **Currencies grow about ×2.2 a level** from level 6
  ([`05-city-and-districts.md`](05-city-and-districts.md) §3).
- **The wait is 2 h at level 6 and ×1.7 a level after it** — about 17 h at
  level 10. It is a timer, so it resolves in full during an absence.
- **What the level buys**, by building:

| Building | Levels 6–10 add |
|---|---|
| Housing | +2 residents and **+25% rent** a level, to 20 residents at +225% |
| Sawmill · Quarry · Farm · Docks | **+1 unit a delivery and a faster swing**, ×2.2 at 6 to ×3 at 10 |
| the four military halls | army cap in troops, to 2,600 at ten ([`combat.md`](combat.md) §14) |
| the Infirmary | beds for the wounded, to 400 at ten |
| Sanctum | the Mana curve, to 352 held and 42 an hour |
| the four workshops | crew and queue as §4.10 |

- **Levels 8, 9 and 10 also demand Harmony** — 2, 4 and 6 in total — which
  the decorations supply ([`21-harmony.md`](21-harmony.md)).

### 4.12 The decorations

One level, no crew, no tap, no fog ring; movable. Each supplies Harmony and
does nothing else. A house beside one collects +1 Gold a minute
(`adjacency`, [`21-harmony.md`](21-harmony.md) §6).

- **The village's six small pieces** — Flower patch, Resting nook, Lantern
  corner, Topiary garden, Banner green, Bird garden, each a little scene that
  fills its plot — open at Townhall 2 and 3 and cost Gold and one raw
  currency (20 Gold + 10 Wood to 60 Gold + 15 Stone).
- **The late five** — Garden to Plaza — open from Townhall 5; every piece past
  the Garden is also priced in a refined good, paid when the build is queued.
- The count cap per piece is its Townhall gate and its ceiling in one; the
  piece is discovered by a card in the tree. The table is
  [`21-harmony.md`](21-harmony.md) §2.

### 4.13 The Shrine

- **Holds one city relic** and wakes it, in its aura, for a window opened with
  Mana ([`09-relics.md`](09-relics.md)). No Harmony, no Mana of its own, one
  level.
- **The ladder** (`relics` › `shrines`, `commands.ts` `shrineBuild`):
  1. the **Thorned Shrine**, an abandoned building on the Orcs' ground,
     repaired first ([`01-map-and-fog.md`](01-map-and-fog.md) §6.3);
  2. one built for materials once `Sacred Masonry` (c4) is researched — its
     level-1 cost of 2,000 Gold at ordinal 2, ×30 by its instance growth;
  3. three more for Gems: 3,000 · 5,000 · 8,000.
- Build wait 10 min. Count cap 5 at every Townhall level.

### 4.14 The Watchtower

- An abandoned building only (`buildable: false`), 5 rings north of the
  Townhall. Its repair asks **the Watchtower's lens** from the Bag, which the
  Orcs' claim hands over, plus 200 Gold + 100 Wood and one minute
  ([`01-map-and-fog.md`](01-map-and-fog.md) §6.3).
- Standing, it discovers 8 rings round it, adds a landmark's +10 max Mana and
  Knowledge lump, opens the world door and the Atlas, and lets prices ask for
  precious materials ([`22-progression.md`](22-progression.md) §5).

### 4.15 The War Camp

- **Army slots on the world board**: 1 a level, to 5
  ([`19-world-map.md`](19-world-map.md) §4).
- Opened by `Muster` in the Atlas. One per city.
- Build 31,000 Gold + 1,000 Wood + 750 Stone, 60 s. Levels 2–5 need TH3, TH4,
  TH6, TH8; levels 4 and 5 ask 2 Heartwood and 3 Moonglass.

## 5. Wonders — designed, not built

Full design: [`16-wonders.md`](16-wonders.md).

- Three, one of each. A Wonder raises one existing stat and its level ladder
  has no top.
- Houses nobody, employs nobody, has no area of influence; a large footprint;
  movable.
- Gate: the Townhall's final level. A level is instant on payment; the cost is
  an exponential Gold curve (**OQ-58**).

| Wonder | Stat |
|---|---|
| **The Everspring** | `cellRecovery` — the ground regrows faster |
| **The Astral Spire** | `manaRegen` — more Mana per hour |
| **The Bell of Toil** | `workerYield` — the crew strikes harder |

## 6. The technology on each level

A level is bought with its technology, its Townhall level and its goods
(§4.11). The technology is authored **on the technology**, not here: a card
in `?dev=data#tree` says `unlocks: [{ districtLevel: { id: 'Townhall', level: 4 } }]`
and `DISTRICTS.Townhall.requiredTechPerLevel` is derived from it
([`../tech-tree-editor.md`](../tech-tree-editor.md) §3).

| Building | Levels and their technology |
|---|---|
| Townhall | 2 `Forestry` · 3 `Bureaucracy` · 4 `Magistracy` · 5 `Charter` · 6 `Exchequer` · 7 `Chancery` · 8 `Dominion` · 9 `Sovereignty` · 10 `Golden Age` |
| Housing | 2 `Urban Planning` · 3 `Aqueducts` · 4 `Townhouses` · 5 `Terraces` · 6 `Manors` · 7 `Mansions` · 8 `Sewers` · 9–10 `Grand Avenues` |
| Farm · Sawmill · Quarry · Docks | 3 `Timber Framing` · 4 `Architecture` · 5 `Ironmongery` · 6 `Waterwheels` · 7 `Windmills` · 8 `Hydraulics` · 9–10 `Mechanics` |
| the four halls | 4 `Warband II` · 5 `Warband III` · 6 `Fortifications` · 7 `Bastions` · 8 `Citadels` · 9–10 `Warlords` |
| Sanctum | 4 `Attunement II` · 5 `Attunement III` · 6–10 `Attunement IV` |
| Tavern | 2 `Common Room` · 3 `Guest Rooms` · 4 `Great Hall` · 5 `Minstrels' Gallery` (the Sagas); Townhall 2 · 3 · 4 · 5 |
| the four workshops · the Infirmary · the War Camp | none — their unlock technology is the only one |

## 7. Dials, in the order to reach for them

| Dial | Where |
|---|---|
| A building's max level | `buildings.maxLevel` |
| Count caps per Townhall level | `buildings.maxCountPerTownhallLevel` |
| Per-level gates | `buildings.requiredTownhallLevelPerLevel`; a technology that gates a level says so in `?dev=data#tree` |
| The unlock technology | the card's `unlocks` in `?dev=data#tree` — derived onto `requiredTech` |
| What every level costs, build included — currencies, goods and precious materials | `buildings` › `costPerLevel` — [`05-city-and-districts.md`](05-city-and-districts.md) §3 |
| How much dearer a later instance is | `buildings.instanceLinearGrowth`, `instanceExponentialGrowth` — [`05-city-and-districts.md`](05-city-and-districts.md) §3.1 |
| Build and upgrade times | `buildings.buildDuration*`, `upgradeDuration*` |
| The late half of the wait | `buildings.upgradeDurationLateSeconds`, `upgradeDurationLateLevelGrowth`, and `city.lateUpgradeFromLevel` for where it starts |
| What a piece supplies, and what a level demands | `buildings.harmonySupply`, `harmonyCostPerLevel` — [`21-harmony.md`](21-harmony.md) |
| Residents, workers, radius, army cap, beds, army slots per level | `buildings.populationCapacityPerLevel`, `maxWorkersPerLevel`, `influenceRadiusPerLevel`, `armyCapPerLevel`, `bedsPerLevel`, `armySlotsPerLevel` |
| Rent bonus and store per level | `buildings.taxBonusPerLevel`, `storageCapacityPerLevel` |
| What a late level adds to a haul, and to the swing | `buildings.extraUnitsPerDeliveryPerLevel`, `strikeSpeedPerLevel` |
| Which good a workshop makes, and its queue per level | `buildings.produces`, `queueLengthPerLevel` |
| The Tavern's Hero XP bonus | `buildings.heroXpBonusPerLevel` |
| Sanctum capacity and regen per level | `mana.sanctumCapPerLevel`, `mana.sanctumPerHourPerLevel` |
| A second Sanctum | the card's `unlocks` in `?dev=data#tree` — derived onto `extraCountTech` |
| How the Shrines after the ruin are paid | `relics` › `shrines.materialBuilds`, `premiumGems` |
| What a ruin is missing, and how long its repair takes | `buildings.repairItem`, `repairDurationSeconds` |
| Which buildings sit together well | `adjacency` |

## 8. Deliberately not in this design

- A Mine. Metal is a mountain the Quarry works
  ([`01-map-and-fog.md`](01-map-and-fog.md) §3).
- A library, scholar or other Knowledge building
  ([`07-research.md`](07-research.md) §10).
- Mana production or army cap from the Townhall level.
- A building with more than one job. A decoration has exactly one — the
  Harmony it supplies ([`21-harmony.md`](21-harmony.md)) — and no level.
- Demolishing a building, or cancelling a build.

**Open questions:** OQ-46, OQ-57, OQ-58.
