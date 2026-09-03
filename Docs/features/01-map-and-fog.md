# 1 · The map and the fog

> **Scope.** The grid, its terrain and features, the three fog states, the paid
> reveal that the whole game is built around, and what the fog holds. The
> *scopes* the map will eventually split into are [`02-map-scopes.md`](02-map-scopes.md).
>
> **Status: built.** The map is authored in the `?dev=map` editor
> ([`../map-editor.md`](../map-editor.md)) and stored in
> `src/sim/data/region-map.json`.

## 1. The grid

A square grid. Every cell has a **terrain**, optionally one **feature**, and can
hold one district. The starter region is **Oakville** — 253 cells, an island
ringed by sea plus two outer islands and a bay.

**Three distance metrics coexist, deliberately.**

| Metric | Used for | Why |
|---|---|---|
| **4-way von Neumann** | fog state, placement, BFS distance from the Townhall | diagonals are not adjacent, so the frontier is a connected front rather than a spray |
| **Chebyshev** | a building's area of influence | a square of influence reads correctly on a square grid |
| **Euclidean** | worker travel time | a diagonal walk should not cost two moves |

Distance from the Townhall is a **BFS over walkable cells**, not a straight line
— so a cell across water is as far as the walk around it, and the fog price
follows the shape of the world rather than the shape of the coordinate system.

## 2. Terrain

Grassland, Plains, Tundra, Snow, Water, and Desert (declared, zero cells).
Terrain decides three things and nothing else: whether a cell is buildable,
which features may sit on it, and which technology is needed to reveal it.

- **Water** needs **Sailing** to reveal, and is the **only** terrain that gates
  a reveal. Unbuildable except by the Docks, a 2×1 pier with one cell on land
  and one on water.
- A building's own fog radius **ignores** the tech gate; only a player's reveal
  tap is refused.

> **A mountain is a feature, not a terrain**, and that is a deliberate
> unification (§3). Ground is ground; what makes a cell unbuildable is the thing
> standing on it. The old `Mountain` terrain needed a placement rule of its own
> saying "nothing builds here", which said exactly what the feature check
> already said — so the model lost an id *and* a rule at once.

## 3. Features

At most one per cell. A cell's **identity** and the **currency it pays** are two
different fields — the map keeps its texture without the purse carrying a row
per biome ([`03-economy.md`](03-economy.md) §2).

| Feature | Pays | Per tap | Taps to exhaust | Recovery | Tech |
|---|---|---|---|---|---|
| **Forest** | Wood | 1 | 10 | 90 s | Forestry |
| **Crops** (a built FarmLands) | Food | 1 | 10 | 60 s | — |
| **Berries** | Food | 1 | 10 | finite, respawns in 120 s | Forestry |
| **Wild animals** | Food | **3** | 10 | finite, respawns | Hunting |
| **Mountain** | Stone | 1 | 5 | 120 s | **Scaling Tools** |
| **Iron mountain** | Stone | **5** | 5 | **300 s** | **Scaling Tools** |
| **Gold mountain** | **Gold** | **3** | 5 | **300 s** | **Scaling Tools** |
| **Fish shoal** (on Water) | Food | 2 | 5 | finite, respawns on water | — |

Wild game pays three times a berry bush, which is what makes hunting worth a
technology of its own.

**Three mountains, one landform.** They share a silhouette and the research
that opens one to a pick, and differ in what the rock holds and how long it
takes to come back:

| | Pays | Opened by | Role |
|---|---|---|---|
| **Mountain** | Stone, 1 | **Scaling Tools** | the everyday building material |
| **Iron mountain** | Stone, **5** | **Mining** | the same material, five times over — worth the walk to the far fog |
| **Gold mountain** | **Gold**, 3 | **Deep Mining** | the only thing on the map outside a lived-in house that pays the city's money |

**One building works all three, and the ladder is in the research.** The Quarry
goes after every peak in its area of influence; what separates ordinary stone
from metal is a technology, not a different shed. Scaling Tools gets a
quarryman onto a mountain at all, Mining gets the iron out of it, Deep Mining
reaches the gold.

That last row is the notable one. **Gold has come out of housing taxes and
nothing else since Silver was folded into it.** A gold mountain is a second
faucet, deliberately a modest one: a level-1 Quarry with three men on gold is
about 45 Gold a minute against roughly 120 from a Townhall-1 city's rent, so it
is a complement rather than a replacement for the idle backbone
([`03-economy.md`](03-economy.md) §3).

