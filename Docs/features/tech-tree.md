# The tech tree — every node, book by book

> **Scope.** The **content** of the five books: every card, what each opens
> or moves, the rank ladders, and the price bands that pace them. The
> **system** — technologies, books, eras, Knowledge, the screen — is
> [`07-research.md`](07-research.md); what opens each book is
> [`22-progression.md`](22-progression.md) §4; where a card SITS and what it
> requires is [`../tech-tree-editor.md`](../tech-tree-editor.md).
>
> **Status.** Built: **167 technologies** in `src/sim/data/tech-tree.json`,
> authored in `?dev=data#tree`. The tables below are generated from that file.

## 1. The shape

- A page mixes four kinds of card ([`22-progression.md`](22-progression.md) §9):
  cards that open a **building**, a **building level**, a **mechanic**, and
  many small **bonuses**.
- **Every bonus climbs.** A bonus is a positive percentage — or, for whole
  things like a bed or a ring of sight, a positive step. A wait is a speed;
  nothing is a discount ([`07-research.md`](07-research.md) §1.2).
- A **ladder** is a stem plus a roman numeral; rank N sits one band deeper
  than rank N−1 or further down the same band. Each rank is an ordinary card
  gated by the row above it.
- *(planned)*: on the page, researchable, no effect yet (§9).

| Book | Opens on | Remit | Bands (cells revealed) | Cards |
|---|---|---|---|---|
| **Civics** | from the first minute | the city and its purse | 0 · 43 · 100 | 75 |
| **Warfare** | handed over once the first lair is **found** | the army, and the lairs it clears | 0 · 85 · 100 · 220 | 40 |
| **Magic** | the first landmark **claimed** | Mana, Knowledge, the Sanctum, the water | 0 · 30 · 100 · 220 | 28 |
| **Sagas** | a **Tavern** standing (found) | heroes, and the Tavern that hosts them | 0 · 100 | 11 |
| **Atlas** | the **Watchtower** claimed (found) | sight, landmarks, the world beyond | 0 · 220 | 13 |

## 2. Civics

### 2.1 Era 1 — 19 cards · 30 K · 1,630 Gold

| Card | Opens / does | Price |
|---|---|---|
| **Forestry** | the Forest tap, the Berries tap | 20 G · 2 K |
| **Agriculture** | the FarmLands | 25 G · 2 K |
| **Pickaxes** | the Stone tap | 25 G · 2 K |
| **Farming** | the Farm | 25 G · 2 K |
| **Hunting** | the Meat tap | 30 G · 2 K |
| **Saws** | the Sawmill | 30 G · 2 K |
| **Urban Planning** | Housing L2 | 200 G · 2 K |
| **Masonry** | the Quarry | 100 G · 2 K |

| Rank | Moves | Price |
|---|---|---|
| Trade Routes I | +5% tax income | 100 G · 2 K |
| Irrigation I | +10% Food from crop plots | 120 G · 1 K |
| Sawpits I | +10% Wood from forests | 120 G · 1 K |
| Crop Rotation I | +10% regrowth speed — crops | 100 G · 2 K |
| Reforesting I | +10% regrowth speed — forest | 100 G · 2 K |
| Carpentry I | +10% build speed | 60 G · 1 K |
| Stonecutting I | +10% Stone from mountains | 100 G · 1 K |
| Granaries I | +10% storage in every store | 150 G · 1 K |
| Tap Power I | +20% out of every tap | 50 G · 1 K |
| Worker Load I | +10% on every worker delivery | 200 G · 1 K |
| Quick Hands I | +15% auto-tap speed | 75 G · 1 K |

### 2.2 Era 2 — 22 cards · 68 K · 14,550 Gold

| Card | Opens / does | Price |
|---|---|---|
| **Hospitality** | the Tavern | 400 G · 3 K |
| **Bureaucracy** | Townhall L3 | 800 G · 2 K |
| **Communities** | +1 bed in every house | 1,000 G · 4 K |
| **Mining** | the Smelter, the MountainIron tap | 2,500 G · 6 K |

