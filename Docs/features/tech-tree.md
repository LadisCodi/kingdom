# Feature: the tech tree — three tomes, paced by eras

> **Design, not built (2026-09-03).** The **content** of the three tomes: all
> ~167 nodes, what each unlocks, and the price bands that pace them.
>
> [`tomes-and-research.md`](tomes-and-research.md) owns the **system** — why
> Knowledge is the clock, why the shelf is three books, the Stardust rename and
> the migration. **Read that first**; this file is the node list underneath it
> and does not re-argue its decisions.
>
> This file is also what `src/sim/data/definitions.ts` has pointed at since the
> tree was written and what has never existed until now.
>
> Companion docs: [`tomes-and-research.md`](tomes-and-research.md) (the system),
> [`research-and-upgrades.md`](research-and-upgrades.md) (the menu, the slots,
> the tree fog), [`relics-and-ingredients.md`](relics-and-ingredients.md)
> (ingredients, which replaced Fragments),
> [`map-scopes.md`](map-scopes.md) (the bounded plot this assumes).

## The problem this solves

`research-and-upgrades.md` says it plainly about its own tree: it is **a
checklist rather than a tree**. One root gate with 8 of 24 technologies hanging
directly off it, five branches that never reconverge, no exclusive picks, a
maximum depth of 4, and fully exhausted inside the 2–3 hour arc. It costs 6,600
Gold against a quest chain that pays 11,865, so it is **56% of what finishing
the chain hands you** — a formality the chain funds twice over.

The genre's answer is ~20 ages (Forge of Empires) or ~25 chapters (Elvenar):
the same shape, repeated and scaled. This is that shape, at three eras.

## 1. The eight rules

Everything below falls out of these. They are listed first because the node
lists are long and the rules are what actually has to be agreed.

> **1. Three tomes, and not one edge between them.**

Civics, Warfare, Magic. A technology never requires a technology in another
tome. That is the entire reason three tabs are more legible than one canvas cut
into thirds — you can read a tome without holding the other two in your head.

> **2. Every node is a technology. Upgrades do not exist.**

What was a levelled upgrade becomes a **rank line**: `Sawpits I → II → III`,
each a node requiring the one before. Gold, Knowledge and time, like anything
else.

The instant Gold purchase sitting inside a time-gated tree was the one
genuinely awkward thing in the old design, and removing it is what makes
research slots matter (§4).

> **3. Two bands, separated only by cost and time.**

- **Major** — unlocks content: a building, a unit, a terrain, a mechanic.
  Expensive, long.
- **Minor** — one numeric step. Cheap, short, and recognisable because it
  carries a roman numeral.

No second mechanic is needed to express "small". The tree says it with money
and a clock, which is what a tree is already made of.

> **4. A minor line's rank N sits in era N.**

This is the rule that makes eras fill themselves. Era 2 is its own new majors,
**plus** rank II of every line era 1 introduced, **plus** rank I of the lines
era 2 introduces. Eras grow on their own without anyone authoring them wider,
and there is always an unfinished ladder in view — a line introduced in era 3
shows only its rank I until the next drop.

> **5. Spine rank I is a free cover page. Ranks II and up are keystones.**

Each tome has a spine whose ranks repeat one promise. **Rank I costs nothing
and is granted the moment the tome opens** — it is the book's cover, and its
job is to make the shape legible on the first look. It is the one technology
with no price and no clock, which is exactly how `isGranted` recognises it:
without that, a cover page was startable for nothing and lit the Research tab
on a fresh kingdom pointing at two books the player had not earned.

> **A keystone requires every MAJOR of the era above it — not the ranks.**
> Revised 2026-09-04, and it is open decision 1 answered by the build.

Rule 5 originally said *every technology*. Implementing it produced the
evidence against it: with the ranks included, "the player has Hunting"
transitively meant "the player has Tap Power I", because Hunting sits behind a
keystone that requires the whole era. Unrelated systems became coupled — a
test measuring what a tap on wild game pays was silently measuring Tap Power
as well — and the gate grew from five researches to thirteen.

Majors are the content spine; ranks are optional depth you buy for yourself.
Gating on the majors keeps an era a real threshold without making it a wall,
and it keeps the lines independent of each other.

> **6. Era 3's closing keystone is drawn and cannot be researched.**

