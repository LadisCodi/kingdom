# The tech tree — every node, era by era

> **Scope.** The **content** of the three tomes: every node, what each unlocks,
> the minor lines, the price bands that pace them, and the effect hooks the
> lines drive. The **system** — technologies, tomes, eras, keystones,
> Knowledge, slots, the screen — is [`07-research.md`](07-research.md).
> `src/sim/data/definitions.ts` points at this file.
>
> **Status.** Built: **180 technologies** in the `Technologies` sheet, priced
> to §5's bands, with every §6 effect hook in. **17 era-2/3 majors are on the
> tree flagged `planned`** — drawn, researchable, no effect yet (§7). **Nine
> minor lines are designed, not built**, and are marked so in the tables.

## 1. Reading the tables

- **Major** unlocks content; **minor** is one numeric step with a roman
  numeral; the **spine** is the tome's keystone line
  ([`07-research.md`](07-research.md) §1.1, §2.1).
- Node counts per era include that era's spine rank and every rank row.
- **Ranks by era** reads era 1 / era 2 / era 3: `I·II / III·IV / V` means
  ranks I and II land in era 1, III and IV in era 2, V in era 3; `—` is no
  rank that era.
- *(planned)*: on the tree, no effect yet (§7). *(designed, not built)*: not
  in the workbook.
- A technology never requires a technology in another tome.

## 2. Tome I — Civics — 71 nodes

> *The city and its purse.* Open from the start.

**Spine.**

| Rank | Cost | Grants |
|---|---|---|
| `Charter I` | free, granted at game start | — |
| `Charter II` | keystone | Townhall 3 |
| `Charter III` | keystone | Townhall 4 |
| `Charter IV` | sealed | Townhall 5 |

### 2.1 Era 1 · Settlement — 16 nodes

| Major | Unlocks |
|---|---|
| **Forestry** | the forest and berry taps |
| **Saws** | the Sawmill |
| **Agriculture** | crop plots and the Farm that works them |
| **Masonry** | the Quarry |
| **Urban Planning** | Housing level 2 |

### 2.2 Era 2 · Township — 20 nodes

| Major | Unlocks |
|---|---|
| **Hunting** | the wild game tap |
| **Farming** | Farm level 2 |
| **Market** | the Market |
| **Mining** | the Mine |
| **Communities** | +1 resident in every Housing |

### 2.3 Era 3 · Borough — 34 nodes

| Major | Unlocks |
|---|---|
| **Engineering** | Quarry L2, Sawmill L3 |
| **Deep Mining** | Mine L2 |
| **Architecture** | Quarry L3, Sawmill L4, Mine L3 |
| **Aqueducts** | Housing L3 |
| **Guildhalls** | a second Market (`extra_count_tech` on the district) |
| **Roadworks** | workers move faster — `worker.moveSpeedTilesPerSecond` 1 → 1.25 |
| **Land Survey** *(planned)* | +1 influence radius on every district |
| **Apprenticeships** *(planned)* | the Townhall trains two villagers at once |

### 2.4 Civics minor lines

| Line | Effect per rank | Ranks by era |
|---|---|---|
| **Tap Power I–V** | +1 per collect tap | I·II / III·IV / V |
| **Trade Routes I–V** | +10% tax income | — / I·II / III·IV·V |
| **Quick Hands I–III** | −0.05 s between auto-taps while holding | I / II / III |
| **Worker Load I–III** | +1 per worker delivery | I / II / III |
| **Sawpits I–III** | +1 Wood per worker delivery | I / II / III |
| **Scythes I–III** | +1 Food per tap on a crop plot | I / II / III |
| **Stonecutting I–III** | +1 Stone per worker delivery | I / II / III |
| **Carpentry I–III** | −5% district build time | I / II / III |
| **Foraging I–II** *(designed, not built)* | +1 Food per tap on a berry bush | I / II |
| **Butchery I–III** | +1 Food per tap on game | — / I / II |
| **Irrigation I–III** | +1 Food per delivery from a farm | — / I / II |
| **Iron Picks I–III** | +1 Stone per delivery from a vein | — / I / II |
| **Market Stall I–III** | +5% Market sale prices | — / I / II |
| **Almshouses I–II** *(designed, not built)* | +1 further resident in every Housing | — / I / II |
| **Load-Bearing I–III** *(designed, not built)* | +1 Stone per tap on rocks | — / — / I |
| **Scriveners I–III** | −5% research time | — / — / I |
| **Cartage I–III** | +5% worker move speed | — / — / I |

## 3. Tome II — Warfare — 52 nodes

