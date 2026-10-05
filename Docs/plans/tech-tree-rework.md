# Tech tree rework — one tree, in chapters

> **Scope.** Reshape research (`src/sim/data/tech-tree.json`) after Elvenar:
> one tree in sequential chapters, one chapter per Townhall step, a required
> spine budgeted to the target player, optional dead ends, and a reward for
> finishing a chapter whole. Pouring, the Knowledge bar and instant
> completion stay as they are ([`../features/07-research.md`](../features/07-research.md)).
>
> **Status.** Built 2026-10-05 (P1–P5, P7); P6 measured once — see
> [`../features/buildings.md`](../features/buildings.md) §3. Decisions in §8.

## 1. What is there today

- **167 cards in five books**: Civics 75 · Warfare 40 · Magic 28 · Atlas 13 ·
  Sagas 11.
- **116 are `bonus` cards (69%)**, most of them +5–20% ladders repeated across
  eras: `harvestYield` 18 cards, `unitAtk` 7, `unitDef` 6, `manaCap` 6,
  `taxRate` 5, `armyCap` 5, `manaRegen` 5, `knowledgeYield` 5.
- **Each band funnels into one card that needs the whole row above it.**
  `Magistracy` (TH4) needs all 42 cards of Civics eras 1–2: 113 Knowledge by
  day 5, against about 120 earned.
- **Tap cards are on the path to the Townhall.** `Bureaucracy` needs
  `TapPowerI` and `QuickHandsI`.
- **Nothing in the tree gates TH5–TH10.**
- **Three books split one Knowledge budget**, so the pacing cannot know which
  book a point goes to.

## 2. Elvenar's shape (checked)

- **One tree, chapters I–XXV, strictly in sequence.**
- **A chapter opens on exploration**: its first technology needs a number of
  provinces completed on the world map (480 for chapter 17, 520 for 18).
- **Lines show requirements.** A technology needs every technology that leads
  into it.
- **A technology with no line out of its right side is an optional dead
  end.** In practice these are some city expansions, squad-size upgrades and
  unit upgrades. Building levels, Main Hall levels, production steps and the
  chapter's wonders are required.
- **Finishing every technology of a chapter grants a Research Diploma**, a new
  effect in the Cauldron — the reason to do the dead ends.
- **Two-step price**: fill the Knowledge, then unlock with coins, supplies or
  goods.
- **Knowledge: 1 an hour, at most 10** (20 with an enchantment); more from
  tournaments, world encounters and wonders; buyable with coins, goods or
  diamonds at a price that rises permanently with each purchase.

## 3. The design

### 3.1 One tree, nine chapters

- **One tree.** Civics, Warfare and Magic become one; Sagas and Atlas stay
  found books (§6).
- **Chapter *n* is Townhall *n* → *n+1***; nine chapters.
- **Chapters are sequential.** Chapter *n+1* cannot start before chapter *n*'s
  finale is researched.
- **A chapter opens on revealed cells**, the way the bands open today and the
  way Elvenar's open on provinces. The finale of a chapter opens the next
  Townhall level.
- **Every column mixes lanes** — city, army, magic — shown by a light cue on
  the card (a frame or colour per lane).

### 3.2 A chapter's layout

- **Columns, 1–4 cards wide**, read left to right; a card needs what its lines
  lead in from.
- **The spine is required**: every card with a line out to the right leads,
  in the end, to the finale.
- **Dead ends are optional**: a card with no line out to the right. About
  **20–30%** of a chapter.
- **Width is the player's choice of order**: a chapter opens 2 wide, widens to
  3–4, and narrows to the finale (e.g. 2 → 4 → 3 → 1).
- **About 10 cards a chapter**: ~4 unlocks, ~4 fillers, ~2 dead ends, and the
  finale (some unlocks and fillers are dead ends).

| Card | Lane | Spine or dead end |
|---|---|---|
| a new building, a building's next level, one more of a building | city | spine |
| a new unit, the halls' next level | army | spine |
| the Sanctum's step, a spell | magic | spine |
| **a filler** aimed at something the player uses (§4) | any | spine |
| an army stat step, an extra store step, a world extra | any | dead end |
| **the finale**: the next Townhall level | city | spine, last |

### 3.3 The Knowledge budget

The spine of a chapter costs what the three-visits-a-day player earns in that
chapter's days: about **23 a day** from the bar (10 overnight, 6 and 7 between
visits), plus about 2 a day from landmarks, lairs and quests; the opening
quests pay 28.