Rank IV sits sealed at the foot of each tome, rendered with the `?` silhouette
the tree fog already ships. It is the visible promise of the next content drop
and it costs nothing to author but a node position.

> **7. Every technology costs Gold *and* Knowledge *and* time.**

Gold is the city's investment, so the tree keeps competing with fog and
buildings for one budget — the decision the economy is built around. Knowledge
is the clock, so a rich city cannot skip an era. Neither alone works at this
size: Gold can *size* 167 nodes but cannot *pace* them.

Knowledge is **kingdom-scoped** — a technology is something the kingdom knows,
so the tree survives a province reset — and comes only from claimed landmarks
and cleared ruins ([`tomes-and-research.md`](tomes-and-research.md) §3). It has
no base rate, which is why era 1 charges none of it.

**Era 1 costs no Knowledge at all** (§5). It is the one era small enough not to
need pacing, and charging for it would strangle the first session.

> **8. Slots are bought with Gems, everywhere, and by nothing else.**

Research slots, attunement slots, party slots. No technology grants a slot.
This reverses `research-and-upgrades.md`'s "research is the earned half of both
gates" and it does not break promise 3 of
[`../00-design-intent.md`](../00-design-intent.md), because **Gems are
earnable** — the chain pays 75, a first clear pays 10, and the daily chest pays
at its week markers. The earning moved; it did not disappear.

## 2. The three tomes

| Tome | Owns | Opens | Spine promise | Nodes |
|---|---|---|---|---|
| **Civics** | the city and its purse | at game start | Townhall **+1 level** | ~64 |
| **Magic** | the fog, Mana, relics and the ruins | your **first paid reveal** | Sanctum **+1 level** and a step in the **Mana ceiling** | ~56 |
| **Warfare** | the army and what it goes into the ground for | your **first discovered ruin** | the four halls **+1 level** and the **next tier of soldier** | ~47 |

**Why the tomes open on those events.** Civics is the game. Magic opens at the
first paid reveal because the fog *is* the magic — it is guaranteed inside two
minutes, it needs no landmark to have spawned nearby, and it means Cartography
is reachable when `Mapmakers` asks for it. Warfare opens when a ruin appears,
because that is the first moment an army is for anything.

**Why Civics paces the other two without touching them.** Townhall level gates
the Sanctum (L2 needs TH2) and all four military halls. So you cannot rush
Warfare past what your city supports — and there is still no cross-tome edge.
This is the load-bearing trick of the whole layout.

**Why exploration lives in Magic.** Cartography, Sailing, Scaling Tools,
Fishing and Shipbuilding moved out of Civics on 2026-09-03. Three reasons, in
order of weight: the fog is the surface Kingdom's magic actually presents to
the player — landmarks pay Mana, ruins hold relics; it makes Magic
non-optional, which is the direct answer to the 2026-09-01 audit's *"reads as a
generic (charming) village simulator"*; and it balances 68/45/41 into
64/56/47. Rule 1 then forced the whole chain to move together, since Fishing
requires Sailing — which is how the Docks ends up in the Magic tome. That reads
odd for one second and then reads right: you only have a coastline because you
learned to see past the fog.

## 3. Tome I — Civics

> *The city and its purse.* Open from the start.

**Spine.** `Charter I` — free, granted at game start. `Charter II` → Townhall 3.
`Charter III` → Townhall 4 *(new level)*. `Charter IV` → sealed, Townhall 5.

`Charter II` takes over the Townhall-3 gate that `Architecture` holds today;
Architecture survives with a different job (era 3).

### Era 1 · Settlement — 14 nodes

| Major | Unlocks |
|---|---|
| **Forestry** | the forest and berry taps |
| **Saws** | the Sawmill |
| **Agriculture** | crop plots and the Farm that works them |
| **Masonry** | the Quarry |
| **Urban Planning** | Housing level 2 |

### Era 2 · Township — 21 nodes

| Major | Unlocks |
|---|---|
| **Hunting** | the wild game tap |
| **Farming** | Farm level 2 |
| **Market** | the Market |
| **Mining** | the Mine |
| **Communities** | +1 resident in every Housing |

### Era 3 · Borough — 26 nodes