| Rank | Moves | Price |
|---|---|---|
| Schooling I | +20% villager training speed | 300 G · 2 K |
| Trade Routes II | +5% tax income | 600 G · 3 K |
| Butchery I | +10% Food from wild game | 250 G · 2 K |
| Granaries II | +10% storage in every store | 600 G · 3 K |
| Iron Picks I | +10% Stone from iron mountains | 250 G · 2 K |
| Carpentry II | +10% build speed | 525 G · 3 K |
| Tap Power II | +20% out of every tap | 525 G · 3 K |
| Iron Picks II | +10% Stone from iron mountains | 800 G · 3 K |
| Schooling II | +20% villager training speed | 525 G · 3 K |
| Quick Hands II | +15% auto-tap speed | 525 G · 3 K |
| Worker Load II | +10% on every worker delivery | 800 G · 4 K |
| Sawpits II | +10% Wood from forests | 525 G · 3 K |
| Irrigation II | +10% Food from crop plots | 525 G · 3 K |
| Stonecutting II | +10% Stone from mountains | 525 G · 3 K |
| Reforesting II | +10% regrowth speed — forest | 525 G · 3 K |
| Crop Rotation II | +10% regrowth speed — crops | 525 G · 3 K |
| Terracing I | +10% regrowth speed — stone | 525 G · 3 K |
| Trade Routes III | +5% tax income | 1,000 G · 4 K |

### 2.3 Era 3 — 34 cards · 414 K · 153,250 Gold

| Card | Opens / does | Price |
|---|---|---|
| **Magistracy** | Townhall L4 | 5,000 G · 15 K |
| **Joinery** | the Carpenter | 4,000 G · 10 K |
| **Aqueducts** | Housing L3 | 6,000 G · 15 K |
| **Stone Dressing** | the MasonsYard | 4,000 G · 10 K |
| **Timber Framing** | Sawmill L3 | 5,000 G · 12 K |
| **Quarry Hoists** | Quarry L2 | 5,000 G · 12 K |
| **Gardening** | the Garden, the Orchard | 6,000 G · 15 K |
| **Architecture** | Sawmill L4, Quarry L3 | 8,000 G · 20 K |
| **Sculpture** | the Well, the Statue | 7,500 G · 18 K |
| **Deep Mining** | the MountainGold tap | 8,000 G · 20 K |
| **Roadworks** | +25% worker walking speed | 10,000 G · 20 K |
| **Paving** | the Plaza | 9,000 G · 20 K |
| **Sacred Grounds** | the Shrine | 12,000 G · 25 K |

| Rank | Moves | Price |
|---|---|---|
| Guild Halls I | +10% workshop speed | 3,000 G · 8 K |
| Granaries III | +10% storage in every store | 3,000 G · 8 K |
| Carpentry III | +10% build speed | 3,250 G · 10 K |
| Worker Load III | +10% on every worker delivery | 3,250 G · 10 K |
| Sawpits III | +10% Wood from forests | 3,250 G · 10 K |
| Irrigation III | +10% Food from crop plots | 3,250 G · 10 K |
| Stonecutting III | +10% Stone from mountains | 3,250 G · 10 K |
| Butchery II | +10% Food from wild game | 3,250 G · 10 K |
| Iron Picks III | +10% Stone from iron mountains | 3,250 G · 10 K |
| Gold Panning I | +10% Gold from gold mountains | 3,000 G · 10 K |
| Cartage I | +10% worker walking speed | 1,500 G · 8 K |
| Tap Power III | +20% out of every tap | 1,500 G · 8 K |
| Guild Halls II | +10% workshop speed | 3,000 G · 10 K |
| Cartage II | +10% worker walking speed | 3,250 G · 10 K |
| Quick Hands III | +15% auto-tap speed | 1,500 G · 8 K |
| Big Nets I | +10% Food from shoals | 1,500 G · 8 K |
| Gold Panning II | +10% Gold from gold mountains | 3,250 G · 10 K |
| Trade Routes IV | +5% tax income | 3,250 G · 10 K |
| Cartage III | +10% worker walking speed | 5,000 G · 12 K |
| Tap Power IV | +20% out of every tap | 3,250 G · 10 K |
| Trade Routes V | +5% tax income | 5,000 G · 12 K |

