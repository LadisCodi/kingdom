# Buildings — every building, its job, and how high it goes

> **Scope.** The **content** of the city: every building the player can place,
> what it does, what unlocks it, how many the city may own, and the level it
> reaches — with what each level adds and what gates it. The **system** —
> placement, moving, what a level costs, the Townhall as era gate — is
> [`05-city-and-districts.md`](05-city-and-districts.md); construction is
> [`06-construction.md`](06-construction.md); what workers do is
> [`04-harvest.md`](04-harvest.md).
>
> **Status.** Built: every district below is an entry of `buildings`
> (`src/sim/data/game/buildings.json`) — among them the Infirmary (§4.9), the
> four workshops (§4.10), whose count cap opens at Townhall 4, the six
> decorations (§4.12) and the War Camp. Designed, not built: the three Wonders
> (§5, [`16-wonders.md`](16-wonders.md)).

## 1. Reading the tables

- **Count cap** is by Townhall level, TH1 / TH2 / TH3 / TH4 — the workshops,
  which reach level 10, are authored as far as TH10.
- **Gate** on a level is what must be true to *start* that upgrade: a Townhall
  level, a technology, or both — and from level 6 a price in refined goods
  (§4.11). Level 1 is the build; its gate is the unlock technology.
- **The tables below stop at level 5.** Every building that goes on to 10 has
  the same late ladder, and it is written once, in §4.11.
- **A cost shown is the first instance's.** A later one multiplies it
  ([`05-city-and-districts.md`](05-city-and-districts.md) §3.1).
- Every building reveals its own ground and discovers 2 around it (the four
  halls, the Infirmary and the War Camp 1); only the Townhall reveals a ring
  (§3). The decorations have no fog ring.
- Every building is movable, free and instantly, except the Townhall.

## 2. The city at a glance

