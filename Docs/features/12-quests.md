# 12 · Quests, onboarding and the daily habit

> **Scope.** The single quest chain, the first-user experience it authors, and
> the **daily chest**.
>
> **Status: built.**

## 1. The quest chain

- **One chain, one active quest at a time.** Row order in the `Quests` sheet
  is chain order.
- Completing a quest lights the pill's **Claim**. Claim pays the reward and
  activates the next quest. The pill disappears when the chain ends.
- **50 quests, paying 11,865 Gold, 750 Gems and 158 Stardust.**

### 1.1 Goal types

- **Absolute** goals are predicates over current state (*have 2 Housing*,
  *Townhall at level 2*, *10 Wood in stock*). Work done before activation
  counts; the quest completes on activation.
- **Relative** goals count events from activation only (*collect 30 Gold*,
  *reveal 6 cells*). They hook the sim's income, tap, reveal and sale paths,
  so offline replay feeds them.

| Absolute | Relative |
|---|---|
| BuildDistrict · UpgradeDistrict · HoldResource · ReachPopulation · CompleteTech · CompleteTechs · AssignWorkers · TrainArmy · ClaimLandmarks · ReachDepth · ClearRuins · OwnArtifacts · OwnHeroes · BuyUpgrade | CollectResource · CollectTaps · DiscoverCells · DiscoverFeature · SellGoods |

- **Goal types are code; goals are data.** A new type is a code change; a new
  quest is a row.
- **`DiscoverFeature`** is a `DiscoverCells` that counts only cells carrying a
  given feature.
  - The hint points at a dark cell that has the feature; with none in sight it
    points at the nearest frontier cell.
  - The feature is carried on the reveal event, not looked up later, so
    draining the feature afterwards cannot un-complete the quest.
- Beats overlap: the 25 Wood quest 3 chops is the Wood quests 4 and 10 spend.

## 2. The onboarding — quests 1–34

- **Quest number is beat number.** The arc is asserted beat by beat in a test.

| # | Quest | The beat |
|---|---|---|
| **1** | `FirstSteps` | Reveal four **forest** cells — every forest reachable from the opening block. |
| **2–3** | `Woodcraft` · `Timber` | Research **Forestry** (a 3-second research), then chop 25 Wood. |
| **4–6** | `ARoof` · `Rations` · `FirstVillager` | A House → Food from the berries → the first villager. |
| **7** | `TaxDay` | Collect rent. |
| **8** | `Explorer` | Reveal eight cells, in any direction. |
| **9–14** | `Fields` → `ToWork` | **Agriculture** (crop plots and the Farm) → two plots → tap them → Wood for a Farm → **assign a worker**. |
| **15–17** | `Trade` · `ToMarket` · `Merchant` | Research, build and use the Market. |
| **18–19** | `GrowingTown` · `Neighbors` | A second House, a third villager. |
| **20** | `ProperCapital` | **Townhall 2.** TH1 caps the city at 2 Houses and 1 Sawmill; quest 19 reaches the cap. |
| **21–23** | `SawTeeth` · `TheSawmill` · `Crewed` | **Saws → the Sawmill → two workers on it.** |
| **24–25** | `FurtherAfield` · `OldStones` | Fifteen more cells, then **claim the near shrine**. |
| **26–27** | `Mapmakers` · `Surveyors` | **Cartography**, then **Surveying ×2**. Each Surveying level makes one tap on the fog do the work of one more; it does not change a cell's price (far rings cost 320 and 640 Gold at one Gold a tap). |
| **28–29** | `Highlands` · `PutToSea` | **Scaling Tools** and **Sailing** — mountains and water become explorable. Both hang off Cartography. |
| **30–32** | `ArmedMen` · `Mustered` · `FirstSoldier` | **Warrior → Barracks → the first soldier.** The Barracks needs 20 Stone, tapped by hand from the rock outcrop; the Quarry is quest 35. |
| **33** | `FirstSummon` | **Summon at the banner. The first call is free.** |
| **34** | `IntoTheDark` | **Survive one depth** of the Hollow Barrow. |

- **Quests 35–50:** the Quarry, Urban Planning, Townhall 3 and Mining, then
  Attunement, the Sanctum, a warband, the first full ruin clear, attuning a
  relic, four landmarks, depth five, and three relics held at once.

### 2.1 The opening economy

