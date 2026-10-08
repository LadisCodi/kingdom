# 1 · The map and the fog

> **Scope.** The grid, its terrain and features, the three fog states, the paid
> reveal, and what the fog holds. The *scopes* the map splits into are
> [`02-map-scopes.md`](02-map-scopes.md).
>
> **Status: built**, but for the wisps of a tear and a reveal (§4.2,
> [`../implementation-plan.md`](../implementation-plan.md) Step 11). The map is
> authored in the map editor at `?dev=data#map`
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
| **4-way von Neumann** | adjacency: fog state, the connected frontier, placement (diagonals are not adjacent) |
| **Chebyshev** | the Townhall's rings, a building's fog radii and area of influence |
| **Euclidean** | worker travel time |

- **Every radius and ring is a square** on the grid, measured from the edge of
  the footprint. The 2:1 isometric projection draws a square as a diamond the
  shape of a tile, so what the fog uncovers grows as evenly up and down the
  screen as across it.
- A ring ignores water: a cell across a bay is as far as it looks.

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
| **Crops** (a planted crop plot) | Food | 1 | 10 | 60 s | — |
| **Berries** | Food | 1 | 10 | finite, respawns in 120 s | Forestry |
| **Wild animals** | Food | **3** | 10 | finite, respawns | Hunting |
| **Mountain** | Stone | 1 | never | — | Pickaxes |
| **Iron mountain** | Stone | **5** | never | — | **Mining** |
| **Gold mountain** | **Gold** | **3** | never | — | **Mining** |
| **Fish shoal** (on Water) | Food | 2 | 5 | finite, respawns on water | — |

Mountains:

- Three mountains share one silhouette and differ in what the rock holds and
  which research opens it. **No mountain runs out**:

| | Pays | Opened by | Role |
|---|---|---|---|
| **Mountain** | Stone, 1 | **Pickaxes** | the everyday building material |
| **Iron mountain** | Stone, **5** | **Mining** | the same material, five times over |
| **Gold mountain** | **Gold**, 3 | **Mining** | the only Gold source on the map outside housing taxes: a Mana sink for Gold |

- A mountain blocks a footprint like any other feature. No placement rule of its
  own.
- The bare peak answers a pick once **Pickaxes** is researched — taught
  just before the first upgrade that costs Stone, the House's second story
  ([`23-tutorials.md`](23-tutorials.md) §3.1). The metal is gated further:
  Mining, in chapter 3, opens iron and gold; Deep Mining raises the gold.
  A gated mountain is visible and refusing; a refused tap costs no Mana.
- **The Quarry cuts Stone from every mountain in its area of influence, the way
  the Sawmill takes Wood from every forest in its own.** One building works all
  three mountains; a district's harvest source is a list. A district names a
  **harvest source**, a feature names the same one, and the worker search
  matches them.
- A mountain exhausts like every other feature: **exhaustion is the only
  throttle on stone**. A bare peak recovers in two minutes, a metal one in
  **five**.
- Gold from a gold mountain is a second faucet beside housing taxes: a level-1
  Quarry with three men on gold is about 8 Gold a minute against roughly 120
  from a Townhall-1 city's rent ([`03-economy.md`](03-economy.md) §3).
- `DeepSeams` asks for Mining only after `Bureaucracy` is done and the
  Knowledge for it has been paid in ([`12-quests.md`](12-quests.md)). A test
  walks the chain with zero drip to prove a follower is never short.

### 3.1 A feature that spans more than one cell

Some features are **one object**, not a mass of small ones. A forest is a stand
of trees on this cell and another stand on the next; a mountain is a mountain.
So a feature may occupy a square **footprint**.

| | Footprint | How it is decided |
|---|---|---|
| **Mountain** | 1×1, 2×2, 3×3 | **grouped** from the painted cells |
| **Landmarks and lairs** | 1×1, 2×2, 3×3 | **authored**, per site (`size`, 1 unless stated) |
| Everything else | 1×1 | — |

A mountain is painted, so its blocks are derived; a landmark or a lair is
PLACED, so it carries its own size. Everything after this is the same for
both.

| Site | Cells |
|---|---|
| Every landmark (standing stones, leyspring) | 1×1 |
| Every lair | 2×2 |

- The footprint is **square**, and the feature is **drawn once** across the
  whole of it. There is no quarter of a mountain, in any sense: not
  part-revealed, not part-exhausted.
- **Every cell of the footprint carries the feature.** It blocks placement on
  each, it is a harvest node on each, and the Quarry counts each one that falls
  inside its area of influence.

