# 12 · Quests, onboarding and the daily habit

> **Scope.** The single quest chain, the first-user experience it authors, and
> the **daily chest** — a 20-day season of 14 rungs with a free track and a
> paid one.
>
> **Status: built.**

## 1. The quest chain

- **One chain, one active quest at a time.** List order in `quests`
  is chain order, reordered by dragging.
- Completing a quest lights the pill's **Claim**. Claim pays the reward and
  activates the next quest. The pill disappears when the chain ends.
- **64 quests**, paying 15,995 Gold, 100 Mana, 750 Gems, 140 Stardust,
  **35 Knowledge across fifteen of them** (§2.1) and **one card pack**.
- A reward may carry a **card pack** (`rewardPack`); the first fight's is the
  kingdom's first pack ([`22-progression.md`](22-progression.md) §7).

### 1.1 Goal types

- **Absolute** goals are predicates over current state (*have 2 Housing*,
  *Townhall at level 2*, *10 Wood in stock*). Work done before activation
  counts; the quest completes on activation.
- **Relative** goals count events from activation only (*collect 30 Gold*,
  *reveal 6 cells*). They hook the sim's collect, tap, reveal and sale paths.
- A `collect` counts when units reach the wallet — a tap on the ground, or
  collecting a building's store ([`03-economy.md`](03-economy.md) §3.2) —
  never when rent accrues or a haul lands.

| Absolute | Relative |
|---|---|
| BuildDistrict · UpgradeDistrict · HoldResource · ReachPopulation · CompleteTech · CompleteTechs · AssignWorkers · TrainArmy · ClaimLandmarks · ClearLairs · OwnArtifacts · OwnHeroes | CollectResource · CollectTaps · DiscoverCells · DiscoverFeature |

- **`ClaimLandmarks` may name a landmark kind** — *Claim the Watchtower* — and
  names none for any landmark.

- **Goal types are code; goals are data.** A new type is a code change; a new
  quest is an entry.
- **A quest's line is rendered from its goal, never written.** Each `quests`
  entry carries a `name` — flavour, *Timber!*, *Tax day* — and no description;
  the sentence the tracker shows is generated from `goalType`, `goalTarget`
  and `goalAmount`, the way a technology's card is generated from what it
  unlocks. So a rebalance updates its own prose, and a new goal type owes one
  phrase rather than 53 rewrites.
- **The tracker holds 44 characters**, and that is the whole budget: it is the
  only place a quest's line is ever shown. Written copy ran to 105 and was
  read cut off mid-word; the generated lines top out at 30.
- **`DiscoverFeature`** is a `DiscoverCells` that counts only cells carrying a
  given feature.
  - The hint points at a dark cell that has the feature; with none in sight it
    points at the nearest frontier cell.
  - The feature is carried on the reveal event, not looked up later, so
    draining the feature afterwards cannot un-complete the quest.
- Beats overlap: the 25 Wood quest 3 chops is the Wood quests 4 and 10 spend.

## 2. The chain, act by act

- **Quest number is beat number.** The arc is asserted beat by beat in
  `tests/quests.test.ts`, and the opening is **played** through the real sim
  in `tests/onboarding.test.ts`.
- The First Morning's scripted beats ride on quests 1–7
  ([`23-tutorials.md`](23-tutorials.md) §3); the doors each act opens are
  [`22-progression.md`](22-progression.md) §3.

