# Economy: housing taxes & the Market

The city's Gold comes from **taxes** — a passive, always-on income that gives
the game its idle backbone. The Market is a late-game, optional outlet for
surplus resources, not a chore you must visit to earn money.

## Housing taxes (the idle gold source)

- **Residents are auto-assigned**: houses fill in build order as population
  grows; the player never manages who lives where (it has no mechanical
  effect beyond which house you tap). Shown on the Housing card as
  `residents N/cap`.
- **Passive drip**: every HOUSED villager pays
  `taxes.gold_per_population_per_minute` Gold (Settings sheet; ×(1 + 10% per
  TradeRoutes level)). Gold accrues in whole units against a `lastTaxAt`
  anchor — deterministic, replayed exactly offline (within the 8h cap;
  beyond the cap the tax clock pauses like workers do).
- Roofless villagers (population over capacity) pay nothing, and empty
  minutes are never banked: no housing, no income.
- **Tap boost**: tapping (or holding) a lived-in house FAST-FORWARDS the
  tax clock by `taxes.tap_boost_seconds` — the same verb as tapping the
  Townhall to speed training. Buildings never exhaust: extraction +
  exhaustion is reserved for natural cells (trees, berries, animals,
  crops). Paced by the shared collect cooldown, so QuickHands helps.
- **Adjacency** (`Adjacency` sheet, `src/sim/adjacency.ts`): a house gains
  or LOSES gold/min per adjacent district of a given type — footprints
  sharing an edge; diagonal corner contact does NOT count. Rules are
  directional `(district,
  neighbor)` rows with a single `gold_per_minute` (negatives allowed);
  since the tap only advances the same production clock, one number
  covers both mechanics. Initial content: Housing next to Housing =
  **−1/min per neighbor** — crowded rows tax worse, spreading out pays.
  A house clamps at 0, never negative. While PLACING a building, every
  affected neighbor and the ghost itself get a compact label ("−1 🪙",
  green positive / red negative).

## Villager training (Townhall queue)

- The Townhall trains villagers in a QUEUE: each press of Train pays its
  Food cost up front (priced as if everything queued already delivered) and
  appends one villager; they complete sequentially, `training.seconds` each.
- Queueing is limited only by Food and housing capacity (queued villagers
  count against the cap).
- Tapping the Townhall still boosts the CURRENT villager by
  `training.tap_boost_seconds`; the next one starts at the (possibly
  boosted) completion moment.

## The Market (optional, late-game)

- A **buildable district** gated behind the Market technology; no navbar
  entry — **tap the built Market** to open its trade screen.
- Selling is **instant**: amount selector `[x1][x10][x100][x1.000][All]`,
  one Sell per sellable currency, Gold on the spot
  (`floor(units × gold_value × (1 + 5% per MarketStall level))`).
- The old drip-sell queue, sale timers and gem rush are gone — taxes cover
  idle income now, so the Market no longer needs to run while away.

## Where the numbers live

Settings: `taxes.gold_per_population_per_minute`, `training.seconds`,
`training.tap_boost_seconds`. Harvest sheet: the `Taxes` row. Currencies
sheet: `gold_value` per sellable resource. Districts sheet: the `Market`
row. Upgrades: MarketStall (+5% prices), TradeRoutes (+10% taxes), both
under the Market tech.
