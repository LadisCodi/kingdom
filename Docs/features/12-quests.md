# 12 · Quests and onboarding

> **Scope.** The single quest chain and the first-user experience it
> authors.
>
> **Status: built.**

## 1. The quest chain

- **One chain, one active quest at a time.** List order in `quests`
  is chain order, reordered by dragging.
- Completing a quest lights the pill's **Claim**. Claim pays the reward and
  activates the next quest. The pill disappears when the chain ends.
- **68 quests**, paying 15,505 Gold, 210 Stone, 180 Food, 130 Mana,
  750 Gems, 120 Stardust, **21 Knowledge across thirteen of them** (§2.1) and
  **one card pack**.
- A reward may carry a **card pack** (`rewardPack`); the first fight's is the
  kingdom's first pack ([`22-progression.md`](22-progression.md) §7).

### 1.1 Goal types

- **Absolute** goals are predicates over current state (*have 2 Housing*,
  *Townhall at level 2*, *10 Wood in stock*). Work done before activation
  counts; the quest completes on activation.
- **Relative** goals count events from activation only (*collect 30 Gold*,
  *find 4 forests*). They hook the sim's collect, tap and reveal paths.
- **A quest may claim itself** (`autoClaim`) the moment it is done, its
  reward paid as a tap would: for a quest whose next step the player is
  already reaching for. `Woodcraft` does — the player wants the axe, not the
  scroll, and the First Morning has shown the scroll already.
- **A Gold quest may rush the first house's rent** (`tutorialRentSeconds`), a
  tutorial pacing hack: that many seconds after the quest becomes active, the
  first house's store is topped up with the Gold the goal still asks. The real
  rent goes on beside it. `TaxDay` does, at 3 seconds — its rent would
  otherwise take half a minute.
- **`BuildDistrict` counts a building the moment its build starts.** A build
  cannot be cancelled, so it is the player's from then; the quest does not
  wait for the scaffold. What needs the building *standing* — its workers, a
  villager's roof — waits for it on its own.
- **`RepairDistrict` asks for an abandoned building** — *repair the old
  farm* — and counts as `BuildDistrict` does: a building of its kind,
  however it came. Its 🔍 points at the ruin
  ([`01-map-and-fog.md`](01-map-and-fog.md) §6.3).
- **`DiscoverCells` is a total** — *clear the fog from 32 tiles in all*, the
  same count the book bands read. A player who cleared everything in reach
  before the quest arrived is never stuck behind it.
- A `collect` counts when units reach the wallet — a tap on the ground, or
  collecting a building's store ([`03-economy.md`](03-economy.md) §3.2) —
  never when rent accrues or a haul lands.

| Absolute | Relative |
|---|---|
| BuildDistrict · RepairDistrict · UpgradeDistrict · HoldResource · ReachPopulation · CompleteTech · CompleteTechs · AssignWorkers · WorkInReach · TrainArmy · ClaimLandmarks · FindLairs · ClearLairs · OwnArtifacts · OwnHeroes · DiscoverCells | CollectResource · CollectTaps · DiscoverFeature |

- **`FindLairs` counts lairs found**, cleared or not — a lair is found when a
  cell of its zone is revealed. The chain asks for it before any military
  research, so the soldiers have a reason.
  - The hint points at the dark cell nearest the ground of the nearest lair
    not yet found.
- **`ClaimLandmarks` may name a landmark kind** — *Claim the standing stones* —
  and names none for any landmark.
- **`RepairDistrict` counts a building however it came to stand** — the
  Watchtower's repair is `TheWatchtower`.

- **Goal types are code; goals are data.** A new type is a code change; a new
  quest is an entry.
- **A quest's line is rendered from its goal, never written.** Each `quests`
  entry carries a `name` — flavour, *Timber!*, *Tax day* — and no description;
  the sentence the tracker shows is generated from `goalType`, `goalTarget`
  and `goalAmount`, the way a technology's card is generated from what it
  unlocks. So a rebalance updates its own prose, and a new goal type owes one
  phrase rather than 53 rewrites.
- **The tracker holds 44 characters**, and that is the whole budget: it is the
  only place a quest's line is ever shown. The generated lines top out at 30.
