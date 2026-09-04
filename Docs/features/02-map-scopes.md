# 2 · Map scopes — the province, the temporary provinces, and the world

> **Scope.** The three map scopes every system lives in — the player's
> province, temporary provinces, and the shared world map — who is
> authoritative over each, and what the save records about them.
>
> **Status: designed, not built.** The first item to land is bounding the
> buildable plot (§6). World-map art reference:
> [`../art/world-map-mockup-prompts.md`](../art/world-map-mockup-prompts.md).

## 1. Three layers

| Layer | What it is | Authority | Verb | Lifetime |
|---|---|---|---|---|
| **Your province** | authored, **identical for every player**, bounded plot, square grid | client | build, tap, harvest | permanent, inviolable |
| **Temporary provinces** | event maps, PvE, compressed scale, square grid | client | the same verbs, inside a window | disposable |
| **The world map** | shared **hex lattice**, outposts not cities | **server** for claims, **client** for fog | send, claim, contest | permanent, contestable |

### 1.1 Your province

- One authored map, identical for every player: `region-map.json` as it is. No
  procedural province generator.
- 253 cells; the whole fog costs **194,142 Gold**.
- The buildable plot is **bounded** (§6). Adjacency rules depend on it (OQ-48).
- Plot growth comes in **authored increments** — an expansion block, not a
  tile — priced in Gold and earned outside the province (§5).
- Square grid with its three distance metrics
  ([`01-map-and-fog.md`](01-map-and-fog.md) §1).

### 1.2 Temporary provinces

- The province's verbs, as **the event format**: a small shrouded map where
  event points buy reveals and the rewards are under the fog
  ([`13-events.md`](13-events.md) §2.3).
- Reuses fog, harvest, placement, workers and exhaustion. An event is a map
  plus a reward table.
- A **lightweight state module, not a region**: no buildings, no workers, no
  economy. Things are *found* there, not produced. No `GameState` reshape.

### 1.3 The hex lattice

- **The hexagon is a unit of measure, not a container.** It exists so that
  distance is countable and reveal is bounded:
  - moving one hex costs X time, so moving Y hexes costs X·Y (§3);
  - exploring reveals a stated number of hexes (§2.2);
  - a place sits inside a hex; places are tenants of the lattice.
- **Places are sparse.** Terrain you cross is the default; a place is an
  event. Most of the map is empty, and the empty hexes are the cost of travel.
- Art: ~15–20 authored *place compositions*, reused with prop variation, over a
  repeatable base terrain.
- Six equidistant neighbours: travel cost is head arithmetic.
- The lattice **generates procedurally**. A ruin is a **destination**, not a
  build site. A second region is a data row.
- **Real axial coordinates**; distance is one expression. `grid.ts` is square
  grid maths with three metrics and is **not** reused.
- No code shared with the province: the world map has no workers, no
  influence radius and no adjacency that pays Gold.

### 1.4 Two zoom registers

| Register | Hex width | On a 390 pt phone | Its job |
|---|---|---|---|
| **Tactical** | ~130 pt | ~3 across | **Look at a place.** What is inside it, what you can do, and the sheet that acts on it |
| **Strategic** | ~45 pt | ~8–9 across | **Measure and plan.** Count hexes, judge travel time, read borders and ownership |

- The strategic register is the planning surface, not an overview. It ships
  with the world map.
- The jump between registers is ~3×.
- 3–4 content elements are legible on a tactical hex.
- **Content icons are read, not tapped.** At ~130 pt an icon is 25–40 pt,
  under the 44 pt (Apple) and 48 dp (Material) minimums. **The hexagon is the
  tap target; the dispatch sheet is where actions happen.**
- A hexagon **never** opens a map of its own. Contents on the hex, actions in a
  sheet (OQ-6).
- **Outposts, not cities** (§4): one or two structures on a claimed hex. The
  session budget is ~30 min/day.

## 2. Fog on the world map

> **The province is tapped. The world map is sent to.**

- Province: tap a tile, 1 Mana, something happens now — tactile, high
  frequency.
- World map: dispatch a scout or a party; it resolves over time — planning, low
  frequency.
- One tactile loop and one planning loop across two or three visits a day.

### 2.1 Authority

- World fog is **information, not permission**: it does not block movement or
  any action.
- It is therefore **client-authoritative and lives in the player's own save**:
  no shared table, no RPC.
- Granularity is the hex: a player's fog state is a small bitset over a few
  hundred hexes.
- Authority boundary: the province is client-authoritative, contested claims
  are server-authoritative, world fog falls on the client side because it
  decides nothing.
