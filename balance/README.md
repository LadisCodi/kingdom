# Game balance workbook

`balance.xlsx` is the **editable source of truth** for every balancing number
in the game. Open it in Excel, LibreOffice Calc, or Google Sheets, tweak,
save, then apply:

```bash
npm run balance    # validates the workbook and regenerates src/sim/data/balance.json
npm test           # the formula tests catch anything that breaks the worked examples
```

The dev server picks the change up on the next reload. The generated
`balance.json` is committed too, so a fresh clone builds without running
the script.

| Sheet | What |
|---|---|
| `Districts` | One row per building: footprint, levels, workers, costs (Gold/Wood/Food/Stone/Iron columns), times, growth exponents |
| `Units` | Army units: power, recruit costs |
| `Harvest` | NATURAL resource cells (trees, crops, berries, animals): yield per tap, taps to exhaust, recovery |
| `Currencies` | Starting amounts, caps, `primary` (header widget), `counts_as`/`unit_value` (food-valued), `gold_value` (Market instant-sell price; blank = not sellable) |
| `Technologies` | One-time researches: costs, duration, `requires` (comma-separated tech ids) |
| `Upgrades` | Instant gold boosts: `cost_base`/`cost_growth`, `max_level`, `effect_per_level`, `required_tech` |
| `Adjacency` | Gold/min a district gains **or loses** per adjacent neighbor of a given type (negative = crowding penalty); columns `district`, `neighbor`, `gold_per_minute` — negatives allowed, one row per pair |
| `Quests` | The onboarding chain, one row per quest IN ORDER: `goal_type` (absolute: BuildDistrict/UpgradeDistrict/HoldResource/ReachPopulation/CompleteTech/CompleteTechs/AssignWorkers/TrainArmy · relative: CollectResource/CollectTaps/DiscoverCells/SellGoods), `goal_target` (district/tech/currency id where the type needs one), `goal_amount`, `goal_level` (UpgradeDistrict only), `reward_*` |
| `FogRings` | Fog reveal cost by distance ring |
| `Settings` | Everything singleton: worker speed, collect cooldown, training time, tax rate + tap boost (`taxes.*`), offline cap, population costs… |
| `Map` | The world itself — one spreadsheet cell per map cell (see below) |

Format notes:

- **Per-level lists go in one cell, comma-separated** (`3,5,7`), clamping to
  the last entry (a level-3 building with `1,2` uses `2`). List cells are
  Text-formatted so Excel doesn't turn `3,5` into the number 3.5 — if that
  ever happens (the importer will tell you), format the cell as Text and
  re-enter it.
- **Blank cost cells mean 0** (that currency isn't part of the cost).
- Per-cell formulas are fine — the computed value is what gets imported.
  **Array/spill formulas (`SEQUENCE`, …) are not**: only their first cell has
  a readable value, so the importer rejects them.
- Don't add or rename columns/sheets/ids — the importer rejects anything it
  doesn't recognize, on purpose. New buildings/units need code
  (`definitions.ts`) anyway.
- The cost/time **formulas** consuming these values are documented in
  `Docs/03` and `Docs/04`.

## The Map sheet

The grid IS the map (`npm run balance` writes it to
`src/sim/data/region-map.json`). Row 1 holds x coordinates, column A holds
y coordinates (y grows downward); each cell is one map cell:

- **Terrain** (lowercase): `g` Grassland · `w` Water · `p` Plains ·
  `d` Desert · `s` Snow · `u` Tundra. **Blank = void** (outside the world).
- **Features** (uppercase): `T` Trees · `B` Berry bush · `A` Wild animals ·
  `R` Rocks · `F` Fish shoal (water: write `wF`) · `I` Iron vein.
  A bare feature letter implies Grassland; `pT` puts Trees on Plains.
- Cells are color-coded by conditional formatting, so the map stays visible
  as you type.
- The Townhall anchors at (0,0) and occupies (0,0)–(1,1) — those four cells
  must be feature-free `g` (the importer refuses otherwise).
- To grow the world, add new coordinate labels in row 1 / column A and fill
  cells. Mind that gameplay near the origin (fog seed, reveal costs, the
  starting economy) derives from this map, and a few tests pin cells close
  to the Townhall.
- Map edits don't reach existing saves cleanly — bump `SAVE_VERSION` after
  a map change that matters.

`npm run balance:export` regenerates the workbook from `balance.json` +
`region-map.json` if it ever gets mangled.
