# 08 — Army & Recruiting

The newest mechanic. There is **one shared player army** (a flat registry of unit
instances); every city recruits into it. Combat does not exist yet — the army is
recruit-and-hold, intended for the future region-claim objectives.

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

```
CurrentPower = Σ power of owned units
MaxPower     = city definition's MaxArmyPowerForTownhallLevel(townhallLevel)
             = [10, 20, 30][clamp(thLevel − 1)]     → TH1: 10, TH2: 20
CanRecruit(def) = CurrentPower + def.Power ≤ MaxPower
```

At TH1 the player can field e.g. 5 Archers (10), 3 Swordsmen (9), or 2 Cavalry (10).

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
