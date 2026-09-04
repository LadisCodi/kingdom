# 4 · Harvest — the cell as a depot, the tap as a duration

> **Scope.** How resources leave the ground: what a cell holds, what a tap is
> worth, how a worker automates it, and what the map's production ceiling is.
> What a tap *costs* is [`08-magic.md`](08-magic.md); where the coins go is
> [`03-economy.md`](03-economy.md).
>
> **Status: built.** Not built: a separate FarmLands harvest row (§2.1), the
> map-editor production census (§2.3, OQ-50), the over-hire onboarding beat
> (§6).

## 1. The rules

- **Nothing produces from nothing.** A cell holds a **stock** of units. Every
  extraction — thumb or worker — draws that stock down. A cell refills by its
  own recovery. Nothing else in the city makes matter.
- **One tap is `tap.workSeconds` of work** (10 s) on whatever was tapped: ten
  seconds of a woodcutter's swing at a tree, ten seconds of a house's rent.
- A tap is priced against the ground and the thumb, never against the payroll.
- The one exception to the first rule is the house tap, which mints Gold (§3.1).

### 1.1 The thumb's worth

- A held finger lands a tap every `tap.collectCooldownSeconds` (0.5 s).
- `the thumb, in workers = tap.workSeconds ÷ collect cooldown = 10 ÷ 0.5 = 20`
- Tuning relation: the thumb's worker-equivalent stays ahead of the crew the
  city can house. It also sets what a rewarded ad is worth (§3.3).
- At 10 s the thumb is 20 workers against the 30 a Townhall-3 city can house.
  `QuickHands` takes the thumb to 40, `TapPower` at the top of its ladder to
  60, both together to 120.
- `tap.workSeconds` is the dial for late-game hand-play; doubling it doubles the
  ad with it (§3.3).

## 2. The cell is a depot

Every resource cell carries:

| | What it is |
|---|---|
| **`stock`** | units it holds when full — the **burst** |
| **`recoverySeconds`** | time from empty back to full — the **availability** |
| **`unitsPerStrike`** | units one extraction takes — the **chunk** |
| **`secondsPerStrike`** | seconds one extraction takes — the **rhythm** |

- Extraction draws units down. At zero the cell is **exhausted**: it cannot be
  tapped or worked, it shows its exhausted art and a recovery bar.
- Recovery is binary: the cell comes back **full** after `recoverySeconds`.
  There is no continuous regrowth and no reserve floor (§5).
- Recovery is timestamp-based: it works offline and costs exactly one boundary.
- The chunk and the rhythm are per cell: iron is a heavy swing, crops a light
  tick, and two cells can pay the same per minute and feel different.

### 2.1 The authoring law

- A cell drains over `stock ÷ unitsPerStrike` round trips, then is dead for
  `recoverySeconds`.
- `workers a cell supports = drain ÷ (drain + recovery)`; it never reaches 1.
- Author `secondsPerStrike ÷ unitsPerStrike ≈ 1.1 × (recoverySeconds ÷ stock)`.
  A cell then supports about **0.55** workers, rising with the walk (0.59 for a
  Forest cell next door). **Roughly two cells per worker.**
- The law authors the cell; the trip belongs to where the shed sits. The rate
  column below varies with distance; the cell's numbers do not.
- `tap.workSeconds` = 10 makes a ten-unit tree about ten taps.
- The worker column is a round trip, quoted at both ends of a level-3 radius.

| Cell | `unitsPerStrike` | `secondsPerStrike` | `stock` | `recoverySeconds` | a tap pays | taps to empty | worker, next door → radius 4 | workers/cell |
|---|---|---|---|---|---|---|---|---|
| **Forest** | 1 | 10 | 10 | 90 | **1** | **10** | 4.7 → 3.3/min | 0.59 |
| **Crops** | 1 | 8 | 10 | 60 | 1 (+¼ carried) | 8 | 5.6 → 3.8/min | 0.64 |
| **Berries** | 1 | 10 | 10 | finite | 1 | 10 | 4.7 → 3.3/min | — |
| **Meat** | 3 | 20 | 30 | finite | 1 (+½ carried) | 20 | 7.9 → 6.4/min | — |
| **Stone** | 1 | 26 | 5 | 120 | 1 *(floor)* | 5 | 2.1 → 1.8/min | 0.55 |
| **Fish** | 2 | 20 | 10 | finite | 1 | 10 | 5.3 → 4.3/min | — |
| **MountainIron** | 5 | 60 | 25 | 300 | 1 *(floor)* | 25 | 4.8 → 4.4/min | 0.51 |
| **MountainGold** | 3 | 60 | 15 | 300 | 1 *(floor)* | 15 | 2.9 → 2.6/min | 0.51 |

