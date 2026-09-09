# Buildings — every building, its job, and how high it goes

> **Scope.** The **content** of the city: every building the player can place,
> what it does, what unlocks it, how many the city may own, and the level it
> reaches — with what each level adds and what gates it. The **system** —
> placement, moving, cost curves, the Townhall as era gate — is
> [`05-city-and-districts.md`](05-city-and-districts.md); construction is
> [`06-construction.md`](06-construction.md); what workers do is
> [`04-harvest.md`](04-harvest.md).
>
> **Status.** Built: every district below is a `Districts` row in the
> workbook — the twelve of the province economy, the Infirmary (§4.9), the
> four workshops (§4.10), whose count cap opens at Townhall 5, and the six
> decorations (§4.12). Designed, not built: Townhall 5, and the three Wonders
> (§5, [`16-wonders.md`](16-wonders.md)).

## 1. Reading the tables

- **Count cap** is by Townhall level, TH1 / TH2 / TH3 / TH4 — the workshops,
  which reach level 10, are authored as far as TH10.
- **Gate** on a level is what must be true to *start* that upgrade: a Townhall
  level, a technology, or both — and from level 6 a price in refined goods
  (§4.11). Level 1 is the build; its gate is the unlock technology.
- **The tables below stop at level 5.** Every building that goes on to 10 has
  the same late ladder, and it is written once, in §4.11.
- Costs are the base of the curve; the curves are
  [`05-city-and-districts.md`](05-city-and-districts.md) §3.
- Every building has a fog ring: reveal 1, discover 2 (the four halls discover
  1).
- Every building is movable, free and instantly, except the Townhall.

## 2. The city at a glance

| Building | Footprint | Unlock | Count cap | Max level | Job |
|---|---|---|---|---|---|
| **Townhall** | 2×2 | — | 1 | **10** | the era gate; trains villagers; the map's origin |
| **Housing** | 1×1 | — | 2 / 4 / 6 / 9 | **10** | houses residents, who pay Gold |
| **FarmLands** (crop plot) | 1×1 | Agriculture | 6 / 6 / 12 / 16 | **1** | a Food cell the player builds |
| **Farm** | 1×1 | Agriculture | 1 / 1 / 2 / 3 | **10** | crew works crop plots in reach |
| **Sawmill** | 1×1 | Saws | 1 / 2 / 3 / 4 | **10** | crew works forests in reach |
| **Quarry** | 1×1 | Masonry | 1 / 2 / 3 / 4 | **10** | crew works mountains in reach — rock and metal |
| **Docks** | 2×1 pier | Fishing | 1 / 2 / 3 / 4 | **10** | boats work shoals in reach |
| **Sanctum** | 1×1 | Consecration | 1 (+1 with `Second Sanctum`) | **10** | Mana capacity and regeneration |
| **Barracks** | 1×1 | Warrior | 1 | **10** | army cap; trains Warrior, Lancer, Archer |
| **Spear Hall** | 1×1 | Spears | 1 | **10** | army cap; trains Lancer |
| **Shooting Grounds** | 1×1 | Archery | 1 | **10** | army cap; trains Archer |
| **Stables** | 1×1 | Cavalry | 1 | **10** | army cap; trains Cavalry |
| **Carpenter** | 1×1 | Engineering | 1 at TH4, 2 at TH8 | **10** | crew works Wood into Planks |
| **Mason's Yard** | 1×1 | Engineering | 1 at TH4, 2 at TH8 | **10** | crew dresses Stone into blocks |
| **Smelter** | 1×1 | Mining | 1 at TH4, 2 at TH8 | **10** | crew smelts ore and Gold into Iron |
| **Rune Carver** | 1×1 | Attunement II | 1 at TH4, 2 at TH8 | **10** | crew pours Mana into cut stone |
| **Garden** | 1×1 | Gardening | 4 at TH5 → 14 | **1** | supplies 4 Harmony |
| **Well** | 1×1 | Sculpture | 2 at TH6 → 10 | **1** | supplies 6 Harmony |
| **Orchard** | 2×1 | Gardening | 1 at TH6 → 5 | **1** | supplies 12 Harmony |
| **Statue** | 1×1 | Sculpture | 1 at TH7 → 4 | **1** | supplies 10 Harmony |
| **Plaza** | 2×2 | Paving | 1 at TH8 → 3 | **1** | supplies 30 Harmony |
| **Shrine** | 2×2 | Sacred Grounds | 1 at TH9 → 2 | **1** | supplies 40 Harmony |
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
| 3 | `Bureaucracy` (Civics era 2) | ×3.9 per level | ×4 per level |
| 4 | `Magistracy` (Civics era 3) | | |