### 2.4 Ladders

| Ladder | Per rank | Ranks by era |
|---|---|---|
| **Big Nets** | +10% Food from shoals | — / — / I |
| **Butchery** | +10% Food from wild game | — / I / II |
| **Carpentry** | +10% build speed | I / II / III |
| **Cartage** | +10% worker walking speed | — / — / I·II·III |
| **Crop Rotation** | +10% regrowth speed — crops | I / II / — |
| **Gold Panning** | +10% Gold from gold mountains | — / — / I·II |
| **Granaries** | +10% storage in every store | I / II / III |
| **Guild Halls** | +10% workshop speed | — / — / I·II |
| **Iron Picks** | +10% Stone from iron mountains | — / I·II / III |
| **Irrigation** | +10% Food from crop plots | I / II / III |
| **Quick Hands** | +15% auto-tap speed | I / II / III |
| **Reforesting** | +10% regrowth speed — forest | I / II / — |
| **Sawpits** | +10% Wood from forests | I / II / III |
| **Schooling** | +20% villager training speed | — / I·II / — |
| **Stonecutting** | +10% Stone from mountains | I / II / III |
| **Tap Power** | +20% out of every tap | I / II / III·IV |
| **Terracing** | +10% regrowth speed — stone | — / I / — |
| **Trade Routes** | +5% tax income | I / II·III / IV·V |
| **Worker Load** | +10% on every worker delivery | I / II / III |


## 3. Warfare

### 3.1 Era 1 — 6 cards · 11 K · 4,200 Gold

| Card | Opens / does | Price |
|---|---|---|
| **Warrior** | the Barracks, the Warrior | 500 G · 2 K |
| **Infirmary** | the Infirmary | 800 G · 3 K |

| Rank | Moves | Price |
|---|---|---|
| Drill Yards I | +15% soldier training speed | 550 G · 1 K |
| Shield Wall I | +10% defence, Melee units | 550 G · 1 K |
| Warhorns I | +5% attack, every unit | 900 G · 2 K |
| Beds I | +20% Infirmary beds | 900 G · 2 K |

### 3.2 Era 2 — 8 cards · 28 K · 13,400 Gold

| Card | Opens / does | Price |
|---|---|---|
| **Archery** | the ShootingGrounds, the Archer | 1,200 G · 4 K |
| **Spears** | the SpearHall, the Lancer | 1,800 G · 4 K |
| **Warband II** | Barracks L4, SpearHall L4, ShootingGrounds L4, Stables L4 | 2,500 G · 5 K |

| Rank | Moves | Price |
|---|---|---|
| Colours I | +10% army cap | 1,300 G · 3 K |
| Fletching I | +10% attack, Distance units | 1,300 G · 3 K |
| Bounties I | +20% Knowledge per lair cleared | 1,300 G · 3 K |
| Vigour I | +5% health, every unit | 2,000 G · 3 K |
| Shield Wall II | +10% defence, Melee units | 2,000 G · 3 K |

### 3.3 Era 3 — 25 cards · 254 K · 195,000 Gold

| Card | Opens / does | Price |
|---|---|---|
| **Tactics** | Reading the ground — a bad matchup costs a tenth less. | 3,000 G · 6 K |
| **Cavalry** | the Stables, the Cavalry | 4,000 G · 15 K |
| **Warband III** | Barracks L5, SpearHall L5, ShootingGrounds L5, Stables L5 | 7,000 G · 15 K |

