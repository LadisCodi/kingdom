# 5 · The city — districts, placement and moving

> **Scope.** Every district, what gates it, the cost curves, where a building
> may go, and how it is moved. Construction itself is
> [`06-construction.md`](06-construction.md); what workers do is
> [`04-harvest.md`](04-harvest.md).
>
> **Status: built.**

## 1. The Townhall level is the era

The city's whole shape hangs off one number. The Townhall gates **how many of
each district you may own** and **how high each may level**, and it is the only
gate that moves all of them at once.

| | TH1 — Founding | TH2 — Expansion | TH3 — Prosperity |
|---|---|---|---|
| Target time | 0–30 min | 30 min – 2.5 h | ~3 h onward |
| Housing cap | 2 | 4 | 6 |
| Sawmill / Quarry / Docks / Mine cap | 1 | 2 | 3 |
| Farm / FarmLands cap | 1 / 6 | 1 / 6 | 2 / 12 |
| Gate to the next level | 60 Wood | 156 W + 78 S + **Architecture** | — |

Pacing target, decided and tunable: **snappy** — TH2 in ~25–35 min of active
play, TH3 at ~2–3 h cumulative.

**TH3 is no longer the endgame.** Three arcs run past it at different speeds:

- **Military buildings** gate army size and therefore delve depth. Tiers IV and
  V need a cap of 36 and 50, reachable only by building and upgrading all four
  ([`11-expeditions.md`](11-expeditions.md) §6).
- **The Mana economy** — capacity from the Sanctum and from landmarks — gates
  how long a session is ([`08-magic.md`](08-magic.md)).
- **Ingredients and Stardust** gate relic and hero levels, on a curve measured
  in weeks rather than hours ([`09-relics.md`](09-relics.md)).

## 2. The districts

| District | Size | Max level | Count cap by TH | Base cost | Build time | Gate |
|---|---|---|---|---|---|---|
| **Townhall** | 2×2 | 3 | 1 | — | — | Architecture for L3 |
| **Housing** | 1×1 | 2 | 2 / 4 / 6 | 10 W | 20 s | Urban Planning for L2 |
| **FarmLands** (crop plot) | 1×1 | 1 | 6 / 6 / 12 | 10 W | 10 s | Agriculture |
| **Farm** | 1×1 | 2 | 1 / 1 / 2 | 30 W | 20 s | Agriculture · Farming for L2 |
| **Sawmill** | 1×1 | 3 | 1 / 2 / 3 | 20 W | 20 s | Saws · Engineering for L3 |
| **Quarry** | 1×1 | 2 | 1 / 2 / 3 | 30 W | 20 s | Masonry (← Scaling Tools) · Engineering for L2 |
| **Docks** | 2×1 pier | 2 | 1 / 2 / 3 | 25 W | 20 s | Fishing · Shipbuilding for L2 |
| **Mine** | 1×1 | 2 | 1 / 2 / 3 | 40 W + 20 S | 30 s | Mining · Deep Mining for L2 |
| **Market** | 1×1 | 1 | 1 | 40 W | 30 s | Market |
| **Sanctum** | 1×1 | 3 | 1 | 300 G + 40 S | 90 s | Attunement branch |
| **Barracks** | 1×1 | 3 | 1 | 60 W + 20 S | 45 s | Warrior |
| **Spear Hall** | 1×1 | 3 | 1 | 80 W + 30 S | 60 s | Spears |
| **Shooting Grounds** | 1×1 | 3 | 1 | 80 W + 30 S | 60 s | Archery |
| **Stables** | 1×1 | 3 | 1 | 120 W + 70 S | 90 s | Cavalry |

Fourteen districts. Every one of them is a `Districts` row — a fifteenth needs
no code beyond an id.

**Per-level tech gates** (`required_tech_per_level`) are the mechanic that makes
the tree matter inside an era rather than only between them: entry 0 is what it
takes to reach level 2. A district card says *Research X required* rather than
just refusing, and a research-complete banner says *Housing can now reach level
2*.

## 3. Cost curves

Three curves, and none of them takes distance into the **cost**.

```
buildCost(n)     = floor(base × max(mult × n × (n+1)^exp, 1))       n = existing count
upgradeCost(L)   = floor(base × countMult × levelGrowth^(L−1))
buildDuration    = round(seconds × districtGrowth^n × distanceGrowth^d)
```

**Distance is priced in time, not in Gold.** A building far from the Townhall
takes longer to raise; it does not cost more. The Gold price of distance is
already the fog, and charging twice would make the far map unreachable in two
currencies at once.

