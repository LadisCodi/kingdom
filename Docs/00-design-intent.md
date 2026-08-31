# Kingdom — Design Overview

> A design-level guide to the Kingdom prototype. Describes what the game *is* and how it
> *plays* — the fantasy, the loops, and the systems from the player's point of view.
> No code, no architecture.

## The pitch

Kingdom is a cozy **city-builder / idle-management** game set on a fog-shrouded fantasy
hex map. You are a wizard-monarch growing a city from a single Townhall outward: you peel
back the fog to discover land, claim and build on hex tiles, grow a population that works
your districts, harvest resources that accrue over time (even while away), and use magic to
shape and squeeze the land. Costs scale with distance and ambition, so play rewards
thoughtful spatial and economic planning.

The starter city is **Oakville**, in the starter region **Region_01**. Working title seen
in mockups: "mini civ".

---

## The core loop

1. **Reveal** — spend Silver to tap away the Fog of War, expanding your usable land outward
   from the Townhall. The farther from home, the more each tile costs.
2. **Build** — place districts on suitable revealed hexes (Housing near the core, Farms on
   grassland, Lumber next to trees). Building costs resources up front and takes time.
3. **Grow** — spend Food to buy population; population is your workforce and your tax base.
4. **Staff** — assign population as workers to districts to drive their output.
5. **Harvest** — resources fill each district's vault passively; tap to collect, or let it
   bank while you're away.
6. **Reinvest** — upgrade districts and the Townhall. The Townhall's level is the master
   gate: raising it lifts caps and unlocks more and bigger districts.
7. **Push control** — advance the region toward domination (long-term goal).

Woven around this: a **premium currency**
(Gems) that skips waiting.

---

## The map

- **Hex grid.** Every cell has a **terrain** and optionally a **terrain feature**, and can
  hold one **district**.
