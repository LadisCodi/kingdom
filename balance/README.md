# Game balance sheets

These CSVs are the **editable source of truth** for every balancing number
in the game. Open them in Excel, LibreOffice Calc, or Google Sheets, tweak,
save as CSV, then apply:

```bash
npm run balance    # validates the CSVs and regenerates src/sim/data/balance.json
npm test           # the formula tests catch anything that breaks the worked examples
```

The dev server picks the change up on the next reload. The generated
`balance.json` is committed too, so a fresh clone builds without running
the script.

| File | What |
|---|---|
| `districts.csv` | One row per building: footprint, levels, workers, costs, times, growth exponents |
| `units.csv` | Army units: power, recruit costs |
| `spells.csv` | One row per spell level: mana cost, duration, magnitude |
| `harvest.csv` | Resource cells: yield per tap, taps to exhaust, recovery |
| `currencies.csv` | Starting amounts and caps (blank cap = uncapped) |
| `fog_rings.csv` | Fog reveal cost by distance ring |
| `settings.csv` | Everything singleton: worker speed, tax cycle, offline cap, population costs… |

Format notes:

- **Lists are pipe-separated** (`3|5|7`) — per-level values, clamping to the
  last entry (a level-3 building with `1|2` uses `2`).
- **Blank cost cells mean 0** (that currency isn't part of the cost).
- Both `,` and `;` delimiters work (`;` is what Spanish-locale Excel writes);
  with `;`, decimal commas (`1,25`) are accepted.
- Don't add or rename columns/ids — the importer rejects anything it doesn't
  recognize, on purpose. New buildings/units need code (definitions.ts) anyway.
- The cost/time **formulas** consuming these values are documented in
  `Docs/03` and `Docs/04`.

`npm run balance:export` regenerates the CSVs from `balance.json` if they
ever get mangled.
