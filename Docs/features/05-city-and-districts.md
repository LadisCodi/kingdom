# 5 · The city — districts, placement and moving

> **Scope.** The Townhall as era gate, what a building costs, where it may
> go, and how it is moved. The building list is [`buildings.md`](buildings.md);
> construction itself is [`06-construction.md`](06-construction.md); what
> workers do is [`04-harvest.md`](04-harvest.md).
>
> **Status: built.** Every level is authored in the building's
> `costPerLevel` and priced by the building's own instance ordinal (§3).

## 1. The Townhall level is the era

- The Townhall level gates **how many of each district the city may own** and
  **how high each may level**. It is the only gate that moves all of them at
  once.
- It also **makes Gold of its own** into its own store, with nobody living in
  it: 10 Gold a minute at level 1, rising to 5,400 at 10
  (`buildings.goldPerMinutePerLevel`, [`03-economy.md`](03-economy.md) §3).
  This is the number its Level Up card shows — the count caps are gates, not
  a stat a player reads.

| | TH1 | TH2 | TH3 | TH4 |
|---|---|---|---|---|
| Target time | 0–30 min | 30 min – 2.5 h | ~3 h onward | late game |
| Housing cap | 2 | 4 | 6 | 9 |
| Sawmill / Quarry / Docks cap | 1 | 2 | 3 | 4 |
| Farm / FarmLands cap | 1 / 6 | 1 / 6 | 2 / 12 | 3 / 16 |
| Gate to the next level | 60 Wood | `Bureaucracy` | `Magistracy` | — |
| Villagers to reach it | — | 3 | 5 | 12 |
| Explores to ring | 3 | 5 | 7 | 8 |

- **A town grows when its people do.** Every level past the first asks for
  villagers on top of its technology: `buildings.requiredPopulationPerLevel`
  on the Townhall row, **3 · 5 · 12 · 20 · 30 · 40 · 50 · 60 · 72**. Total
  population, housed or not; each level asks for fewer than the houses of the
  level before can hold, so the answer is always roofs, Food and the training
  line. The card says the number and where the city stands: *Needs 12
  villagers · you have 9*.
- Villagers are priced `5, 20, 45, 100, 250, 500, 1000` Food then **×1.05** each
  ([`03-economy.md`](03-economy.md) §5), so a hundred of them is a month of
  Food rather than a lifetime.
- Pacing target: TH2 in ~25–35 min of active play; TH3 at ~2–3 h cumulative.
- It also sets **how far the fog can be paid for**: `fog.reachPerTownhallLevel`,
  in Townhall rings, 3 at level 1 to the whole province at 10
  ([`01-map-and-fog.md`](01-map-and-fog.md) §4). The Level Up card shows the
  ring beside the rent.

Three arcs run past TH3:

- **Military buildings** raise the army cap — how many troops the city may
  own — and therefore which lairs a party can take on. The cap is the sum over the four halls
  ([`combat.md`](combat.md) §14).
- **The Mana economy** — capacity from the Sanctum and from landmarks — gates
  session length ([`08-magic.md`](08-magic.md)).
- **Card albums, Fragments, Stardust and Hero XP** gate relic and hero levels,
  on a curve measured in weeks and seasons ([`09-relics.md`](09-relics.md),
  [`10-heroes.md`](10-heroes.md) §4).

## 2. The districts

- Every building is an entry of `buildings`, whole — identity, art, crew and
  every number. A new one needs no code: it is created in `?dev=data`.
- Every building, its job, its count cap and its level ladder:
  [`buildings.md`](buildings.md).
- Per-level tech gates (`requiredTechPerLevel`): entry 0 is the technology
  needed to reach level 2.
- A district card says *Research X required*; the technology's card says
  *Housing can now reach level 2*.

## 3. What a building costs

**Every level of every building is authored, one number per resource.** There
is no cost curve. The prices live in the building's `costPerLevel`, one entry
per level — the currencies in `cost` and the refined goods in `goods`, side by
side, edited in Buildings › <building> › Levels:

```
costPerLevel: [ { cost: { Wood: 20 }, goods: {} }, { cost: { Wood: 60 }, goods: {} }, … ]
```

- **Level 1 is the build.** Levels 2 and up are what reaching that level
  costs. A build price and an upgrade price are the same kind of thing, so
  they are one list of numbers, not two bases with a curve between them.
- The table prices the **first** instance of the building. Every later one
  multiplies it (§3.1).
- Distance is priced in build **time**, never in cost (§3.3).
- The ordinal multiplier applies to the currencies only. Goods are authored
  per level like everything else and are never multiplied (§3.2).
- A building has exactly as many entries as it has levels; the schema refuses a
  `costPerLevel` whose length is not `maxLevel`.