| Major | Unlocks |
|---|---|
| **Engineering** | Quarry L2, Sawmill L3 |
| **Deep Mining** | Mine L2 |
| **Architecture** | Quarry L3, Sawmill L4, Mine L3 |
| **Aqueducts** *(new)* | Housing L3 |
| **Guildhalls** *(new)* | a second Market, and Market L2 |
| **Roadworks** *(new)* | workers move faster — `worker.moveSpeedTilesPerSecond` 1 → 1.25 |
| **Land Survey** *(new)* | +1 influence radius on every district |
| **Apprenticeships** *(new)* | the Townhall trains two villagers at once |

Era 3's four new majors exist because exploration leaving took the era's only
mechanics with it, and what remained was five nodes that all read "one level
higher". Roadworks and Land Survey are the two most spatial dials in the game
and neither had ever been touched.

### Civics minor lines

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
| **Foraging I–II** | +1 Food per tap on a berry bush | I / II |
| **Butchery I–III** | +1 Food per tap on game | — / I / II |
| **Irrigation I–III** | +1 Food per delivery from a farm | — / I / II |
| **Iron Picks I–III** | +1 Stone per delivery from a vein | — / I / II |
| **Market Stall I–III** | +5% Market sale prices | — / I / II |
| **Almshouses I–II** | +1 further resident in every Housing | — / I / II |
| **Load-Bearing I–III** | +1 Stone per tap on rocks | — / — / I |
| **Scriveners I–III** | −5% research time | — / — / I |
| **Cartage I–III** | +5% worker move speed | — / — / I |

## 4. Tome II — Warfare

> *The army, and what it goes into the ground for.* Opens on your first
> discovered ruin.

**Spine.** `Warband I` — free, granted when the tome opens. `Warband II` → the
four halls reach L4, and **veteran** units can be recruited. `Warband III` →
halls L5, and **champion** units. `Warband IV` → sealed.

The unit tier arriving *with* the army cap that lets you field it is the reason
`Champions` is in the spine rather than an era 3 leaf.

### Era 1 · The Levy — 12 nodes

| Major | Unlocks |
|---|---|
| **Warrior** | the Barracks and the Warrior |
| **Spears** | the Spear Hall and the Lancer |
| **Archery** | the Shooting Grounds and the Archer |
| **Cavalry** | the Stables and the Cavalry |
| **Field Medicine** *(new)* | the party recovers HP **between depths** |

Field Medicine is the largest single delve unlock available, because today
party HP never recovers at all — which is what makes depth 3 a wall for a party
that scraped through depth 2.

### Era 2 · The Company — 15 nodes

| Major | Unlocks |
|---|---|
| **Veterancy** *(new)* | heroes gain levels from delving — **closes backlog gap 2** |
| **Siegecraft** *(new)* | a party can clear a **defended landmark** — **closes backlog gap 1** |
| **Tactics** *(new)* | the type-disadvantage penalty softens, 0.75 → 0.85 |
| **Scouting** *(new)* | a ruin's threat type shows before you launch |

### Era 3 · The Host — 17 nodes

| Major | Unlocks |
|---|---|
| **Salvage** *(new)* | a failed delve loses **35%** of the haul, not 50% |
| **Vanguard** *(new)* | depth 1 of a ruin you have already cleared resolves instantly |
| **Standards** *(new)* | army power cap rises with military hall level |
| **Conquest** *(new)* | a ruin cleared to its **deepest** depth becomes *conquered* — a permanent Knowledge drip above the ordinary cleared rate |

`Conquest` is the one node that ties Warfare back into the tree's own currency,
and it is the only reason to take a ruin all the way down twice.

### Warfare minor lines

| Line | Effect per rank | Ranks by era |
|---|---|---|
| **Colours I–V** | +2 army power cap | I / II·III / IV·V |
| **Shield Wall I–III** | +1 DEF to Melee units | I / II / III |
| **Fletching I–III** | +1 ATK to Distance units | I / II / III |
| **Barding I–III** | +1 DEF to Mounted units | I / II / III |
| **Poultices I–III** | +5% HP recovered between depths | I / II / III |
| **Rations I–III** | −5% expedition supply cost | I / II / III |
| **Muster Drill I–III** | −10% unit recruit cost | I / II / III |
| **Drillmaster I–III** | +5% hero XP | — / I / II |
| **Manoeuvre I–III** | +2% off the type-disadvantage penalty | — / I / II |
| **Bearers I–III** | −3% haul lost on a failed delve, floor 20% | — / I / II |
| **Warhorns I–III** | +1 ATK to all units | — / — / I |
| **Pathfinders I–III** | −10% expedition duration | — / — / I |

