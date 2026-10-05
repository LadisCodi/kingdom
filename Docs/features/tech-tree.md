# The tech tree — every card, chapter by chapter

> **Scope.** The **content** of research: the kingdom's one tree in nine
> chapters, and the two found books. The **system** — Knowledge, pouring,
> the screen — is [`07-research.md`](07-research.md); what opens a found book
> is [`22-progression.md`](22-progression.md) §4; where a card sits is
> [`../tech-tree-editor.md`](../tech-tree-editor.md); the design is
> [`../plans/tech-tree-rework.md`](../plans/tech-tree-rework.md).
>
> **Status.** Built: **124 technologies** in `src/sim/data/tech-tree.json`,
> authored in `?dev=data#tree`. The tables below are generated from that file.

## 1. The shape

- **One tree, nine chapters, read in order.** Chapter *n* runs from Townhall
  *n* to *n + 1*; it opens on revealed cells and ends in one **finale**, alone
  on its last row, that opens the next Townhall level.
- **A card needs every card its lines come from**, always on the row above.
- **A page splits and merges.** A chapter's rows hold one, two or three
  cards, in a different order each chapter: the spine fans out from one card,
  converges on one, fans out again, and ends in the finale. The three columns
  keep a theme — the city left, production in the middle, the army right.
- **The spine is required**: every card that leads on, in the end, to the
  finale. A card nothing below requires is a **dead end**: optional.
- **Researching every card of a chapter, dead ends included, pays its card
  pack**, once.
- **Price: Knowledge is poured, then Gold and goods complete the card.**
- **From chapter 5, some cards also ask for precious materials**
  ([`19-world-map.md`](19-world-map.md) §7.6), more cards a chapter and
  dearer, the deepest cards of each chapter first. None is asked while the
  world is shut.
- **Every bonus climbs**: a positive percentage or a positive step; a wait
  is a speed; nothing is a discount.

| Chapter | Townhall | Opens at | Cards | Spine K | Dead-end K | Gold | Pack |
|---|---|---|---|---|---|---|---|
| 1 | 1 → 2 | 0 cells | 1 | 2 | 0 | 20 | — |
| 2 | 2 → 3 | 20 cells | 19 | 38 | 4 | 3,585 | Green |
| 3 | 3 → 4 | 100 cells | 13 | 96 | 28 | 27,000 | Yellow |
| 4 | 4 → 5 | 160 cells | 13 | 54 | 18 | 108,000 | Yellow |
| 5 | 5 → 6 | 220 cells | 13 | 75 | 24 | 122,000 | Rose |
| 6 | 6 → 7 | 280 cells | 13 | 96 | 28 | 270,000 | Blue |
| 7 | 7 → 8 | 340 cells | 13 | 149 | 40 | 569,000 | Blue |
| 8 | 8 → 9 | 400 cells | 13 | 96 | 28 | 1,215,000 | Purple |
| 9 | 9 → 10 | 460 cells | 13 | 149 | 40 | 2,565,000 | Golden |

## 2. Chapter 1 — Townhall 1 → 2

| Card | Opens / moves | Price | |
|---|---|---|---|
| **Forestry** | the Wood tap · the Berries tap · Townhall L2 | 20 G · 2 K | **finale** |

## 3. Chapter 2 — Townhall 2 → 3

| Card | Opens / moves | Price | |
|---|---|---|---|
| **Agriculture** | the crop plots | 25 G · 2 K |  |
| **Farming** | the Farm | 25 G · 1 K |  |
| **Hunting** | the Meat tap | 30 G · 1 K |  |
| **Saws** | the Sawmill | 30 G · 2 K |  |
| **Sawpits I** | +15% harvestYield — Wood | 120 G · 1 K |  |
| **Trade Routes I** | +10% taxRate | 100 G · 1 K |  |
| **Warrior** | the Barracks · the Warrior | 500 G · 2 K |  |
| **Irrigation I** | +15% harvestYield — crop-plot Food | 120 G · 2 K |  |
| **Reforesting I** | +25% regrowthSpeed — Wood | 100 G · 1 K |  |
| **Consecration** | the Sanctum | 400 G · 3 K |  |
| **Crop Rotation I** | +25% regrowthSpeed — crop-plot Food | 100 G · 4 K | *dead end* |
| **Urban Planning** | Housing L2 | 200 G · 3 K |  |
| **Pickaxes** | the Stone tap | 25 G · 2 K |  |
| **Masonry** | the Quarry | 100 G · 3 K |  |
| **Hospitality** | the Tavern | 400 G · 3 K |  |
| **Granaries I** | +25% storageCapacity — Farm | 150 G · 2 K |  |
| **Carpentry I** | +15% buildSpeed | 60 G · 2 K |  |
| **Schooling I** | +20% villagerTrainingSpeed | 300 G · 3 K |  |
| **Bureaucracy** | Townhall L3 | 800 G · 4 K | **finale** |

