# 12 · Quests and onboarding

> **Scope.** The single quest chain and the first-user experience it
> authors.
>
> **Status: built** (`sim/quests.ts`, `quests.json`).

## 1. The quest chain

- **One chain, one active quest at a time.** List order in `quests` is chain
  order, reordered by dragging.
- Completing a quest lights the pill's **Claim**. Claim pays the reward and
  activates the next quest. The pill disappears when the chain ends.
- **A quest that arrives already done** unrolls on its running face, empty;
  its bar and count fill to the goal (~1 s), then it turns to Claim with the
  completion sound. Before that, a tap points at the goal rather than claiming.
- **89 quests**, paying 21,495 Gold, 30 Wood, 230 Stone, 180 Food, 130 Mana,
  750 Gems, 120 Stardust, **35 Knowledge across 21 of them** (§2.1), **one
  relic fragment**, and Bag items on 26 of them.
- A reward is any of:

| Field | Pays |
|---|---|
| `reward` | Gold, Wood, Stone, Food, into the city purse |
| `rewardMana` | Mana; may overfill the pool |
| `rewardGems` | Gems, into the player purse |
| `rewardStardust` · `rewardKnowledge` | into the kingdom purse; Knowledge lands as a lump, over the bar's cap |
| `rewardFragments` | relic fragments, rolled among the relics already met ([`09-relics.md`](09-relics.md)) |
| `rewardItems` | Bag items — chests, speed-ups, boosts, flasks ([`03-economy.md`](03-economy.md)) |

- **The pill wears a mark for its goal**, an atlas icon:

| Goal | Mark |
|---|---|
| Collect / Hold a resource | that resource |
| Build / Repair / Upgrade / Work in reach | that building; a group by its use — decoration: Harmony, workshop: anvil, military hall: shield, producer: hammer |
| Complete tech(s) | research |
| Reach population · Assign workers · Train army | population · workers · shield |
| Collect taps | the pointing hand |
| Discover cells · Discover feature | a fog tile · what the feature is: a tree, or what tapping it pays |
| Find lairs · Clear lairs | the lair mouth · crossed swords |
| Claim landmarks | the standing stones; a Leyspring: Mana; the Watchtower: itself |
| Own relics · Own heroes | relics · the heroes' helmet |

### 1.1 Goal types

- **Absolute** goals are predicates over current state (*have 2 Housing*,
  *Townhall at level 2*, *10 Wood in stock*). Work done before activation
  counts; the quest completes on activation.
- **Relative** goals count events from activation only (*collect 30 Gold*,
  *find 4 forests*).

| Absolute | Relative |
|---|---|
| BuildDistrict · RepairDistrict · UpgradeDistrict · HoldResource · ReachPopulation · CompleteTech · CompleteTechs · AssignWorkers · WorkInReach · TrainArmy · ClaimLandmarks · FindLairs · ClearLairs · OwnArtifacts · OwnHeroes · DiscoverCells | CollectResource · CollectTaps · DiscoverFeature |

- **A quest may claim itself** (`autoClaim`) the moment it is done, its reward
  paid as a tap would. `Woodcraft` does.
- **A Gold quest may rush the first house's rent** (`tutorialRentSeconds`):
  that many seconds after the quest becomes active, the first house's store is
  topped up with the Gold the goal still asks. The real rent goes on beside
  it. `TaxDay` does, at 3 seconds. It is a timer like any other (invariant 1).
- **`BuildDistrict` counts a building the moment its build starts**: a build
  cannot be cancelled. What needs the building standing waits for it on its
  own.
- **`RepairDistrict` asks for an abandoned building** — *repair the old farm*
  — and counts as `BuildDistrict` does: a building of its kind, however it
  came. Its hint points at the ruin
  ([`01-map-and-fog.md`](01-map-and-fog.md) §6.3). The Watchtower's repair is
  `TheWatchtower`.
- **`UpgradeDistrict`** counts buildings of a kind at `goalLevel` or above.
- **`DiscoverCells` is a total** — *clear the fog from 30 tiles in all* — the
  same count the chapter bars read.
- A `collect` counts when units reach the wallet — a tap on the ground, or
  collecting a building's store ([`03-economy.md`](03-economy.md) §3.2) —
  never when rent accrues or a haul lands.
- **`FindLairs` counts lairs found**, cleared or not — a lair is found when a
  cell of its zone is revealed. The hint points at the dark cell nearest the
  ground of the nearest lair not yet found.
- **`ClaimLandmarks` may name a landmark kind** — *Claim the standing stones*
  — or none, for any landmark.
