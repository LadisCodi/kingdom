# 1 · The map and the fog

> **Scope.** The grid, its terrain and features, the three fog states, the paid
> reveal, and what the fog holds. The *scopes* the map splits into are
> [`02-map-scopes.md`](02-map-scopes.md).
>
> **Status: built**, but for the wisps of a tear and a reveal (§4.2). The map
> is authored in the map editor at `?dev=data#map`
> ([`../map-editor.md`](../map-editor.md)) and stored in
> `src/sim/data/region-map.json`.

## 1. The grid

- A square grid. Every cell has a **terrain**, optionally one **feature**, and
  can hold one district.
- The starter region is **Oakville** (`oakville`): 1,470 cells, an island
  ringed by sea plus two outer islands and a bay. Its last ring is 23.
- Three distance metrics coexist:

| Metric | Used for |
|---|---|
| **4-way von Neumann** | adjacency: fog state, the connected frontier, placement (diagonals are not adjacent) |
| **Chebyshev** | the Townhall's rings, a building's fog radii and area of influence, a lair's ground, sighting |
| **Euclidean** | worker travel time |

- **Every radius and ring is a square** on the grid, measured from the edge of
  the footprint. The 2:1 isometric projection draws a square as a diamond the
  shape of a tile.
- A ring ignores water: a cell across a bay is as far as it looks.

## 2. Terrain

Grassland, Plains, Tundra, Snow, Desert and Water. Terrain decides:

- whether a cell is buildable;
- which features may sit on it;
- which technology is needed to reveal it;
- **how much a cell holds** — a multiplier on its stock, per currency (full
  table in [`04-harvest.md`](04-harvest.md) §2.2):
  - **Grassland**: a tree holds 13 Wood against 10 on Plains.
  - **Desert**: a tree holds 5 Wood.
  - **Tundra**: Food as poor as Snow; Wood ×1.5.
  - **Snow**: poor in Food and Wood.
  - A mountain holds no stock, so the ground under it changes nothing.

Buildability:

- Every district builds on any land. A farm on sand is legal.
- **Water** is unbuildable except by the Docks, a 2×1 pier with one cell on
  land and one on water.
- **Water** needs **Sailing** to reveal, and is the **only** terrain that gates
  a reveal.
- A building's own fog radius **ignores** the tech gate; only a player's reveal
  tap is refused. A refused tap costs nothing.
- A mountain is a feature, not a terrain (§3). What makes a cell unbuildable is
  the feature standing on it.

## 3. Features

- At most one per cell.
- A cell's **identity** and the **currency it pays** are two different fields
  ([`03-economy.md`](03-economy.md) §2).
- Which technology opens a feature to the pick is the technology's unlock
  (`?dev=data#tree`).

| Feature | Pays | Per tap | Taps to exhaust | Recovery | Tech |
|---|---|---|---|---|---|
| **Forest** | Wood | 1 | 10 | recovers in place, 180 s | Forestry |
| **Crops** (a planted crop plot) | Food | 1 | 10 | recovers in place, 60 s | — |
| **Berries** | Food | 1 | 10 | used up; respawns on another cell in 120 s | Forestry |
| **Wild animals** | Food | **3** | 10 | used up; respawns on another cell in 180 s | Hunting |
| **Mountain** | Stone | 1 | never | — | Pickaxes |
| **Iron mountain** | Stone | **5** | never | — | **Mining** |
| **Gold mountain** | **Gold** | **3** | never | — | **Mining** |
| **Fish shoal** (on Water) | Food | 2 | 5 | used up; respawns on water in 90 s | — |

Mountains:

- Three mountains share one silhouette and differ in what the rock holds and
  which technology opens it. **No mountain runs out.**
- Pickaxes (chapter 2) opens the bare peak; Mining (chapter 3) opens iron and
  gold; Deep Mining raises the gold. A gated mountain is visible and refuses
  the tap; a refused tap costs no Mana.
