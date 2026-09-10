# Implementation plan

> **What this is.** What is built, what is not, what order the rest goes in, and
> **which design questions have to be answered before a given piece can start.**
>
> This file owns the *sequence*. It does not own designs — every design lives in
> [`features/`](features/), and every unanswered question lives in
> [`open-questions.md`](open-questions.md). Where this file names a question it
> names it by id (`OQ-n`).
>
> **State: 56 test suites, 960 tests, all green** (verified 2026-09-09, with
> the gate's 29).
>
> **2026-09-03 was a design day and changed no code.** Four things were settled
> and written: **generated orders were cut** and replaced by
> **[`16-wonders.md`](features/16-wonders.md)**, the endless Gold sink; the
> **tome rework** was closed in shape (§4, Step 1); the **relic actives became
> tome spells**; and the research screen was **reshaped into three vertical
> tomes**. **Step 1 is what starts next, and Step 1.1 under it is the
> pending work.**

## 1. The engine contract

Five properties the sim holds, and **breaking one is a bug even if the tests
pass.** They are restated in `CLAUDE.md` for anyone writing code; they are here
because they constrain what a *design* may ask for.

1. **One-call offline replay equals stepped ticking.** The load-bearing assertion
   of the whole codebase. The advance loop walks to the *earliest next boundary*
   and applies discrete work exactly at it; boundaries are **absolute time**,
   never relative to a tick. Anything newly scheduled or expiring is one
   boundary source plus one branch — nothing else.
2. **The offline cap limits what the city PRODUCES, never what a TIMER does.**
   Production — workers, taxes, Mana regen — stops at 8 hours. Timers — build
   queue, research, delve depths, event windows — resolve in the uncapped tail.
   **When adding anything time-based, decide which it is and say so in the
   design.**
3. **The clock is always passed in.** The sim never reads a clock and never
   closes over the UI. A modifier's expiry is read from the sim's own last-advance
   stamp, not from the wall clock.
4. **Randomness is counter/hash, not a stream.** The key must identify **the
   event**, never the moment of the query. A stream would desync, because the
   advance groups work differently in replay than in live ticking — and a new
   consumer would shift every later roll for every existing player. Integer
   arithmetic, so it is bit-identical across engines and portable to a server.
5. **The workbook is the source of truth for every NUMBER; the map editor is the
   source of truth for the MAP; `?dev=tree` for the TECH TREE.** Editing the
   generated balance JSON by hand is silently overwritten.

Two more that are design-visible:

- **Effects resolve base → the completed technologies → modifier stack.** The
  tree's own stage sums what it aims at that number and is the exact identity
  when it aims at nothing; then all adds summed, all muls multiplied, an empty
  stack the bit-exact identity. **Neither a building level nor a researched
  technology is re-expressed as a modifier** — a modifier is something that
  happened to you and expires; both of those are facts about your kingdom.
- **An additive save change needs no migrator.** Every module read is already
  defensive, so a new module key or a new optional field is a version bump.
  **Migrators exist only for renames, reshapes and semantic changes** — and a
  save from a *newer* build is rejected rather than downgraded.

## 2. What is built

| Feature | Doc | State |
|---|---|---|
| The map, fog, terrain, features, reveal curve | [`01`](features/01-map-and-fog.md) | **built** — the Townhall's reach and the count multiplier on the price landed 2026-09-10; their numbers are OQ-92 |
| Currencies, taxes, adjacency | [`03`](features/03-economy.md) | **built** — six adjacency rules over three stats. The Market was **removed 2026-09-09**: nothing in the game buys a resource for Gold |
| Harvest as a DEPOT, the tap as a duration, the strike | [`04`](features/04-harvest.md) | **rebuilt 2026-09-03** — the tap no longer mints, and the province has a stated ceiling |
| Districts, placement, costs, moving buildings | [`05`](features/05-city-and-districts.md) | **built** — the Townhall's levels ask for villagers since 2026-09-10 (OQ-93) |
| Builders, no waiting line, the priced refusal | [`06`](features/06-construction.md) | **built** |
| The technology tree, tree fog, instant upgrades | [`07`](features/07-research.md) | **built** — Gold-priced; the **tome rework is designed and closed 2026-09-03**, blocked only on numbers |
| Mana, the Sanctum, landmarks, the rewarded ad | [`08`](features/08-magic.md) | **built** |
| Five relics, passives, attunement | [`09`](features/09-relics.md) | **built, and superseded** — the build has relics dropping from ruins, attunement slots, Stardust levels and a Fragments gate; **the design of 2026-09-09 replaces all four with the card collection** (§4, the collection rework). The actives left for the tomes 2026-09-03 |
| Heroes, the collection substrate, the gacha | [`10`](features/10-heroes.md) | **gacha built**; the hero **reworked 2026-09-08 onto the resolver** — a body and a type passive, XP levels, Fragment-plus-Stardust ascension, Gem hero slots — designed, unbuilt (Step 8). One hole, §3 |
| Ruins, depths, rooms, combat, military buildings | [`11`](features/11-expeditions.md) | **rebuilt 2026-09-09** — a ruin is depths of rooms, each one fight resolved on entry ([`11`](features/11-expeditions.md), [`11a`](features/11a-ruins-ui.md)), and the fight is the **tick auto-battler** ([`combat.md`](features/combat.md)) with the screen that replays its event stream. Tiers T2–T5 and authored boss formations are what is left |
| The quest chain, the onboarding, the daily chest | [`12`](features/12-quests.md) | **built** — orders were cut from the design 2026-09-03. The chest's **season, second track and Royal chest** ([`12`](features/12-quests.md) §3) landed 2026-09-09 |
| The timeline, the save migration chain | [`13`](features/13-events.md) | **the machinery is built** — the catalogue is **empty**: the weekly Conjunction was retired 2026-09-08 and events are being redesigned |
| The map editor, the shared map rules | [`map-editor.md`](map-editor.md) | **built** |
| **The gate — a garrison with a clock** | [`18`](features/18-garrisons-and-raids.md) | **built 2026-09-09** — the counter, the raid, the hoard, the fight and the screens. The fight is scored the way a room is until the resolver lands |
| **Wonders — the ladder with no top** | [`16`](features/16-wonders.md) | **designed, reviewed and closed 2026-09-03.** Unstarted and deliberately unsequenced — late-game by construction, and the game's only unbounded sink |

**The load-bearing assertion holds at every step** — across a research
completion, a modifier expiry, a Mana cap fill, army training, a gate's raid
falling due, and an event window opening *and closing* during an absence.

## 3. Holes in what is built

Ordered by how soon a player meets them. **These are not design questions** —
each has an answer, or has one waiting in a doc.

| # | Hole | Where |
|---|---|---|
| ~~**H0**~~ | ~~**The tap mints matter, and the economy has no ceiling.**~~ **FIXED 2026-09-03** — §4 step 0. | [`04`](features/04-harvest.md) |
| ~~**H1**~~ | ~~**Four of ten landmarks cannot be claimed.**~~ **FIXED 2026-09-09.** `defended` is gone from the map, the code and the save; every sanctuary is claimed for Gold. The fight with a clock lives on the ruins' gates. | [`18`](features/18-garrisons-and-raids.md); **OQ-35 closed** |
| ~~**H2**~~ | ~~**Hero XP is written and never read.**~~ **FIXED 2026-09-08.** It is a kingdom wallet row that buys any hero's levels; Stardust moved to the ascension toll. `SAVE_VERSION` 33 folds every save's per-hero tally into the one counter — nothing was ever spent from it, so every point is still owed. | [`10`](features/10-heroes.md) §4 |
| **H3** | **No gacha banner is authored.** The timeline carries a banner payload and the activation query exists, but the catalogue is **empty** since the Conjunction was retired — **so rate-up is untested code.** | [`10`](features/10-heroes.md) §11 |
| **H4** | **The event cap behaviour was decided rather than flagged.** A window fires in the post-cap tail, so a long absence spanning it pays in full. Consistent with invariant 2, but it should be a written rule with a test rather than an accident. | needs **OQ-24** (ratify) |
| **H6** | **The dev primitive gallery does not show the newer UI primitives.** | — |
| **H8** | **Two rank ladders price rules the room model retired.** `Bearers I–III` buys back part of a haul (`haulLoss`) and `Pathfinders I–III` hurries a depth's clock (`delveSpeed`); a room has neither — it pays the instant it falls, and a failed one takes nothing the player has banked ([`11`](features/11-expeditions.md) §5). Both stats are marked `retired` in `techEffectRules.ts`, which is what keeps the cards valid and legible while nothing reads them, and `tests/ladderEffects.test.ts` names the two ladders so the debt cannot be forgotten. **The fix is to re-point them in `?dev=tree`** — the tree is authored, not code. | [`11`](features/11-expeditions.md) §5 |
| **H7** | **No new sounds.** Casting, claiming, clearing a room and taking a depth all reuse existing SFX. | [`audio-wishlist.md`](audio-wishlist.md) |

## 4. What is next, and what blocks it

**Step 0 is done** — it had to come first, because every number the others
author is priced against production. Each row's "blocked on" column is a hard
gate: do not start the row until those questions are answered, because the
answer changes the shape of what gets built, not just its numbers.

**The late-game sink is designed and sits outside the sequence**, first below,
because a closed design that a playtester will not reach for weeks should not
hold a slot in front of work they meet in hour one.

**Step 1 is the tome rework**, and the piece of it that is outstanding is
**authoring the technologies themselves** — Step 1.1 is the brief.

### Step 0 · The extraction rebalance — **DONE 2026-09-03**

Fixed the two faults that left the economy without a ceiling: depletion counted
in **taps** rather than units, so a cell's total output scaled with upgrade
levels; and a tap priced against `cityGatherPerSecond` — *every* building's
output of that resource — so one tap on one tree paid **413 Wood** in a maxed
city and a full Mana pool was worth **~137,000 Wood**. `TapPower` was also dead
from the first staffed Sawmill, because it only lifted a floor that city
production beat.

- **Design:** [`04-harvest.md`](features/04-harvest.md), which also amended
  [`03-economy.md`](features/03-economy.md) §5,
  [`05-city-and-districts.md`](features/05-city-and-districts.md) §4 and
  [`08-magic.md`](features/08-magic.md) §7.
- **What landed:** a cell is a **depot** of `stock` units that thumb and crew
  both draw down; a tap is **`tap.workSeconds` = 20 seconds of the cell's own
  work**, floored at one unit, with a per-currency carry so a +20% upgrade is
  not lost to rounding; `TapPower` buys that **duration** (+20%/level over ten,
  ×3); workers **strike** the cell and **haul the load home** — the
  units leave the depot when the swing lands and reach the wallet at the shed,
  which is what stops the player and the crew taking the same wood twice while
  keeping the walk worth watching; the seven cell-scoped upgrades became
  **abundance of the ground**, lifting tap and crew alike; the queue taps
  (villagers and soldiers) are **gone**; the Gem refill became a **fraction of the
  cap** (0.34, so 3 Gems a pool); idle workers now loiter outside their
  building. `SAVE_VERSION` 24 forgives the old wear.
- **A strike-in-place model was built, played and reverted:** crews that
  worked a cell without walking home. It fixed the double-dip and cost the map
  its life — with no journey, a cell at radius 4 was worth exactly what one next
  door was, and the influence radius stopped deciding anything. The round trip
  is back with the fix intact (depot debited at the strike, wallet credited at
  the shed), and the gradient with it: 4.7 Wood a minute from a tree next door
  against 3.3 from radius 4.
- **One piece was built and cut the same day:** a per-house **advance budget**,
  capping how far a house's rent could be pulled forward and therefore capping a
  house at twice its own rent. It was consistent and it read as an arbitrary
  refusal in the hand, on the building the player taps most. The argument, the
  numbers and the risk it leaves live are kept in
  [`04-harvest.md`](features/04-harvest.md) §3.1 and **OQ-55**, because the
  reasoning is still sound and somebody will reach for it again.
- **The numbers:** `tap.workSeconds` is **10**, a tactile choice — about ten
  taps to a ten-unit tree. It was briefly 20 (five taps) and came back down on
  play. A full pool is then ~**5.5 minutes** of the city's own production **at
  both ends of the game**, and the province has a stated ceiling of **157
  Wood/min** across 57 trees — the first number in the project's history that
  says what this map can make. What the halving costs is priced in
  [`04-harvest.md`](features/04-harvest.md) §1.1 and §3.3: a bare thumb is worth
  20 workers against a crew of 30, so hand-play in a mature city needs
  `QuickHands` and `TapPower` bought into, and the ad halved with it (**OQ-51**).
- **Left open:** **OQ-43** corrected (a watcher gathers ~5%, not 50%); **OQ-51**
  (is the ad still worth six placements?); **OQ-44** and **OQ-54** (a full pool
  only just fits in the ground the map holds — density is the recommended exit);
  **OQ-52** (the thumb raiding its own crew's cells); **OQ-53** (a
  `WorkerCollect` goal type).
- **The strike's feedback landed with it:** the same punch and foley as the
  player's tap at half volume and **without the white flash**, gated to
  on-screen cells, silent below zoom 0.8, three voices maximum with ±5% extra
  pitch jitter. `playSfx` grew per-call gain, jitter and voice-limit groups;
  `TapFx` grew a strength so a strike punches without flashing; `DepositEvent`
  now names the struck cell and its ground.
- **Not done:** the intermediate depot art states (a half-cut tree between
  full and stump), which are wanted rather than required — two states work
  exactly as they do today.

### The late-game sink · Wonders — **designed and closed, deliberately unsequenced**

**Replaces generated orders, which were cut on 2026-09-03**
([`12-quests.md`](features/12-quests.md) §6). Same job, and the measurement that
decided it: the game holds **~29,100,000 Gold of sink** — 28,517,245 in fog,
527,000 in landmark claims, 51,926 in the fifteen upgrades, 6,600 in the tree — and
**every coin of it is one-time.** The end of the province is the end of the
economy, while the city never stops producing. The fault was the *shape*, not
the size, so the answer is a ladder with no last level rather than a daily
errand.

**A Wonder is a district you place whose level ladder is a CURVE rather than a
TABLE** — Gold cost on a growth curve, effect linear in the level, and no
`maxLevel` anywhere.

- **Design:** [`16-wonders.md`](features/16-wonders.md) — complete, reviewed and
  closed. **The three balance numbers are deliberately not set** (OQ-58): the
  shape is design and the values need a late game to measure against.
- **Blocked on:** nothing. **OQ-57** (art bill), **OQ-58** (the numbers) and
  **OQ-59** (the social hook) are a schedule, a playtest and a later layer; none
  changes the shape of what gets built. **OQ-60 closed on review.**
- **Why it is NOT next:** **it is late-game content by construction.** It gates
  on the last era, and it does not even need that gate for balance — while any of
  the 780,000 of one-time sink is unbought, a Wonder level is simply the wrong
  purchase, so the economy gates itself (§5.2). **A playtester who does not
  reach the last era never meets this feature**, which makes it the wrong thing
  to build before the things they meet in hour one.
- **Why it will be cheap when it comes, and it is the rarest reason in this
  codebase:** **a Wonder level adds no boundary.** It is instant on payment — no
  queue item, no timer — so `nextBoundary` and `applyDueAt` are untouched and
  invariant 1 has nothing new to hold. `District.level` is already a plain
  number, so **the state needs no change and no migrator.**
- **The five things that have to move**, and they are the whole cost:
  `maxLevel` must stop being a wall (`commands.ts:179`, `upgrades.ts:38`/`:50`);
  the per-level tables must be absent rather than long; **the count cap must be
  a hard one** — an exponential ladder loses to N cheap copies at every level,
  so a second copy defeats the sink (§3.2); the level cannot render as stars
  (`districtCard.ts:392`); and the purchase is `buyUpgrade`-shaped, not
  `upgradeDistrict`-shaped. Plus **one call site per Wonder** — `harvest.ts:88`,
  `mana.ts:61`, `upgrades.ts:157` — which is the honest bound on the set size
  (§7.1).
- **What its oversized footprint costs, now the plot is unbounded** (OQ-1
  closed 2026-09-07): the fog that revealed the ground, and the adjacency the
  footprint displaces. Not the ground itself.
- **Size:** days, whenever it is scheduled.

### Step 1 · The tome rework — **the shape is closed; the authoring is not**

**The single largest reshape on this list, and the one that changed most on
2026-09-03.** Four decisions were taken and written into
[`07-research.md`](features/07-research.md), so what used to be *blocked on
OQ-12 and OQ-13* is now **blocked only on numbers**:

1. **A tome is a page of technologies** — the technology stays the unit you pour
   Knowledge into. §4 of the doc said *a tome is a screen* and §3 said *a tome
   takes N Knowledge poured in*; those were two different games and one of them
   is now gone.
2. **The Knowledge drip is flat and ungated**, and **cleared ruins raise the cap
   rather than the rate.** Today's generator (`mana.ts`, 2 an hour per cleared
   ruin) returns **zero with no cleared ruin** — pointing the research clock at
   it would have put **the whole technology tree behind a dungeon** and turned
   **OQ-41**'s live risk into the shape of the game.