| Building | Footprint | Unlock | Count cap | Max level | Job |
|---|---|---|---|---|---|
| **Townhall** | 2×2 | — | 1 | **10** | the era gate; trains villagers; makes Gold of its own into its store (10 a minute at L1); the map's origin |
| **Housing** | 1×1 | — | 2 / 4 / 6 / 9 | **10** | houses residents, who pay Gold — more of it at every level |
| **FarmLands** (crop plot) | 1×1 | Agriculture | 6 / 6 / 12 / 16 | — | a plantable: plants a Food cell, no building ([`27-plantables.md`](27-plantables.md)) |
| **Farm** | 1×1 | Farming | 1 / 1 / 2 / 3 | **10** | crew works crop plots in reach |
| **Sawmill** | 1×1 | Saws | 1 / 2 / 3 / 4 | **10** | crew works forests in reach |
| **Quarry** | 1×1 | Masonry | 1 / 2 / 3 / 4 | **10** | crew works mountains in reach — rock and metal |
| **Docks** | 2×1 pier | Fishing | 1 / 2 / 3 / 4 | **10** | boats work shoals in reach |
| **Sanctum** | 2×2 | Consecration | 1 (+1 with `Second Sanctum`) | **10** | Mana capacity and regeneration |
| **Tavern** | 2×1 | Hospitality | 1 | **5** (L2–5 by the Sagas) | hosts the banner; opens the Heroes tab and the Sagas; +10% Hero XP a level ([`22-progression.md`](22-progression.md) §6) |
| **Barracks** | 2×2 | Warrior | 1 | **10** | army cap; trains Warrior |
| **Spear Hall** | 2×2 | Spears | 1 | **10** | army cap; trains Lancer |
| **Shooting Grounds** | 2×2 | Archery | 1 | **10** | army cap; trains Archer |
| **Stables** | 2×2 | Cavalry | 1 | **10** | army cap; trains Cavalry |
| **Infirmary** | 2×2 | Infirmary | 1 | **10** | beds for the wounded (§4.9) |
| **War Camp** | 2×2 | Muster | 1 | **5** | army slots on the world board ([`19-world-map.md`](19-world-map.md) §4) |
| **Carpenter** | 2×2 | Joinery | 1 at TH4, 2 at TH8 | **10** | crew works Wood into Planks |
| **Mason's Yard** | 2×2 | Stone Dressing | 1 at TH4, 2 at TH8 | **10** | crew dresses Stone into blocks |
| **Smelter** | 2×2 | Mining | 1 at TH4, 2 at TH8 | **10** | crew smelts ore and Gold into Iron |
| **Rune Carver** | 2×2 | Attunement II | 1 at TH4, 2 at TH8 | **10** | crew pours Mana into cut stone |
| **Flower bed** | 1×1 | Village Pride | 3 at TH2 → 10 | **1** | supplies 1 Harmony |
| **Bench** | 1×1 | Village Pride | 2 at TH2 → 10 | **1** | supplies 1 Harmony |
| **Lantern** | 1×1 | Village Pride | 2 at TH2 → 10 | **1** | supplies 1 Harmony |
| **Topiary** | 1×1 | Civic Pride | 2 at TH3 → 9 | **1** | supplies 1 Harmony |
| **Banner** | 1×1 | Civic Pride | 1 at TH3 → 8 | **1** | supplies 1 Harmony |
| **Birdbath** | 1×1 | Civic Pride | 2 at TH3 → 9 | **1** | supplies 2 Harmony |
| **Garden** | 1×1 | Gardening | 4 at TH5 → 14 | **1** | supplies 4 Harmony |
| **Well** | 1×1 | Sculpture | 2 at TH6 → 10 | **1** | supplies 6 Harmony |
| **Orchard** | 2×1 | Gardening | 1 at TH6 → 5 | **1** | supplies 12 Harmony |
| **Statue** | 1×1 | Sculpture | 1 at TH7 → 4 | **1** | supplies 10 Harmony |
| **Plaza** | 2×2 | Paving | 1 at TH8 → 3 | **1** | supplies 30 Harmony |
| **Shrine** | 1×1 | the ruin; then Sacred Masonry — one for materials, the rest for Gems | up to 5 | **1** | holds and wakes one city relic — no Harmony, no Mana of its own; how long and how far the relic acts is the relic's level ([`09`](09-relics.md) §2.1) |
| **Watchtower** | 1×1 | its ruin, with the Watchtower's lens | 1 | **1** | sees 8 rings round it, +10 max Mana — and opens the world door and the Atlas ([`22`](22-progression.md) §5) |
| **Wonders** ×3 *(designed)* | large | Townhall final level | 1 each | **none** | one stat, raised without end |

## 3. The Townhall

- The Townhall level is the era: it gates every count cap and every level gate
  in the tables below, and nothing else does that for all of them at once
  ([`05-city-and-districts.md`](05-city-and-districts.md) §1).
- Trains **villagers** in a queue: 20 s for the first and ×1.07 for each
  villager already in town or queued; Food cost `5, 10, 20, 40, 70, 110,
  160, 230, 320, 440, 600, 800, 1000` then ×1.1 ([`03-economy.md`](03-economy.md) §4). No tap
  hurries it. Its own levels ask for villagers
  ([`05-city-and-districts.md`](05-city-and-districts.md) §1).
- Is the map's origin: fog price and build time are measured from it. It seeds the fog (reveal 1, discover 2).
- Does not answer a tap, does not produce Mana, does not raise the army cap,
  cannot be moved.

| Level | Gate | Cost | Time |
|---|---|---|---|
| 1 | — | placed at game start | — |
| 2 | `Forestry` (chapter 1) | 99 Gold + 66 Wood | 30 s |
| 3 | `Bureaucracy` (chapter 2) | 6,000 Gold + 330 Wood | ×4 per level |
| 4 | `Magistracy` (chapter 3) | | |
| 5–10 | `Charter` · `Exchequer` · `Chancery` · `Dominion` · `Sovereignty` · `Golden Age` (chapters 4–9) | | |

### 3.1 The ladder to 10

- **Every level is gated by the tree**: the finale of chapter *n* opens
  Townhall *n + 1* ([`tech-tree.md`](tech-tree.md)).
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
  ([`21-harmony.md`](21-harmony.md)).
