# 2 · Map scopes — the province, the temporary provinces, and the world

> **Scope.** Where every future system lives. This is a structural decision
> rather than a feature: one of its consequences — the shape of the save —
> cannot be changed retroactively, which is why it is written down before it is
> built.
>
> **Status: designed, unstarted.** One piece of it is cheap enough to land
> early and is worth landing early: bounding the buildable plot (§8). Revised
> 2026-09-04 against two rounds of world-map mockups
> ([`../art/world-map-mockup-prompts.md`](../art/world-map-mockup-prompts.md)):
> the world map is a **hex lattice** rather than a node graph (§3.4), it has
> **two zoom registers** (§3.5), its fog is **per-player and client-side**
> (§4), and **travel time** is its pacing dial (§5).

## 0. The problem, with numbers

The map is a single grid that is simultaneously the city canvas, the resource
hinterland and the adventure space. Two measurements say that cannot hold.

**The fog runs dry in an afternoon.** The whole map is **194,142 Gold** across
253 cells; a Townhall-3 city makes **~900 Gold/min idle**. That is **3.6 hours
of end-game income for the entire map** — the differentiator, the main Gold sink
and 253 hand-placed cells.

**And the influence radii oversubscribe the map before the fog even runs out.**
A district at level 3 covers Chebyshev radius 3 — **48 cells of influence** on a
253-cell map. Three Sawmills at L3 is 144 cells, 57% of everything. But the
binding constraint is worse: a Sawmill L3 fields **7 workers**, and the map
holds on the order of 13–17 forest cells. **Three maxed Sawmills are 21 worker
slots competing for 17 trees**, and the claim system (one worker per cell)
leaves the rest Idle.

So the map does not "eventually run out". **The buildings ask for more cells
than the map contains, long before the fog runs out of tiles to sell.**

## 1. Three jobs, and two of them contradict

| Job | Wants |
|---|---|
| **City canvas** — where buildings go | to be **finite and tight**; a tight plot is what makes placement a decision |
| **Resource hinterland** — what workers harvest | proximity and density |
| **Adventure space** — ruins, landmarks, the frontier | to be **inexhaustible**; it is the content treadmill |

Jobs 1 and 3 ask for opposite geometries. Size the map for the treadmill and the
canvas becomes infinite, so placement stops mattering. Bound it for the canvas
and the treadmill ends — which is the three-hour content cliff wearing a
different hat.

This also explains why **one adjacency rule** has never been enough (OQ-48). It
is not that rules are missing: **adjacency rules cannot matter on a canvas that
grows by buying tiles.** Scarcity is the precondition for spatial play.

## 2. What the genre does, which is unanimous

| Game | City | Exploration |
|---|---|---|
| Forge of Empires | bounded plot; **expansions** bought with diamonds, tech, quests | **Campaign Map**, separate — provinces negotiated or fought, *paying expansions and goods back into the city* |
| Elvenar | bounded plot + expansions (47 premium ones, diamonds-only) | **World Map** of provinces scouted → relics + expansions |
| Rise of Kingdoms | fixed city plot | **shared server map, per-player fog**, scouted (§4.1) |
| Whiteout / Kingshot / Last War | fixed plot, grows by building levels not tiles | shared server map |
| Township | plot + land expansion paid with **tools from trains** | mine, zoo, islands, Expedition — each its own screen |
| Family Island | one island | **other islands** — Adventure Island expeditions |

**The city is bounded, plot growth is a reward earned elsewhere, and exploration
lives in a separate scope.** Nobody puts both on one grid.

## 3. Three layers

| Layer | What it is | Authority | Verb | Lifetime |
|---|---|---|---|---|
| **Your province** | authored, **identical for every player**, bounded plot, square grid | client | build, tap, harvest | permanent, inviolable |
| **Temporary provinces** | event maps, PvE, compressed scale, square grid | client | the same verbs, inside a window | disposable |
| **The world map** | shared **hex lattice**, outposts not cities | **server** for claims, **client** for fog | send, claim, contest | permanent, contestable |

### 3.1 Why an identical authored province is the right call

One map to balance, one FTUE to tune — and the quest chain is already pinned
beat by beat against it — and **retention numbers that are comparable between
players**, which is what the prototype has to measure. It also removes the
procedural region generator from the plan entirely: `region-map.json` stays as
it is.