## 4. Chapter 3 — Townhall 3 → 4

| Card | Opens / moves | Price | |
|---|---|---|---|
| **Mining** | the Smelter · the iron-mountain Stone tap · the gold-mountain Gold tap | 2,000 G · 3 K |  |
| **Infirmary** | the Infirmary | 2,000 G · 3 K |  |
| **Stonecutting I** | +15% harvestYield — Stone | 2,000 G · 3 K |  |
| **Aqueducts** | Housing L3 | 2,000 G · 4 K |  |
| **Archery** | the Shooting Grounds · the Archer | 2,000 G · 3 K |  |
| **Timber Framing** | the producers L3 | 2,000 G · 4 K |  |
| **Communities** | +1 populationCapacity | 2,000 G · 4 K |  |
| **Sailing** | building on Water | 2,000 G · 4 K |  |
| **Fletching I** | +10% unitAtk — Distance | 2,000 G · 5 K | *dead end* |
| **Fishing** | the Docks | 2,000 G · 4 K |  |
| **Trade Routes II** | +10% taxRate | 2,000 G · 5 K |  |
| **Treasure Hunters I** | +25% treasureYield | 2,000 G · 5 K | *dead end* |
| **Magistracy** | Townhall L4 | 3,000 G · 6 K | **finale** |

## 5. Chapter 4 — Townhall 4 → 5

| Card | Opens / moves | Price | |
|---|---|---|---|
| **Townhouses** | Housing L4 | 8,000 G · 5 K |  |
| **Stone Dressing** | the Mason's Yard | 8,000 G · 5 K |  |
| **Spears** | the Spear Hall · the Lancer | 8,000 G · 5 K |  |
| **Architecture** | the producers L4 | 8,000 G · 5 K |  |
| **Joinery** | the Carpenter | 8,000 G · 5 K |  |
| **Sawpits II** | +15% harvestYield — Wood | 8,000 G · 5 K |  |
| **Warband II** | the four halls L4 | 8,000 G · 5 K |  |
| **Guild Halls I** | +15% workshopSpeed | 8,000 G · 5 K |  |
| **Lumberjacks I** | +15% crewStrikeSpeed — Sawmill | 8,000 G · 5 K |  |
| **Shield Wall I** | +10% unitDef — Melee | 8,000 G · 9 K | *dead end* |
| **Carpentry II** | +15% buildSpeed | 8,000 G · 5 K |  |
| **Woodsheds I** | +25% storageCapacity — Sawmill | 8,000 G · 9 K | *dead end* |
| **Charter** | Townhall L5 | 12,000 G · 4 K | **finale** |

## 6. Chapter 5 — Townhall 5 → 6

| Card | Opens / moves | Price | |
|---|---|---|---|
| **Ironmongery** | the producers L5 | 9,000 G · 7 K · 2 Planks · 2 CutStone |  |
| **Terraces** | Housing L5 | 9,000 G · 7 K · 2 Planks · 2 CutStone |  |
| **Farmhands I** | +15% crewStrikeSpeed — Farm | 9,000 G · 7 K |  |
| **Cavalry** | the Stables · the Cavalry | 9,000 G · 7 K · 2 Planks · 2 CutStone |  |
| **Trade Routes III** | +10% taxRate | 9,000 G · 7 K |  |
| **Warband III** | the four halls L5 | 9,000 G · 7 K |  |
| **Gardening** | the Garden · the Orchard | 9,000 G · 7 K |  |
| **Deep Mining** | +25% harvestYield — MountainGold | 9,000 G · 7 K |  |
| **Barding I** | +10% unitDef — Mounted | 9,000 G · 12 K | *dead end* |
| **Rich Soil I** | +25% cellStock — crop-plot Food | 9,000 G · 7 K |  |
| **Attunement II** | the Rune Carver · Sanctum L4 | 9,000 G · 7 K |  |
| **Smokehouses I** | +25% storageCapacity — Docks | 9,000 G · 12 K | *dead end* |
| **Exchequer** | Townhall L6 | 14,000 G · 5 K · 2 Planks · 2 CutStone | **finale** |

