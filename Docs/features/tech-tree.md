# The tech tree — every node, era by era

> **Scope.** The **content** of the three tomes: every node, what each unlocks,
> the rank ladders, the price bands that pace them, and the numbers those
> ladders move. The **system** — technologies, tomes, eras and the bars that
> open them, Knowledge, slots, the screen — is
> [`07-research.md`](07-research.md); where a card SITS and what it requires is
> [`../tech-tree-editor.md`](../tech-tree-editor.md).
> `src/sim/data/definitions.ts` points at this file.
>
> **Status.** Built: **174 technologies** in `src/sim/data/tech-tree.json`,
> authored in `?dev=tree` ([`../tech-tree-editor.md`](../tech-tree-editor.md)),
> priced to §5's bands, with every §6 number wired. **15 era-2/3 majors are on the
> tree flagged `planned`** — drawn, researchable, no effect yet (§7); Civics
> carries none. **Nine ladders are designed, not built**, and are marked so in
> the tables.

## 1. Reading the tables

- **Major** unlocks content; **minor** is one numeric step with a roman
  numeral. There is no spine: nothing gates a band but the era bar, which asks
  for revealed cells ([`07-research.md`](07-research.md) §1.1, §2.1).
- Node counts per era include every rank row.
- **Ranks by era** reads era 1 / era 2 / era 3: `I·II / III·IV / V` means
  ranks I and II land in era 1, III and IV in era 2, V in era 3; `—` is no
  rank that era.
- *(planned)*: on the tree, no effect yet (§7). *(designed, not built)*: not
  in the workbook.
- A technology never requires a technology in another tome.

## 2. Tome I — Civics — 67 nodes

> *The city and its purse.* Open, like every book.

**What raises the Townhall.** Two ordinary cards, gates derived from their
`unlocks` like any other — placed where the designer puts them, not holding a
door.

| Card | Band | Unlocks |
|---|---|---|
| `Bureaucracy` | era 2 | Townhall 3 |
| `Magistracy` | era 3 | Townhall 4 |

Civics runs to **three bands**; Warfare and Magic run to four.

### 2.1 Era 1 · Settlement — 19 nodes

| Major | Unlocks |
|---|---|
| **Forestry** | the forest and berry taps |
| **Agriculture** | crop plots |
| **Saws** | the Sawmill |
| **Farming** | the Farm that works the plots |
| **Masonry** | the Quarry |
| **Market** | the Market |
| **Urban Planning** | Housing level 2 |

The band opens on one root and fans twice: Masonry and the Market split the
page, and Urban Planning gathers them again before the three thumb ladders
hang off it.

### 2.2 Era 2 · Township — 17 nodes

| Major | Unlocks |
|---|---|
| **Bureaucracy** | Townhall 3 |
| **Hunting** | the wild game tap |
| **Mining** | the Smelter, and the iron mountain the Quarry works for Stone |
| **Communities** | +1 resident in every Housing |

### 2.3 Era 3 · Borough — 31 nodes

| Major | Unlocks |
|---|---|
| **Magistracy** | Townhall 4 — the card the band opens on |
| **Engineering** | Sawmill L3, Quarry L2, the Carpenter and the Mason's Yard |
| **Aqueducts** | Housing L3 |
| **Architecture** | Sawmill L4, Quarry L3 |
| **Deep Mining** | the gold mountain — the Quarry works it for Gold |
| **Guildhalls** | a second Market (`extra_count_tech` on the district) |
| **Roadworks** | workers move faster — `worker.moveSpeedTilesPerSecond` 1 → 1.25 |

Civics carries **no `planned` card**. With every requirement one row up (§2.4,
[`07-research.md`](07-research.md) §2), a card that does nothing yet is a toll
on the way to one that does — `Land Survey` and `Apprenticeships` were cut when
the book was laid out rather than parked mid-page.

### 2.4 Civics rank ladders

A ladder is a NAME, not a chain. Rank II does not require rank I and need not
sit near it: the numeral tells the player the bonus goes further down the book,
and every rank is an ordinary card gated by the row above it like any other.

