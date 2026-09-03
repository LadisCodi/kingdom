# 3 · The economy — currencies, taxes and the Market

> **Scope.** Every currency, what each one is for, where the city's Gold comes
> from, and the Market. Mana has its own doc ([`08-magic.md`](08-magic.md));
> Stardust and ingredients are [`09-relics.md`](09-relics.md); Knowledge as a
> research clock is [`07-research.md`](07-research.md).
>
> **Status: built**, except the Knowledge ↔ Stardust rename (§1.1), which is
> designed and unstarted.

## 1. One job each

> **The city runs on Gold, Food, Wood and Stone. Mana is what magic costs.
> Stardust comes out of dungeons and levels your collection. Knowledge is a
> clock that paces research.**

| Currency | Source | Buys | Scope | On the plank? |
|---|---|---|---|---|
| **Gold** | housing taxes, **gold mountains**, quests, the Market | fog, buildings, upgrades, expedition supplies, landmark claims | city | yes |
| **Food** | berries, game, shoals, crops | villagers, expedition supplies | city | yes |
| **Wood** | forest | buildings | city | yes |
| **Stone** | mountains, iron mountains | buildings, deep supplies | city | yes |
| **Mana** | time, capped | every player tap · relic actives | city | a gauge, not a coin |
| **Knowledge** | time, capped | committing technologies · investing in guild structures | city | no — read where it is spent |
| **Stardust** | dungeons | relic and hero levels | kingdom | no — reads in the Reliquary |
| **Ingredients** | 1★ province · 2★ events · 3★ world | each relic's tier gate | kingdom | no — a grid, not a row |
| **Gems** | quests, first clears, the daily week marker, the simulated store | comfort and breadth | player | yes |

**Eight wallet rows, five things on the plank, three of them for the whole first
hour.** That is the number this design fought to get to and the number to
defend.

### 1.1 Two names for two jobs

One name cannot hold two jobs — that is how the docs ended up contradicting
themselves. So:

| Name | Job | Source | Scope |
|---|---|---|---|
| **Knowledge** | the research clock | time, capped | **city** |
| **Stardust** | levels of relics and heroes | dungeons | **kingdom** |

Both names import a convention instead of teaching one: Knowledge is the word
Elvenar and Rise of Cultures use for this exact mechanic, and Stardust reads
across the market as the currency you pour into levelling a collectible. In the
docs and in code the key is **`Stardust`**; *Polvo estelar* is the localised
string.

**The scopes swap.** Today's Knowledge is kingdom-scoped deliberately, *so it
survives a region reset* — that reasoning now describes **Stardust**. The new
Knowledge is **city-scoped**, like Mana, because research belongs to this city.

## 2. A cell's identity and the coin it pays are different things

Berry bushes, wild game and fish shoals all pay **Food** — 1, 3 and 2 a tap. A
bare mountain pays **Stone** at 1 and an iron mountain at 5 — and a gold
mountain, the same landform again, pays **Gold**. The map keeps every bit of
its texture — the art, the tech gates, the taps-to-exhaust, the respawn timers,
whether the feature is finite — and the purse stops carrying four extra rows to
express *a berry is a unit of food*.

This is `HarvestSpec.id` versus `HarvestSpec.currencyId`, and it is also what
the cell-scoped upgrades hang on: **Butchery** is about butchering and **Big
Nets** is about nets, even though both now move Food.

**Four city materials is the genre ceiling, not the floor.**

| Game | City currencies | Premium | Research paid in |
|---|---|---|---|
| Polytopia | **1** | — | Stars |
| Clash of Clans | 3 | Gems | the same 3 |
| Elvenar | 3 | Diamonds | Knowledge Points — **time-accrued** |
| Rise of Kingdoms · AoE Mobile · Whiteout | 4 | Gems | the same 4 |
| Forge of Empires | 2 + 5 goods/era | Diamonds | Forge Points — **time-accrued** |

Two things follow from that table, and both are load-bearing here. Forge of
Empires is the only comparable with more than four, and it grew into that across
fourteen years of content. And **nobody makes a research currency do three
jobs** — everywhere else it is a clock, which is why §1.1 splits ours in two.