| Rank | Moves | Price |
|---|---|---|
| Drill Yards II | +15% soldier training speed | 3,000 G · 6 K |
| Fletching II | +10% attack, Distance units | 3,000 G · 6 K |
| Barding I | +10% defence, Mounted units | 4,500 G · 7 K |
| Warhorns II | +5% attack, every unit | 4,500 G · 7 K |
| Barding II | +10% defence, Mounted units | 5,000 G · 8 K |
| Colours II | +10% army cap | 5,000 G · 8 K |
| Vigour II | +5% health, every unit | 7,500 G · 10 K |
| Beds II | +20% Infirmary beds | 7,500 G · 10 K |
| Bounties II | +20% Knowledge per lair cleared | 7,500 G · 10 K |
| Shield Wall III | +10% defence, Melee units | 8,000 G · 10 K |
| Drill Yards III | +15% soldier training speed | 8,000 G · 10 K |
| Fletching III | +10% attack, Distance units | 8,000 G · 10 K |
| Colours III | +10% army cap | 9,000 G · 11 K |
| Warhorns III | +5% attack, every unit | 10,000 G · 11 K |
| Bounties III | +20% Knowledge per lair cleared | 10,000 G · 11 K |
| Barding III | +10% defence, Mounted units | 10,000 G · 11 K |
| Vigour III | +5% health, every unit | 11,000 G · 12 K |
| Beds III | +20% Infirmary beds | 11,000 G · 12 K |
| Colours IV | +10% army cap | 11,000 G · 12 K |
| Warhorns IV | +5% attack, every unit | 12,500 G · 12 K |
| Bounties IV | +20% Knowledge per lair cleared | 12,500 G · 12 K |
| Colours V | +10% army cap | 12,500 G · 12 K |

### 3.4 Era 4 — 1 cards · 40 K · 30,000 Gold

| Card | Opens / does | Price |
|---|---|---|
| **Warband IV** | Marching order. Each banner raised lets the four halls train a rank higher, and a bigger hall is a bigger army. | 30,000 G · 40 K |

### 3.5 Ladders

| Ladder | Per rank | Ranks by era |
|---|---|---|
| **Barding** | +10% defence, Mounted units | — / — / I·II·III / — |
| **Beds** | +20% Infirmary beds | I / — / II·III / — |
| **Bounties** | +20% Knowledge per lair cleared | — / I / II·III·IV / — |
| **Colours** | +10% army cap | — / I / II·III·IV·V / — |
| **Drill Yards** | +15% soldier training speed | I / — / II·III / — |
| **Fletching** | +10% attack, Distance units | — / I / II·III / — |
| **Shield Wall** | +10% defence, Melee units | I / II / III / — |
| **Vigour** | +5% health, every unit | — / I / II·III / — |
| **Warhorns** | +5% attack, every unit | I / — / II·III·IV / — |

- **The page is a run of funnels**: each unlock on the middle column forks
  into two or three small bonuses, which merge into the next unlock. Nothing
  leads nowhere. The unlocks come in this order: Warrior, Infirmary, Archery,
  Spears, Warband II, Cavalry, Warband III, Warband IV.
- **Every card costs 500 Gold or more**, and no card costs less than one on a
  row above it (`tests/techTree.test.ts`).

## 4. Magic

### 4.1 Era 1 — 7 cards · 11 K · 1,030 Gold

| Card | Opens / does | Price |
|---|---|---|
| **Consecration** | the Sanctum | 400 G · 2 K |
| **Invocation** | Spoken twice — a relic’s active gains a second charge. *(planned)* | 150 G · 2 K |
| **Meditation** | +20% Mana held | 150 G · 2 K |
| **Ley Reading** | Reading the lines — a landmark shows what it grants before you pay. *(planned)* | 150 G · 2 K |

| Rank | Moves | Price |
|---|---|---|
| Deep Wells I | +10% Mana held | 60 G · 1 K |
| Ley Taps I | +10% Mana regeneration | 60 G · 1 K |
| Scriptorium I | +10% on every lump of Knowledge | 60 G · 1 K |

### 4.2 Era 2 — 10 cards · 36 K · 9,475 Gold

