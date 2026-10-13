# 4 · Harvest — the cell as a depot, the tap as a duration

> **Scope.** How resources leave the ground: what a cell holds, what a tap is
> worth, how a worker automates it, and what the map's production ceiling is.
> What a tap *costs* is [`08-magic.md`](08-magic.md); where the coins go is
> [`03-economy.md`](03-economy.md).
>
> **Status: built.** Not built: the map ceiling computed by the map editor
> (§2.3) — its census counts cells per ring, not what they yield.

## 1. The rules

- **Nothing produces from nothing.** A cell holds a **stock** of units. Every
  extraction — thumb or worker — draws that stock down. A cell refills by its
  own recovery. Nothing else in the city makes matter.
- **One tap is `tap.workSeconds` of work** (10 s) on whatever was tapped: ten
  seconds of a woodcutter's swing at a tree.
- A tap is priced against the ground and the thumb, never against the payroll.
- A tap on a building is not a harvest: it collects the building's store, free
  ([`03-economy.md`](03-economy.md) §3.2).

### 1.1 The thumb's worth

- Every tap is a deliberate press. Holding a finger down repeats nothing; a
  press that does not move is one tap on release.
- Nothing times the thumb: the player taps as fast as they like, and Mana is
  the only limit (one per tap on the ground).
- `tap.workSeconds` sets what a tap and a rewarded ad are worth (§3.3);
  doubling it doubles the ad with it.
- The Bag's **Harvest boost** lengthens every tap by 50% for an hour.

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
- **The wait is priced once, at the moment the cell runs dry**, and stored on
  the cell. What shortens it:
  - `regrowthSpeed`, a speed the wait is divided by, aimed at a source —
    Reforesting I (Forest) and Crop Rotation I (Crops), +25% each;
  - the Staff of Renewal's aura, read at the cell
    ([`09-relics.md`](09-relics.md) §2.1).
- A bonus finished later does not wake a cell already sleeping. The wait never
  falls below one second.
- **A mountain never runs out.** `stock` 0 means inexhaustible: Stone and the
  two metal mountains keep no depot, never exhaust and have no recovery clock.
- **Only a source that grows back IN PLACE has that clock**: Forest and
  Crops. A berry bush, a herd and a shoal are consumed and reappear on a
  tile next to where they first stood (Grassland, or Water for a shoal) after
  `respawnSeconds`, priced when the wait starts. `respawnSpeed` (Gamekeeping I, +25%) shortens it; a
  recovery bonus aimed at a consumed source is refused.
- What a cell holds grows with `cellStock` — Rich Soil I (Crops) and Old
  Growth I (Forest), +25% each — and with the Staff of Renewal's aura.
- The chunk and the rhythm are per cell: iron is a heavy swing, crops a light
  tick, and two cells can pay the same per minute and feel different.

### 2.1 The authoring law

- A cell drains over `stock ÷ unitsPerStrike` round trips, then is dead for
  `recoverySeconds`.
- `workers a cell supports = drain ÷ (drain + recovery)`; it never reaches 1.
- Author `secondsPerStrike ÷ unitsPerStrike ≈ 1.1 × (recoverySeconds ÷ stock)`.
  A cell then supports about **0.55** workers, rising with the walk.
  **Roughly two cells per worker.**
- The law authors the cell; the trip belongs to where the shed sits. The rate
  column below varies with distance; the cell's numbers do not.
- `tap.workSeconds` = 10 makes a ten-unit tree about ten taps.
- The worker column is one worker's rate, quoted next door and four cells out.

| Cell | `unitsPerStrike` | `secondsPerStrike` | `stock` | `recoverySeconds` | a tap pays | taps to empty | worker, next door → radius 4 | workers/cell |
|---|---|---|---|---|---|---|---|---|
| **Forest** | 1 | 10 | 10 | 180 | **1** | **10** | 4.7 → 3.3/min | 0.42 |
| **Crops** | 1 | 8 | 10 | 60 | 1 (+¼ carried) | 8 | 5.6 → 3.8/min | 0.64 |
| **Berries** | 1 | 10 | 10 | finite | 1 | 10 | 4.7 → 3.3/min | — |
| **Meat** | 3 | 20 | 30 | finite | 1 (+½ carried) | 20 | 7.9 → 6.4/min | — |
| **Stone** | 1 | 26 | 0 *(never runs out)* | — | 1 *(floor)* | — | 2.1 → 1.8/min | any |
| **Fish** | 2 | 20 | 10 | finite | 1 | 10 | 5.3 → 4.3/min | — |
| **MountainIron** | 5 | 60 | 0 *(never runs out)* | — | 1 *(floor)* | — | 4.8 → 4.4/min | any |
| **MountainGold** | 3 | 60 | 0 *(never runs out)* | — | 1 *(floor)* | — | 2.9 → 2.6/min | any |

