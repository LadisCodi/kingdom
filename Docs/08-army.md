# 08 — Army & Recruiting

> **FROZEN — Unity as-built snapshot, 2026-08-17.** This file documents the
> *Unity* prototype (hex grid, Silver, generator vaults), not the web build. It is
> kept for provenance and for the formulas the port still uses. Where it disagrees
> with [`00-design-intent.md`](00-design-intent.md) or with `Docs/features/`, those
> win. Do not implement from this file without checking there first.

The newest mechanic. There is **one shared player army** (a flat registry of unit
instances); every city recruits into it. Combat does not exist yet — the army is
recruit-and-hold, intended for the future region-claim objectives.

> **Superseded in design by [`features/expeditions.md`](features/expeditions.md)
> (2026-09-02).** The army stops being recruit-and-hold: units gain **ATK / DEF /
> HP** and a matchup chart, a **hero is mandatory** to command any party, and
> parties delve into ruins in stages. `train_duration_seconds` — authored and
> unused below — becomes live. Unit *power* becomes equal to ATK, so it reads
> directly as attack potential against the army cap.

## Units

| Unit | Power | Tags | Recruit cost | TrainDurationSeconds* |
|---|---|---|---|---|
| Archer | 2 | Distance | 40 Silver + 20 Wood | 25 |
| Swordsman | 3 | Melee | 50 Silver + 20 Food | 30 |
| Cavalry | 5 | Mounted, Melee | 100 Silver + 40 Food | 60 |

\* Authored in data but **unused** — training is instant; there is no training queue.

A unit definition carries: name, description, icon, power, tag list
(`Melee | Distance | Mounted`), recruit cost (city currencies), train duration,
train sound. Runtime units are a single data-driven class — an instance is just
`{UniqueID: "{cityId}_{definitionId}_{guid}", DefinitionID}`.

## Army capacity

> **RETIRED by [`features/balancing-v2.md`](features/balancing-v2.md).** The
> Townhall no longer gates army size. `army.power_cap_per_townhall_level` is
> removed and the cap comes from four **military buildings** — Barracks, Spear
> Hall, Shooting Grounds, Stables — contributing 6 / 10 / 15 each by level, so a
> fully developed military reaches 60. Army size became a city-building decision
> because it now gates how deep a party can delve
> (see [`features/expeditions.md`](features/expeditions.md)).

The Unity formula, for reference:

```
CurrentPower = Σ power of owned units
MaxPower     = city definition's MaxArmyPowerForTownhallLevel(townhallLevel)
             = [10, 20, 30][clamp(thLevel − 1)]     → TH1: 10, TH2: 20
CanRecruit(def) = CurrentPower + def.Power ≤ MaxPower
```

## Recruiting flow

`TrainUnitUseCase`, results `Trained | NotEnoughResources | ArmyAtCapacity`:

1. Capacity check (power cap above).
2. Affordability check against the **city** wallet.
3. Pay the recruit cost, create the unit, register it in the army, play the train
   sound.

No unlock gating exists yet — every unit shows as unlocked in the Army menu.

## UI

The Army menu shows a unit-button list (icon, owned count, Locked/Unlocked/Selected
states), a selected-unit info panel (name, power, description, tags, formatted cost,
Train button), and a header label `Power current / max`.

## Persistence

`kingdom.army`: the list of `{UniqueID, DefinitionID}` per owned unit.