- What each level buys: [`buildings.md`](buildings.md).

### 3.1 The instance multiplier

A building is stamped with its **ordinal** when it is placed — the second
Sawmill is Sawmill #2 — and keeps it for life. That ordinal prices every level
of that building, for ever: a house built early stays the cheap house to
upgrade. Cards and menus name it, *Housing #3*, on any building whose count
cap can pass 1.

```
cost(level, N) = table[level] × M(N)
M(N)           = linear × (N − 1) + growth^(N − 1)
```

- `M(1) = 1` exactly. The table is what the first one costs, by construction.
- The two terms **take turns**. The linear term prices the early copies, where
  `growth^(N−1)` is still near 1; the exponential prices the tail, from
  wherever it overtakes `linear × (N − 1)`. Retuning one barely moves the
  other's half of the ladder, which is the point of having both.
- Rounded to **three significant figures**, per resource per level per
  ordinal — a pure function of the four, so a card and an offline replay never
  disagree.
- Two dials a building: `instanceLinearGrowth`, `instanceExponentialGrowth`.

At 2 and 1.2:

| Ordinal | #2 | #3 | #5 | #10 | #21 |
|---|---|---|---|---|---|
| Multiplier | ×3.2 | ×5.4 | ×10.1 | ×23.2 | ×78.3 |

- **The ordinal has no gaps.** Nothing is ever demolished and a build cannot be
  cancelled ([`06-construction.md`](06-construction.md) §1), so the next
  ordinal is the count plus one and stays unique without a counter of its own.
- Because the multiplier is flat next to the level ladder, **what paces the
  city is how high buildings are pushed, not how many stand**. What limits how
  many stand is `maxCountPerTownhallLevel` (§1), not the price.

### 3.2 Refined goods, in the same table and unmultiplied

- The goods sit in the same entry, under the same rule:
  the level 1 entry is what the **build** costs in goods, levels 2 and up what
  that level costs.
- **The ordinal multiplier skips them.** A recipe does not know how many of
  the thing the city owns, and a workshop makes goods one at a time: an
  ordinal multiplier would price a second workshop's worth of days into a
  single upgrade.
- A building's whole price — raw and refined, build and every level — is
  therefore one entry per level and nothing else, with no separate field for the
  build.
- A **decoration** has one level, so its goods price is its level 1 entry
  ([`21-harmony.md`](21-harmony.md) §2).

### 3.3 The wait

The wait is still a curve, and it still pivots.

```
buildDuration        = round(seconds × districtGrowth^(N−1) × distanceGrowth^d)
upgradeDuration(L)   = round(seconds × durationGrowth^(L−2))
upgradeDuration(L≥6) = lateSeconds × lateDurationGrowth^(L−6)
```

- The pivot is `city.lateUpgradeFromLevel` (6), and the late half restarts
  at its own base — 2 h for every district, 6 h for the Townhall — because a minute-long step cannot
  be compounded into a multi-day ladder without deforming the opening.
- A build's wait grows with the ordinal and with distance from the Townhall;
  neither touches the price.

## 4. Placement, and moving

- **A building goes anywhere the player has revealed.** There is no plot bound
  and no rule about where a building sits relative to another one.
- One legality check serves building and moving: a cell you may not build on
  is a cell you may not move to.
- Gates, all of them about the **ground**: it exists, it is revealed, it is
  empty of features, sites and other buildings, and it is dry — plus the count
  cap and the unlock technology.
- Terrain gates only Water ([`01-map-and-fog.md`](01-map-and-fog.md) §2). A
  farm on sand is legal.
- The **one exception** is the Docks, whose pier needs a shoreline — terrain,
  not layout.
- **Layout is guided, never policed.** Adjacency pays or charges for a
  neighbour ([`03-economy.md`](03-economy.md) §3.1), so a placement can be
  better or worse and none is illegal.
- **An abandoned building is placed by the map**, not the player: repairing
  it builds it at level 1 where it stands, at the next ordinal and without
  its unlock technology ([`01-map-and-fog.md`](01-map-and-fog.md) §6.3).

### 4.1 The placement ghost

- Draws the area of influence for the hovered cell and highlights the resource
  cells it would capture, with a count.
- Labels cells with their depot; the ground multiplies a cell's depot
  ([`04-harvest.md`](04-harvest.md) §2.2):

| Placing | Labels | Reads |
|---|---|---|
| **A crop plot** (it *is* the resource) | its own ghost | 13 Food on grass, 5 on sand — the number moves as it is dragged across a biome |
| **A Sawmill, Farm, Quarry, Docks** (a radius over other cells) | every captured cell | which trees in reach are worth more than the others |

- The label reports the **depot** — the ground times what the ground does to
  it — not what one delivery fetches.
