# 10 — Persistence & Offline

> **FROZEN — Unity as-built snapshot, 2026-08-17.** This file documents the
> *Unity* prototype (hex grid, Silver, generator vaults), not the web build. It is
> kept for provenance and for the formulas the port still uses. Where it disagrees
> with [`00-design-intent.md`](00-design-intent.md) or with `Docs/features/`, those
> win. Do not implement from this file without checking there first.

## Save format

One JSON file per game (`save_<gameId>.json` in the app's persistent data folder),
serialized with Newtonsoft (`TypeNameHandling.Auto`, ISO UTC dates):

```jsonc
{
  "LastSaved": "2026-08-17T…Z",
  "GameVersion": "…",
  "Modules": {
    "kingdom.cities":       { … },
    "kingdom.kingdoms":     { … },
    "kingdom.fogOfWar":     { … },
    "kingdom.army":         { … }
  }
}
```

Each module key is owned by one save participant. **Player currencies (Gems) are
saved separately** in a player file.

## Module contents

| Key | Contents |
|---|---|
| `kingdom.cities` | Per city: `Population`, currency amounts, `DistrictState[]`, plus the queue: `BuildQueueItemState[]` and `DistrictUpgradeQueueItemState[]` |
| `kingdom.kingdoms` | `MaxBuilders`, kingdom currency amounts, kingdom `GeneratorState[]` |
| `kingdom.fogOfWar` | `Revealed[]` (cell coords) + `Progress[] {Coord, Silver}` |
| `kingdom.army` | `UnitState[] {UniqueID, DefinitionID}` |

Key DTO shapes:

```
DistrictState  { UniqueID, DefinitionID, VisualVariant, AssignedWorkers,
                 Level (default 1), GridLocation, ConstructionState, GeneratorState[] }
GeneratorState { UniqueID, CurrencyID, LastProduction, VaultStored }
QueueItemState { UniqueID, DurationSeconds, StartedAtUtc?, (upgrades: TargetLevel, DistrictID) }
```

**Rates are never saved.** A generator persists only its `LastProduction` timestamp
and vault balance; rates are rebuilt from definitions + map + workers by the
production recalculation after load. This is what makes offline income "just work".

## Save triggers

- Autosave every **30 timer-seconds** (effectively ~15 real seconds — see the
  double-tick quirk in `11-gaps-and-discrepancies.md`).
- On app pause, focus loss, and quit.
- An editor menu tool exists for manual save management (dev only).

## Load / startup order

Register saveables → load catalogs (definitions by id; game-specific `Kingdom/Data/…`
resources override same-id shared ones) → create initial entities (kingdom, region,
city with Townhall) → **load the save if present, else apply initial state
and save** → load the region scene → build map data from the tilemaps → place saved
districts and views → initialize fog (seeding only if the save restored nothing) →
activate the city **last**, so the production tick can't run against restored
`LastProduction` values before rates are rebuilt → show Header/Main/NavBar.

## How offline progress works (no simulation step)

There is no explicit offline simulator (the use case exists as an empty TODO).
Everything catches up from persisted timestamps on the first ticks after load:

- **Generators:** `(now − LastProduction)` minutes are paid out at once. Vault
  districts clamp at vault capacity (**overflow is lost** — a full vault stops
  accruing and resets its timestamp; the 50-unit vaults are the offline earnings
  ceiling for Townhall/Farm/Lumber). FarmLands' 3 Food/min goes to the uncapped
  wallet, so it accrues without limit.
- **Build queue:** `StartedAtUtc` is persisted; the Advance algorithm completes items
  in chronological order, stamping promoted items with the moment their slot freed —
  a long absence finishes a chain of queued work correctly.