- A gold mountain is the only Gold source on the map besides rent.
- **The Quarry works every mountain in its area of influence**, the way the
  Sawmill works every forest in its own. A district names its **harvest
  sources** (a list), a feature names one, and the worker search matches them.
- A mountain blocks a footprint like any other feature.

### 3.1 A feature that spans more than one cell

A feature may occupy a square **footprint**.

| | Footprint | How it is decided |
|---|---|---|
| **Mountain** | 1×1, 2×2, 3×3 | **grouped** from the painted cells |
| **Landmarks and lairs** | 1×1, 2×2, 3×3 | **authored**, per site (`size`, 1 unless stated) |
| **Abandoned buildings** | the building's own size, when square | the building |
| Everything else | 1×1 | — |

| Site | Cells |
|---|---|
| Every landmark (standing stones, leyspring) | 1×1 |
| Every lair | 2×2 |

- The footprint is **square**, and the feature is **drawn once** across the
  whole of it: never part-revealed.
- **Every cell of the footprint carries the feature.** It blocks placement on
  each, it is a harvest node on each, and the Quarry counts each one that falls
  inside its area of influence.

**Fog.**

- **Discovered when any one of its cells is.**
- A tap on any of its cells advances **all** of them. Still five taps
  (`fog.tapsToReveal`), whatever the size.
- **The price is the sum of its cells'**, so a tap charges a fifth of that.
  The floater on the tap says what it cost.
- **Any one cell is enough**, for the frontier and for the reach alike: the
  frontier only has to touch a corner, and one cell inside the Townhall's
  reach opens the whole of it.
- It clears **all at once**.

**Authoring.**

- Mountain cells are painted **one at a time** in the map editor. Nothing
  declares a footprint.
- The grouping is **derived from the painted cells** by one function the
  editor and the sim share (`src/sim/data/mapRules.ts`): greedy 3×3, then 2×2,
  then 1×1, in a fixed scan order. Same cells in, same grouping out.
- A landmark or a lair declares `size` on its own row. `validateRegionMap`
  refuses a size outside 1–3 and checks every cell of the footprint the way it
  checks a single one.
- Iron and gold mountains stay 1×1.

Respawn:

- A finite feature respawns rather than dying. `respawnTerrain` decides where:
  shoals wander across water, berries and game wander on grass.
- Placement is a deterministic hash of the event, never a stream.

## 4. The three fog states

| State | Meaning |
|---|---|
| **Undiscovered** | not drawn, or drawn as a silhouette (§4.1) |
| **Discovered** | drawn under mist (§4.2); terrain and feature visible, a treasure as a closed chest, an abandoned building as its ruin (§6.2, §6.3); may be paid to clear |
| **Revealed** | yours: buildable, tappable, workable |

- **The frontier stays connected.** A cell can be paid for only if it touches
  ground already revealed.
- **A tap past the frontier points at it.** A tap on a dark cell no path
  reaches, or on the dark beyond, shows the quest hint's hand on the nearest
  cell that can be cleared.
- A feature with a footprint (§3.1) is discovered when any one of its cells is,
  and revealed all at once.
- Every district has a `fogRevealRadius` and a `fogDiscoverRadius`. A finished
  building reveals its own ground and discovers a ring round it — 2; 1 for the
  military halls, the Infirmary and the War Camp; none for decorations, Shrines
  and crop plots. **Only the Townhall reveals a ring** — 1, and **3 from
  level 2**, landing the moment that upgrade does
  (`fogRevealRadiusPerLevel`). The rest of the map is paid for.
- Claiming a landmark discovers `fog.claimDiscoverRadius` = **5** rings around
  it: an 11×11 square. **Discovered, never Revealed.**
- Revealed outranks discovered: cells already revealed are never overwritten.
- **The Townhall is the reach.** A cell can be paid for only within
  `fog.reachPerTownhallLevel` rings of the Townhall, indexed by its level:
  **3 · 5 · 7 · 8 · 10 · 11 · 13 · 15 · 17 · 23**. Level 10 reaches the
  province's last ring.
