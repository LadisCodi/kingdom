# Kingdom — the documentation index

**Kingdom** is a cozy square-grid city-builder / idle game, built for the web.
This file is the map of everything written about it.

Two bodies of documentation live here and they are not the same thing:

- **The live design** — [`00-design-intent.md`](00-design-intent.md),
  [`road-to-mvp.md`](road-to-mvp.md) and everything under
  [`features/`](features/). This is the source of truth for the game that
  exists and the game being built.
- **A frozen Unity snapshot** — files `01`–`11`, taken from branch
  `feature/back-to-hex` on **2026-08-17**, describing an earlier and different
  game (hex grid, Silver, generator vaults, spells). The web port was built
  from it and has since diverged substantially. It is kept for provenance and
  for the formulas the port still uses. **It is history, not spec**, and every
  one of those files says so at the top.

Where the two disagree, the live design wins.

## Reading order

| # | File | What it covers |
|---|---|---|
| — | [00-design-intent.md](00-design-intent.md) | **What the game is, and the canonical backlog.** Rewritten 2026-09-02; it supersedes this Unity snapshot wherever they disagree. **Start here.** |
| — | [road-to-mvp.md](road-to-mvp.md) | **What happens next** — the ordered plan for the four pillars the 2026-09-02 competitive review found missing, its phase gates, and the index of design decisions still open. |
| 1 | [01-overview.md](01-overview.md) | Pitch, entity hierarchy, core loop, currency summary, status |
| 2 | [02-map-and-fog.md](02-map-and-fog.md) | Hex grid & adjacency, terrain/features, fog of war & reveal costs |
| 3 | [03-economy-and-production.md](03-economy-and-production.md) | Currencies, generator model, accrual algorithm, worked units, vaults |
| 4 | [04-districts.md](04-districts.md) | District types, all balancing data, placement rules, cost/time formulas |
| 5 | [05-city-population-workers.md](05-city-population-workers.md) | City, population buying, worker pool, builders |
| 6 | [06-construction-queue.md](06-construction-queue.md) | Build queue engine, offline cascade, cancel/refund, gem rush |
| 8 | [08-army.md](08-army.md) | Units, recruiting, power cap |
| 9 | [09-ui-and-input.md](09-ui-and-input.md) | Every screen's data & behavior, world UI, the tap-handler chain |
| 10 | [10-persistence.md](10-persistence.md) | Save format, autosave, load order, offline progress |
| 11 | [11-gaps-and-discrepancies.md](11-gaps-and-discrepancies.md) | Stubs, data gaps, quirks — the deliberate-decision list for a port |
| — | [data/region-map.json](data/region-map.json) | The full Region_01 tile layout (155 terrain cells, 13 Trees), extracted from the Unity scene |

## The web build

These are the live source of truth, one per feature, newest last. Each opens
with its own scope-and-status blockquote.

| File | What it covers |
|---|---|
| [features/harvest-loop.md](features/harvest-loop.md) | Tappable resource cells, exhaustion/recovery, workers as walking units |
| [features/economy-taxes-and-market.md](features/economy-taxes-and-market.md) | Housing taxes, villager training, the Market |
| [features/research-and-upgrades.md](features/research-and-upgrades.md) | The one tech/upgrade tree and its fog |
| [features/resource-expansion.md](features/resource-expansion.md) | Stone, Fish and Iron lines; the archipelago |
| [features/quests.md](features/quests.md) | The onboarding chain (27 quests to Townhall 3, then 11 more into the long game) |
| [features/balancing-v1.md](features/balancing-v1.md) | The three-era Townhall arc |
| **[features/magic.md](features/magic.md)** | **Built 2026-09-02** — Mana, artifacts, attunement, landmarks (contested landmarks outstanding) |
| **[features/expeditions.md](features/expeditions.md)** | **Built 2026-09-02** — ruins as dungeons, staged delves, unit stats |
| **[features/heroes-and-gacha.md](features/heroes-and-gacha.md)** | **Built 2026-09-02** — the collection substrate and the gacha (attune-or-arm outstanding). Supersedes `managers.md` |
| **[features/engine-seams.md](features/engine-seams.md)** | **Built 2026-09-02** — the sim groundwork all of the above needed, and the build order it prescribed |
| **[features/ad-economy.md](features/ad-economy.md)** | **Built 2026-09-02** — Mana, taps and rewarded ads tuned as one loop; a tap pulls production forward |
| **[features/balancing-v2.md](features/balancing-v2.md)** | **Built 2026-09-02** — unblockers, military buildings, every new number |
| **[features/knowledge.md](features/knowledge.md)** | **Built 2026-09-02, rewritten the same day** — Knowledge is a dungeon reward and levels relics and heroes; the technology tree is Gold |
| **[features/currency-simplification.md](features/currency-simplification.md)** | **Built 2026-09-02** — eleven wallet rows down to seven; four coins on the plank; how the competition does it |
| **[features/moving-buildings.md](features/moving-buildings.md)** | **Built 2026-09-02** — relocating a built building, and dragging the placement ghost instead of panning |
| **[onboarding.md](onboarding.md)** | **Built 2026-09-02** — the authored first-user experience, 26 steps; the quest chain and the tech gates that serve it |
| **[features/builders.md](features/builders.md)** | **Built 2026-09-02** — no waiting line, and the Gem offer a refused build raises. The game's first real purchase surface |

