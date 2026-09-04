# Buildings — every building, its job, and how high it goes

> **Scope.** The **content** of the city: every building the player can place,
> what it does, what unlocks it, how many the city may own, and the level it
> reaches — with what each level adds and what gates it. The **system** —
> placement, moving, cost curves, the Townhall as era gate — is
> [`05-city-and-districts.md`](05-city-and-districts.md); construction is
> [`06-construction.md`](06-construction.md); what workers do is
> [`04-harvest.md`](04-harvest.md).
>
> **Status.** Built: the fourteen districts below are `Districts` rows in the
> workbook. Designed, not built: Townhall 5, and the three Wonders (§5,
> [`16-wonders.md`](16-wonders.md)).

## 1. Reading the tables

- **Count cap** is by Townhall level, TH1 / TH2 / TH3 / TH4.
- **Gate** on a level is what must be true to *start* that upgrade: a Townhall
  level, a technology, or both. Level 1 is the build; its gate is the unlock
  technology.
- Costs are the base of the curve; the curves are
  [`05-city-and-districts.md`](05-city-and-districts.md) §3.
- Every building has a fog ring: reveal 1, discover 2 (the four halls discover
  1).
- Every building is movable, free and instantly, except the Townhall.

## 2. The city at a glance

| Building | Footprint | Unlock | Count cap | Max level | Job |
|---|---|---|---|---|---|
| **Townhall** | 2×2 | — | 1 | **4** (5 designed) | the era gate; trains villagers; the map's origin |
| **Housing** | 1×1 | — | 2 / 4 / 6 / 9 | **3** | houses residents, who pay Gold |
| **FarmLands** (crop plot) | 1×1 | Agriculture | 6 / 6 / 12 / 16 | **1** | a Food cell the player builds |
| **Farm** | 1×1 | Agriculture | 1 / 1 / 2 / 3 | **2** | crew works crop plots in reach |
| **Sawmill** | 1×1 | Saws | 1 / 2 / 3 / 4 | **4** | crew works forests in reach |
| **Quarry** | 1×1 | Masonry | 1 / 2 / 3 / 4 | **3** | crew works mountains in reach — rock and metal |
| **Docks** | 2×1 pier | Fishing | 1 / 2 / 3 / 4 | **2** | boats work shoals in reach |
| **Market** | 1×1 | Market | 1 (+1 with `Guildhalls`) | **1** | sells surplus for Gold |
| **Sanctum** | 1×1 | Consecration | 1 (+1 with `Second Sanctum`) | **5** | Mana capacity and regeneration |
| **Barracks** | 1×1 | Warrior | 1 | **5** | army cap; trains Warrior, Lancer, Archer |
| **Spear Hall** | 1×1 | Spears | 1 | **5** | army cap; trains Lancer |
| **Shooting Grounds** | 1×1 | Archery | 1 | **5** | army cap; trains Archer |
| **Stables** | 1×1 | Cavalry | 1 | **5** | army cap; trains Cavalry |
| **Wonders** ×3 *(designed)* | large | Townhall final level | 1 each | **none** | one stat, raised without end |

## 3. The Townhall

- The Townhall level is the era: it gates every count cap and every level gate
  in the tables below, and nothing else does that for all of them at once
  ([`05-city-and-districts.md`](05-city-and-districts.md) §1).
- Trains **villagers** in a queue: 20 s each, Food cost `5, 20, 100, 300,
  500, 1000` then ×1.45 ([`03-economy.md`](03-economy.md) §4). No tap
  hurries it.
- Is the map's origin: fog price, build cost and build time are measured from
  it. It seeds the fog (reveal 1, discover 2).
- Does not answer a tap, does not produce Mana, does not raise the army cap,
  cannot be moved.

| Level | Gate | Cost | Time |
|---|---|---|---|
| 1 | — | placed at game start | — |
| 2 | — | 60 Wood | 30 s |
| 3 | `Charter II` | ×3.9 per level | ×4 per level |
| 4 | `Charter III` | | |
| 5 *(designed)* | `Charter IV` (sealed) | | |

## 4. The districts

### 4.1 Housing

- Residents pay `taxes.goldPerPopulationPerMinute` = 30 Gold/min each; a tap
  pulls 10 s of the house's rent forward ([`03-economy.md`](03-economy.md)
  §3).
- Housing next to Housing: −1 Gold/min per neighbour.
- `Communities` (Civics era 2) adds +1 resident to every Housing.
- Build 10 Wood, 20 s. Upgrade 30 Wood + 10 Stone, 20 s, ×1.5 per level.

| Level | Residents | Gate |
|---|---|---|
| 1 | 2 | — |
| 2 | 4 | `Urban Planning` |
| 3 | 6 | `Aqueducts` |

### 4.2 FarmLands — the crop plot

- The plot **is** the resource: a Crops cell, 1 Food per 8 s strike, stock 10,
  recovers in 60 s ([`04-harvest.md`](04-harvest.md) §2).
- Tapped by hand, or worked by a Farm whose area of influence covers it.
- One level. Build 10 Wood, 10 s.

### 4.3 Farm

- Sends its crew to every crop plot inside its area of influence.
- Build 30 Wood, 20 s. Upgrade 50 Wood, 30 s, ×1.5 per level.

| Level | Workers | Radius | Gate |
|---|---|---|---|
| 1 | 3 | 1 | — |
| 2 | 5 | 2 | TH2 · `Farming` |

### 4.4 Sawmill

- Sends its crew to every forest inside its area of influence.
- Build 20 Wood, 20 s. Upgrade 60 Wood, 30 s, ×2.5 per level.

