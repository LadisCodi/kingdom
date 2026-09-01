# Research & Upgrades

One menu (🔬 Research), ONE tree. Technologies are square nodes; upgrades
are small circle nodes hanging below the technology that unlocks them —
what you can improve is always shown in the context of how you unlocked it.

## Technologies (squares)

One-time researches that **unlock new content** (buildings, units, upgrades).

- Cost **resources + time**; paid up front; complete through the unified
  advance (so they finish while away, in real time like the build queue).
- Limited by **concurrent research slots**: base 1. Additional slots are
  bought **with Gems** directly in the Research menu, at an escalating
  price (`slot_gem_cost_base × slot_gem_cost_growth^purchased`, capped by
  `research.max_slots`).
- Form a **tech tree**: each technology lists `requires` (all must be
  completed first). Content gates via `requiredTech` on districts, units
  and upgrades.
- UI: a pannable tree of compact icon nodes with dotted orthogonal
  connectors, expanding from the center. Border color = state (green done,
  gold available, blue + progress bar while researching). Tapping a node
  opens an info panel with description, cost, time, requirements, Start.

### Tree fog

The tree is discovered like the map:

- **Normal**: researched, researching, or all requirements met.
- **"?" silhouette**: one step ahead — every prerequisite is itself normal.
  Rendered as a dim dashed square with a `?`; no name, no cost, not
  tappable. You know *something* is there, not what.
- **Hidden**: anything deeper doesn't render at all. The canvas is sized to
  what's currently visible, so the tree physically grows as you research.

## Upgrades (circles)

**Instant, gold-only, leveled** numeric boosts to existing mechanics.

- Every upgrade has a parent technology (`required_tech`); its circle fans
  in below the parent's square **when the parent completes** — the visible
  reward of the research. Before that it isn't shown (and `buyUpgrade`
  returns `TechRequired`).
- Cost at level L (0-based): `round(cost_base × cost_growth^L)` Gold.
- Effects apply through **effective-value helpers** in `src/sim/upgrades.ts`
  (`effectiveTapYield`, `effectiveCollectCooldownMs`, `effectiveWorkerYield`,
  `effectiveSalePriceMultiplier`, `effectiveTaxRate`): consumers read
  those instead of raw balance values, so every level is one sheet row away.
- UI: circle with the upgrade glyph and a corner badge showing the current
  level (gold border affordable, green maxed). Tapping opens the same info
  panel slot: description, level pips, cost, Upgrade button.

## Data

Everything numeric lives in the balance workbook:

- `Technologies` sheet: costs, duration, `requires` (comma-separated ids).
- `Upgrades` sheet: `cost_base, cost_growth, max_level, effect_per_level,
  required_tech`.
- Settings: `research.tech_slots`, `research.max_slots`,
  `research.slot_gem_cost_base`, `research.slot_gem_cost_growth`.

Initial tree (all roads lead from Forestry):

- **Forestry** (root; Sawmill) → upgrades TapPower, QuickHands, WorkerLoad
- **Agriculture** (requires Forestry; FarmLands) → **Irrigation** (Farm)
- **Commerce** (requires Forestry; Market building) → upgrades MarketStall
  (+5% sale prices), TradeRoutes (+10% tax income)
- **Militia** (requires Forestry; Swordsman)
- **Masonry** (requires Forestry; Quarry) → upgrade Stonecutting; →
  **Mining** (Mine, costs Stone) → upgrade Iron Picks
- **Fishing** (requires Agriculture; Fishing Hut) → upgrade Big Nets
- **Archery** (requires Forestry; Archer) → **CavalryTraining** (Cavalry)

Tech tree positions are hand-authored (`node: {x, y}` in `definitions.ts`) —
layout is content. Upgrade circles auto-fan below their parent.
