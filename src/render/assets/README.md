# Sprite assets

Drop PNGs here (transparent background, ~128×128, nearest-neighbor
downscaled). They're picked up automatically by filename — no code changes.
Any sprite that's missing simply keeps its emoji placeholder.

**v2 art set (2026-09):** all sprites follow the zoomed-out "manage from
afar" style locked by `Docs/art/reference.png`. Districts have per-level
art: the renderer tries **`<sprite>_l<level>.png`** first, then the
un-leveled `<sprite>.png`, then the emoji glyph. The placement preview
uses `<sprite>_l1`. Source sheets + processing scripts live in
`Docs/art/originals/v2-sheets/`; see `Docs/art/sprite-prompts.md` for the
prompts and the normalization pipeline.

| File | Replaces | Notes |
|---|---|---|
| `townhall_l1..l3.png` | 🏛️ | campfire camp → hall → hilltop town |
| `housing_l1..l3.png` | 🏠 | hut → two cottages → hamlet cluster |
| `farm_l1..l3.png` | 🌾 | tilled patch → barn → farmstead |
| `farmlands.png` (+ `_exhausted`) | 🟩 / 🥀 | flat full-bleed field tile, no levels |
| `sawmill_l1..l3.png` | 🪚 | logging camp → saw hut → mill |
| `market_l1..l3.png` | 🏪 | stall → two stalls → market square |
| `quarry_l1..l3.png` | ⛏️ | stone pit → quarry → terraced quarry |
| `mine_l1..l3.png` | ⚒️ | tunnel → mine + cart → mine complex |
| `docks_l1..l3.png` | ⚓ | **256×128** (2×1 pier, land end LEFT; mirrored in code when the coast faces the other way) |
| `forest.png` / `_exhausted` | 🌲 / 🪵 | |
| `berry_bush.png` | 🫐 | finite — no exhausted variant |
| `wild_animals.png` | 🐗 | finite — no exhausted variant |
| `rocks.png` (+ `_exhausted`) | 🪨 / 🧱 | |
| `iron_vein.png` (+ `_exhausted`) | ⛰️ / 🕳️ | |
| `fish_shoal.png` | 🐟 | drawn over water; fish + ripples only |
| `worker.png` / `_carrying` | 🧑‍🌾 / 🎒 | drawn at 0.6 tile; statics = each cycle's frame 2 |
| `worker_walk_1..4.png` / `worker_carry_1..4.png` | — | 4-frame walk cycles (140 ms/frame) |
| `worker_chop_1/2` · `worker_mine_1/2` · `worker_farm_1/2` | — | 2-frame work loops by harvest source (320 ms); pending generation |
| `fishing_boat_row_1/2.png` | — | 2-frame rowing loop; pending generation |
| `fishing_boat.png` / `_carrying` | ⛵ / ⛵🐟 | workers of the Docks |
| `terrain_<id>.png` (grassland, plains, desert, snow, tundra, water, mountain) | flat `TERRAIN_COLORS` | full-bleed, self-tiling |

District sprites are keyed by the `sprite` field in
`src/sim/data/definitions.ts`; `_exhausted` variants are derived from it.
v1 (zoomed-in single-building) sprites are archived in
`Docs/art/originals/v1-downscaled/`.
