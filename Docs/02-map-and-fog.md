# 02 — Map & Fog of War

> **FROZEN — Unity as-built snapshot, 2026-08-17.** This file documents the
> *Unity* prototype (hex grid, Silver, generator vaults), not the web build. It is
> kept for provenance and for the formulas the port still uses. Where it disagrees
> with [`00-design-intent.md`](00-design-intent.md) or with `Docs/features/`, those
> win. Do not implement from this file without checking there first.

## Hex grid model

- The map is a **pointy-side hex grid** (Unity Tilemap, Hexagon layout, cell size
  4 × 3.5 world units, no gaps).
- A **cell** has: a terrain type (required), an optional terrain feature, and at most
  one district.
- Coordinates are stored in a 3-component struct `HexCoordinates(X, Y, Z)`, **but in
  practice they are offset coordinates**: `X = column`, `Z = row`, and `Y` is always 0.
  The struct's cube-math helpers (`DistanceTo`, cube `Neighbors`) are therefore
  unreliable and are *not* used by gameplay.

### Adjacency (the 6 real neighbours)

Because rows are offset, the game derives true hex adjacency geometrically
(`HexNeighbourFinder`):

1. Take the 8 square-ring offsets of the cell: `(±1,0), (0,±1), (±1,±1)`.
2. Discard candidates that don't exist on the map.
3. Compute each candidate's world-space distance from the origin cell.
4. Keep candidates whose distance ≤ `1.25 ×` the nearest candidate's distance.

The 6 real hex neighbours are equidistant (nearest); the 2 diagonal "corner" cells are
~1.73× farther and get filtered out. The result is orientation- and parity-agnostic.

> Web-port equivalent: any standard odd/even-row offset neighbour table gives the same
> 6 neighbours; the geometric filter is just how Unity's arbitrary offset storage was
> handled.

### Distance from the Townhall

`TownhallDistanceService`: **BFS over existing neighbours** starting at the Townhall's
cell. Adjacent = 1. A cell that is unreachable (disconnected, or map not loaded yet)
returns **0** — i.e. no distance penalty. This distance feeds fog reveal cost, build
time, and (where enabled) build cost.

### The Townhall origin

A brand-new city's Townhall sits at cell `(0, 0)` (the default `HexCoordinates`; the
`CityFactory` never sets an explicit location).

## Terrain types

Six terrain definitions exist: **Grassland, Plains, Desert, Snow, Tundra, Water**
(a Tropical art tile also exists without a definition). All have an **empty BaseYield**
— terrain produces nothing. Terrain currently matters only for placement (Farms
require Grassland) and visuals. Water is used as the map border/filler; nothing
prevents building on Water *per se* — placement rules are per-district (see
`04-districts.md`), and in practice only Farms check terrain.

## Terrain features

| Feature | On the map | Tap durability | Destroyed → | Upgraded → | BaseYield |
|---|---|---|---|---|---|
| **Trees** | 13 cells in Region_01 | destroyed after 5–12 taps (random per cell) | TreesCut | — | empty (see note) |
| **TreesCut** | none initially | indestructible (0/0) | — | Trees (regrowth; UI hint "Grow trees") | empty |

- Features block district placement (universal rule). When a district is built on a
  cell whose feature was hidden during placement preview, the feature tile is removed;
  cancelling the build restores it.
- Lumber camps *work* adjacent+connected revealed Trees cells for bonus Wood (see
  `03-economy-and-production.md`).

## Region_01 layout

The full authored map is in **`data/region-map.json`**: 155 terrain cells
(98 Grassland forming the playable landmass, 57 Water border) and 13 Trees features,
with grid metadata. Terrain bounds: origin `(-6, -8)`, size `13 × 43` cells; features
bounds: origin `(-3, -2)`, size `9 × 37`. The Townhall cell `(0, 0)` is Grassland.

## Fog of War

Three cell states:

| State | Stored? | Meaning | Interaction |
|---|---|---|---|
| **Revealed** | yes (the only stored state) | fully in play | taps fall through to gameplay handlers |
| **Discovered** | derived: any existing neighbour is Revealed | dimmed, shows a reveal progress bar once paid into | tappable to pay toward reveal |
| **Undiscovered** | derived: no revealed neighbour | opaque | taps are swallowed (do nothing) |

State derivation is a pure function of the revealed set + the cell's existing
neighbours.

### Seeding a new game

On first initialization (only when nothing was restored from a save): every district
cell of the city **plus all its neighbours** is revealed. With just the Townhall at
`(0,0)`, that's the Townhall cell + its 6 neighbours.

### Paying to reveal

- Each tap on a Discovered cell pays `min(SilverPerTap, remaining)` Silver from the
  city wallet; **SilverPerTap = 1**. Progress accumulates per cell; when accumulated
  Silver ≥ the cell's total cost, the cell becomes Revealed (progress is discarded).
- Reveal taps are blocked while a full-screen overlay menu is open (the tile-info
  popup doesn't count).
- Revealing a cell triggers a production recalculation for the active city (newly
  revealed Trees can join a Lumber camp's worked patch).

### Reveal cost curve

Total Silver to reveal a cell at BFS distance `d` from the Townhall
(`FogOfWarSettings.GetTotalCost`):

- Authored rings: `{distance 2 → 3, 3 → 4, 4 → 5}` Silver.
- `d` below the first authored ring → the first ring's cost (so d ≤ 2 → 3).
- `d` between authored rings → the nearest **lower** ring's cost.
- `d` beyond the last ring: `round(5 × max(1, FallbackGrowth)^(d − 4))` with
  **FallbackGrowth = 1.25**.
- Result is never below `SilverPerTap` (1).

| d | 1–2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|
| cost | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 15 | 19 |

### Persistence

Saved: the revealed cell list and per-cell partial progress (`kingdom.fogOfWar`).
A load that restores at least one revealed cell marks the fog as seeded, so the
starting-area seed only runs for brand-new games.
