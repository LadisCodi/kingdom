# 5 · The city — districts, placement and moving

> **Scope.** The Townhall as era gate, what a building costs, where it may
> go, and how it is moved. The building list is [`buildings.md`](buildings.md);
> construction itself is [`06-construction.md`](06-construction.md); what
> workers do is [`04-harvest.md`](04-harvest.md).
>
> **Status: built 2026-09-09.** Every level is authored on the `DistrictCosts`
> sheet and priced by the building's own instance ordinal (§3).

## 1. The Townhall level is the era

- The Townhall level gates **how many of each district the city may own** and
  **how high each may level**. It is the only gate that moves all of them at
  once.
- It also **multiplies every house's rent**: ×1 at level 1, +0.25 a level, to
  ×3.25 at 10 (`taxes.townhall_multiplier_per_level`,
  [`03-economy.md`](03-economy.md) §3). This is the number its Level Up card
  shows — the count caps are gates, not a stat a player reads.

| | TH1 | TH2 | TH3 | TH4 |
|---|---|---|---|---|
| Target time | 0–30 min | 30 min – 2.5 h | ~3 h onward | late game |
| Housing cap | 2 | 4 | 6 | 9 |
| Sawmill / Quarry / Docks cap | 1 | 2 | 3 | 4 |
| Farm / FarmLands cap | 1 / 6 | 1 / 6 | 2 / 12 | 3 / 16 |
| Gate to the next level | 60 Wood | `Bureaucracy` | `Magistracy` | — |

- Pacing target: TH2 in ~25–35 min of active play; TH3 at ~2–3 h cumulative.

Three arcs run past TH3:

- **Military buildings** raise the army cap — how many troops the city may
  own — and therefore how deep a ruin can be pushed. The cap is the sum over
  the four halls ([`combat.md`](combat.md) §14); what *opens* a depth is the
  Adventurers' Guild ([`11-expeditions.md`](11-expeditions.md) §3).
- **The Mana economy** — capacity from the Sanctum and from landmarks — gates
  session length ([`08-magic.md`](08-magic.md)).
- **Card albums, Fragments, Stardust and Hero XP** gate relic and hero levels,
  on a curve measured in weeks and seasons ([`09-relics.md`](09-relics.md),
  [`10-heroes.md`](10-heroes.md) §4).

## 2. The districts

- Fourteen districts; each is a `Districts` row. A fifteenth needs no code
  beyond an id.
- Every building, its job, its count cap and its level ladder:
  [`buildings.md`](buildings.md).
- Per-level tech gates (`required_tech_per_level`): entry 0 is the technology
  needed to reach level 2.
- A district card says *Research X required*; a research-complete banner says
  *Housing can now reach level 2*.

## 3. What a building costs

**Every level of every building is authored, one number per resource.** There
is no cost curve. The prices live on their own sheet, `DistrictCosts`, one row
per building per level — the four currencies and the four refined goods side
by side:

```
district | level | gold | wood | food | stone | planks | cut_stone | iron | runestone
```

- **Level 1 is the build.** Levels 2 and up are what reaching that level
  costs. A build price and an upgrade price are the same kind of thing, so
  they are one column of numbers, not two bases with a curve between them.
- The table prices the **first** instance of the building. Every later one
  multiplies it (§3.1).
- Distance is priced in build **time**, never in cost (§3.3).
- The ordinal multiplier applies to the currencies only. Goods are authored
  per level like everything else and are never multiplied (§3.2).
- A building has exactly as many rows as it has levels; the importer refuses a
  `max_level` that reaches past the last row authored for it.
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
- Two dials a building: `instance_linear_growth`, `instance_exponential_growth`.

At 2 and 1.2:

| Ordinal | #2 | #3 | #5 | #10 | #21 |
|---|---|---|---|---|---|
| Multiplier | ×3.2 | ×5.4 | ×10.1 | ×23.2 | ×78.3 |

- **The ordinal has no gaps.** Nothing is ever demolished and a build cannot be
  cancelled ([`06-construction.md`](06-construction.md) §1), so the next
  ordinal is the count plus one and stays unique without a counter of its own.
- Because the multiplier is flat next to the level ladder, **what paces the
  city is how high buildings are pushed, not how many stand**. What limits how
  many stand is `max_count_per_townhall_level` (§1), not the price.

### 3.2 Refined goods, in the same table and unmultiplied

- The four goods are four more columns on the same row, under the same rule:
  the level 1 row is what the **build** costs in goods, levels 2 and up what
  that level costs.
- **The ordinal multiplier skips them.** A recipe does not know how many of
  the thing the city owns, and a workshop makes goods one at a time: an
  ordinal multiplier would price a second workshop's worth of days into a
  single upgrade.
- A building's whole price — raw and refined, build and every level — is
  therefore one row per level and nothing else. No goods list packed into a
  text cell, and no separate column for the build.
- A **decoration** has one level, so its goods price is its level 1 row
  ([`18-harmony.md`](18-harmony.md) §2).

### 3.3 The wait

The wait is still a curve, and it still pivots.

```
buildDuration        = round(seconds × districtGrowth^(N−1) × distanceGrowth^d)
upgradeDuration(L)   = round(seconds × durationGrowth^(L−2))
upgradeDuration(L≥6) = lateSeconds × lateDurationGrowth^(L−6)
```

- The pivot is `city.late_upgrade_from_level` (6), and the late half restarts
  at its own base — 2 h for every district — because a minute-long step cannot
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
- A move changes nothing but position: a Built building keeps paying taxes and
  working its cells, an unfinished one keeps its place in the queue and the
  wait it was stamped with.
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
| Count caps per Townhall level | `Districts.max_count_per_townhall_level` |
| Townhall rent multiplier per level | `taxes.townhall_multiplier_per_level` — ×1 then +0.25 a level ([`03-economy.md`](03-economy.md) §3) |
| What every level costs, build included — currencies and goods alike | the `DistrictCosts` sheet — §3 |
| How much dearer a later instance is | `Districts.instance_linear_growth`, `instance_exponential_growth` — §3.1 |
| Build time, and how it grows with count and distance | `Districts.build_duration_*` |
| Per-level Townhall and tech gates | `Districts.required_*_per_level` |
| Housing capacity per level | `Districts.population_capacity` — OQ-46 |
| House rent bonus per level | `Districts.tax_bonus_per_level` — +25% a level ([`03-economy.md`](03-economy.md) §3) |
| Influence radius and worker caps | [`04-harvest.md`](04-harvest.md) §5 |
| What the ground under a cell multiplies | [`04-harvest.md`](04-harvest.md) §2.2 |
| Army cap per level | 6 / 10 / 15 / 21 / 28 then +8 a level to 68, on the four military halls ([`buildings.md`](buildings.md) §4.9, §4.11) |
| The late half of the wait | `Districts.upgrade_duration_late_seconds`, `upgrade_duration_late_level_growth`, `city.late_upgrade_from_level` — §3.3 |
| Adjacency | `Adjacency` sheet — [`03-economy.md`](03-economy.md) §3 |

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
- `Desert`, a declared terrain with zero cells.

**Open questions:** OQ-46.