**The Mine was deleted, not repurposed.** Once iron stopped being a currency the
Mine was a second Quarry pointed at a second rock, and giving it two metal
mountains to work only dressed that up. A building whose whole identity is
*the other one of these* is a building the player has to learn for nothing, so
the Quarry took the job and the Mine is gone. Its techs did not go with it:
Mining and Deep Mining stopped gating a shed and started gating the **ore**,
which is a thing the harvest table could already express.

It leaves the Quarry as **the first district in the game that works more than
one source at once** — which is why a district's harvest source is a list.

**A mountain gives out like everything else**, and the temptation to exempt it
was looked at and refused. *A mountain cannot be used up by picking at it* is
true of the fiction and fatal to the economy: **exhaustion is the only throttle
on stone.** Without it a quarryman never walks anywhere, and nothing but the
Mana pool ends a tapping session — which contradicts the first rule of the
extraction model, *nothing produces from nothing*
([`04-harvest.md`](04-harvest.md) §1).

What carries the fiction instead is **how long it stays dead**: a bare peak is
back in two minutes, a metal one takes **five**. The rich node is throttled by
availability rather than by yield, which is part of why it is worth the walk out
to the far fog — and it makes the exhausted art a mine worked out for the
afternoon rather than a mountain that ceased to exist.

### 3.1 Stone works exactly like Wood

> **The Quarry cuts Stone from every mountain in its area of influence, the way
> the Sawmill takes Wood from every forest in its own.**

One sentence, and it needed no new machinery: a district names a **harvest
source**, a feature names the same one, and the worker search already matches
them. What changed is the content model — `Mountain` stopped being a terrain and
became the feature that pays Stone, replacing `Rocks`.

Three things fall out, and all three are simplifications:

- **The unbuildable rule disappears.** A feature already blocks a footprint, so
  "nothing builds on a mountain" stopped needing to be said twice.
- **Scaling Tools moves from reaching a mountain to working one** — the exact
  shape Forestry has on the forest. The mountain is visible and refusing from
  the first second, which is what makes the research something the player
  *wants* rather than a chore, and **a refused tap costs no Mana**.
- **Water becomes the only reveal gate**, so §5's tech gating has one rule
  instead of two.

The cost, stated plainly: **stone is now gated behind a technology where it used
to be free to tap.** The chain absorbs it — Scaling Tools is quest 28 and the
first thing priced in Stone is the Barracks at quest 31 — but that ordering is
now load-bearing and a test derives it from the map rather than trusting it.

**A finite feature respawns rather than dying.** `respawnTerrain` decides where:
shoals wander across water exactly as berries wander on grass. Placement is a
deterministic hash of the event, never a stream ([`../implementation-plan.md`](../implementation-plan.md) §1).

## 4. The three fog states

| State | Meaning |
|---|---|
| **Undiscovered** | not drawn |
| **Discovered** | drawn under a scrim — you can see the terrain and the feature, and you may pay to clear it |
| **Revealed** | yours: buildable, tappable, workable |

**The frontier stays connected.** You may only pay for a cell that touches
ground already revealed. Without the rule, exploring became a shopping list of
whichever distant tile looked interesting — which also let the player skip the
distance curve entirely by jumping to the cheap side of the map.

**A building sees further than it buys.** Every district has a
`fogRevealRadius` (1) and a larger `fogDiscoverRadius` (2), so finishing a build
hands the player a ring of ground *and* a wider ring of things to want.
Claiming a landmark discovers `fog.claimDiscoverRadius` = **5** cells around it
— an 11×11 square, ~100 cells of dark tiles with their features showing.
**Discovered, never Revealed**: a claim hands you a place to look, not ground,
so the paid reveal stays the economy's main sink. Cells already revealed are
left alone — revealed outranks discovered, and overwriting would undo paid
progress.

## 5. The price of a cell

Authored per ring, doubling from ring 4, with a ×1.25 fallback past ring 10.

| Distance | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11+ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Gold** | 1 | 3 | 5 | 10 | 20 | 40 | 80 | 160 | 320 | 640 | ×1.25/ring |

`fog.goldPerTap` is **1**, so a cell is also that many taps. A distance-9 iron
vein is 320 Gold *and* 320 taps — which is why hold-to-repeat covers reveal taps
and why **Cartography** and **Surveying** exist: they make one tap do the work
of two, three or four. They do **not** make a cell cheaper. **Pitons** discounts
the Gold instead (−10%/level), so the two stack without either making the other
moot.

Two costs, two upgrades, on purpose: exploring spends Gold *and* the player's
time, and they are separately worth buying back.

**The whole map is 194,142 Gold across 253 cells.** Against a Townhall-3 city at
~900 Gold/min idle, that is **3.6 hours of end-game income for the entire
world**. The exponential curve misleads: it feels brutal early and is trivial
late. That measurement is the reason [`02-map-scopes.md`](02-map-scopes.md)
exists.