### 3.2 Why the province plot must be bounded

So that placement is a decision, moving a building is a decision, and adjacency
has something to bite on. Growth comes in **authored increments** — an
expansion block, not a tile — which is the Forge of Empires and Elvenar model.
The Gold curve for expansions can then be priced indefinitely, instead of
draining a finite inventory of 253 cells.

### 3.3 Temporary provinces are how the province mechanic survives

The failure mode this whole document exists to avoid is a **transition**: the
game you learned in week one being gone by month two. The fix is that the
province's verbs never retire — they become **the event format**.

That is already the plan. [`13-events.md`](13-events.md) §2.3 specifies the
event minigame as *a small map, shrouded, where event points buy reveals and the
rewards are under the fog.* Naming it a temporary province changes nothing about
the work and clarifies what it is.

Precedent in the exact comparable set: Family Island's **Adventure Island**
expeditions, Township's **Expedition**, Klondike's sled expeditions, Sunrise
Village's **Maze**.

The payoff: **every content drop reuses the most expensive systems already
built** — fog, harvest, placement, workers, exhaustion — instead of needing new
ones. An event becomes a map and a reward table.

**A lightweight state module, not a region.** No buildings, no workers, no
economy: things are *found* there, not produced. That avoids the `GameState`
reshape and is a dry run for it.

### 3.4 The hex is a unit of measure, not a container

This is the definition everything else in §3.4 and §5 follows from, and it is
the thing an earlier draft got backwards by arguing from icon legibility:

> **The hexagon exists so that distance is countable and reveal is bounded.**
> Moving one hex costs X time, so moving Y hexes costs X·Y. Exploring reveals a
> stated number of hexes. That a *place* happens to sit inside a hex is
> incidental — places are tenants of the lattice, not its purpose.

**So most of the map is empty, and that is not a gap in the content.** A world
where every hex is a destination has no distance, only arrivals: there is no
decision about *where to go* if everywhere is equally somewhere. The space
between places **is** the cost of travel, and the cost of travel is what makes
proximity strategic (§5).

Density, therefore: **places are sparse.** Terrain you cross is the default,
and a place is an event. That also cuts the art bill hard — the map needs
~15–20 authored *place compositions* reused with prop variation, plus a
repeatable base terrain between them, rather than 300 unique scenes.

**Why hexes rather than squares.** The province is a square grid deliberately
(the port replaced Unity's hex with squares, and three metrics coexist there —
von Neumann for fog and BFS, Chebyshev for influence, Euclidean for worker
travel; [`01-map-and-fog.md`](01-map-and-fog.md) §1). The world map wants the
opposite geometry for two concrete reasons:

- **Every neighbour is the same distance away.** On a square grid a diagonal is
  either forbidden or 1.41× — which is exactly the ambiguity that ruins
  "moving Y hexes costs X·Y". Six equidistant neighbours make travel cost
  arithmetic the player can do in their head.
- **Two geometries is a virtue, not a cost.** It reinforces the verb split —
  squares are built on, hexes are crossed — and no code is shared, because the
  world map has no workers, no influence radius and no adjacency-that-pays-Gold.

What the lattice keeps from the node-graph draft it replaces: it still
**generates procedurally** where 253 hand-placed cells do not, a ruin is still a
**destination** rather than somewhere you build, and a second region is still a
data row.

### 3.5 Two zoom registers, with two different jobs

Here is the tension the mockups exposed. A hex large enough for a place to read
is a hex too large to count distances with: at three across you cannot see far
enough for "four hexes away" to mean anything. A hex small enough to measure
with is too small for its contents to read.

That is not a compromise to split — it is **two tools**:

| Register | Hex width | On a 390 pt phone | Its job |
|---|---|---|---|
| **Tactical** | ~130 pt | ~3 across | **Look at a place.** What is inside it, what you can do, and the sheet that acts on it |
| **Strategic** | ~45 pt | ~8–9 across | **Measure and plan.** Count hexes, judge travel time, read borders and ownership |

**The strategic register is not an overview — it is the planning surface, and
it is where the lattice does its actual work.** That makes it load-bearing
rather than a convenience, and it means it ships with the world map rather than
after it.

Calibrated from the mockup renders, not in the abstract:

- **~130 pt / 3 across is the tactical size.** At ~97 pt / 4 across a hex still
  read as a tile with props on it; at ~130 pt it reads as somewhere you would
  go — a river with a bridge crossing it, an arch, a field.
- **3–4 content elements are legible at that size**, comfortably. Two rounds of
  renders settled this; an earlier note capping it at two was measuring the
  smaller hex.
- **Content icons are read, not tapped.** At ~130 pt an icon lands around
  25–40 pt, under the 44 pt (Apple) and 48 dp (Material) minimums. **The
  hexagon is the tap target; the dispatch sheet is where actions happen.** The
  icons exist so a player knows what is there before tapping.
- A hexagon must **never** open a map of its own. Contents on the hex, actions
  in a sheet. A nested interior would be a third map level in a game already
  carrying the too-many-systems risk (OQ-6).
- The jump between registers is ~3×. An earlier draft put the strategic view at
  13 across, which against a 3-across tactical is ~18× the area and reads as
  teleporting rather than zooming out.

**Outposts, not cities** (§6): one or two structures on a claimed hex, so the
placement verb survives at world scale without multiplying city management. A
player with N cities is a player with an N× session, and the budget is
~30 min/day.

## 4. Fog on a shared map

> **The province is tapped. The world map is sent to.**

Province: tap a tile, 1 Mana, something happens now — tactile, high frequency.
World map: dispatch a scout or a party and it resolves over time — planning, low
frequency. A 30-minute budget across two or three visits wants **one tactile
loop and one planning loop**, not two competing for the same thumbs.

### 4.1 The Rise of Kingdoms precedent, and the correction it forced

An earlier draft claimed that nothing in the genre puts per-player fog on a
shared map, and used that to argue the fog should cover *nodes* rather than
ground. **That was wrong.** Verified from the Rise of Kingdoms wiki:

- The fog is **per-player**, not shared or alliance-wide, and **revealed fog is
  permanent**.
- A governor starts with **1 scout and a 5×5 fog-block exploration range**; a
  fully upgraded **Scout Camp** grants **3 scouts, a 15×15 range and +125%
  scout speed** — a factor of nine in area.
- Exploring reveals terrain, **other players' cities**, alliance buildings,
  tribal villages, mysterious caves, passes and holy sites.
- Tribal villages pay food, wood, tier-1 troops and **economy technology
  unlocks**; caves pay level-scaled rewards.

### 4.2 The fact that dissolves the objection

> **In Rise of Kingdoms the fog does not block movement or attacks.** Scouts
> take the shortest route, already accounting for every obstruction.

So the fog there is a layer of **information, not permission**. And the original
objection was never aesthetic — it was that per-(player × cell) fog is a shared
table that has to be validated server-side. If the fog gates nothing, that
objection goes away:

- **Nothing to cheat.** Revealing early grants no access, only earlier sight. So
  world fog can be **client-authoritative and live in the player's own save**,
  with no shared table and no RPC.
- **The granularity is coarse.** Rise of Kingdoms counts in **fog blocks**, with
  scout ranges of 5×5 to 15×15 *blocks* rather than tiles. At hex granularity a
  player's fog state is a small bitset over a few hundred hexes, which
  compresses to nothing.

This sits cleanly on the authority boundary the rest of this document draws:
**the province is client-authoritative, contested claims are
server-authoritative, and world fog falls on the client side because it decides
nothing.**

**The condition attached to that.** If the fog is ever made to gate something —
"you cannot attack what you have not explored" — it becomes authoritative state
and the cost comes back. That should be a deliberate decision, not a drift.

### 4.3 Reveal starts at one hex and grows

The reveal radius is a **progression axis in its own right**, and it starts
small:

| Scout post | Radius | Hexes revealed |
|---|---|---|
| initial | **0** | **1 — the target hex only** |
| upgraded | 1 | 7 — the target plus its six neighbours |
| upgraded | 2 | 19 |

**Starting at one hex is the point.** It makes each reveal a *decision* — which
neighbour? — and it keeps continuity with the province, where the fog is bought
one tap at a time. Only later, when one-at-a-time would start being work, does
the radius open into rings.

That is also the honest answer to the worry that tile-by-tile exploration feels
tedious at world scale: **it is not the mechanic that is tedious, it is the
mechanic at scale.** The cure is not to remove it but to have the radius grow
before it starts to grate — the same job Rise of Kingdoms' Scout Camp does going
from 5×5 to 15×15.