## 5. Tome III — Magic

> *The land's magic, and what you can see of it.* Opens on your first paid
> reveal.

**Spine.** `Attunement I` — free, granted when the tome opens. `Attunement II`
→ Sanctum L4 and a step in the Mana ceiling. `Attunement III` → Sanctum L5 and
another. `Attunement IV` → sealed.

The Sanctum itself is unlocked by **Consecration** in era 1, not by the spine —
the spine only ever raises what already exists. `Attunement` as a *technology*
is retired; the name moves to the spine and the quest `Attuned` repoints to
`Consecration` (§8).

### Era 1 · The Awakening — 12 nodes

| Major | Unlocks |
|---|---|
| **Cartography** | every tap on the fog counts **double** |
| **Consecration** | the Sanctum |
| **Meditation** *(new)* | raises the base Mana ceiling |
| **Ley Reading** *(new)* | a landmark shows what it grants **before** you pay for it |
| **Scrying** *(new)* | a ruin's tier shows before you commit a party |
| **Invocation** *(new)* | a relic's active gains a **second charge** |

### Era 2 · The Attuned — 19 nodes

| Major | Unlocks |
|---|---|
| **Sailing** | sea cells become explorable |
| **Scaling Tools** | mountain cells become explorable |
| **Lorekeeping** *(new)* | ruins give up more of what they hold |
| **Wayshrines** *(new)* | a **cleared** defended landmark becomes claimable, and claim costs drop |
| **Ley Lines** *(new)* | a district adjacent to the Sanctum produces +10% — **the first adjacency rule that is not Housing↔Housing, opening backlog gap 6.** [`map-scopes.md`](map-scopes.md) §1 is the precondition: adjacency cannot matter until the plot is bounded |
| **Frugal Rites** *(new)* | some taps cost no Mana |

### Era 3 · The Deep Arcana — 22 nodes

| Major | Unlocks |
|---|---|
| **Fishing** | the Docks |
| **Shipbuilding** | Docks L2 |
| **Sanctified Ruins** *(new)* | a cleared ruin's Knowledge drip doubles |
| **Ritual Casting** *(new)* | a relic active can target a **building**, not only a cell |
| **Ley Storm** *(new)* | once a day, cast a kingdom-wide +25% production window |
| **Second Sanctum** *(new)* | a second Sanctum may be built |

### Magic minor lines

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
| **Reliquary I–III** | +5% ingredient drops from delve hauls | — / I / II |
| **Pilgrimage I–III** | −5% landmark claim cost | — / I / II |
| **Confluence I–III** | +5% to the Sanctum adjacency bonus | — / I / II |
| **Thrift I–III** | +10% chance a tap costs no Mana | — / I / II |
| **Big Nets I–III** | +1 Food per delivery from a shoal | — / — / I |
| **Vigils I–III** | +1 Knowledge/h per cleared ruin | — / — / I |
| **Focus I–III** | +10% relic active duration | — / — / I |
| **Tempest I–III** | +5 min Ley Storm duration | — / — / I |
| **Prospecting I–III** | +5% Stardust from delves | — / — / I |

The Magic tome's minor lines feed all four of the things the fog pays out —
Mana, Knowledge, Stardust and ingredients — which is the cleanest statement
available of what the tome is for.

## 6. Prices, in bands

The bands are the design; the exact rows are the workbook's. **Era 1 costs no
Knowledge**, for the reason in rule 7.

| | Minor | Major | Keystone |
|---|---|---|---|
| **Era 1** | 40–150 G · 20–60 s | 200–500 G · 2–5 min | 800 G · 40 K · 15 min |
| **Era 2** | 250–800 G · 20–60 K · 3–8 min | 1,000–2,500 G · 80–200 K · 15–30 min | 5,000 G · 500 K · 1 h |
| **Era 3** | 1,500–5,000 G · 150–400 K · 20–45 min | 6,000–15,000 G · 600–1,500 K · 1–3 h | 30,000 G · 3,000 K · 6 h |

