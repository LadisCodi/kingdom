# 7 · Research — three tomes, eras, and Knowledge as a clock

> **Scope.** The research **system**: technologies, the three tomes and their
> eras, the Knowledge currency that paces them, the Knowledge ↔ Stardust split,
> the research screen, and spells as technologies. The **content** — every
> node, the rank ladders and the price bands — is
> [`tech-tree.md`](tech-tree.md).
>
> **Status.** The tomes, the one-page-per-book flow chart with its era bars,
> the rank ladders, the Knowledge drip and the Stardust split are
> **built**, and the shape is authored in `?dev=tree`
> ([`../tech-tree-editor.md`](../tech-tree-editor.md)). Designed, not built:
> the centred node sheet (§5.4), the Gem finish on a running research (§1),
> spells as Magic nodes (§6), contested-landmark lumps (§7), guild investment
> (§8).

## 1. Technologies

- A technology is a one-time research that unlocks content: a building, a
  district level, a unit, a terrain, a mechanic, or one numeric step.
- **A technology is one object**, in `src/sim/data/tech-tree.json`, authored in
  `?dev=tree` ([`../tech-tree-editor.md`](../tech-tree-editor.md)): its name
  and glyph, its KIND, what it unlocks or what it moves, its Gold, Knowledge
  and seconds, its slot on its tome page and what it requires. There is no
  `Technologies` sheet.
- **What a technology SAYS is generated from what it does**
  (`src/sim/techProse.ts`) — from its `unlocks`, or from one sentence per
  effect written against the stat in the registry. Only a `mechanic` carries
  written prose, because only a mechanic's effect lives in code. A technology
  keeps no line it would have to hold in step with its own numbers.
- **Every technology is one of three kinds**, and it says which:

| Kind | What it does | Authored |
|---|---|---|
| **`unlock`** | opens content, and names it | fully — a dropdown per thing it opens |
| **`bonus`** | moves numbers, and names them (`effects`) | fully — a picker per number it moves |
| **`mechanic`** | what the sim reads by id — `Conquest` bending the Knowledge rate, `SanctifiedRuins` doubling a drip | labelled only; the code does it |

- **The technology says what it opens, and every gate is derived from that**
  (`GATES`, `src/sim/data/definitions.ts`): a district's `requiredTech`, a
  level's, one more of a district, a unit's, a harvest source's, a terrain's.
  No district, unit or harvest row names its own technology any more, and two
  technologies claiming one gate is an error.
- **Cost: Gold + Knowledge + time.** Gold is paid from the **city** purse, so
  the tree competes with fog, buildings and Wonders for one budget
  ([`16-wonders.md`](16-wonders.md) §1). Knowledge is paid from the **kingdom**
  wallet (§3). Both are paid up front, in one go, like a build. No
  part-payment.
- **Every era costs Knowledge, era 1 included** (2026-09-08): the clock runs
  from the first minute on a base rate, so the opening pays it too — 1 for a
  rank, 2 for a major, against a grant of 25. Era-1 nodes run 3–120 s.
- Research completes through the unified advance, in real time, while the
  player is away. `techCompletesAt` is its boundary source.
- **Slots:** base 1, max 3. Slot 2 costs 2,500 Gems, slot 3 costs 5,000
  (`base × growth^purchased`). Slots are bought with Gems and by nothing else;
  no technology grants one.
- `Scriveners I–III`: −5% research time per rank, fixed when the research
  starts and persisted on it. A rank landing mid-research does not move that
  research; the next one is quicker.
- Each node lists `requires` (one to three); content gates on `requiredTech`.
  A prerequisite never points into another tome, and never at a card further
  down its own page. A card on a page's **first row** requires nothing —
  there is nothing above it to require, which is what opening a book means.
- Gems finish a running research the way they finish a build *(designed, not
  built)*.
- The tree has 180 rows: **Civics 71 · Magic 57 · Warfare 52**, totalling
  **550,165 Gold and 50,495 Knowledge**. Price bands per era are in
  [`tech-tree.md`](tech-tree.md) §5.

### 1.1 Majors and minors

