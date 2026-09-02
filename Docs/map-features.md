Map Features
---

Each map cell can contain the following features.

## Resource features

- **Nothing.**
- **Forest.** Provides wood when tapped or worked. Exhausts after a number of
  taps and grows back after `recoverySeconds`.
- **Berries.** Provides food when tapped. Finite — it disappears when empty and
  respawns on a valid cell adjacent to its origin.
- **Wild animals.** Provides food (Meat, worth 3 Food) when tapped. Finite, like
  berries.
- **Rocks.** Provides stone when tapped or worked. Renewable.
- **Fish shoal.** Sits on Water. Provides Fish (worth 1 Food). Finite; respawns
  on water.
- **Iron vein.** Provides iron. Renewable, slowly (300 s).

Full numbers: [`features/harvest-loop.md`](features/harvest-loop.md) §7 and
[`features/resource-expansion.md`](features/resource-expansion.md).

## Non-resource features *(designed 2026-09-02, not yet implemented)*

- **Landmark.** A shrine, standing stone or leyspring. Yields nothing when
  tapped; **claiming** it raises Mana production by +1/h permanently. Undefended
  landmarks cost Gold to claim; defended ones need a party to clear first. 8–12
  across the map. See [`features/magic.md`](features/magic.md).
- **Ruin.** A dungeon entrance. Revealing one discovers it; sending a hero and a
  party in delves it, in stages, for artifacts, Fragments and Knowledge. A
  discovered ruin also drips 2 Knowledge/h. Five across the map, at distances
  ~3, 6, 8, 10 and 12. See [`features/expeditions.md`](features/expeditions.md).

Both are authored on the workbook's `Map` sheet like every other feature — see
[`balance/README.md`](../balance/README.md).
