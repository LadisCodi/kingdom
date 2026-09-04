# 5 · The city — districts, placement and moving

> **Scope.** Every district, what gates it, the cost curves, where a building
> may go, and how it is moved. Construction itself is
> [`06-construction.md`](06-construction.md); what workers do is
> [`04-harvest.md`](04-harvest.md).
>
> **Status: built.**

## 1. The Townhall level is the era

- The Townhall level gates **how many of each district the city may own** and
  **how high each may level**. It is the only gate that moves all of them at
  once.

| | TH1 — Founding | TH2 — Expansion | TH3 — Prosperity |
|---|---|---|---|
| Target time | 0–30 min | 30 min – 2.5 h | ~3 h onward |
| Housing cap | 2 | 4 | 6 |
| Sawmill / Quarry / Docks / Mine cap | 1 | 2 | 3 |
| Farm / FarmLands cap | 1 / 6 | 1 / 6 | 2 / 12 |
| Gate to the next level | 60 Wood | 156 W + 78 S + **Architecture** | — |

- Pacing target: TH2 in ~25–35 min of active play; TH3 at ~2–3 h cumulative.

Three arcs run past TH3:

- **Military buildings** gate army size and therefore delve depth. Tiers IV
  and V need a cap of 36 and 50, reached only by building and upgrading all
  four halls ([`11-expeditions.md`](11-expeditions.md) §6).
- **The Mana economy** — capacity from the Sanctum and from landmarks — gates
  session length ([`08-magic.md`](08-magic.md)).
- **Ingredients and Stardust** gate relic and hero levels, on a curve measured
  in weeks ([`09-relics.md`](09-relics.md)).

## 2. The districts

| District | Size | Max level | Count cap by TH | Base cost | Build time | Gate |
|---|---|---|---|---|---|---|
| **Townhall** | 2×2 | 3 | 1 | — | — | Architecture for L3 |
| **Housing** | 1×1 | 2 | 2 / 4 / 6 | 10 W | 20 s | Urban Planning for L2 |
| **FarmLands** (crop plot) | 1×1 | 1 | 6 / 6 / 12 | 10 W | 10 s | Agriculture |
| **Farm** | 1×1 | 2 | 1 / 1 / 2 | 30 W | 20 s | Agriculture · Farming for L2 |
| **Sawmill** | 1×1 | 3 | 1 / 2 / 3 | 20 W | 20 s | Saws · Engineering for L3 |
| **Quarry** | 1×1 | 2 | 1 / 2 / 3 | 30 W | 20 s | Masonry · Engineering for L2 |
| **Docks** | 2×1 pier | 2 | 1 / 2 / 3 | 25 W | 20 s | Fishing · Shipbuilding for L2 |
| **Mine** | 1×1 | 2 | 1 / 2 / 3 | 40 W + 20 S | 30 s | Mining · Deep Mining for L2 — works iron **and** gold mountains |
| **Market** | 1×1 | 1 | 1 | 40 W | 30 s | Market |
| **Sanctum** | 1×1 | 3 | 1 | 300 G + 40 S | 90 s | Attunement branch |
| **Barracks** | 1×1 | 3 | 1 | 60 W + 20 S | 45 s | Warrior |
| **Spear Hall** | 1×1 | 3 | 1 | 80 W + 30 S | 60 s | Spears |
| **Shooting Grounds** | 1×1 | 3 | 1 | 80 W + 30 S | 60 s | Archery |
| **Stables** | 1×1 | 3 | 1 | 120 W + 70 S | 90 s | Cavalry |

- Fourteen districts; each is a `Districts` row. A fifteenth needs no code
  beyond an id.
- Per-level tech gates (`required_tech_per_level`): entry 0 is the technology
  needed to reach level 2.
- A district card says *Research X required*; a research-complete banner says
  *Housing can now reach level 2*.

## 3. Cost curves

```
buildCost(n)     = floor(base × max(mult × n × (n+1)^exp, 1))       n = existing count
upgradeCost(L)   = floor(base × countMult × levelGrowth^(L−1))
buildDuration    = round(seconds × districtGrowth^n × distanceGrowth^d)
```

- Distance is priced in build **time**, never in cost.
- Worker buildings use multiplier 2.5 and exponent 1.15: the second Sawmill
  costs ×5.5 the first (20 → 110 → 353).
- The Farm's base cost is 30 Wood.

## 4. Placement, and moving

- One legality check serves building and moving: a cell you may not build on
  is a cell you may not move to.
- Gates: features and sites already on the cell, fog, the technology, the
  shoreline rule for the Docks, the count cap, and housing adjacency.
- Terrain gates only Water ([`01-map-and-fog.md`](01-map-and-fog.md) §2). A
  farm on sand is legal.

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
- It reuses the pill drawn by the housing adjacency preview.

### 4.2 Moving

- A move is free, instant, and never fails halfway.
- The building never leaves the Built state, never enters the queue, never
  stops paying taxes or working its cells.
- Only position changes. Everything that reads position follows: housing
  adjacency, influence radius, worker walking distance, the fog ring.

What may move:

- **Built only.** An unfinished building's card offers **Cancel** (a full
  refund) instead.
- **Buildable only**, which excludes exactly the Townhall.

Placement rules that change for a move, and only these:

- The mover does not block itself.
- The count cap does not apply.
- A house does not count its own old footprint as a neighbour.

What follows the building:

- Adjacency, computed on read. The tax anchor is settled at the instant of the
  move.
- The fog ring, at the new address.
- The crew:
  - a loaded worker keeps its load and walks to the new address
    ([`04-harvest.md`](04-harvest.md) §4);
  - an empty-handed worker releases its claim and goes Idle.

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
| Build and upgrade costs, and their curves | `Districts.build_cost_*`, `upgrade_cost_*` |
| Build time, and how it grows with count and distance | `Districts.build_duration_*` |
| Per-level Townhall and tech gates | `Districts.required_*_per_level` |
| Housing capacity per level | `Districts.population_capacity_per_level` — OQ-46 |
| Influence radius and worker caps | [`04-harvest.md`](04-harvest.md) §5 |
| What the ground under a cell multiplies | [`04-harvest.md`](04-harvest.md) §2.2 |
| Army cap per level | 6 / 10 / 15, on the four military halls |
| Adjacency | `Adjacency` sheet — [`03-economy.md`](03-economy.md) §3 |

## 6. Deliberately not in this design

- A priced or timed move.
- Undo.
- Multi-select moves.
- Moving the Townhall.
- A distance term in build **cost**.
- `Desert`, a declared terrain with zero cells.

**Open questions:** OQ-1, OQ-46, OQ-48.
