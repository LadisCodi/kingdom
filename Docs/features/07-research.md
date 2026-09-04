# 7 · Research — three tomes, eras, and Knowledge as a clock

> **Scope.** The research **system**: technologies, the three tomes and their
> eras, the Knowledge currency that paces them, the Knowledge ↔ Stardust split,
> the research screen, and spells as technologies. The **content** — every
> node, the minor lines and the price bands — is
> [`tech-tree.md`](tech-tree.md).
>
> **Status.** The tomes, eras, keystones, minor rank lines, the Knowledge drip
> and the Stardust split are **built**. Designed, not built: the centred node
> sheet (§5.4), the Gem finish on a running research (§1), spells as Magic
> nodes (§6), contested-landmark lumps (§7), guild investment (§8).

## 1. Technologies

- A technology is a one-time research that unlocks content: a building, a
  district level, a unit, a terrain, a mechanic, or one numeric step.
- **Cost: Gold + Knowledge + time.** Gold is paid from the **city** purse, so
  the tree competes with fog, buildings and Wonders for one budget
  ([`16-wonders.md`](16-wonders.md) §1). Knowledge is paid from the **kingdom**
  wallet (§3). Both are paid up front, in one go, like a build. No
  part-payment.
- **Era 1 costs no Knowledge.** Era-1 nodes run 3–120 s and cost Gold only.
- Research completes through the unified advance, in real time, while the
  player is away. `techCompletesAt` is its boundary source.
- **Slots:** base 1, max 3. Slot 2 costs 2,500 Gems, slot 3 costs 5,000
  (`base × growth^purchased`). Slots are bought with Gems and by nothing else;
  no technology grants one.
- `Scriveners I–III`: −5% research time per rank, fixed when the research
  starts and persisted on it. A rank landing mid-research does not move that
  research; the next one is quicker.
- Each node lists `requires`; content gates on `requiredTech`. A prerequisite
  never points into another tome.
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

- A minor **line** is a chain of ranks; each rank requires the one before.
- **A line's rank N sits in era N.** Era N holds its own new majors, rank N of
  every earlier line, and rank I of the lines it introduces.
- A line's value = completed ranks × `effectPerRank` (`effect(state, line)`,
  `src/sim/upgrades.ts`). Every rank of a line carries the same per-rank number.
- Effects apply in one place, as a three-stage pipeline: base → completed
  ranks → the modifier stack.
- Scoped tap and worker yields (`TAP_YIELD_UPGRADES`, `WORKER_YIELD_UPGRADES`)
  are lookup tables at the call site, keyed on tech ids.
- A rank costs Gold, Knowledge and time like any other node. There are no
  instant purchases in the tree.
- `TechLineId` is a union; a new line is code. The lines per tome are listed
  in [`tech-tree.md`](tech-tree.md) §2–§4.

### 1.2 Planned nodes

- A row may carry `planned: true`: it is on the tree, researchable, and does
  nothing yet.
- Its info panel says so ("Not yet in the prototype").
- 17 rows are planned; the list and the rules are
  [`tech-tree.md`](tech-tree.md) §7.

## 2. The shelf — three tomes

| Tome | Remit | Opens | Spine |
|---|---|---|---|
| **Civics** | the city and its purse | at game start | `Charter` — Townhall +1 level per keystone |
| **Magic** | the land's magic and what you can see of it: fog, Mana, relics, ruins, the water | the **first paid reveal** | `Attunement` — Sanctum +1 level and a step in the Mana ceiling |
| **Warfare** | the army, and what it goes into the ground for | the **first discovered ruin** | `Warband` — the four halls +1 level and the next tier of soldier |

- `TomeId` = `Civics | Warfare | Magic`. A new tome is code.
- **A tome is a screen**: three bounded pages behind a shelf of tabs, not one
  canvas.
- A tome is **open** once its cover page is complete (`isTomeOpen`,
  `openTome`, `src/sim/research.ts`). Opening is idempotent. All three open in
  the first session.
- **Cover page** = rank I of the spine (`CharterI`, `AttunementI`,
  `WarbandI`). It costs 0 Gold and 0 seconds and is granted, never bought
  (`isGranted` recognises it by exactly that).
- **No edge crosses tomes.** Townhall level gates the Sanctum (L2 needs TH2)
  and the four military halls independently of the tree, so Civics paces the
  other two without an edge.