- **The wait doubles a level from 6**: 6 h · 12 h · 24 h · 48 h · 96 h, twice
  and more a district's, since the Townhall is the clock every other ladder
  hangs from. Currencies grow about ×2.2 a level from 6
  ([`05-city-and-districts.md`](05-city-and-districts.md) §3).
- **Pacing** (the design's target, days orientative — the thirty-day harness
  asserts it with slack): 2 · day 1 — 3 · day 2 — 4 · day 5 — 5 · day 7 —
  6 · day 10 — 7 · day 14 — 8 · day 20 — 9 · day 24 — 10 · day 30. Measured
  2026-10-05, three visits a day, on the one tree: 2 · day 1 — 3 · day 2 —
  4 · day 3 — 5 · day 11 — 6 · day 19 — 7 · day 24, and 8 not inside thirty
  days. Each chapter's spine holds a level a day or two; villagers, and the
  Food they cost, gate every level from 5.

## 4. The districts

### 4.1 Housing

- Residents pay `taxes.goldPerPopulationPerMinute` = 30 Gold/min each, into
  the house's store; a tap collects it, free
  ([`03-economy.md`](03-economy.md) §3, §3.2).
- A level buys **room, rent and store**: +25% on what each resident pays, a
  total from level 1 (`buildings.taxBonusPerLevel`), and a bigger store
  (`storageCapacityPerLevel`).
- Housing next to Housing: −1 Gold/min per neighbour, flat — a level does not
  scale it.
- `Communities` (chapter 3) adds +1 resident to every Housing.
- Build 15 Gold + 10 Wood, 20 s. Level 2: 66 Gold + 33 Wood + 11 Stone, 20 s;
  time ×1.5 per level.
- Levels 6–10 add two residents and +25% rent each, to 20 residents at +225%
  (§4.11).

| Level | Residents | Rent | Gate |
|---|---|---|---|
| 1 | 2 | — | — |
| 2 | 4 | +25% | `Urban Planning` |
| 3 | 6 | +50% | `Aqueducts` |
| 4 | 8 | +75% | TH3 |
| 5 | 10 | +100% | TH4 |

### 4.2 FarmLands — the crop plot

- A **plantable**, not a building: it plants a `Crops` feature
  ([`27-plantables.md`](27-plantables.md)). 1 Food per 8 s strike, stock 10,
  recovers in 60 s ([`04-harvest.md`](04-harvest.md) §2).
- Tapped by hand, or worked by a Farm whose area of influence covers it.
- 15 Gold + 10 Wood, no builder; grows for 10 s.

### 4.3 Farm

- Sends its crew to every crop plot inside its area of influence: **radius 1,
  3 workers, at every level** — at most 8 plots a Farm.
- Build 45 Gold + 30 Wood, 20 s. Level 2: 83 Gold + 55 Wood, 30 s; time ×1.5
  per level.

| Level | Swing | Gate |
|---|---|---|
| 1 | ×1 | — |
| 2 | ×1.25 | TH2 |
| 3 | ×1.5 | TH3 |
| 4 | ×1.75 | TH3 |
| 5 | ×2 | TH4 |

### 4.4 Sawmill

- Sends its crew to every forest inside its area of influence: **radius 2,
  3 workers, at every level** — a ring further than the other producers,
  because a forest takes twice as long to grow back
  ([`04-harvest.md`](04-harvest.md) §2.1).
- Build 30 Gold + 20 Wood, 20 s. Level 2: 99 Gold + 66 Wood, 30 s; time ×1.5
  per level.

| Level | Swing | Gate |
|---|---|---|
| 1 | ×1 | — |
| 2 | ×1.25 | TH1 |
| 3 | ×1.5 | TH2 · `Timber Framing` |
| 4 | ×1.75 | TH3 · `Architecture` |
| 5 | ×2 | TH4 |

### 4.5 Quarry

- Sends its crew to every mountain inside its area of influence: bare rock
  pays Stone; an iron vein pays Stone once `Mining` is researched; a gold
  mountain pays Gold once `Mining` is researched too
  ([`01-map-and-fog.md`](01-map-and-fog.md) §3). **Radius 1, 3 workers, at
  every level.**
