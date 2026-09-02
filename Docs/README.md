# Kingdom — Complete Game Specification

Self-contained documentation of the **Kingdom** prototype ("mini civ" — a cozy hex
city-builder / idle game) exactly as built in the Unity project on branch
`feature/back-to-hex`, snapshot **2026-08-17**. It exists so the game can be
reimplemented on another platform (e.g. the web) without access to the Unity project:
all mechanics, formulas, balancing values, UI behavior, and the full map layout are
in these files.

## Reading order

| # | File | What it covers |
|---|---|---|
| 0 | [00-design-intent.md](00-design-intent.md) | **The current design intent for the web build, and the canonical backlog.** Rewritten 2026-09-02; it supersedes this Unity snapshot wherever they disagree. |
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

Files `01`–`11` above are a frozen Unity snapshot. The web reimplementation has
diverged substantially (square grid, the harvest loop, housing taxes, no spells
as-shipped), and its own design docs are the live source of truth:

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

## Ground rules used throughout

- All numbers were read from the raw data assets and all formulas from the source
  code at the snapshot date — nothing is from memory or inferred.
- Times are wall-clock UTC; rates are **per real-time minute**; the game ticks once
  per second.
- "TH*n*" = Townhall level *n*. Lists indexed "per level" are 0-indexed by
  `level − 1` and clamp to their last entry.
- Art direction reference: pixel-art (Aseprite), mockup `miniciv-mockup.ase` in the
  Unity project; art assets are not part of this spec.