- The spread narrows as the ground slows: a tree next door pays 1.4× one at
  radius 4, an iron peak 1.1×. Fast ground rewards a close shed; slow ground
  does not care.
- Crops hold the law to within a hundredth. **Forest is authored at twice
  the law's recovery**: a tree supports 0.42 workers, so a Sawmill reaches a
  ring further (radius 2) to keep its crew of three fed
  ([`buildings.md`](buildings.md) §4.4).
- On slow ground the **floor** governs: ten seconds of work on a rock, an iron
  peak or a gold peak is 0.38, 0.83 and 0.50 units, so all three pay 1.
- A metal peak's richness is in the crew: five units a swing against one.
- **A crop plot is the `Crops` row**: a feature planted from the Build menu
  ([`27-plantables.md`](27-plantables.md)).

### 2.2 The ground under the cell

- Terrain multiplies what a cell **holds** (`stock`), per currency. A grassland
  tree holds 13 Wood, a snowy one 8, a desert one 5. A mountain holds no stock,
  so the ground under it changes nothing.
- The multiplier is a property of the terrain, not of the building, so a
  Forest, a FarmLands and a rock on the same ground all take it.
- It scales the stock, not the strike: `unitsPerStrike` is 1 on most cells and
  `1 × 0.75` rounds back to 1. Stock runs 10 to 30.
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
- The Stone column moves nothing while no Stone source holds stock.
- Poor ground is bad twice: the total per cycle scales with the multiplier,
  and recovery is a fixed cost. A desert tree (5 Wood) yields about 1.2
  Wood/min against a grassland tree's 2.3 (13 Wood); its workers-per-cell drops
  from 0.48 to 0.26, so a desert needs about four cells per worker.
- On the map as painted, Grassland holds 42 of the 50 trees (Plains 6, Snow
  2); Tundra holds none (OQ-56).

### 2.3 The map ceiling

- A cell's sustainable rate is `stock ÷ (drain + recovery)`, so the province has
  one too.
- At **50 trees** on the map as painted, sheds next door: **about 110
  Wood/min** is everything the province can grow, and **about 23 workers**
  collect all of it.
- Both figures move with the walk: farther sheds collect less of the same
  ceiling and need more bodies.
- The map editor's census counts cells per ring
  ([`../map-editor.md`](../map-editor.md)); computing this ceiling there,
  each cell weighted by its ground, is not built (OQ-50).

## 3. The tap

```
seconds = tap.workSeconds × the Harvest boost
owed    = seconds × unitsPerStrike ÷ secondsPerStrike
paid    = max(1, floor(owed + carry))     — capped by what the cell still holds
carry   = max(0, owed + carry − paid)
```

- **`tap.workSeconds` = 10**, global: a property of the thumb, not the ground.
  A ten-unit tree is about ten taps.
- `unitsPerStrike` here is the ground's chunk after `harvestYield` (§7) and a
  Sickle of Plenty's aura at the cell — the same chunk a worker strikes.
- The tree has a stat for the tap's duration (`tapWorkSeconds`); no
  technology carries it.
- **Carry**: the fractional remainder is carried per currency, so a +15%
  ladder on a one-unit cell pays an extra unit about every seventh tap. Four
  numbers, additive to the save.
- **Floor of one unit**: a tap never pays nothing. At this duration the floor
  covers four of the eight cells (§2.1).
- **The shortfall when the depot runs dry is not carried.** The last tap of a
  tree pays what is left; the rest is waste.
- An iron vein pays 1 a tap, not 5: its richness is in its five-unit swing,
  which is the crew's.
- A tap reads the cell's own rate, `unitsPerStrike ÷ secondsPerStrike`, with no
  travel term. It does not read `cityGatherPerSecond` (§4).
- A tap refused by a tech gate costs no Mana.

### 3.1 A tap on a building

- A tap on a building whose store is ready collects it, free; otherwise it
  opens the building ([`03-economy.md`](03-economy.md) §3.2).
- It never costs Mana and never pulls rent forward.

### 3.2 Taps that do not exist

- Training queues (villagers at the Townhall, soldiers at the halls) cannot be
  tapped. A timer is hurried with Gems or the Bag's speed-ups, never Mana.
- A tap on the Townhall collects its store or opens its card; it never hurries
  a villager.
- Paying fog is outside the convention: it costs Gold, not Mana, and buys
  cells, not production. A cell is five taps at every ring, so `tap.workSeconds`
  never touches it ([`01-map-and-fog.md`](01-map-and-fog.md) §5).

### 3.3 What a full pool is worth

A refill — a rewarded video or Gems — pays a whole pool
([`08-magic.md`](08-magic.md) §6).