- Build 45 Gold + 30 Wood, 120 s. Level 2: 66 Gold + 44 Wood, 30 s; time ×1.5
  per level.

| Level | Swing | Gate |
|---|---|---|
| 1 | ×1 | — |
| 2 | ×1.25 | TH2 · `Quarry Hoists` |
| 3 | ×1.5 | TH3 · `Architecture` |
| 4 | ×1.75 | TH3 |
| 5 | ×2 | TH4 |

### 4.6 Docks

- A pier, one half on land and one on water. Its boats work every shoal inside
  its area of influence: 2 Food per 20 s strike, respawning in 90 s.
  **Radius 4, 3 boats, at every level.**
- Build 38 Gold + 25 Wood, 20 s. Level 2: 59 Gold + 39 Wood, 30 s; time ×1.5
  per level.

| Level | Swing | Gate |
|---|---|---|
| 1 | ×1 | — |
| 2 | ×1.25 | `Shipbuilding` |
| 3 | ×1.5 | TH3 |
| 4 | ×1.75 | TH3 |
| 5 | ×2 | TH4 |

### 4.7 Sanctum

- The Mana engine: each level adds capacity and regeneration
  ([`08-magic.md`](08-magic.md) §2). Unlocked by `Consecration` (chapter 2).
- One per city; `Second Sanctum` (chapter 7) allows a second.
- Build 9,000 Gold + 100 Stone, 90 s. Level 2: 17,000 Gold + 220 Stone, 120 s;
  time ×1.6 per level.

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
- **One unit, one hall:** every hall trains exactly one unit and every unit
  has exactly one hall (checked by `dataRules.ts`); the technology that
  unlocks a unit unlocks its hall.
- **A hall trains every rank of its unit its level allows**: II at level 3,
  III at 5, IV at 7, V at 9, each also behind its own technology
  ([`combat.md`](combat.md) §6).

| Hall | Trains | Unlock | Build | Level 2 |
|---|---|---|---|---|
| **Barracks** | Warrior | `Warrior` | 3,600 G + 200 W, 60 s | 12,000 G + 500 W + 170 S, 90 s |
| **Spear Hall** | Lancer | `Spears` | 4,900 G + 200 W + 75 S, 120 s | 17,000 G + 660 W + 250 S, 120 s |
| **Shooting Grounds** | Archer | `Archery` | 4,900 G + 200 W + 75 S, 300 s | 17,000 G + 660 W + 250 S, 120 s |
| **Stables** | Cavalry | `Cavalry` | 8,600 G + 300 W + 180 S, 90 s | 29,000 G + 990 W + 580 S, 180 s |

Upgrades grow ×1.6 in time per level; what each level costs is authored in its
`costPerLevel` ([`05-city-and-districts.md`](05-city-and-districts.md)
§3). The level ladder is the same for all four:

| Level | Army cap | Gate |
|---|---|---|
| 1 | 150 | — |
| 2 | 250 | TH1 |
| 3 | 400 | TH2 |
| 4 | 600 | TH3 · `Warband II` — veteran units |
| 5 | 850 | TH3 · `Warband III` — champion units |

Levels 6–10 continue — 1,100, 1,400, 1,750, 2,150, 2,600 — so four halls at
ten field 10,400.

### 4.9 The Infirmary

- **Beds for the soldiers who came back hurt.** With no Infirmary built, every
  casualty of every fight is a death; with one, a tenth of them wait in its
  beds instead — more when a medic hero walks the field
  ([`combat.md`](combat.md) §4).
- Opened by the **`Infirmary` technology** (chapter 3). One per city.
- **Beds per level** — 30, 50, 75, 105, 140, 180, 225, 275, 330, 400 — is the
  whole of what a level buys, and the ward's ceiling: what does not fit dies.
- Mending is **one order and one wait** for a whole ward of one type, on the
  Infirmary's own bench, at `army.healCostShare` of the recruit price and
  `army.healTimeShare` of the recruit clock. It never competes with a hall's
  recruiting.