**Fog.**

- **Discovered when any one of its cells is.** You can see a mountain from a
  distance, and a landmark looming out of the dark is what the fog is for.
- A tap on any of its cells advances **all** of them. Still five taps
  (`fog.tapsToReveal`), whatever the size.
- **The price is the sum of its cells'**, so a tap charges a fifth of that.
  Nothing is displayed: the floater on the tap says what it cost, and a
  nine-cell number says "this is a big thing" more plainly than a label would.
- **Any one cell is enough**, for the frontier and for the reach alike. The
  frontier only has to touch a corner, and one cell inside the Townhall's
  reach opens the whole of it. A 3×3 bought from its near corner does carry
  the player up to two rings past the ring; that is the price of the rule
  reading honestly, paid once per site and for the full summed cost of every
  cell. The alternative cut a standing stone in half along the ring and
  refused a tap on a thing the player could see they had reached.
- It clears **all at once**.

**Exhaustion.**

- The footprint exhausts **as a unit**, from one depot of `stock × cells`.
- Four workers drawing on one quadrupled depot empty it at the rate four
  single-cell depots would, so nothing in the balance moves.

**Authoring.**

- Mountain cells are painted **one at a time** in the map editor. Nothing declares
  a footprint.
- A landmark or a lair declares `size` on its own row instead. The editor
  round-trips it; `validateRegionMap` refuses a size outside 1–3 and checks
  every cell of the footprint the way it checks a single one, so a 3×3 whose
  far corner hangs over water is an error rather than a site nobody can
  finish paying for.
- The grouping is **derived from the painted cells**, by the same function the
  editor previews and the sim loads with (`src/sim/data/mapRules.ts`): greedy
  3×3, then 2×2, then 1×1, in a fixed scan order. Same cells in, same grouping
  out, every time.
- Iron and gold mountains stay 1×1. A lone rich outcrop reads, and three sizes
  of each is nine more drawings for no gain.

Respawn:

- A finite feature respawns rather than dying. `respawnTerrain` decides where:
  shoals wander across water, berries wander on grass.
- Placement is a deterministic hash of the event, never a stream
  ([`../implementation-plan.md`](../implementation-plan.md) §1).

## 4. The three fog states

| State | Meaning |
|---|---|
| **Undiscovered** | not drawn |
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
  building reveals its own ground and discovers a ring round it (2, 1 for the
  military halls); **only the Townhall reveals a ring** — 1, and **3 from
  level 2**, landing the moment that upgrade does — the rest of the map is
  paid for (`fogRevealRadiusPerLevel`, `tests/fog.test.ts`).
- Claiming a landmark discovers `fog.claimDiscoverRadius` = **5** cells around
  it: an 11×11 square, ~100 cells. **Discovered, never Revealed.**
- Revealed outranks discovered: cells already revealed are never overwritten.
- **The Townhall is the reach.** A cell can be paid for only within
  `fog.reachPerTownhallLevel` rings of the Townhall, indexed by its
  level: **3 · 5 · 7 · 8 · 10 · 11 · 13 · 15 · 17 · 23**. Level 10 reaches the
  province's last ring.
- A building's fog radii and a claim's discover ring ignore the reach, the way
  they ignore Sailing. Only the player's tap and a Divination are refused, and a
  refused tap costs nothing.
- A Discovered cell past the reach stays visible under the mist and draws like
  a cell the frontier has not reached.
- **The reach is drawn**: a line of white dots, each ringed in a thin dark
  outline, along the last ring the player may pay for, with a soft shadow on
  the far side only, over the fog and across undiscovered ground, so the border
  is read off the map before a tap is refused. It is UI laid over the view,
  under what stands on the ground (mockup
  `../art/mockups/area-overlays/reach-simple-2-dots-shadow.png`). It
  disappears once the reach holds the whole province.

### 4.1 Sighting

A tall thing past the fog shows as a **silhouette** while a revealed cell
lies close enough to it.

| Thing | Sighted from | Setting |
|---|---|---|
| Mountain 1×1 · 2×2 · 3×3 | never · 4 · 5 | `fog.sight.mountainBySize` |
| Shrine, standing stones, leyspring | 3 | `fog.sight.landmark` |
| A lair not yet found | its own, past its ground: Orcs 3, Harpies 3, Goblins 3, Wolf riders 3, Drake 4 | `sight` on the lair, in the map editor |
| An abandoned building (§6.3), as its ruin | its own: the opening's 3, the Watchtower's 4 | `sight` on the building, in the map editor |
| Forests, berries, game, shoals | never | — |