## 7. Chapter 6 — Townhall 6 → 7

| Card | Opens / moves | Price | |
|---|---|---|---|
| **Manors** | Housing L6 | 20,000 G · 9 K · 3 Planks · 3 CutStone · 1 Iron |  |
| **Waterwheels** | the producers L6 | 20,000 G · 9 K · 3 Planks · 3 CutStone · 1 Iron |  |
| **Fortifications** | the four halls L6 | 20,000 G · 9 K · 3 Planks · 3 CutStone · 1 Iron |  |
| **Sculpture** | the Well · the Statue | 20,000 G · 9 K |  |
| **Tactics** | Reading the ground — a bad matchup costs a tenth less. | 20,000 G · 9 K |  |
| **Apprentices I** | +1 workshopQueueSlots | 20,000 G · 9 K |  |
| **Irrigation II** | +15% harvestYield — crop-plot Food | 20,000 G · 9 K |  |
| **Vigour I** | +10% unitHp | 20,000 G · 14 K | *dead end* |
| **Attunement III** | Sanctum L5 | 20,000 G · 9 K |  |
| **Carpentry III** | +15% buildSpeed | 20,000 G · 9 K |  |
| **Poultices I** | +25% healSpeed | 20,000 G · 9 K |  |
| **Gamekeeping I** | +25% respawnSpeed | 20,000 G · 14 K | *dead end* |
| **Chancery** | Townhall L7 | 30,000 G · 6 K · 3 Planks · 3 CutStone · 1 Iron | **finale** |

## 8. Chapter 7 — Townhall 7 → 8

| Card | Opens / moves | Price | |
|---|---|---|---|
| **Mansions** | Housing L7 | 42,000 G · 14 K · 4 Planks · 4 CutStone · 2 Iron |  |
| **Bastions** | the four halls L7 | 42,000 G · 14 K · 4 Planks · 4 CutStone · 2 Iron |  |
| **Trade Routes IV** | +10% taxRate | 42,000 G · 14 K |  |
| **Windmills** | the producers L7 | 42,000 G · 14 K · 4 Planks · 4 CutStone · 2 Iron |  |
| **Second Sanctum** | one more Sanctum | 42,000 G · 14 K |  |
| **Civic Treasury I** | +25% ownGold | 42,000 G · 14 K |  |
| **Sawpits III** | +15% harvestYield — Wood | 42,000 G · 14 K |  |
| **Warhorns I** | +10% unitAtk | 42,000 G · 20 K | *dead end* |
| **Miners I** | +15% crewStrikeSpeed — Quarry | 42,000 G · 14 K |  |
| **Old Growth I** | +25% cellStock — Wood | 42,000 G · 14 K |  |
| **Bunkhouse I** | +1 crewSlots | 42,000 G · 14 K |  |
| **Frontier Works I** | +15% improvementYield | 42,000 G · 20 K | *dead end* |
| **Dominion** | Townhall L8 | 65,000 G · 9 K · 4 Planks · 4 CutStone · 2 Iron | **finale** |

## 9. Chapter 8 — Townhall 8 → 9