3. **The collection currency becomes Stardust**, freeing the name for the clock —
   and the scopes swap with the names (§4, [`03`](features/03-economy.md) §1.1).
4. **The tiers get newly authored technologies**, not a re-sort — and **the shelf
   is three tomes: Civics, Warfare, Magic.** What ships spreads very unevenly
   across them: **Civics 18, Warfare 5, Magic 5** once the spells are folded in.
   So **Civics needs splitting** (the content exists), **Warfare needs one more
   tier**, and **Magic needs the most invention** — its remit is *any effect the
   fiction can carry as enchantment*, so the enchanted route to an economic
   outcome is a legal node and none of them is written. Three is also what a tab
   strip holds on a phone, which is what settled the count.

**A sixth, taken 2026-09-03 from a reference layout: the page is a vertical
spine at most three columns wide, with branch and join nodes, and a tier gate is
a JOIN NODE** ([`07`](features/07-research.md) §2.1, §2.2). **This is the
piece that makes decision 4 affordable.** §2 named the real bottleneck — *the
layout is authored content*.

**Answered the other way, 2026-09-07: the layout stays authored, and got a
tool.** Deriving the row by longest-path layering would have deleted the
bottleneck and the authoring control with it — a designer who cannot say
*this branch reads left of that one* is not laying out a tree, they are
accepting one. `?dev=tree` ([`tech-tree-editor.md`](tech-tree-editor.md)) makes
authoring 180 positions a drag rather than a spreadsheet column, and
`techTreeRules.ts` catches the collisions that made hand-authoring risky —
checked as you drag, on save, and in CI.

