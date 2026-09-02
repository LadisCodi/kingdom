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
| `Harvest` | NATURAL resource cells (trees, crops, berries, animals): yield per tap, taps to exhaust, recovery, and `required_tech` — the research a player needs before they may tap it at all (blank = none; only `Forest` has one) |
| `Currencies` | Starting amounts, caps, `primary` (header widget), `counts_as`/`unit_value` (food-valued), `gold_value` (Market instant-sell price; blank = not sellable) |
| `Technologies` | One-time researches: `cost_knowledge` (research is paid in Knowledge and nothing else), duration, `requires` (comma-separated tech ids) |
| `Upgrades` | Instant gold boosts: `cost_base`/`cost_growth`, `max_level`, `effect_per_level`, `required_tech` |
| `Adjacency` | Gold/min a district gains **or loses** per adjacent neighbor of a given type (negative = crowding penalty); columns `district`, `neighbor`, `gold_per_minute` — negatives allowed, one row per pair |
| `Quests` | The onboarding chain, one row per quest IN ORDER — **row order IS chain order**, so reordering the rows reorders the game. `goal_type` (absolute: BuildDistrict/UpgradeDistrict/HoldResource/ReachPopulation/CompleteTech/CompleteTechs/AssignWorkers/TrainArmy/ClaimLandmarks/ReachDepth/ClearRuins/OwnArtifacts/OwnHeroes/BuyUpgrade · relative: CollectResource/CollectTaps/DiscoverCells/SellGoods), `goal_target` (district/tech/currency/upgrade id where the type needs one), `goal_amount`, `goal_level` (UpgradeDistrict only), `reward_*` including `reward_gems` and `reward_knowledge` |
| `Landmarks` | The shrines: position, whether they are defended, `claim_cost` in Gold |
| `Artifacts` · `Heroes` · `Ruins` | Relics, the hero roster and the dungeons — see `Docs/features/magic.md`, `heroes-and-gacha.md`, `expeditions.md` |
| `FogRings` | Fog reveal cost by distance ring |
| `Settings` | Everything singleton: worker speed, collect cooldown, training time, tax rate + tap boost (`taxes.*`), offline cap, population costs… |
| `Map` | The world itself — one spreadsheet cell per map cell (see below) |

## Tuning the opening

The first ten minutes are the most interlocked part of the workbook, because
several sheets have to add up together. The dials, roughly in the order you
would reach for them (see `Docs/onboarding.md`):

| Want | Change |
|---|---|
| The opening feels too tight / too generous with Gold | `Settings` → `city.initial_gold` (25). It buys the first five fog cells. |
| Fog costs too many taps | `Settings` → `fog.gold_per_tap`, or the `Surveying` row in `Upgrades` (each level makes one tap count for one more) |
| Fog costs too much Gold | `FogRings` — cost by distance ring |
| Exploring pays too little / too much research | `Settings` → `knowledge.per_reveal_ring` (1 = a ring-3 cell pays 3) |
| Research is too slow / too dear | `Technologies` → `duration_seconds`, `cost_knowledge`. Forestry is deliberately 3 s — it is the tutorial's first research. |
| Too much / too little tapping before the Sawmill | `Quests` → the `Timber` and `Lumber` rows' `goal_amount`; `Harvest` → `Forest.taps_to_exhaust` and `recovery_seconds` |
| Taps run out of energy too fast | `Settings` → `tap.mana_cost`, `mana.base_cap_per_townhall_level` |
| A beat arrives too early or too late | Reorder the `Quests` rows |

Two things to know before you retune the very opening:

1. **Quest 1 has to pay for quest 2.** Quest 2 demands Forestry, quest 1 is the
   only thing before it, and quest 1 pays no Knowledge of its own — every point
   comes from the fog it makes the player clear. So
   `FirstSteps.goal_amount × (cheapest ring yield) ≥ Forestry.cost_knowledge`,
   and `city.initial_gold` has to cover those cells at `FogRings` prices. A
   test asserts exactly this, at the worst frontier a player can pick.
2. **The early Wood has to add up across three beats.** `Timber.goal_amount`
   funds the House (step 4) *and* the crop plot (step 10);
   `Lumber.goal_amount` funds the Farm.

`tests/onboarding.test.ts` plays steps 1-14 through the real sim spending only
what the game grants and earns, so if a change strands the player it fails
there rather than in your session.

**Event and gacha-banner schedules do NOT belong in the workbook.** The xlsx is
for numbers designers tune; schedules are live-ops content with wall-clock dates
that change after ship. They live in a hand-written `src/sim/data/events.json`.
See `Docs/features/engine-seams.md` §5.

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
  *Planned (2026-09-02):* `U` Ruin · `L` Landmark — see
  `Docs/features/expeditions.md` and `Docs/features/magic.md`.
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