| Card | Opens / does | Price |
|---|---|---|
| **Attunement II** | Sanctum L4, the RuneCarver | 800 G · 3 K |
| **Sailing** | Water cells | 1,000 G · 4 K |
| **Ley Lines** | The land’s own current — a district beside the Sanctum produces a tenth more. *(planned)* | 2,200 G · 6 K |

| Rank | Moves | Price |
|---|---|---|
| Deep Wells II | +10% Mana held | 525 G · 2 K |
| Scriptorium II | +10% on every lump of Knowledge | 525 G · 2 K |
| Ley Taps II | +10% Mana regeneration | 525 G · 3 K |
| Scriptorium III | +10% on every lump of Knowledge | 800 G · 3 K |
| Deep Wells III | +10% Mana held | 800 G · 3 K |
| Scriptorium IV | +10% on every lump of Knowledge | 1,500 G · 6 K |
| Ley Taps III | +10% Mana regeneration | 800 G · 4 K |

### 4.3 Era 3 — 10 cards · 143 K · 66,250 Gold

| Card | Opens / does | Price |
|---|---|---|
| **Fishing** | the Docks | 6,000 G · 15 K |
| **Attunement III** | Sanctum L5 | 5,000 G · 15 K |
| **Shipbuilding** | Docks L2 | 7,800 G · 18 K |
| **Second Sanctum** | one more Sanctum | 15,000 G · 25 K |
| **Ley Storm** | Once a day — a kingdom-wide surge of production for a while. *(planned)* | 13,200 G · 20 K |

| Rank | Moves | Price |
|---|---|---|
| Deep Wells IV | +10% Mana held | 3,250 G · 10 K |
| Ley Taps IV | +10% Mana regeneration | 3,000 G · 8 K |
| Scriptorium V | +10% on every lump of Knowledge | 3,000 G · 8 K |
| Deep Wells V | +10% Mana held | 5,000 G · 12 K |
| Ley Taps V | +10% Mana regeneration | 5,000 G · 12 K |

### 4.4 Era 4 — 1 cards · 40 K · 30,000 Gold

| Card | Opens / does | Price |
|---|---|---|
| **Attunement IV** | Communion with the land. Each degree of it lets the Sanctum hold a level more, and the Sanctum is where Mana comes from. | 30,000 G · 40 K |

### 4.5 Ladders

| Ladder | Per rank | Ranks by era |
|---|---|---|
| **Deep Wells** | +10% Mana held | I / II·III / IV·V / — |
| **Ley Taps** | +10% Mana regeneration | I / II·III / IV·V / — |
| **Scriptorium** | +10% on every lump of Knowledge | I / II·III·IV / V / — |


## 5. Sagas

### 5.1 Era 1 — 6 cards · 20 K · 4,500 Gold

| Card | Opens / does | Price |
|---|---|---|
| **Common Room** | Tavern L2 | 600 G · 3 K |
| **Guest Rooms** | Tavern L3 | 1,500 G · 5 K |

| Rank | Moves | Price |
|---|---|---|
| Tales I | +10% Hero XP | 400 G · 2 K |
| Warm Welcome I | +10% Stardust per call | 400 G · 2 K |
| Tales II | +10% Hero XP | 800 G · 4 K |
| Warm Welcome II | +10% Stardust per call | 800 G · 4 K |

### 5.2 Era 2 — 5 cards · 49 K · 21,000 Gold

| Card | Opens / does | Price |
|---|---|---|
| **Great Hall** | Tavern L4 | 4,000 G · 10 K |
| **Rumours** | Word at the bar — a daily job for the party, paid in production. *(planned)* | 3,000 G · 8 K |
| **Minstrels’ Gallery** | Tavern L5 | 8,000 G · 15 K |

| Rank | Moves | Price |
|---|---|---|
| Tales III | +10% Hero XP | 3,000 G · 8 K |
| Warm Welcome III | +10% Stardust per call | 3,000 G · 8 K |

### 5.3 Ladders

