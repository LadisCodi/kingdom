# 12 · Quests, onboarding and the daily habit

> **Scope.** The single quest chain, the first-user experience it authors, and
> the **daily chest** — a 20-day season of 14 rungs with a free track and a
> paid one.
>
> **Status: built.**

## 1. The quest chain

- **One chain, one active quest at a time.** Row order in the `Quests` sheet
  is chain order.
- Completing a quest lights the pill's **Claim**. Claim pays the reward and
  activates the next quest. The pill disappears when the chain ends.
- **55 quests** once `DriveThemOut` lands (54 today), paying 11,725 Gold plus its reward, 100 Mana, 750 Gems, 158 Stardust and **Knowledge on every single one**.

### 1.1 Goal types

- **Absolute** goals are predicates over current state (*have 2 Housing*,
  *Townhall at level 2*, *10 Wood in stock*). Work done before activation
  counts; the quest completes on activation.
- **Relative** goals count events from activation only (*collect 30 Gold*,
  *reveal 6 cells*). They hook the sim's income, tap, reveal and sale paths,
  so offline replay feeds them.

| Absolute | Relative |
|---|---|
| BuildDistrict · UpgradeDistrict · HoldResource · ReachPopulation · CompleteTech · CompleteTechs · AssignWorkers · TrainArmy · ClaimLandmarks · ReachDepth · ClearRuins · **ClearGarrisons** *(designed)* · OwnArtifacts · OwnHeroes · BuyUpgrade | CollectResource · CollectTaps · DiscoverCells · DiscoverFeature · SellGoods |

- **Goal types are code; goals are data.** A new type is a code change; a new
  quest is a row.
- **`DiscoverFeature`** is a `DiscoverCells` that counts only cells carrying a
  given feature.
  - The hint points at a dark cell that has the feature; with none in sight it
    points at the nearest frontier cell.
  - The feature is carried on the reveal event, not looked up later, so
    draining the feature afterwards cannot un-complete the quest.
- Beats overlap: the 25 Wood quest 3 chops is the Wood quests 4 and 10 spend.

## 2. The onboarding — quests 1–40

- **Quest number is beat number.** The arc is asserted beat by beat in a test.

| # | Quest | The beat |
|---|---|---|
| **1** | `FirstSteps` | Reveal four **forest** cells — every forest reachable from the opening block. |
| **2–3** | `Woodcraft` · `Timber` | Research **Forestry** (a 3-second research), then chop 25 Wood. |
| **4–6** | `ARoof` · `Rations` · `FirstVillager` | A House → Food from the berries → the first villager. |
| **7** | `TaxDay` | Collect rent. |
| **8** | `Explorer` | Reveal eight cells, in any direction. |
| **9–15** | `Fields` → `ToWork` | **Agriculture** (crop plots) → two plots → tap them → Wood for a Farm → **Farming** (the Farm, one row down) → a Farm → **assign a worker**. |
| **16–17** | `GrowingTown` · `Neighbors` | A second House, a third villager. |
| **18** | `ProperCapital` | **Townhall 2.** TH1 caps the city at 2 Houses and 1 Sawmill; quest 16 reaches the cap. |
| **19–21** | `SawTeeth` · `TheSawmill` · `Crewed` | **Saws → the Sawmill → two workers on it.** |
| **22–24** | `Levies` · `Sawpits` · `Regrowth` | **Taxes I → Sawpits I → Reforesting I** — the three cards the book puts between Saws and the Market. A requirement is the row above, so the chain walks the rows in order rather than pointing past them. |
| **25–27** | `Trade` · `ToMarket` · `Merchant` | Research, build and use the Market — once the Sawmill has made there be a surplus to sell. |
| **28** | `FurtherAfield` | Fifteen more cells — the near shrine and the Hollow Barrow come into view. **Discovering the Barrow starts its gate's counter: thirty minutes** ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md) §3). |
| **29–31** | `ArmedMen` · `Mustered` · `FirstSoldier` | **Warrior → Barracks → the first soldier.** The Barracks needs 20 Stone, tapped by hand from the rock outcrop; the Quarry is quest 41. |
| **32** | `FirstSummon` | **Summon at the banner. The first call is free.** |
| **33** | `DriveThemOut` | **Clear the Hollow Barrow's gate.** The free hero wins alone at any matchup; the first fight is on the surface, the enemy in view, the outcome guaranteed. Pays Gold. |
| **34–35** | `OldStones` · `Attuned` | **Claim the near shrine** for its Gold, consecrate a Sanctum. |
| **36–37** | `Mapmakers` · `Surveyors` | **Twenty more cells, then twenty-five.** The ladder the two earlier reveal beats started (8 → 15 → 20 → 25), out where a cell costs 20 Gold and up: exploring is paid for in Gold now, five taps a cell whatever the ring ([`01-map-and-fog.md`](01-map-and-fog.md) §5). |
| **38–39** | `Highlands` · `PutToSea` | **Scaling Tools** and **Sailing** — mountains and water become explorable. |
| **40** | `IntoTheDark` | **Survive one depth** of the Hollow Barrow — its gate fell at quest 33. |

