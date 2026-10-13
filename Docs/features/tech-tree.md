# The tech tree — every card, chapter by chapter

> **Scope.** The **content** of research: the kingdom's one tree in nine
> chapters, and the two found books. The **system** — Knowledge, pouring,
> chapters, the screen — is [`07-research.md`](07-research.md); what opens a
> found book is [`22-progression.md`](22-progression.md) §4; where a card sits
> is [`../tech-tree-editor.md`](../tech-tree-editor.md).
>
> **Status.** Built: **188 technologies** — Kingdom 129, Sagas 6, Atlas 53 —
> in `src/sim/data/tech-tree.json`, authored in `?dev=data#tree`. The tables
> below are read from that file; where they disagree, the file is right.

## 1. The shape

- **One tree, nine chapters, read in order.** Chapter *n* runs from Townhall
  *n* to *n + 1*; it opens on revealed cells and ends in one **finale**, alone
  on its last row, that opens the next Townhall level.
- **A card needs every card its lines come from**, always on the row above.
- **A page splits and merges**: rows of one to three cards, the spine fanning
  out and converging on the finale. The columns keep a loose theme — the city
  left, production in the middle, the army right.
- **The spine is required**: every card that leads, in the end, to the
  finale. Every other card is **optional**: a dead end that nothing below
  requires, or a card only dead ends need.
- **Researching every card of a chapter, dead ends included, pays relic
  fragments** once (`eraRewards`).
- **Price: Knowledge is poured, then Gold completes the card**, with:
  - **refined goods** from chapter 5 — Planks and Cut Stone, then Iron, then
    Runestone;
  - **precious materials** from chapter 5: "any precious" in chapters 5–6,
    named Starmetal, Heartwood and Moonglass from chapter 7. None is asked
    while the Watchtower is unrepaired;
  - Wood, Stone and Food on the Atlas's first four cards (§11.2).
- **Every bonus climbs**: a positive percentage or a positive step; a wait is
  a speed; nothing is a discount.

| Chapter | Townhall | Opens at | Cards | Spine K | Optional K | Gold | Pays |
|---|---|---|---|---|---|---|---|
| 1 | 1 → 2 | 0 cells | 1 | 2 | 0 | 20 | — |
| 2 | 2 → 3 | 20 cells | 21 | 38 | 9 | 3,825 | 1 fragment |
| 3 | 3 → 4 | 100 cells | 14 | 43 | 13 | 28,500 | 1 fragment |
| 4 | 4 → 5 | 160 cells | 16 | 54 | 35 | 132,000 | 1 fragment |
| 5 | 5 → 6 | 220 cells | 15 | 75 | 40 | 140,000 | 2 fragments |
| 6 | 6 → 7 | 280 cells | 16 | 96 | 58 | 330,000 | 2 fragments |
| 7 | 7 → 8 | 340 cells | 16 | 149 | 76 | 695,000 | 2 fragments |
| 8 | 8 → 9 | 400 cells | 15 | 96 | 52 | 1,395,000 | 3 fragments |
| 9 | 9 → 10 | 460 cells | 15 | 135 | 76 | 2,945,000 | 4 fragments |

- *Spine K* and *Optional K* are the chapter's Knowledge on and off the
  spine; *Pays* is relic fragments, of relics already met.

## 2. Chapter 1 — Townhall 1 → 2

| Card | Opens / moves | Price | |
|---|---|---|---|
| **Forestry** | the Wood tap · the Berries tap · Townhall L2 | 20 G · 2 K | **finale** |

## 3. Chapter 2 — Townhall 2 → 3

| Card | Opens / moves | Price | |
|---|---|---|---|
| **Agriculture** | the crop plots | 25 G · 2 K |  |
| **Village Pride** | the Flower patch · the Resting nook · the Lantern corner | 40 G · 2 K | *optional* |
| **Farming** | the Farm | 25 G · 1 K |  |
| **Hunting** | the Meat tap | 30 G · 1 K |  |
| **Saws** | the Sawmill | 30 G · 2 K |  |
| **Sawpits I** | +15% harvestYield — Wood | 120 G · 1 K |  |
| **Trade Routes I** | +10% taxRate | 100 G · 1 K |  |
| **Warrior** | the Barracks · the Warrior | 500 G · 2 K |  |
| **Irrigation I** | +15% harvestYield — crop-plot Food | 120 G · 2 K |  |
| **Reforesting I** | +25% regrowthSpeed — Wood | 100 G · 1 K |  |
| **Consecration** | the Sanctum | 400 G · 3 K |  |
| **Crop Rotation I** | +25% regrowthSpeed — crop-plot Food | 100 G · 4 K | *optional* |
| **Urban Planning** | Housing L2 | 200 G · 3 K |  |
| **Pickaxes** | the Stone tap | 25 G · 2 K |  |
| **Masonry** | the Quarry | 100 G · 3 K |  |
| **Transplanting** | Hold a tree to pick it up and move it — it grows back in a day. | 200 G · 3 K | *optional* |
| **Hospitality** | the Tavern | 400 G · 3 K |  |
| **Granaries I** | +25% storageCapacity — Farm | 150 G · 2 K |  |
| **Carpentry I** | +15% buildSpeed | 60 G · 2 K |  |
| **Schooling I** | +20% villagerTrainingSpeed | 300 G · 3 K |  |
| **Bureaucracy** | Townhall L3 | 800 G · 4 K | **finale** |