| Ladder | Per rank | Ranks by era |
|---|---|---|
| **Tales** | +10% Hero XP | I·II / III |
| **Warm Welcome** | +10% Stardust per call | I·II / III |


## 6. Atlas

### 6.1 Era 1 — 9 cards · 53 K · 19,100 Gold

| Card | Opens / does | Price |
|---|---|---|
| **Cartography** | The first explorer — send it out to reveal the world map. | 2,000 G · 6 K |

| Rank | Moves | Price |
|---|---|---|
| Farsight I | +1 sight into the fog | 800 G · 3 K |
| Wayposts I | +20% Knowledge per landmark claimed | 800 G · 3 K |
| Farsight II | +1 sight into the fog | 1,500 G · 5 K |
| Wayposts II | +20% Knowledge per landmark claimed | 1,500 G · 5 K |
| Farsight III | +1 sight into the fog | 3,000 G · 8 K |
| Wayposts III | +20% Knowledge per landmark claimed | 3,000 G · 8 K |
| Scouts I | +1 explorer out at once | 2,500 G · 6 K |
| Scouts II | +1 explorer out at once | 4,000 G · 9 K |

### 6.2 Era 2 — 4 cards · 68 K · 29,000 Gold

| Card | Opens / does | Price |
|---|---|---|
| **Pathfinding** | +1 hex an explorer sees round its path | 8,000 G · 18 K |
| **Muster** | Opens the War Camp — more armies out at once | 9,000 G · 20 K |

| Rank | Moves | Price |
|---|---|---|
| Farsight IV | +1 sight into the fog | 6,000 G · 15 K |
| Wayposts IV | +20% Knowledge per landmark claimed | 6,000 G · 15 K |

### 6.3 Ladders

| Ladder | Per rank | Ranks by era |
|---|---|---|
| **Farsight** | +1 sight into the fog | I·II·III / IV |
| **Wayposts** | +20% Knowledge per landmark claimed | I·II·III / IV |
| **Scouts** | +1 explorer out at once | I·II |

## 7. Prices, in bands

| | Minor (a rank) | Major | 
|---|---|---|
| **Era 1** | 50–200 G · 1–2 K | 20–400 G · 2–3 K — the quest chain pays Civics' |
| **Warfare** | 550–12,500 G, climbing down the page | 500 G (Warrior) to 7,000 G (Warband III) |
| **Era 2** | 250–1,000 G · 2–4 K | 400–2,500 G · 2–8 K |
| **Era 3** | 1,500–5,000 G · 8–14 K | 4,000–15,000 G · 10–25 K |
| **Era 4** | — | Warband IV, Attunement IV — 30,000 G · 40 K |

| Era | Gold | Knowledge |
|---|---|---|
| 1 | 30,460 | 125 |
| 2 | 87,425 | 249 |
| 3 | 414,500 | 811 |
| 4 | 60,000 | 80 |
| **All** | **592,385** | **1,265** |

- The pace these prices set is [`22-progression.md`](22-progression.md) §8.
- The quest chain funds the **opening** — every era-1 card it asks for — with
  no drip at all (`tests/quests.test.ts`). Past the opening the drip and the
  lumps pay.

## 8. What a bonus can move

The registry is `src/sim/data/techEffectRules.ts`; every stat names the one call site that reads it, and `tests/techTree.test.ts` refuses a stat nothing reads. **Two books never move the same stat.**