- Exploration — Cartography, Sailing, Scaling Tools, Fishing, Shipbuilding,
  the Docks — lives in Magic. Magic opens on the first paid reveal, so
  Cartography is reachable when the quest `Mapmakers` asks for it. Scaling
  Tools gates *working* a mountain, not reaching it
  ([`01-map-and-fog.md`](01-map-and-fog.md) §3).
- Ruins do not grant tomes; a ruin pays the tree in Knowledge (§7).
- **Two tomes may aim at the same outcome; they may never move the same
  stat.** More per strike (`workerYield`, Civics) and faster regrowth
  (`cellRecovery`, Magic) are two stats reaching one outcome. The same rule
  holds between relics and ranks ([`09-relics.md`](09-relics.md) §9).

### 2.1 Eras and keystones

- Each tome has eras 1–3 and a sealed era 4. Eras are per tome, not a global
  ladder.
- **A keystone** is a spine rank II or higher. It requires **every *built*
  major of the era above it** — not the ranks, not the planned nodes.
  Completing it opens the next era of that tome.
- Nine keystones; each also unlocks a real dial: Townhall level (`Charter`),
  hall levels and the next unit tier (`Warband`), Sanctum levels and Mana
  ceiling (`Attunement`).
- Era 4 is one keystone per tome (`CharterIV`, `WarbandIV`, `AttunementIV`),
  drawn with the `?` silhouette and not researchable. Adding era 4 is data
  rows.
- A player may research ahead in one tome; content still gates on Townhall
  level.

### 2.2 Layout

- A major has an authored position, `node_x` / `node_y`, on its tome's page;
  each page is one era of one tome.
- A rank has no position: each line is one bead under its parent major (§5.3).
- Connectors route horizontal-then-vertical (`src/ui/research/layout.ts`);
  `FAN_DX` 56 px spaces the beads. Three lines per major is the fan's limit.
- `tests/research.test.ts` asserts no connector runs through another node
  (`edgeCells`).

## 3. Knowledge, the clock

- **Kingdom-scoped.** Lives in `state.kingdom.wallet` under the key
  `Knowledge`; survives a province reset.
- **Buys technologies and nothing else** (plus guild investment, §8, when
  built).
- **Uncapped.** A lump is a plain addition.
- **No base rate.** The rate is the ground the kingdom holds:

| Source | Rate | One-off | Key |
|---|---|---|---|
| each **claimed landmark** | +2/h | +50 on claiming | `knowledge.perClaimedLandmarkPerHour`, `knowledge.landmarkClaimLump` |
| each **cleared ruin** | +2/h | +150 on first clear | `knowledge.dripPerClearedRuinPerHour`, `delve.firstClearKnowledge` |
| the **`Conquest`** technology | +3/h per cleared ruin | — | `knowledge.conquestPerClearedRuinPerHour` |
| `SanctifiedRuins` | ×2 on the per-ruin drip | — | `Technologies` |
| `Vigils` · `Wayposts` | + per ruin · + per landmark, per rank | — | `Technologies` |
| `Scriptorium` | +% on the whole rate, per rank | — | `Technologies` |
| `knowledgeYield` modifier | × on the whole rate | — | Wanderer's Compass relic passive; the `insight` delve boon (×3) |
| the **Conjunction** boon | — | +60 | `CONJUNCTION_BOONS[*].knowledge` (**OQ-12**) |
| the **quest chain** | — | 500 across nine quests | `rewardKnowledge` (Quests sheet) |

- A fully explored province — ten landmarks, five ruins — drips **30/h**
  (720 a day) before `Conquest`, **45/h** (1,080 a day) after.
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
| **Stardust** | hero and relic levels (`src/sim/collection.ts`, `src/sim/artifacts.ts`) | delves (`delve.stardustPerDepthPerTier` 6, `delve.firstClearStardust` 150), pulls (`gacha.pullStardust` 50), the chain (`rewardStardust`, 158 total) | kingdom | the Reliquary and hero screens |

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
| **Normal** | researched, researching, or every prerequisite started |
| **`?` silhouette** | one step ahead — every prerequisite is normal. A dim dashed square with a `?`: no name, no cost, not tappable |
| **Hidden** | anything deeper is not rendered |

- The canvas is sized to what is visible.

### 5.3 Nodes

- A **major** is a rounded square. A dot marks anything startable now; an
  active research shows a progress bar.
- A **line** is one bead below its completed parent, labelled `rank/max`. The
  bead stands for the next rank to research; tapping it selects that rank.