| Band | What it does | Price |
|---|---|---|
| **Major** | unlocks content | expensive, long |
| **Minor** | one numeric step; carries a roman numeral (`Sawpits I → II → III`) | cheap, short |

- A **rank ladder** is a chain of ranks; each rank requires the one before.
  A ladder is a naming convention — a stem plus a roman numeral — not a field.
- **A ladder's rank N sits in era N.** Era N holds its own new majors, rank N
  of every earlier ladder, and rank I of the ladders it introduces.
- A ladder may **ramp**: each rank carries its own value, so +1, +2, +3 is as
  legal as +1, +1, +1.
- A rank costs Gold, Knowledge and time like any other node. There are no
  instant purchases in the tree.
- The ladders per tome are listed in [`tech-tree.md`](tech-tree.md) §2–§4.

### 1.2 What a bonus moves

A `bonus` names its effects, and each is four fields:

| Field | What it says |
|---|---|
| `stat` | which number, from the registry (`src/sim/data/techEffectRules.ts`) |
| `op` | `percent` or `flat` |
| `value` | **signed**, in whole points for a percent — `-22` is −22% |
| `target` | what it aims at: a district, a unit, a unit tag, a harvest source, a tome. Absent = every subject of that stat |

- A stat may **narrow which ids of a kind it accepts**, where only some of
  them have the number at all: a recovery bonus aimed at a berry bush, which
  is consumed rather than regrown, is refused the way a `flat` on a bare
  multiplier is. The narrowing is derived from the workbook, so giving the
  berries a regrowth time is what makes them aimable.

- A total is the **sum over completed technologies** whose effects match
  `(stat, target)`. An unaimed effect reaches every query of its stat; an aimed
  one only its own target.
- Effects apply in one place, as a three-stage pipeline: base → **the completed
  technologies** (`src/sim/techEffects.ts`) → the modifier stack. Both the
  middle stage and an empty stack are the exact identity.
- A technology may carry several effects; most carry one.
- **A new kind of bonus is data.** "+5% gold income at Housing" and "+8% at
  Market" are one stat with two targets — no new code. A new *number* is code:
  one registry entry plus the call site that owns it.

### 1.3 Planned nodes

- A row may carry `planned: true`: it is on the tree, researchable, and does
  nothing yet.
- Its info panel says so ("Not yet in the prototype").
- 17 rows are planned; the list and the rules are
  [`tech-tree.md`](tech-tree.md) §7.

## 2. The shelf — three tomes

| Tome | Remit |
|---|---|
| **Civics** | the city and its purse |
| **Magic** | the land's magic and what you can see of it: fog, Mana, relics, ruins, the water |
| **Warfare** | the army, and what it goes into the ground for |

- `TomeId` = `Civics | Warfare | Magic`. A new tome is code.
- **A tome is one page**, read top to bottom behind a shelf of tabs: three
  columns of cards with an era bar across the width wherever the next band
  begins (§2.2). Not a canvas, and not a tab per band.
- **Every book is open, from the first minute** (`isTomeOpen`). No technology
  opens one, and none can be shut. What paces a book is its era bars, which
  ask for revealed cells (§2.1).
- **Nothing is granted and nothing is free.** A fresh kingdom has an empty
  `completed`, and every technology costs Gold and takes time.
- **No edge crosses tomes.** Townhall level gates the Sanctum (L2 needs TH2)
  and the four military halls independently of the tree, so Civics paces the
  other two without an edge.
- Which tome a technology is in is **shape, not a number**: it is a drag in
  `?dev=tree`, not a column in the workbook
  ([`../tech-tree-editor.md`](../tech-tree-editor.md)).
- Exploration — Cartography, Sailing, Scaling Tools, Fishing, Shipbuilding,
  the Docks — lives in Magic. Scaling Tools gates *working* a mountain, not
  reaching it ([`01-map-and-fog.md`](01-map-and-fog.md) §3).
- A ruin pays the tree in Knowledge (§7).
- **Two tomes may aim at the same outcome; they may never move the same
  stat.** More per strike (`workerYield`, Civics) and faster regrowth
  (`cellRecovery`, Magic) are two stats reaching one outcome. The same rule
  holds between relics and ranks ([`09-relics.md`](09-relics.md) §9).