**And a fifth, taken the same day, which pulls a second feature into this
rework: the four relic ACTIVES become tome SPELLS**
([`09`](features/09-relics.md) §1, [`07`](features/07-research.md) §6). A
relic is a passive and nothing else; a spell is a research node with upgrade
circles under it. **It is the only part of the rework that deletes more than it
adds** — three of the five cast blocks go, `ArtifactDef.active` goes, and
`casting.ts` stops reading `ownsArtifact` and `isAttuned` — and the effect
functions are untouched because they are already pure `(state, map, target,
now)`. It also fixes a shipping fault nobody designed: **carrying a relic into a
delve silently disarms its spell**, so the delve half of the game takes the
player's magic away.

- **Blocked on: OQ-13 only**, which is every number and needs the playtest.
  **OQ-12** is a reward-table choice, and the new **OQ-61**, **OQ-62** and
  **OQ-63** are the world map's landmark payloads, the authoring scope, and one
  awkward node. **None of them changes the shape.** **OQ-42 closed** — the tiers
  are the eras it was waiting for, so a technology's Gold is now priced per tier.
- **The machinery is already built**, which is the cheapest thing about it:
  `knowledgePerHour` and `accrueKnowledge` already accrue whole units against a
  stored anchor, the same shape as taxes and Mana. **What changes is what
  generates it, what bounds it and what it buys** — not how it accrues. And
  because the pour is by hand and a ready technology is today's technology,
  **`advance()` gains no boundary source** (the design's §12 records the auto-pour variant
  that would have cost one).