Era 1's minors at 20–60 s still *read* as instant, which is what stops the
first session feeling slower than it does today.

**What the bands come to.** Era 2 is roughly 6,500 Knowledge, era 3 roughly
26,000. Against the drip in
[`tomes-and-research.md`](tomes-and-research.md) §3 — about 18/h mid-game and
~35/h on a fully claimed province — that is about two weeks and about four
weeks respectively. **Six weeks of tree** rather than three hours, which is the
number `../road-to-mvp.md` §1.1 is actually asking for.

## 7. Slots, and what Gold still buys

With ~167 timed nodes and one slot, the pinch is immediate and permanent. It is
supposed to be. Slots are the tree's real progression and they are the one
thing Gems own outright.

| Slot | Gems |
|---|---|
| 2 | 10 |
| 3 | 30 |
| 4 | 90 |
| 5 | 270 |

`research.maxSlots` moves **3 → 5**; the price base and growth
(`slot_gem_cost_base` 10, `slot_gem_cost_growth` 3) do not change.

**The first step of every ladder costs 55 Gems** — research slot 2 at 10, relic
slot 2 at 20, party slot 3 at 25 — against a quest chain that pays **75**. So a
player who never spends buys one step of each inside the authored arc and then
has to earn the next. That is a tight, deliberate first decision and it is the
reason the authored bases need no adjustment.

**Gold buys speed, never parallelism.** `Scriveners I–III` is −15% research
time, total. Three slots is 3× throughput. They do not substitute for each
other at any price, and keeping that gap sharp is what protects the Gem
surface.

## 8. What this breaks

| Thing | Change |
|---|---|
| `UPGRADES`, `UpgradeId`, `UPGRADE_ORDER`, `buyUpgrade`, `canBuyUpgrade`, `anyUpgradeActionable`, `upgradeCost` | deleted |
| `effect(state, id)` | becomes "how many ranks of this line are complete" — reads completed techs, not `state.upgrades` |
| the five `effectiveX` helpers | keep the three-stage pipeline (base → ranks → modifiers); only stage two changes its source |
| `TAP_YIELD_UPGRADES`, `WORKER_YIELD_UPGRADES` | stay as call-site tables, keyed on tech ids |
| the tree UI | circles disappear entirely; minor vs major becomes node size or frame weight |
| quest `Surveyors` | goal type `BuyUpgrade` → `CompleteTech`, target `SurveyingII` — "buy it twice" becomes "reach rank II", since a rank implies the ones below it |
| quest `Attuned` | target `Attunement` → `Consecration` |
| goal type `BuyUpgrade` | retired — it has no other user |
| `SAVE_VERSION` | **23 → 24 with a migrator** (landed 2026-09-04) — `UpgradeLevels: { TapPower: 3 }` becomes three completed ranks. A reshape, not an additive change, so the defensive-reader rule does not cover it |

Every other quest survives untouched, including `ArmedMen` → `Warrior`,
`Mapmakers` → `Cartography` and `Architect` → `Architecture`. Three of them now
send the player to a different tab than the one they are standing in, and
[`../onboarding.md`](../onboarding.md) describes the old ordering.

## 9. New effect hooks

About seventeen, and most are already on `../road-to-mvp.md` §4's planned
`ModifierStat` widening list — so this pass and Phase 2 want the same seam
opened once.

**Landed 2026-09-04, first batch (Civics and Magic):** `buildTime`
(Carpentry), `researchTime` (Scriveners), `workerSpeed` (Cartage), `manaCap`
(Deep Wells), `claimCost` (Pilgrimage), `stardustYield` (Prospecting), plus
Ley Taps, Wayposts and Vigils as per-source terms and Scriptorium on the
existing `knowledgeYield`. Ten lines, 32 ranks, every one asserted where the
player meets the number.

Two things the batch settled:

- **Scriveners is fixed when a research starts and persisted on it** — the one
  hook that touches a boundary. A rank landing mid-research must not move that
  research's completion into the past, which one-call replay and stepped
  ticking would then land on differently. The scholar works at the pace they
  started at; the *next* research is quicker.