### 3.1 The ladder to 10

- **Levels 2–4 are gated by the tree**: 3 by `Bureaucracy` (Civics era 2), 4
  by `Magistracy` (Civics era 3). **No level past 4 asks for a technology.**
- **Levels 5–10 are priced in refined goods**, from one level before every
  other building is (the workshops open at Townhall 4 so a good exists first):

| Reaching | Planks | Cut Stone | Iron | Runestone |
|---|---|---|---|---|
| 5 | 2 | 2 | | |
| 6 | 4 | 4 | | |
| 7 | 6 | 6 | 2 | |
| 8 | 10 | 10 | 6 | |
| 9 | 14 | 14 | 10 | 2 |
| 10 | 20 | 20 | 14 | 4 |

- **Levels 8, 9 and 10 demand Harmony** — 10, 20, 30 in total
  ([`18-harmony.md`](18-harmony.md)).
- **The wait doubles a level from 6**: 6 h · 12 h · 24 h · 48 h · 96 h, twice
  and more a district's, since the Townhall is the clock every other ladder
  hangs from. Currencies grow ×1.7 a level from 6, continuous with the early
  curve.
- **Pacing** (the design's target, days orientative — the thirty-day harness
  asserts it with slack): 2 · day 1 — 3 · day 2 — 4 · day 5 — 5 · day 7 —
  6 · day 10 — 7 · day 14 — 8 · day 20 — 9 · day 24 — 10 · day 30. Measured
  2026-09-08: 2 · 3 · 7 · 9 · 9 · 11 · 14 · 21 · 25.

## 4. The districts

### 4.1 Housing

- Residents pay `taxes.goldPerPopulationPerMinute` = 30 Gold/min each; a tap
  pulls 10 s of the house's rent forward ([`03-economy.md`](03-economy.md)
  §3).
- Housing next to Housing: −1 Gold/min per neighbour.
- `Communities` (Civics era 2) adds +1 resident to every Housing.
- Build 10 Wood, 20 s. Upgrade 30 Wood + 10 Stone, 20 s, ×1.5 per level.
- Levels 6–10 add two residents each, to 20 (§4.11).

| Level | Residents | Gate |
|---|---|---|
| 1 | 2 | — |
| 2 | 4 | `Urban Planning` |
| 3 | 6 | `Aqueducts` |
| 4 | 8 | TH3 |
| 5 | 10 | TH4 |

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
| 3 | 7 | 2 | TH3 |
| 4 | 9 | 3 | TH3 |
| 5 | 11 | 3 | TH4 |

### 4.4 Sawmill

- Sends its crew to every forest inside its area of influence.
- Build 20 Wood, 20 s. Upgrade 60 Wood, 30 s, ×2.5 per level.

| Level | Workers | Radius | Gate |
|---|---|---|---|
| 1 | 3 | 2 | — |
| 2 | 5 | 3 | TH1 |
| 3 | 7 | 4 | TH2 · `Engineering` |
| 4 | 9 | 4 | TH3 · `Architecture` |
| 5 | 11 | 5 | TH4 |

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
| 3 | 7 | 4 | TH3 · `Architecture` |
| 4 | 9 | 4 | TH3 |
| 5 | 11 | 5 | TH4 |

### 4.6 Docks

- A pier, one half on land and one on water. Its boats work every shoal inside
  its area of influence: 2 Food per 20 s strike, respawning in 90 s.
- Build 25 Wood, 20 s. Upgrade 35 Wood, 30 s, ×1.5 per level.

| Level | Workers | Radius | Gate |
|---|---|---|---|
| 1 | 3 | 4 | — |
| 2 | 5 | 6 | `Shipbuilding` |
| 3 | 7 | 6 | TH3 |
| 4 | 9 | 7 | TH3 |
| 5 | 11 | 7 | TH4 |