- 2×2, 80 Wood + 40 Stone to build.

### 4.10 The four workshops

- Each makes one refined good from a queue its crew works; nothing is made
  without a villager assigned. Full design:
  [`17-workshops-and-goods.md`](17-workshops-and-goods.md).
- A level buys **crew and queue length** — 1 → 6 villagers, 3 → 12 slots —
  and never shortens an item's work.
- Below level 6 their only gate is the count cap by Townhall level: no
  workshop level asks for a technology, and none up to 5 for a Townhall level
  of its own.

| Workshop | Makes | Unlock | Build | Level 2 |
|---|---|---|---|---|
| **Carpenter** | Planks | `Joinery` | 5,400 G + 300 W, 60 s | 10,000 G + 550 W, 120 s |
| **Mason's Yard** | Cut Stone | `Stone Dressing` | 7,200 G + 250 W + 150 S, 90 s | 13,000 G + 440 W + 280 S, 180 s |
| **Smelter** | Iron | `Mining` | 12,000 G + 300 S, 120 s | 20,000 G + 550 S, 240 s |
| **Rune Carver** | Runestone | `Attunement II` | 24,000 G + 500 S, 180 s | 40,000 G + 830 S, 360 s |

Upgrades grow ×1.6 in time per level; what each level costs is authored in its
`costPerLevel` ([`05-city-and-districts.md`](05-city-and-districts.md)
§3).

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
| the four halls · the Infirmary · Rune Carver | 2 → 6 **Iron** |
| Sanctum | 2, 3 **Cut Stone**, then 2, 3, 4 **Runestone** |

- **Currencies grow about ×2.2 a level** from level 6
  ([`05-city-and-districts.md`](05-city-and-districts.md) §3).
- **The wait is 2 h at level 6 and ×1.7 a level after it** — about 17 h at
  level 10. It is a timer, so it resolves in full during an absence.
- **What the level buys**, by building:

| Building | Levels 6–10 add |
|---|---|
| Housing | +2 residents and **+25% rent** a level, to 20 residents at +225% |
| Sawmill · Quarry · Farm · Docks | **+1 unit a delivery and a faster swing**, ×2.2 at 6 to ×3 at 10 |
| the four military halls | army cap in TROOPS, 150 at level 1 to 2,600 at ten ([`combat.md`](combat.md) §14) |
| the Infirmary | beds for the wounded, 30 at level 1 to 400 at ten |
| Sanctum | the Mana curve, to 352 held and 42 an hour |
| the four workshops | crew and queue as §4.10 |

- **Levels 8, 9 and 10 also demand Harmony** — 2, 4 and 6 in total — which
  the decorations supply ([`21-harmony.md`](21-harmony.md)).

### 4.12 The decorations

One level, no crew, no tap, no fog ring; movable. Each supplies Harmony and
does nothing else.

- **The village's six small pieces** — Flower bed, Bench, Lantern, Topiary,
  Banner, Birdbath — open at Townhall 2 and 3 and cost Gold and a raw
  currency. Early on nothing demands Harmony, so what they pay is their
  place: a house beside one collects more Gold ([`21-harmony.md`](21-harmony.md) §6).
- **The late five** — Garden to Plaza — open from Townhall 5, and every piece
  past the Garden is priced in a refined good, paid when the build is queued. The count cap per piece is its Townhall
gate and its ceiling in one; the piece is discovered by a card in the tree.
The table is [`21-harmony.md`](21-harmony.md) §2.

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

Each chapter's first row opens that Townhall level's next Housing level, the
four producers' next level and the four halls' next level; the finale opens
the next Townhall level ([`tech-tree.md`](tech-tree.md)). A level is bought with
its technology, its Townhall level and, from 6, goods (§4.11).

**Where these are authored.** On the TECHNOLOGY, not here: a card in `?dev=data#tree` says `unlocks: [{ districtLevel: { id: 'Townhall', level: 4 } }]` and `DISTRICTS.Townhall.requiredTechPerLevel` is derived from it ([`../tech-tree-editor.md`](../tech-tree-editor.md) §3).

