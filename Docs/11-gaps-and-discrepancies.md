# 11 — Gaps, Stubs & Discrepancies

Everything here is true of the current build and worth an explicit decision before or
during a reimplementation: keep the as-is behavior, or fix it to match intent.

## Intent vs. build divergences

1. **FarmLands produce on their own.** `00-design-intent.md` says a FarmLands
   "produces nothing alone", but the data gives it **3 Food/min unconditional base
   generation with no workers and no vault** — it drips straight into the uncapped
   city wallet (also making it an unlimited offline earner). The worked-by-a-Farm
   bonus (+3 Food/min per staffed FarmLands, via the Farm) exists *in addition*.
2. **(Historical) The Tap spell had no valid targets.** Extraction drew a random currency from the
   target feature's `BaseYield`, but both `Trees` and `TreesCut` have an **empty
   BaseYield**, so no cell is ever targetable. The full machinery — extraction,
   per-cell random durability (Trees: destroyed after 5–12 taps), feature destruction,
   Lumber losing the worked tile — is implemented but unreachable until a feature gets
   a yield.
3. **Townhall tax is vaulted (the core clicker beat).** The Townhall's Silver from
   population tax fills its 50-cap vault and must be tap-collected 1 Silver per tap
   (a recent balancing change). With 7 population (35 Silver/min) the vault fills in
   ~86 s and takes 50 taps to drain. Decide deliberately whether the web version keeps
   this tap intensity.

## Stubbed / future systems (designed, not built)

- **Research**: the Research screen is a placeholder; Knowledge has no source or sink.
- **Region claim & domination**: `Region.DomainProgress`/`IsDominated` exist but
  nothing drives them; claim requirement classes (cost / quest / clear-with-army)
  exist unused; no combat.
- **City ↔ region binding**: `AssociateCityWithRegionUseCase`,
  `BuildCityForRegionUseCase`, `RegionYieldCalculator` are empty TODOs.
- **`UpgradeTownhallUseCase` is a TODO** — the Townhall actually upgrades through the
  ordinary district-upgrade flow (it's just a district with MaxLevel 2).
- **Offline simulation step** (`SimulateOfflineActivityUseCase`) is an empty TODO —
  offline works implicitly via timestamps (see `10-persistence.md`).
- **Timed unit training**: `TrainDurationSeconds` is authored per unit but training is
  instant; no training queue.
- **Builders never grow**: kingdom starts with 1 builder (max 4); no mechanic
  increases it. Combined with build-queue capacity 1, exactly one build/upgrade can be
  pending at a time in practice.
- **Gold and Gems have no faucets**: Gold is granted once (100) and never spent; the
  Gems "add" button in the header is a no-op.

## Unreachable data

- Townhall `MaxLevel = 2`, so every per-Townhall-level list's third entry is
  currently unreachable: Farm count cap 2, FarmLands cap 12, army power 30, Lumber's
  TH-3 requirement for a hypothetical L4.
- Farm `MaxLevel = 2` makes its worker list effectively [3, 5] (the 7 is unreachable).

## Implementation quirks (don't copy blindly)

- **Double timer tick**: the once-per-second timer is ticked from two places, so
  per-second callbacks fire ~2× per real second (autosave every ~15 real seconds
  instead of 30). All *economic* math is wall-clock timestamp based, so amounts stay
  correct — but a port should drive the tick from one place.
- **Distance growth on build cost is off** for all buildable districts
  (`BuildCostDistanceGrowth = 1`); distance still multiplies build *time* (×1.15 per
  tile) and sets fog reveal cost. Only the non-buildable Townhall asset retains a 1.15
  cost growth value.
- **Coordinates**: the "cube" coordinate struct actually stores offset coordinates
  with Y = 0; adjacency and distance are computed geometrically/BFS (see
  `02-map-and-fog.md`). A port should just use proper offset/axial hex math.
- **Cost rounding**: build/upgrade costs use `floor`, durations and population cost
  use `round` — off-by-one differences will show up if a port normalizes these.
- **Preview feature-hiding**: during placement the target cell's feature tile is only
  *cosmetically* hidden; cancelling restores it.
- **Legacy `Buildings` module** (GoldMine, generator tiers) is superseded by
  district-owned generators but still present/installed in the Unity project — ignore
  it entirely.
- Unit recruit costs reference the shared (non-Kingdom) Silver asset; it resolves by
  string id, so it behaves identically — in a port, just use the currency id.