- **`WorkInReach`** counts, for the best-placed building of its kind, the
  revealed cells its crew works from where it stands. The hint opens the
  building and lights its **Move**.
- **`DiscoverFeature`** counts the reveals that uncover a given feature, from
  activation, at the reveal. The hint points at a dark cell that has the
  feature, or with none in sight at the nearest frontier cell.
- **A goal may name a group** (`AnyDecoration`): the player picks the piece.
- **Goal types are code; goals are data.**
- **A quest's line is rendered from its goal, never written**
  (`sim/questProse.ts`). Each entry carries a `name` — flavour, *Timber!*,
  *Tax day* — and the tracker's sentence is generated from `goalType`,
  `goalTarget`, `goalAmount` and `goalLevel`.
- **The tracker holds 44 characters**; the generated lines stay within it.

## 2. The chain, act by act

- **Quest number is beat number.** The arc is asserted in
  `tests/quests.test.ts`, and the opening is **played** through the real sim
  in `tests/onboarding.test.ts`.
- The First Morning's scripted beats ride on quests 1–7, and the lessons on
  the quests after them ([`23-tutorials.md`](23-tutorials.md) §3); the doors
  each act opens are [`22-progression.md`](22-progression.md) §3.

| # | Quests | The beat | Opens |
|---|---|---|---|
| **1–7** · the First Morning | `FirstSteps` · `Woodcraft` · `Timber` · `ARoof` · `Rations` · `FirstVillager` · `TaxDay` | four forest cells and the first treasure, Forestry, 25 Wood, **the old House repaired**, Food, a villager, rent | Research, Knowledge |
| **8–14** · the old fields | `Explorer` · `FirstPlot` · `ByHand` · `Lumber` · `Farmhand` · `Fieldside` · `ToWork` | 30 cells cleared, **the two old plots repaired**, Food by hand, 30 Wood held, **the old Farm repaired**, **the Farm moved beside both plots**, a worker | |
| **15–20** · the village | `SecondVillager` · `GrowingTown` · `Neighbors` · `TheSawmill` · `Crewed` · `ProperCapital` | a second villager and a Wood chest, **a second House, the first one built**, three villagers, **the old Sawmill repaired**, three workers, **Townhall 2** | the Bag; **Build**; the Store and the Survey |
| **21–31** · the second Townhall's town | `MoreRoofs` · `Fields` · `FreshFurrows` · `NewFaces` · `Tillage` · `BiggerBarn` · `SawTeeth` · `TwoSaws` · `ManyHands` · `Pride` · `PrettyCorner` | a third House, Agriculture, four crop plots, five villagers, Farming, **the Farm to level 2**, Saws, **a second Sawmill**, five workers, Village Pride, **two decorations** | |
| **32–36** · tending the land | `Levies` · `Sawpits` · `FourRoofs` · `Regrowth` · `FurtherAfield` | Trade Routes I, Sawpits I, a fourth House, Reforesting I, 80 cells cleared | |
| **37–44** · the Orcs | `WarDrums` · `ArmedMen` · `Mustered` · `SharperSaws` · `FirstSoldier` · `FullHouse` · `MusterCompany` · `DriveThemOut` | **a lair found**; Warrior, the Barracks, **the Sawmill to level 2**, a soldier, eight villagers, a company of 30, **the first fight** | the first relic fragment and **Relics** |
| **45–48** · past the hills | `TheWatchtower` · `Attuned` · `Mapmakers` · `Surveyors` | **the Watchtower repaired** with the lens the Orcs carried — a scene forces it — Consecration, 90 and 120 cells cleared | **the world**, **the Atlas** |
| **49–58** · stone | `Watered` · `Fallow` · `Lamplight` · `MoreRoom` · `Picks` · `Rubble` · `SecondStory` · `UpperFloors` · `Chisels` · `Stoneworks` | Irrigation I, Crop Rotation I, four decorations, Urban Planning; **Pickaxes and 20 Stone**, just before the first upgrade that costs it — Housing L2, then **four Houses at level 2**; Masonry, the Quarry | |
| **59–64** · the Tavern | `Crafts` · `Knack` · `DeeperCuts` · `Hearth` · `OpenDoors` · `FirstSummon` | Granaries I, Carpentry I, **the Quarry to level 2**, Hospitality, the Tavern, the first hero — the free first call | **Heroes**, the banner, **the Sagas** |
| **65–69** · the town | `IronRoad` · `Deft` · `Fellowship` · `Architect` · `GrandCapital` | 30 Stone, Schooling I, two heroes, Bureaucracy, **Townhall 3** | |
| **70–85** · the borough | `SixRoofs` · `SecondFarm` · `DeepSeams` · `Civic` · `Finery` · `TheSanctum` · `ThirdSaw` · `AWarband` · `TheBarrowsPrize` · `PutToSea` · `StoriedStreet` · `Cartographers` · `SecondQuarry` · `Magistrate` · `Township` · `Borough` | six Houses, **a second Farm**, Mining, Civic Pride, six decorations, the Sanctum, **a third Sawmill**, sixty soldiers, a second landmark, Sailing, **six Houses at level 2**, 160 cells cleared, **a second Quarry**, Magistracy, twelve villagers, **Townhall 4** | |
| **86–89** · the world | `NineRoofs` · `Leylines` · `SecondLair` · `DeeperStill` | nine Houses, three landmarks, a second lair cleared — the Harpies — a hundred soldiers | |