- A building's fog radii and a claim's discover ring ignore the reach, the way
  they ignore Sailing. Only the player's tap is refused, and a refused tap
  costs nothing. The refusal names the Townhall level that reaches the cell.
- A Discovered cell past the reach stays visible under the mist and draws like
  a cell the frontier has not reached.
- **The reach is drawn** as the player's border: a line in their blue with a
  soft glow, along the last ring the player may pay for, over the fog and
  across undiscovered ground, under what stands on the ground. It disappears
  once the reach holds the whole province.

### 4.1 Sighting

A tall thing past the fog shows as a **silhouette** while a revealed cell
lies close enough to it.

| Thing | Sighted from | Setting |
|---|---|---|
| Mountain 1×1 · 2×2 · 3×3 | never · 4 · 5 | `fog.sight.mountainBySize` |
| Standing stones, leyspring | 3 | `fog.sight.landmark` |
| A lair not yet found | its own: Orcs, Harpies, Goblins, Wolf riders 3, Drake 4 | `sight` on the lair, in the map editor |
| An abandoned building (§6.3), as its ruin | its own: 3, the Watchtower's 4 | `sight` on the building, in the map editor |
| Forests, berries, game, shoals | never | — |

- **Measured from revealed cells only**, Chebyshev, to the nearest cell of its
  footprint. Discovered cells do not see.
- A lair's sight reaches past its ground (`radius`), or it is 0 and never
  sighted (`mapRules.ts`).
- **A silhouette is the thing's own drawing as one flat, pale shape** rising
  out of the cloud tops: no name, no badge, no bubble.
- It stops being a silhouette once any cell of it is Discovered — a lair once
  it is found, an abandoned building once repaired — and draws as itself.
- **It ignores the Townhall's reach and the exploration gates.**
- **It is not a discovery**: no banner, no quest progress; a lair is not found
  and starts no raid clock.
- A tap on a silhouette says *Something stands in the dark — clear the fog
  towards it*, and costs nothing.
- A scene may wait on it: the `sighted` condition
  ([`24-dialogue.md`](24-dialogue.md) §5).

### 4.2 How the fog is drawn

**A sunlit sea of clouds**, not darkness
([`../art/art-direction.md`](../art/art-direction.md) §8.1, target
[`../art/mockups/fog/sea-of-clouds.png`](../art/mockups/fog/sea-of-clouds.png)):

| State | Drawn as |
|---|---|
| Revealed | full colour |
| Discovered, payable | a thin veil of mist, the ground seen through it, desaturated |
| Discovered, not payable | a low cushion of cloud, almost opaque; only tall things' tips show |
| Undiscovered | the cloud bank, its edge the outline of the clouds |

- The fog thickens step by step away from the cleared ground, so the cells a
  tap can buy read at a glance.
- Every fogged cell carries its own mist, so the grid reads cell by cell.
- A tap tears the mist; a reveal blows it away and the colour comes back.
  *Not built: the wisps of the tear and of the reveal.*

## 5. The price of a cell

Authored per ring out to ring 14, with a ×1.37 fallback per ring past it
(`fog.rings`, `fog.fallbackGrowth`). The province reaches ring 23.

| Distance | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| **Gold** | 4 | 8 | 20 | 85 | 220 | 990 | 2,400 |

| Distance | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15+ |
|---|---|---|---|---|---|---|---|---|
| **Gold** | 6,600 | 18,000 | 45,000 | 130,000 | 320,000 | 990,000 | 2,800,000 | ×1.37/ring |

- **A cell is five taps at every ring** (`fog.tapsToReveal`). Each tap
  charges a fifth of the cell's Gold.