- The label is toned against the authored stock: good above, bad below,
  untouched at the baseline (a plain tree is 10).
- It reuses the pill drawn by the adjacency preview.
- Valid cells are outlined only for the **Docks**, the one building with a rule
  of its own; for anything else the outline would be the revealed map.

### 4.2 Moving

- A move is free, instant, and never fails halfway.
- A move changes nothing but position: a Built building keeps paying rent,
  working its cells and holding its store; an unfinished one keeps its place
  in the queue and the wait it was stamped with.
- Everything that reads position follows: housing adjacency, influence radius,
  worker walking distance, the fog ring.

What may move:

- **Anything, finished or not.** A building still in the queue moves too — its
  wait is priced when the builder starts it and stamped on the queue item, so
  moving never reprices it.
- **Buildable only**, which excludes exactly the Townhall.

Placement rules that change for a move, and only these:

- The mover does not block itself.
- The count cap does not apply.
- A house does not count its own old footprint as a neighbour.

What follows the building:

- Its ordinal, and so its price (§3.1).
- Adjacency, computed on read. The tax anchor is settled at the instant of the
  move.
- The fog ring, at the new address.
- The crew:
  - a loaded worker keeps its load and walks to the new address
    ([`04-harvest.md`](04-harvest.md) §4);
  - an empty-handed worker releases its claim and goes Idle.
- An unfinished building has neither ring nor crew yet, so its address is the
  only thing that moves.

### 4.3 The two gestures

- **Tap** a legal cell to send the ghost there. **Drag** the ghost to carry it.
- The split is decided once, at pointerdown: a press inside the ghost's
  footprint drags the ghost; anything else pans the camera.
- The anchor follows the finger by cell, not by pixel offset. An illegal cell
  is not taken: dragging across a lake leaves the ghost on the shore.
- A press on the ghost never starts the hold-to-collect timer.
- The building draws faint at its old address while its ghost is out.
- Confirming a move to the cell it started on is a cancel, not an error.
- Confirming reopens the card the move was started from.
- Known rough edge: a refused drag leaves the ghost where it was, and the only
  feedback is the green outline of legal cells, which is drawn for restricted
  buildings only.

## 5. Dials, in the order to reach for them

| Dial | Where |
|---|---|
| Count caps per Townhall level | `buildings.maxCountPerTownhallLevel` |
| The Townhall's own Gold per level | `buildings` › Townhall › `goldPerMinutePerLevel` ([`03-economy.md`](03-economy.md) §3) |
| How far the fog can be paid for, per Townhall level | `fog.reachPerTownhallLevel` — [`01-map-and-fog.md`](01-map-and-fog.md) §4 |
| What every level costs, build included — currencies and goods alike | `buildings` › `costPerLevel` — §3 |
| How much dearer a later instance is | `buildings.instanceLinearGrowth`, `instanceExponentialGrowth` — §3.1 |
| Build time, and how it grows with count and distance | `buildings.buildDuration*` |
| Per-level Townhall and tech gates | `buildings.requiredTownhallLevelPerLevel`; the tech gates are the technologies' unlocks (`?dev=data#tree`) |
| Villagers each Townhall level asks for | `buildings.requiredPopulationPerLevel` on the Townhall — §1 |
| Housing capacity per level | `buildings` › Housing › `populationCapacityPerLevel` — OQ-46 |
| House rent bonus per level | `buildings.taxBonusPerLevel` — +25% a level ([`03-economy.md`](03-economy.md) §3) |
| Influence radius and worker caps | [`04-harvest.md`](04-harvest.md) §5 |
| What the ground under a cell multiplies | [`04-harvest.md`](04-harvest.md) §2.2 |
| Army cap per level | 150 · 250 · 400 · 600 · 850 · 1,100 · 1,400 · 1,750 · 2,150 · 2,600, on each of the four military halls — `buildings.armyCapPerLevel` ([`buildings.md`](buildings.md) §4.8) |
| The late half of the wait | `buildings.upgradeDurationLateSeconds`, `upgradeDurationLateLevelGrowth`, `city.lateUpgradeFromLevel` — §3.3 |
| Adjacency | `adjacency` — [`03-economy.md`](03-economy.md) §3 |

## 6. Deliberately not in this design

- A priced or timed move.
- Undo.
- Multi-select moves.
- Moving the Townhall.
- A distance term in build **cost**.
- A cost curve of any kind. Every level is a number a designer typed (§3).
- An instance multiplier that varies by level: one curve prices the whole
  ladder of a building (§3.1).
- An instance multiplier on refined goods (§3.2).
- Renumbering ordinals. #2 is #2 for life, and there is nothing that could
  free the number (§3.1).

**Open questions:** OQ-46.