- **One bound is design rather than balance, and it is easy to miss.** Knowledge
  accrual runs in the continuous pass, so it is **production** and invariant 2
  stops it at the 8-hour offline cap. **The pool cap therefore only does any work
  while it sits below eight hours of drip** — above that the visible ceiling is
  decoration and an invariant the player cannot see does the limiting.
  **Assert it before it is argued twice.**
- **The real cost is authoring**, not engineering: six pages of technologies that
  do not exist yet, with **Arcana first** because it stands at one node.
- **Size:** weeks, most of it content.

#### Step 1.1 · The authoring pass — **the pending work, and where this starts**

> **Every technology has to be written, placed in a tome, given its column and
> its prerequisites.** That is the outstanding piece of this rework, it is the
> largest, and it is content rather than engineering.

**The rules a node must satisfy**, all settled and all checkable:

1. **It unlocks something** — a building, a level, a unit, a slot, an upgrade, a
   spell. *A node that unlocks nothing is the same lie as a lit tab that leads
   nowhere* ([`07`](features/07-research.md) §1, §2.1).
2. **Its prerequisites point inside its own tome.** The tier ladder is the only
   cross-tome gate (§6.2), and **a spell may not require a Civics node** (§7.2)
   — the adjacency comes back as a named thumbnail, never as a dependency.
3. **It authors `tome`, `column` (0–2) and `requires`. It does NOT author a
   position** — the row is derived (§6.6).
4. **Its band ends in a join node**, which carries the tier's name and numeral
   and is the tier gate (§6.3).
5. **Its Gold is priced for its tier** (§5.1) — the tiers are the eras OQ-42 was
   waiting for.
6. **It does not move a stat another tome moves** (§6.1.1). Two tomes may aim at
   one outcome; two tomes may not own one number.

**The three tomes need three different kinds of work:**

| Tome | At | The work |
|---|---|---|
| **Civics** | 18 nodes | **splitting, not writing** — and the derived layering already produces the bands: `Forestry` / `UrbanPlanning · Saws · Hunting · Agriculture · Cartography · ScalingTools` / `Communities · Farming · Masonry · Sailing` / `Architecture · Mining · Engineering · Fishing` / `DeepMining · Shipbuilding`. **Start here** — it is the opening game and the only tome authorable without inventing anything |
| **Warfare** | 5 nodes | **one more tier.** Unit bonuses are the easiest honest nodes in the game: the stat exists and the sentence needs no explanation |
| **Magic** | 5 with the spells folded in | **the most invention.** Every enchanted route to an economic outcome is a legal node and none is written |

**Two cuts to make first, because everything else sits on them:** `Forestry →
Warrior` and `Forestry → Attunement` are the only two cross-tome prerequisites
left, and both have to go (§6.2). **Forestry gating the Barracks and the Sanctum
was never saying anything.**

**Where it lands.** **The whole technology came out of the workbook**
(2026-09-07). The `Technologies` sheet is gone and so are the three id lists
that shadowed it: a technology is one object in `tech-tree.json` — name, prose,
glyph, kind, unlocks, **what numbers it moves**, Gold, Knowledge, seconds,
tome, band, slot, requirements — authored in `?dev=tree`
([`tech-tree-editor.md`](tech-tree-editor.md)), which can also CREATE one.
`TechId` is that file's keys, so the type follows the data. A technology now
says what it opens, so `Districts`, `Units` and `Harvest` lost their
`required_tech` columns and every gate is derived.

A bonus followed (2026-09-07): the 37 minor `line`s and their per-line hooks
are gone, and a technology carries `effects` — a `stat` from a registry, an
`op`, a signed `value` and what it aims at. A kind of bonus nothing has yet is
now a target rather than a call site; a new NUMBER is still code, one registry
entry plus the reader that owns it.

