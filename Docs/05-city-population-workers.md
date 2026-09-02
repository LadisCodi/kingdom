# 05 — City, Population & Workers

> **FROZEN — Unity as-built snapshot, 2026-08-17.** This file documents the
> *Unity* prototype (hex grid, Silver, generator vaults), not the web build. It is
> kept for provenance and for the formulas the port still uses. Where it disagrees
> with [`00-design-intent.md`](00-design-intent.md) or with `Docs/features/`, those
> win. Do not implement from this file without checking there first.

## The city

A **city** owns:

- its own currency wallet (Food, Silver, Wood); *(web build: Silver is now Gold, and population is trained over time at the Townhall rather than bought instantly)*
- its **population** count;
- its list of districts (always created with a Townhall);
- one **build queue** (capacity from its definition — Oakville: **1**).

Oakville's definition: name `Oakville`, Townhall district = `TownhallDistrict`,
buildable districts in menu order = **Housing, Farm, FarmLands, Lumber**, initial
population **2**, initial currencies **50 Silver + 5 Food**, villager prices
authored then `× 1.45` (below), build queue capacity **1**, max army power per Townhall level
**[10, 20, 30]**.

City events that other systems react to: `CurrencyChanged`, `WorkersChanged`,
`PopulationChanged` (the last one triggers a production recalc, which updates the
Townhall's population-tax Silver rate).

## Population

- **Max population = Σ PopulationCapacityForLevel over active (built) districts.**
  Townhall provides 3, each Housing 2 → TH1 max 7, TH2 max 11.
- Population is bought **one point at a time with Food** (from the Housing/Townhall
  district card's Buy Population widget):

**Authored for the opening, exponential after it** (2026-09-02). The first
handful of villagers ARE the early game — each one is a decision the player
makes minutes apart — and the difference between 5 Food and 20 is the
difference between a beat and a formality. No `base × growth^n` can be made to
say 5, 20, 100, 300 without deforming everything past it, so it does not try:
`city.population_cost_first` lists the opening prices in order and the curve
takes over from the LAST of them, which is what keeps the two halves meeting
without a step.

```
cost(n) = population_cost_first[n]                            while authored
        = round(last authored × growth^(n − lastIndex))       after that
```

| Villager | 1st | 2nd | 3rd | 4th | 5th | 6th | 7th | 8th | 9th | 10th |
|---|---|---|---|---|---|---|---|---|---|---|
| Food cost | **5** | **20** | **100** | **300** | **500** | **1000** | 1450 | 2103 | 3049 | 4421 |

The bold six are authored; the rest is `× 1.45` from the last of them.

- Results: `Success | AtMax | NotEnoughResources`. Buying fires `PopulationChanged`,
  which immediately raises the Townhall's Silver tax rate (5 Silver/min per point).
- Population never decreases (no mechanic removes it).

## Workers

- **One shared pool per city:** `AvailableWorkers = Population − Σ AssignedWorkers`
  across all districts.
- Only worker districts (Farm, Lumber — those with a non-empty `MaxWorkersPerLevel`)
  can be staffed, via +/− buttons on their district card.
- Assignment limit per district:
  `min(MaxWorkersForLevel(level), 1 + workableUnitCount)` — you can't staff more
  workers than there are things to work (worker #1 runs the base, each extra works one
  unit). Exceeding it shows "No more tiles available to work."
- Unassigning returns the worker to the pool. Assign/unassign triggers a production
  recalc.
- A built worker district with 0 workers is idle; the UI flags it (world-space
  "needs workers" warning on the district and the free-workers header widget).

## Builders

Builders are a **kingdom-level** concurrency stat for the build queue (not city
workers): the kingdom starts with **1** builder, hard max **4**, and *no current
mechanic increases it*. The header shows `available/max` where
`available = max − min(queuedItems, max)`. See `06-construction-queue.md`.
