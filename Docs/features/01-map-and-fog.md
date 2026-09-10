# 1 · The map and the fog

> **Scope.** The grid, its terrain and features, the three fog states, the paid
> reveal, and what the fog holds. The *scopes* the map splits into are
> [`02-map-scopes.md`](02-map-scopes.md).
>
> **Status: built.** The map is authored in the `?dev=map` editor
> ([`../map-editor.md`](../map-editor.md)) and stored in
> `src/sim/data/region-map.json`.

## 1. The grid

- A square grid. Every cell has a **terrain**, optionally one **feature**, and
  can hold one district.
- The starter region is **Oakville**: 1,470 cells, an island ringed by sea plus
  two outer islands and a bay.
- Three distance metrics coexist:

| Metric | Used for |
|---|---|
| **4-way von Neumann** | fog state, placement, BFS distance from the Townhall (diagonals are not adjacent) |
| **Chebyshev** | a building's area of influence |
| **Euclidean** | worker travel time |

- Distance from the Townhall is a **BFS over walkable cells**, not a straight
  line: a cell across water is as far as the walk around it.

## 2. Terrain

Grassland, Plains, Tundra, Snow, Desert and Water. Terrain decides:

- whether a cell is buildable;
- which features may sit on it;
- which technology is needed to reveal it;
- **how much of a given resource the ground under a cell holds** (a multiplier
  on a cell's stock, full table in [`04-harvest.md`](04-harvest.md) §2.2):
  - **Grassland**: a tree is worth 13 Wood against a plain 10.
  - **Desert**: 5 Wood, 8 Stone.
  - **Tundra**: as poor as Snow at food; timber and stone at ×1.5 each.
  - **Snow**: poor in everything.

Buildability:

- Every district builds on any land. A farm on sand is a bad farm, not an
  illegal one.
- **Water** is unbuildable except by the Docks, a 2×1 pier with one cell on
  land and one on water.
- **Water** needs **Sailing** to reveal, and is the **only** terrain that gates
  a reveal.
- A building's own fog radius **ignores** the tech gate; only a player's reveal
  tap is refused. A refused tap costs no Mana.
- A mountain is a feature, not a terrain (§3). What makes a cell unbuildable is
  the feature standing on it.

## 3. Features

- At most one per cell.
- A cell's **identity** and the **currency it pays** are two different fields
  ([`03-economy.md`](03-economy.md) §2).

| Feature | Pays | Per tap | Taps to exhaust | Recovery | Tech |
|---|---|---|---|---|---|
| **Forest** | Wood | 1 | 10 | 90 s | Forestry |
| **Crops** (a built FarmLands) | Food | 1 | 10 | 60 s | — |
| **Berries** | Food | 1 | 10 | finite, respawns in 120 s | Forestry |
| **Wild animals** | Food | **3** | 10 | finite, respawns | Hunting |
| **Mountain** | Stone | 1 | 5 | 120 s | — |
| **Iron mountain** | Stone | **5** | 5 | **300 s** | **Mining** |
| **Gold mountain** | **Gold** | **3** | 5 | **300 s** | **Deep Mining** |
| **Fish shoal** (on Water) | Food | 2 | 5 | finite, respawns on water | — |

Mountains:

- Three mountains share one silhouette and differ in what the rock holds, which
  research opens it and how long it takes to recover:

| | Pays | Opened by | Role |
|---|---|---|---|
| **Mountain** | Stone, 1 | — | the everyday building material |
| **Iron mountain** | Stone, **5** | **Mining** | the same material, five times over |
| **Gold mountain** | **Gold**, 3 | **Deep Mining** | the only Gold source on the map outside housing taxes |

- A mountain blocks a footprint like any other feature. No placement rule of its
  own.
- The bare peak is free to tap from the first second. The gate is on the
  **metal**: Mining for iron, Deep Mining for gold. An iron mountain is visible
  and refusing before Mining; a refused tap costs no Mana. Scaling Tools
  ([`07-research.md`](07-research.md)) gates nothing on the map.
- **The Quarry cuts Stone from every mountain in its area of influence, the way
  the Sawmill takes Wood from every forest in its own.** One building works all
  three mountains; a district's harvest source is a list. A district names a
  **harvest source**, a feature names the same one, and the worker search
  matches them.
- A mountain exhausts like every other feature: **exhaustion is the only
  throttle on stone**. A bare peak recovers in two minutes, a metal one in
  **five**.
- Gold from a gold mountain is a second faucet beside housing taxes: a level-1
  Quarry with three men on gold is about 45 Gold a minute against roughly 120
  from a Townhall-1 city's rent ([`03-economy.md`](03-economy.md) §3).
- `DeepSeams` asks for Mining only after `Bureaucracy` is done and the
  Knowledge for it has been paid in ([`12-quests.md`](12-quests.md)). A test
  walks the chain with zero drip to prove a follower is never short.

Respawn:

- A finite feature respawns rather than dying. `respawnTerrain` decides where:
  shoals wander across water, berries wander on grass.
- Placement is a deterministic hash of the event, never a stream
  ([`../implementation-plan.md`](../implementation-plan.md) §1).

## 4. The three fog states

| State | Meaning |
|---|---|
| **Undiscovered** | not drawn |
| **Discovered** | drawn under a scrim; terrain and feature visible; may be paid to clear |
| **Revealed** | yours: buildable, tappable, workable |

- **The frontier stays connected.** A cell can be paid for only if it touches
  ground already revealed.
- Every district has a `fogRevealRadius` (1) and a larger `fogDiscoverRadius`
  (2): finishing a build reveals a ring and discovers a wider one.
- Claiming a landmark discovers `fog.claimDiscoverRadius` = **5** cells around
  it: an 11×11 square, ~100 cells. **Discovered, never Revealed.**
- Revealed outranks discovered: cells already revealed are never overwritten.
- **The Townhall is the reach.** A cell can be paid for only within
  `fog.reach_per_townhall_level` BFS rings of the Townhall, indexed by its
  level: **3 · 6 · 8 · 10 · 12 · 14 · 17 · 20 · 24 · 40**. Level 10 reaches the
  province's last ring.
- A building's fog radii and a claim's discover ring ignore the reach, the way
  they ignore Sailing. Only the player's tap and a Divination are refused, and a
  refused tap costs nothing.
- A Discovered cell past the reach stays visible under the scrim and draws like
  a cell the frontier has not reached.
- **The reach is drawn**: a dashed line along the last ring the player may pay
  for, over the fog and across undiscovered ground, so the border is read off
  the map before a tap is refused. It disappears once the reach holds the
  whole province.

## 5. The price of a cell

Authored per ring out to ring 20 — roughly doubling from ring 3, exactly
doubling from ring 10 — with a ×1.25 fallback past ring 20. The province
reaches ring 40.

| Distance | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| **Gold** | 3 | 5 | 10 | 20 | 40 | 75 | 120 | 250 | 500 | 1,000 |

| Distance | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21+ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Gold** | 2,000 | 4,000 | 8,000 | 16,000 | 32,000 | 64,000 | 128,000 | 256,000 | 512,000 | 1,024,000 | ×1.25/ring |

- **A cell is five taps at every ring** (`fog.tapsToReveal`). What the ring
  decides is what each tap CHARGES: a fifth of the cell's Gold.
- **The map gets dearer as it is revealed.** The ring price is multiplied by
  `fog.count_growth` (**×1.05**) once per `fog.count_step` (**10**) cells
  already revealed. Every revealed cell counts — seeded, built around or
  divined — the same count the era bars read
  ([`07-research.md`](07-research.md) §2.1). A fresh kingdom's 16 seeded cells
  already sit in the second step.
- The order: ring price × count multiplier, then **Pitons** (−10%/level), then
  the floor. A cell never costs less than `fog.minCost`, however deep the
  discounts go. Nothing buys a tap back.
- Every ring price from 2 out is a multiple of five. A price five does not
  divide — ring 1, a multiplied one, a discounted one — is split into slices
  that still sum to it exactly, never rounded either way.
- Hold-to-repeat covers reveal taps.
- At ×1 the whole map is **4,729,789,354 Gold across 1,466 priced cells**, and
  the outer third of it is most of that; the count multiplier only raises it.
  It is the largest Gold sink in the game by three orders of magnitude. What
  limits how fast it is spent is the Townhall's reach in the first week and the
  purse after (`tests/thirtyDays.test.ts`).

## 6. What the fog holds

| Found in the fog | Count | Gives | Verb |
|---|---|---|---|
| **Resources** | 42 features | Wood, Stone, Food | tap / work |
| **Landmarks** | 10 | **+10 max Mana**, permanently, and a discover ring | clear, then claim |
| **Ruins** | 5 | card packs, Stardust, hero fragments — a ladder of rooms | clear the gate, then take the rooms |

- A landmark permanently enlarges the Mana pool, so every future refill
  (including the ad reward, which is a whole pool) is larger.
- A revealed ruin is a repeatable dungeon node, not a one-time pickup.
- Neither landmarks nor ruins are visible when a kingdom begins. Sites draw
  through the Discovered scrim once discovered.
- **Every ruin opens with a gate.** Discovering it starts a counter; clear the
  gate before it raids, and the ruin's rooms are yours to take
  ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md)). A landmark has
  no guard: it is claimed for its Gold.