- **`WorkInReach`** counts, for the best-placed building of its kind, the
  revealed cells its crew works from where it stands: `Fieldside` asks the
  old Farm to be moved beside both old plots. The hint opens the building
  and lights its **Move**.
- **`DiscoverFeature`** counts the reveals that uncover a given feature,
  from activation — at the reveal, because a finite feature (a berry bush)
  leaves the map when it is used up.
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
| **1–7** · the First Morning | `FirstSteps` · `Woodcraft` · `Timber` · `ARoof` · `Rations` · `FirstVillager` · `TaxDay` | four forest cells and the first treasure, Forestry, 25 Wood, **the old House repaired**, Food, a villager, rent | Research, Knowledge |
| **8–14** · the old fields | `Explorer` · `FirstPlot` · `ByHand` · `Lumber` · `Farmhand` · `Fieldside` · `ToWork` | 30 cells cleared, **the two old plots repaired**, Food by hand, 30 Wood held, **the old Farm repaired**, **the Farm moved beside both plots**, a worker | |
| **15–20** · the village | `SecondVillager` · `GrowingTown` · `Neighbors` · `TheSawmill` · `Crewed` · `ProperCapital` | a second villager (the first House full), **a second House, the first one built**, three villagers, **the old Sawmill repaired**, three workers, **Townhall 2** | **Build**; the Store and the Survey |
| **21–26** · building our own | `Fields` · `Tillage` · `SawTeeth` · `Levies` · `Sawpits` · `Regrowth` | Agriculture, Farming, Saws — more of what the fog kept — then Trade Routes I, Sawpits I, Reforesting I | |
| **27–33** · the Orcs | `FurtherAfield` · `WarDrums` · `ArmedMen` · `Mustered` · `FirstSoldier` · `MusterCompany` · `DriveThemOut` | 80 cells cleared — the Townhall 2 ring clears 64 — then **a lair found**; Warrior, the Barracks (built of Wood), a soldier, a company of 30, **the first fight** | the first pack and **Relics** |
| **34–37** · past the hills | `TheWatchtower` · `Attuned` · `Mapmakers` · `Surveyors` | **the Watchtower repaired** with the lens the Orcs carried — a scene forces it — Consecration, 90 and 120 cells cleared | **the world door**, **the Atlas**, **Magic** |
| **38–45** · stone | `Watered` · `Fallow` · `MoreRoom` · `Picks` · `Rubble` · `SecondStory` · `Chisels` · `Stoneworks` | the rows above Urban Planning; **Pickaxes and 20 Stone**, just before the first upgrade that costs it — Housing L2; Masonry, the Quarry | |
| **46–50** · the Tavern | `Crafts` · `Knack` · `Hearth` · `OpenDoors` · `FirstSummon` | the rows above Hospitality, the Tavern, the first hero — the free first call | **Heroes**, the banner, **the Sagas** |
| **51–58** · the town | `FullHouse` · `IronRoad` · `Deft` · `Fellowship` · `Architect` · `GrandCapital` · `DeepSeams` · `TheSanctum` | eight villagers, Stone, Quick Hands I, two heroes, Bureaucracy, **Townhall 3**, Mining, the Sanctum | |
| **59–65** · the borough | `AWarband` · `TheBarrowsPrize` · `PutToSea` · `Cartographers` · `Magistrate` · `Township` · `Borough` | sixty soldiers, a second landmark, Sailing, 160 cells cleared, Magistracy, twelve villagers, **Townhall 4** | |
| **66–68** · the world | `Leylines` · `SecondLair` · `DeeperStill` | three landmarks, the Harpies, a hundred soldiers | |

- **The fog's buildings come first, the player's own after.** The House, the
  plots, the Farm and the Sawmill of the opening are abandoned ones, found
  and repaired ([`01-map-and-fog.md`](01-map-and-fog.md) §6.3); the
  technology that unlocks each comes after Townhall 2 and opens building
  more. A repair counts for a goal that asks for that building.
- **A requirement is the row above**, so the chain walks the rows it needs
  (`Watered` and `Fallow` before Urban Planning, `Crafts` and `Knack` before
  Hospitality) rather than pointing past cards the player cannot start.
- **Every lair and landmark the chain names is inside the Townhall's reach**
  when it asks (`tests/quests.test.ts`): the Harpies wait for Townhall 4.