| Stat | Book | How it enters |
|---|---|---|
| `armyCap` | Warfare | multiplies the number |
| `armyMarchSpeed` | — | an army's time per hex on the world board is divided by it; the city sends the pace with the army |
| `autoTapSpeed` | Civics | the auto-tap cooldown is divided by it |
| `buildSpeed` | Civics | build and upgrade times are divided by it |
| `cellStock` | — | multiplies what a cell holds when full; never a mountain, which holds no stock |
| `crewSlots` | — | whole workers, added to a producer's level |
| `crewStrikeSpeed` | — | the time between a building's crew strikes is divided by it |
| `crewYield` | Civics | multiplies a worker delivery; the fraction carries |
| `decorationHarmony` | — | added to, or multiplying, a decoration's Harmony; whole points, rounded down |
| `discoverRadius` | Atlas | whole rings, added |
| `explorerSlots` | Atlas | whole explorers, added to Cartography's |
| `explorerSpeed` | — | an explorer's time per hex is divided by it, before the Scout's boon |
| `harvestYield` | Civics | multiplies the chunk a tap and a strike take; the fraction carries |
| `healSpeed` | — | a ward's mending time is divided by it, priced when it starts |
| `heroXp` | Sagas | multiplies the number |
| `improvementStore` | — | multiplies a world improvement's store; the server settles every store when it changes |
| `improvementYield` | — | multiplies what a world improvement makes an hour; the server settles every store when it changes |
| `infirmaryBeds` | Warfare | multiplies the number |
| `influenceRadius` | — | whole tiles, added to a producer's reach |
| `knowledgeYield` | Magic | multiplies the number |
| `lairKnowledge` | Warfare | multiplies the number |
| `landmarkKnowledge` | Atlas | multiplies the number |
| `manaCap` | Magic | multiplies the number |
| `manaRegen` | Magic | multiplies the number |
| `ownGold` | — | multiplies the Gold the Townhall makes by itself |
| `populationCapacity` | Civics | whole beds, added |
| `recruitSpeed` | Warfare | a soldier’s training time is divided by it |
| `regrowthSpeed` | Civics | a stump’s wait is divided by it |
| `respawnSpeed` | — | a consumed feature's wait to come back is divided by it |
| `storageCapacity` | Civics | multiplies the number |
| `summonStardust` | Sagas | multiplies the number |
| `tapWorkSeconds` | Civics | multiplies the number |
| `taxRate` | Civics | multiplies the number |
| `treasureYield` | — | multiplies a fog treasure priced in production; never the first, never Knowledge |
| `unitAtk` | Warfare | multiplies the number |
| `unitDef` | Warfare | multiplies the number |
| `unitHp` | Warfare | multiplies the number |
| `villagerTrainingSpeed` | Civics | a villager’s training time is divided by it |
| `workerSpeed` | Civics | multiplies the number |
| `workshopQueueSlots` | — | whole orders, added to a workshop's queue |
| `workshopSpeed` | Civics | a workshop item’s work time is divided by it |
| `worldRevealRadius` | Atlas | whole hexes round an explorer's path, added, capped at 2 |

## 9. Planned cards

On the page, researchable, and doing nothing yet — each a promise of a mechanic still to come. Nothing requires one.

| Card | Book | The promise |
|---|---|---|
| **Invocation** | Magic | Spoken twice — a relic’s active gains a second charge. |
| **Ley Reading** | Magic | Reading the lines — a landmark shows what it grants before you pay. |
| **Ley Lines** | Magic | The land’s own current — a district beside the Sanctum produces a tenth more. |
| **Ley Storm** | Magic | Once a day — a kingdom-wide surge of production for a while. |
| **Rumours** | Sagas | Word at the bar — a daily job for the party, paid in production. |

## 10. Dials, in the order to reach for them

| Dial | Where | What it moves |
|---|---|---|
| a card's `gold` / `knowledge` | `?dev=data#tree` | one card |
| a band's cells | `?dev=data#tree` (`eras`) | when a band opens |
| `requires` | `?dev=data#tree` | the shape |
| `kind`, `unlocks`, `effects` | `?dev=data#tree` | what a card IS |
| what opens a book | `sim/research.ts` `TOME_OPENS` | code, by design |

## 11. Deliberately not in this design

- A bonus that shrinks a number, or a card that discounts a price.
- A flat bonus on a yield ("+1 Wood a strike"): a percentage never goes stale.
- A technology that opens a book.
- Exclusive picks — no card forecloses another.
- A ladder longer than five ranks.
- A rank ladder hanging off a planned card.