| Building | Levels and their technology |
|---|---|
| Townhall | 2 `Forestry` · 3 `Bureaucracy` · 4 `Magistracy` · 5 `Charter` · 6 `Exchequer` · 7 `Chancery` · 8 `Dominion` · 9 `Sovereignty` · 10 `Golden Age` |
| Housing | 2 `Urban Planning` · 3 `Aqueducts` · 4 `Townhouses` · 5 `Terraces` · 6 `Manors` · 7 `Mansions` · 8 `Sewers` · 9–10 `Grand Avenues` |
| Farm · Sawmill · Quarry · Docks | 3 `Timber Framing` · 4 `Architecture` · 5 `Ironmongery` · 6 `Waterwheels` · 7 `Windmills` · 8 `Hydraulics` · 9–10 `Mechanics` |
| the four halls | 4 `Warband II` · 5 `Warband III` · 6 `Fortifications` · 7 `Bastions` · 8 `Citadels` · 9–10 `Warlords` |
| Sanctum | 4 `Attunement II` · 5 `Attunement III`; past 5 `Attunement IV` |
| Tavern | 2–5 in the Sagas |
| the four workshops · the Infirmary | none — their unlock technology is the only one |

## 7. Dials, in the order to reach for them

| Dial | Where |
|---|---|
| A building's max level | `buildings.maxLevel` |
| Count caps per Townhall level | `buildings.maxCountPerTownhallLevel` |
| Per-level gates | `buildings.requiredTownhallLevelPerLevel`; a technology that gates a level says so in `?dev=data#tree` |
| The unlock technology | the card's `unlocks` in `?dev=data#tree` — derived onto `requiredTech` |
| What a piece supplies, and what a level demands | `buildings.harmonySupply`, `harmonyCostPerLevel` — [`21-harmony.md`](21-harmony.md) |
| What a build costs in refined goods | `buildings` › `costPerLevel`, level 1 `goods` — [`05-city-and-districts.md`](05-city-and-districts.md) §3.2 |
| Residents, workers, radius, army cap, beds per level | `buildings.populationCapacityPerLevel`, `maxWorkersPerLevel`, `influenceRadiusPerLevel`, `armyCapPerLevel`, `bedsPerLevel` |
| Which good a workshop makes, and its queue per level | `buildings.produces`, `queueLengthPerLevel` |
| What a level costs in refined goods | `buildings` › `costPerLevel`, that level's `goods` — [`05-city-and-districts.md`](05-city-and-districts.md) §3.2 |
| Sanctum capacity and regen per level | `mana.sanctumCapPerLevel`, `mana.sanctumPerHourPerLevel` |
| A second Sanctum | the card's `unlocks` in `?dev=data#tree` — derived onto `extraCountTech` |
| What every level costs, build included | `buildings` › `costPerLevel` — [`05-city-and-districts.md`](05-city-and-districts.md) §3 |
| How much dearer a later instance is | `buildings.instanceLinearGrowth`, `instanceExponentialGrowth` — [`05-city-and-districts.md`](05-city-and-districts.md) §3.1 |
| Build and upgrade times | `buildings.buildDuration*`, `upgradeDuration*` |
| The late half of the wait | `buildings.upgradeDurationLateSeconds`, `upgradeDurationLateLevelGrowth`, and `city.lateUpgradeFromLevel` for where it starts |
| What a late level adds to a haul, and to the swing | `buildings.extraUnitsPerDeliveryPerLevel`, `strikeSpeedPerLevel` |

## 8. Deliberately not in this design

- A Mine. Metal is a mountain the Quarry works
  ([`01-map-and-fog.md`](01-map-and-fog.md) §3).
- A library, scholar or other Knowledge building
  ([`07-research.md`](07-research.md) §10).
- Mana production or army cap from the Townhall level.
- A building with more than one job. A decoration has exactly one — the
  Harmony it supplies ([`21-harmony.md`](21-harmony.md)) — and no level.

**Open questions:** OQ-46, OQ-57, OQ-58.