And a ring reveal is worth having as the mid-game state for a second reason:
seven hexes opening at once is a **visible event**, which is the filmable beat
the fog needs to keep earning its place as the differentiator. The renders
confirmed it reads instantly.

### 4.4 Three fog states, not two

The renders produced a better treatment than this doc originally specified, and
it maps exactly onto the trichotomy the province already has
([`01-map-and-fog.md`](01-map-and-fog.md) §4):

| State | Looks like | Province equivalent |
|---|---|---|
| **Revealed** | full terrain, contents, borders | Revealed |
| **Sensed** | dimmed and half-veiled; faint silhouettes of what it holds show through the haze | Discovered |
| **Unknown** | opaque rolling mist, whole hexes hidden | Undiscovered |

The middle band is what makes the fog read as *a place to go* rather than a grey
void, and it gives the player something to aim a scout at.

**Revealing a hex costs Gold and time, scaling with distance** — Elvenar's
scouting model. **Not Mana** ([`09-relics.md`](09-relics.md) §3, where Mana is
reserved for what magic costs). It also gives Gold a sink at world scale, which
it badly needs once the province's 194,142 is spent.

Kingdom already has the acceleration ladder, in the province:
`fog.claimDiscoverRadius` = 5, **Cartography** (each fog tap counts double),
**Surveying** (+1 a rank, two ranks → the ×1→×2→×3→×4 staircase) and **Pitons**
(−10% a rank on the fog's Gold). A world-map scout post is continuity, not a new
system.

## 5. Travel: the world map's pacing dial

> **One hex costs X time to cross. Y hexes cost X·Y.**

That arithmetic is the reason the lattice exists (§3.4), and it makes travel
time the world map's equivalent of `tap.workSeconds` — the single dial that
sets the tempo of the whole scope.

**Scaling with distance is continuity, not invention.** The province's fog
already doubles per ring (1, 3, 5, 10, 20, 40, 80, 160, 320, 640) and Elvenar's
scouting scales both cost and time with distance from the city. Whether world
travel is linear in hexes or superlinear is a tuning decision (OQ-65); that it
scales is settled.

**Travel is a timer, so the offline cap does not touch it.** The engine's rule
— *the cap limits what the city produces while you are away and never what a
timer does* ([`../implementation-plan.md`](../implementation-plan.md) §1) — puts
travel with the build queue, research and delve depths: a party dispatched
before a twelve-hour absence has arrived when you return. Production is capped
at 8 h; timers are not.

**And this is what makes proximity strategic.** If crossing hexes costs time,
a place three hexes away is worth more than the same place nine hexes away,
borders have teeth, and "who is my neighbour" is a question with consequences.
That is the property an abstract node graph could not provide, and it is the
primary argument for the lattice — ahead of the aesthetics of adjacency, which
was the weaker reason an earlier draft led with.

## 6. How much PvP the promises allow

Promise 1 says, in as many words: *nothing you own is ever taken from you. **No
raids**, no decay, no starvation, no failure state. Pressure comes from
opportunity that expires.*

"PvP" is a gradient and only its far end breaks that.

| Degree | What is contested | Breaks promise 1? |
|---|---|---|
| Leagues and rankings | status | No |
| **Contested claim** — first to a hex keeps it | **the opportunity** | **No** — "opportunity that expires", with another player as the clock |
| **Territory that changes hands** — hold a hex, it produces for you, it can be taken | **the hex, never your property** | **No** — what is lost is future rent from something never in your city |
| Raiding another player's city | **their property** | **Yes, head-on** |

> **Your village can never be attacked. Everything outside it can be
> contested.**

That is a design rule, a technical boundary and a marketing line at once, and it
lands exactly on the scope split: province private and client-authoritative,
world map shared and server-authoritative.

**It is not a theory.** Guild Battlegrounds moves provinces between guilds every
hour, Tournaments and the Spire are competitive, there are leagues with
promotion and relegation — and **nobody ever loses a building in their city** in
either Forge of Empires or Elvenar. Twelve and nine years of territorial PvP
with no looting, in *this* quadrant rather than the survival 4X one.

**An outpost is a claim, not a building.** If it falls, the hex reverts to
unclaimed and the player keeps everything it already produced.

## 7. What the world map uniquely gives — and how the loop closes

The test this document is built on: **does the outer scope feed the inner one?**
If it does not, it is a transition and the player will notice the game was
swapped.

| The world map pays | Which lands in |
|---|---|
| **3★ relic ingredients** — its exclusive output | the collection arc, whose passives improve the province economy |
| **Plot expansions** | a bigger province |
| **Knowledge cap** — contested landmarks raise it | research, per [`07-research.md`](07-research.md) §9 |
| Resources the province cannot produce | province sinks |

The loop: world → 3★ → maxed relics → economy passives → a stronger province →
more capacity to contest the world. Same structure as Guild Expeditions → goods
and blueprints → Great Buildings → city economy, which has run twelve years.
Rarity split: [`09-relics.md`](09-relics.md) §2.

**And an option Rise of Kingdoms opens.** Its tribal villages hand out
**technology unlocks** for exploring. That is a direct precedent for tomes
found by exploring ([`tomes-and-research.md`](tomes-and-research.md) §5) —
except on the *shared* map rather than in the authored province. High-tier
technologies coming from world exploration would give the world map a second
exclusive output, and it fits the same rarity logic as the 3★ ingredients.

## 8. The minimum to spend now

This is larger than the `regions: Record<RegionId, RegionState>` reshape that
was deliberately deferred, and it is **not** an early item. But the argument
applies with more force here: **the save is the only artefact that cannot be
changed retroactively.** A save that assumes one grid where city and content
coexist makes scope separation later a migration nightmare.

1. **Bound the buildable area in data** — a `city.maxBuildDistance` or a
   buildable flag on the plot. A balance number, not a refactor, and it puts the
   placement decision **inside the prototype**, which is a 30-day-retention
   question. Adjacency starts earning its keep the same day. (OQ-1.)
2. **Leave the fog as it is**, but stop treating "more tiles" as its only
   reward: the far ring pays **content access**. Nearly true already — ruins and
   landmarks sit at distance 3–12 and the far cells are mostly mountain and
   water, which are not buildable.
3. **Let the save say which scope a thing is in.** Cheap now, impossible later.
4. **Move the siege to the world map in the design** — which is what
   [`15-social.md`](15-social.md) §6 does.

## 9. Staged build

Each step is playable before the next exists.

1. Bound the plot. Expansions as authored increments.
2. **The world map's first place is the guild siege** — one hex, co-op, no
   shard, no PvP, no fog. It is the world map with a single entry, and the same
   code path the full scope needs later.
3. Temporary provinces ship as the event format ([`13-events.md`](13-events.md)).
4. **The lattice proper.** Axial coordinates, neighbours, distance, travel cost,
   both zoom registers, sparse places with contents, client-side fog at radius
   0, the dispatch sheet, the scout post.
5. Shards, seasons, and contested claims — the point at which PvP exists.
6. Server-side combat resolution. Feasible because combat is a deterministic
   scoring pass rather than a simulation — ATK/DEF/HP, a type chart, one pass.

### 9.1 One implementation warning, from our own history

The Unity build stored "cube coordinates" that were **actually offset with
Y = 0**, and computed adjacency and distance geometrically and by BFS instead —
which is part of why the port replaced hexes with squares.

**Write real axial coordinates from the first commit, and do not try to reuse
`grid.ts`.** It is square-grid maths with three coexisting metrics, none of which
the world map wants. Distance in axial coordinates is one expression, and travel
cost (§5) depends on it being exactly right. This is the trap that already cost
this project once.

## 10. Deliberately not in this design

A procedural province generator · **server-authoritative world fog** — it
decides nothing, so it lives in the player's save (§4.2) · a hexagon that opens
a map of its own (§3.5) · cities on the world map · raiding (§6) · reusing
`grid.ts` for the lattice (§9.1) · anything multi-region beyond the `regionId`
discriminator that already exists.

**Open questions:** OQ-1, OQ-2, OQ-3, OQ-4, OQ-5, OQ-38, OQ-65, OQ-66, OQ-67 in
[`../open-questions.md`](../open-questions.md). **Closed by the mockups** (the
hex as a unit of measure, the two registers, icons read rather than tapped,
three fog states, reveal from radius 0) are recorded there too.