| Card | Opens / moves | Price | |
|---|---|---|---|
| **Sewers** | Housing L8 | 90,000 G · 9 K · 5 Planks · 5 CutStone · 3 Iron · 1 Runestone |  |
| **Hydraulics** | the producers L8 | 90,000 G · 9 K · 5 Planks · 5 CutStone · 3 Iron · 1 Runestone |  |
| **Citadels** | the four halls L8 | 90,000 G · 9 K · 5 Planks · 5 CutStone · 3 Iron · 1 Runestone |  |
| **Paving** | the Plaza | 90,000 G · 9 K |  |
| **Stonecutting II** | +15% harvestYield — Stone | 90,000 G · 9 K |  |
| **Colours I** | +10% armyCap | 90,000 G · 9 K |  |
| **Surveying I** | +1 influenceRadius | 90,000 G · 9 K |  |
| **Trade Routes V** | +10% taxRate | 90,000 G · 9 K |  |
| **Attunement IV** | Sanctum L6 · Sanctum L7 · Sanctum L8 · Sanctum L9 · Sanctum L10 | 90,000 G · 9 K |  |
| **Shield Wall II** | +10% unitDef — Melee | 90,000 G · 14 K | *dead end* |
| **Guild Halls II** | +15% workshopSpeed | 90,000 G · 9 K |  |
| **Swift Scouts I** | +25% explorerSpeed | 90,000 G · 14 K | *dead end* |
| **Sovereignty** | Townhall L9 | 135,000 G · 6 K · 5 Planks · 5 CutStone · 3 Iron · 1 Runestone | **finale** |

## 10. Chapter 9 — Townhall 9 → 10

| Card | Opens / moves | Price | |
|---|---|---|---|
| **Grand Avenues** | Housing L9 · Housing L10 | 190,000 G · 14 K · 6 Planks · 6 CutStone · 4 Iron · 2 Runestone |  |
| **Mechanics** | the producers L9 · the producers L10 | 190,000 G · 14 K · 6 Planks · 6 CutStone · 4 Iron · 2 Runestone |  |
| **Warlords** | the four halls L9 · the four halls L10 | 190,000 G · 14 K · 6 Planks · 6 CutStone · 4 Iron · 2 Runestone |  |
| **Iron Picks I** | +15% harvestYield — iron-mountain Stone | 190,000 G · 14 K |  |
| **Sacred Grounds** | the Shrine | 190,000 G · 14 K |  |
| **Fishers I** | +15% crewStrikeSpeed — Docks | 190,000 G · 14 K |  |
| **Warhorns II** | +10% unitAtk | 190,000 G · 14 K |  |
| **Flowerbeds I** | +25% decorationHarmony | 190,000 G · 14 K |  |
| **Supply Depots I** | +25% improvementStore | 190,000 G · 20 K | *dead end* |
| **Strongroom I** | +25% storageCapacity — Townhall; +25% storageCapacity — Housing | 190,000 G · 14 K |  |
| **Granaries II** | +25% storageCapacity — Farm | 190,000 G · 14 K |  |
| **Forced March I** | +15% armyMarchSpeed | 190,000 G · 20 K | *dead end* |
| **Golden Age** | Townhall L10 | 285,000 G · 9 K · 6 Planks · 6 CutStone · 4 Iron · 2 Runestone | **finale** |

## 11. The found books

- **Outside the pacing**: never required by a chapter or a Townhall level.
- **Priced like the tree**: Knowledge and Gold, the Knowledge of a tree card
  at the same Gold — 3 to 600 G, 4 to 2,500 G, 5 to 4,000 G, 7 above.
- **Sagas** opens on a Tavern standing; **Atlas** on the Watchtower claimed.

### 11.1 Sagas

| Card | Opens / moves | Price |
|---|---|---|
| **Common Room** | Tavern L2 | 600 G · 3 K |
| **Tales I** | +10% heroXp | 400 G · 3 K |
| **Warm Welcome I** | +10% summonStardust | 400 G · 3 K |
| **Guest Rooms** | Tavern L3 | 1,500 G · 4 K |
| **Great Hall** | Tavern L4 | 4,000 G · 5 K |
| **Minstrels’ Gallery** | Tavern L5 | 8,000 G · 7 K |

### 11.2 Atlas

| Card | Opens / moves | Price |
|---|---|---|
| **Cartography** | The first explorer — send it out to reveal the world map. | 2,000 G · 4 K |
| **Farsight I** | +1 discoverRadius | 800 G · 4 K |
| **Scouts I** | +1 explorerSlots | 2,500 G · 4 K |
| **Farsight II** | +1 discoverRadius | 1,500 G · 4 K |
| **Scouts II** | +1 explorerSlots | 4,000 G · 5 K |
| **Pathfinding** | +1 worldRevealRadius | 8,000 G · 7 K |
| **Muster** | the War Camp | 9,000 G · 7 K |

## 12. What a bonus can move