| Level | Workers | Radius | Gate |
|---|---|---|---|
| 1 | 3 | 2 | — |
| 2 | 5 | 3 | TH1 |
| 3 | 7 | 4 | TH2 · `Engineering` |
| 4 | 7 | 4 | TH3 · `Architecture` |

### 4.5 Quarry

- Sends its crew to every mountain inside its area of influence: bare rock
  pays Stone; an iron vein pays Stone once `Mining` is researched; a gold
  mountain pays Gold once `Deep Mining` is researched
  ([`01-map-and-fog.md`](01-map-and-fog.md) §3).
- Build 30 Wood, 20 s. Upgrade 40 Wood, 30 s, ×1.5 per level.

| Level | Workers | Radius | Gate |
|---|---|---|---|
| 1 | 3 | 2 | — |
| 2 | 5 | 3 | TH2 · `Engineering` |
| 3 | 5 | 4 | TH3 · `Architecture` |

### 4.6 Docks

- A pier, one half on land and one on water. Its boats work every shoal inside
  its area of influence: 2 Food per 20 s strike, respawning in 90 s.
- Build 25 Wood, 20 s. Upgrade 35 Wood, 30 s, ×1.5 per level.

| Level | Workers | Radius | Gate |
|---|---|---|---|
| 1 | 3 | 4 | — |
| 2 | 5 | 6 | `Shipbuilding` |

### 4.7 Market

- Sells surplus resources for Gold ([`03-economy.md`](03-economy.md) §6).
- One level. Build 40 Wood, 30 s. One per city; `Guildhalls` (Civics era 3)
  allows a second.

### 4.8 Sanctum

- The Mana engine: each level adds capacity and regeneration
  ([`08-magic.md`](08-magic.md) §2). Unlocked by `Consecration` (Magic era 1).
- One per city; `Second Sanctum` (Magic era 3) allows a second.
- Build 300 Gold + 40 Stone, 90 s. Upgrade 500 Gold + 80 Stone ×1.8 per
  level, 120 s ×1.6 per level.

| Level | Capacity | Regen / h | Gate |
|---|---|---|---|
| 1 | +24 | +3 | — |
| 2 | +48 | +6 | TH2 |
| 3 | +72 | +9 | TH3 |
| 4 | +100 | +12 | TH3 · `Attunement II` |
| 5 | +132 | +16 | TH4 · `Attunement III` |

### 4.9 The four military halls

- Each hall raises the **army cap** and trains its units, queued at that hall
  ([`11-expeditions.md`](11-expeditions.md) §6). The cap is the sum over the
  four; all four at level 5 field 112.
- Every unit is behind its own technology; the Barracks trains every foot
  soldier, the Spear Hall and Shooting Grounds are parallel lines for theirs.

| Hall | Trains | Unlock | Build | Upgrade base |
|---|---|---|---|---|
| **Barracks** | Warrior · Lancer · Archer | `Warrior` | 60 W + 20 S, 45 s | 180 W + 60 S, 90 s |
| **Spear Hall** | Lancer | `Spears` | 80 W + 30 S, 60 s | 240 W + 90 S, 120 s |
| **Shooting Grounds** | Archer | `Archery` | 80 W + 30 S, 60 s | 240 W + 90 S, 120 s |
| **Stables** | Cavalry | `Cavalry` | 120 W + 70 S, 90 s | 360 W + 210 S, 180 s |

Upgrades grow ×1.8 in cost and ×1.6 in time per level. The level ladder is the
same for all four:

| Level | Army cap | Gate |
|---|---|---|
| 1 | 6 | — |
| 2 | 10 | TH1 |
| 3 | 15 | TH2 |
| 4 | 21 | TH3 · `Warband II` — veteran units |
| 5 | 28 | TH3 · `Warband III` — champion units |

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

## 6. What gates the last level

| Building | Final level needs |
|---|---|
| Townhall 4 | `Charter III` (Civics era 3 keystone) |
| Housing 3 | `Aqueducts` (Civics era 3) |
| Sawmill 4 | TH3 · `Architecture` |
| Quarry 3 | TH3 · `Architecture` |
| Farm 2 | TH2 · `Farming` |
| Docks 2 | `Shipbuilding` (Magic era 3) |
| Sanctum 5 | TH4 · `Attunement III` (Magic era 3 keystone) |
| the four halls 5 | TH3 · `Warband III` (Warfare era 3 keystone) |

## 7. Dials, in the order to reach for them

| Dial | Where |
|---|---|
| A building's max level | `Districts.max_level` |
| Count caps per Townhall level | `Districts.max_count_per_townhall_level` |
| Per-level gates | `Districts.required_townhall_level_per_level`, `required_tech_per_level` |
| The unlock technology | `requiredTech` on the district (`src/sim/data/definitions.ts`) |
| Residents, workers, radius, army cap per level | `Districts.population_capacity_per_level`, `max_workers_per_level`, `influence_radius_per_level`, `army_cap_per_level` |
| Sanctum capacity and regen per level | `mana.sanctum_cap_per_level`, `mana.sanctum_per_hour_per_level` |
| A second Market or Sanctum | `Districts.extra_count_tech` |
| Costs and times | `Districts.build_*`, `upgrade_*` — [`05-city-and-districts.md`](05-city-and-districts.md) §3 |

## 8. Deliberately not in this design

- A Mine. Metal is a mountain the Quarry works
  ([`01-map-and-fog.md`](01-map-and-fog.md) §3).
- A library, scholar or other Knowledge building
  ([`07-research.md`](07-research.md) §10).
- Mana production or army cap from the Townhall level.
- A building with more than one job.
- Decorations.

**Open questions:** OQ-1, OQ-46, OQ-57, OQ-58.
