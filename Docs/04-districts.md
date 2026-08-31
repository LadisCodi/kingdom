# 04 — Districts

A **district is one hex tile** — the unit the player places, staffs, upgrades and
collects from. Construction states: `Preview` (placement ghost), `UnderConstruction`
(occupies the tile, produces nothing), `Built` (active). Each district picks a random
visual variant in `[1, VariantCount]` at creation (all currently 1).

## The five district types

| | Townhall | Housing | Farm | FarmLands | Lumber |
|---|---|---|---|---|---|
| Role | City heart: trains villagers, its level gates everything | Houses the population | Produces Food; works adjacent FarmLands | Cheap filler: drips Food, is worked by Farms | Produces Wood; works connected Trees |
| Buildable | no (city starts with it) | yes | yes | yes | yes |
| PopulationCapacity | 0 | 2 | 0 | 0 | 0 |
| MaxWorkersPerLevel | — | — | [3, 5, 7] | — | [3, 5, 7] |
| MaxCountPerTownhallLevel | — (n/a) | [2, 4] | [1, 1, 2] | [6, 6, 12] | [1, 2] |
| BaseGeneration | — | — | 5 Food/min | 3 Food/min | 5 Wood/min |
| Worked source | — | — | adjacent **FarmLands** districts | — | connected revealed **Trees** cells |
| YieldPerWorkedTile | — | — | 3 Food/min | — | 3 Wood/min |
| VaultCapacity | 50 | 0 | 50 | 0 (wallet-direct) | 50 |
| MaxLevel | 2 | 1 | 2 | 1 | 3 |
| BuildCost | — | 10 Wood | 10 Wood | 20 Wood | 20 Wood |
| BuildCostMultiplier | 2 | 1.5 | 2 | 2 | 4 |
| BuildCostExponentialGrowth | 1.2 | 1.25 | 1.5 | 1.2 | 1.45 |
| BuildCostDistanceGrowth | 1.15 | **1** (off) | **1** (off) | **1** (off) | **1** (off) |
| BuildDurationSeconds | 0 | 20 | 20 | 10 | 20 |
| BuildDurationDistrictGrowth | 1.2 | 1.2 | 1.2 | 1.2 | 1.2 |
| BuildDurationDistanceGrowth | 1.15 | 1.15 | 1.15 | 1.15 | 1.15 |
| UpgradeCost | 25 Wood | — | 50 Wood | — | — (free, for now) |
| UpgradeCostLevelGrowth | 1.5 | — | 1.5 | — | 1.5 |
| UpgradeDurationSeconds | **0 (instant)** | — | 30 | — | 30 |
| UpgradeDurationLevelGrowth | 1.5 | — | 1.5 | — | 1.5 |
| RequiredTownhallLevelPerLevel | — | — | [1, 2, 2] | — | [1, 1, 2] |

All `…PerLevel` / `…PerTownhallLevel` lists are 1-based by index (element 0 = level 1)
and **clamp to the last entry** for higher levels. Empty count list = unlimited.
`RequiredTownhallLevelPerLevel` is indexed by *target* district level − 2 (element 0 =
requirement to reach district level 2); reaching level 1 never has a requirement.
`BaseGenerationPerLevel` and `PopulationCapacityPerLevel` are 0 everywhere, so upgrades
currently add worker slots (Farm/Lumber) and raise count caps (via Townhall level),
not per-unit output.

Effective caps at each Townhall level (Townhall MaxLevel is 2, so column 3 of the
lists is currently unreachable):

| TH level | Housing | Farm | FarmLands | Lumber | Max population | Max army power |
|---|---|---|---|---|---|---|
| 1 | 2 | 1 | 6 | 1 | 0 + 2×2 = **4** | 10 |
| 2 | 4 | 1 | 6 | 2 | 0 + 4×2 = **8** | 20 |

## Placement rules (build conditions)

Buildability is an **AND of condition objects**; each condition declares which
definitions it applies to, and all applicable ones must pass. The condition receives a
context of `(city, target cell)`.

Universal (apply to every district):
- **No feature** — the cell must not carry a terrain feature (Trees/TreesCut).
- **Revealed** — the cell must be fog-Revealed.
- **Count limit** — current count of the category (Built **or** UnderConstruction)
  < `MaxCountForTownhallLevel(townhallLevel)`.