What the workbook still owns is every other number, including the `Eras`
sheet — how many revealed cells each era bar asks for.

**What is still undecided and does not block starting:** the band sizes
(**OQ-62** — the three tomes will not want the same shape), the join thresholds
and every Knowledge number (**OQ-13**), and the tome names (**OQ-15** — *Civics ·
Warfare · Magic* are labels, and they should be named before a playtester sees
them).

### Step 2 · Bound the plot

**A balance number, not a refactor** — and the thing that makes placement a
decision, makes moving a building a decision, and gives adjacency something to
bite on. It is also the one item on this list that is a **30-day retention
question** rather than a content question, which is why it comes early despite
belonging to a post-prototype structure.

- **Design:** [`02-map-scopes.md`](features/02-map-scopes.md) §6.
- **OQ-1 closed 2026-09-07 — the plot is not bounded.** **OQ-48** (adjacency v2) is worth
  doing and is the best design-depth-per-hour in the repository.
- **Also do:** let the save record which *scope* a thing is in. **Cheap now,
  impossible later** — the save is the only artefact that cannot be changed
  retroactively.
- **Size:** days, plus the adjacency authoring.

### Step 3 · The event archetype

The pillar with the most weight, **and it is not an engine problem.** A recurring
window with a hard deadline, persisted phases and pre-replay reconciliation all
ship. What is missing is **the archetype** — the thing you author ten times a
year.

Three widenings first, once, deliberately: four new modifier stats (build speed,
research speed, training speed, card yield), three new schedule payloads
(a modifier by template id, an event track, an event shop), and moving the
schedules out of code into a live-ops data file. **Doing them in one pass is what
stops the next three events from each being a sprint.**

- **Design:** [`13-events.md`](features/13-events.md) — complete.
- **Blocked on: OQ-18** (does the event currency get a wallet row — the design
  says no and it must be settled before points exist), **OQ-19** (do events
  close — *not a dial: a deadline is a content-pipeline commitment*), and
  **OQ-24**. **OQ-4** and **OQ-22** shape the cost of the island but do not block
  starting.
- **The gate is a measurement, not a feature:** **author the second event and
  record the hours it took.** The first event is a build; the second is the
  **marginal cost of a content drop**, and that number decides whether a
  ten-a-year cadence is possible at all. **Better to know it in week six than in
  month nine.**
- **Also:** build speed is what the social layer's daily help needs, so this
  widening unblocks Step 5.
- **Size:** weeks.

### Step 4 · Simulated monetisation

A store that never charges, five more rewarded placements, and the telemetry that
makes a retention read-out possible at all. **No event pipeline exists today,
which means there is currently no way to produce a D30.**

- **Design:** [`14-monetization.md`](features/14-monetization.md) — complete.
- **Built 2026-09-04:** the store's first cut — the payer profile and its monthly
  budget (§3), Gem packs for simulated dollars, builders for Gems, and the hero
  banner as a doorway (§2.1). Purchases and refusals are kept in the save until
  the pipeline exists.
- **Blocked on: OQ-25** (how a pass is bought), **OQ-26** (does cosmetic content
  exist), **OQ-29** (disclosure — settle this before a playtester sees a price).
  **OQ-31** is a price to watch rather than a gate. OQ-28 closed with the
  monthly profiles; OQ-27 and OQ-30 with the repricing of every Gem sink to
  the 500-a-dollar ladder.
- **Gate:** a one-page ranking of surfaces by intent from at least two weeks of
  playtester sessions, with the caveat attached — and **if the ranking is not
  stable between week one and week two, the sample is the finding.**
- **Size:** days for the store, ongoing for the read-out.

### Step 5 · The social layer

The largest project here, ordered so **each step is playable before the next
exists.** Step 5.1 is worth shipping on its own merit: **the save stops
evaporating.**

1. Profiles and a display name, with optional account linking.
2. Neighbours, daily help with a cap, gifts drained at load.
3. Guilds and membership.
4. The guild week: the bar, contributions, threshold chests.
5. **The siege** — the world map's co-op encounter. (The province's
   garrisons shipped with Step 7.)

- **Design:** [`15-social.md`](features/15-social.md) — complete.
- **Blocked on: OQ-33** (guild
  ranked or cooperative), **OQ-34** (help touches whose state), **OQ-36**,
  **OQ-38**, **OQ-39**. And **OQ-89** if card trading ships with it.
- **Depends on:** Step 3's build-speed modifier stat.
- **Gate:** two playtesters in one guild each see the bar move because of what
  the other did; the daily cap holds against a client that spends it twice; a
  gift applied during an absence **still leaves the replay assertion true**.
- **Size:** weeks.

### The collection rework

Designed 2026-09-09 and deliberately not sequenced — a reshape of the relics
rather than an addition, and it wants the repeatable dungeon under it.

