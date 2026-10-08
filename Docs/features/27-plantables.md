# 27 · Plantables — editing the ground

> **Scope.** The Build-menu entries that put a **feature** on the ground
> instead of raising a building — the crop plot and the tree — and the
> gesture that takes one up again, so the player can arrange the city
> around them.
>
> **Status:** §1–§3 built (the crop plot). §4–§6 — uprooting, the seed, the
> tree, its technology and tutorial — not built.

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

- A plantable lands **growing** for its `buildDurationSeconds`, flat — no
  technology or builder bonus moves it.
- A growing cell is an exhausted one: it cannot be tapped or worked. A tap on
  it shows a sprout.
- When the wait ends it is an ordinary cell of its source, **full**.
- It draws `<sprite>_growing`, else its exhausted art.
- Growth is the cell's ordinary lazy recovery, so it is no boundary of its own.

## 3. The crop plot

- `FarmLands` plants `Crops`: a Food cell (`04-harvest.md` §2.1), tapped by
  hand or worked by a Farm in reach.
- Priced in Gold and Wood, dearer for each plot standing; capped by the
  Townhall. Grows for 10 s.
- Anything low enough to stand in (the crop plot) never hides a villager.

## 4. Uprooting — not built

- Pressing and holding **any tree**, spent or not, fills a circular bar. Once
  full, dragging up pulls it out.
- It costs no Mana. What Wood was left in it is lost.
- An uprooted tree drops **one seed** into the Bag.
- A crop plot can be uprooted the same way. It drops nothing; a new one is
  bought from the Build menu.
- The cell is bare afterwards: anything may be built on it.

## 5. The tree — not built

- A Build-menu entry that plants `Trees` for **one seed** and nothing else.
- It grows for **24 hours** as a sapling, then is an ordinary forest.
- No cap: the seed already keeps the number of trees in the province fixed.
  Seeds come from uprooting only — never from a chest, a reward or the store.

## 6. Unlock and tutorial — not built

- Uprooting and the tree are opened by one technology.
- When it is researched, a tutorial scene walks the player through uprooting
  one tree and planting it elsewhere.

## 7. Dials, in the order to reach for them

| Dial | Now | Where |
|---|---|---|
| A plantable's growth | crop plot 10 s · tree 24 h | `buildings` › `buildDurationSeconds` |
| Its price and how fast it climbs | crop plot 15 Gold + 10 Wood, ×(1 + 0.5n)·1.2ⁿ | `buildings` › `costPerLevel`, `instance*Growth` |
| How many may stand | crop plot 6 / 6 / 12 / 16 … | `buildings` › `maxCountPerTownhallLevel` |

## 8. Deliberately not in this design

- a plantable with levels
- a builder or a speed-up on a growth
- seeds from anywhere but an uprooted tree
- uprooting a mountain, a bush, an animal or a shoal
