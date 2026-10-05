# Tech tree rework — chapters, not ladders

> **Scope.** A plan to reshape the research tree (`src/sim/data/tech-tree.json`)
> after Elvenar's: one chapter per Townhall level, a short main path in each,
> every card opening something concrete, and a Knowledge price that fits what
> the target player earns. The system — pouring, the bar, instant completion —
> stays as it is ([`../features/07-research.md`](../features/07-research.md)).
>
> **Status.** Proposal, 2026-10-05. Nothing built. Open decisions in §7.

## 1. What is there today

- **167 cards in five books.** Civics 75 · Warfare 40 · Magic 28 · Atlas 13 ·
  Sagas 11.
- **116 are `bonus` cards (69%)**, 42 `unlock`, 9 `mechanic`.
- **Most bonuses are +5–20% ladders** of one stat, repeated across eras:
  `harvestYield` 18 cards, `unitAtk` 7, `unitDef` 6, `manaCap` 6, `taxRate` 5,
  `armyCap` 5, `manaRegen` 5, `knowledgeYield` 5. Civics alone carries 21
  ladder stems.
- **The shape is a funnel.** Each band ends in one card that requires the
  whole row above it, so everything above is mandatory:
  - `Bureaucracy` (TH3) needs 20 cards · 32 K · 2,430 Gold.
  - `Magistracy` (TH4) needs **every card in Civics eras 1 and 2**: 42 cards ·
    113 K · 21,180 Gold.
- **Tapping cards sit on the main path.** `Bureaucracy` requires `TapPowerI`
  and `QuickHandsI`. `Magistracy` also needs `TapPowerII` and `QuickHandsII`.
- **TH5–TH10 have no technology gate.** Goods and villagers gate them instead,
  so after Magistracy the tree paces nothing the Townhall needs.
- **Bands open on revealed cells**: Civics 0 · 43 · 100; Warfare 0 · 85 · 100 ·
  220; Magic 0 · 30 · 100 · 220; Sagas 0 · 100; Atlas 0 · 220.

### 1.1 Cards that are noise or no longer relevant

| Group | Cards | Why |
|---|---|---|
| **The thumb** | `TapPowerI`–`IV`, `QuickHandsI`–`III` | the tap is no longer a lever worth a research |
| **The Mana pool** (the tap budget) | `Meditation`, `DeepWellsI`–`V`, `LeyTapsI`–`V` | 11 cards on one number; the Sanctum's own levels already raise it (`mana.sanctumCapPerLevel`) |
| **Regrowth** | `CropRotationI`–`II`, `ReforestingI`–`II` | 10% off a 60–90 s stump |
| **Mountains** | `TerracingI`, `StonecuttingI`–`III`, `IronPicksI`–`III`, `GoldPanningI`–`II` | yield ladders on ground that no longer runs out; Terracing was regrowth until 2026-10-05 |
| **Stores** | `GranariesI`–`III` | a store is sized by building level (03-economy §3.2); OQ-108 says nothing else raises it |
| **Crew micro** | `WorkerLoadI`–`III`, `CartageI`–`III`, `Roadworks` | a producer's late levels already add units per delivery |
| **Yield %** | `IrrigationI`–`III`, `SawpitsI`–`III`, `ButcheryI`–`II`, `BigNetsI` | the building's level is the production ladder |
| **Army %** | `WarhornsI`–`IV`, `ShieldWallI`–`III`, `FletchingI`–`III`, `BardingI`–`III`, `VigourI`–`III`, `ColoursI`–`V`, `DrillYardsI`–`III`, `BedsI`–`III` | 25 small ranks; the halls' levels already raise the cap |
| **Knowledge lumps %** | `ScriptoriumI`–`V`, `WaypostsI`–`IV`, `BountiesI`–`IV` | they make the Knowledge budget hard to predict |
| **Planned, no effect** | `Invocation`, `LeyReading`, `LeyStorm`, `Rumours` | researchable, but they do nothing yet |

That is roughly **110 cards** that are noise, irrelevant, or do nothing.

## 2. Elvenar's shape

From memory; the details marked *unsure* should be checked against the game.

- **One tree, in chapters.** Chapters I–II are the base. From III each chapter
  brings a guest race with its own goods and buildings. A chapter is a few
  dozen technologies (*unsure*: ~20–40), read left to right.
- **Two or three lanes that split and rejoin.** There is a main path to the
  chapter's last card. Some cards are optional, mostly military upgrades and
  some culture buildings (*unsure* which exactly).
- **The last card opens the next chapter**, alongside the chapter's own quest
  steps (*unsure*: guest-race chapters also ask for an embassy and quests).
- **Every card opens something you can see**: a building, a building's next
  upgrade level, an expansion slot, a new unit or a unit upgrade, a feature.
  Pure percentage bonuses are rare. Production grows through building levels
  and culture, not research.