| Rework | Design | Blocked on |
|---|---|---|
| **The card collection, replacing attunement, Stardust levels, the Fragments gate and the relic drop** | [`09`](features/09-relics.md) | **OQ-88** (the free pack faucet — the repeatable dungeon), **OQ-91** (the chain's relic beats). OQ-89 and OQ-90 are numbers, not shape |

What it touches, so it is sized honestly: `attunement.*` and the slot SKU go;
`ArtifactDef` loses its level curve and keeps `base` and `per_level`; the
Fragments counter becomes a per-season card state plus stars; a **seasons
file** beside the events file names the albums and the hero; the season close
is one more `consider()` in `nextBoundary` and one branch in `applyDueAt`; a
pack's cards are rolled by hash on the pack id; the Relics tab becomes the
Collection tab and the reveal screen gains a second caller. **The migrator
keeps every relic a player holds at its level and drops the attunement and
Fragments state** — nothing a player earned converts to less.

Two notes that will otherwise be rediscovered painfully:

**A rename lands as ONE change — balance keys, code, migrator and docs
together.** Renaming in the docs first would leave them describing a currency the
build does not have, which is exactly the doc/code drift this documentation pass
exists to remove. **The tome rework's rename is the live example, and it is the
inverse case:** the docs went first years ago and the code never followed, so
twelve documents already say *Stardust* and the build has never heard the word.

**Both reworks need a real migrator, not a version bump**, and both have the same
trap: **a player mid-flight holds a balance earned under the old meaning.** A
bare key rename hands the whole technology tree to anyone holding Knowledge.
**Balances convert at the rates they were earned** — the rule the currency
simplification's migrator already followed. **The Stardust rename is the easy
direction of that rule**: the balance keeps its meaning and only changes its
name, so nothing converts — but the new `Knowledge` must be born at **zero**.

### Step 6 · The builder for thirty days

The city runs out of things to build in the first week. This step gives it a
30-day ladder: levels 6–10 for every building, four workshops turning Wood,
Stone and Mana into refined goods, decorations that supply Harmony, and the
Reliquary, Tavern, Watchtower and Dragon's Nest as the buildings that unlock
their systems.

- **Proposal:** [`proposals/builder-30-days.md`](proposals/builder-30-days.md).
- **Plan:** [`plans/builder-30-days.md`](plans/builder-30-days.md) — eleven
  steps, data before logic before UI, each closing with its own tests and a
  row in a thirty-day pacing harness.
- **Built:** steps 1–5 — the thirty-day harness, the goods stockpile, the four
  workshops ([`features/17-workshops-and-goods.md`](features/17-workshops-and-goods.md)),
  levels 5–10 of every building priced in goods
  ([`features/buildings.md`](features/buildings.md) §4.11) and adjacency v2
  ([`features/03-economy.md`](features/03-economy.md) §3.1); next is step 6,
  Harmony and the decorations.
- **Blocked on:** nothing for steps 1–4 (harness, goods, workshops, levels
  6–7); the
  banner's home (`14-monetization.md` §2.1) for the Tavern.
- **Size:** weeks; steps 2–4 alone are about two.

### Step 7 · The gate — a garrison with a clock — **DONE 2026-09-09**

**The doorway to combat, and the clock that sends the player to it.** Every
ruin opens with one garrison before Depth 1; discovering the ruin starts a
minute-scale counter; when it runs out the garrison takes a bounded,
recoverable slice of the banked materials, with no fight; a hero and a party
clear the gate as a room. **This is the step that reopened promise 1**, on
purpose and in writing ([`overview.md`](overview.md)), and it closed **H1** by
deletion — `defended` is retired and every landmark is claimed for Gold.

- **Design:** [`18-garrisons-and-raids.md`](features/18-garrisons-and-raids.md).
- **What landed:** a `gates` module — per ruin `{nextRaidAt, trips, hoard,
  cleared}` plus the raid reports, `SAVE_VERSION` 37, and no migrator (both
  are additive and their readers default). The counter is armed by a **sweep
  inside `advance()`**, stamped with a boundary's `t`, so a save that predates
  the feature gets its whole warning from where the sim left off rather than a
  raid already overdue. One `consider()` in `nextBoundary`, one branch in
  `applyDueAt`. The take reads the crews' gather rate plus rent for Gold — no
  third rate. `guard { threat, power, warningMinutes, periodMinutes }` is
  authored per ruin in `?dev=map` and checked by `mapRules.ts`; a `Garrisons`
  sheet keys the take and the supplies off the ruin's tier and `raid.*` bounds
  the rest. Clearing is a party command beside the delve launch, **and a hero
  alone is a legal board** — the first fight in the game needs no army. The
  quest chain gained `ClearGarrisons` and `DriveThemOut`, and the military
  block moved up behind the reveal that starts the Barrow's counter
  ([`12-quests.md`](features/12-quests.md) §2). UI: the raid tab on the right
  edge, the gate band that replaces *Send a party* on the ruin's card, the
  room sheet with the power comparison, and the minutes on the map marker.
- **What it rides on:** the fight is scored on the **delve's existing pass**
  ([`combat.md`](features/combat.md) is unbuilt) — the party's attack after the
  type chart against the gate's `power`, no attrition, nothing lost on a
  defeat but the supplies. When the resolver lands, `power` becomes the
  generator's budget and nothing else about this step moves.
- **What is asserted:** the replay assertion across an absence with three
  raids in it; a week away is three raids and never more; a raid takes only
  what the city produces and at most a tenth of the purse; clearing returns
  the hoard in full and stops the counter for good; no ruin is enterable while
  its gate stands; and every authored gate is weaker than the first depth of
  the ruin it guards (`tests/gates.test.ts`, 29 tests).
- **What came with the screen (2026-09-09):** the **battle screen**
  ([`11a-ruins-ui.md`](features/11a-ruins-ui.md) §2.5, §2.6) — one descriptor-driven
  screen for every fight, the enemy's squads derived from `guard` and scored
  against, and the party composed by **slots and card panels** instead of
  steppers. It needed two things from the sim, and both are the designed ones:
  **hero slots** (one free, the rest Gems, three on the board) with a party
  that carries several heroes, and **`Units.squad_size`**, the cap on what one
  slot holds. `SAVE_VERSION` 38.
- **Left open:** every number is **OQ-72** and needs the playtest — the
  Barrow's thirty minutes first. **OQ-74 closed**: the hoard comes back whole.
  Two `planned` technologies still describe the retired defended landmark
  (`Siegecraft`, `Wayshrines`) and want retiring in `?dev=tree`.

### Step 7b · Ruins become rooms — **DONE 2026-09-09**

**The delve is gone.** A ruin is depths of rooms; a room is one fight, fought
the instant it is entered, cleared in order and never replayed. Nothing is in
flight, so there is no depth clock, no checkpoint, no standing order, no safe
depth and no haul to carry home or lose.

- **Design:** [`11-expeditions.md`](features/11-expeditions.md) §1–§7,
  [`11a-ruins-ui.md`](features/11a-ruins-ui.md) §2.5.
- **What landed:** a `Depths` sheet — `rooms`, `guild_req`, `power_start`,
  `power_step`, `reward_base` and the supplies, 15 rows and 186 rooms, with
  §2's validation in the importer. `state.ruins` is `{depth, cleared}` per
  ruin; `state.delves` is deleted. `expeditions.ts` gained `frontier`,
  `roomReward`, `roomFormation`, `roomBlock`, `enterRoom` and `previewRoom`,
  and `combat.ts` `resolveRoom` in place of the staged descent. A room pays
  Gold, Stone, Stardust and hero XP by §7.1 with a boss at ×4 and a fragment,
  and the last room of the last depth is where the ruin's relic comes home.
  UI: the room sheet is the battle screen with the address in the widget
  (`Depth 2 · Room 5`, rooms cleared, boss) and the relic band under the
  board; the checkpoint sheet and the delve pill are deleted. `SAVE_VERSION`
  40 renames `kingdom.delves` to `kingdom.ruins` and carries the two facts
  that outlived a run — which ruins were bottomed, and how deep the player has
  been.
- **What is asserted:** the tier ladder walked room by room at the worst
  matchup (24 troops take half the Barrow, 60 finish it, 600 still cannot
  bottom the Observatory); every room costs soldiers, win or lose, and the
  preview says how many before the tap; a failed room takes nothing the
  player has banked; no room is replayable; a depth opens only when the one
  before it runs out (`tests/expeditions.test.ts` 49,
  `tests/expeditionFlow.test.ts` 18).
- **Left open:** the Adventurers' Guild does not exist, so `guild_req` gates
  nothing yet and finishing a depth is the only key there is; the boss chest
  is the formula ×4 rather than the authored chest of §7.2; and the passive
  generation of §7.3 is unbuilt. **H8** is the debt this step created.

### Step 7c · The tick resolver, and the screen that replays it — **DONE 2026-09-09**

**Combat stops being a sum.** `sim/battle.ts` is the auto-battler
[`combat.md`](features/combat.md) has specified since the beginning — hit
point pools, two rows a side, `frontage`, per-type targeting, cooldowns in
ticks, a 600-tick timeout the defender wins — and it emits the §13 event
stream. `ui/battleScreen.ts` replays that stream on its own mount, flashes a
slot that was hit, greys and marks one that fell, and hands a victory's
spoils to the gacha reveal.

- **What landed:** §5's unit table as authored data (`dmg`, `frontage`,
  `cooldown`, and `power` as a scale distinct from damage), a `combat.*`
  block, the §9.2 hero type passive, a `Villains` sheet and the seeded §11
  generator. Casualties are now whatever died in the fight, so `battleDamage`
  and `casualtiesFor` are gone — and a party that overwhelms a room loses
  nobody, which is what "bring more than enough" is finally worth.
