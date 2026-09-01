# 03 — Economy & Production

> **FROZEN — Unity as-built snapshot, 2026-08-17.** This file documents the
> *Unity* prototype (hex grid, Silver, generator vaults), not the web build. It is
> kept for provenance and for the formulas the port still uses. Where it disagrees
> with [`00-design-intent.md`](00-design-intent.md) or with `Docs/features/`, those
> win. Do not implement from this file without checking there first.

## Currencies

| Currency | Scope (wallet) | Capped | Start | Notes |
|---|---|---|---|---|
| Food | City | no | 5 | Buys population |
| Silver | City | no | 50 | Main build/reveal currency; taxed from population by the Townhall *(web build: merged into Gold, earned at the Market)* |
| Wood | City | no | 0 | Secondary build material |
| Gold | Kingdom | no | 100 | No source or sink yet |
| Knowledge | Kingdom | no | 0 | Reserved for research; no source or sink |
| Gems | Player | no | 10 | Premium; only sink is finishing queue items instantly |

City starting amounts and population come from the city definition (Oakville:
Silver 50, Food 5, population 2). Kingdom/player starting amounts come from the
initial-game-state settings (Gold 100, Gems 10). Saved amounts overwrite
starting amounts on load.

Kingdom production: the kingdom definition lists `{currencyId, PerHour}` entries —
one generator each with `rate = PerHour / 60` per minute. PlayerKingdom currently has
none (the Mana trickle left with the spell system).

## Generators

Every producing district owns one **generator per currency** it produces
(id: `{districtID}_{currencyID}`). A generator holds:

- a list of **modifiers** `(category, source, kind, value)` — kind is `Flat`
  (units/min) or `Percentage` (fraction added);
- `LastProduction` — UTC timestamp of the last paid-out production;
- `VaultStored` / `VaultCapacity` — see Vaults below.

**Rate formula** (per minute):

```
flat = Σ values of Flat modifiers      (clamped: if flat < 0, flat = 0)
pct  = Σ values of Percentage modifiers
GenerationPerMinute = flat * (1 + pct)
```

Modifier categories in use: `Building` (district base output), `Feature` (worked-unit
yield), `Population` (Townhall tax), plus `Terrain` (legacy,
always stripped). New generators are created with `LastProduction = now − random(0..60s)`
to stagger whole-unit payouts across districts.

## Accrual algorithm

Once per second, for every **active** (built) district's generator
(`MakeCityGeneratorProduceUseCase`); precisely:

```
rate = generator.GenerationPerMinute
now  = UTC now

1. rate == 0            → LastProduction = now; stop.        (no backlog builds up)
2. destination full     → LastProduction = now; stop.        (overflow is LOST, deliberately)
     "full" = vault at capacity (vault generators)
              or wallet at its cap (capped wallets only)
3. produced = trunc(rate * minutesSince(LastProduction))     (whole units only)
4. produced == 0        → stop WITHOUT touching LastProduction (sub-unit remainder is kept)
5. LastProduction += (produced / rate) minutes               (advance only by time paid out)
6. deposit:
     hasVault (VaultCapacity > 0) → vault += produced (clamped to capacity); no wallet credit
     else                         → wallet += produced, floating "+N" feedback
   (exactly one destination — never both)
```

A negative-production path exists (a negative total rate consumes from the wallet,
clamped to what's there), but no current content produces negative rates.

The same algorithm runs for kingdom generators against the kingdom wallet.

**Offline consequence:** timestamps are persisted, so the first tick after loading
pays out the entire absence in one step — capped at the vault capacity for vault
districts (excess is lost; this nudges return visits), uncapped for wallet-direct
districts (FarmLands).

## Where the rates come from (production recalculation)

`RecalculateCityProductionUseCase` rebuilds every active district's modifiers. It
removes all `Terrain`/`Feature`/`Building`/`Population` modifiers it owns and re-adds
current ones. Contributions per district:

```
worksUnits = the definition has a worked-unit source AND per-tile yield (Farm, Lumber)
workedUnits = count of units this district currently works (see below)
workers     = district.AssignedWorkers

Base generation (per currency in BaseGeneration, level-scaled):
  worksUnits            → amount = (workers ≥ 1) ? levelAmount : 0    // needs one staffer
  else if UsesWorkers   → amount = levelAmount * workers              // scales per worker
  else                  → amount = levelAmount                        // unconditional
  → Flat modifier, category Building

Worked units (only if worksUnits):
  tileWorkers = min(workedUnits, max(0, workers − 1))                 // worker #1 staffs the base
  per currency in YieldPerWorkedTile: amount = levelAmount * tileWorkers
  → Flat modifier, category Feature

Population tax (any district with SilverPerPopulation > 0 — the Townhall, 5/pop):
  silver = SilverPerPopulation * city.Population                      // per minute
  → Flat modifier, category Population, currency Silver
```

Level scaling: `levelAmount = floor(baseAmount × (1 + BaseGenerationPerLevel × (level − 1)))`.
**All current districts have `BaseGenerationPerLevel = 0`**, so levels don't raise
per-unit yield today — they raise worker slots and count caps.

Recalculation triggers: build completed, upgrade completed, workers assigned/unassigned,
population changed, a fog cell revealed, a terrain feature replaced (destroyed/regrown).

## Worked units

The "one extra worker works one adjacent thing" mechanic. Two source kinds:

- **Feature source (Lumber → Trees):** BFS starting from the district's neighbours
  through cells that carry the worked feature and are **adjacent, connected, and
  revealed**, breadth-first (nearest first). Unrevealed cells neither count nor conduct
  connectivity — revealing more forest grows the worked patch.
- **Adjacent-district source (Farm → FarmLands):** the district's direct neighbours
  that are **active** (built) districts of the worked category.

Worker slots:

```
AssignableWorkerLimit = min(MaxWorkersForLevel(level), 1 + workableUnitCount)
```

Trying to assign past the limit is rejected with "No more tiles available to work."
The nearest `workers − 1` worked units are highlighted in-world when the district's
card is open.

## Vaults & collection

- A district with `VaultCapacity > 0` (Townhall 50, Farm 50, Lumber 50) banks all its
  production in a per-currency vault instead of the wallet.
- **Collection is clicker-style:** each tap on the district collects **1 unit of each
  stored currency** into the city wallet, with floating "+1" feedback and a sound.
  (Tapping a district that isn't the currently inspected one opens its card *and*
  collects once.)
- The vault fill fraction drives the district's on-map vault bar
  (Empty / Filling / Full states).
- Districts with no vault (Housing — no production; FarmLands — 3 Food/min) credit
  the city wallet directly and without cap.

## Current production rates (from data)

| District | Base (needs) | Per worked unit | Vault |
|---|---|---|---|
| Townhall | 5 Silver/min × population (unconditional) | — | 50 |
| Farm | 5 Food/min (needs ≥1 worker) | +3 Food/min per staffed adjacent FarmLands | 50 |
| FarmLands | 3 Food/min (unconditional, no workers) | — | none (straight to wallet) |
| Lumber | 5 Wood/min (needs ≥1 worker) | +3 Wood/min per staffed connected Trees cell | 50 |
| Housing | — | — | — |

Example: a Farm at level 1 with 3 workers and 2 adjacent built FarmLands produces
`5 + 3×min(2, 3−1) = 11 Food/min` into its vault; each FarmLands additionally drips
3 Food/min into the wallet. A Townhall with 7 population produces 35 Silver/min and
fills its 50-cap vault in ~86 seconds — then production halts until collected.