- **Stopgap parents.** The majors these lines are meant to hang off
  (Meditation, Ley Reading, Lorekeeping, Sanctified Ruins, Roadworks) do not
  exist yet, so each line hangs off the nearest existing major and moves when
  its own arrives: Deep Wells and Scriptorium under Consecration, Ley Taps and
  Wayposts under Cartography, Vigils under Scaling Tools, Pilgrimage under
  Sailing, Prospecting under Shipbuilding, Cartage under Engineering,
  Scriveners under Architecture. Three lines per major is the fan's limit
  (`tests/research.test.ts` holds it); Cartography and Consecration are at it.

**Landed 2026-09-04, second batch (Warfare):** `armyCap` (Colours),
`recruitCost` (Muster Drill), `supplyCost` (Rations), `haulLoss` (Bearers),
`heroXp` (Drillmaster), and Pathfinders on the existing `delveSpeed` rather than
a twin of it. Six lines, 20 ranks; the tree is 136. Colours adds to the cap the
halls provide and nothing to a kingdom with no hall — a bigger banner, not a
barracks of its own. Bearers floors at one fifth so a run can never be wiped.

**Not yet:** the unit-stat lines (Shield Wall, Fletching, Barding, Warhorns)
and Manoeuvre, because `combat.ts` is deliberately pure and they need bonuses
passed in the way `heroLevel` and the carried relic already are; and Farsight,
because a radius change should re-discover around every standing building and
that wants the map at completion time.

**Pricing:** the new ranks sit on the *legacy* Gold scale the existing ranks
use, not on §6's bands — a rank priced to the bands beside a 275-Gold era-3
major is incoherent, and repricing the majors is a single deliberate pass
(open decision below), not a side effect of adding lines.

Build time · research time · unit ATK/DEF by tag · Mana capacity · Mana regen ·
discover radius · influence radius · worker move speed · Knowledge drip rate ·
ingredient yield · Stardust yield · landmark claim cost · expedition supply
cost · expedition duration · failed-haul loss · army power cap · hero XP ·
relic active duration · the type-disadvantage penalty · the Sanctum adjacency
bonus.

Genuinely new mechanics, which is where the real cost is: **Siegecraft**
(clearing a defended landmark — `../00-design-intent.md` open decision),
**Veterancy** (hero levels), **Field Medicine** (HP between depths),
**Vanguard** (auto-resolving depth 1), **Conquest**, **Invocation** (a second
charge), **Ritual Casting** (a building as a cast target), **Ley Storm** (a
daily self-cast window), **Ley Lines** (adjacency v2), **Frugal Rites** (an RNG
roll on a tap — `parts` must identify the tap, never the moment).

## 10. Dials, in the order to reach for them

| Dial | Where | What it moves |
|---|---|---|
| the era price bands (§6) | `Technologies` sheet | how long the whole tree lasts — the first thing to touch |
| `research.max_slots` | `Settings` | 3 → 5; how much of the tree can be in flight |
| `research.slot_gem_cost_base` / `_growth` | `Settings` | what parallelism costs; unchanged at 10 / 3 |
| a technology's `cost_gold` / `cost_knowledge` / `duration_seconds` | `Technologies` | one node |
| `requires` | `Technologies` | the shape. **Row order is not chain order here** — the edges are |
| a minor line's rank count | `Technologies` | how many eras a line spans |
| `Scriveners` effect per rank | `Technologies` | −5%/rank on research time; the only Gold lever on the tree's pace |

## 11. What is deliberately not here

- **A fourth era.** Rank IV of each spine is drawn sealed and costs nothing to
  author. Adding era 4 is rows, not a redesign — that is the entire point of
  the shape.
- **Exclusive picks.** No node forecloses another. Cozy games do not punish a
  wrong turn, and promise 1 says nothing you own is taken from you. The
  *pacing* is Knowledge and slots, not regret.
- **A per-tome slot.** One slot per book would remove the tension the redesign
  exists to create.
- **Upgrades kept "just for the instant purchase".** Two kinds of node was the
  problem, not the solution. The instant-gratification gap is real and is
  covered by era 1's 20–60 s minors and by the Gem/ad "finish now" surface,
  which gains a great deal of traffic here — a natural sixth placement for
  `../road-to-mvp.md` Phase 3.

## 12. What the Magic tome took off the Townhall