- **What moved with it:** every `power_start`/`power_step` and every gate,
  re-measured by fighting rather than by arithmetic. 24 troops take most of
  the Barrow, 60 walk it out, 150 behind three heroes clear the Chapel, and a
  full board cannot bottom the Observatory.
- **What is asserted:** each rule against a hand-built board, plus a golden
  event stream (`tests/battle.test.ts`) and the playback machine on a fake
  clock (`tests/battlePlayback.test.ts`).
- **Left open:** unit tiers T2–T5 (no technology opens one), authored boss
  FORMATIONS beyond the boss villain, and **OQ-86** — re-authoring the ladder
  against the full tier range once tiers exist.

### Step 8 · Heroes onto the resolver

**Half of this landed with the resolver.** A hero is a body on the board with
`dmg`/`def`/`hp`/`cooldown` and the §9.2 type passive, and villains read the
same block. What is left is the COLLECTION half: Hero XP levels against the
authored curve, Fragment-plus-Stardust ascension (§4), and the roster screens
that sell both. Closes **H2**.

- **Design:** [`10-heroes.md`](features/10-heroes.md) — complete.
- **Blocked on:** the resolver step it rides on. **OQ-79** (the XP curve),
  **OQ-80** (boss Fragments) and **OQ-78** (the Stardust toll against the
  relic curve) are numbers, not shape.
- **What it costs:**
  - the workbook: `Heroes` loses `trait`, `trait_value`, `atk`, `atk_per_level`
    and gains `dmg`, `cooldown`, `dmg_per_level`, `troop_dmg_mult`,
    `troop_hp_mult`, `troop_def_bonus`, `passive_per_tier`, `power_base`,
    `power_per_level`; `heroes.*` settings for the rarity multipliers, the XP
    curve, the ascension toll and the hero-slot ladder; the importer schema.
    **The `Scout` row becomes `Ranger`**, with its portrait
    (`hero_scout.png`).
  - ~~state: the `HeroXp` wallet row and the XP-priced level~~ **done
    2026-09-08** (`SAVE_VERSION` 33), as is the Stardust toll on an ascension;
    ~~`heroes.heroSlotsPurchased`~~ **done 2026-09-09** with the battle screen,
    along with the party that fields several heroes. What is left in this step
    is the resolver's own half: the stat block, the type passive and the
    ~70% share.
  - `heroes.ts`: ~~`levelUpHero` charges Hero XP; `raiseHeroTier` charges
    Fragments **and** Stardust~~ **done**; `heroStats` becomes the resolved stat block
    (rarity multiplier, level growth, passive stepped by tier); `heroIsBusy`
    and `freeHeroes` go — nothing is ever busy.
  - `combat.ts` (the resolver): hero slots read the stat block and apply the
    passive at battle start; the mandatory-hero check; `hero_power` by formula.
  - `expeditions.ts`: the supply discount and the reward traits are deleted
    with the traits; XP and Stardust are paid per room
    ([`11-expeditions.md`](features/11-expeditions.md) §7).
  - UI: the hero tab reads the block and the passive and sells a
    level in XP and an ascension in Fragments plus Stardust; the party sheet
    fills up to three hero slots and sells the next one; the room sheet's
    power read includes `hero_power`.
  - tests: `heroes.test.ts` for the two ladders and the migration; a golden
    board with two heroes of one type asserting the additive passive; the
    replay assertion across a room paying XP into the kingdom wallet.