- **Measured from revealed cells only**, Chebyshev, to the nearest cell of its
  footprint. Discovered cells do not see.
- A lair's sight reaches past its ground (`radius`), or it is 0 and never
  sighted: every cell of its ground finds it (`src/sim/data/mapRules.ts`).
- **A silhouette is the thing's own drawing as one flat, pale shape** rising
  out of the cloud tops: no name, no badge, no bubble.
- It stops being a silhouette once any cell of it is Discovered — a lair once
  it is found — and draws as itself.
- **It ignores the Townhall's reach and the exploration gates.** Seeing what
  cannot be reached yet is the point.
- **It is not a discovery**: no banner, no quest progress, a lair is not found
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

## 5. The price of a cell

Authored per ring out to ring 14 — roughly ×2.5 a ring — with a ×1.37
fallback past ring 14. The province reaches ring 23.

| Distance | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| **Gold** | 4 | 8 | 20 | 85 | 220 | 990 | 2,400 |

| Distance | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15+ |
|---|---|---|---|---|---|---|---|---|
| **Gold** | 6,600 | 18,000 | 45,000 | 130,000 | 320,000 | 990,000 | 2,800,000 | ×1.37/ring |

- **A cell is five taps at every ring** (`fog.tapsToReveal`). What the ring
  decides is what each tap CHARGES: a fifth of the cell's Gold.
- A footprint is five taps too, and costs **the sum of its cells** (§3.1). A
  3×3 therefore charges nine cells' worth a tap, which the floater states.
- **The map gets dearer as it is revealed.** The ring price is multiplied by
  `fog.countGrowth` (**×1.05**) once per `fog.countStep` (**10**) cells
  already revealed. Every revealed cell counts — seeded, built around or
  divined — the same count the era bars read
  ([`07-research.md`](07-research.md) §2.1). A fresh kingdom's 16 seeded cells
  already sit in the second step.
- The order: ring price × count multiplier, then the floor. **No technology
  discounts the fog** ([`07-research.md`](07-research.md) §1.2). A cell never
  costs less than `fog.minCost`. Nothing buys a tap back.
- Every ring price from 3 out is a multiple of five. A price five does not
  divide — rings 1 and 2, a multiplied one, a discounted one — is split into slices
  that still sum to it exactly, never rounded either way.
- **Every tap that takes tears a fifth of the cell's mist away**, the last
  one blowing it off — every cell of a block at once (§4.2). A refused tap
  tears nothing.
- At ×1 the whole map is **2,522,803,392 Gold across 1,466 priced cells**, and
  the outer third of it is most of that; the count multiplier only raises it.
  It is the largest Gold sink in the game by three orders of magnitude. What
  limits how fast it is spent is the Townhall's reach in the first week and the
  purse after (`tests/thirtyDays.test.ts`).

## 6. What the fog holds

| Found in the fog | Count | Gives | Verb |
|---|---|---|---|
| **Resources** | 178 feature cells | Wood, Stone, Food, Gold | tap / work |
| **Landmarks** | 11 | **+10 max Mana**, permanently, and a discover ring | claim |
| **Lairs** | 5 | its hoard back, Hero XP, a Knowledge lump, and the ground it held | find it, beat its garrison, claim |
| **Treasures** | one every five cells revealed | a coin, once (§6.2) | reveal its cell, tap to pick up |
| **Abandoned buildings** | authored | a building, once repaired (§6.3) | repair |

- A landmark permanently enlarges the Mana pool, so every future refill
  (including the ad reward, which is a whole pool) is larger.
- A lair is cleared once and is gone; repeatable dungeons are the world
  map's ([`19-world-map.md`](19-world-map.md)).
- Neither landmarks nor lairs are visible when a kingdom begins. Sites draw
  through the Discovered mist once discovered.
- **A site coming into view is announced once**, by a banner — unless a
  scene introduces it ([`23-tutorials.md`](23-tutorials.md)), which then says
  it instead. A resource is never announced: its coin lands on the plank.
- **Every lair holds a garrison.** Finding it starts its raid clock; it
  raids until its garrison is beaten
  ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md)). A landmark has
  no guard: it is claimed for its Gold.

### 6.1 How the province opens

The near map is laid out so the first Townhalls look one way at a time
(`tests/provinceLayout.test.ts`):