## 4. Chapter 3 — Townhall 3 → 4

| Card | Opens / moves | Price | |
|---|---|---|---|
| **Mining** | the Smelter · the iron-mountain Stone tap · the gold-mountain Gold tap | 2,000 G · 3 K |  |
| **Civic Pride** | the Topiary garden · the Banner green · the Bird garden | 1,500 G · 3 K | *optional* |
| **Infirmary** | the Infirmary | 2,000 G · 3 K |  |
| **Stonecutting I** | +15% harvestYield — Stone | 2,000 G · 3 K |  |
| **Aqueducts** | Housing L3 | 2,000 G · 4 K |  |
| **Archery** | the Shooting Grounds · the Archer | 2,000 G · 3 K |  |
| **Timber Framing** | the producers L3 | 2,000 G · 4 K |  |
| **Communities** | +1 populationCapacity | 2,000 G · 4 K |  |
| **Sailing** | building on Water | 2,000 G · 4 K |  |
| **Fletching I** | +10% unitAtk — Distance | 2,000 G · 5 K | *optional* |
| **Fishing** | the Docks | 2,000 G · 4 K |  |
| **Trade Routes II** | +10% taxRate | 2,000 G · 5 K |  |
| **Treasure Hunters I** | +25% treasureYield | 2,000 G · 5 K | *optional* |
| **Magistracy** | Townhall L4 | 3,000 G · 6 K | **finale** |

## 5. Chapter 4 — Townhall 4 → 5

| Card | Opens / moves | Price | |
|---|---|---|---|
| **Townhouses** | Housing L4 | 8,000 G · 5 K |  |
| **Stone Dressing** | the Mason's Yard | 8,000 G · 5 K |  |
| **Spears** | the Spear Hall · the Lancer | 8,000 G · 5 K |  |
| **Warriors II** | the Warrior II | 8,000 G · 6 K | *optional* |
| **Architecture** | the producers L4 | 8,000 G · 5 K |  |
| **Sacred Masonry** | the Shrine | 8,000 G · 5 K | *optional* |
| **Joinery** | the Carpenter | 8,000 G · 5 K |  |
| **Sawpits II** | +15% harvestYield — Wood | 8,000 G · 5 K |  |
| **Warband II** | the four halls L4 | 8,000 G · 5 K |  |
| **Guild Halls I** | +15% workshopSpeed | 8,000 G · 5 K |  |
| **Lumberjacks I** | +15% crewStrikeSpeed — Sawmill | 8,000 G · 5 K |  |
| **Shield Wall I** | +10% unitDef — Melee | 8,000 G · 9 K | *optional* |
| **Carpentry II** | +15% buildSpeed | 8,000 G · 5 K |  |
| **Archers II** | the Archer II | 8,000 G · 6 K | *optional* |
| **Woodsheds I** | +25% storageCapacity — Sawmill | 8,000 G · 9 K | *optional* |
| **Charter** | Townhall L5 | 12,000 G · 4 K | **finale** |

## 6. Chapter 5 — Townhall 5 → 6

