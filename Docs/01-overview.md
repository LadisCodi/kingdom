# 01 — Overview

> As-built specification of the **Kingdom** prototype ("mini civ") as of 2026-08-17,
> branch `feature/back-to-hex`. This doc set describes what the game *does today*,
> precisely enough to reimplement it on another platform without access to the Unity
> project. Design intent lives in `00-design-intent.md`; where the build diverges from
> intent, `11-gaps-and-discrepancies.md` records it.

## What the game is

A cozy **hex city-builder / idle-management** game. The player is a wizard-monarch
growing a city (**Oakville**) from a single Townhall on a fog-shrouded hex map in the
starter region (**Region_01**): reveal fog with Silver, place districts on hexes, buy
population with Food, staff districts with workers, collect resources that accrue in
real time (including while away), upgrade through the Townhall gate, cast Mana spells
on tiles, and recruit an army.

## Entity hierarchy

```
Player                        (premium wallet: Gems)
└── Kingdom "PlayerKingdom"   (kingdom wallet: Gold, Mana, Knowledge; MaxBuilders; kingdom generators)
    └── Region "Region_01"    (one playable hex map; domination goal — designed, not implemented)
        └── City "Oakville"   (city wallet: Food, Silver, Wood; population; build queue; districts)
            └── District      (one per hex tile: Townhall, Housing, Farm, FarmLands, Lumber)
                └── Generator (per currency the district produces; vault + accrual timestamps)
```

There is exactly one player, one kingdom, one region, and one city in the current build.
The army (`ArmyRegistry`) is a single shared collection at kingdom/player scope.

## The core loop (as built)

1. **Reveal** — tap a Discovered hex; each tap pays 1 Silver toward its reveal cost
   (cost scales with distance from the Townhall). See `02-map-and-fog.md`.
2. **Build** — pick a district in the Build menu; valid cells are highlighted, one is
   auto-selected (closest to the Townhall); Build pays the full cost up front and puts
   the district under construction in the city's single build queue. See `04-districts.md`
   and `06-construction-queue.md`.
3. **Grow** — spend Food to buy population, one point at a time, up to the housing cap.
   See `05-city-population-workers.md`.
4. **Staff** — assign free population as workers to Farm/Lumber districts. Worker #1
   enables the district's base output; each further worker works one adjacent
   resource unit. See `03-economy-and-production.md`.
5. **Harvest** — production accrues per real-time minute into each district's vault
   (cap 50); tapping the district collects 1 unit of each stored currency per tap.
   Districts without a vault credit the city wallet directly.
6. **Reinvest** — upgrade districts and the Townhall. The Townhall level gates how many
   of each district can exist and how high each can level.
7. **Magic** — cast Rain (Food boost / forest regrowth) or Tap (resource extraction)
   with Mana. See `07-spells.md`.
8. **Army** — recruit Swordsman/Archer/Cavalry for city resources, capped by total
   power per Townhall level. Training is instant. See `08-army.md`.

## Currencies at a glance

| Currency | Scope | Capped | Starting amount | Earned by | Spent on |
|---|---|---|---|---|---|
| Food | City | no | 5 | Farms, FarmLands | Buying population; some recruit costs |
| Silver | City | no | 50 | Townhall population tax (vaulted) | Building, upgrades, fog reveal, recruits |
| Wood | City | no | 0 | Lumber camps | Build/upgrade costs, Archer recruit |
| Gold | Kingdom | no | 100 | nothing (granted at start) | nothing yet |
| Mana | Kingdom | **yes, 100** | 50 | Kingdom trickle: 300/hour = 5/min | Spells |
| Knowledge | Kingdom | no | 0 | nothing yet | nothing yet (future research) |
| Gems | Player | no | 10 | nothing yet (buy button is a no-op) | Finishing builds/upgrades instantly |

## Timekeeping

All economic math is wall-clock based (`UTC now` minus stored timestamps), driven by a
once-per-second tick. Because timestamps (not counters) are persisted, offline progress
falls out for free: production pays out the elapsed minutes on the first tick after
loading (clamped by vault capacity), and the build queue completes items in true
chronological order. There is **no separate offline-simulation step** (the use case for
it exists but is an empty TODO).

## Implementation status summary

Fully working: hex map + fog of war, district placement/conditions, production +
vaults + worked units, population/workers, build queue with builders + gem rush +
cancel/refund, Rain spell, army recruiting, save/load with offline catch-up, all
10 UI screens except Research.

Designed but stubbed or unreachable (details in `11-gaps-and-discrepancies.md`):
research/Knowledge, region claim + domination + combat, city↔region binding, the Tap
spell's targets (data gap), timed unit training, builder count growth, Gold/Gems
sources.

## Doc map

| File | Covers |
|---|---|
| `00-design-intent.md` | The original design overview (intent, player-facing language) |
| `02-map-and-fog.md` | Hex grid model, terrain/features, Region_01 layout, fog of war |
| `03-economy-and-production.md` | Currencies, generators, accrual, worked units, vaults |
| `04-districts.md` | District types, balancing data, placement rules, cost/time formulas |
| `05-city-population-workers.md` | City, population buying, worker pool |
| `06-construction-queue.md` | Build queue engine, builders, rush, cancel |
| `07-spells.md` | Spellbook, Rain, Tap, feature wear-out/regrowth |
| `08-army.md` | Units, recruiting, power cap |
| `09-ui-and-input.md` | Screens, widgets, tap-input handler chain |
| `10-persistence.md` | Save format, autosave, offline behavior |
| `11-gaps-and-discrepancies.md` | Stubs, data gaps, quirks, intent-vs-build divergences |
| `data/region-map.json` | The full Region_01 tile layout (terrain + features) |