> *The army, and what it goes into the ground for.* Opens on your first
> discovered ruin.

**Spine.**

| Rank | Cost | Grants |
|---|---|---|
| `Warband I` | free, granted when the tome opens | — |
| `Warband II` | keystone | the four halls reach L4; **veteran** units can be recruited |
| `Warband III` | keystone | halls L5; **champion** units |
| `Warband IV` | sealed | — |

- A unit tier is a spine grant, never an era leaf: it arrives with the army
  cap that fields it.

### 3.1 Era 1 · The Levy — 9 nodes

| Major | Unlocks |
|---|---|
| **Warrior** | the Barracks and the Warrior |
| **Spears** | the Spear Hall and the Lancer |
| **Archery** | the Shooting Grounds and the Archer |
| **Cavalry** | the Stables and the Cavalry |
| **Field Medicine** *(planned)* | the party recovers HP **between depths** |

### 3.2 Era 2 · The Company — 17 nodes

| Major | Unlocks |
|---|---|
| **Veterancy** *(planned)* | heroes gain levels from delving |
| **Siegecraft** *(planned)* | a party can clear a **defended landmark** |
| **Tactics** | the type-disadvantage penalty softens, 0.75 → 0.85 (through the `Drill`) |
| **Scouting** *(planned)* | a ruin's threat type shows before you launch |

### 3.3 Era 3 · The Host — 25 nodes

| Major | Unlocks |
|---|---|
| **Salvage** | a failed delve loses **35%** of the haul, not 50% |
| **Vanguard** *(planned)* | depth 1 of a ruin you have already cleared resolves instantly |
| **Standards** *(planned)* | army power cap rises with military hall level |
| **Conquest** | +3 Knowledge/h per cleared ruin, on top of the cleared rate ([`07-research.md`](07-research.md) §3) |

### 3.4 Warfare minor lines

| Line | Effect per rank | Ranks by era |
|---|---|---|
| **Colours I–V** | +2 army power cap | I / II·III / IV·V |
| **Shield Wall I–III** | +1 DEF to Melee units | I / II / III |
| **Fletching I–III** | +1 ATK to Distance units | I / II / III |
| **Barding I–III** | +1 DEF to Mounted units | I / II / III |
| **Poultices I–III** *(designed, not built)* | +5% HP recovered between depths | I / II / III |
| **Rations I–III** | −5% expedition supply cost | I / II / III |
| **Muster Drill I–III** | −10% unit recruit cost | I / II / III |
| **Drillmaster I–III** | +5% hero XP | — / I / II |
| **Manoeuvre I–III** | +2% off the type-disadvantage penalty | — / I / II |
| **Bearers I–III** | −3% haul lost on a failed delve, floor 20% | — / I / II |
| **Warhorns I–III** | +1 ATK to all units | — / — / I |
| **Pathfinders I–III** | −10% expedition duration | — / — / I |

## 4. Tome III — Magic — 57 nodes

> *The land's magic, and what you can see of it.* Opens on your first paid
> reveal.

**Spine.**

| Rank | Cost | Grants |
|---|---|---|
| `Attunement I` | free, granted when the tome opens | — |
| `Attunement II` | keystone | Sanctum L4 and a step in the Mana ceiling |
| `Attunement III` | keystone | Sanctum L5 and another step |
| `Attunement IV` | sealed | — |

- The Sanctum itself is unlocked by **Consecration** in era 1; the spine only
  raises what already exists.
- `Attunement` is a spine name, not a technology; the quest `Attuned` targets
  `Consecration`.

### 4.1 Era 1 · The Awakening — 13 nodes

| Major | Unlocks |
|---|---|
| **Cartography** | every tap on the fog counts **double** |
| **Consecration** | the Sanctum |
| **Meditation** | raises the base Mana ceiling (+30) |
| **Ley Reading** *(planned)* | a landmark shows what it grants **before** you pay for it |
| **Scrying** *(planned)* | a ruin's tier shows before you commit a party |
| **Invocation** *(planned)* | a relic's active gains a **second charge** |

### 4.2 Era 2 · The Attuned — 21 nodes

| Major | Unlocks |
|---|---|
| **Sailing** | sea cells become explorable |
| **Scaling Tools** | mountain cells become explorable |
| **Lorekeeping** *(planned)* | ruins give up more of what they hold |
| **Wayshrines** *(planned)* | a **cleared** defended landmark becomes claimable, and claim costs drop |
| **Ley Lines** *(planned)* | a district adjacent to the Sanctum produces +10% — the first adjacency rule that is not Housing↔Housing; [`02-map-scopes.md`](02-map-scopes.md) §1.1 is the precondition |
| **Frugal Rites** *(planned)* | some taps cost no Mana |