**The second-instance cliff was softened** for the worker buildings — multiplier
4 → 2.5, exponent 1.45 → 1.15 — so the second Sawmill is ×5.5 rather than
×10.9 (20 → 110 → 353). The Farm's base went 10 → 30 Wood instead, because it is
an automation building sitting behind a technology.

## 4. Placement, and moving

**Where a building may go** is one question asked in two situations. A spot you
may not build on is a spot you may not move to.

The gates: terrain, features and sites already on the cell, fog, the technology,
the shoreline rule for the Docks, the count cap, and housing adjacency. Placement
mode draws the area of influence for the hovered cell and highlights the resource
cells it would capture, with a count.

> **A move is free, instant, and it never fails halfway.**

Free because the alternative is a tax on tidying up — Clash of Clans and Everdale
both move buildings for nothing, and a priced move would be another Gold sink to
balance for no design gain. Instant because there is nothing to build: the
building never leaves the Built state, never enters the queue, never stops paying
taxes or working its cells.

**A move gains the player nothing directly.** What it changes is *position*, and
position is already priced by everything that reads it: housing adjacency,
influence radius, worker walking distance, the fog the building pushes back. The
move is free precisely because it is never free of consequence.

Two gates on what may move, and both are the same gate said twice:

- **Built only.** An unfinished building's duration is measured from the
  Townhall, so relocating one mid-build would silently reprice the wait. Its card
  already offers **Cancel**, a full refund.
- **Buildable only**, which excludes exactly the Townhall. It is the origin every
  fog ring, every build duration and every worker distance is measured from;
  moving it would reprice the whole world without saying so.

Moving changes **two placement rules and nothing else**: the mover does not
block *itself* (without which nothing could move by less than its own
footprint, which is most of the moves a player wants), and the count cap does
not apply (a move adds nothing to the count). A house may not anchor its own
move on itself — standing next to where you already are is not neighbourliness.

**What follows the building:** adjacency (computed on read, so it just follows —
but the tax anchor must be settled at that instant or the player is paid the new
rate for time elapsed at the old one), the fog ring at the new address, and the
crew, split as [`04-harvest.md`](04-harvest.md) §5 describes.

### The two gestures

**Tap** a legal cell to send the ghost there. **Drag** the ghost to carry it.

The split is decided **once, at pointerdown**: a press inside the ghost's
footprint drags the ghost, anything else pans the camera. Deciding on press is
what stops the two fighting mid-flick, and it means the rest of the world stays
reachable while a ghost is out — the ghost is a thing you put your finger on,
not a mode that captures every drag.

- **The anchor follows the finger by cell, not by pixel offset**, and an illegal
  cell is simply not taken. Dragging across a lake leaves the ghost on the shore
  rather than following the finger somewhere it would snap back from: the ghost
  always shows where a release would actually put it.
- **A press on the ghost never starts the hold-to-collect timer.**
- The building **draws faint at its old address** while its ghost is out.
  Without it the player sees two of the same building and no way to tell which
  is real.
- **Cancel and dropping it home mean the same thing** — confirming a move to the
  cell it started on is a cancel, not an error.
- **Confirming reopens the card** it was started from.

## 5. Dials, in the order to reach for them

| Dial | Where |
|---|---|
| Count caps per Townhall level | `Districts.max_count_per_townhall_level` |
| Build and upgrade costs, and their curves | `Districts.build_cost_*`, `upgrade_cost_*` |
| Build time, and how it grows with count and distance | `Districts.build_duration_*` |
| Per-level Townhall and tech gates | `Districts.required_*_per_level` |
| Housing capacity per level | `Districts.population_capacity_per_level` — OQ-46 |
| Influence radius and worker caps | [`04-harvest.md`](04-harvest.md) §4 |
| Army cap per level | 6 / 10 / 15, on the four military halls |
| Adjacency | `Adjacency` sheet — [`03-economy.md`](03-economy.md) §3 |

## 6. Deliberately not in this design

A priced or timed move · undo (the remedy for a bad move is another move, which
is fine while moves are free and stops being fine the moment anyone prices
them) · multi-select moves · moving the Townhall · a distance term in build
*cost* · `Desert`, which is a declared terrain with zero cells.

**Known rough edge:** dragging onto ground the building may not occupy leaves
the ghost where it was, and the only feedback is the green outline of the legal
cells — which is drawn for restricted buildings only. For an unrestricted
building a refused drag looks like a dropped gesture. Worth a playtest.

**Open questions:** OQ-1 (a bounded plot), OQ-46, OQ-48.
