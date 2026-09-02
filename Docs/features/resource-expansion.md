# Resource expansion: Stone, Fish & Iron

Three resource lines, each a feature → worker building → technology →
upgrade chain, plus the map to house them (155 → 253 cells). All numbers
live in the balance workbook.

## The three lines

| | Stone 🪨 | Fish 🐟 | Iron ⚙️ |
|---|---|---|---|
| Feature | Rocks (renewable, 120s recovery) | Fish shoal on WATER (finite like berries, respawns in 90s — faster than the 120s bushes — **on water**) | Iron vein (renewable, slow 300s) |
| Where | Mainland east edge + the Plains isle | Coastal ring + the SW bay | The frozen isle north (distance 8–10) |
| Building | Quarry (Masonry) | Docks (Fishing) — a 2×1 pier: one cell on land, one on Water (horizontal only, auto-mirrored); workers render as FISHING BOATS ⛵ | Mine (Mining) — costs Stone |
| Tech chain | Forestry → **Masonry** | Forestry → **Fishing** (the food fork: farm OR fish after the Sawmill) | Masonry → **Mining** |
| Upgrade | Stonecutting +1/delivery | Big Nets +1/delivery | Iron Picks +1/delivery |
| Role | 2nd construction material (Townhall L2 +25 🪨, Mine) | Food-valued: 1 Fish = **1 Food** (tooltip breakdown) | The army's metal |

- Worker-delivery upgrades stack with the global WorkerLoad
  (`effectiveWorkerYield` in `src/sim/upgrades.ts`).
- `FeatureDef.respawnTerrain` decides where a finite feature reappears —
  shoals wander across water exactly like berries wander on grass.
- **Iron-gated army**: Swordsman +10 ⚙️, Archer +5 ⚙️, Cavalry +20 ⚙️ on
  top of their old costs (Units sheet, `recruit_cost_iron`).

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

## Iron's sink problem, resolved 2026-09-02

As shipped, Iron is the most expensive resource to reach (fog distance 9–12) and
the highest-value Market good at 6 Gold, with only two sinks totalling 35 units
across the whole game (Cavalry ×20, Architecture ×15). Selling it was strictly
better than using it.

[`expeditions.md`](expeditions.md) and [`balancing-v2.md`](balancing-v2.md) give
it three real ones: **Stables** (120 W + 40 S + **10 Iron**), and expedition
**supplies** at Tier III and above (10 / 20 / 40 Iron per launch, recurring).
Iron becomes the metal that decides how deep you can delve, which is what its
position at the far end of the fog curve always implied.