> **Adding a wallet row needs an argument.** The Fragments precedent — a
> per-collectible counter rather than a row — and event points as a counter
> ([`13-events.md`](13-events.md) §2.1) are usually the better answer.

## 3. Housing taxes — the idle backbone

**Every housed villager pays `taxes.goldPerPopulationPerMinute` = 30 Gold/min**,
continuously, accrued in whole units against an anchor and replayed exactly
offline within the 8 h cap.

- **Residents are auto-assigned.** Houses fill in build order as population
  grows; the player never manages who lives where. It has no mechanical effect
  beyond which house you tap.
- **Roofless villagers pay nothing**, and empty minutes are never banked: no
  housing, no income.
- **A lived-in house is itself a tappable Gold cell** — see §5.
- **TradeRoutes** raises the rate +10%/level; the **Gilded Ledger** relic +20%
  while attuned, through the modifier layer rather than a second upgrade.

A sanity check on the rate: at 30 Gold/pop/min, a Townhall-1 city with two
level-1 Houses is **4 villagers ≈ 120 Gold/min idle**.

> **The capacity number is contested.** The workbook ships
> `populationCapacityPerLevel = [2, 4]` and the onboarding was rewritten around
> a level-1 House holding 2, *so the second villager needs no second roof*. But
> three earlier balance passes derived every pacing figure from `[1, 2]` and
> quote "TH1 ≈ 60 Gold/min". The data is `[2, 4]`; the derived tables that
> assumed otherwise are stale. **OQ-46.**

### Adjacency

A directed `(district, neighbour)` rule paying Gold/min, positive or negative,
computed from locations on read. Footprints must share an **edge** — diagonal
corner contact does not count.

**There is exactly one rule: Housing next to Housing, −1 Gold/min per
neighbour.** Crowded rows tax worse; spreading out pays. A house clamps at 0,
never negative. While placing, every affected neighbour and the ghost itself
show a compact label.

One rule against fourteen districts competing for the same ground is the
thinnest part of the whole design, and it is thin *because* the canvas grows by
buying tiles ([`02-map-scopes.md`](02-map-scopes.md) §1). Widening the effect
column beyond Gold once and authoring twenty rules is the most design depth per
hour of work available. **OQ-48.**

## 4. Villager training

The Townhall trains villagers in a **queue**. Each press of Train pays its Food
cost up front — priced as if everything queued had already delivered — and
appends one villager; they complete sequentially at `training.seconds` = 20 s
each. Queueing is limited only by Food and housing capacity, and queued
villagers count against the cap.

Cost is authored for the first six (`5, 20, 100, 300, 500, 1000`) and then
`×1.45` per villager beyond.

Tapping the Townhall boosts the current villager by
`training.tapBoostSeconds` = 2 s; the next starts at the boosted completion
moment.

## 5. A tap is priced in production, not in units

> **A tap hands you `tap.boostSeconds` = 45 seconds of what the thing you
> tapped is producing**, floored at the authored yield.

This is the best balance decision in the project and **the rule every new reward
must follow.** It is what the house tap always did — pulling a share of city
income forward — and resource cells simply joined it, collapsing two dials into
one.

**Why it had to scale.** A flat yield is worth 73 minutes of production against
one Sawmill and under three against six. Priced against production, a full Mana
pool is worth the same fraction of progress at every stage, with nothing
re-derived per era:

| City | gather rate | tap yield | full pool | = production |
|---|---|---|---|---|
| no workers | 0/s | **1** (the floor) | 100 Wood | — |
| 1 Sawmill L1 | 0.25/s | 11 | 1,100 | 73 min |
| 2 Sawmills L2 | 0.71/s | 32 | 4,160 | 97 min |
| 3 Sawmills L3 | 1.31/s | 59 | 9,440 | 120 min |

The span grows only because the cap ladder grows — a bigger city buys a longer
session, which is the intended progression feel.