### 4.7 Sanctum

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

Levels 6–10 continue the curve: capacity +168, +208, +252, +300, +352 and
regeneration +20, +25, +30, +36, +42 an hour.

### 4.8 The four military halls

- Each hall raises the **army cap** and trains its units, queued at that hall
  ([`combat.md`](combat.md) §14). The cap is the sum over the four; all four at
  level 5 field 3,400 troops.
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

Levels 6–10 add eight each — 36, 44, 52, 60, 68 — so four halls at ten field
272.

### 4.9 The Infirmary

- **Beds for the soldiers who came back hurt.** With no Infirmary built, every
  casualty of every fight is a death; with one, a tenth of them wait in its
  beds instead — more once `Field Medicine` is researched or a medic hero
  walks the field ([`combat.md`](combat.md) §4).
- Opened by the **`Infirmary` technology in Civics**. One per city.
- **Beds per level** — 30, 50, 75, 105, 140, 180, 225, 275, 330, 400 — is the
  whole of what a level buys, and the ward's ceiling: what does not fit dies.
- Mending is **one order and one wait** for a whole ward of one type, on the
  Infirmary's own bench, at `army.heal_cost_share` of the recruit price and
  `army.heal_time_share` of the recruit clock. It never competes with a hall's
  recruiting.
- 1×1, 80 Wood + 40 Stone to build.

### 4.10 The four workshops

- Each makes one refined good from a queue its crew works; nothing is made
  without a villager assigned. Full design:
  [`17-workshops-and-goods.md`](17-workshops-and-goods.md).
- A level buys **crew and queue length** — 1 → 6 villagers, 3 → 12 slots —
  and never shortens an item's work.
- Their only gate is the count cap by Townhall level: no workshop level asks
  for a technology or a Townhall level of its own.

| Workshop | Makes | Unlock | Build | Upgrade base |
|---|---|---|---|---|
| **Carpenter** | Planks | `Engineering` | 120 W, 60 s | 200 W, 120 s |
| **Mason's Yard** | Cut Stone | `Engineering` | 100 W + 60 S, 90 s | 160 W + 100 S, 180 s |
| **Smelter** | Iron | `Mining` | 400 G + 120 S, 120 s | 600 G + 200 S, 240 s |
| **Rune Carver** | Runestone | `Attunement II` | 800 G + 200 S, 180 s | 1200 G + 300 S, 360 s |

Upgrades grow ×1.6 in cost and ×1.6 in time per level.

### 4.11 The late ladder — levels 6 to 10

Every building above that reaches level 10 climbs the same way, so it is
written once. The Townhall's own ladder is §3.

- **The gate is the Townhall, and only the Townhall**: level 6 needs TH6,
  level 7 TH7, and so on to TH10. **No technology gates any late level** — the
  tomes keep eras 1–3 and the sealed era 4 as the research endgame, and the
  ladder is decoupled from them past the levels above.
- **Every late level is also priced in refined goods**
  ([`17-workshops-and-goods.md`](17-workshops-and-goods.md)), so no building
  reaches 10 without a workshop:

| Building | Levels 6 → 10 pay |
|---|---|
| Housing · Farm · Mason's Yard | 2 → 6 **Planks** |
| Sawmill · Docks | 3 → 7 **Planks** |
| Carpenter | 2 → 6 **Cut Stone** |
| Quarry · Smelter | 3 → 7 **Cut Stone** |
| the four halls · Rune Carver | 2 → 6 **Iron** |
| Sanctum | 2, 3 **Cut Stone**, then 2, 3, 4 **Runestone** |

- **Currencies grow ×1.7 a level** from level 6, on top of what the row's own
  curve reached at 5 ([`05-city-and-districts.md`](05-city-and-districts.md)
  §3).
- **The wait is 2 h at level 6 and ×1.7 a level after it** — about 17 h at
  level 10. It is a timer, so it resolves in the uncapped tail of an absence.
- **What the level buys**, by building:

