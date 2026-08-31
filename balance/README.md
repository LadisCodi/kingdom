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
| `Districts` | One row per building: footprint, levels, workers, costs, times, growth exponents |
| `Units` | Army units: power, recruit costs |
| `Harvest` | Resource cells: yield per tap, taps to exhaust, recovery |
| `Currencies` | Starting amounts and caps (blank cap = uncapped) |
| `FogRings` | Fog reveal cost by distance ring |
| `Settings` | Everything singleton: worker speed, tax cycle, offline cap, population costs… |

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

`npm run balance:export` regenerates the workbook from `balance.json` if it
ever gets mangled.