### 2.1 Eras and the bars between them

- **A book carries its own bands**, authored in `?dev=tree`: how many it has
  and what each asks for are one list per book, so Civics may run to three
  while Warfare runs to four. A band is a run of rows on the page; the **era
  bar** spanning the page is the door between two of them, and the book's
  LAST band is drawn sealed.
- **A band opens on the world, not on a research.** Era 1 is the top of the
  page and asks for nothing; every band after it needs a slice of the region
  revealed. Nothing in a locked band is startable — `startTech` answers
  `EraLocked` — and the bar says how many cells are left.

| Band | Cells revealed | Civics | Warfare | Magic |
|---|---|---|---|---|
| era 1 | 0 — the top of the page | ✓ | ✓ | ✓ |
| era 2 | 30 | ✓ | ✓ | ✓ |
| era 3 | 100 | ✓ (sealed) | ✓ | ✓ |
| era 4 | 220 | — | ✓ (sealed) | ✓ (sealed) |

- A fresh kingdom opens with 16 cells revealed, so era 2 is about fifteen
  paid reveals away, and the quest chain asks for more than that before it
  points at an era-2 technology (`tests/quests.test.ts`).
- The count is **paid reveals only** (`revealedCellCount`): a cell a building
  merely *discovered* has been seen, not opened, and the same count is what
  the `DiscoverCells` quest goal follows.
- The gate is a state condition, not a timer: no boundary source, nothing to
  settle, and it cannot be bought with Gems or Gold directly — only by
  clearing fog, which Gold pays for.
- **Nothing holds a door but the bar.** There is no spine and no keystone: a
  technology that raises the Townhall's level (`Bureaucracy`, `Magistracy`) is
  an ordinary card, placed wherever the designer puts it, and the gate is
  derived from its `unlocks` like every other.
- A book's last band is drawn behind a dashed **Sealed** bar. Filling it is
  data.
- A player may research ahead in one tome; content still gates on Townhall
  level.

### 2.2 The page

- **The shape of the tree — which tome and band each card is in, where on the
  page, and what it requires — is authored in `?dev=tree`** and lives in
  `src/sim/data/tech-tree.json`
  ([`../tech-tree-editor.md`](../tech-tree-editor.md)). Every NUMBER stays in
  the workbook. Neither file can overwrite the other.
- A page is **three columns** wide and as many rows tall as the book needs.
  Three, because a fourth does not fit a phone and the flow stops reading as a
  flow past three.
- **A row is depth.** Every requirement sits on the row IMMEDIATELY above the
  card that needs it, so the page reads a line at a time and no edge is traced
  past cards it does not touch. One to three requirements per card; a card on
  the page's FIRST ROW requires nothing, because there is nothing above it.
- **A rank ladder is a name, not a chain.** `Sawpits II` does not require
  `Sawpits I`, nor sit anywhere near it: the numeral tells the player the bonus
  goes further down the book, and every rank is an ordinary card gated by the
  row above it.
- **Every technology has a slot, ranks included.** `Sawpits II` is a card in
  band 2, not a bead hanging off its parent — the fan the old canvas needed is
  gone, and so are `FAN_DX`/`FAN_DY`.
- A card is 120 × 96 px: its name on one line and three lines of what it does.
  Both at 18px, the only size the body face has, which is what fixes the
  numbers ([`../../src/ui/research/layout.ts`](../../src/ui/research/layout.ts)).
- **A connector never crosses a card, by construction.** It runs down its own
  column while that column is empty and crosses in the GUTTER between two
  rows; where the column is occupied it steps out into a side CHANNEL, down
  the outside of the page, and back in above its target. So there is no rule
  about connectors and nodes to get wrong.
- **A requirement that reaches back over an era bar IS drawn**, passing under
  the bar (`isDrawnEdge`): that edge is how two bands connect, and a band
  whose cards appear to grow from nothing reads as a page starting over rather
  than one continuing. The gate is a thing you cross, not a thing that severs
  the tree.
