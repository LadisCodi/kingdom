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
| 0 | [00-design-intent.md](00-design-intent.md) | The original design overview — the *intent* and player-facing fantasy. Everything else in this set is **as-built** and wins when they disagree. |
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

## Ground rules used throughout

- All numbers were read from the raw data assets and all formulas from the source
  code at the snapshot date — nothing is from memory or inferred.
- Times are wall-clock UTC; rates are **per real-time minute**; the game ticks once
  per second.
- "TH*n*" = Townhall level *n*. Lists indexed "per level" are 0-indexed by
  `level − 1` and clamp to their last entry.
- Art direction reference: pixel-art (Aseprite), mockup `miniciv-mockup.ase` in the
  Unity project; art assets are not part of this spec.