- **Quests 41–55:** the Quarry, Urban Planning, Townhall 3 and Mining, then
  Attunement, the Sanctum, a warband, the first full ruin clear, attuning a
  relic, four landmarks, depth five, and three relics held at once.
- `OldStones` moving after the fight moves its Knowledge lump with it; the
  chain test still has to find `Mapmakers` affordable with zero drip.

### 2.1 The opening economy

- A new kingdom starts with **100 Gold** and **500 Gems**, and **no Knowledge
  at all**. The purse doubled with the fog's price table
  ([`01-map-and-fog.md`](01-map-and-fog.md) §5): the first frontier cells now
  cost 3 and 5 Gold, and at fifty a player who spent on the border before
  raising a roof had no rent coming and no way back — the 30-day harness
  never reached Townhall 2. The cliff sat between 50 and 60; a hundred clears
  it twice over. The chain pays for the research it asks for: **quest 1 pays 7**,
  which is Forestry's 2 plus the five of headroom the chain test insists on so
  a re-priced technology never strands the tutorial, and **every quest after
  it pays at least 1**. A grant handed over at the title screen taught the
  player nothing about where the clock comes from; a reward on the quest
  before the research does.
- **Three opening beats pay Mana instead of Gold** — `Timber`, `Rations` and
  `ByHand`, 30 · 30 · 40. They are the tapping beats, and the pool is what the
  opening is short of, not coin: a reward that buys taps arrives exactly where
  the player has just emptied it. Mana may overfill; an overcharged pool is a
  supported state and reads as one on the gauge.
- Quest 1's four forest cells cost ~16 Gold; Forestry costs 25 Gold and 2
  Knowledge; quest 1 pays 10 Gold and 7 Knowledge. 50 + 10 covers the Gold,
  **asserted at the dearest frontier the player
  could pick**.
- Forest cells refuse work until Forestry is researched; the refusal names
  Forestry.
- A pull costs 1,000 Gems. The first call on the standard banner is free,
  tracked on the pity counter.
- The Market beats (`Trade` · `ToMarket` · `Merchant`) sit at quests 25–27 and
  pay 60 / 70 / 70 Gold; the three research beats before them (`Levies` ·
  `Sawpits` · `Regrowth`) pay 80 / 90 / 90, so each funds the card the next
  one asks for. The Market's Gold sink is
  [`16-wonders.md`](16-wonders.md).
- Numbers the opening fixes elsewhere:
  - a crop plot costs **10 Wood**;
  - the first chop asks for **25 Wood** (a roof and a plot);
  - a level-1 House holds **2**, so the second villager needs no second roof;
  - Townhall L1→L2 costs **60 Wood**, no Stone (the Quarry is quest 41).
- The opening is played through the real sim with **no funding at all** — only
  what the game grants and what it earns.

### 2.2 Gems and Stardust

- **Gem rewards sit in four quests** — 18, 40, 48 and 55 —
  150 + 150 + 250 + 200 = 750.
- With the 500 grant and 2,500 from five ruin first-clears: **3,750 by play**,
  which reaches the second builder (2,500) and a pull
  ([`14-monetization.md`](14-monetization.md) §2.2). Later rungs come from the
  daily chest (~one a month) or a wallet.
- A player who stops at quest 40 holds 800 Gems — a Mana refill.
- **Stardust appears on exactly four goal types** — `ClearRuins`, `ReachDepth`,
  `OwnArtifacts`, `OwnHeroes`. Every other quest pays Gold.

## 3. The daily chest

> **Status: built.**

### 3.1 The season

- The chest is a **season**: **14 rungs** inside a **20-day window**.
- **A rung is a day PLAYED, not a day passed.** Rung 1 the first day the game
  is opened inside the window, rung 2 the second, whatever the gap. 14 rungs in
  20 days leaves **six missable days**.
- **A rung reached is paid and never retracted.** What expires is the chance to
  earn more ([`13-events.md`](13-events.md) §2.6).
- **Seasons are back-to-back and global**, derived from the instant:
  `floor(t / 20 days)`. No gap day, no per-player anchor, nothing to schedule.
- At the turn of a season the rung count returns to 0 and unclaimed rungs are
  gone. Nothing else carries over.
- **The window is the one deadline in the game.** It is deliberate: the Royal
  chest is a season product and a season needs an end.

### 3.2 The two tracks

