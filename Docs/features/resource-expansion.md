# Resource expansion: Stone, Fish & Iron

Three resource lines, each a feature → worker building → technology →
upgrade chain, plus the map to house them (155 → 253 cells). All numbers
live in the balance workbook.

> **Amended 2026-09-02 by the currency simplification.** Two of these three
> lines no longer end in a currency of their own. A shoal pays **Food** (2 a
> tap) and a vein pays **Stone** (3 a tap, against a plain rock's 1). The
> chain is unchanged — same feature, same building, same tech, same upgrade,
> same place on the map — because what made these lines interesting was never
> the wallet row at the end of them. See
> [`currency-simplification.md`](currency-simplification.md).

## The three lines

| | Stone 🪨 | Fish 🐟 | Iron ⚙️ |
|---|---|---|---|
| Feature | Rocks (renewable, 120s recovery) | Fish shoal on WATER (finite like berries, respawns in 90s — faster than the 120s bushes — **on water**) | Iron vein (renewable, slow 300s) |
| Where | Mainland east edge + the Plains isle | Coastal ring + the SW bay | The frozen isle north (distance 8–10) |
| Building | Quarry (Masonry) | Docks (Fishing) — a 2×1 pier: one cell on land, one on Water (horizontal only, auto-mirrored); workers render as FISHING BOATS ⛵ | Mine (Mining) — costs Stone |
| Tech chain | Forestry → **Masonry** | Forestry → **Fishing** (the food fork: farm OR fish after the Sawmill) | Masonry → **Mining** |
| Upgrade | Stonecutting +1/delivery | Big Nets +1/delivery | Iron Picks +1/delivery |
| Pays | **Stone**, 1 a tap | **Food**, 2 a tap | **Stone**, 3 a tap — a rich node |
| Role | 2nd construction material (Townhall L2 +25 🪨, Mine) | The food fork: farm OR fish after the Sawmill | The far-fog payoff, and what the deep army is built from |

The cell-scoped upgrades key on the **cell**, not the currency: Big Nets is
about nets and Iron Picks is about picks, even though the first now moves Food
and the second Stone (`HarvestSpec.id` in `data/definitions.ts`).

- Worker-delivery upgrades stack with the global WorkerLoad
  (`effectiveWorkerYield` in `src/sim/upgrades.ts`).
- `FeatureDef.respawnTerrain` decides where a finite feature reappears —
  shoals wander across water exactly like berries wander on grass.
- **The metal-gated army**: the Cavalry costs 60 🪨 on top of its old costs
  (Units sheet, `recruit_cost_stone`) — the old 20 Iron at the 1:3 rate. Foot
  units cost none.

## The archipelago

The world is an island ringed by sea; the expansion adds two more islands
and a bay — crossing the water costs fog reveals, which paces each biome:

- **East — Plains isle** (x 7..10): 4 Rocks + trees + game. Plains can't
  hold Farms/FarmLands, so it stays quarry country. Two extra Rocks sit on
  the mainland's east edge for the first Quarry.
- **South-west — the bay**: wider ocean, 5 Fish shoals scattered along the
  coasts (the Docks' radius 2 sends boats 1–2 cells offshore), plus a tiny
  fishing spit at (−7, 3..4).
- **North — the frozen isle** (y −7..−10): a Tundra shore over Snow, 4 Iron
  veins and tundra game. At distance 8–10 the fog alone makes this the
  late-game push (rings are authored to 10; the ×1.25 fallback prices the
  rest).

Sprites pending (glyph fallbacks active): quarry, docks, mine, rocks,
fish_shoal, iron_vein, fishing_boat(+_carrying) — stems listed in
`src/render/assets/README.md`.

## Iron's sink problem, resolved 2026-09-02 — twice

As shipped, Iron was the most expensive resource to reach (fog distance 9–12)
and the highest-value Market good at 6 Gold, with only two sinks totalling 35
units across the whole game (Cavalry ×20, Architecture ×15). Selling it was
strictly better than using it.

The first fix gave it three real sinks: **Stables**, and expedition
**supplies** at Tier III and above, recurring. Iron became the metal that
decided how deep you could delve, which is what its position at the far end of
the fog curve always implied.

The second fix, later the same day, observed that **none of that needed a
wallet row**. A vein is now a rich Stone node — 3 a tap, 15 a cycle against a
rock's 5 — so the far-fog payoff survives as *yield* rather than as a sixth
coin on a 390 px header. Everything converted at 1 Iron = 3 Stone (their
`gold_value` ratio): Stables 30/90 Stone, Cavalry 60, deep supplies 30/60/120,
and a tier-3+ delve haul pays triple material. The sinks are the same sinks;
they are just denominated in the material the player already has a counter
for.