| Chapter | Townhall | Target days | Spine | Dead ends | Opens at |
|---|---|---|---|---|---|
| 1 | 1 → 2 | day 1 | 2 | — | 0 cells |
| 2 | 2 → 3 | day 1 → 2 | 38 | 4 | 20 cells |
| 3 | 3 → 4 | 2 → 5 | 96 | 28 | 100 cells |
| 4 | 4 → 5 | 5 → 7 | 54 | 18 | 160 cells |
| 5 | 5 → 6 | 7 → 10 | 75 | 24 | 220 cells |
| 6 | 6 → 7 | 10 → 14 | 96 | 28 | 280 cells |
| 7 | 7 → 8 | 14 → 20 | 149 | 40 | 340 cells |
| 8 | 8 → 9 | 20 → 24 | 96 | 28 | 400 cells |
| 9 | 9 → 10 | 24 → 30 | 149 | 40 | 460 cells |
| | | | **755** | **210** | |

- The spine is priced so the bar, three visits a day, is what holds each
  Townhall level up to TH5; the dead ends are Knowledge on top, bought with
  Gold (400 × n², never reset) or Gems (200 a point).
- A card costs about a tenth of its chapter; the finale costs less than the
  column before it.
- The cell gates are a starting point. Each sits inside the reach of the
  Townhall that opens the chapter (TH2 reaches 144 cells, TH3 256, TH4 324,
  TH5 484, TH6 576, TH7 784, TH8 1,024, TH9 1,260).
- **The engaged player's way through is buying Knowledge with Gold or Gems**, not
  skipping cards; the dead ends are where extra Knowledge goes.

### 3.4 Price: Knowledge, then Gold

- **First Knowledge is poured, then Gold completes the card** — as today. The
  Gold is the sink: priced, like buildings, in days of what the target player
  collects.
- **Cards also ask for goods** (Planks, Cut Stone, Iron, Runestone) once the
  workshops that make them are open, like Elvenar's later chapters.

### 3.5 The chapter reward

- **Researching every card of a chapter, dead ends included, pays a card
  pack**, our Research Diploma — once per chapter.

## 4. Fillers

A filler is a required card on the spine, so it has to be felt:

- **aimed at something the player already uses** — no Farm storage before the
  Farm;
- **real steps**: store +25%, speed +15%, yield +15%, attack/defence +10%,
  flat +1;
- **a ladder spread across chapters**, one rank every 2–3 chapters, never two
  ranks in a row;
- **never on the tap or Mana.**

*Ready* = the stat exists (`TECH_STATS`); *new* = one stat to add, read where
its number is computed.

| Lane | Filler | Effect | Stat |
|---|---|---|---|
| city | Market Days | +% Gold from Housing | ready (`taxRate` › Housing) |
| city | Civic Treasury | +% the Townhall's own Gold | new |
| city | Communities | +1 resident in every house | ready |
| city | Schooling | villagers train faster | ready |
| city | Granaries · Woodsheds · Stoneyards · Smokehouses | +% store in Farm · Sawmill · Quarry · Docks | ready (`storageCapacity`) |
| city | Strongroom | +% store in the Townhall and houses | ready |
| city | Scaffolding | builders work faster | ready (`buildSpeed`) |
| city | Sawhorses · Chisels · Bellows · Runic Tools | a workshop works faster | ready (`workshopSpeed`) |
| city | Apprentices | +1 order slot in a workshop | new |
| city | Flowerbeds | decorations give +Harmony | new |
| harvest | Sharp Axes · Sickles · Spears · Nets · Picks | +% per strike: Wood · Food · Meat · Fish · Stone | ready (`harvestYield`) |
| harvest | Old Growth · Rich Soil | +% held in each tree · each crop plot | new |
| harvest | Farmhands · Lumberjacks · Miners · Fishers | that building's crew strikes faster | new |
| harvest | Packhorses | crews carry more per trip | ready (`crewYield`) |
| harvest | Gamekeeping | berries, game and fish come back faster | new |
| harvest | Surveying | +1 radius for one producer | new |
| harvest | Bunkhouse | +1 crew slot in one producer | new |
| army | Whetstones · Lances · Fletching · Barding | +% attack for one unit type | ready (`unitAtk`) |
| army | Shield Wall … | +% defence for one unit type | ready (`unitDef`) |
| army | Rations | +% HP for all troops | ready |
| army | Drill Masters | one unit type recruits faster | ready (`recruitSpeed`) |
| army | Barracks Bunks | +% army cap | ready |
| army | Field Surgeons | +% Infirmary beds | ready |
| army | Poultices | the Infirmary heals faster | new |
| army | Mentors | heroes gain more XP | ready |
| army | Forced March | armies march faster on the board | new |
| world | Lookouts | +1 fog discover radius | ready |
| world | Swift Scouts | explorers travel faster | new |
| world | Cartographers | +1 world reveal radius | ready |
| world | Logging Camps · Homesteads | world improvements produce more | new |
| world | Supply Depots | world improvements store more | new |
| world | Treasure Hunters | fog treasures pay more | new |