| Card | Opens / moves | Price | |
|---|---|---|---|
| **Lancers II** | the Lancer II | 9,000 G · 8 K | *optional* |
| **Ironmongery** | the producers L5 | 9,000 G · 7 K · 2 Planks · 2 Cut Stone |  |
| **Terraces** | Housing L5 | 9,000 G · 7 K · 2 Planks · 2 Cut Stone |  |
| **Farmhands I** | +15% crewStrikeSpeed — Farm | 9,000 G · 7 K |  |
| **Cavalry** | the Stables · the Cavalry | 9,000 G · 7 K · 2 Planks · 2 Cut Stone |  |
| **Trade Routes III** | +10% taxRate | 9,000 G · 7 K |  |
| **Cavalry II** | the Cavalry II | 9,000 G · 8 K | *optional* |
| **Warband III** | the four halls L5 | 9,000 G · 7 K |  |
| **Gardening** | the Garden · the Orchard | 9,000 G · 7 K |  |
| **Deep Mining** | +25% harvestYield — gold-mountain Gold | 9,000 G · 7 K |  |
| **Barding I** | +10% unitDef — Mounted | 9,000 G · 12 K | *optional* |
| **Rich Soil I** | +25% cellStock — crop-plot Food | 9,000 G · 7 K · 5 any precious |  |
| **Attunement II** | the Rune Carver · Sanctum L4 | 9,000 G · 7 K |  |
| **Smokehouses I** | +25% storageCapacity — Docks | 9,000 G · 12 K | *optional* |
| **Exchequer** | Townhall L6 | 14,000 G · 5 K · 2 Planks · 2 Cut Stone · 5 any precious | **finale** |

## 7. Chapter 6 — Townhall 6 → 7

| Card | Opens / moves | Price | |
|---|---|---|---|
| **Manors** | Housing L6 | 20,000 G · 9 K · 3 Planks · 3 Cut Stone · 1 Iron |  |
| **Waterwheels** | the producers L6 | 20,000 G · 9 K · 3 Planks · 3 Cut Stone · 1 Iron |  |
| **Fortifications** | the four halls L6 | 20,000 G · 9 K · 3 Planks · 3 Cut Stone · 1 Iron |  |
| **Sculpture** | the Well · the Statue | 20,000 G · 9 K |  |
| **Warriors III** | the Warrior III | 20,000 G · 10 K · 1 Iron | *optional* |
| **Tactics** | Reading the ground — a bad matchup costs a tenth less. | 20,000 G · 9 K |  |
| **Apprentices I** | +1 workshopQueueSlots | 20,000 G · 9 K |  |
| **Irrigation II** | +15% harvestYield — crop-plot Food | 20,000 G · 9 K |  |
| **Vigour I** | +10% unitHp | 20,000 G · 14 K | *optional* |
| **Archers III** | the Archer III | 20,000 G · 10 K · 1 Iron | *optional* |
| **Attunement III** | Sanctum L5 | 20,000 G · 9 K |  |
| **Lancers III** | the Lancer III | 20,000 G · 10 K · 1 Iron | *optional* |
| **Carpentry III** | +15% buildSpeed | 20,000 G · 9 K · 10 any precious |  |
| **Poultices I** | +25% healSpeed | 20,000 G · 9 K · 10 any precious |  |
| **Gamekeeping I** | +25% respawnSpeed | 20,000 G · 14 K | *optional* |
| **Chancery** | Townhall L7 | 30,000 G · 6 K · 3 Planks · 3 Cut Stone · 1 Iron · 10 any precious | **finale** |

## 8. Chapter 7 — Townhall 7 → 8

| Card | Opens / moves | Price | |
|---|---|---|---|
| **Mansions** | Housing L7 | 42,000 G · 14 K · 4 Planks · 4 Cut Stone · 2 Iron |  |
| **Cavalry III** | the Cavalry III | 42,000 G · 12 K · 1 Iron | *optional* |
| **Bastions** | the four halls L7 | 42,000 G · 14 K · 4 Planks · 4 Cut Stone · 2 Iron |  |
| **Trade Routes IV** | +10% taxRate | 42,000 G · 14 K |  |
| **Windmills** | the producers L7 | 42,000 G · 14 K · 4 Planks · 4 Cut Stone · 2 Iron |  |
| **Second Sanctum** | one more Sanctum | 42,000 G · 14 K |  |
| **Civic Treasury I** | +25% ownGold | 42,000 G · 14 K |  |
| **Sawpits III** | +15% harvestYield — Wood | 42,000 G · 14 K |  |
| **Warhorns I** | +10% unitAtk | 42,000 G · 20 K | *optional* |
| **Lancers IV** | the Lancer IV | 42,000 G · 12 K · 2 Iron | *optional* |
| **Miners I** | +15% crewStrikeSpeed — Quarry | 42,000 G · 14 K |  |
| **Warriors IV** | the Warrior IV | 42,000 G · 12 K · 2 Iron | *optional* |
| **Old Growth I** | +25% cellStock — Wood | 42,000 G · 14 K · 5 Starmetal · 5 Heartwood · 5 Moonglass |  |
| **Bunkhouse I** | +1 crewSlots | 42,000 G · 14 K · 5 Starmetal · 5 Heartwood · 5 Moonglass |  |
| **Frontier Works I** | +15% improvementYield | 42,000 G · 20 K · 5 Starmetal · 5 Heartwood · 5 Moonglass | *optional* |
| **Dominion** | Townhall L8 | 65,000 G · 9 K · 4 Planks · 4 Cut Stone · 2 Iron · 5 Starmetal · 5 Heartwood · 5 Moonglass | **finale** |

