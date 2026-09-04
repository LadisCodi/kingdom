# 3 · The economy — currencies, taxes and the Market

> **Scope.** Every currency and its job, where the city's Gold comes from, and
> the Market. Mana is [`08-magic.md`](08-magic.md); Stardust and ingredients
> are [`09-relics.md`](09-relics.md); Knowledge as a research clock is
> [`07-research.md`](07-research.md).
>
> **Status: built**, except the Knowledge ↔ Stardust split (§1.1), which is
> designed, not built.

## 1. One job each

- The city runs on Gold, Food, Wood and Stone.
- Mana is what magic costs.
- Stardust comes out of dungeons and levels the collection.
- Knowledge is a clock that paces research.

| Currency | Source | Buys | Scope | On the plank? |
|---|---|---|---|---|
| **Gold** | housing taxes, **gold mountains**, quests, the Market | fog, buildings, upgrades, expedition supplies, landmark claims | city | yes |
| **Food** | berries, game, shoals, crops | villagers, expedition supplies | city | yes |
| **Wood** | forest | buildings | city | yes |
| **Stone** | mountains, iron mountains | buildings, deep supplies | city | yes |
| **Mana** | time, capped | every player tap · **casting a spell** | city | a gauge, not a coin |
| **Knowledge** | time, capped | committing technologies · investing in guild structures | city | no — read where it is spent |
| **Stardust** | dungeons | relic and hero levels | kingdom | no — reads in the Reliquary |
| **Ingredients** | 1★ province · 2★ events · 3★ world | each relic's tier gate | kingdom | no — a grid, not a row |
| **Gems** | quests, first clears, the daily week marker, the simulated store | comfort and breadth | player | yes |

- Eight wallet rows; five on the plank; three of them for the whole first hour.
- Adding a wallet row needs an argument. The usual alternatives: a
  per-collectible counter (the Fragments precedent) or event points as a
  counter ([`13-events.md`](13-events.md) §2.1).

### 1.1 Knowledge and Stardust (designed, not built)

| Name | Job | Source | Scope |
|---|---|---|---|
| **Knowledge** | the research clock | time, capped | **city** |
| **Stardust** | levels of relics and heroes | dungeons | **kingdom** |

- Knowledge is city-scoped, like Mana; it does not survive a region reset.
- Stardust is kingdom-scoped; it survives a region reset.
- In docs and code the key is `Stardust`; *Polvo estelar* is the localised
  string.

## 2. Feature identity and currency

- A cell's feature is not its currency: `HarvestSpec.id` vs
  `HarvestSpec.currencyId`.
- Berry bushes, wild game and fish shoals all pay **Food**: 1, 3 and 2 a tap.
- A bare mountain pays **Stone** at 1; an iron mountain pays Stone at 5; a gold
  mountain pays **Gold**.
- The feature keeps its own art, tech gates, taps-to-exhaust, respawn timers and
  whether it is finite.
- Cell-scoped upgrades hang on the feature id: **Butchery** on game, **Big
  Nets** on shoals. Both move Food.
- Four city materials is the ceiling, not the floor.

## 3. Housing taxes

- Every housed villager pays `taxes.goldPerPopulationPerMinute` = 30 Gold/min,
  continuously.
- Accrued in whole units against an anchor; replayed exactly offline within
  the 8 h cap.
- Residents are auto-assigned: houses fill in build order as population grows.
  The only effect is which house the player taps.
- Roofless villagers pay nothing; empty minutes are never banked.
- A lived-in house is a tappable Gold cell (§5).
- **TradeRoutes** raises the rate +10%/level. The **Gilded Ledger** relic adds
  +20% while attuned, through the modifier layer.
- Housing capacity per level: `populationCapacityPerLevel = [2, 4, 6]` (OQ-46).
- Reference: a Townhall-1 city with two level-1 Houses = 4 villagers ≈ 120
  Gold/min idle.

### 3.1 Adjacency

- A directed `(district, neighbour)` rule paying Gold/min, positive or
  negative, computed from locations on read.
- Footprints must share an **edge**; diagonal corner contact does not count.
- One rule: Housing next to Housing, −1 Gold/min per neighbour.
- A house clamps at 0, never negative.
- While placing, every affected neighbour and the ghost itself show a compact
  label.
- The canvas grows by buying tiles ([`02-map-scopes.md`](02-map-scopes.md) §1.1).
- More rules and non-Gold effects: OQ-48.

## 4. Villager training

- The Townhall trains villagers in a queue.
- Each press of Train pays its Food cost up front, priced as if everything
  already queued had delivered, and appends one villager.