The `Attunement` spine now raises the Sanctum's level and the Mana ceiling, so
Mana stops being something the Townhall produces. Taken with the dials that
were already empty, that leaves the hall doing exactly one thing.

> **The Townhall is nothing but permission.**

| What | Where | Verdict |
|---|---|---|
| Mana production — `mana.production_per_townhall_level` `[10, 13, 16]`; `manaPerHour()` is the Townhall alone | balance + `mana.ts` | **stripped** |
| Mana capacity base — `mana.base_cap_per_townhall_level` `[100, 130, 160]` | balance + `mana.ts` | **stripped** |
| Army power cap — `army.power_cap_per_townhall_level` | `army.ts` | already retired 2026-09-02 |
| `population_capacity_per_level`, `max_workers_per_level`, `influence_radius_per_level`, `army_cap_per_level` | `Districts` | already empty arrays |
| District count caps, district level gates, the Housing adjacency rule | `districts.ts` | **kept** — this *is* the gate |
| Map origin: `TOWNHALL_ORIGIN` and `distanceFromTownhall`, which price fog, build cost and build duration | `grid.ts` | **kept** — geometry, not a stat |
| `fog_reveal_radius` 1, `fog_discover_radius` 2 | `Districts` | **kept** — it is the seed; without it the game opens in total fog |
| Villager training and `townhallTap` | `commands.ts` | **kept**, and it is the one open question — see below |

Stripping the first two also settles a live contradiction that Phase 0 was
meant to catch and did not: `base_cap_per_townhall_level` starts at **100**
while `../00-design-intent.md` says a new kingdom starts full at **50**.

**Where Mana goes instead.** Entirely into the Magic tome, which is where it
belongs now that Magic owns the fog, the landmarks and the ruins. **The Sanctum
becomes the Mana engine, not just the reservoir.**

| Dial | Value |
|---|---|
| `mana.base_cap` | **50**, flat — a new kingdom starts full, as the design has always said |
| `mana.base_per_hour` | **10**, flat |
| `mana.sanctum_cap_per_level` | 24 / 48 / 72 / **96 / 120** — extended for Sanctum L4–L5, which the `Attunement` spine grants |
| `mana.sanctum_per_hour_per_level` | **new** — regeneration scales with the Sanctum |
| `mana.landmark_cap` | 10 each, unchanged |

The tree lines do the rest: `Meditation` and `Deep Wells I–V` raise the ceiling,
`Ley Taps I–III` raise regeneration per landmark, `Resonance` and `Thrift` cut
what a spend costs. This edits [`magic.md`](magic.md), which
[`tomes-and-research.md`](tomes-and-research.md) §1.1 otherwise leaves alone.

## Open decisions

0. **When does the tree get repriced to §6's bands?** Every major still costs
   what it did as a 24-node tree (an era-3 major is 275–450 Gold), while the
   bands say 6,000–15,000. New ranks are deliberately priced to the legacy
   scale so the tree stays coherent with itself. Repricing is one pass over the
   `Technologies` sheet — but it changes the quest chain's Gold guarantee and
   the onboarding's feel, so it is a decision to make once, not a side effect
   of adding content.
1. **All-of, or N-of-M?** A keystone requiring all 26 nodes of Civics era 3 is
   a wall, and a player who does not care about fishing meets it. `25 of 26`
   keeps the pacing and removes the wall. This is the biggest risk in the
   design and it wants playtest, not argument.
2. **Villager training stayed on the Townhall** when everything else was
   stripped off it (§12). It is a player verb with a Food cost rather than a
   passive faucet, and nothing else in the game can train — but if the Townhall
   is to be *nothing* but permission, training needs a home first.
3. **Warfare is the smallest tome** at 47 against 64 and 56. Left there on
   purpose: it opens last, and a player who never delves can ignore it without
   the city stalling. Worth revisiting once `Conquest` and Knowledge make
   delving matter to the tree.
4. **Three tomes at ~167 nodes is a doubling of the authoring surface.** About
   40% is rank II/III rows — same name, next number, next price — so the cost
   is far below the node count. It is still the largest content commitment in
   the repo and it should be sized against `../road-to-mvp.md` §4's rule that
   the *second* one is the measurement that matters.

The canonical backlog of what shipped and what is broken stays in
[`../00-design-intent.md`](../00-design-intent.md); this document does not keep
its own copy.