### The landmark tiers

Costs are **authored per sanctuary**, not derived from distance.

| Tier | Cost | Count |
|---|---|---|
| The near one | **2,000** | 1 |
| The middle ring | **25,000** | 5 |
| The far ring | **100,000** | 4 |

- The nearest sanctuary is the cheapest; the far ring is the dearest.

### The five ruins

| Ruin | Tier | Artifact | Ring |
|---|---|---|---|
| Hollow Barrow | I | Dowsing Rod | 6 |
| Sunken Chapel | II | Verdant Seal | 11 |
| Drowned Ironworks | III | Foreman's Sigil | 34 |
| The Counting House | IV | Gilded Ledger | 21 |
| Star Observatory | V | Wanderer's Compass | 30 |

- The first two are the ones a month of play reaches, and they sit on the fog
  curve's near half. The last three are deep province: past ring 20 a single
  cell costs six figures (§5), so meeting them is a late-game project and
  their order is not the tier order.
- Full ruin design: [`11-expeditions.md`](11-expeditions.md); the fights are
  [`combat.md`](combat.md).

## 7. Where the map is authored

- **The workbook is the source of truth for every number; the map editor is the
  source of truth for the map.**
- Terrain, features, landmarks and ruins live in
  `src/sim/data/region-map.json`, painted in `?dev=map`
  ([`../map-editor.md`](../map-editor.md)).