- If the fog is ever made to gate something ("you cannot attack what you have
  not explored") it becomes server-authoritative state. That is a deliberate
  decision, never a drift.

### 2.2 Reveal radius

| Scout post | Radius | Hexes revealed |
|---|---|---|
| initial | **0** | **1 — the target hex only** |
| upgraded | 1 | 7 — the target plus its six neighbours |
| upgraded | 2 | 19 |

- The reveal radius is a progression axis. It starts at one hex, so each reveal
  is a choice of neighbour, and opens into rings later.

### 2.3 Fog states

| State | Looks like | Province equivalent ([`01-map-and-fog.md`](01-map-and-fog.md) §4) |
|---|---|---|
| **Revealed** | full terrain, contents, borders | Revealed |
| **Sensed** | dimmed and half-veiled; faint silhouettes of what it holds show through the haze | Discovered |
| **Unknown** | opaque rolling mist, whole hexes hidden | Undiscovered |

### 2.4 Reveal cost

- Revealing a hex costs **Gold and time, scaling with distance**.
- **Not Mana** ([`09-relics.md`](09-relics.md) §3). Gold's sink at world scale
  once the province's 194,142 is spent.
- The world-map scout post continues the province's acceleration ladder:
  `fog.claimDiscoverRadius` = 5, **Cartography** (each fog tap counts double),
  **Surveying** (+1 a rank, two ranks → the ×1→×2→×3→×4 staircase), **Pitons**
  (−10% a rank on the fog's Gold).

## 3. Travel

> **One hex costs X time to cross. Y hexes cost X·Y.**

- Travel time is the world map's equivalent of `tap.workSeconds`: the single
  dial that sets the tempo of the scope.
- Cost scales with distance, as the province's fog does per ring (1, 3, 5, 10,
  20, 40, 80, 160, 320, 640). Linear or superlinear in hexes: OQ-65.
- **Travel is a timer, so the offline cap does not touch it**
  ([`../implementation-plan.md`](../implementation-plan.md) §1). Production is
  capped at 8 h; a party dispatched before a twelve-hour absence has arrived on
  return.
- Distance is the strategic property: a place three hexes away is worth more
  than the same place nine hexes away, and borders have consequences.

## 4. Contest and PvP

Promise 1: *nothing you own is ever taken from you. **No raids**, no decay, no
starvation, no failure state. Pressure comes from opportunity that expires.*

| Degree | What is contested | Breaks promise 1? |
|---|---|---|
| Leagues and rankings | status | No |
| **Contested claim** — first to a hex keeps it | **the opportunity** | **No** — "opportunity that expires", with another player as the clock |
| **Territory that changes hands** — hold a hex, it produces for you, it can be taken | **the hex, never your property** | **No** — what is lost is future rent from something never in your city |
| Raiding another player's city | **their property** | **Yes, head-on** |

> **Your village can never be attacked. Everything outside it can be
> contested.**

- Design rule, technical boundary and marketing line at once: province private
  and client-authoritative, world map shared and server-authoritative.
- **An outpost is a claim, not a building.** If it falls, the hex reverts to
  unclaimed and the player keeps everything it already produced.

## 5. World map outputs

The outer scope feeds the inner one.

| The world map pays | Which lands in |
|---|---|
| **3★ relic ingredients** — its exclusive output | the collection arc, whose passives improve the province economy |
| **Plot expansions** | a bigger province |
| **Knowledge cap** — contested landmarks raise it | research, per [`07-research.md`](07-research.md) §7 |
| Resources the province cannot produce | province sinks |

- The loop: world → 3★ → maxed relics → economy passives → a stronger
  province → more capacity to contest the world. Rarity split:
  [`09-relics.md`](09-relics.md) §2.
- Option (not designed): high-tier technologies from world exploration, as a
  second exclusive output — tomes found by exploring
  ([`07-research.md`](07-research.md) §2) on the shared map
  rather than in the authored province. Same rarity logic as the 3★
  ingredients.

## 6. Plot bound and save shape

- **The buildable area is bounded in data** — a `city.maxBuildDistance` or a
  buildable flag on the plot. A balance number, not a refactor (OQ-1).
- The province fog stays as it is; the far ring pays **content access**, not
  more buildable tiles. Ruins and landmarks sit at distance 3–12; the far cells
  are mostly mountain and water, which are not buildable.
- **The save says which scope a thing is in.**
- The guild siege lives on the world map ([`15-social.md`](15-social.md) §6).
- This is larger than the `regions: Record<RegionId, RegionState>` reshape and
  is not an early item; the save shape is the part that cannot change
  retroactively.

## 7. World map components

Each is playable without the ones after it.

- Bounded plot; expansions as authored increments.
- **The guild siege as the world map's first place**: one hex, co-op, no shard,
  no PvP, no fog — the world map with a single entry, on the code path the full
  scope uses.
- Temporary provinces as the event format ([`13-events.md`](13-events.md)).
- **The lattice proper**: axial coordinates, neighbours, distance, travel cost,
  both zoom registers, sparse places with contents, client-side fog at radius
  0, the dispatch sheet, the scout post.
- Shards, seasons and contested claims — where PvP exists.
- Server-side combat resolution: a deterministic scoring pass, not a
  simulation — ATK/DEF/HP, a type chart, one pass.

## 8. Deliberately not in this design

- A procedural province generator.
- Server-authoritative world fog (§2.1).
- A hexagon that opens a map of its own (§1.4).
- Cities on the world map.
- Raiding (§4).
- Reusing `grid.ts` for the lattice (§1.3).
- Anything multi-region beyond the existing `regionId` discriminator.

**Open questions:** OQ-1, OQ-2, OQ-3, OQ-4, OQ-5, OQ-38, OQ-65, OQ-66, OQ-67 in
[`../open-questions.md`](../open-questions.md).