The registry is `src/sim/data/techEffectRules.ts`; every stat names the one call site that reads it.

| Stat | How it enters | Cards |
|---|---|---|
| `armyCap` | multiplies the number | 1 |
| `armyMarchSpeed` | an army's time per hex on the world board is divided by it; the city sends the pace with the army | 1 |
| `autoTapSpeed` | the auto-tap cooldown is divided by it | 0 |
| `buildSpeed` | build and upgrade times are divided by it | 3 |
| `cellStock` | multiplies what a cell holds when full; never a mountain, which holds no stock | 2 |
| `crewSlots` | whole workers, added to a producer's level | 1 |
| `crewStrikeSpeed` | the time between a building's crew strikes is divided by it | 4 |
| `crewYield` | multiplies a worker delivery; the fraction carries | 0 |
| `decorationHarmony` | added to, or multiplying, a decoration's Harmony; whole points, rounded down | 1 |
| `discoverRadius` | whole rings, added | 2 |
| `explorerSlots` | whole explorers, added to Cartography's | 2 |
| `explorerSpeed` | an explorer's time per hex is divided by it, before the Scout's boon | 1 |
| `harvestYield` | multiplies the chunk a tap and a strike take; the fraction carries | 8 |
| `healSpeed` | a ward's mending time is divided by it, priced when it starts | 1 |
| `heroXp` | multiplies the number | 1 |
| `improvementStore` | multiplies a world improvement's store; the server settles every store when it changes | 1 |
| `improvementYield` | multiplies what a world improvement makes an hour; the server settles every store when it changes | 1 |
| `infirmaryBeds` | multiplies the number | 0 |
| `influenceRadius` | whole tiles, added to a producer's reach | 1 |
| `knowledgeYield` | multiplies the number | 0 |
| `lairKnowledge` | multiplies the number | 0 |
| `landmarkKnowledge` | multiplies the number | 0 |
| `manaCap` | multiplies the number | 0 |
| `manaRegen` | multiplies the number | 0 |
| `ownGold` | multiplies the Gold the Townhall makes by itself | 1 |
| `populationCapacity` | whole beds, added | 1 |
| `recruitSpeed` | a soldier’s training time is divided by it | 0 |
| `regrowthSpeed` | a stump’s wait is divided by it | 2 |
| `requires` | the shape | 0 |
| `respawnSpeed` | a consumed feature's wait to come back is divided by it | 1 |
| `storageCapacity` | multiplies the number | 6 |
| `summonStardust` | multiplies the number | 1 |
| `tapWorkSeconds` | multiplies the number | 0 |
| `taxRate` | multiplies the number | 5 |
| `treasureYield` | multiplies a fog treasure priced in production; never the first, never Knowledge | 1 |
| `unitAtk` | multiplies the number | 3 |
| `unitDef` | multiplies the number | 3 |
| `unitHp` | multiplies the number | 1 |
| `villagerTrainingSpeed` | a villager’s training time is divided by it | 1 |
| `workerSpeed` | multiplies the number | 0 |
| `workshopQueueSlots` | whole orders, added to a workshop's queue | 1 |
| `workshopSpeed` | a workshop item’s work time is divided by it | 2 |
| `worldRevealRadius` | whole hexes round an explorer's path, added, capped at 2 | 1 |

## 13. Dials, in the order to reach for them

| Dial | Where | What it moves |
|---|---|---|
| a card's `knowledge`, `gold`, `goods`, `anyPrecious` | `?dev=data#tree` | one card |
| a chapter's cells | `?dev=data#tree` (`eras`) | when a chapter opens |
| a chapter's pack | `?dev=data#tree` (`eraRewards`) | what finishing it pays |
| `requires` | `?dev=data#tree` | the shape; a card nothing requires is a dead end |
| `kind`, `unlocks`, `effects` | `?dev=data#tree` | what a card IS |
| what opens a found book | `sim/research.ts` `TOME_OPENS` | code, by design |

## 14. Deliberately not in this design

- More than one general book: one tree, so a chapter's Knowledge is exact.
- A card about the tap or the Mana pool.
- A bonus that shrinks a number, or a card that discounts a price.
- A planned card on the page: a card that does nothing is not in the tree.
- A refund for a card that left the tree.