| Ladder | Effect per rank | Ranks by era |
|---|---|---|
| **Tap Power I–V** | +20% of what a tap is worth | I / II / III·IV·V |
| **Quick Hands I–V** | −0.05 s between auto-taps while holding | I / II / III·IV·V |
| **Trade Routes I–V** | +10% tax income | I / II / III·IV·V |
| **Market Stall I–IV** | +5% Market prices | I / II / III·IV |
| **Worker Load I–III** | +1 on every worker delivery | I / II / III |
| **Stonecutting I–III** | +1 Stone per tap and delivery on a mountain | I / II / III |
| **Carpentry I–III** | −5% time to build and upgrade | I / II / III |
| **Sawpits I–III** | +1 Wood per tap and delivery from a forest | I / II / III |
| **Irrigation I–III** | +1 Food per tap and delivery from a farm plot | I / II / III |
| **Butchery I–III** | +1 Food per tap and delivery from wild game | — / I·II / III |
| **Iron Picks I–III** | +1 Stone per tap and delivery from an iron mountain | — / I·II / III |
| **Scriveners I–III** | −5% time to finish a research | — / — / I·II·III |
| **Cartage I–III** | +5% worker walking speed | — / — / I·II·III |
| **Foraging I–II** *(designed, not built)* | +1 Food per tap on a berry bush | — |
| **Almshouses I–II** *(designed, not built)* | +1 further resident in every Housing | — |
| **Load-Bearing I–III** *(designed, not built)* | +1 Stone per tap on rocks | — |
## 3. Tome II — Warfare — 52 nodes

> *The army, and what it goes into the ground for.* Opens on your first
> discovered ruin.

**Spine.**

| Rank | Cost | Grants |
|---|---|---|
| `Warband I` | free, granted when the tome opens | — |
| `Warband II` | era 2 | the four halls reach L4; **veteran** units can be recruited |
| `Warband III` | era 3 | halls L5; **champion** units |
| `Warband IV` | sealed | — |

- A unit tier arrives with the army
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

### 3.4 Warfare rank ladders

| Ladder | Effect per rank | Ranks by era |
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
| `Attunement II` | era 2 | Sanctum L4 and a step in the Mana ceiling |
| `Attunement III` | era 3 | Sanctum L5 and another step |
| `Attunement IV` | sealed | — |

- The Sanctum itself is unlocked by **Consecration** in era 1; the ladder only
  raises what already exists.
- `Attunement` names the Magic ladder; the quest `Attuned` targets
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

### 4.4 Magic rank ladders

| Ladder | Effect per rank | Ranks by era |
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
- Era 1's majors sit *below* the band as authored (Forestry: 25 Gold,
  3 seconds). `tests/onboarding.test.ts` pins the opening beat by beat.
- Whole tree: **485,330 Gold and 44,110 Knowledge**, of which the two sealed
  era-4 keystones are 60,000 Gold and 6,000 Knowledge.

| Era | Gold | Knowledge |
|---|---|---|
| 1 | 4,445 | 0 |
| 2 | 46,600 | 3,580 |
| 3 | 374,285 | 34,530 |

- At a full province's drip ([`07-research.md`](07-research.md) §3) eras 1–3
  are about **eight weeks** at 30/h and **five and a half** at 45/h.
- The quest chain funds the **opening** — every era-1 technology and the first
  rank that follows. It also asks for enough exploring to open era 2 before it
  points at anything in it (`tests/quests.test.ts`). Era-2 majors are the
  city's to earn; the onboarding test's Gold guarantee is scoped to the
  opening.

## 6. Effects

### 6.1 Where a ladder hangs

- **Stopgap parents.** A ladder whose intended major is planned hangs off the
  nearest built major and moves when its own arrives: Deep Wells and
  Scriptorium under Consecration, Ley Taps and Wayposts under Cartography,
  Vigils under Scaling Tools, Pilgrimage under Sailing, Prospecting under
  Shipbuilding, Scriveners under Architecture, Cartage under Roadworks.
- Every rank has a slot of its own on the page, so nothing limits how many
  ladders hang off one major any more; what a ladder still needs is a MAJOR at
  its root, not another ladder's rank (`tests/upgrades.test.ts`).
- Quest targets: `Surveyors` → `SurveyingII` (goal type `CompleteTech`; a rank
  implies the ones below it), `Attuned` → `Consecration`, `ArmedMen` →
  `Warrior`, `Mapmakers` → `Cartography`, `Architect` → `Architecture`
  ([`12-quests.md`](12-quests.md)).

### 6.2 The stats a ladder moves

A `bonus` names a **stat** from the registry
([`../../src/sim/data/techEffectRules.ts`](../../src/sim/data/techEffectRules.ts)),
an `op`, a signed `value` and an optional `target`
([`07-research.md`](07-research.md) §1.2). The registry is the list; each entry
names the one call site that owns its number, and
`tests/techTree.test.ts` refuses a stat nothing reads.