- A footprint is five taps too, and costs **the sum of its cells** (§3.1).
- **The map gets dearer as it is revealed.** The ring price is multiplied by
  `fog.countGrowth` (**×1.05**) once per `fog.countStep` (**10**) cells
  already revealed. Every revealed cell counts — seeded, built around or paid
  — the same count the chapter bars read
  ([`07-research.md`](07-research.md) §2.1). A fresh kingdom's 16 seeded cells
  already sit in the second step.
- The order: ring price × count multiplier, then the floor `fog.minCost`.
  **No technology discounts the fog.** Nothing buys a tap back.
- A price five does not divide is split into slices that still sum to it
  exactly, never rounded either way.
- **Every tap that takes tears a fifth of the cell's mist away**, the last
  one blowing it off — every cell of a block at once (§4.2). A refused tap
  tears nothing.
- At ×1 the whole map is about **7.6 billion Gold across 1,466 priced
  cells**, most of it in the outer third; the count multiplier only raises
  it. It is the largest Gold sink in the game. What limits how fast it is
  spent is the Townhall's reach in the first week and the purse after
  (`tests/thirtyDays.test.ts`).

## 6. What the fog holds

| Found in the fog | Count | Gives | Verb |
|---|---|---|---|
| **Resources** | 164 feature cells | Wood, Stone, Food, Gold | tap / work |
| **Landmarks** | 6 | **+10 max Mana** for good, a Knowledge lump, and a discover ring | claim, for Gold |
| **Lairs** | 5 | its hoard back, Hero XP, a Knowledge lump, Bag items, relic fragments and the ground it held | find it, beat its path of fights, claim |
| **Treasures** | one every five cells revealed | a coin; every 4th also a Bag item, every 6th a city relic fragment (§6.2) | reveal its cell, tap to pick up |
| **Abandoned buildings** | 7 | a building, once repaired (§6.3) | repair |

- A landmark permanently enlarges the Mana pool (`mana.landmarkCap`), so every
  future refill — the ad reward included, which is a whole pool — is larger.
  Its Knowledge lump is `knowledge.landmarkClaimLump` (3).
- A lair is cleared once and is gone; repeatable dungeons are the world
  map's ([`19-world-map.md`](19-world-map.md)).
- Neither landmarks nor lairs are visible when a kingdom begins. Sites draw
  through the Discovered mist once discovered.
- **A site coming into view is announced once**, by a banner — unless a
  scene introduces it ([`23-tutorials.md`](23-tutorials.md)), which then says
  it instead. A resource is never announced.
- **Every lair holds a garrison.** Finding it starts its raid clock; it
  raids until it is beaten
  ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md)). A landmark has
  no guard: it is claimed for its Gold.
- **A landmark inside a standing lair's ground cannot be claimed**
  (`LairHeld`).

### 6.1 How the province opens

The near map is laid out so the first Townhalls look one way at a time
(`tests/provinceLayout.test.ts`):

- **South first.** The Thorned Shrine's ruin (4 rings) is sighted from the
  first ring. While the Townhall is at level 1 the sites in sight are the
  Shrine's ruin to the south, the Watchtower's ruin to the north, and — from
  ring 3, the first Townhall's last — the Orcs' camp.
- **The Orcs** (6 rings, south, past the Shrine). Their ground (radius 2)
  starts at ring 4 and holds the Shrine, so they are found at Townhall 2 and
  cleared before the Shrine can be repaired.
- **The Orcs are the only lair Townhall 2 can find.** Every other lair's
  ground lies past its reach, so the first fight is theirs.
- **The Harpies guard the gold.** Their camp is 8 rings north-east; their
  ground (radius 2) starts at ring 6: past Townhall 2's reach, inside
  Townhall 3's. It holds the first gold vein (6 rings) and every big mountain
  Townhall 2 reaches. They show from Townhall 2's last ring.
- **One loose stone node** stands 4 rings out, to the north-west, on no lair's
  ground: the only stone free inside Townhall 2's reach.