## 6. What the fog holds, and why it must pay three ways

Paid fog is the mechanic the game is built around and the one thing nobody else
in the category has, so it has to pay back three different ways or it is a
treadmill.

| Found in the fog | Count | Gives | Verb |
|---|---|---|---|
| **Resources** | 42 features | Wood, Stone, Food | tap / work |
| **Landmarks** | 10 | **+10 max Mana**, permanently, and a discover ring | claim |
| **Ruins** | 5 | artifacts, ingredients, Stardust — a repeatable dungeon | delve |

**Landmarks are what make exploration compound.** A bigger Mana pool is a
bigger session *and* a bigger ad, because the ad reward is a whole pool. So
every shrine claimed makes every future refill permanently larger:

> explore → a bigger pool → a bigger ad → more taps → explore further

**Ruins are what stop the fog from being a treadmill** — a non-repeating reward
at the end of an exponential cost curve, and a *node* rather than a pickup: a
revealed ruin is a dungeon you can run for months, not an artifact you collect
once.

**Neither is visible when a kingdom begins.** The opening shows terrain and the
things you can work. A shrine is something the player uncovers, not a lure laid
out in front of them — but sites *do* draw through the Discovered scrim, so the
moment one comes into view it reads as a destination.

### The landmark tiers

Costs are **authored per sanctuary**, not derived from distance: the tiers are
the design, and no `base × growth^distance` curve lands on these numbers.

| Tier | Cost | Count | Defended |
|---|---|---|---|
| The near one | **2,000** | 1 | no |
| The middle ring | **25,000** | 5 | no |
| The far ring | **100,000** | 4 | **all four** |

**The nearest sanctuary is also the cheapest, by a wide margin**, so the first
one the player meets is the one they can plausibly save for. Get that backwards
and the fog's cost curve stops meaning anything.

The dearest tier is exactly the defended set, so the last sanctuaries need both
the Gold *and* an army — which is the only thing that gives combat a job outside
a dungeon. **Nothing writes `landmarks.cleared` today**, so those four are
currently unreachable: the design for clearing them is
[`15-social.md`](15-social.md) §6 and the open question is
[`../open-questions.md`](../open-questions.md) OQ-35.

### The five ruins

| Ruin | Tier | Artifact |
|---|---|---|
| Hollow Barrow | I | Dowsing Rod |
| Sunken Chapel | II | Verdant Seal |
| Drowned Ironworks | III | Foreman's Sigil |
| The Counting House | IV | Gilded Ledger |
| Star Observatory | V | Wanderer's Compass |

Placed at BFS distance ~3 to ~12, so the tier ladder and the fog curve are the
same ladder. Full delve design: [`11-expeditions.md`](11-expeditions.md).

## 7. Where the map is authored

**The workbook is the source of truth for every number; the map editor is the
source of truth for the map.** Map content is authored by coordinate, which a
spreadsheet expresses badly — it cannot show the map, cannot put a site's row
beside the cell it stands on, and cannot show a derived number, while every fog
price in the game is a BFS distance from the Townhall.

So terrain, features, landmarks and ruins live in
`src/sim/data/region-map.json`, painted in `?dev=map`, and **what a legal map is
lives in one module** (`mapRules.ts`) checked by the editor, the save endpoint
and a test alike. Fog ring prices stay in the workbook, because those are
balancing numbers. See [`../map-editor.md`](../map-editor.md).

**The ruin roster is fixed in code** (`RuinId` is a union): a ruin can be moved
and retuned but not added. Landmarks have no code-side identity beyond their
`kind`, so they are fully editable.

## 8. Dials, in the order to reach for them

| Dial | Value | Where |
|---|---|---|
| Fog price per ring | 1 → 640, ×1.25 past ring 10 | `FogRings` sheet |
| Gold per reveal tap | 1 | `fog.gold_per_tap` |
| Claim discover radius | 5 | `fog.claim_discover_radius` |
| A building's reveal / discover radius | 1 / 2 | `Districts` sheet |
| Landmark claim costs | 2,000 / 25,000 / 100,000 | the map editor |
| Feature yields, taps, recovery | §3 | `Harvest` sheet |
| The world itself | — | `?dev=map` |

## 9. Deliberately not in this design

Per-cell fog on a shared map (see [`02-map-scopes.md`](02-map-scopes.md) §4) ·
pathfinding · a procedural region generator — the province is authored and
identical for every player, on purpose ([`02-map-scopes.md`](02-map-scopes.md) §3.1).

**Open questions:** OQ-1, OQ-48, OQ-49, OQ-50 in
[`../open-questions.md`](../open-questions.md).