## 9. Chapter 8 — Townhall 8 → 9

| Card | Opens / moves | Price | |
|---|---|---|---|
| **Sewers** | Housing L8 | 90,000 G · 9 K · 5 Planks · 5 Cut Stone · 3 Iron · 1 Runestone |  |
| **Hydraulics** | the producers L8 | 90,000 G · 9 K · 5 Planks · 5 Cut Stone · 3 Iron · 1 Runestone |  |
| **Citadels** | the four halls L8 | 90,000 G · 9 K · 5 Planks · 5 Cut Stone · 3 Iron · 1 Runestone |  |
| **Paving** | the Plaza | 90,000 G · 9 K |  |
| **Stonecutting II** | +15% harvestYield — Stone | 90,000 G · 9 K |  |
| **Colours I** | +10% armyCap | 90,000 G · 9 K |  |
| **Cavalry IV** | the Cavalry IV | 90,000 G · 12 K · 2 Iron | *optional* |
| **Surveying I** | +1 influenceRadius | 90,000 G · 9 K |  |
| **Archers IV** | the Archer IV | 90,000 G · 12 K · 2 Iron | *optional* |
| **Trade Routes V** | +10% taxRate | 90,000 G · 9 K · 10 Starmetal · 10 Heartwood · 10 Moonglass |  |
| **Attunement IV** | Sanctum L6 · Sanctum L7 · Sanctum L8 · Sanctum L9 · Sanctum L10 | 90,000 G · 9 K · 10 Starmetal · 10 Heartwood · 10 Moonglass |  |
| **Shield Wall II** | +10% unitDef — Melee | 90,000 G · 14 K | *optional* |
| **Guild Halls II** | +15% workshopSpeed | 90,000 G · 9 K · 10 Starmetal · 10 Heartwood · 10 Moonglass |  |
| **Swift Scouts I** | +25% explorerSpeed | 90,000 G · 14 K · 10 Starmetal · 10 Heartwood · 10 Moonglass | *optional* |
| **Sovereignty** | Townhall L9 | 135,000 G · 6 K · 5 Planks · 5 Cut Stone · 3 Iron · 1 Runestone · 10 Starmetal · 10 Heartwood · 10 Moonglass | **finale** |

## 10. Chapter 9 — Townhall 9 → 10

| Card | Opens / moves | Price | |
|---|---|---|---|
| **Grand Avenues** | Housing L9 · Housing L10 | 190,000 G · 14 K · 6 Planks · 6 Cut Stone · 4 Iron · 2 Runestone |  |
| **Mechanics** | the producers L9 · the producers L10 | 190,000 G · 14 K · 6 Planks · 6 Cut Stone · 4 Iron · 2 Runestone |  |
| **Warlords** | the four halls L9 · the four halls L10 | 190,000 G · 14 K · 6 Planks · 6 Cut Stone · 4 Iron · 2 Runestone |  |
| **Lancers V** | the Lancer V | 190,000 G · 14 K · 3 Iron · 1 Runestone | *optional* |
| **Iron Picks I** | +15% harvestYield — iron-mountain Stone | 190,000 G · 14 K |  |
| **Warriors V** | the Warrior V | 190,000 G · 14 K · 3 Iron · 1 Runestone | *optional* |
| **Fishers I** | +15% crewStrikeSpeed — Docks | 190,000 G · 14 K · 15 Starmetal · 15 Heartwood · 15 Moonglass |  |
| **Warhorns II** | +10% unitAtk | 190,000 G · 14 K |  |
| **Flowerbeds I** | +25% decorationHarmony | 190,000 G · 14 K · 15 Starmetal · 15 Heartwood · 15 Moonglass |  |
| **Archers V** | the Archer V | 190,000 G · 14 K · 3 Iron · 1 Runestone | *optional* |
| **Supply Depots I** | +25% improvementStore | 190,000 G · 20 K | *optional* |
| **Strongroom I** | +25% storageCapacity — Townhall · +25% storageCapacity — Housing | 190,000 G · 14 K · 15 Starmetal · 15 Heartwood · 15 Moonglass |  |
| **Granaries II** | +25% storageCapacity — Farm | 190,000 G · 14 K · 15 Starmetal · 15 Heartwood · 15 Moonglass |  |
| **Cavalry V** | the Cavalry V | 190,000 G · 14 K · 3 Iron · 1 Runestone | *optional* |
| **Golden Age** | Townhall L10 | 285,000 G · 9 K · 6 Planks · 6 Cut Stone · 4 Iron · 2 Runestone · 15 Starmetal · 15 Heartwood · 15 Moonglass | **finale** |