- **The Watchtower's ruin** (5 rings north, on no lair's ground) is sighted
  from Townhall 1's ground and reached at Townhall 2 (§6.3). The Fallen
  Stones (7 rings), the nearest landmark, are sighted from ring 4.

### The landmarks

Claim costs are **authored per landmark**, not derived from distance.

| Landmark | Kind | Ring | Cost |
|---|---|---|---|
| Fallen Stones | standing stones | 7 | **10,000** |
| Sunken Leyspring | leyspring | 8 | 25,000 |
| Whispering Stones | standing stones | 12 | 25,000 |
| Bright Leyspring | leyspring | 13 | 25,000 |
| Mirror Leyspring | leyspring | 10 | 100,000 |
| Circle of Nine | standing stones | 11 | 100,000 |

### The five lairs

| Lair | Tier | Ring | Ground (`radius`) | Sight |
|---|---|---|---|---|
| Orc Lair | I | 6 | 2 | 3 |
| Harpy Roost | II | 8 | 2 | 3 |
| Goblin Den | III | 19 | 2 | 3 |
| Wolf-rider Camp | IV | 14 | 2 | 3 |
| Drake's Lair | V | 14 | 3 | 4 |

- The first two are the ones a month of play reaches. The last three are deep
  province, and their order is not the tier order.
- Full lair design: [`18-garrisons-and-raids.md`](18-garrisons-and-raids.md);
  the fights are [`combat.md`](combat.md).

### 6.2 Treasures

What the people who fled left on the ground, found at a steady pace in
whatever direction the player explores.

- **One is due every `treasure.everyReveals` (5) cells the player pays to
  reveal**, the first on the very first. A cell revealed by a building or a
  claim does not count.
- **It lands in a cell that reveal discovered** — one of the neighbours that
  just turned Discovered, bare ground before a feature, chosen by
  `rand(seed, n)` for the kingdom's n-th treasure. The cell must be one the
  player can pay for now: inside the reach, dry unless Sailing is known, and
  not under a site, an abandoned building or a feature that spans cells.
- **No newly discovered cell qualifies?** It takes another Discovered
  neighbour of the cell just revealed; failing that, it waits for the next
  paid reveal. One reveal places one treasure at most.
- **Discovered, it shows as a closed chest** under the mist.
- **Revealing its cell opens it**: its coin rises out of the chest under a
  glint. **A tap picks it up, free** — no Mana. On a cell with a feature the
  first tap picks up the treasure and the next harvests; a forest still closed
  by Forestry gives its treasure.
- **A treasure is one coin the plank already shows**: Gold, Food, Wood, or
  Stone once Stone is on the plank, by `treasure.weights`, rolled for the n-th
  treasure; rarely Knowledge, which lands over the bar's cap like a lump.
- **It pays `treasure.workSeconds` of the kingdom's production of its coin**,
  floored at `treasure.floor`, priced when it is picked up. Knowledge pays a
  fixed `treasure.knowledge`. **The first is fixed** — 20 Gold
  (`treasure.firstCoin`, `treasure.firstAmount`) — for the First Morning
  ([`23-tutorials.md`](23-tutorials.md) §3).
- **Every `treasure.itemEvery`-th (4th) also brings a Bag item**, by
  `treasure.items` weights: a 10-minute Gold, Food, Wood or Stone chest, or a
  5-minute speed-up.
- **Every `relics.fragments.treasureEvery`-th (6th) also brings a city relic
  fragment** ([`09-relics.md`](09-relics.md)).
- It waits for ever, discovered or revealed. Workers never take it; placing
  a building on its cell picks it up.

### 6.3 Abandoned buildings

The village the fog swallowed: buildings standing in ruin where the fog took
them, to be found and repaired.

- **Authored in the map editor**: a building from `buildings`, its cell, its
  `sight` and the name its card and banner carry, the same for every kingdom.
- **Every building has its own ruined drawing** of its level 1
  (`<sprite>_ruin.png`).
- **It is found the way a landmark is**:

| Fog | Shows |
|---|---|
| Undiscovered, out of sight | nothing |
| Undiscovered, in sight (§4.1) | **the silhouette of its ruin** — something stands there, not what |
| Discovered | its ruin under the mist, and a banner names it (*An abandoned Sawmill!*) unless a scene says it instead |
| Revealed | its ruin, and a tap opens its card |

- A footprint is revealed all at once, priced as a feature's (§3.1).
- **Its card** says what the building is and what it does, and offers
  **Repair**.
- **Repairing it is building it at level 1, where it stands**: the level-1
  cost at the next ordinal and a builder
  ([`05-city-and-districts.md`](05-city-and-districts.md) §3,
  [`06-construction.md`](06-construction.md) §1). It is refused as a build is
  — no builder free, the count cap reached, a coin short, a lair holding its
  ground.
- **A repair has its own wait**, flat (`buildings` ›
  `repairDurationSeconds`): **5 s** for the House, Farm and Sawmill. 0 means
  a build's wait — the Watchtower and the Shrine. A plot grows instead, for
  the crop's `growSeconds` (5 s).
- **A ruin may be missing a piece** (`buildings` › `repairItem`): repairing
  it also asks for that item from the Bag, and spends it. **The Watchtower**
  is the one: it needs **the Watchtower's lens**, which the Orcs' claim hands
  over. Repaired — 200 Gold, 100 Wood, one minute — it discovers **8 rings**
  round it, adds +10 max Mana and a landmark's Knowledge lump, opens the world
  door and the Atlas, and lets prices ask for precious materials
  ([`22-progression.md`](22-progression.md) §5).
- **No technology is asked.** The technology that unlocks a building opens
  building more of it; its levels stay gated as for any other.
- **While abandoned it only takes up its cells**: no production, store, crew,
  area, adjacency or Harmony, no place in the count cap, and it cannot be
  moved.
- **Once the repair starts it is that building**: stamped with its ordinal,
  under construction, then finished at level 1, revealing and discovering its
  ground and in every way one the player built.
- **The seven**, each in sight of the ground the Townhall reaches when it is
  needed:

| Building | Where |
|---|---|
| **the old House** (the Millers' house) | ring 3, past the first forest |
| **two old plots** (FarmLands — repaired, each plants a crop plot) | ring 3, by the berries |
| **the old Farm** | ring 3, past the berries, two steps from the plots — out of their reach until it is moved ([`23-tutorials.md`](23-tutorials.md) §3.1) |
| **the old Sawmill** | ring 3, at the edge of a wood, clear of the Townhall |
| **the Thorned Shrine** | ring 4, south, on the Orcs' ground — the first host for a city relic ([`09-relics.md`](09-relics.md)) |
| **the old Watchtower** (`NorthWatch`) | ring 5, north |

- **Every abandoned building can be repaired at the Townhall level whose reach
  first covers it**: the count cap at that level leaves room for every
  abandoned one of its kind inside that reach (`mapRules.ts`).

## 7. Where the map is authored

- **`?dev=data` is the source of truth for every number; the map editor is the
  source of truth for the map.**
- Terrain, features, landmarks, lairs and abandoned buildings live in
  `src/sim/data/region-map.json`, painted at `?dev=data#map`
  ([`../map-editor.md`](../map-editor.md)).
- What a legal map is lives in one module, `mapRules.ts`, checked by the
  editor, the save endpoint and a test.
- Fog ring prices are numbers: `fog.rings` in the `exploration` settings.
- **The lair roster is fixed in code** (`LairId` is a union): a lair can be
  moved and retuned but not added.
- Landmarks have no code-side identity beyond their `kind`; they are fully
  editable.
- Every lair carries a `guard` — threat, power, its first-raid warning in
  minutes and, optionally, a `mix`
  ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md) §2). Landmarks
  carry none.

## 8. Dials, in the order to reach for them

