# 27 · Plantables — editing the ground

> **Scope.** The Build-menu entries that put a **feature** on the ground
> instead of raising a building — the crop plot — and moving a tree or a
> crop plot to another cell, so the player can arrange the city around them.
>
> **Status: built.**

## 1. A plantable

- An entry of `buildings.json` with `plants: <feature>`. It is listed, priced,
  capped and unlocked like a building: same card, same ghost, same technology
  gate.
- Confirming it puts that feature on the cell. **No district is created**, so
  it has no level, no card and no ordinal.
- It takes **no builder**: a busy crew never refuses it.
- How many stand is how many of its feature are on the ground. That count
  prices the next one (`instanceLinearGrowth`, `instanceExponentialGrowth`)
  and meets the cap (`maxCountPerTownhallLevel`).
- It reveals and discovers no fog (`fogDiscoverRadius` 0).
- A ruin of a plantable is repaired the same way: the price is paid and the
  feature is planted on the ruin's cell.

## 2. Growing

- A planted or moved feature lands **growing** for its source's
  `growSeconds`, flat — no technology or builder bonus moves it.
- A growing cell is an exhausted one: it cannot be tapped or worked. A tap on
  it shows a sprout.
- When the wait ends it is an ordinary cell of its source, **full**.
- It draws its **growth stages** in turn, `<sprite>_growing1`, `_growing2`…,
  each for an equal share of the wait; with none drawn, its exhausted art.
  A stage reads as something coming up — never as a felled cell.
- The tree has three: seedlings in dug earth, staked saplings, young trees.
- **A crop plot growing is worked like a construction**: the builder's hammer
  over it and the construction's bar with the time left — so repairing an
  old plot reads as the same five seconds as repairing the House.
- Growth is the cell's ordinary lazy recovery, so it is no boundary of its own.

## 3. The crop plot

- `FarmLands` plants `Crops`: a Food cell (`04-harvest.md` §2.1), tapped by
  hand or worked by a Farm in reach.
- Priced in Gold and Wood, dearer for each plot standing; capped by the
  Townhall. Grows for 10 s.
- Anything low enough to stand in (the crop plot) never hides a villager.

## 4. Moving a tree or a crop plot

- The gesture is a building's move (`05-city-and-districts.md` §4.3):
  **a long press picks it up**, the ghost follows the finger, red where it
  may not stand, and **Move** puts it down.
- While the press waits, a **ring fills beside the finger** — up and to the
  right, so the finger does not cover it — over anything a long press would
  pick up.
- Movable: a **tree** once **Transplanting** is researched; a **crop plot**
  always, as it was bought from the Build menu. Nothing else.
- A long press on a tree before Transplanting toasts what to research.
- It lands on any revealed land a building could stand on.
- It lands **growing** for its whole `growSeconds` (§2) — a tree a day —
  whatever it held, and however far through a growth or a recovery it was.
  That wait is the whole price; the window says it before **Move**.
- The cell it leaves is bare ground: anything may be built there.
- Put back where it started, it is a cancel: nothing restarts.
- A worker going to it or swinging at it finds it gone and walks home.
- The number of trees in the province never changes.

## 5. The tutorial

- When Transplanting is researched, Priya says a tree may be held and moved,
  and points at one (`transplant`, [`23-tutorials.md`](23-tutorials.md) §4.5).
- A crop plot is planted from the Build menu in the `furrows` lesson (§3.2).

## 6. Dials, in the order to reach for them

| Dial | Now | Where |
|---|---|---|
| How long one grows, planted or moved | tree 24 h · crop plot 5 s | `harvest` › `growSeconds` |
| A crop plot's price and how fast it climbs | 15 Gold + 10 Wood, ×(1 + 0.5n)·1.2ⁿ | `buildings` › `costPerLevel`, `instance*Growth` |
| How many crop plots may stand | 6 / 6 / 12 / 16 … | `buildings` › `maxCountPerTownhallLevel` |
| What opens moving a tree | Transplanting, 200 Gold, Kingdom chapter 2 | `?dev=data#tree` |

## 7. Deliberately not in this design

- a plantable with levels
- a builder or a speed-up on a growth
- removing a tree without putting it down elsewhere
- moving a mountain, a bush, an animal or a shoal