## 11. The found books

- **Outside the pacing**: never required by a chapter or a Townhall level.
- **Sagas** opens on a Tavern standing; **Atlas** on the Watchtower repaired.
- Neither book's chapters pay fragments.

### 11.1 Sagas

- Two chapters: the first open with the book, the second at 100 revealed
  cells. Priced in Knowledge and Gold only.

| Card | Opens / moves | Price | Band |
|---|---|---|---|
| **Common Room** | Tavern L2 | 600 G · 3 K | 1 |
| **Tales I** | +10% heroXp | 400 G · 3 K | 1 |
| **Warm Welcome I** | +10% summonStardust | 400 G · 3 K | 1 |
| **Guest Rooms** | Tavern L3 | 1,500 G · 4 K | 1 |
| **Great Hall** | Tavern L4 | 4,000 G · 5 K | 2 |
| **Minstrels’ Gallery** | Tavern L5 | 8,000 G · 7 K | 2 |

### 11.2 Atlas

- **Optional depth for the world board**: no chapter, Townhall or door waits
  on it. One chapter. A trunk runs down the middle to *Pathfinding*, alone on
  the last row; every card either side of the trunk is optional.
- **The Fortress, the Chapel and the War Camp are opened here**
  (*Fortification*, *Holy Ground*, *Muster*). A kingdom holds
  `worldBuild.fortresses` (1) Fortresses, +1 for each *Garrison Rights*.
- **Small bonuses, high prices, several resources**:
  - the first four cards ask for Wood, Stone and Food beside the Gold;
  - from row 2, precious materials;
  - from row 10, refined goods too: Planks and Cut Stone, then Iron, then
    Runestone.
- **Explorer slots are never researched**: one from the start, more only for
  Gems ([`19-world-map.md`](19-world-map.md) §3.1).