| Dial | Value | Where |
|---|---|---|
| Fog price per ring | 4 → 2,800,000, ×1.37 past ring 14 | `fog.rings`, `fog.fallbackGrowth` |
| How far each Townhall level lets the fog be paid for | 3 · 5 · 7 · 8 · 10 · 11 · 13 · 15 · 17 · 23 rings | `fog.reachPerTownhallLevel` |
| How much dearer the map gets as it is revealed | ×1.05 every 10 cells | `fog.countStep`, `fog.countGrowth` |
| Taps to clear a cell | 5 | `fog.tapsToReveal` |
| The floor under a cell's price | 1 | `fog.minCost` |
| Claim discover radius | 5 | `fog.claimDiscoverRadius` |
| The Watchtower's discover radius | 8 | `buildings` › Watchtower › `fogDiscoverRadius` |
| How often a treasure is due | every 5 cells revealed | `treasure.everyReveals` |
| What a treasure pays | 120 s of the kingdom's production, floored at 10 Gold · 5 Food · 5 Wood · 5 Stone | `treasure.workSeconds`, `treasure.floor` |
| Which coin a treasure is | Gold 3 · Wood 3 · Food 3 · Stone 2 · Knowledge 1 (1 point) | `treasure.weights`, `treasure.knowledge` |
| Which treasures bring a Bag item, and which | every 4th; chests and a speed-up by weight | `treasure.itemEvery`, `treasure.items` |
| Which treasures bring a city relic fragment | every 6th | `relics` › `fragments.treasureEvery` |
| The first treasure | 20 Gold | `treasure.firstCoin`, `treasure.firstAmount` |
| Max Mana and Knowledge a landmark pays | +10 · 3 | `mana.landmarkCap`, `knowledge.landmarkClaimLump` |
| Where the abandoned buildings stand | §6.3 | the map editor |
| How long a ruin's repair takes | 5 s (House, Farm, Sawmill) · a build's (0) | `buildings` › `repairDurationSeconds` |
| What a ruin is missing | the Watchtower's lens | `buildings` › `repairItem` |
| How far a tall thing is sighted past the fog | §4.1 | `fog.sight` |
| A building's reveal / discover radius | 0 / 2 (the Townhall 1, then 3 from level 2 / 2) | `buildings` › `fogRevealRadius`, `fogRevealRadiusPerLevel`, `fogDiscoverRadius` |
| Landmark claim costs | 10,000 / 25,000 / 100,000 | the map editor |
| A lair's guard, ground and sight | [`18-garrisons-and-raids.md`](18-garrisons-and-raids.md) §2 | the map editor |
| Feature yields, taps, recovery | §3 | `harvest` |
| Which features may span cells, and how far | Mountain, up to 3×3 | §3.1, `definitions.ts` |

## 9. Deliberately not in this design

- Server-authoritative fog on the province
  ([`02-map-scopes.md`](02-map-scopes.md) §3).
- Pathfinding.
- A procedural region generator ([`02-map-scopes.md`](02-map-scopes.md) §1.1).
- A `Mountain` terrain or a `Rocks` feature.
- A Mine district.
- A mountain that runs out.
- A distance curve for landmark costs.
- A technology that discounts the fog or buys reveal taps back.
- Non-square or non-contiguous footprints (§3.1).
- A footprint revealed cell by cell.
- Footprints on iron and gold mountains, on forests, or on anything else that
  is a mass of small objects rather than one thing.
- Line of sight: nothing hides a silhouette (§4.1).
- A silhouette that says which ore or which landmark it is, or a banner when
  one appears.
- A treasure placed by the map, or one the player cannot pay to reach.
- A treasure that expires, or one a worker picks up.
- An abandoned building above level 1, or one repaired for less than a build.
- A generic ruin: an abandoned building is always seen as the building it is.

**Open questions:** OQ-49, OQ-50, OQ-92, OQ-120 in
[`../open-questions.md`](../open-questions.md).