| Building | Levels 6–10 add |
|---|---|
| Housing | +2 residents a level, to 20 |
| Sawmill · Quarry · Farm · Docks | **+1 unit a delivery and a 10% faster swing a level** — crew and reach stop growing at 5, because the plot has more cells than a crew can work |
| the four military halls | army cap in TROOPS, 150 at level 1 to 2,600 at ten ([`combat.md`](combat.md) §14) |
| the Infirmary | beds for the wounded, 30 at level 1 to 400 at ten |
| Sanctum | the Mana curve, to 352 held and 42 an hour |
| the four workshops | crew and queue as §4.10 |

- **Levels 8, 9 and 10 also demand Harmony** — 2, 4 and 6 in total — which
  the decorations supply ([`18-harmony.md`](18-harmony.md)).

### 4.12 The six decorations

One level, no crew, no tap, no fog ring; movable. Each supplies Harmony and
does nothing else, and every piece past the Garden is priced in a refined
good, paid when the build is queued. The count cap per piece is its Townhall
gate and its ceiling in one; the piece is discovered by a Civics era-3 card.
The table is [`18-harmony.md`](18-harmony.md) §2.

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

## 6. The last technology on each ladder

Research owns the early half of every ladder and nothing above it: past these
levels a building is bought with a Townhall level and goods (§4.11).

**Where these are authored.** On the TECHNOLOGY, not here: a card in `?dev=tree` says `unlocks: [{ districtLevel: { id: 'Townhall', level: 4 } }]` and `DISTRICTS.Townhall.requiredTechPerLevel` is derived from it ([`../tech-tree-editor.md`](../tech-tree-editor.md) §3).

| Building | Last tech-gated level |
|---|---|
| Townhall 4 | `Magistracy` (Civics era 3) |
| Housing 3 | `Aqueducts` (Civics era 3) |
| Sawmill 4 | TH3 · `Architecture` |
| Quarry 3 | TH3 · `Architecture` |
| Farm 2 | TH2 · `Farming` |
| Docks 2 | `Shipbuilding` (Magic era 3) |
| Sanctum 5 | TH4 · `Attunement III` (Magic era 3) |
| the four halls 5 | TH3 · `Warband III` (Warfare era 3) |
| the four workshops · the Infirmary | none — their unlock technology is the only one |

## 7. Dials, in the order to reach for them

| Dial | Where |
|---|---|
| A building's max level | `Districts.max_level` |
| Count caps per Townhall level | `Districts.max_count_per_townhall_level` |
| Per-level gates | `Districts.required_townhall_level_per_level`; a technology that gates a level says so in `?dev=tree` |
| The unlock technology | the card's `unlocks` in `?dev=tree` — derived onto `requiredTech` |
| What a piece supplies, and what a level demands | `Districts.harmony_supply`, `harmony_cost_per_level` — [`18-harmony.md`](18-harmony.md) |
| What a build costs in refined goods | `Districts.build_cost_goods` |
| Residents, workers, radius, army cap, beds per level | `Districts.population_capacity_per_level`, `max_workers_per_level`, `influence_radius_per_level`, `army_cap_per_level`, `beds_per_level` |
| Which good a workshop makes, and its queue per level | `Districts.produces`, `queue_length_per_level` |
| What a level costs in refined goods | `Districts.upgrade_cost_goods_per_level` |
| Sanctum capacity and regen per level | `mana.sanctum_cap_per_level`, `mana.sanctum_per_hour_per_level` |
| A second Sanctum | `Districts.extra_count_tech` |
| Costs and times | `Districts.build_*`, `upgrade_*` — [`05-city-and-districts.md`](05-city-and-districts.md) §3 |
| The late half of both curves | `Districts.upgrade_cost_late_level_growth`, `upgrade_duration_late_seconds`, `upgrade_duration_late_level_growth`, and `city.late_upgrade_from_level` for where it starts |
| What a late level adds to a haul, and to the swing | `Districts.extra_units_per_delivery_per_level`, `strike_speed_per_level` |

## 8. Deliberately not in this design

- A Mine. Metal is a mountain the Quarry works
  ([`01-map-and-fog.md`](01-map-and-fog.md) §3).
- A library, scholar or other Knowledge building
  ([`07-research.md`](07-research.md) §10).
- Mana production or army cap from the Townhall level.
- A building with more than one job. A decoration has exactly one — the
  Harmony it supplies ([`18-harmony.md`](18-harmony.md)) — and no level.

**Open questions:** OQ-46, OQ-57, OQ-58.
