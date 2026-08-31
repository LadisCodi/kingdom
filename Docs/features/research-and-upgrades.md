# Research & Upgrades

The research system splits in two:

## Technologies

One-time researches that **unlock new content** (buildings, units, mechanics).

- Cost **resources + time**; paid up front; complete through the unified
  advance (so they finish while away, in real time like the build queue).
- Limited by **concurrent research slots**: base 1. Additional slots are
  bought **with Gems** directly in the Technologies tab, at an escalating
  price (`slot_gem_cost_base × slot_gem_cost_growth^purchased`, capped by
  `research.max_slots`).
- Form a **tech tree**: each technology lists `requires` (all must be
  completed first). Content gates via `requiredTech` on districts and units.
- UI: a pannable tree of compact icon nodes with dotted orthogonal
  connectors, expanding from the center. Border color = state (green done,
  gold available, grey locked; progress bar on the node while researching).
  Tapping a node opens an info panel with description, cost, time,
  requirements, and the Start button.

## Upgrades

**Instant, gold-only, leveled** numeric boosts to existing mechanics.

- Cost at level L (0-based): `round(cost_base × cost_growth^L)` Gold.
- No prerequisites except an optional `required_tech` (unlocked together
  with the mechanic they improve).
- Effects apply through **effective-value helpers** in `src/sim/upgrades.ts`
  (`effectiveTapYield`, `effectiveCollectCooldownMs`, `effectiveWorkerYield`,
  `effectiveMarketCapacity`, `effectiveSellIntervalMs`): consumers read
  those instead of raw balance values, so every level is one sheet row away.
- UI: a vertical list — icon, name, effect description, `Lv N/max`, cost,
  Upgrade button. Locked rows show the missing technology.

## Data

Everything numeric lives in the balance workbook:

- `Technologies` sheet: costs, duration, `requires` (comma-separated ids).
- `Upgrades` sheet: `cost_base, cost_growth, max_level, effect_per_level,
  required_tech`.
- Settings: `research.tech_slots`, `research.max_slots`,
  `research.slot_gem_cost_base`, `research.slot_gem_cost_growth`.

Initial content: Agriculture (Farm) · Archery (Archer) · CavalryTraining
(requires Archery; Cavalry). Upgrades: TapPower, QuickHands, WorkerLoad,
MarketStall, TradeRoutes. Tree positions are hand-authored (`node: {x, y}`
in `definitions.ts`) — layout is content.

Both menus share one navbar entry (🔬 Research) with
[Technologies | Upgrades] tabs.