- **Knowledge Points: 1 an hour, at most 10 held.** Extra KP comes from
  tournaments, events, quests and buying. Buying costs coins and supplies, at
  a price that climbs (*unsure* how it resets).
- **A card costs KP plus coins and supplies**, and in later chapters goods.
  Research is the main sink for the basic resources.

What we take from it:
- one chapter per era;
- a main path plus a few optional cards;
- every card opens something;
- bonuses are rare;
- the KP total is budgeted per chapter.

## 3. The target shape

### 3.1 Chapters are Townhall levels

- **Nine chapters, one per Townhall step**: chapter *n* runs from Townhall *n*
  to *n+1*.
- **Each chapter ends in a finale card that unlocks the next Townhall level**,
  TH5–TH10 included. The Townhall row's `requiredTechPerLevel` comes from the
  finale's `unlocks`, a dropdown as today.
- **A chapter opens when the Townhall reaches its level** (decision D3). Its
  cards cannot be started before that.
- **Main path ≈ 70% of the chapter's KP; optional cards the rest.** Lanes
  split and rejoin; no card asks for a whole row.

### 3.2 The Knowledge budget per chapter

Assumptions for the target player (three visits a day at 8:00, 14:00 and
21:00):
- The bar pays about **23 KP a day** (10 overnight, 6 and 7 during the day).
- Lumps (landmarks, lairs, quests) add about 2 a day on average.
- The opening quests pay 28.

| Chapter | Townhall | Days (target) | KP earned | Main path | Optional |
|---|---|---|---|---|---|
| 1 | 1 → 2 | day 1 | ~28 (quests) | 20 | 8 |
| 2 | 2 → 3 | day 1 → 2 | ~25 | 18 | 7 |
| 3 | 3 → 4 | 2 → 5 | ~75 | 50 | 25 |
| 4 | 4 → 5 | 5 → 7 | ~50 | 35 | 15 |
| 5 | 5 → 6 | 7 → 10 | ~75 | 50 | 25 |
| 6 | 6 → 7 | 10 → 14 | ~100 | 70 | 30 |
| 7 | 7 → 8 | 14 → 20 | ~150 | 105 | 45 |
| 8 | 8 → 9 | 20 → 24 | ~100 | 70 | 30 |
| 9 | 9 → 10 | 24 → 30 | ~150 | 105 | 45 |
| | | | **~750** | **~525** | **~225** |

- Today's tree prices **1,265 K** in total, and TH4 asks for 113 K by day 5
  against ~120 earned. That only works if every point goes to Civics.
- Knowledge bought with Gold (`knowledge.goldPrice*`) is the **engaged
  player's valve**: it turns a Gold surplus into a faster chapter. The
  measurement bot never bought any; the pacing runs must (§6, P5).

### 3.3 What a chapter holds

Eight to ten cards, each opening one thing:

| Slot | Opens | Example |
|---|---|---|
| a **new building** | `district` | Quarry, Smelter, Stables |
| **Housing's next level** | `district` + level | Housing L3 |
| **the producers' next level** | one card opens it for Sawmill, Quarry, Farm and Docks together | "Timber Framing": producers L3 |
| **the halls' next level** | `district` + level, all four halls | `WarbandII` as today |
| **a unit, or a unit upgrade** | `unit`; an upgrade is a new unlock kind (§5) | Archer; Veteran Warriors |
| **one more of a building** | the existing *one more* unlock | Second Sanctum |
| **a world/Atlas step** | explorer slot, reveal radius | Scouts, Pathfinding |
| *(optional)* **one strong bonus** | +10% tax, +1 resident, workshop speed | `Communities`, `TradeRoutes` |
| **the finale** | the next Townhall level | Bureaucracy, Magistracy, … |

- **About 80 cards in the general tree** (9 chapters × 8–10).
- **Sagas and Atlas stay found books**, 5 to 6 cards each.
- **Under 100 cards in total**, against 167 today.

## 4. Keep, merge, cut

- **Keep as unlocks, re-slotted into chapters**:
  - Civics: `Forestry`, `Agriculture`, `Farming`, `Hunting`, `Saws`,
    `Pickaxes`, `Masonry`, `UrbanPlanning`, `Hospitality`, `Bureaucracy`,
    `Mining`, `Magistracy`, `Joinery`, `StoneDressing`, `Aqueducts`,
    `TimberFraming`, `QuarryHoists`, `Architecture`, `Gardening`,
    `Sculpture`, `DeepMining`, `Paving`, `SacredGrounds`.
  - Warfare: `Warrior`, `Infirmary`, `Archery`, `Spears`, `WarbandII`,
    `Cavalry`, `WarbandIII`, `Tactics`, `WarbandIV`, `Muster`.
  - Magic: `Consecration`, `AttunementII`, `Sailing`, `Fishing`,
    `AttunementIII`, `Shipbuilding`, `SecondSanctum`, `AttunementIV`,
    `LeyLines`.
  - Sagas: `CommonRoom`, `GuestRooms`, `GreatHall`, `MinstrelsGallery`.
  - Atlas: `Cartography`, `ScoutsI`–`II`, `Pathfinding`.