- `src/sim/data/techTreeRules.ts` is the one statement of what a legal tree
  is, checked by the editor as you drag, by the save endpoint, and by
  `tests/techTree.test.ts` against the shipped file.

## 3. Knowledge, the clock

- **Kingdom-scoped.** Lives in `state.kingdom.wallet` under the key
  `Knowledge`; survives a province reset.
- **Buys technologies and nothing else** (plus guild investment, §8, when
  built).
- **Uncapped.** A lump is a plain addition.
- **A base rate, and territory on top of it.** The kingdom learns **0.8 an
  hour** holding nothing, so the tree opens on the calendar; every landmark
  and ruin adds to that, so the province makes it open faster. A new kingdom
  starts with **25 Knowledge**, which is what the opening chain's cards cost
  (`Currencies.Knowledge.start`).
- **The rate is a fraction of one an hour, and the prices are tens.** Both
  were divided by ten on 2026-09-08: a research had come to cost thousands of
  a currency that dripped in whole units, which is a number nobody can hold in
  their head. Nothing about the pacing moved — the harness reaches the same
  Townhall level on the same day — and the ranks that lift the rate are
  fractions too (Wayposts, Vigils: +0.1 an hour each).

| Source | Rate | One-off | Key |
|---|---|---|---|
| the **base rate** | +0.8/h | 25 at the start | `knowledge.basePerHour`, `Currencies.Knowledge.start` |
| each **claimed landmark** | +0.2/h | +5 on claiming | `knowledge.perClaimedLandmarkPerHour`, `knowledge.landmarkClaimLump` |
| each **cleared ruin** | +0.2/h | +15 on first clear | `knowledge.dripPerClearedRuinPerHour`, `delve.firstClearKnowledge` |
| the **`Conquest`** technology | +0.3/h per cleared ruin | — | `knowledge.conquestPerClearedRuinPerHour` |
| `SanctifiedRuins` | ×2 on the per-ruin drip | — | a `mechanic` |
| `Vigils` · `Wayposts` | + per ruin · + per landmark, per rank | — | `bonus` ladders |
| `Scriptorium` | +% on the whole rate, per rank | — | a `bonus` ladder |
| `knowledgeYield` modifier | × on the whole rate | — | Wanderer's Compass relic passive; the `insight` delve boon (×3) |
| the **Conjunction** boon | — | +6 | `CONJUNCTION_BOONS[*].knowledge` (**OQ-12**) |
| the **quest chain** | — | 50 across nine quests | `rewardKnowledge` (Quests sheet) |

- A kingdom holding nothing drips **0.8/h** (19 a day); a fully explored
  province — ten landmarks, five ruins — **3.8/h** (91 a day) before
  `Conquest`, **5.3/h** after.
- The clock banks whole units on a **whole-millisecond period** rounded from
  the rate, which is what keeps one-call replay identical to stepped ticking
  when the rate is a fraction (invariant 1).
- **The chain seeds the clock.** Nine quests pay Knowledge — `OldStones`,
  `Attuned`, `Mapmakers`, `Surveyors`, `Highlands`, `PutToSea`, `SecondStory`,
  `IronRoad`, `Architect` — so every technology the chain asks for is
  affordable when asked, with zero drip (`tests/quests.test.ts`).
- `knowledgePerHour` and `accrueKnowledge` (`src/sim/mana.ts`) accrue whole
  units against the anchor `state.kingdom.lastKnowledgeAt` — the same shape as
  taxes and Mana, so all three replay identically. No boundary source and no
  settling step at a rate change.
- **Invariant 2:** the drip is *production* and stops at the 8-hour offline
  cap. Lumps ride the event that grants them and pay in full in the uncapped
  tail.
- Knowledge has no coin on the plank. It shows in the Research header with its
  rate; a node the player cannot yet afford shows a time-to-afford line
  (`knowledgeShortfallMs`).

### 3.1 Knowledge and Mana