| Card | Opens / moves | Price | |
|---|---|---|---|
| **Cartography** | +50% exploreSpeed | 3,000 G · 4 K · 600 Wood · 300 Stone · 300 Food |  |
| **Farsight I** | +1 discoverRadius | 4,800 G · 5 K · 1,500 Wood · 1,000 Food | *optional* |
| **Frontier Builders I** | +10% worldBuildSpeed | 6,000 G · 5 K · 2,000 Wood · 1,500 Stone |  |
| **Keen Eyes I** | +15% scoutReward | 4,800 G · 5 K · 1,500 Food · 1,000 Stone | *optional* |
| **Farsight II** | +1 discoverRadius | 8,000 G · 5 K · 3 Heartwood | *optional* |
| **Fortification** | the Fortress | 10,000 G · 5 K · 3 Moonglass · 3 Starmetal |  |
| **Forced March I** | +10% armyMarchSpeed | 8,000 G · 5 K · 3 Starmetal | *optional* |
| **Field Notes I** | +15% exploreSpeed | 11,200 G · 6 K · 5 Heartwood | *optional* |
| **Rural Markets I** | +15% improvementYield — Rural district | 14,000 G · 6 K · 5 Moonglass · 5 Starmetal |  |
| **Bounty Hunters I** | +10% campLoot | 11,200 G · 6 K · 5 Starmetal | *optional* |
| **Logging Roads I** | +15% improvementYield — Logging Camp | 14,600 G · 6 K · 7 Heartwood | *optional* |
| **Muster** | the War Camp | 18,200 G · 6 K · 7 Moonglass · 7 Starmetal |  |
| **Quarry Carts I** | +15% improvementYield — Quarry | 14,600 G · 6 K · 7 Starmetal | *optional* |
| **Hunters’ Lodges I** | +15% improvementYield — Farm Lands · +15% improvementYield — Hunting Grounds | 19,000 G · 7 K · 9 Heartwood | *optional* |
| **Holy Ground** | the Chapel | 23,700 G · 7 K · 9 Moonglass · 9 Starmetal |  |
| **Forced March II** | +10% armyMarchSpeed | 19,000 G · 7 K · 9 Starmetal | *optional* |
| **Light Packs I** | +10% explorerSpeed | 24,600 G · 7 K · 11 Heartwood | *optional* |
| **Garrison Rights I** | +1 fortressSlots | 30,800 G · 7 K · 11 Moonglass · 11 Starmetal |  |
| **Delvers I** | +10% dungeonLoot | 24,600 G · 7 K · 11 Starmetal | *optional* |
| **Strongboxes I** | +25% improvementStore — Rural district | 32,000 G · 8 K · 13 Heartwood | *optional* |
| **Frontier Builders II** | +10% worldBuildSpeed | 40,000 G · 8 K · 13 Moonglass · 13 Starmetal |  |
| **Bounty Hunters II** | +10% campLoot | 32,000 G · 8 K · 13 Starmetal | *optional* |
| **Wood Yards I** | +25% improvementStore — Logging Camp | 41,600 G · 8 K · 15 Heartwood | *optional* |
| **Pilgrim Roads I** | +1 chapelSlots | 52,000 G · 8 K · 15 Moonglass · 15 Starmetal |  |
| **Stone Sheds I** | +25% improvementStore — Quarry | 41,600 G · 8 K · 15 Starmetal | *optional* |
| **Field Notes II** | +15% exploreSpeed | 54,100 G · 9 K · 17 Heartwood | *optional* |
| **Deep Digs I** | +10% improvementYield — Grove Camp · +10% improvementYield — Starmetal Dig · +10% improvementYield — Spire Quarry | 67,600 G · 9 K · 17 Moonglass · 17 Starmetal |  |
| **Battle Lore I** | +10% worldHeroXp | 54,100 G · 9 K · 17 Starmetal | *optional* |
| **Rural Markets II** | +15% improvementYield — Rural district | 70,200 G · 9 K · 2 Planks · 2 Cut Stone · 19 Heartwood | *optional* |
| **Menders I** | +25% worldRepairSpeed | 87,800 G · 9 K · 2 Planks · 2 Cut Stone · 19 Moonglass · 19 Starmetal |  |
| **Portal Wardens I** | +10% portalLoot | 70,200 G · 9 K · 2 Planks · 2 Cut Stone · 19 Starmetal | *optional* |
| **Logging Roads II** | +15% improvementYield — Logging Camp | 91,200 G · 10 K · 2 Planks · 2 Cut Stone · 21 Heartwood | *optional* |
| **Forced March III** | +10% armyMarchSpeed | 114,000 G · 10 K · 2 Planks · 2 Cut Stone · 21 Moonglass · 21 Starmetal |  |
| **Quarry Carts II** | +15% improvementYield — Quarry | 91,200 G · 10 K · 2 Planks · 2 Cut Stone · 21 Starmetal | *optional* |
| **Hunters’ Lodges II** | +15% improvementYield — Farm Lands · +15% improvementYield — Hunting Grounds | 118,000 G · 10 K · 3 Planks · 3 Cut Stone · 23 Heartwood | *optional* |
| **Garrison Rights II** | +1 fortressSlots | 148,000 G · 10 K · 3 Planks · 3 Cut Stone · 23 Moonglass · 23 Starmetal |  |
| **Delvers II** | +10% dungeonLoot | 118,000 G · 10 K · 3 Planks · 3 Cut Stone · 23 Starmetal | *optional* |
| **Root Cellars I** | +25% improvementStore — Farm Lands · +25% improvementStore — Hunting Grounds | 154,000 G · 11 K · 3 Planks · 3 Cut Stone · 1 Iron · 25 Heartwood | *optional* |
| **Frontier Builders III** | +10% worldBuildSpeed | 193,000 G · 11 K · 3 Planks · 3 Cut Stone · 1 Iron · 25 Moonglass · 25 Starmetal |  |
| **Bounty Hunters III** | +10% campLoot | 154,000 G · 11 K · 3 Planks · 3 Cut Stone · 1 Iron · 25 Starmetal | *optional* |
| **Star Gazers I** | +25% improvementYield — Observatory | 201,000 G · 11 K · 4 Planks · 4 Cut Stone · 1 Iron · 27 Heartwood | *optional* |
| **Deep Digs II** | +10% improvementYield — Grove Camp · +10% improvementYield — Starmetal Dig · +10% improvementYield — Spire Quarry | 251,000 G · 11 K · 4 Planks · 4 Cut Stone · 1 Iron · 27 Moonglass · 27 Starmetal |  |
| **Keen Eyes II** | +15% scoutReward | 201,000 G · 11 K · 4 Planks · 4 Cut Stone · 1 Iron · 27 Starmetal | *optional* |
| **Light Packs II** | +10% explorerSpeed | 261,000 G · 12 K · 4 Planks · 4 Cut Stone · 2 Iron · 29 Heartwood | *optional* |
| **Deep Vaults I** | +25% improvementStore — Grove Camp · +25% improvementStore — Starmetal Dig · +25% improvementStore — Spire Quarry | 326,000 G · 12 K · 4 Planks · 4 Cut Stone · 2 Iron · 29 Moonglass · 29 Starmetal |  |
| **Battle Lore II** | +10% worldHeroXp | 261,000 G · 12 K · 4 Planks · 4 Cut Stone · 2 Iron · 29 Starmetal | *optional* |
| **Field Notes III** | +15% exploreSpeed | 339,000 G · 12 K · 5 Planks · 5 Cut Stone · 2 Iron · 1 Runestone · 31 Heartwood | *optional* |
| **Pilgrim Roads II** | +1 chapelSlots | 424,000 G · 12 K · 5 Planks · 5 Cut Stone · 2 Iron · 1 Runestone · 31 Moonglass · 31 Starmetal |  |
| **Portal Wardens II** | +10% portalLoot | 339,000 G · 12 K · 5 Planks · 5 Cut Stone · 2 Iron · 1 Runestone · 31 Starmetal | *optional* |
| **Menders II** | +25% worldRepairSpeed | 441,000 G · 13 K · 5 Planks · 5 Cut Stone · 3 Iron · 1 Runestone · 33 Heartwood | *optional* |
| **Frontier Charter** | +10% improvementYield · +10% improvementStore | 551,000 G · 13 K · 5 Planks · 5 Cut Stone · 3 Iron · 1 Runestone · 33 Moonglass · 33 Starmetal |  |
| **Strongboxes II** | +25% improvementStore — Rural district | 441,000 G · 13 K · 5 Planks · 5 Cut Stone · 3 Iron · 1 Runestone · 33 Starmetal | *optional* |
| **Pathfinding** | +1 worldRevealRadius | 1,500,000 G · 30 K · 15 Planks · 15 Cut Stone · 10 Iron · 5 Runestone · 40 Starmetal · 40 Heartwood · 40 Moonglass | **finale** |