- What a legal map is lives in one module, `mapRules.ts`, checked by the
  editor, the save endpoint and a test.
- Fog ring prices stay in the workbook.
- **The ruin roster is fixed in code** (`RuinId` is a union): a ruin can be
  moved and retuned but not added.
- Landmarks have no code-side identity beyond their `kind`; they are fully
  editable.
- Every ruin carries a `guard` — threat, power, and its two counters in
  minutes ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md) §2).
  Landmarks carry none.

## 8. Dials, in the order to reach for them

| Dial | Value | Where |
|---|---|---|
| Fog price per ring | 3 → 1,024,000, ×1.25 past ring 20 | `FogRings` sheet |
| How far each Townhall level lets the fog be paid for | 3 · 6 · 8 · 10 · 12 · 14 · 17 · 20 · 24 · 40 rings | `fog.reach_per_townhall_level` |
| How much dearer the map gets as it is revealed | ×1.05 every 10 cells | `fog.count_step`, `fog.count_growth` |
| Taps to clear a cell | 5 | `fog.taps_to_reveal` |
| The floor under a cell's price | 1 | `fog.min_cost` |
| Claim discover radius | 5 | `fog.claim_discover_radius` |
| A building's reveal / discover radius | 1 / 2 | `Districts` sheet |
| Landmark claim costs | 2,000 / 25,000 / 100,000 | the map editor |
| A site's guard and its counters | [`18-garrisons-and-raids.md`](18-garrisons-and-raids.md) §2 | the map editor |
| Feature yields, taps, recovery | §3 | `Harvest` sheet |
| The world itself | — | `?dev=map` |

## 9. Deliberately not in this design

- Server-authoritative fog on the shared world map
  ([`02-map-scopes.md`](02-map-scopes.md) §2).
- Pathfinding.
- A procedural region generator ([`02-map-scopes.md`](02-map-scopes.md) §1.1).
- A `Mountain` terrain or a `Rocks` feature.
- A Mine district.
- A `base × growth^distance` curve for landmark costs.
- A technology that buys reveal taps back. A cell is five presses at every
  ring, so there is no tap ladder left to climb.

**Open questions:** OQ-49, OQ-50, OQ-92 in
[`../open-questions.md`](../open-questions.md).