### 2.1 The opening economy

- A new kingdom starts with **100 Gold** and **500 Gems**, and **no Knowledge
  at all**. The first frontier cells cost 3 and 5 Gold
  ([`01-map-and-fog.md`](01-map-and-fog.md) §5); below about 60 Gold a player
  who spends on the border before raising a roof has no rent coming and no
  way back.
- **The chain funds the research it asks for, through the opening only.**
  In the opening **only the quest just before a research quest pays
  Knowledge, and exactly that card's Knowledge**, prerequisites included —
  Quest 1 pays Forestry's 2. Every card the chain demands up to `Attuned` —
  quest 35, Consecration — is affordable **with no drip at all**, and nothing
  piles up: what a player banks beyond the next card comes from the drip.
- **Past `Attuned` the chain stops paying and the clock takes over**
  ([`07-research.md`](07-research.md) §3). The zero-drip guarantee is
  asserted for the opening and **only** the opening (`tests/quests.test.ts`);
  the cut is by chain position, not by era — `MoreRoom` asks for an era-1
  card at quest 40, past it.
- **Three opening beats pay Mana instead of Gold** — `Timber`, `Rations` and
  `ByHand`, 30 · 30 · 40 (and `Rubble`, 30, later). They are the tapping beats, and the pool is what the
  opening is short of, not coin: a reward that buys taps arrives exactly where
  the player has just emptied it. Mana may overfill; an overcharged pool is a
  supported state and reads as one on the gauge.
- Quest 1's first reveal sets the first treasure beside it, **20 Gold**
  ([`01-map-and-fog.md`](01-map-and-fog.md) §6.2); revealing its cell is one
  more cell, and `ARoof` asks for another, the old House's.
- Quest 1's four forest cells cost ~16 Gold; **Forestry costs 20 Gold** and
  2 Knowledge, which is exactly the Knowledge quest 1 pays alongside its
  10 Gold. The 100 and quest 1's 10 cover the cells and Forestry, **asserted
  at the dearest frontier the player could pick**.
- Forest cells refuse work until Forestry is researched; the refusal names
  Forestry.
- The first call on the standard banner is free, **and it is always a hero**
  ([`22-progression.md`](22-progression.md) §6).
- **The first two calls, on either banner, are each a new hero**
  (`heroLadder` › `firstCallsNewHero`), so `Fellowship` never waits on a roll.
- The three research beats at 24–26 (`Levies` · `Sawpits` · `Regrowth`) pay
  80 / 90 / 90 Gold, so each funds the card the next one asks for.
- Numbers the opening fixes elsewhere:
  - a crop plot costs **15 Gold + 10 Wood**;
  - the first chop asks for **25 Wood** (a roof and a plot);
  - a level-1 House holds **2**, so the second villager needs no second roof;
  - Townhall L1→L2 costs **99 Gold + 66 Wood**, no Stone (the Quarry is quest 45).
- The opening is played through the real sim with **no funding at all** — only
  what the game grants and what it earns.

### 2.2 Gems and Stardust

- **Gem rewards sit in four quests** — `ProperCapital`, `GrandCapital`,
  `Borough` and `SecondLair` — 150 + 250 + 200 + 150 = 750.
- With the 500 grant: **1,250 by the chain**. The second builder (2,500)
  and later rungs ([`14-monetization.md`](14-monetization.md) §2.2) come from
  the Survey or a wallet.
- **Stardust is paid only past the first summon** — `FirstSummon`,
  `Fellowship`, `SecondLair`, `TheBarrowsPrize`, `DeeperStill` — where the
  hero ladder it buys is open.

## 3. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| The chain | list order is chain order | `quests` |

## 4. Acceptance

- The opening is played through the real sim with **nothing granted** and
  reaches the end of the authored chain without a dead end.

## 5. Deliberately not in this design

- **A login ladder.** Coming back tomorrow is the stores and the Mana well
  filled overnight; the one ladder pays for exploring
  ([`25-the-survey.md`](25-the-survey.md)).
- A second quest chain. Branching quests.
- **Generated orders**, daily or weekly missions, or any recurring generated
  ask.

**Open questions:** OQ-47, OQ-53.