### The MVP plan

Sequenced and gated by [road-to-mvp.md](road-to-mvp.md); each doc owns its own
design, and closes the open decisions §8 files against it.

| Phase | File | What it covers |
|---|---|---|
| 0 | [features/balancing-v3.md](features/balancing-v3.md) | **Designed, unstarted** — make the prose agree with the workbook before anything is balanced on top of it; the dead `kingdom.max_builders` dial |
| 1 | [features/habit-loop.md](features/habit-loop.md) | **Daily chest built 2026-09-02**; generated orders designed and blocked on one decision — a reason to open the game on a day nobody authored |
| 2 | [features/event-archetype.md](features/event-archetype.md) | **Designed, unstarted** — the thing we author ten times a year, on the timeline that is already built; the two seam widenings it needs first |
| 3 | [features/monetization-sim.md](features/monetization-sim.md) | **Designed, unstarted** — a store that never charges, more ad placements, and the telemetry that makes a D30 possible at all |
| 4 | [features/social-layer.md](features/social-layer.md) | **Designed, unstarted** — Supabase as server authority, neighbours and capped daily help, a guild, a weekly collective bar |

### Structural decisions

Not phases. These decide *where* every future system lives, and one of their
consequences — the shape of the save — cannot be changed retroactively, so they
are written down before they are built.

| File | What it decides |
|---|---|
| **[features/map-scopes.md](features/map-scopes.md)** | **Designed, unstarted** — the province bounded and authored, temporary provinces as the event format, a shared node graph for the world; and how much PvP the three promises allow |
| **[features/relics-and-ingredients.md](features/relics-and-ingredients.md)** | **Designed, unstarted** — a nine-piece ingredient set per relic, split 1★/2★/3★ by source, replacing Fragments; Mana as what magic costs on both maps |
| **[features/tomes-and-research.md](features/tomes-and-research.md)** | **Designed, unstarted** — Knowledge as a per-hour clock you commit, tomes as pages with tiers for eras, and the Knowledge ↔ Stardust rename |

### Reference, not a feature

| File | What it covers |
|---|---|
| [map-features.md](map-features.md) | The authored feature layout of the region — what sits on which cell, and why |
| [audio-wishlist.md](audio-wishlist.md) | The sounds the build wants and what each one is for |
| [art/ui-menus-redesign.md](art/ui-menus-redesign.md) | The parchment-and-carved-wood UI system the kit implements — §3.1 palette, §3.2/§3.3 shapes |
| [art/ui-long-game.md](art/ui-long-game.md) | Screens for the systems that arrived after the first UI pass |
| [art/sprite-prompts.md](art/sprite-prompts.md) | How the world and UI art was generated, and the prompts that did it |
| [features/managers.md](features/managers.md) | **Superseded** by `heroes-and-gacha.md` — kept for the reasoning, not as spec |

## Ground rules used throughout

- In the frozen `01`–`11` files, all numbers were read from the raw data assets
  and all formulas from the source code at the snapshot date — nothing is from
  memory or inferred. In the web build's own docs, **the workbook
  (`balance/balance.xlsx` → `src/sim/data/balance.json`) is the source of truth
  for every number**, and where a doc disagrees with it the doc is stale.
- Times are wall-clock UTC; rates are **per real-time minute**; the game ticks once
  per second.
- "TH*n*" = Townhall level *n*. Lists indexed "per level" are 0-indexed by
  `level − 1` and clamp to their last entry.
- Art direction reference: pixel-art (Aseprite), mockup `miniciv-mockup.ase` in the
  Unity project; art assets are not part of this spec.