### 4.3 Era 3 · The Deep Arcana — 22 nodes

| Major | Unlocks |
|---|---|
| **Fishing** | the Docks |
| **Shipbuilding** | Docks L2 |
| **Sanctified Ruins** | a cleared ruin's Knowledge drip doubles |
| **Ritual Casting** *(planned)* | a relic active can target a **building**, not only a cell |
| **Ley Storm** *(planned)* | once a day, cast a kingdom-wide +25% production window |
| **Second Sanctum** | a second Sanctum may be built (`extra_count_tech` on the district) |

### 4.4 Magic minor lines

| Line | Effect per rank | Ranks by era |
|---|---|---|
| **Deep Wells I–V** | +10 max Mana | I·II / III·IV / V |
| **Surveying I–II** | +1 Gold of reveal progress per tap on the fog | I / II |
| **Resonance I–III** | −20% Mana to cast a relic | I / II / III |
| **Ley Taps I–III** | +1 Mana/h per claimed landmark | I / II / III |
| **Farsight I–III** | +1 discover radius | I / II / III |
| **Pitons I–II** | −10% Gold to clear a cell of fog | — / I / II |
| **Scriptorium I–III** | +5% Knowledge drip rate | — / I / II |
| **Wayposts I–III** | +1 Knowledge/h per claimed landmark | — / I / II |
| **Reliquary I–III** *(designed, not built)* | +5% ingredient drops from delve hauls | — / I / II |
| **Pilgrimage I–III** | −5% landmark claim cost | — / I / II |
| **Confluence I–III** *(designed, not built)* | +5% to the Sanctum adjacency bonus | — / I / II |
| **Thrift I–III** *(designed, not built)* | +10% chance a tap costs no Mana | — / I / II |
| **Big Nets I–III** | +1 Food per delivery from a shoal | — / — / I |
| **Vigils I–III** | +1 Knowledge/h per cleared ruin | — / — / I |
| **Focus I–III** *(designed, not built)* | +10% relic active duration | — / — / I |
| **Tempest I–III** *(designed, not built)* | +5 min Ley Storm duration | — / — / I |
| **Prospecting I–III** | +5% Stardust from delves | — / — / I |

## 5. Prices, in bands

| | Minor | Major | Keystone |
|---|---|---|---|
| **Era 1** | 40–150 G · 20–60 s | 200–500 G · 2–5 min | 800 G · 40 K · 15 min |
| **Era 2** | 250–800 G · 20–60 K · 3–8 min | 1,000–2,500 G · 80–200 K · 15–30 min | 5,000 G · 500 K · 1 h |
| **Era 3** | 1,500–5,000 G · 150–400 K · 20–45 min | 6,000–15,000 G · 600–1,500 K · 1–3 h | 30,000 G · 3,000 K · 6 h |

- The bands are the design; the exact rows are the workbook's.
- **Era 1 costs no Knowledge.**
- Majors climb across their band left to right along the era row; a line's
  ranks climb across theirs by position within the era.
- Era 1's majors sit *below* the band as authored (Forestry: 25 Gold,
  3 seconds). `tests/onboarding.test.ts` pins the opening beat by beat.
- Whole tree: **550,165 Gold and 50,495 Knowledge**, of which the three sealed
  era-4 keystones are 90,000 Gold and 9,000 Knowledge.

| Era | Gold | Knowledge |
|---|---|---|
| 1 | 4,265 | 0 |
| 2 | 49,650 | 3,820 |
| 3 | 406,250 | 37,675 |

- At a full province's drip ([`07-research.md`](07-research.md) §3) eras 1–3
  are about **eight weeks** at 30/h and **five and a half** at 45/h.
- The quest chain funds the **opening** — every era-1 technology and the
  keystone that closes it. Era-2 majors (Sailing, Scaling Tools, Surveying II)
  are the city's to earn; the onboarding test's Gold guarantee is scoped to the
  opening.

## 6. Effects and hooks

### 6.1 Where a line hangs

- **Stopgap parents.** A line whose intended major is planned hangs off the
  nearest built major and moves when its own arrives: Deep Wells and
  Scriptorium under Consecration, Ley Taps and Wayposts under Cartography,
  Vigils under Scaling Tools, Pilgrimage under Sailing, Prospecting under
  Shipbuilding, Scriveners under Architecture, Cartage under Roadworks.