- A pool is that many taps, and each tap is ten seconds of one worker's work:
  a 100-Mana pool is about 17 worker-minutes — about 5–6 minutes of a
  three-worker Sawmill at level 1.
- The pool grows with the Sanctum and the landmarks; the crew grows with the
  city's buildings and their levels, faster. Late, a pool is a smaller slice
  of a bigger city (OQ-126).
- `tap.workSeconds` is the ad's dial; halving it halves the ad. Whether that is
  worth six ad placements is **OQ-51**.
- The ad's job is the visit, not the day (OQ-43).

## 4. The strike and the haul

- A worker walks to its claimed cell, **strikes** it once, walks the load home,
  and goes out again: `Idle → MovingToCell → Working → MovingHome`.
- **Units leave the depot when the swing lands. They land in the building's
  store when the worker gets home**, and reach the wallet when the player
  collects it ([`03-economy.md`](03-economy.md) §3.2). A load in transit is
  real matter.
- **A full store keeps the crew at the door**: nobody sets out while there is
  no room. A load already on its way lands whole, even over capacity
  (OQ-107). Collecting, or a raid emptying the store, sends the crew out again
  from that moment.
- Nobody double-dips: tapping a tree a woodcutter just struck pays what is
  left. A cell can show a stump while its last load is still being carried.
- A carrying worker keeps its load when its building moves and walks to the new
  address (§5, [`05-city-and-districts.md`](05-city-and-districts.md) §4).
- Unassigning a loaded worker loses the load.
- The walk is the distance cost: 4.7 Wood/min from a tree next door against
  3.3 from one at radius 4. There is no per-distance penalty on the strike rate.
- **A producer's level buys speed, never reach or hands.** Its radius and its
  crew are the level-1 building's at every level; each level swings faster —
  ×1.25 at level 2 to ×2 at 5 and ×3 at 10 — and from level 6 every delivery
  carries **+1 unit**, to +5 at 10 ([`buildings.md`](buildings.md) §4.3–§4.6,
  §4.11). More ground or more hands is another building. Both are read off
  the crew's own building, and neither touches the tap: the thumb is not a
  crew.
- The tree adds to the crew alone: `crewStrikeSpeed` — Lumberjacks I
  (Sawmill), Farmhands I (Farm), Miners I (Quarry), Fishers I (Docks), +15%
  each — and `crewSlots`, Bunkhouse I (+1 worker).
- A strike is a simulation boundary. The renderer receives the strike event the
  sim emitted — the struck cell and its ground. Nothing about the feedback feeds
  back into the sim; offline replay produces the same strikes with no feedback.

Strike feedback:

- Same hit, same cell, same foley as the player's tap, at **half volume**,
  **without the white flash**, punch scaled to **0.55** of the player's.
- A strike punches the **cell**; a haul landing makes the building's collect
  bubble hop. It pops no number: the `+N` comes when the player collects.
- Audio: on-screen cells only; silent below zoom 0.8; at most three voices in
  flight, the rest dropped; ±5% extra pitch jitter.

Quests:

- A `collect` is banked when the units reach the wallet — a ground tap, or
  collecting a store — never when a haul lands. Only the thumb banks a `tap`. A strike never
  completes a `CollectTaps` goal (comment at both call sites, test in
  `quests.test.ts`). A `WorkerCollect` goal type is OQ-53.

`cityGatherPerSecond`:

- A **nominal** city-wide rate with a travel term that takes the influence
  radius as the distance, and with each building's own level in its haul and
  its cadence.
- The tap does not read it. Treasures and raids read it as the city's rate of
  a coin.

## 5. Areas of influence, claims and migration

- A worker building works cells **of its type** within its Chebyshev
  radius — the same at every level; `Surveying` widens it by a ring. Revealed
  cells only.
- The area is drawn while the building is selected or placed: a white line
  with rounded corners, and a light sky-blue glow inside it that is strongest
  against the line, fades most of a tile in, and breathes slowly. It lies over the floor and under what stands on it
  (mockup `../art/mockups/area-overlays/area-simple-2-two-tone.png`).
- **One worker per cell, globally.** `tryDispatch` takes the nearest unclaimed
  cell.
- A worker whose cell exhausts releases the claim and walks to another.
- The radius decides two things: the **gradient** (a tree next door pays 1.4×
  one at radius 4, §4) and **coverage** (how many cells of the right type the
  building reaches, which under two-cells-per-worker (§2.1) decides how many
  worker slots are ever busy, §6).
- **No reserve floor.** Workers empty cells; nothing stops them at a share of
  stock.
- **The thumb works the frontier; the crews work the covered ground.** With a
  crew matched to the map, essentially every live cell inside a radius is
  claimed, so newly revealed ground is where hand-play lives.
- A claim blocks other workers, not taps: the player can raid a tree their own
  woodcutter is felling, exhaust it early and send the worker walking. Whether
  that feels bad is OQ-52.

