# Resource expansion: Stone, Fish & Iron

Three resource lines, each a feature → worker building → technology →
upgrade chain, plus the map to house them (155 → 253 cells). All numbers
live in the balance workbook.

## The three lines

| | Stone 🪨 | Fish 🐟 | Iron ⚙️ |
|---|---|---|---|
| Feature | Rocks (renewable, 120s recovery) | Fish shoal on WATER (finite, respawns 150s **on water**) | Iron vein (renewable, slow 300s) |
| Where | Mainland east edge + the Plains isle | Coastal ring + the SW bay | The frozen isle north (distance 8–10) |
| Building | Quarry (Masonry) | Fishing Hut (Fishing) — must touch Water | Mine (Mining) — costs Stone |
| Tech chain | Forestry → **Masonry** | Agriculture → **Fishing** | Masonry → **Mining** |
| Upgrade | Stonecutting +1/delivery | Big Nets +1/delivery | Iron Picks +1/delivery |
| Role | 2nd construction material (Townhall L2 +25 🪨, Mine) | Food-valued: 1 Fish = **2 Food** (tooltip breakdown) | The army's metal |

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
  coasts (a Fishing Hut's radius 2 reaches 1–2 cells offshore), plus a tiny
  fishing spit at (−7, 3..4).
- **North — the frozen isle** (y −7..−10): a Tundra shore over Snow, 4 Iron
  veins and tundra game. At distance 8–10 the fog alone makes this the
  late-game push (rings are authored to 10; the ×1.25 fallback prices the
  rest).

Sprites pending (glyph fallbacks active): quarry, fishing_hut, mine, rocks,
fish_shoal, iron_vein — stems listed in `src/render/assets/README.md`.