- **Terrains:** Grassland, Plains, Desert, Snow, Tundra, Water (Tropical art also exists).
- **Features:** Trees (harvestable) and TreesCut (a forest that's been felled).
- **Tile markers** communicate affordances at a glance: what's selected, which tiles a
  district is actively working, valid build/expand spots (with the projected yield shown as
  a label).

### Fog of War — buying back the map

The world starts dark. Cells are **Undiscovered** (opaque, can't be interacted with),
**Discovered** (dimmed, tappable to reveal — shows a small progress bar), or **Revealed**
(fully in play). You spend **Silver, one tap at a time**, to reveal a Discovered cell; cost
**scales with distance from the Townhall**. Your Townhall and its immediate neighbors start
pre-revealed. Exploration is therefore a deliberate, paid expansion outward — not a free
reveal.

---

## The economy — currencies

Resources are grouped by who owns them:

**City-local** (each city has its own wallet):
- **Food** — the growth currency. Spend it to buy population. Produced by Farms. Cost of
  each new population point rises steeply.
- **Silver** — the main build/economy currency. Earned by the Townhall taxing your whole
  population. Pays for buildings, upgrades, and revealing fog.
- **Wood** — construction material from Lumber camps; a secondary build cost.

**Kingdom-wide** (shared across the realm):
- **Gold** — kingdom-level currency.
- **Knowledge** — reserved for a future research tree (unlock kingdom improvements and new
  future systems). Not yet spent anywhere.

**Player / premium:**
- **Gems** — hard currency. Its main use is to **finish a build or upgrade instantly**,
  priced by the time remaining.

The everyday flow: Farms → **Food** → buy **population**; population works districts and is
taxed into **Silver**; Lumber → **Wood**; Silver + Wood → **build & upgrade**; Silver also →
**reveal fog**; Gems → **skip timers**.

---

## Cities, population & workers

A **city** is your settlement: a Townhall plus a growing cluster of districts, with its own
Food/Silver/Wood wallet and its own build queue.

- **Population is both the workforce and the throttle.** Your max population is the sum of
  the housing your districts provide (Townhall + Housing). You buy population with Food, and
  each new point costs more than the last.
- **Workers come from a shared city pool.** Free workers can be assigned to worker districts
  (Farm, Lumber). More population also means more Silver tax income automatically.
- The UI shows free workers and warns when a built district has capacity but no one staffing
  it (so it's sitting idle).
- **Production runs continuously**, including offline — resources accrue in real time and
  bank in district vaults until collected.

---

## Districts — the buildable unit

A **district is one hex tile** — it's what the player places, staffs, upgrades, and collects
from. There's no separate "building"; the district *is* the building. A district can be
**Built** (active, producing), **Under Construction** (occupies the tile, produces nothing
yet), or a **Preview** ghost while you're choosing where to place it.

| District  | Role | Placement rule |
|-----------|------|----------------|
| **Townhall** | Heart of the city. Provides housing, **taxes population into Silver**, and its **level gates how many of each district you can own** and how high each can level. | The city origin. |
| **Housing** | Provides homes — raises max population. No workers. | Must be adjacent to the Townhall or other Housing, so the core grows as a connected blob. |
| **Farm** | Produces Food. Works adjacent FarmLands for bonus Food. | On empty Grassland. |
| **FarmLands** | Passive expansion tile: produces nothing alone; a neighbouring Farm works it to unlock extra worker slots and Food. Cheap and fast. | Adjacent to a Farm. |
| **Lumber** | Produces Wood. Works nearby Trees for bonus Wood. | On an empty cell next to revealed Trees. |

**Worker model:** for a worker district, one worker runs the building's base output; each
additional worker works one adjacent resource tile. You can't staff more workers than there
are tiles to work.

**Design levers** that shape play: population capacity and worker slots per level; how many
of each district a Townhall level allows; per-worked-tile yield; vault capacity; and
**build/upgrade times that grow exponentially with distance from the Townhall and with how
many you've already built** — so spamming one district type or sprawling far from home gets
expensive fast.

Each district has a **vault** that fills to a cap. Collecting is a **clicker-style tap**:
one tap banks one unit of each stored resource. The cap limits how much you bank while away,
nudging return visits.

---

## Construction & the build queue

- Building charges the cost **up front**; the district then sits **under construction**
  (occupying its tile, producing nothing) until its timer completes.
- Each city has **one shared build queue** for both new builds and upgrades. Its capacity is
  small at the start — a classic soft gate.
- **Builders** are the concurrency limit: they set how many queued items can progress at
  once; the rest wait their turn.
- **Timers run offline** — coming back catches everything up in order.
- **Rush with Gems** finishes an item immediately (same result as the timer completing).
- Queued items can be **cancelled**.

---

## Regions, kingdom & the long game

- A **Region** is a self-contained playable area hosting one city. Its long-term goal is
  **domination** — raising a "control" meter to 100%.
- **Claiming** expands your footprint toward domination through a chain of objectives:
  pay a cost, complete a prerequisite objective, or clear a point with your army (combat).
  *This quest-chain / claim / army system is designed but still largely a future feature.*
- A **Kingdom** is the top-level meta-entity that owns your regions and produces kingdom-wide
  currency over time. There's a single player kingdom.

---

## Screens the player sees

- **Header** — top resource bar: currencies plus Gems (with a buy button),
  Population, Builders, and Free Workers.
- **Nav bar** — bottom navigation, grouped into Build, Army and Research.
- **Build menu** — full-screen scroll list, one row per buildable district type.
- **Place district** — bottom panel during placement, with a ghost preview and highlighted
  valid cells on the map, ending in a Build button.
- **Tile / district card** — info + stats + upgrade for a built district, with Buy Population
  (Housing), worker +/- (worker districts), Upgrade, and Finish-now (pay Gems).
- **Research** — placeholder for a future research screen.

---

## Progression gating, in one line

Almost everything funnels through the **Townhall level**: it caps how many of each district
you can build and how high each can level. Upgrading the Townhall is the main gate that opens
up the rest of the game. Farther-reaching progression — Knowledge-based **research**, the POI
**quest chain**, and **army combat** for claiming — is planned but not yet built.

---

## Status notes (for reference)

Systems that are intentionally forward-looking / not fully implemented yet:
- **Research** (Knowledge spending, research screen) — placeholder.
- **Region claim** — POI quest chain, cost/prerequisite/clear objectives, and **army combat**.
- **Townhall upgrade** flow and **city↔region binding** — partially stubbed.
- The legacy `Buildings` folder (e.g. GoldMine) is superseded by generators living on
  Districts.