| # | Quests | The beat | Opens |
|---|---|---|---|
| **1–7** · the First Morning | `FirstSteps` · `Woodcraft` · `Timber` · `ARoof` · `Rations` · `FirstVillager` · `TaxDay` | four forest cells, Forestry, 25 Wood, a House, Food, a villager, rent | Research, Knowledge, Build, the daily chest |
| **8–15** · farming | `Explorer` · `Fields` · `FirstPlot` · `ByHand` · `Lumber` · `Tillage` · `Farmhand` · `ToWork` | eight cells, Agriculture, two plots, Food by hand, Farming, a Farm, a worker | |
| **16–22** · the village | `SecondVillager` · `GrowingTown` · `Neighbors` · `SawTeeth` · `TheSawmill` · `Crewed` · `ProperCapital` | a second villager (the first House full), a second House, three villagers, Saws, the Sawmill, three workers, **Townhall 2** | |
| **23–25** · the rows after Saws | `Levies` · `Sawpits` · `Regrowth` | Trade Routes I, Sawpits I, Reforesting I | |
| **26–31** · the Orcs | `FurtherAfield` · `ArmedMen` · `Mustered` · `FirstSoldier` · `MusterCompany` · `DriveThemOut` | fifteen cells find the Orcs; Warrior, the Barracks, a soldier, a company of 24, **the first fight** | **Warfare**; the first pack and **Relics** |
| **32–35** · old magic | `OldStones` · `Attuned` · `Mapmakers` · `Surveyors` | the Thorned Shrine the Orcs held, Consecration, twenty and twenty-five cells | **Magic** |
| **36–41** · stone | `Watered` · `Fallow` · `MoreRoom` · `SecondStory` · `Chisels` · `Stoneworks` | the rows above Urban Planning, Housing L2, Masonry, the Quarry | |
| **42–46** · the Tavern | `Crafts` · `Knack` · `Hearth` · `OpenDoors` · `FirstSummon` | the rows above Hospitality, the Tavern, three heroes | **Heroes**, the banner, **the Sagas**; Bess |
| **47–53** · the town | `FullHouse` · `IronRoad` · `Deft` · `Architect` · `GrandCapital` · `DeepSeams` · `TheSanctum` | eight villagers, Stone, Quick Hands I, Bureaucracy, **Townhall 3**, Mining, the Sanctum | |
| **54–60** · the borough | `AWarband` · `TheBarrowsPrize` · `PutToSea` · `Cartographers` · `Magistrate` · `Township` · `Borough` | sixty soldiers, a second landmark, Sailing, twenty cells, Magistracy, twelve villagers, **Townhall 4** | |
| **61–64** · the world | `Leylines` · `SecondLair` · `TheWatchtower` · `DeeperStill` | three landmarks, the Harpies, **the Watchtower**, a hundred soldiers | **the world door**, **the Atlas** |

- **A requirement is the row above**, so the chain walks the rows it needs
  (`Watered` and `Fallow` before Urban Planning, `Crafts` and `Knack` before
  Hospitality) rather than pointing past cards the player cannot start.
- **Every lair and landmark the chain names is inside the Townhall's reach**
  when it asks (`tests/quests.test.ts`): the Harpies wait for Townhall 4.

### 2.1 The opening economy

- A new kingdom starts with **100 Gold** and **500 Gems**, and **no Knowledge
  at all**. The purse doubled with the fog's price table
  ([`01-map-and-fog.md`](01-map-and-fog.md) §5): the first frontier cells now
  cost 3 and 5 Gold, and at fifty a player who spent on the border before
  raising a roof had no rent coming and no way back — the 30-day harness
  never reached Townhall 2. The cliff sat between 50 and 60; a hundred clears
  it twice over.
- **The chain funds the research it asks for, through the opening only.**
  Quest 1 pays Forestry's 2 outright, and **fifteen quests pay Knowledge**,
  placed so that every card the chain demands up to `Attuned` — quest 33,
  Consecration — is affordable **with no drip at all**, prerequisites included.
  **The quest just before each of those research quests pays its card's
  Knowledge by itself**, so a player who spent what was banked on cards of
  their own is never stuck.
  A grant handed over at the title screen taught the player nothing about
  where the clock comes from; a reward on the quest before the research does.
- **Past `Attuned` the chain stops paying and the clock takes over**
  ([`07-research.md`](07-research.md) §3). The zero-drip guarantee is
  asserted for the opening and **only** the opening (`tests/quests.test.ts`);
  the cut is by chain position, not by era — `MoreRoom` asks for an era-1
  card at quest 38, past it.
- **Three opening beats pay Mana instead of Gold** — `Timber`, `Rations` and
  `ByHand`, 30 · 30 · 40. They are the tapping beats, and the pool is what the
  opening is short of, not coin: a reward that buys taps arrives exactly where
  the player has just emptied it. Mana may overfill; an overcharged pool is a
  supported state and reads as one on the gauge.
- Quest 1's four forest cells cost ~16 Gold; **Forestry costs no Gold at all**
  — the first four cards are priced in Knowledge alone — and 2 Knowledge,
  which is exactly what quest 1 pays alongside its 10 Gold. The 100 covers the
  cells, **asserted at the dearest frontier the player could pick**.