| Stat | Ladder(s) | Note |
|---|---|---|
| `tapWorkSeconds` · `autoTapCooldown` | Tap Power, Quick Hands | |
| `harvestUnitsPerStrike` | Sawpits, Irrigation, Butchery, Stonecutting, Big Nets, Iron Picks | **aimed at a harvest source**, so two ladders on `Crops` simply sum. The tap and the crew both read it |
| `workerStrikeUnits` | Worker Load | the crew only — deliberately not the tap |
| `workerSpeed` | Cartage | |
| `buildTime` | Carpentry | |
| `researchTime` | Scriveners | fixed at research start ([`07-research.md`](07-research.md) §1) |
| `salePrice` | Market Stall | **multiplier POINTS**, not a percentage of the level multiplier |
| `taxRate` | Trade Routes | aimable at a kind of house; the shipped ladder is unaimed |
| `manaCap` | Deep Wells | |
| `manaPerClaimedLandmark` · `knowledgePerClaimedLandmark` · `knowledgePerClearedRuin` | Ley Taps, Wayposts, Vigils | a per-site term the call site multiplies by the count it holds |
| `knowledgeYield` | Scriptorium | |
| `activeCost` | Resonance | |
| `revealCost` · `fogRevealPerTap` · `discoverRadius` | Pitons, Surveying, Farsight, **Cartography** | Cartography is +100% on `fogRevealPerTap` like a Surveying rank, so the ×1 → ×2 → ×3 → ×4 ladder is four rows of data and nothing names it in code. `discoverRadius` is every building's fog-**discover** radius, never its reveal radius; a rank landing re-applies every standing building's radii inside `advance()` |
| `claimCost` | Pilgrimage | |
| `armyCap` | Colours | adds to the cap the halls provide; nothing to a kingdom with no hall |
| `recruitCost` | Muster Drill | |
| `unitAtk` · `unitDef` | Warhorns, Fletching, Shield Wall, Barding | **aimed at a unit tag**, so a Cavalry reads its two tags plus the unaimed term once. `combat.ts` stays pure; resolved in `expeditions.ts` into a `Drill` carried on the `Party` |
| `typeDisadvantage` | Manoeuvre | never softens past neutral. `Tactics` moves the same number and stays a `mechanic`: as an effect it would re-associate the sum, and float addition is not associative |
| `supplyCost` · `delveSpeed` · `haulLoss` | Rations, Pathfinders, Bearers | `haulLoss` floors at one fifth |
| `heroXp` · `stardustYield` | Drillmaster, Prospecting | |
| `populationCapacity` | **Communities** | +1 bed globally, which is what "every district that houses anyone" means: a district with no capacity table is not a house. Aimable at one kind of house |

Every one of these is ALSO a `ModifierStat` where a modifier can reach it
(`src/sim/modifiers.ts`), resolved in the same helper — three stages, one
place.

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
- **Nothing a band depends on requires a planned node**, and the editor warns
  when anything requires one at all: a card waiting on a no-op is waiting on
  nothing.
- **No rank ladder hangs off one.** Ladders keep their stopgap parents (§6.1)
  until their own major works.
- `tests/research.test.ts` pins the exact set and all four rules.

**Planned (15):** Field Medicine, Veterancy,
Siegecraft, Scouting, Vanguard, Standards · Ley Reading, Scrying, Invocation,
Lorekeeping, Wayshrines, Ley Lines, Frugal Rites, Ritual Casting, Ley Storm.

**Live era-2/3 majors (9):** Aqueducts, Guildhalls, Roadworks, Tactics,
Salvage, Conquest, Meditation, Sanctified Ruins, Second Sanctum.

## 8. Dials, in the order to reach for them

| Dial | Where | What it moves |
|---|---|---|
| the era price bands (§5) | `?dev=tree`, whose status bar totals each band | how long the whole tree lasts — the first thing to touch |
| a technology's `gold` / `knowledge` / `seconds` | `?dev=tree` | one node |
| `requires` | `?dev=tree` — drag, or click a connector to cut it | the shape |
| `kind` and `unlocks` | `?dev=tree` | what the technology IS, and every gate derived from it |
| a ladder's rank count | `?dev=tree` — add a rank | how many eras a ladder spans |
| a rank's `effects` | `?dev=tree` | what it moves and by how much; `Scriveners` is the only Gold lever on the tree's pace |
| `planned` | `?dev=tree` | whether a major is live |

## 9. Deliberately not in this design

- A fourth era as a redesign (a book's last band is drawn sealed; era 4 is
  rows).
- Exclusive picks — no node forecloses another.
- A ladder longer than five ranks.
- A rank ladder hanging off a planned major (§7).
- A ladder whose ranks must all be worth the same step: each rank carries its
  own value, so a ladder may ramp (§6.2).

**Open questions:** **OQ-13**, **OQ-68**.