- **The city grows in the chain.** Each Townhall level is followed by its
  city: the Houses it allows, the people they hold, one more level on each
  producer — never more than two quests of research or of the frontier in a
  row before the city asks again.
- **The fog's buildings come first, the player's own after.** The House, the
  plots, the Farm and the Sawmill of the opening are abandoned ones, found and
  repaired ([`01-map-and-fog.md`](01-map-and-fog.md) §6.3); the technology
  that unlocks building more of each comes after Townhall 2.
- **A requirement is the row above**, so the chain asks for the cards a
  target needs before the target (`Watered` before Urban Planning; `Crafts`,
  `Knack` and `Deft` before Bureaucracy).
- **Every lair and landmark the chain names is inside the Townhall's reach**
  when it asks (`tests/quests.test.ts`): the Harpies wait for Townhall 4.

### 2.1 The opening economy

- A new kingdom starts with **100 Gold** and **500 Gems**, and **no Knowledge
  at all** (`economy` › `initialCurrencies`, `currencies` › `start`).
- **The chain funds the research it asks for, through `Attuned` (quest 46).**
  Up to it, every research quest is affordable from what the chain has paid,
  **with no drip at all**, and the quest just before each research quest pays
  at least that card's Knowledge, prerequisites included — quest 1 pays
  Forestry's 2. The quest before `Picks` pays Pickaxes' Knowledge too.
- **Past `Attuned` the drip is the funding** ([`07-research.md`](07-research.md)
  §3); the chain's later Knowledge is on top. Of the 35, 26 are paid by
  quest 46.
- **Four tapping beats pay Mana instead of Gold** — `Timber`, `Rations`,
  `ByHand` and `Rubble`, 30 · 30 · 40 · 30. Mana may overfill.
- Quest 1's first reveal sets the first treasure beside it, **20 Gold**
  ([`01-map-and-fog.md`](01-map-and-fog.md) §6.2).
- **Forestry costs 20 Gold and 2 Knowledge**; quest 1 pays 10 Gold and the
  2 Knowledge. The starting 100 and quest 1's 10 cover the four forest cells
  and Forestry, **asserted at the dearest frontier the player could pick**.
- Forest cells refuse work until Forestry is researched; the refusal names
  Forestry.
- The first call on the standard banner is free, **and it is always a hero**;
  **the first two calls are each a new hero** (`heroLadder` ›
  `firstCallsNewHero`), so `Fellowship` never waits on a roll
  ([`22-progression.md`](22-progression.md) §6).
- Numbers the opening fixes elsewhere:
  - a crop plot and a level-1 House each cost **15 Gold + 10 Wood**;
  - a level-1 House holds **2**, so the second villager needs no second roof;
  - Townhall L1→L2 costs **99 Gold + 66 Wood**, no Stone (the Quarry is
    quest 58).
- The opening is played through the real sim with **no funding at all** — only
  what the game grants and what it earns.

### 2.2 Gems and Stardust

- **Gems sit in four quests** — `ProperCapital`, `GrandCapital`, `Borough` and
  `SecondLair` — 150 + 250 + 200 + 150 = 750; with the 500 grant, **1,250 by
  the chain**.
- **Stardust is paid only past the first summon** — `FirstSummon` 20,
  `Fellowship` 25, `TheBarrowsPrize` 20, `SecondLair` 25, `DeeperStill` 30.

## 3. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| The chain | list order is chain order | `quests` |
| A quest's goal | type, target, amount, level | `goalType` · `goalTarget` · `goalAmount` · `goalLevel` |
| A quest's reward | §1 | `reward` · `rewardMana` · `rewardGems` · `rewardStardust` · `rewardKnowledge` · `rewardFragments` · `rewardItems` |
| Claims itself | `Woodcraft` | `autoClaim` |
| The rent rush | `TaxDay`, 3 s | `tutorialRentSeconds` |

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

**Open questions:** **OQ-53**.