- **Keep as the few optional bonuses**: `Communities`; `TradeRoutes` as 3
  ranks of +10% rather than 5 of +5%; `SchoolingI`–`II`, now that villager
  time climbs; `GuildHallsI`–`II`, since goods are the late friction.
- **Merge**:
  - the Warfare stat ladders → **one unit upgrade per unit**, spread over
    chapters 4–9 (4 to 8 cards);
  - `FarsightI`–`IV` → 2 ranks;
  - `TalesI`–`III` and `WarmWelcomeI`–`III` → 1 rank each.
- **Cut** (the §1.1 groups): every tap card, every Mana ladder, regrowth,
  mountain yields, Granaries, crew micro, yield %, the army % ladders except
  the merged upgrades, the Knowledge-lump %, and the four planned cards until
  they are built.
- **Tap cards: cut, with no replacement.** A tap stays at `tap.workSeconds`.
  Mana grows only with the Sanctum's levels.

## 5. What it needs beyond data

- **Data only** (`?dev=data#tree`): pruning, re-slotting, prices, chapters as
  bands, finales for TH5–TH10.
- **Code**:
  - a chapter that opens on a Townhall level rather than on revealed cells
    (`techTreeRules.ts`, `research.ts` `startTech`);
  - a *unit upgrade* `TechUnlock`, if the merged army cards are upgrades and
    not stats;
  - a materials price per card (D4).
- **Saves**: removed tech ids must be dropped on load. A bonus already
  researched is simply lost, unless D5 refunds it. This is a semantic change,
  so it gets a migrator and a `SAVE_VERSION` bump.
- **The quest chain** names technologies (`ResearchTech` goals; onboarding
  steps 20–25 research `Hunting`, `TradeRoutesI`, `SawpitsI`, `ReforestingI`).
  Those goals move to cards that survive.

## 6. Work plan

| Phase | What | Touches |
|---|---|---|
| **P1 · Prune** | Remove the tap, Mana, regrowth, Granaries and planned cards; rewire `requires` around them so `Bureaucracy` and `Magistracy` no longer pass through them; drop unknown ids on load. | `tech-tree.json` (tree editor), `save.ts` + migrator, `quests.json` goals, `tests/techTree.test.ts`, `tests/ladderEffects.test.ts`, `tests/onboarding.test.ts`, `tests/quests.test.ts` |
| **P2 · Chapters** | Nine chapters aligned to the Townhall; finale cards for TH5–TH10; KP and Gold per card from §3.2; chapters open on Townhall level (D3). | `tech-tree.json` (eras → chapters), `techTreeRules.ts`, `research.ts`, `unlocks.json` splashes, the research screen's bars |
| **P3 · Concrete unlocks** | Turn the surviving ladders into level, *one more* and unit-upgrade unlocks; spread producer and Housing levels across chapters. | `tech-tree.json`, `techEffectRules.ts` (retire the unused `TECH_STATS`), `definitions.ts` gates, `techProse.ts` |
| **P4 · Materials** *(if D4)* | Cards also cost Wood/Stone, and goods from chapter 5. | the tech schema + `researchTech`, `techTreeRules.ts`, tests |
| **P5 · Measure** | Rerun the three pacing schedules with a bot that also buys Knowledge; tune the per-chapter KP and Gold. | `tests/thirtyDays.test.ts` (re-pin), the scratch pacing runner |
| **P6 · Docs** | Rewrite `tech-tree.md` around chapters; update `07-research.md` §2, `22-progression.md` §9 and `12-quests.md`; close the decisions in `open-questions-closed.md`. | `Docs/` |

## 7. Open decisions

- **D1 · One tree or five books?** *Recommended:* Civics, Warfare and Magic
  become one chaptered tree with three lanes (city · army · magic); Sagas and
  Atlas stay found books. This reopens the 2026-09-24 "three general books"
  decision.
- **D2 · A finale for every Townhall level, TH5–TH10 included?**
  *Recommended: yes.* That is the chapter rule, and it gives the tree
  something to pace late.
- **D3 · Chapters open on the Townhall level instead of on revealed cells?**
  *Recommended: yes.* Fog already bounds the Townhall through its reach.
- **D4 · Do cards also cost materials (Elvenar's supplies)?** It is one more
  Gold/Wood sink. It needs code.
- **D5 · What happens to bonuses a player already researched that are cut?**
  Lost, or refunded in Knowledge and Gold.
- **D6 · How many % bonuses survive?** §4 keeps about 8.
- **D7 · The Knowledge purchase price**: with fewer, budgeted cards, is
  `n × 100` Gold per point the right valve for the engaged player?