One ladder, two columns ([`13-events.md`](13-events.md) §2.4, OQ-20), and
**every cell is its own button**. Tapping the day's free cell is what takes
the day and advances the ladder; each Royal cell is a separate tap. The reward
and the thing you press are the same object.

| Rung | Free | Royal |
|---|---|---|
| 1 | Mana ~⅓ | 500 Gems |
| 2 | Mana ~⅓ | 500 Gems + a gold key |
| 3 | Mana ~½ + **200 Gems** | 800 Gems + Hero XP |
| 4 | Mana ~⅓ | 800 Gems + a gold key |
| 5 | Mana ~½ | 1,000 Gems |
| 6 | Mana ~⅓ + **400 Gems** | 1,000 Gems + a gold key + Hero XP |
| **7 · half marker** | **a full pool** | **3,000 Gems + two gold keys** |
| 8 | Mana ~⅓ | 1,200 Gems |
| 9 | Mana ~½ + **600 Gems** | 1,200 Gems + a gold key + Hero XP |
| 10 | Mana ~⅓ | 1,500 Gems |
| 11 | Mana ~½ | 1,500 Gems + a gold key |
| 12 | Mana ~⅓ + **800 Gems** | 2,000 Gems + Hero XP |
| 13 | Mana ~½ | 2,000 Gems + a gold key |
| **14 · season marker** | **a full pool + 1,000 Gems** | **8,000 Gems + two gold keys + Hero XP** |

- **The free column is Mana**, with Gems on five rungs — **3,000 a season**,
  the recurring F2P Gem faucet, ~4,500 a month. That pays a free player three
  gold keys or a builder and change every month.
- Mana is a **fraction of the cap**, never an absolute, and lands **on top of
  the cap** like the ad reward.
- **Hero XP is priced in hours of the city's own XP trickle**, with an authored
  floor — the same rule as a tap's `workSeconds`. An absolute XP number goes
  stale by era three. The floor is **20,000 a grant**, so a city with no delve
  income still takes **100,000 XP** out of a season and a delving one takes
  more.
- Gems and gold keys are absolute: neither has a production rate to be a
  fraction of.
- The Royal column pays a season of **25,000 Gems, ten gold keys and five XP
  grants**. Counted at the pass's own rate — a gold key at its shop price of
  1,500 Gems, Hero XP at **10 XP a Gem** — that is **50,000 Gems of value, the
  $99.99 pack, for €9.99**.
- **Half of it is deliberately not Gems.** A pass that paid 50,000 Gems would
  end the six Gem packs, and the packs are how the store measures intent
  ([`14-monetization.md`](14-monetization.md) §2.2). Keys and XP are the other
  half, and XP is the part no amount of Gems buys anywhere else in the game.
  That is the product.

### 3.2.1 Taking a rung

- **The free cell of the day's rung is the claim.** One a day, in order, and it
  is what moves the ladder.
- **A Royal cell is claimable once its rung has been climbed**, the chest is
  owned, and it has not been taken. No daily limit: as many as are open.
- **Royal cells are taken in any order and at any pace** inside the window.
- Three states, and they are the whole read of the sheet: **waiting** (lit and
  pulsing), **taken** (lit, with a tick — a day you took is something you
  have), **locked** (dimmed but fully legible, so the price shows exactly what
  it buys on the rows already climbed).
- The sheet stays open after a tap. Thirteen more cells are on it.

### 3.3 The Royal chest

- **€9.99, one season.** A real-money SKU against the simulated budget
  ([`14-monetization.md`](14-monetization.md) §3), never a Gem price
  (OQ-25).
- **The buy button is the Royal column's header**, carrying the price. Bought,
  the header becomes the column's name and the padlocks go.
- **Buying OPENS every rung already climbed this season.** It grants nothing
  on the spot: what it hands over is a column of cells to tap. There is no
  reward for buying early and nothing lost by buying late.
- **It does not carry to the next season.** A season is the unit.
- Sold **only here**. The store lists no card for it: the column beside the
  free one is what explains the price.

### 3.4 The pill and the sheet

- **The chest is a pill, not a modal, and it never opens itself.**
- The pill **glows** while a rung is claimable, or while any Royal cell is
  waiting to be taken.
- With every rung claimed and the Royal chest unbought, **the pill stays,
  unlit, until the season closes** — the purchase has to stay reachable
  (§3.3). With everything claimed and the chest bought, it sleeps until the
  next season.
- The sheet carries **the season countdown** at its head. It is the deadline,
  so it is stated.
- Rungs behind the player are shown **lit, not greyed**. Locked Royal cells
  carry a padlock.

### 3.5 Rollover

- **The day rolls over at 00:00 UTC**, and so does the season boundary.
- **A missed day is never paid retroactively.** One claim a day, no backlog.
- `lastClaimedDay` is stamped, not incremented, so a second claim in one day is
  impossible however the clock moves — including backwards.