- Villagers complete sequentially at `training.seconds` = 20 s each.
- The queue is limited only by Food and housing capacity; queued villagers
  count against the cap.
- Cost: authored for the first six (`5, 20, 100, 300, 500, 1000`), then `×1.45`
  per villager beyond.
- No tap hurries the queue.
- Timers take Gems ([`04-harvest.md`](04-harvest.md) §3.2).

## 5. A tap is priced in production, not in units

- A tap hands the player `tap.workSeconds` = 10 seconds of work on the thing
  tapped, floored at one unit.
- A house tap pulls that share of the house's own rent forward.
- The rate a tap reads is the cell's own measured rate — its chunk over its
  rhythm ([`04-harvest.md`](04-harvest.md) §4) — never the city-wide total for
  that resource. Full design: [`04-harvest.md`](04-harvest.md) §3.
- `TapPower` buys the tap's duration: +20% a level over ten levels.
- Every player tap costs 1 Mana, except paying fog, which costs Gold. A tap
  refused by a tech gate costs no Mana.
- Every new reward follows the same rule: priced as a duration of the player's
  own production, not as an absolute amount. Quest rewards are currently
  absolute Gold amounts.

A full pool buys about the same slice of progress at every stage:

| City | tap | full pool | = production |
|---|---|---|---|
| 1 Sawmill L1, 3 workers, `TapPower` 0, pool 100 | 1 Wood | 100 Wood | **5.6 min** |
| 30 workers, `TapPower` 10, pool 332 | 3 Wood | ~1,000 Wood | **5.5 min** |

## 6. The Market

- A buildable district gated behind the **Market** technology. No navbar
  entry: tap the built Market to open it.
- Arrives at onboarding steps 13–15.
- Selling is instant: an amount selector (×1 / ×10 / ×100 / ×1000 / All), one
  Sell per sellable currency, Gold on the spot.
- Price: `floor(units × goldValue × (1 + 5% per MarketStall level))`.
- Three crates: **Food 1, Stone 2, Wood 3** Gold a unit.
- The Market is not a sink: it converts a surplus into Gold. Gold buys
  **Wonder levels**, which have no last one ([`16-wonders.md`](16-wonders.md)).

## 7. Where Gold goes

Flow: **housing taxes → Gold → fog, buildings and research**.

| Sink | Size |
|---|---|
| The whole map's fog | 194,142 |
| The technology tree, 24 techs | 6,600 |
| Expedition supplies, per launch | 50 → 2,000 by tier, recurring |
| Landmark claims | 2,000 · 25,000 ×5 · 100,000 ×4 |
| Buildings and upgrades | on a count and level curve; the fifteen upgrades total **51,926** |
| **Wonder levels** | **unbounded** — [`16-wonders.md`](16-wonders.md) |

- The quest chain pays **11,865 Gold across 50 quests**: 1.80× the whole
  technology tree ([`07-research.md`](07-research.md) §1).
- Every row except Wonder levels is one-time: upgrades **51,926** plus landmark
  claims **527,000**, roughly 780,000 Gold of finite sink.
- The only unbounded sink is Wonder levels ([`16-wonders.md`](16-wonders.md)).

## 8. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Tax rate | 30 Gold/pop/min | `taxes.gold_per_population_per_minute` |
| Seconds a tap is worth | **10 s of work** | `tap.work_seconds` |
| Tap Mana cost | 1 | `tap.mana_cost` |
| Housing capacity per level | [2, 4] — contested, OQ-46 | `Districts` sheet |
| Villager training | 20 s, cost `5,20,100,300,500,1000` then ×1.45 | `training.*`, `city.population_cost_*` |
| Collect cooldown | 0.5 s | `tap.collect_cooldown_seconds` |
| Sale prices | Food 1 · Stone 2 · Wood 3 | `Currencies.gold_value` |
| Adjacency | Housing↔Housing −1 | `Adjacency` sheet |

## 9. Deliberately not in this design

- Berries, Meat and Fish as wallet rows.
- A currency-equivalence engine: cheapest-first payment order, change-making,
  a Food breakdown in the purse.
- Iron as a wallet row.
- A second purse for research.
- Generators and vaults; building storage of any kind.
- Silver.
- A library district or a scholar assignment as Knowledge sources.
- A drip-sell queue, sale timers or a Gem rush at the Market.
- A Townhall tap that hurries villager training.

**Open questions:** OQ-46, OQ-48 in [`../open-questions.md`](../open-questions.md).