- **Gate:** an old save loads with every hero level intact and its XP summed;
  a fight with no hero is refused; two Warden-type heroes buff Warriors once
  by `1 + Σ(mult − 1)`; a hero's passive survives its death within the fight;
  the Guild ladder buys no hero slot.
- **Size:** two to three days once the resolver exists — mostly data and the
  two screens.

### Step 9 · Costs become a table — **DONE 2026-09-09**

**An authoring change, not a systems one** — and the one that makes every other
balance pass cheaper, because a price stops being an argument about three
growth dials and becomes a number a designer types. The sheet was seeded by
running the old curves, so the FIRST instance of every building costs exactly
what it did; every later one is on the new, much flatter curve.

- **Design:** [`05-city-and-districts.md`](features/05-city-and-districts.md)
  §3.
- **The workbook first.** A new `DistrictCosts` sheet — `district | level |
  gold | wood | food | stone | planks | cut_stone | iron | runestone` — one row
  per building per level, level 1 being the build. The `Districts` sheet loses
  every price it carried: `build_cost_gold/wood/food/stone`,
  `upgrade_cost_gold/wood/food/stone`, `build_cost_goods`,
  `upgrade_cost_goods_per_level`, `upgrade_cost_level_growth` and
  `upgrade_cost_late_level_growth`. It gains `instance_linear_growth` and
  `instance_exponential_growth` in place of `build_cost_multiplier` and
  `build_cost_exponential_growth`. `city.late_upgrade_from_level` stays: it
  still pivots the **wait**.
- **The goods columns are read, not multiplied** — one branch in the cost
  helper, and `buildGoodsCost`/`upgradeGoodsCost` collapse into one read of
  the row.
- **The ordinal is a save field.** A district carries the ordinal it was placed
  with. It is additive, so it needs no migrator — but an existing save has
  none, and a migrator that numbers each definition's districts in list order
  is what keeps an old city's prices from all collapsing to #1.
- **Also do:** delete `cancelQueueItem` and the card's Cancel button, and drop
  the Built-only clause from `canMoveDistrict`
  ([`06-construction.md`](features/06-construction.md) §1).
- **Gate:** the second Sawmill costs `M(2)` times the first at every level, not
  just at build; upgrading Housing #1 costs the same before and after Housing
  #4 is built; a card and a one-call offline replay agree on every price.
- **Also update `CLAUDE.md`** — its data-or-code table and its decoration line
  both name the goods columns that this step deletes.
- **Size:** a day of code, and then the authoring — 23 buildings × up to 10
  levels is the real cost of the step.

## 5. Deliberately after everything above

Named here so nobody rediscovers them, and so they stay out of scope.

- **The world map.** The hex lattice, scouting, per-player client-side fog,
  outposts, shards and contested claims.
  [`02-map-scopes.md`](features/02-map-scopes.md) §7 stages it, and §8 lists the
  four cheap things to spend *now* — because the save cannot be changed
  retroactively.
- **A guild league.** Small once the bar exists, and meaningless at prototype
  population (OQ-33).
- **Cosmetics as a pipeline**, if and only if the probe ranks (OQ-26).
- **A region generator.** The region discriminator is in. Restructuring the game
  state into a per-region record was explicitly cut — it moves the city, the fog,
  the features, the harvest state and the workers down a level and touches every
  sim file and every test. **That restructure plus a seeded generator with
  authored constraints turns "a second region" from a project into a row** — and
  Stardust is kingdom-scoped on purpose so it survives a region reset.
- **Server-side combat resolution.** Feasible, because combat is a deterministic
  scoring pass rather than a simulation — about the simplest thing there is to
  port.
- **The sim on the server.** Not needed by a prototype with named playtesters.
  **The reason to keep the sim pure is that this stays possible.**
- **A rotating-stock recycling shop, dynamic difficulty that rescales weekly.**

## 6. Authoring: where content comes from

Two homes, and **two writable homes for one fact is the drift this arrangement
exists to remove.**

| Content | Home | Tool |
|---|---|---|
| **Every number** — districts, harvest, technologies, upgrades, quests, currencies, units, relics, heroes, adjacency, settings | `balance/balance.xlsx` → generated JSON | the workbook, then the importer |
| **The map** — terrain, features, landmarks, ruins, **and the garrison on each site** | `region-map.json` | **`?dev=map`** ([`map-editor.md`](map-editor.md)) |
| **Event and banner schedules** | a live-ops data file | hand-written — wall-clock dates are not balance numbers |

Data versus code, in one table:

| Data — no code change | Code |
|---|---|
| every balance number | a new quest **goal type** |
| **the whole map**, in the editor | a new terrain or feature id, or a sixth ruin |
| the whole quest chain — **row order is chain order** | a new modifier stat (one line plus one call site) |
| event and banner schedules, modifier magnitudes by template id | a new schedule payload kind and its handler |
| a seasonal hero = one hero row + one banner row; **the whole shape of the tech tree**, in `?dev=tree` | a rule about what a legal tech tree is (`techTreeRules.ts`) |
| a second region = a JSON map + a row in the region table | anything multi-region beyond the discriminator |
| a gate's threat, power and counters, per ruin in the editor; take seconds and supplies per tier in the workbook | the `ClearGarrisons` goal type |

## 7. Testing conventions worth keeping

Not a list of tests — the two habits that have actually caught things.

**Play the real thing through the real sim with nothing granted.** The onboarding
test plays the opening spending only what the game grants and what it earns.
**Every dead end in an onboarding is an arithmetic failure between two numbers
authored in different sheets, and neither side's own unit test can see it.** It
found two on the first run.

**Assert the effect, never the display.** A party-wide hero bonus once applied to
the preview's displayed stats and to nothing else, and **the existing test
survived because it asserted the trait's name rather than its consequence.** The
same fault appeared twice in one day. Assert the damage, not the number on the
screen.

And: **prefer a test over a paragraph for any number that has been argued twice.**
The Gem faucet was derived from the data twice to answer the same question before
anyone wrote an assertion.