- One district per cell (a cell with any district is never a valid target).

Per-type:
- **Housing** — adjacent to a Townhall or another Housing (under-construction Housing
  counts), so the residential core grows as a connected blob.
- **Farm** — cell terrain must be `Grassland`.
- **FarmLands** — adjacent to an **active** (built) Farm.
- **Lumber** — at least one neighbour must be a **revealed** cell carrying `Trees`.

## Upgrade requirements

Same pattern (AND of requirement objects over `(city, district)`). The only
implemented requirement: **Townhall level** —
`townhallLevel ≥ RequiredTownhallLevelForLevel(district.Level + 1)`, with blocked
message `"Townhall lvl N required"`. Also enforced by the upgrade use case: not
already at MaxLevel, not already upgrading, queue not full, affordable.
The Townhall upgrades through this same generic flow (it is just a district).

## Cost formulas

`n` = how many districts of this category the city already has (Built or queued);
`d` = BFS tile distance from the Townhall (see `02-map-and-fog.md`).

**Build cost** (per currency in BuildCost):

```
i          = n + 1                              // the instance being bought
expGrowth  = i ^ BuildCostExponentialGrowth
countMult  = max(BuildCostMultiplier × (i − 1) × expGrowth, 1)
distMult   = BuildCostDistanceGrowth ^ d        // = 1 for all buildable districts today
cost       = floor(base × countMult × distMult)
```

**Upgrade cost** (per currency in UpgradeCost; note it uses the *existing* count, and
has no distance term):

```
expGrowth  = n ^ BuildCostExponentialGrowth
countMult  = max(BuildCostMultiplier × (n − 1) × expGrowth, 1)
levelMult  = UpgradeCostLevelGrowth ^ (currentLevel − 1)
cost       = floor(base × countMult × levelMult)
```

**Build time**: `round(BuildDurationSeconds × BuildDurationDistrictGrowth^n × BuildDurationDistanceGrowth^d)`

**Upgrade time**: `round(UpgradeDurationSeconds × UpgradeDurationLevelGrowth^(currentLevel − 1))`

### Worked examples (current data)

Build costs by instance (distance-independent — all buildables have distance growth 1):

| Instance | Housing (W) | Farm (W) | Lumber (W) | FarmLands (W) |
|---|---|---|---|---|
| 1st | 10 | 10 | 20 | 20 |
| 2nd | 35 | 56 | 218 | 91 |
| 3rd | 118 | 207 | 786 | 298 |
| 4th | 254 | — | — | 633 |
| 5th | — | — | — | 1103 |
| 6th | — | — | — | 1717 |

Build times: the 1st Housing 2 tiles out = `round(20 × 1 × 1.15²) = 26 s`; the 2nd
Housing 3 tiles out = `round(20 × 1.2 × 1.15³) = 37 s`; the 1st FarmLands 2 tiles out
= `round(10 × 1.15²) = 13 s`.

Upgrade costs: with a single Farm, L1→L2 = 50 Wood, 30 s. Lumber upgrades are
currently **free** (no cost set in the workbook), 30 s for L1→L2 and 45 s for
L2→L3; the count multiplier still applies to upgrade costs in general — it just
has nothing to multiply here. Townhall L1→L2 = 25 Wood, **instant** (0 s
duration — the queue item completes on the next tick).

## Placement flow (as the player experiences it)

1. Pick a district in the Build menu (shows indicative cost/time at distance 0,
   current/max count, affordability, and "Townhall lvl N" when count-blocked).
2. Every legal cell gets an expand marker labelled with the projected yield; the legal
   cell **closest to the Townhall is auto-selected** and the camera centers on it.
3. A ghost preview district sits on the selected cell; the cell's feature tile is
   cosmetically hidden. The bottom panel shows exact cost & duration for that cell.
4. **Build**: pays the full cost up front, creates the district `UnderConstruction`,
   spawns its view, and enqueues it in the city build queue (see
   `06-construction-queue.md`). Fails cleanly with `QueueFull` / `NotEnoughResources`.
