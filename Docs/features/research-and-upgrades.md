# Research & Upgrades

One menu (🔬 Research), ONE tree. Technologies are square nodes; upgrades
are small circle nodes hanging below the technology that unlocks them —
what you can improve is always shown in the context of how you unlocked it.

## Technologies (squares)

One-time researches that **unlock new content** (buildings, units, upgrades).

- Cost **Gold + time**; paid up front from the CITY purse; complete through
  the unified advance (so they finish while away, in real time like the build
  queue). Gold and nothing else — no materials, no second currency — so the
  tree competes with clearing fog and raising a building for **one budget**.
  Three calls on one purse is the decision the economy is built around
  ([`currency-simplification.md`](currency-simplification.md) §3).
- The instant upgrades below are Gold too. **What separates them is not the
  currency**: an upgrade is permanent and stacking; a technology is a one-time
  unlock.
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

- `Technologies` sheet: `cost_gold`, duration, `requires` (comma-separated ids).
- `Upgrades` sheet: `cost_base, cost_growth, max_level, effect_per_level,
  required_tech`.
- Settings: `research.tech_slots`, `research.max_slots`,
  `research.slot_gem_cost_base`, `research.slot_gem_cost_growth`.

The tree: **Forestry** is the root — it opens the FOREST to the tap (see
[`../onboarding.md`](../onboarding.md) steps 2-3) and carries the upgrades
TapPower, QuickHands and WorkerLoad. Four themed branches leave it:

- **CIVICS (up)**: **Urban Planning** (Housing L2) → **Communities** (every
  Housing +1 capacity) → **Architecture** (Townhall L3)
- **ECONOMICS (left)** — two rows:
  - **Saws** (the Sawmill) hangs directly off Forestry: chopping by hand and
    automating it are two separate decisions, ten onboarding beats apart;
    upgrade **Sawpits** (+1 Wood per worker delivery)
  - **Hunting** also hangs off Forestry and gates the **wild game** tap —
    the one resource behind a technology of its own; upgrade **Butchery**
    (+1 Meat per collect tap)
  - farm side: **Agriculture** (FarmLands **and** the Farm — one research, so
    nothing sits between tapping a plot and automating it) → **Farming**
    (Farm L2; upgrade **Scythes**, +1 Food per collect tap); Agriculture also
    carries **Irrigation** (+1 Food per worker delivery) and leads to
    **Market** (Market building; upgrades MarketStall +5% sale prices,
    TradeRoutes +10% tax income)
  - stone side: **Masonry** (Quarry; upgrade Stonecutting) → **Mining**
    (Mine, costs Stone; upgrade Iron Picks) → **Deep Mining** (Mine L2);
    Masonry → **Engineering** (Quarry L2, Sawmill L3)
- **EXPLORATION (right)**: **Cartography** heads the branch and carries an
  effect of its own — every tap on the fog counts **double** — rather than
  only gating what follows. Its upgrade **Surveying** adds +1 more per level
  (max 2), so the ladder is ×1 → ×2 → ×3 → ×4. A tech with a stat effect is
  not new here: Communities adds +1 to every bed the same way. → **Sailing** (sea cells become explorable) →
  **Fishing** (the Docks + fishing boats; upgrade Big Nets) →
  **Shipbuilding** (Docks L2); Cartography → **Scaling Tools** (mountain cells
  become explorable; upgrade **Pitons**, −10%/level on the Gold a cell of fog
  costs — Pitons discounts the price, Surveying buys back the taps, so the two
  stack without either making the other moot)
- **MILITARY (down)**: **Warrior** (the Warrior unit) → **Spears** (Lancer),
  **Archery** (Archer), **Cavalry** (Cavalry)
- **Attunement** carries **Resonance** (−20%/level on the Mana a relic costs
  to cast)

**Shape carries the kind** (2026-09-02): a technology is a rounded **square**,
an upgrade a smaller **circle** hanging below its parent. They used to differ
only in size, which is a weak signal on a busy tree; now it reads as trunks
with beads on them.

Scoped upgrades (per-resource tap and worker yields) are small lookup tables at
the call site — `TAP_YIELD_UPGRADES` and `WORKER_YIELD_UPGRADES` in
`upgrades.ts` — rather than a general scoping mechanism, because a handful is
all the game has and a table is what the handful needs.

`UPGRADE_ORDER` is **derived** from `UPGRADES`, not restated. It used to be a
hand-written list and it silently went stale — Surveying was added, never
listed, and so never drawn in the tree at all, while a quest pointed the player
straight at it. The tree groups upgrades by filtering that list, so anything
missing from it is invisible in the game.

Exploration gates: `revealTap` refuses (`TechLocked`) to reveal Water cells
before Sailing and Mountain cells before Scaling Tools — building fog radii
ignore the gate. Mountains (the northern iron ridge, the eastern rocky peaks,
and foothills beside the home island's rock deposits) are unbuildable terrain,
drawn with the `terrain_mountain.png` tile like any other biome.

Tech tree positions are hand-authored (`node: {x, y}` in `definitions.ts`) —
layout is content; cells (−1,0) and (1,0) stay empty so the branch trunks can
elbow through them without crossing nodes. Cartography sits at (2,0) rather
than the nearer (1,0) for exactly that reason — the Forestry→Attunement
connector already elbows through (1,0). Upgrade circles auto-fan below their
parent.

**Crop Rotation was retired** (2026-09-02). It gated the Farm's level 2 and
nothing else; when Agriculture took over the Farm itself, Farming inherited
that level gate and Crop Rotation was left unlocking nothing. A node in the
tree that unlocks nothing is the same lie as a lit tab that leads nowhere.

## Changes from 2026-09-02

The tree today is a **checklist rather than a tree**: one root gate (Forestry,
with 6 of 20 techs hanging off it), five branches that never reconverge, no
exclusive picks, and a maximum depth of 4. It is also fully exhausted inside the
2–3 hour arc. Three changes, none of which alter the mechanics above:

- **The military branch now unlocks buildings, not just units.** `Warrior`,
  `Spears`, `Archery` and `Cavalry` currently unlock units that do nothing. Each
  becomes the gate for its training building — Barracks, Spear Hall, Shooting
  Grounds, Stables — which is what raises the army cap
  ([`balancing-v2.md`](balancing-v2.md) Part 2). The branch stops being a dead
  limb.
- **Two new leaves grant slots.** One technology grants the **second attunement
  slot** ([`magic.md`](magic.md)) and one grants a **third party slot**
  ([`expeditions.md`](expeditions.md)). Every further slot of either kind costs
  Gems, so research is the earned half of both gates and the paid gate is never
  the only route in.
- **A `Sanctum` gate** for the Mana-capacity district, on the civics branch.

Note that **upgrades and artifacts must not overlap**. Upgrades are permanent and
stacking, bought with Gold out of the city; artifacts are exclusive and
swappable, levelled with Knowledge out of the kingdom — and Knowledge only ever
comes out of a dungeon or a banner ([`knowledge.md`](knowledge.md)). No single
effect should be reachable through both — see
[`magic.md`](magic.md) §"Keeping this out of stat-soup territory".

The `effectiveX` helpers this document describes gain a third stage: **balance
base → upgrade levels → modifier stack**, so artifact passives, timed actives and
event boons all reach the same values without new bespoke code. See
[`engine-seams.md`](engine-seams.md) §2.