| | Mana | Knowledge |
|---|---|---|
| Scope | city | kingdom |
| Fills with | time | claimed landmarks and cleared ruins |
| Ceiling | capped | uncapped |
| Spent on | taps and casts on the map ([`08-magic.md`](08-magic.md) §1) | technologies |

## 4. Knowledge and Stardust

| Currency | Buys | Source | Scope | Shown in |
|---|---|---|---|---|
| **Knowledge** | technologies | claimed landmarks, cleared ruins, quest lumps | kingdom | the Research header, with its rate |
| **Stardust** | relic levels and the hero ascension toll (`src/sim/collection.ts`, `src/sim/artifacts.ts`; [`10-heroes.md`](10-heroes.md) §4) | delves (`delve.stardustPerDepthPerTier` 6, `delve.firstClearStardust` 150), pulls (`gacha.pullStardust` 50), the chain (`rewardStardust`, 158 total) | kingdom | the Reliquary and hero screens |

- One job each. `knowledgeYield` multiplies the drip; `stardustYield`
  multiplies what a depth pays.
- A ruin's first clear pays **both** lumps.
- Neither has a row on the plank: a currency spent in exactly one screen
  lives in that screen's header. The full currency table is
  [`03-economy.md`](03-economy.md) §1.
- The code and doc key is `Stardust`; *Polvo estelar* is the localised string
  only.

## 5. The screen

### 5.1 Tabs

- One tab per **open** tome. A tome the player has not opened is not shown.
- Tab order: Civics · Magic · Warfare.

### 5.2 Tree fog

| State | Drawn as |
|---|---|
| **Normal** | researched, researching, or buyable — every prerequisite researched |
| **`?` silhouette** | one step ahead — every prerequisite is **normal**, so what comes next appears as soon as the card before it can be read, not once the player has paid for it. A dim dashed card with a `?`: no name, no cost, not tappable |
| **Hidden** | anything deeper is not rendered. A silhouette does not reveal its own children, so the frontier stays one step wide |

- The page is as long as what the fog shows: a row the fog has emptied
  collapses, so there are no blank lines in the middle of the flow.
- **Era bars never collapse.** A band the player cannot read yet still shows
  its bar, because the bar is the statement that there is more book.
- The page scrolls vertically and nothing else — it is exactly the phone's
  width by construction. On a fresh open it lands on the WORK: whatever is
  running or startable, and failing that the last thing finished.

### 5.3 Cards

- A card carries its **glyph and its name**, and nothing else. What a
  technology does is a sentence, and a sentence on a 120px card is three
  clipped lines that have to be tapped to be read anyway — so the card is an
  emblem and §5.4 does the talking. A dot marks anything startable now; an
  active research shows a progress bar.
- Colour is the state: researched, available, running.
- A card in a **locked band** is drained of colour and not startable; the bar
  above it says how many cells are left.
- A planned node is drawn dashed and hatched, like the fog's `?`, and carries
  a `planned` badge.
- Requirements read as ✓ / ✗ in the panel.

### 5.4 The info panel

Built as a side panel; the design is a **centred sheet** *(not built)*.

- One tap on a card, one sheet over the page, with its own close knob
  (`kit/surface.ts`). Header and nav stay above it, so the purse is readable
  while the player reads prices.
- Title: name, with the rank numeral for a minor (*Sawpits II*).
- **What it does:** the generated line in full (§1) — the first and only place
  it is read.
- A minor shows **before → after**:

```
Rank               2  →  3
Tap Power        +40%  →  +60%
```

- Requirements: prerequisite medallions, ✓ / ✗, tappable to scroll there —
  including the one that reaches back over an era bar, which the page does not
  draw (§2.2).
- Cost: Gold, Knowledge, time; time-to-afford when Knowledge is short. Behind
  a locked bar the action reads "Reveal N more cells to read on".
- Action: **Research**, or **Finish with Gems** on a running one *(not built)*.
- Slots: the bar shows in-flight research and a **Hire** button at
  `slotGemCost`.

## 6. Spells — designed, not built

> A relic is what you wear. A spell is what you know.