## 12. What a bonus can move

The registry is `src/sim/data/techEffectRules.ts`; every stat names the one
call site that reads it. *Cards* counts the technologies that move it.

| Stat | What it moves | Op | Aims at | Cards |
|---|---|---|---|---|
| `tapWorkSeconds` | seconds of work one tap is worth | percent | — | 0 |
| `harvestYield` | the share more one extraction takes out of a kind of cell — the tap and the crew alike; fractions carry | percent | harvest | 9 |
| `regrowthSpeed` | how fast a drained cell grows back — its recovery time is divided by it | percent | harvest | 2 |
| `crewYield` | the share more every worker delivery carries — never the tap; fractions carry | percent | — | 0 |
| `workerSpeed` | tiles a second a worker walks | percent | — | 0 |
| `cellStock` | the share more a cell holds when full — a tree’s Wood, a plot’s Food; never a mountain, which holds no stock | percent | harvest | 2 |
| `respawnSpeed` | how fast a consumed feature comes back somewhere else — its respawn time is divided by it | percent | harvest | 1 |
| `crewStrikeSpeed` | how fast a building’s crew swings — the time between strikes is divided by it | percent | district | 4 |
| `crewSlots` | workers a producer can take on — whole workers, so flat | flat | district | 1 |
| `influenceRadius` | how far a producer’s crew reaches for cells to work — whole tiles, so flat | flat | district | 1 |
| `buildSpeed` | how fast the builders work — build and upgrade times are divided by it | percent | — | 3 |
| `storageCapacity` | units a building’s store holds before the building stops | percent | district | 5 |
| `taxRate` | Gold a housed villager pays a minute | percent | district | 5 |
| `populationCapacity` | beds a district provides — whole villagers, so flat | flat | district | 1 |
| `villagerTrainingSpeed` | how fast the Townhall trains a villager — the time is divided by it | percent | — | 1 |
| `workshopSpeed` | how fast a workshop turns out its good — the work time is divided by it | percent | district | 2 |
| `workshopQueueSlots` | orders a workshop can hold in its queue at once — whole orders, so flat | flat | district | 1 |
| `ownGold` | the Gold the Townhall makes by itself a minute, with nobody in it | percent | — | 1 |
| `decorationHarmony` | Harmony a standing decoration supplies — whole points, so a percent is rounded down | flat, percent | district | 1 |
| `manaCap` | the ceiling of the Mana pool, after every landmark and Sanctum level | percent | — | 0 |
| `manaRegen` | Mana an hour, from every source | percent | — | 0 |
| `knowledgeYield` | the multiplier on every lump of Knowledge — never the drip, never a purchase | percent | — | 0 |
| `landmarkKnowledge` | the share more Knowledge a landmark pays when it is claimed, paid back at once for every landmark held | percent | — | 0 |
| `lairKnowledge` | the share more Knowledge a lair pays when it is cleared, paid back at once for every lair cleared | percent | — | 0 |
| `discoverRadius` | how far a building sees into the fog — whole cells, so flat; never how far it reveals | flat | district | 2 |
| `treasureYield` | the share more a treasure in the fog pays — never the first one, never its Knowledge | percent | — | 1 |
| `explorerSlots` | explorers that can be out on the world board at once — whole explorers, so flat | flat | — | 0 |
| `worldRevealRadius` | hexes an explorer reveals round its target — whole hexes, so flat, and capped | flat | — | 1 |
| `explorerSpeed` | how fast an explorer marches over every hex — each hex’s time is divided by it | percent | — | 3 |
| `exploreSpeed` | how fast an explorer works the hex it was sent to — the work is divided by it | percent | — | 4 |
| `armyMarchSpeed` | how fast an army marches over every hex — each hex’s time is divided by it | percent | — | 3 |
| `improvementYield` | the share more a district on the world board makes an hour — every one, or one kind | percent | worldDistrict | 13 |
| `improvementStore` | the share more a world district’s store holds — every one, or one kind | percent | worldDistrict | 8 |
| `worldBuildSpeed` | how fast a builder raises a district or a building on the world board — the time is divided by it | percent | — | 3 |
| `worldRepairSpeed` | how fast a burnt district on the world board is repaired — the time is divided by it | percent | — | 2 |
| `fortressSlots` | Fortresses the kingdom may hold on the world board — whole Fortresses, so flat | flat | — | 2 |
| `chapelSlots` | Chapels the kingdom may build on the world board — whole Chapels, so flat | flat | — | 2 |
| `campLoot` | the share more a monster camp pays when it is cleared | percent | — | 3 |
| `dungeonLoot` | the share more a dungeon room pays when it is cleared | percent | — | 2 |
| `portalLoot` | the share more a floor of the Dark Portal pays | percent | — | 2 |
| `worldHeroXp` | the share more Hero XP a fight on the world board pays — camps, dungeons and the Portal | percent | — | 2 |
| `scoutReward` | the share more a hex pays the explorer who reveals it — never its pack | percent | — | 2 |
| `armyCap` | the army power the halls can field | percent | — | 1 |
| `recruitSpeed` | how fast a hall trains a soldier — the time is divided by it | percent | unit | 0 |
| `unitAtk` | the share more a unit hits for | percent | unitTag | 3 |
| `unitDef` | the share more a unit shrugs off | percent | unitTag | 3 |
| `unitHp` | the share more health every unit fields with | percent | — | 1 |
| `infirmaryBeds` | the wounded the Infirmary can hold | percent | — | 0 |
| `healSpeed` | how fast the Infirmary mends — a ward’s time is divided by it, priced when the mending starts | percent | — | 1 |
| `heroXp` | the multiplier on every grant of Hero XP | percent | — | 1 |
| `summonStardust` | the multiplier on the Stardust a call on a banner draws | percent | — | 1 |

## 13. Dials, in the order to reach for them

| Dial | Where | What it moves |
|---|---|---|
| a card's `knowledge`, `gold`, `materials` (Wood, Stone, Food), `goods`, `anyPrecious` | `?dev=data#tree` | one card |
| `kind`, `unlocks`, `effects` | `?dev=data#tree` | what a card is |
| `requires` and the slot | `?dev=data#tree` | the shape; what is on the spine |
| a chapter's cells | `?dev=data#tree` (`eras`) | when a chapter opens |
| a chapter's fragments | `tech-tree.json` (`eraRewards`) | what finishing it pays |
| what opens a found book | `sim/research.ts` `TOME_OPENS` | code |

## 14. Deliberately not in this design

- More than one general book.
- A card about the tap or the Mana pool.
- A bonus that shrinks a number, or a card that discounts a price.
- A planned card in the shipped tree: a card that does nothing is not in it.
- A refund for a card that left the tree.