The rate a tap reads is **nominal, not measured**: it takes the influence radius
as the worker's travel distance, so it needs no map and no clock. A district
whose cells are all adjacent under-reports; one working the rim over-reports.
That is fine for a balance dial — a tap yield is an *estimate* of production
rather than a promise.

**Every player tap costs 1 Mana**, except paying fog, which already costs Gold.
Charging twice for one tap would price exploration out of both currencies at
once. A tap refused by a tech gate costs no Mana.

> **Quest rewards are absolute Gold amounts in a spreadsheet, and they will go
> stale on their own by era three.** So will delve hauls, chest contents and
> pass milestones if we author them the same way. Pricing in *duration of the
> player's own production* is what makes a reward table survive ten content
> drops without a rebalancing pass.

## 6. The Market

A buildable district gated behind the **Market** technology, with no navbar
entry — you **tap the built Market** to open it. It arrives at onboarding steps
13–15, the first beat at which the city produces more than it eats.

- **Selling is instant.** An amount selector (×1 / ×10 / ×100 / ×1000 / All),
  one Sell per sellable currency, Gold on the spot:
  `floor(units × goldValue × (1 + 5% per MarketStall level))`.
- Three crates: **Food 1, Stone 2, Wood 3** Gold a unit.
- The old drip-sell queue, sale timers and gem rush are gone — taxes cover idle
  income now, so the Market no longer needs to run while away.

**The Market's second job is orders** ([`12-quests.md`](12-quests.md) §3), which
is the reason it moved into the opening. Converting surplus into Gold that also
has nowhere to go is not a sink; an order is.

## 7. Where Gold goes

The everyday flow is **housing taxes → Gold → fog, buildings and research**, and
the design turns on three calls competing for one purse.

| Sink | Size |
|---|---|
| The whole map's fog | 194,142 |
| The technology tree, 24 techs | 6,600 |
| Expedition supplies, per launch | 50 → 2,000 by tier, recurring |
| Landmark claims | 2,000 · 25,000 ×5 · 100,000 ×4 |
| Buildings and upgrades | on a count and level curve |

Against which the **quest chain pays 11,865 Gold across 50 quests** — 1.80× the
whole tree. **The tree is not a sink; it is a formality the chain funds twice
over.** That measurement is the argument for eras
([`07-research.md`](07-research.md) §4) and for orders as the only infinite sink
([`12-quests.md`](12-quests.md) §3).

## 8. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Tax rate | 30 Gold/pop/min | `taxes.gold_per_population_per_minute` |
| Tap boost | **45 s of production** | `tap.boost_seconds` |
| Tap Mana cost | 1 | `tap.mana_cost` |
| Housing capacity per level | [2, 4] — contested, OQ-46 | `Districts` sheet |
| Villager training | 20 s, cost `5,20,100,300,500,1000` then ×1.45 | `training.*`, `city.population_cost_*` |
| Collect cooldown | 0.5 s | `tap.collect_cooldown_seconds` |
| Sale prices | Food 1 · Stone 2 · Wood 3 | `Currencies.gold_value` |
| Adjacency | Housing↔Housing −1 | `Adjacency` sheet |

## 9. What this design deleted, and why

- **Berries, Meat and Fish as wallet rows** — they were already "counts as
  Food". The whole currency-equivalence engine went with them: cheapest-first
  payment order, change-making, a Food breakdown in the purse. *Fish resolved
  upward to 2*, because it carried two contradictory values (1 as a cost, 2 at
  the Market) and the fold had to pick one. That is the single number that
  genuinely moved; watch it.
- **Iron as a wallet row** — distance carries the far-fog payoff without a coin.
  Everything converted at 1 Iron = 3 Stone, their `gold_value` ratio.
- **A second purse for research.** Research is paid out of the city wallet, so
  the tree competes with fog and buildings for one budget.
- **Generators and vaults.** Buildings produce nothing by themselves; deposits
  go straight to the wallet, with no building storage anywhere.
- **Silver.** Merged into Gold.
- **A library district and a scholar assignment** as Knowledge sources — both
  would put the research clock back into the city's worked economy.

**Open questions:** OQ-46, OQ-48 in [`../open-questions.md`](../open-questions.md).