- A **spell node** is a Magic technology whose unlock grants a castable spell.
- A spell's **power, radius and duration** are rank ladders under its node.
- A spell is discovered once and never gated again: no slot, no equip, no
  charges, no cooldown. Mana is the only thing between a known spell and a
  cast ([`08-magic.md`](08-magic.md) §1).
- A spell may not require a node in another tome. Its sheet may **name** a
  related node as a tappable thumbnail without requiring it.
- Magic also holds `Resonance` (cast cost) and what raises the Mana cap.
- Relic passives stay the delve's reward ([`09-relics.md`](09-relics.md)
  §1). A player who never delves can discover, cast and upgrade spells
  (**OQ-41**).

| Spell | Effect | Relic active it replaces |
|---|---|---|
| **Divination** | pays a Discovered cell's entire remaining reveal cost | Dowsing Rod |
| **Bloom** | clears exhaustion on every resource cell in radius 2 | Verdant Seal |
| **Beckon** | a finite feature respawns on a cell the player chooses | Wanderer's Compass |
| **Haste** | worker yield ×2 for 60 minutes | Foreman's Sigil |

### 6.1 Code contract

| Built | Design |
|---|---|
| `CastBlock` = `NotOwned` \| `NoActive` \| `NotAttuned` \| `NotEnoughMana` \| `InvalidTarget` | `NotDiscovered` \| `NotEnoughMana` \| `InvalidTarget` |
| `castBlock` reads `ownsArtifact` and `isAttuned` | reads whether the discovering technology is complete |
| scaling reads the relic's level | scaling reads the spell ladder's own `effects` |
| `ArtifactDef.active: ArtifactActive \| null` | deleted — `ArtifactActive` becomes a spell definition keyed by its technology |
| — | a `Spells` sheet holds each spell's Mana cost |

- Effect functions stay `(state, map, target, now)`.
- Two stale docblocks in `ArtifactDef` go in the same pass: "Mana per hour
  drawn while attuned" and `carried`'s "attuning draws Mana every hour". There
  is no upkeep.

## 7. Ruins and landmarks

- A **cleared ruin** pays 150 Knowledge on first clear and +2/h after (§3).
- **No tome is gated behind anything.** Every book is open, so a ruin being
  *discovered*, not cleared.
- A **province landmark** pays +50 on claiming and +2/h while held.
- A **contested world-map landmark** ([`02-map-scopes.md`](02-map-scopes.md)
  §4) pays a Knowledge lump when taken and nothing while held *(designed, not
  built)*. Province landmarks stay on rate.

## 8. Guild investment — designed, not built

- The same "invest N Knowledge" action points at a guild structure; the top
  contributors are paid when it completes.
- Investment is a separate verb from buying a technology (a technology is
  bought outright, §1); the UI teaches the gesture on its own.
- Dependency of [`15-social.md`](15-social.md) §7. Donating to another
  player's Wonder is kept out of [`16-wonders.md`](16-wonders.md) §12 and is
  **OQ-59**.

## 9. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Era price bands | [`tech-tree.md`](tech-tree.md) §5 — **OQ-13** | `tech-tree.json`, with per-band totals in **`?dev=tree`** |
| Landmark drip · claim lump | 2/h · 50 | `knowledge.perClaimedLandmarkPerHour` · `knowledge.landmarkClaimLump` |
| Ruin drip · first-clear lump | 2/h · 150 | `knowledge.dripPerClearedRuinPerHour` · `delve.firstClearKnowledge` |
| Conquest drip | 3/h per cleared ruin | `knowledge.conquestPerClearedRuinPerHour` |
| Conjunction Knowledge lump | 60 | `CONJUNCTION_BOONS[*].knowledge` |
| Chain Knowledge | 500 total | `rewardKnowledge` (Quests sheet) |
| **A whole technology** — name, glyph, kind, unlocks or effects, Gold, Knowledge, seconds, tome, band, slot, requirements (prose only for a `mechanic`) | per technology | `tech-tree.json`, through **`?dev=tree`** ([`../tech-tree-editor.md`](../tech-tree-editor.md)) |
| **What a card says about one number** | one sentence per stat and op | `TECH_STATS[...].says` (`src/sim/data/techEffectRules.ts`) |
| How many bands a book has, and what each asks for | 3 · 4 · 4 bands; 0 · 30 · 100 · 220 cells | `tech-tree.json` `eras`, through **`?dev=tree`** |
| Three columns, card size, gutter, side channel | 3 · 120×96 · 36 · 14 px | `src/ui/research/layout.ts` |
| Research slots | 1, max 3, Gems 2,500 × 2^n | `research.techSlots` · `research.maxSlots` · `research.slotGemCostBase` · `research.slotGemCostGrowth` |
| `Scriveners` per rank | −5% research time | `tech-tree.json` (its own `effects`) |
| A spell's Mana cost | per spell | `Spells` sheet *(designed)* |
| Gems to finish a running research | undecided | *(designed)* |