- **Three lines per major** is the fan's limit (`tests/research.test.ts`).
- Quest targets: `Surveyors` → `SurveyingII` (goal type `CompleteTech`; a rank
  implies the ones below it), `Attuned` → `Consecration`, `ArmedMen` →
  `Warrior`, `Mapmakers` → `Cartography`, `Architect` → `Architecture`
  ([`12-quests.md`](12-quests.md)).

### 6.2 `ModifierStat` hooks

| Hook | Line(s) | Note |
|---|---|---|
| `buildTime` | Carpentry | |
| `researchTime` | Scriveners | fixed at research start ([`07-research.md`](07-research.md) §1) |
| `workerSpeed` | Cartage | |
| `manaCap` | Deep Wells | |
| `claimCost` | Pilgrimage | |
| `stardustYield` | Prospecting | |
| `knowledgeYield` | Scriptorium | |
| per-source Knowledge / Mana terms | Ley Taps, Wayposts, Vigils | |
| `armyCap` | Colours | adds to the cap the halls provide; nothing to a kingdom with no hall |
| `recruitCost` | Muster Drill | |
| `supplyCost` | Rations | |
| `haulLoss` | Bearers | floors at one fifth |
| `heroXp` | Drillmaster | |
| `delveSpeed` | Pathfinders | |
| unit ATK/DEF by tag, disadvantage penalty | Shield Wall, Fletching, Barding, Warhorns, Manoeuvre, Tactics | `combat.ts` stays pure; resolved in `expeditions.ts` into a `Drill` carried on the `Party`. Manoeuvre never softens past neutral |
| `discoverRadius` | Farsight | every building's fog-**discover** radius, never its reveal radius. A rank landing re-applies every standing building's radii inside `advance()` |

Stats the tree moves: build time · research time · unit ATK/DEF by tag · Mana
capacity · Mana regen · discover radius · influence radius · worker move speed
· Knowledge drip rate · ingredient yield · Stardust yield · landmark claim cost
· expedition supply cost · expedition duration · failed-haul loss · army power
cap · hero XP · relic active duration · the type-disadvantage penalty · the
Sanctum adjacency bonus.

### 6.3 Mechanics behind planned majors (designed, not built)

**Siegecraft** (clearing a defended landmark, [`15-social.md`](15-social.md)
§6), **Veterancy** (hero levels), **Field Medicine** (HP between depths),
**Vanguard** (auto-resolving depth 1), **Invocation** (a second charge),
**Ritual Casting** (a building as a cast target), **Ley Storm** (a daily
self-cast window), **Ley Lines** (adjacency v2), **Frugal Rites** (an RNG roll
on a tap — `parts` must identify the tap, never the moment).

## 7. Planned nodes

Era-2/3 majors whose mechanics do not exist yet are on the tree, flagged.

- **`planned: 1` in the workbook.** The node is drawn dashed and hatched, like
  the fog's `?`.
- **The panel says it**, above the Start button: *Not yet in the prototype.*
- **No keystone requires a planned node.** Keystones require the era's *built*
  majors.
- **No minor line hangs off one.** Lines keep their stopgap parents (§6.1)
  until their own major works.
- `tests/research.test.ts` pins the exact set and all four rules.

**Planned (17):** Land Survey, Apprenticeships · Field Medicine, Veterancy,
Siegecraft, Scouting, Vanguard, Standards · Ley Reading, Scrying, Invocation,
Lorekeeping, Wayshrines, Ley Lines, Frugal Rites, Ritual Casting, Ley Storm.

**Live era-2/3 majors (9):** Aqueducts, Guildhalls, Roadworks, Tactics,
Salvage, Conquest, Meditation, Sanctified Ruins, Second Sanctum.

## 8. Dials, in the order to reach for them

| Dial | Where | What it moves |
|---|---|---|
| the era price bands (§5) | `Technologies` sheet | how long the whole tree lasts — the first thing to touch |
| a technology's `cost_gold` / `cost_knowledge` / `duration_seconds` | `Technologies` | one node |
| `requires` | `Technologies` | the shape. **Row order is not chain order here** — the edges are |
| a minor line's rank count | `Technologies` | how many eras a line spans |
| `effect_per_rank` | `Technologies` | a line's step; `Scriveners` is the only Gold lever on the tree's pace |
| `planned` | `Technologies` | whether a major is live |

## 9. Deliberately not in this design

- A fourth era as a redesign (rank IV of each spine is drawn sealed; era 4 is
  rows).
- Exclusive picks — no node forecloses another.
- A line longer than five ranks.
- A minor line hanging off a planned major (§7).

**Open questions:** **OQ-13**, **OQ-68**.