- **South first.** The Thorned Shrine's ruin (4 rings) is sighted from the
  first ring; with the Watchtower's ruin to the north, the only sites in
  sight while the Townhall is at level 1.
- **The Orcs** (6 rings, south, past the shrine) show from ring 3, as the
  player reaches the shrine. Their ground (radius 2) starts at ring 4 and
  holds the shrine, so they are found at Townhall 2 and cleared before it is
  claimed. A lair is fought once found, so it is its ground, not its camp,
  that the chain needs in reach.
- **The Orcs are the only lair Townhall 2 can find.** Every other lair's
  ground lies past its reach, so the first fight is theirs.
- **The Harpies guard the gold.** Their camp is 8 rings north-east; their
  ground (radius 2) starts at ring 6: past Townhall 2's reach, inside
  Townhall 3's. It holds the first gold vein (6 rings) and the stone
  mountains to the north. Revealing the vein finds them.
- **One loose stone node** stands 2 rings from the Townhall, to the north,
  on no lair's ground: the stone the opening has, and the reason to want
  more.
- **The Harpies** show from Townhall 2's last ring: the camp that holds the
  gold is in sight before the player can reach it.
- **The Watchtower's ruin** (5 rings north) is sighted from Townhall 1's
  ground and reached at Townhall 2: the world map's door is in view from the
  start (§6.3). The Fallen Stones (7 rings), the nearest landmark, are
  sighted from ring 4, at Townhall 2.

### The landmark tiers

Costs are **authored per sanctuary**, not derived from distance.

| Tier | Cost | Count |
|---|---|---|
| The near one — the Fallen Stones | **10,000** | 1 |
| The middle ring | **25,000** | 3 |
| The far ring | **100,000** | 2 |

- The nearest sanctuary is the cheapest; the far ring is the dearest.
- **A landmark inside a standing lair's ground cannot be claimed**
  (`LairHeld`): the Thorned Shrine waits for the Orcs.

### The five lairs

| Lair | Tier | Ring |
|---|---|---|
| Orc Lair | I | 6 |
| Harpy Roost | II | 6 |
| Goblin Den | III | 19 |
| Wolf-rider Camp | IV | 14 |
| Drake's Lair | V | 14 |

- The first two are the ones a month of play reaches. The last three are deep
  province: past ring 12 a single cell costs six figures (§5), so meeting them
  is a late-game project and their order is not the tier order.
- Full lair design: [`18-garrisons-and-raids.md`](18-garrisons-and-raids.md);
  the fights are [`combat.md`](combat.md).

### 6.2 Treasures

What the people who fled left on the ground, found at a steady pace in
whatever direction the player explores.

- **One is due every `treasure.everyReveals` cells the player pays to
  reveal**, the first on the very first. A cell revealed by a building or a
  claim does not count.
- **It lands in a cell that reveal discovered** — one of the neighbours that
  just turned Discovered, bare ground before a feature, chosen by
  `rand(seed, n)` for the kingdom's n-th treasure. The cell must be one the player can pay for now: inside the
  reach, dry unless Sailing is known, and not under a site, an abandoned
  building or a feature that spans cells.
- **No newly discovered cell qualifies?** It takes another Discovered
  neighbour of the cell just revealed; failing that, it waits for the next
  paid reveal. One reveal places one treasure at most.
- **Discovered, it shows as a closed chest** under the mist: the player sees
  something to go and get, not what is in it.
- **Revealing its cell opens it**: its coin rises out of the chest under a
  glint. **A tap picks it up, free** — no Mana, as a store is collected free.
  On a cell with a feature the first tap picks up the treasure and the next
  harvests; a forest still closed by Forestry gives its treasure.
- **A treasure is one coin the plank already shows**: Gold, Food, Wood, or
  Stone once Stone is on the plank, by `treasure.weights`, rolled for the
  n-th treasure; rarely Knowledge, which lands over the bar's cap like a
  lump.
- **It pays `treasure.workSeconds` of the kingdom's production of its coin**,
  floored at `treasure.floor`, priced when it is picked up. Knowledge pays a
  fixed `treasure.knowledge`. **The first is fixed** — 20 Gold
  (`treasure.firstCoin`, `treasure.firstAmount`) — for the First Morning ([`23-tutorials.md`](23-tutorials.md) §3).
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
  cost at the next ordinal, a builder and the level-1 time
  ([`05-city-and-districts.md`](05-city-and-districts.md) §3,
  [`06-construction.md`](06-construction.md) §1). It is refused as a build is
  — no builder free, the count cap reached, a coin short.