## 10. Deliberately not in this design

- Instant, Gold-only upgrades as a second kind of node (`UPGRADES`,
  `buyUpgrade`, `state.upgrades`, the `BuyUpgrade` quest goal).
- **A hand-written line on a technology.** Prose beside the numbers it
  describes drifts the first time a ladder is rebalanced: 150 cards once
  shared 68 sentences, and five contradicted their own effects. The card is
  generated (§1); a `mechanic` writes one because its effect is code.
- A Knowledge cap.
- A base Knowledge rate, or one scaled by Townhall level or population.
- A city-scoped research clock.
- Buying Knowledge with resources.
- A library district or a scholar assignment as Knowledge sources
  ([`03-economy.md`](03-economy.md) §9).
- Mana paying for research.
- Trickle-and-commit: pouring Knowledge into a technology across visits.
- A Knowledge or Stardust row on the plank (§4).
- Five tomes; one radial canvas for the whole tree; a tab per band.
- A global age ladder instead of per-tome eras.
- A keystone that holds a band shut, or that requires every built major of the
  band above it (§2.1).
- **A technology that opens a book.** The three granted cover pages were free,
  instant and did nothing but mark a book open; the era bars already pace a
  book on what the player has revealed, so every book is simply open (§2).
- Gems or Gold spent to open a band directly (§2.1).
- A minor rank drawn as a bead fanned under its parent instead of a card in a
  slot of its own (§2.2).
- A rule about connectors crossing cards: the routing makes it impossible
  (§2.2).
- A technology in a spreadsheet: the `Technologies` sheet, and the three
  hand-written id lists that came with it (§1).
- A district, unit or harvest source naming its own `required_tech`: the
  technology says what it opens, once (§1).
- An editor that can author a new STAT. A `bonus` may move any number the
  registry declares, and aim it at anything that stat accepts, but the number
  itself has to be read by code
  ([`../tech-tree-editor.md`](../tech-tree-editor.md) §8).
- Exclusive branch picks.
- A prerequisite that crosses tomes (§2).
- A spell that requires a node in another tome (§6).
- The same stat appearing in two tomes (§2).
- A spell gated on anything after its discovery — a slot, a charge, a
  cooldown, an equipped item (§6).
- A technology that grants a slot; a per-tome research slot.
- Tomes found in ruins; a tome gated behind a ruin (§7).
- A contested landmark that raises the Knowledge rate (§7).
- A floating info card instead of a sheet (§5.4).
- A `mul` op beside `percent` and `flat`. `SanctifiedRuins` and `Roadworks`
  multiply an inner term, and giving them an op would make the resolver's one
  shape — `(base + Σflat) × (1 + Σpct)` — two shapes (§1.2). `Salvage` and
  `Tactics` are additive but sit where folding them would RE-ASSOCIATE the sum,
  and float addition is not associative. All four stay `mechanic`.
- A per-ladder HOOK in code — one union member and one call site per kind of
  bonus. Replaced by the stat registry, which is what makes a new bonus data
  (§1.2).

**Open questions:** **OQ-12**, **OQ-13**, **OQ-14**, **OQ-15**, **OQ-41**,
**OQ-59**, **OQ-69**. (**OQ-68** is retired: a band is not held by a keystone
any more, and what each bar asks for is a number, so it is OQ-13.)