- A new kingdom starts with **50 Gold** and **500 Gems**.
- Quest 1's four forest cells cost ~16 Gold; Forestry costs 25; quest 1 pays
  10 Gold. 50 + 10 covers both, **asserted at the dearest frontier the player
  could pick**.
- Forest cells refuse work until Forestry is researched; the refusal names
  Forestry.
- A pull costs 1,000 Gems. The first call on the standard banner is free,
  tracked on the pity counter.
- The Market beats (`Trade` · `ToMarket` · `Merchant`) sit at quests 15–17 and
  pay 100 / 110 / 120 Gold. The Market's Gold sink is
  [`16-wonders.md`](16-wonders.md).
- Numbers the opening fixes elsewhere:
  - a crop plot costs **10 Wood**;
  - the first chop asks for **25 Wood** (a roof and a plot);
  - a level-1 House holds **2**, so the second villager needs no second roof;
  - Townhall L1→L2 costs **60 Wood**, no Stone (the Quarry is quest 35).
- The opening is played through the real sim with **no funding at all** — only
  what the game grants and what it earns.

### 2.2 Gems and Stardust

- **Gem rewards sit in four quests** — 20, 34, 42 and 50 —
  150 + 150 + 250 + 200 = 750.
- With the 500 grant and 2,500 from five ruin first-clears: **3,750 by play**,
  which reaches the second builder (2,500) and a pull
  ([`14-monetization.md`](14-monetization.md) §2.2). Later rungs come from the
  daily chest (~one a month) or a wallet.
- A player who stops at quest 34 holds 800 Gems — a Mana refill.
- **Stardust appears on exactly four goal types** — `ClearRuins`, `ReachDepth`,
  `OwnArtifacts`, `OwnHeroes`. Every other quest pays Gold.

## 3. The daily chest

### 3.1 The ladder

- **The ladder advances on days PLAYED, never on calendar days.** Step 1 the
  first day the game is opened, step 2 the second day it is opened, whatever
  the gap.
- **Missing a day costs that day's chest** and nothing else. The ladder never
  resets.
- No *streak repair* purchase.

### 3.2 Rewards

| Step | Reward |
|---|---|
| 1 · 2 | Mana, ~⅓ of the pool |
| 3 | Mana, ~½ pool |
| 4 | Mana ~⅓ + a Gold sum |
| 5 | Mana, ~½ pool |
| 6 | Mana, ~⅓ pool |
| **7 · week marker** | **a full pool + 250 Gems** |
| 8+ | the same seven-step cycle, repeating |

- Mana amounts are **fractions of the cap**, not absolute numbers.
- The Gold step is **priced in seconds of the city's own tax income**, with an
  authored floor.
- The week marker pays ~1,000 Gems a month: the game's recurring Gem faucet.

### 3.3 The pill

- **The chest is a pill, not a modal, and it never opens itself.**
- A chest not claimed before the session ends is lost.

### 3.4 Rollover

- **The rollover is UTC.**
- **A missed day is never paid retroactively.** One claim per day, no backlog.
- The ladder shows the rungs behind the player lit, not greyed. There is no
  countdown on the sheet.

## 4. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Mana ladder | seven steps, fractions of the cap | `daily.mana_fractions` |
| Week-marker Gems (also the recurring Gem faucet) | 250 | `daily.gems` |
| The Gold step | seconds of tax income, with a floor | `daily.gold_seconds` / `daily.gold_floor` |
| The chain | row order is chain order | `Quests` sheet |

## 5. Acceptance

- A player who has completed every authored quest opens the game on day 15 and
  **has a chest waiting**.
- The ladder survives a two-week absence at the step it reached.
- The opening is played through the real sim with **nothing granted** and
  reaches the end of the authored chain without a dead end.
- No new goal type was added to the union.

## 6. Deliberately not in this design

- A streak that can be lost.
- A chest that opens itself.
- A second quest chain.
- Branching quests.
- **Generated orders** — daily fetch-quests in a Market tab. The open-ended
  Gold sink is [`16-wonders.md`](16-wonders.md) §1; a sink never pays back
  what it asked for ([`16-wonders.md`](16-wonders.md) §3.1). An order reroll
  as an ad placement or pass reward ([`14-monetization.md`](14-monetization.md))
  goes with them.

**Open questions:** OQ-47, OQ-53. Moot with generated orders: OQ-16, OQ-17.