- Forest cells refuse work until Forestry is researched; the refusal names
  Forestry.
- The first call on the standard banner is free, **and it is always a hero**
  ([`22-progression.md`](22-progression.md) §6).
- The three research beats at 22–24 (`Levies` · `Sawpits` · `Regrowth`) pay
  80 / 90 / 90 Gold, so each funds the card the next one asks for.
- Numbers the opening fixes elsewhere:
  - a crop plot costs **10 Wood**;
  - the first chop asks for **25 Wood** (a roof and a plot);
  - a level-1 House holds **2**, so the second villager needs no second roof;
  - Townhall L1→L2 costs **60 Wood**, no Stone (the Quarry is quest 41).
- The opening is played through the real sim with **no funding at all** — only
  what the game grants and what it earns.

### 2.2 Gems and Stardust

- **Gem rewards sit in four quests** — `ProperCapital`, `GrandCapital`,
  `Borough` and `SecondLair` — 150 + 250 + 200 + 150 = 750.
- With the 500 grant and 2,500 from five ruin first-clears: **3,750 by play**,
  which reaches the second builder (2,500) and a pull
  ([`14-monetization.md`](14-monetization.md) §2.2). Later rungs come from the
  daily chest (~one a month) or a wallet.
- **Stardust is paid only past the first summon** — `FirstSummon`,
  `SecondLair`, `TheBarrowsPrize`, `TheWatchtower`, `DeeperStill` — where the
  hero ladder it buys is open.

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
  stale by era three. The floor is **20,000 a grant**, so a city with no ruin
  income still takes **100,000 XP** out of a season and one that is clearing
  rooms takes more.
- Gems and gold keys are absolute: neither has a production rate to be a
  fraction of.
- The Royal column pays a season of **25,000 Gems, ten gold keys and five XP
  grants**. Counted at the pass's own rate — a gold key at its shop price of
  1,500 Gems, Hero XP at **10 XP a Gem** — that is **50,000 Gems of value, the
  $99.99 pack, for $9.99**.
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

- **$9.99, one season.** A real-money SKU against the simulated budget
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
  a boundary a day across a long absence for no simulation benefit, and
  claiming is always a live player command.

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
- Settings: `daily.seasonDays`, `daily.gems`, `daily.premiumGems`,
  `daily.premiumGoldKeys`, `daily.premiumXpHours`,
  `daily.premiumXpFloor`, and `collection.xpTricklePerTierDepth` for the
  XP rate.

## 4. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Season length | a 20-day window | `daily.seasonDays` |
| Ladder length | 14 rungs — **the length of the reward lists**, not its own dial | `daily.manaFractions` |
| Mana ladder | fractions of the cap, a full pool at 7 and 14 | `daily.manaFractions` |
| Free Gems (the recurring F2P faucet) | 200 / 400 / 600 / 800 / 1,000 — **3,000 a season** | `daily.gems` |
| Royal Gems | **25,000** a season | `daily.premiumGems` |
| Royal Hero XP | 12 hours of the XP trickle, floored at **20,000** a grant — five grants | `daily.premiumXpHours`, `daily.premiumXpFloor`, `collection.xpTricklePerTierDepth` |
| Royal gold keys | **ten** a season | `daily.premiumGoldKeys` |
| The Royal chest's price | **$9.99** for 50,000 Gems of value | `store` |
| The chain | list order is chain order | `quests` |

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
- **Generated orders ON THIS BOARD.** A recurring generated ask exists — it is
  the season pass's mission board ([`20-season-pass.md`](20-season-pass.md)
  §3) — and it deliberately is not a *fetch-quest*: it never asks the player
  to hand resources over, because the open-ended Gold sink is
  [`16-wonders.md`](16-wonders.md) §1 and a sink never pays back what it
  asked for ([`16-wonders.md`](16-wonders.md) §3.1). It asks the player to
  PLAY, and it pays.
- **An order reroll**, as an ad placement or as a pass reward. The pass's
  board is capped rather than timed, so the thing a wallet is offered is
  finishing work already started, never a fresh hand of work
  ([`14-monetization.md`](14-monetization.md) §1).

**Open questions:** OQ-16, OQ-17, OQ-47, OQ-53.
