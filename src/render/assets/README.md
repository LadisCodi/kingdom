# Sprite assets

Drop PNGs here (transparent background, ~128×128, nearest-neighbor
downscaled). They're picked up automatically by filename — no code changes.
Any sprite that's missing simply keeps its emoji placeholder.

Expected filenames (see `Docs/art/sprite-prompts.md` for the prompts):

| File | Replaces |
|---|---|
| `townhall.png` | 🏛️ |
| `housing.png` | 🏠 |
| `farm.png` | 🌾 |
| `farmlands.png` | 🟩 |
| `farmlands_exhausted.png` | 🟩 + 🥀 |
| `sawmill.png` | 🪚 |
| `forest.png` | 🌲 |
| `forest_exhausted.png` | 🪵 |
| `berry_bush.png` | 🫐 |
| `wild_animals.png` | 🐗 |
| `market.png` | 🏪 |
| `quarry.png` | ⛏️ |
| `docks.png` (2×1 pier: land half LEFT, water half right — mirrored in code when the coast faces the other way) | ⚓ |
| `mine.png` | ⚒️ |
| `rocks.png` (+ `rocks_exhausted.png`) | 🪨 / 🧱 |
| `fish_shoal.png` | 🐟 |
| `iron_vein.png` (+ `iron_vein_exhausted.png`) | ⛰️ / 🕳️ |
| `worker.png` | 🧑‍🌾 |
| `worker_carrying.png` | 🧑‍🌾 + 🎒 |
| `fishing_boat.png` (workers of the Docks, out on water) | ⛵ |
| `fishing_boat_carrying.png` | ⛵ + 🐟 |
| `terrain_<id>.png` (grassland, plains, desert, snow, tundra, water) | flat `TERRAIN_COLORS` |

District sprites are keyed by the `sprite` field in
`src/sim/data/definitions.ts`; `_exhausted` variants are derived from it.