- **A ruin may be missing a piece** (`buildings` › `repairItem`): repairing
  it also asks for that item from the Bag, and spends it. **The Watchtower**
  (`NorthWatch`, 5 rings north) is the one: it needs **the Watchtower's
  lens**, which the Orcs carry and their prize hands over. Repaired — 200
  Gold, 100 Wood, **one minute** — it discovers **8 rings** round it, adds
  +10 max Mana and 3 Knowledge as a landmark claim does, and opens the world
  door and the Atlas ([`22-progression.md`](22-progression.md) §5).
- **No technology is asked.** The technology that unlocks a building opens
  building more of it; its levels stay gated as for any other.
- **While abandoned it only takes up its cells**: no production, store, crew,
  area, adjacency or Harmony, no place in the count cap, and it cannot be
  moved.
- **Once the repair starts it is that building**: stamped with its ordinal,
  under construction, then finished at level 1, revealing and discovering its
  ground and in every way one the player built.
- **The opening's**, inside the first Townhall's reach, each in sight of the
  starting ground:

| Building | Where |
|---|---|
| **the old House** | ring 3, past the first forest |
| **two old plots** (FarmLands — repaired, each plants a crop plot) | by the berries |
| **the old Farm** | beside the old plots, working both |
| **the old Sawmill** | ring 3, at the edge of a wood, clear of the Townhall |

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
- Every lair carries a `guard` — threat, power and its first-raid warning in
  minutes ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md) §2).
  Landmarks carry none.

## 8. Dials, in the order to reach for them

| Dial | Value | Where |
|---|---|---|
| Fog price per ring | 4 → 2,800,000, ×1.37 past ring 14 | `fog.rings` |
| How far each Townhall level lets the fog be paid for | 3 · 5 · 7 · 8 · 10 · 11 · 13 · 15 · 17 · 23 rings | `fog.reachPerTownhallLevel` |
| How much dearer the map gets as it is revealed | ×1.05 every 10 cells | `fog.countStep`, `fog.countGrowth` |
| Taps to clear a cell | 5 | `fog.tapsToReveal` |
| The floor under a cell's price | 1 | `fog.minCost` |
| Claim discover radius | 5 | `fog.claimDiscoverRadius` |
| The Watchtower's discover radius | 8 | `buildings` › Watchtower › `fogDiscoverRadius` |
| How often a treasure is due | every 5 cells revealed | `treasure.everyReveals` |
| What a treasure pays | 120 s of the kingdom's production, floored at 10 Gold · 5 Food · 5 Wood · 5 Stone | `treasure.workSeconds`, `treasure.floor` |
| Which coin a treasure is | Gold 3 · Wood 3 · Food 3 · Stone 2 · Knowledge 1 (1 point) | `treasure.weights`, `treasure.knowledge` |
| The first treasure | 20 Gold | `treasure.firstCoin`, `treasure.firstAmount` |
| Where the abandoned buildings stand | §6.3 | the map editor |
| How far a tall thing is sighted past the fog | §4.1 | `fog.sight` |
| A building's reveal / discover radius | 0 / 2 (the Townhall 1, then 3 from level 2 / 2) | `buildings` › `fogRevealRadius`, `fogRevealRadiusPerLevel`, `fogDiscoverRadius` |
| Landmark claim costs | 2,000 / 25,000 / 100,000 | the map editor |
| A lair's guard, zone and sight | [`18-garrisons-and-raids.md`](18-garrisons-and-raids.md) §2 | the map editor |
| Feature yields, taps, recovery | §3 | `harvest` |
| Which features may span cells, and how far | Mountain, up to 3×3 | §3.1, `definitions.ts` |
| The world itself | — | `?dev=data#map` |

## 9. Deliberately not in this design

- Server-authoritative fog on the shared world map
  ([`02-map-scopes.md`](02-map-scopes.md) §3).
- Pathfinding.
- A procedural region generator ([`02-map-scopes.md`](02-map-scopes.md) §1.1).
- A `Mountain` terrain or a `Rocks` feature.
- A Mine district.
- A `base × growth^distance` curve for landmark costs.
- A technology that buys reveal taps back. A cell is five presses at every
  ring, so there is no tap ladder left to climb.
- Non-square or non-contiguous footprints (§3.1).
- A footprint revealed or exhausted cell by cell. One sprite cannot be drawn
  part-lit or part-mined; it would read as a rendering fault, not as a state.
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