- Mountains hold no stock, so "+% held" never aims at Stone, Iron or Gold.
- Army stat steps beyond one rank per unit per chapter are **dead ends**.

### 4.1 Example — chapter 3 (Townhall 3 → 4)

| Column | Cards |
|---|---|
| 1 | Pickaxes (the Quarry) · Market Days I |
| 2 | Housing L4 · Picks I · Archery (Shooting Grounds) · Stoneyards I |
| 3 | Masonry (producers L4) · Scaffolding I · *Fletching I (dead end)* |
| 4 | **Magistracy** (Townhall 4) |

## 5. Keep, merge, cut

- **Keep, re-slotted into chapters** — the unlocks:
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
- **Keep as fillers**, re-stepped to §4's sizes: `Communities`,
  `TradeRoutesI`–`V` (as Market Days), `SchoolingI`–`II`, `GuildHallsI`–`II`, the `harvestYield`
  ladders (one rank per source per 2–3 chapters), `GranariesI`–`III`.
- **Turn into dead ends**: the army stat ladders (`WarhornsI`–`IV`,
  `ShieldWallI`–`III`, `FletchingI`–`III`, `BardingI`–`III`, `VigourI`–`III`,
  `ColoursI`–`V`, `DrillYardsI`–`III`, `BedsI`–`III`), one rank per unit per
  chapter.
- **Merge**: `FarsightI`–`IV` → 2 ranks; `TalesI`–`III`, `WarmWelcomeI`–`III`
  → 1 rank each.
- **Cut**: `TapPowerI`–`IV`, `QuickHandsI`–`III`, `Meditation`,
  `DeepWellsI`–`V`, `LeyTapsI`–`V`, `TerracingI`, `WorkerLoadI`–`III`,
  `CartageI`–`III`, `Roadworks`, `ScriptoriumI`–`V`, `WaypostsI`–`IV`,
  `BountiesI`–`IV`; and `Invocation`, `LeyReading`, `LeyStorm`, `Rumours`
  until they do something.
- **About 90 cards in the tree**, plus the found books.

## 6. Found books

- **Sagas and Atlas stay books found in ruins**, 5–6 cards each.
- **Outside the pacing**: never required by a chapter or a Townhall level.
- **Paid in Knowledge and Gold** like every card
  ([`../features/tech-tree.md`](../features/tech-tree.md) §11).

## 7. Work plan

| Phase | What | Touches |
|---|---|---|
| **P1 · One tree** | Merge Civics, Warfare and Magic into one tree with lanes; the doors that hand over Warfare and Magic point at their first cards instead. | `tech-tree.json`, `research.ts` (`TOME_OPENS`), `sim/doors.ts`, `unlocks.json`, the stage scene that gives Warfare, the research screen |
| **P2 · Prune** | Cut §5's list; drop unknown ids on load. | `tech-tree.json`, `save.ts` + migrator, `quests.json` goals naming cut cards, `tests/techTree.test.ts`, `tests/ladderEffects.test.ts`, `tests/onboarding.test.ts`, `tests/quests.test.ts` |
| **P3 · Chapters** | Nine sequential chapters opened on cells; finales for TH2–TH10; spine and dead ends; Knowledge per card from §3.3. | `tech-tree.json` (eras → chapters), `techTreeRules.ts` (a chapter must end in one finale; every spine card leads to it), `research.ts` |
| **P4 · Fillers** | Re-step the kept fillers; add the new stats §4 needs. | `techEffectRules.ts` (`TECH_STATS`), the call site of each new stat, `techProse.ts` |
| **P5 · Reward and goods** | The chapter reward; goods on cards from chapter 5. | `research.ts`, the tech schema, the research screen |
| **P6 · Measure** | Rerun the three pacing schedules with a bot that buys Knowledge; tune Knowledge, Gold and cell gates per chapter. | the pacing runner, `tests/thirtyDays.test.ts` |
| **P7 · Docs** | Rewrite `tech-tree.md` around chapters; update `07-research.md`, `22-progression.md`, `12-quests.md`; close the decisions. | `Docs/` |

## 8. Decisions

- **D1 · No refunds.** This is a prototype: a save from before the rework
  starts a fresh game.
- **D2 · The chapter reward is a card pack.**
- **D3 · Cards ask for goods** as well as Gold, once the goods exist.
- **D4 · Every new stat in §4 is built.**