- The spread narrows as the ground slows: a tree next door pays 1.4× one at
  radius 4, an iron peak 1.1×. Fast ground rewards a close shed; slow ground
  does not care.
- The renewables hold the law to within a hundredth.
- On slow ground the **floor** governs: ten seconds of work on a rock, an iron
  peak or a gold peak is 0.38, 0.83 and 0.50 units, so all three pay 1. Richness
  shows in the grind length (5, 25, 15 taps) and in the first `TapPower` levels.
- A metal peak's richness is in the depot and the crew: 25 units in one cell
  against a rock's 5, five units a swing against one.
- **FarmLands shares the `Crops` row.** A built plot behaves exactly like wild
  crops. Its own rhythm needs a new harvest source id (code, not data) — not
  built.

### 2.2 The ground under the cell

- Terrain multiplies what a cell **holds** (`stock`), per currency. A grassland
  tree holds 13 Wood, a snowy one 8, a desert one 5.
- The multiplier is a property of the terrain, not of the building, so a
  Forest, a FarmLands and a rock on the same ground all take it.
- It scales the stock, not the strike: `unitsPerStrike` is 1 on most cells and
  `1 × 0.75` rounds back to 1. Stock runs 5 to 30.
- Thumb and crew are both affected, because they draw the same depot (§1).

| Terrain | Food | Wood | Stone |
|---|---|---|---|
| **Grassland** | ×1.25 | ×1.25 | ×1 |
| **Plains** | ×1 | ×1 | ×1 |
| **Snow** | ×0.75 | ×0.75 | ×1 |
| **Desert** | ×0.5 | ×0.5 | **×1.5** |
| **Tundra** | ×0.75 | **×1.5** | **×1.5** |
| Water | ×1 | ×1 | ×1 |

- Water is ×1 so the multiplier does not retune Fish shoals.
- Poor ground is bad twice: the total per cycle scales with the multiplier, the
  sustainable rate falls further because recovery is a fixed cost. A desert
  forest drains in 50 s and sits out 90, yielding 2.1 Wood/min against a
  grassland tree's 3.5 (61%, not 50%); its workers-per-cell drops from 0.59 to
  0.36, so a desert needs about three cells per worker.
- On the map as painted, Grassland holds 44 of the 57 trees; Desert's stone
  bonus reaches one mountain in 81 cells; Tundra holds no trees (OQ-56).

### 2.3 The map ceiling

- A cell's sustainable rate is `stock ÷ (drain + recovery)`, so the province has
  one too.
- At **57 Trees** on the map as painted, sheds next door: **157 Wood/min** is
  everything the province can grow, and **33 workers** collect all of it
  (against the 30 a Townhall-3 city can house).
- Both figures move with the walk: farther sheds collect less of the same
  ceiling and need more bodies.
- The map editor should compute this census, weighting each cell by its ground
  ([`../map-editor.md`](../map-editor.md), OQ-50) — not built.

## 3. The tap

```
seconds = tap.workSeconds × (1 + TapPower)
owed    = seconds × unitsPerStrike ÷ secondsPerStrike
paid    = max(1, floor(owed + carry))     — capped by what the cell still holds
carry   = max(0, owed + carry − paid)
```

- **`tap.workSeconds` = 10**, global: a property of the thumb, not the ground.
  A ten-unit tree is about ten taps.
- **`TapPower` buys duration, not units**: +20% per level, ten levels, ×3 at the
  top (a tap worth thirty seconds of work). Priced in Gold; a permanent sink.
- **Carry**: the fractional remainder is carried per currency, so a +20% upgrade
  on a one-unit cell pays out on the fifth tap. Four numbers, additive to the
  save.
- **Floor of one unit**: a tap never pays nothing. At this duration the floor
  covers four of the eight cells (§2.1).
- **The shortfall when the depot runs dry is not carried.** A maxed thumb wants
  3 Wood; the last tap of a 10-Wood tree pays what is left, the rest is waste.
  Raising `TapPower` past the ground's richness buys less and less.