- A planned node is drawn dashed and hatched, like the fog's `?`, and carries
  a `planned` badge.
- Requirements read as ✓ / ✗.

### 5.4 The info panel

Built as a side panel; the design is a **centred sheet** *(not built)*.

- One tap on a node, one sheet over the tree, with its own close knob
  (`kit/surface.ts`). Header and nav stay above it, so the purse is readable
  while the player reads prices.
- Title: name, with the rank numeral for a minor (*Sawpits II*).
- **Unlocks:** the sprite of what the node gives — district, district level,
  unit — from `techUnlocks` (`src/sim/research.ts`).
- A minor shows **before → after**:

```
Rank               2  →  3
Tap Power        +40%  →  +60%
```

- Requirements: prerequisite medallions, ✓ / ✗, tappable to scroll there.
- Cost: Gold, Knowledge, time; time-to-afford when Knowledge is short.
- Action: **Research**, or **Finish with Gems** on a running one *(not built)*.
- Slots: the bar shows in-flight research and a **Hire** button at
  `slotGemCost`.

## 6. Spells — designed, not built

> A relic is what you wear. A spell is what you know.

- A **spell node** is a Magic technology whose unlock grants a castable spell.
- A spell's **power, radius and duration** are minor lines under its node.
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
| scaling reads the relic's level | scaling reads `effect(state, <the spell's line>)` |
| `ArtifactDef.active: ArtifactActive \| null` | deleted — `ArtifactActive` becomes a spell definition keyed by its technology |
| — | a `Spells` sheet holds each spell's Mana cost |

- Effect functions stay `(state, map, target, now)`.
- Two stale docblocks in `ArtifactDef` go in the same pass: "Mana per hour
  drawn while attuned" and `carried`'s "attuning draws Mana every hour". There
  is no upkeep.

## 7. Ruins and landmarks

- A **cleared ruin** pays 150 Knowledge on first clear and +2/h after (§3).
- **No tome is gated behind a ruin.** Warfare opens on a ruin being
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
| Era price bands | [`tech-tree.md`](tech-tree.md) §5 — **OQ-13** | `Technologies` sheet |
| Landmark drip · claim lump | 2/h · 50 | `knowledge.perClaimedLandmarkPerHour` · `knowledge.landmarkClaimLump` |
| Ruin drip · first-clear lump | 2/h · 150 | `knowledge.dripPerClearedRuinPerHour` · `delve.firstClearKnowledge` |
| Conquest drip | 3/h per cleared ruin | `knowledge.conquestPerClearedRuinPerHour` |
| Conjunction Knowledge lump | 60 | `CONJUNCTION_BOONS[*].knowledge` |
| Chain Knowledge | 500 total | `rewardKnowledge` (Quests sheet) |
| A technology's Gold, Knowledge, duration | per row | `Technologies` sheet |
| `requires` | the shape; row order is not chain order | `Technologies` sheet |
| A node's `tome`, `era`, `node_x` / `node_y`, `line`, `effect_per_rank`, `planned` | per row | `Technologies` sheet |
| Research slots | 1, max 3, Gems 2,500 × 2^n | `research.techSlots` · `research.maxSlots` · `research.slotGemCostBase` · `research.slotGemCostGrowth` |
| `Scriveners` per rank | −5% research time | `Technologies` sheet |
| A spell's Mana cost | per spell | `Spells` sheet *(designed)* |
| Gems to finish a running research | undecided | *(designed)* |

## 10. Deliberately not in this design

- Instant, Gold-only upgrades as a second kind of node (`UPGRADES`,
  `buyUpgrade`, `state.upgrades`, the `BuyUpgrade` quest goal).
- A Knowledge cap.
- A base Knowledge rate, or one scaled by Townhall level or population.
- A city-scoped research clock.
- Buying Knowledge with resources.
- A library district or a scholar assignment as Knowledge sources
  ([`03-economy.md`](03-economy.md) §9).
- Mana paying for research.
- Trickle-and-commit: pouring Knowledge into a technology across visits.
- A Knowledge or Stardust row on the plank (§4).
- Five tomes; one radial canvas for the whole tree.
- A global age ladder instead of per-tome eras.
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
- A general upgrade-scoping mechanism (§1.1).

**Open questions:** **OQ-12**, **OQ-13**, **OQ-14**, **OQ-15**, **OQ-41**,
**OQ-59**, **OQ-68**, **OQ-69**, **OQ-71**.