- Nothing here is a boundary source in `advance()`: a daily timer would propose
  a boundary a day across a long absence for no simulation benefit, the tail
  advance is uncapped, and claiming is always a live player command.

### 3.6 Where it lives

- `sim/daily.ts`: `seasonIndex(t) = floor(t / seasonMs())` beside `dayIndex`,
  both derived from the instant and neither ever written. `freeReward` and
  `royalReward` are separate functions; `claimDailyChest` pays the first
  always and the second only when the season is bought.
- `state.kingdom.daily` is
  `{ season, rung, lastClaimedDay, royalSeason, royalClaimed }`.
  `royalSeason` is the season index the chest was bought for, so "is it
  bought" is a comparison and never a flag anything has to clear.
- **A stale `season` READS as rung 0** — `rungsClaimed` reports it without
  writing, so a season turns over with nothing ticked and nothing reset.
- `claimFreeRung` takes the day; `claimRoyalRung(rung)` takes one Royal cell.
  `royalClaimed` is a list of rung numbers, not a count, because the cells are
  taken out of order.
- `buyRoyalChest` spends the budget through `buySku('RoyalChest')`, so the
  purchase log, the refusal counter and the monthly allowance see it exactly
  as they see a Gem pack. It pays nothing — it stamps `royalSeason`, and the
  cells become claimable. The SKU's `gems` is 0.
- **Reads never write.** `normalise` is the one place that brings a stale
  season onto the current one, and only a claim or a purchase calls it.
- The store's pack grid reads `GEM_PACK_ORDER`, not `STORE_ORDER`, which is
  what keeps a non-pack SKU off the shelf.
- **Not** a boundary source in `advance()` (§3.5).
- `SAVE_VERSION` 35, with a migrator that drops the old `LadderStep`.
- Workbook: `daily.season_days`, `daily.gems`, `daily.premium_gems`,
  `daily.premium_gold_keys`, `daily.premium_xp_hours`,
  `daily.premium_xp_floor`, and `collection.xp_trickle_per_tier_depth` for the
  XP rate. `daily.gold_seconds` and `daily.gold_floor` are gone.

## 4. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Season length | a 20-day window | `daily.season_days` |
| Ladder length | 14 rungs — **the length of the reward lists**, not its own dial | `daily.mana_fractions` |
| Mana ladder | fractions of the cap, a full pool at 7 and 14 | `daily.mana_fractions` |
| Free Gems (the recurring F2P faucet) | 200 / 400 / 600 / 800 / 1,000 — **3,000 a season** | `daily.gems` |
| Royal Gems | **25,000** a season | `daily.premium_gems` |
| Royal Hero XP | 12 hours of the XP trickle, floored at **20,000** a grant — five grants | `daily.premium_xp_hours`, `daily.premium_xp_floor`, `collection.xp_trickle_per_tier_depth` |
| Royal gold keys | **ten** a season | `daily.premium_gold_keys` |
| The Royal chest's price | **€9.99** for 50,000 Gems of value | `Store` sheet |
| The chain | row order is chain order | `Quests` sheet |

## 5. Acceptance

- A player who opens the game on day 15 of a season **has a rung waiting** and
  is not behind.
- A two-week absence loses the season, not the account: the next season opens
  at rung 1 with nothing owed.
- Buying the Royal chest on rung 9 lights nine Royal cells at once, and every
  one of them can be taken that same minute.
- A player who claims all 14 rungs on day 16 can still buy the Royal chest on
  day 19, and cannot on day 21.
- The opening is played through the real sim with **nothing granted** and
  reaches the end of the authored chain without a dead end.
- `ClearGarrisons` is the one goal type added since the chain was written,
  and it pays Gold only.

## 6. Deliberately not in this design

- **A streak that can be lost.** A rung reached is paid; the window is what
  ends.
- **A streak-repair SKU**, and no way to buy back a missed day.
- **A Gold rung.** The free column is Mana and Gems; Gold is not the scarce
  coin by the time a season matters.
- A chest that opens itself.
- A second Royal purchase inside one season, and a Royal chest that carries
  over into the next.
- **A claim-all button**, and a single button that pays both tracks. The day is
  taken by pressing the day.
- A daily limit on Royal cells. The free cell is one a day; the paid column is
  not rationed twice.
- A second quest chain. Branching quests.
- **Generated orders** — daily fetch-quests in a Market tab. The open-ended
  Gold sink is [`16-wonders.md`](16-wonders.md) §1; a sink never pays back
  what it asked for ([`16-wonders.md`](16-wonders.md) §3.1). An order reroll
  as an ad placement or pass reward ([`14-monetization.md`](14-monetization.md))
  goes with them.

**Open questions:** OQ-47, OQ-53. Moot with generated orders: OQ-16, OQ-17.