- An iron vein pays 1 a tap, not 3: its richness is in the depot (15 units
  against a rock's 5) and its three-unit swing.
- A tap reads the cell's own rate, `unitsPerStrike ÷ secondsPerStrike`, with no
  travel term. It does not read `cityGatherPerSecond` (§4).
- A tap refused by a tech gate costs no Mana.

### 3.1 The house tap

- Tapping a house moves its tax anchor back by `tap.workSeconds × that house's
  share of city income` — exactly `tap.workSeconds` of that house's own rent.
  `TapPower` lifts it too.
- A house tap **mints** Gold: taxes accrue continuously, so an advance against
  them is new Gold. It is the single exception to §1's first rule.
- The Mana pool is its only bound. A house may be tapped as often as the pool
  allows; there is no per-house advance budget.
- Mana spent on rent is worth several times Mana spent on trees: a full pool on
  the neighbourhood is worth about **9 minutes** of the city's tax income,
  against **1.8** for the same pool on wood. Whether this makes the harvest tap
  vestigial is **OQ-55**; the lever is `tap.workSeconds` and the ground's
  abundance.

### 3.2 Taps that do not exist

- Training queues (villagers at the Townhall, soldiers at the halls) cannot be
  tapped. A timer is hurried with Gems, not Mana.
- The Townhall does not answer a tap. The first villager takes its 20 seconds
  unaided.
- Paying fog is outside the convention: it costs Gold, not Mana, and buys
  cells, not production. `Surveying` is unaffected.

### 3.3 What a full pool is worth

A rewarded ad pays a whole pool:

| City | pool | tap | ad pays | = production |
|---|---|---|---|---|
| 1 Sawmill L1, 3 workers, `TapPower` 0 | 100 | 1 Wood | 100 Wood | **5.6 min** |
| 30 workers, `TapPower` 0 | 332 | 1 Wood | 332 Wood | 1.8 min |
| 30 workers, `TapPower` 10 | 332 | 3 Wood | ~1,000 Wood | **5.5 min** |

- About five and a half minutes of production at both ends of the game, by
  construction, without the tap reading the payroll
  ([`03-economy.md`](03-economy.md) §5).
- `TapPower` holds the ad's value up as the crew grows: pool ×3.3 against crew
  ×10 leaves the ad worth a third by Townhall 3; the ×3 duration ladder restores
  it (§1.1).
- An ad buys about three minutes of things to do: a full pool is 332 taps and a
  held finger spends it in under three minutes.
- `tap.workSeconds` is the ad's dial; halving it halves the ad. Whether ~5.5
  minutes of production for three minutes of thumb is worth six ad placements
  is **OQ-51**.
- At five ads a day a watcher gathers about **2–3%** more than a non-watcher,
  not 50%. The ad's job is the visit, not the day (OQ-43).

## 4. The strike and the haul

- A worker walks to its claimed cell, **strikes** it once, walks the load home,
  and goes out again: `Idle → MovingToCell → Working → MovingHome`.
- **Units leave the depot when the swing lands. They reach the wallet when the
  worker gets home.** A load in transit is real matter.
- Nobody double-dips: tapping a tree a woodcutter just struck pays what is
  left. A cell can show a stump while its last load is still being carried.
- A carrying worker keeps its load when its building moves and walks to the new
  address (§5, [`05-city-and-districts.md`](05-city-and-districts.md) §4).
- Unassigning a loaded worker loses the load.
- The walk is the distance cost: 4.7 Wood/min from a tree next door against
  3.3 from one at radius 4. There is no per-distance penalty on the strike rate.
- A strike is a simulation boundary. The renderer receives the strike event the
  sim emitted — the struck cell and its ground. Nothing about the feedback feeds
  back into the sim; offline replay produces the same strikes with no feedback.

Strike feedback:

- Same hit, same cell, same foley as the player's tap, at **half volume**,
  **without the white flash**, punch scaled to **0.55** of the player's.
- A strike punches the **cell**; the haul's floater pops at the **building**
  when the wallet moves.
- Audio: on-screen cells only; silent below zoom 0.8; at most three voices in
  flight, the rest dropped; ±5% extra pitch jitter.

Quests:

- Both paths bank a `collect`; only the thumb banks a `tap`. A strike never
  completes a `CollectTaps` goal (comment at both call sites, test in
  `quests.test.ts`). A `WorkerCollect` goal type is OQ-53.

`cityGatherPerSecond`:

- A **nominal** city-wide rate with a travel term that takes the influence
  radius as the distance.
- The tap does not read it. It has no caller in `src/` (orders,
  [`12-quests.md`](12-quests.md) §6, do not exist); it is kept as a dead export
  with a comment saying so.

## 5. Areas of influence, claims and migration

- A worker building works cells **of its type** within Chebyshev
  `radius(level)`. Revealed cells only.
- **One worker per cell, globally.** `tryDispatch` takes the nearest unclaimed
  cell.
- A worker whose cell exhausts releases the claim and walks to another.
- The radius decides two things: the **gradient** (a tree next door pays 1.4×
  one at radius 4, §4) and **coverage** (how many cells of the right type the
  building reaches, which under two-cells-per-worker (§2.1) decides how many
  plazas are ever busy, §6).
- **No reserve floor.** Workers empty cells; nothing stops them at a share of
  stock.
- **The thumb works the frontier; the crews work the covered ground.** With a
  crew matched to the map, essentially every live cell inside a radius is
  claimed, so newly revealed ground is where hand-play lives.
- A claim blocks other workers, not taps: the player can raid a tree their own
  woodcutter is felling, exhaust it early and send the worker walking. Whether
  that feels bad is OQ-52.

## 6. Idle workers

- Workers with no cell to claim wait **outside**, milling in the cells around
  their building: idle animation, no strikes, no destination.
- A worker moving with purpose is migrating; a knot of workers by a door is
  idle. No icon.
- The count lives in the district card only (`4/7` busy). Nothing on the map.
- When a stump becomes a tree, one of the loiterers heads for it.
- One onboarding beat that makes the player hire past their ground, around the
  time the Tome of Earth opens — not built.

## 7. The three actors

| Actor | Dial | Raises | Symptom it answers |
|---|---|---|---|
| **The ground** | abundance (`stock`), recovery, richness (`unitsPerStrike`) | what the map can give | "everything is a stump" · "they never stop walking" |
| **The thumb** | `TapPower` | seconds per tap | "I want it now" |
| **The payroll** | `WorkerLoad`, plazas per level, **where the shed sits** | units a trip, and how long the trip is | "I am collecting too slowly" |

- The seven cell-scoped upgrades — Sawpits, Irrigation, Stonecutting, Big Nets,
  Iron Picks, Butchery, Scythes — raise the ground's abundance, so they lift the
  tap and the worker alike.
- `WorkerLoad` is the one payroll-only dial: more units per strike empties
  cells faster.
- Doubling `stock` and halving `recoverySeconds` both pay +29% rate. More stock
  means longer stays and less walking; faster recovery means a greener map and
  more migration.

## 8. Offline

- Worker strikes, cell recoveries and Townhall cycles are replayed
  deterministically, **capped at 8 hours** per absence.
- No player taps happen offline.
- The cap limits production, never a timer: recovery stamps and build queues
  resolve in the uncapped tail.

## 9. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Seconds a tap is worth | **10** | `tap.work_seconds` |
| `TapPower` | **+20%/level, 10 levels** (→ ×3) | `Upgrades` |
| Chunk and rhythm, per cell | §2.1 | `Harvest.units_per_strike`, `.seconds_per_strike` |
| Stock, per cell | §2.1 | `Harvest.stock` |
| Ground multiplier, per terrain × currency | §2.2 | `Terrain` sheet |
| Recovery, per cell | §2.1 | `Harvest.recovery_seconds` |
| Respawn, finite features | 120 s Berries · 180 s Meat · 90 s Fish | `Harvest.respawn_seconds` |
| Worker move speed | 1 tile/s | `worker.move_speed_tiles_per_second` |
| Influence radius, plazas per level | §5 | `Districts` |
| Mana per tap | 1 | `tap.mana_cost` |
| Auto-tap cooldown (and so the thumb's worth, §1.1) | 0.5 s | `tap.collect_cooldown_seconds` |
| Strike punch, against the player's 1 | 0.55 | `STRIKE_PUNCH`, code |
| Strike volume · extra jitter · voices | ×0.5 · ±5% · 3 | `strikeFeedback`, code |
| Zoom below which a strike is silent | 0.8 | `STRIKE_AUDIBLE_ZOOM`, code |
| Offline cap | 8 h | `offline_cap_hours` |

Two relations to hold while tuning:

1. `seconds_per_strike ÷ units_per_strike ≈ 1.1 × (recovery_seconds ÷ stock)`,
   or the workers-per-cell number drifts (§2.1).
2. `tap.work_seconds ÷ collect_cooldown` stays ahead of the crew the city can
   house (§1.1, §3.3).

## 10. Deliberately not in this design

- pathfinding
- continuous regrowth
- a per-distance strike penalty
- a worker reserve floor
- a per-house advance budget
- a tap on training queues
- building storage, vaults or generators of any kind
- offline tapping
- fractional wallets
- per-cell yield variety beyond the authored table
- permanent destruction of a renewable feature

**Open questions:** OQ-43, OQ-44, OQ-50, OQ-51, OQ-52, OQ-53, OQ-54, OQ-55,
OQ-56.