## 6. Idle workers

- Workers with no cell to claim, or whose building's store is full, wait
  **outside**, milling in the cells around their building: idle animation, no
  strikes, no destination.
- A worker moving with purpose is migrating; a knot of workers by a door is
  idle. No icon.
- The count lives in the district card only (`4/7` busy). Nothing on the map.
- When a stump becomes a tree, one of the loiterers heads for it.
- The `hands` lesson says it when a second Sawmill is crewed, and the
  `idleCrew` introduction points at the first crew standing about
  ([`23-tutorials.md`](23-tutorials.md) §3.2, §4.1).

## 7. The three actors

| Actor | Dial | Raises | Symptom it answers |
|---|---|---|---|
| **The ground** | abundance (`stock`), recovery, richness (`unitsPerStrike`) | what the map can give | "everything is a stump" · "they never stop walking" |
| **The thumb** | `tap.workSeconds`, the Harvest boost | seconds per tap | "I want it now" |
| **The payroll** | **the building's own level** (§4), `crewStrikeSpeed`, `crewSlots`, **where the shed sits** | units a trip, and how long the trip is | "I am collecting too slowly" |

- The cell-scoped ladders — Sawpits I–III (Forest), Irrigation I–II (Crops),
  Stonecutting I–II (Stone), Iron Picks I (iron), +15% a rank, and Deep Mining
  (gold), +25% — are a **percentage** of the ground's chunk (`harvestYield`),
  so they lift the tap and the worker alike; the fraction a strike owes
  carries to the next one.
- A producer's late level is the payroll-only dial for units: more units per
  strike empties cells faster, and it never reaches the tap.
- The city relics move the ground inside a Shrine's aura while activated:
  the Staff of Renewal (stock, recovery), the Sickle of Plenty (the chunk), the
  Winged Hammer (the crew's swing and walk)
  ([`09-relics.md`](09-relics.md) §2.1).
- Doubling `stock` and halving `recoverySeconds` both pay +29% rate. More stock
  means longer stays and less walking; faster recovery means a greener map and
  more migration.

## 8. Offline

- An absence is replayed **in full**, deterministically, by the same
  `advance()` the live tick runs: worker strikes, hauls, rent, cell
  recoveries, queues.
- There is no offline cap. What bounds an absence is each building's **store**
  ([`03-economy.md`](03-economy.md) §3.2): a building stops when its store is
  full.
- No player taps happen offline.

## 9. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Seconds a tap is worth | **10** | `tap.workSeconds` |
| The Harvest boost | +50% a tap, 1 h | `items` › `HarvestBoost1h` |
| Chunk and rhythm, per cell | §2.1 | `harvest.unitsPerStrike`, `.secondsPerStrike` |
| Stock, per cell | §2.1 | `harvest.stock` |
| Ground multiplier, per terrain × currency | §2.2 | `terrain` |
| Recovery, per cell | §2.1 | `harvest.recoverySeconds` |
| Respawn, finite features | 120 s Berries · 180 s Meat · 90 s Fish | `harvest.respawnSeconds` |
| Worker move speed | 1 tile/s | `worker.moveSpeedTilesPerSecond` |
| Influence radius, worker slots per level | §5 | `buildings` › `influenceRadiusPerLevel`, `maxWorkersPerLevel` |
| What a late level adds to a delivery, and to the swing | +1 and +10% a level from 6 | `buildings.extraUnitsPerDeliveryPerLevel`, `.strikeSpeedPerLevel` |
| Mana per tap on the ground | 1 | `tap.manaCost` |
| Strike punch, against the player's 1 | 0.55 | `STRIKE_PUNCH`, code |
| Strike volume · extra jitter · voices | ×0.5 · ±5% · 3 | `strikeFeedback`, code |
| Zoom below which a strike is silent | 0.8 | `STRIKE_AUDIBLE_ZOOM`, code |
| Store capacity, which bounds an absence | [`03-economy.md`](03-economy.md) §3.2 | `buildings` › `storageCapacityPerLevel` |

The relation to hold while tuning:
`secondsPerStrike ÷ unitsPerStrike ≈ 1.1 × (recoverySeconds ÷ stock)`,
or the workers-per-cell number drifts (§2.1).

## 10. Deliberately not in this design

- a held finger that repeats taps
- pathfinding
- continuous regrowth
- a per-distance strike penalty
- a worker reserve floor
- a tap that pulls rent forward
- a tap on training queues
- vaults or generators of any kind
- an offline cap
- offline tapping
- fractional wallets
- per-cell yield variety beyond the authored table
- permanent destruction of a renewable feature

**Open questions:** OQ-43, OQ-44, OQ-50, OQ-51, OQ-52, OQ-53, OQ-54, OQ-56,
OQ-107, OQ-126.
