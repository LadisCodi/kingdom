# Implementation plan

> **What this is.** What is built, what is not, what order the rest goes in, and
> **which design questions have to be answered before a given piece can start.**
>
> This file owns the *sequence*. It does not own designs — every design lives in
> [`features/`](features/), and every unanswered question lives in
> [`open-questions.md`](open-questions.md). Where this file names a question it
> names it by id (`OQ-n`).
>
> **State: 43 test suites, 606 tests, all green** (verified 2026-09-03, after
> the province redraw closed the ten map-content assertions).
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
   source of truth for the MAP.** Editing the generated balance JSON by hand is
   silently overwritten.

Two more that are design-visible:

- **Effects resolve base → upgrade levels → modifier stack.** All adds summed,
  then all muls multiplied; an empty stack is the bit-exact identity. **Upgrade
  levels are not re-expressed as modifiers** — they are persisted as levels,
  purchasable and priced on a curve, and converting them would buy nothing.
- **An additive save change needs no migrator.** Every module read is already
  defensive, so a new module key or a new optional field is a version bump.
  **Migrators exist only for renames, reshapes and semantic changes** — and a
  save from a *newer* build is rejected rather than downgraded.

## 2. What is built

| Feature | Doc | State |
|---|---|---|
| The map, fog, terrain, features, reveal curve | [`01`](features/01-map-and-fog.md) | **built** |
| Currencies, taxes, the Market, adjacency | [`03`](features/03-economy.md) | **built** — one adjacency rule (OQ-48) |
| Harvest as a DEPOT, the tap as a duration, the strike | [`04`](features/04-harvest.md) | **rebuilt 2026-09-03** — the tap no longer mints, and the province has a stated ceiling |
| Districts, placement, cost curves, moving buildings | [`05`](features/05-city-and-districts.md) | **built** |
| Builders, no waiting line, the priced refusal | [`06`](features/06-construction.md) | **built** |
| The technology tree, tree fog, instant upgrades | [`07`](features/07-research.md) | **built** — Gold-priced; the **tome rework is designed and closed 2026-09-03**, blocked only on numbers |
| Mana, the Sanctum, landmarks, the rewarded ad | [`08`](features/08-magic.md) | **built** |
| Five relics, passives, attunement, attune-or-arm | [`09`](features/09-relics.md) | **built** — Fragments, not ingredients; and the **actives leave for the tomes** (designed 2026-09-03) |
| Heroes, the collection substrate, the gacha | [`10`](features/10-heroes.md) | **built** — two holes, §3 |
| Ruins, delves, checkpoints, combat, military buildings | [`11`](features/11-expeditions.md) | **built** — no contested landmarks |
| The quest chain, the onboarding, the daily chest | [`12`](features/12-quests.md) | **built** — orders were cut from the design 2026-09-03 |
| The timeline, the weekly event, the save migration chain | [`13`](features/13-events.md) | **the machinery is built** |
| The map editor, the shared map rules | [`map-editor.md`](map-editor.md) | **built** |
| **Wonders — the ladder with no top** | [`16`](features/16-wonders.md) | **designed, reviewed and closed 2026-09-03.** Unstarted and deliberately unsequenced — late-game by construction, and the game's only unbounded sink |

**The load-bearing assertion holds at every step** — across a research
completion, a modifier expiry, a Mana cap fill, army training, a delve depth
resolving, and an event window opening *and closing* during an absence.

## 3. Holes in what is built

Ordered by how soon a player meets them. **These are not design questions** —
each has an answer, or has one waiting in a doc.

| # | Hole | Where |
|---|---|---|
| ~~**H0**~~ | ~~**The tap mints matter, and the economy has no ceiling.**~~ **FIXED 2026-09-03** — §4 step 0. | [`04`](features/04-harvest.md) |
| **H1** | **Four of ten landmarks cannot be claimed.** `defended` is authored and claiming is gated on a cleared flag, but **nothing ever writes that field** — the encounter does not exist. A visible dead end, and the only thing that would give combat a job outside dungeons. | design in [`15`](features/15-social.md) §6; needs **OQ-35** |
| **H2** | **Hero XP is written and never read.** Every extraction banks it; nothing consumes it. Give it a job or delete the field. | [`10`](features/10-heroes.md) §9 |
| **H3** | **No gacha banner is authored.** The timeline carries a banner payload and the activation query exists, but the catalogue holds only the weekly event — **so rate-up is untested code.** | [`10`](features/10-heroes.md) §9 |
| **H4** | **The event cap behaviour was decided rather than flagged.** A window fires in the post-cap tail, so a long absence spanning it pays in full. Consistent with invariant 2, but it should be a written rule with a test rather than an accident. | needs **OQ-24** (ratify) |
| **H5** | **Adjacency is one rule** against thirteen districts. Pure data, and downstream of a bounded plot. | needs **OQ-1**, then **OQ-48** |
| **H6** | **The dev primitive gallery does not show the newer UI primitives.** | — |
| **H7** | **No new sounds.** Casting, claiming, delving and the checkpoint all reuse existing SFX. | [`audio-wishlist.md`](audio-wishlist.md) |

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
decided it: the game holds **~780,000 Gold of sink** — 527,000 in landmark
claims, 194,142 in fog, 51,926 in the fifteen upgrades, 6,600 in the tree — and
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
- **It raises the price of leaving OQ-1 open.** An endless ladder on a *placed*
  building with a deliberately oversized footprint is only a decision while
  ground is scarce — so this is the third thing waiting on a bounded plot, after
  adjacency v2 (OQ-48) and expansions.
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
piece that makes decision 4 affordable.** §2 names the real bottleneck — *the
layout is authored content* — and a bounded vertical page deletes it rather than
testing it: **a node authors its tome, its column (0–2) and its requires, and
its row is derived** by longest-path layering. `node: {x, y}` goes away, and
with it the only test in the repository protecting a UI decision (all but the
same-column-skip case). **Authoring twenty new nodes stops also meaning
authoring twenty positions that must not collide.**

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
| **Civics** | 18 nodes | **splitting, not writing** — and the derived layering already produces the bands: `Forestry` / `UrbanPlanning · Saws · Hunting · Agriculture · Cartography · ScalingTools` / `Communities · Farming · Market · Masonry · Sailing` / `Architecture · Mining · Engineering · Fishing` / `DeepMining · Shipbuilding`. **Start here** — it is the opening game and the only tome authorable without inventing anything |
| **Warfare** | 5 nodes | **one more tier.** Unit bonuses are the easiest honest nodes in the game: the stat exists and the sentence needs no explanation |
| **Magic** | 5 with the spells folded in | **the most invention.** Every enchanted route to an economic outcome is a legal node and none is written |

**Two cuts to make first, because everything else sits on them:** `Forestry →
Warrior` and `Forestry → Attunement` are the only two cross-tome prerequisites
left, and both have to go (§6.2). **Forestry gating the Barracks and the Sanctum
was never saying anything.**

**Where it lands, and the one code step that has to come first.** Tome, column,
tier and the join threshold are columns on the `Technologies` sheet, and the
workbook owns them — so **the importer schema in `scripts/balance.mjs` has to
learn them before any of this can be authored**, following the procedure
`CLAUDE.md` already documents: edit the JSON *and* the schema, then
`npm run balance:export`, then `npm run balance`. `node: {x, y}` comes out in
the same pass.

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
- **Blocked on: OQ-1.** And once it lands, **OQ-48** (adjacency v2) becomes worth
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
research speed, training speed, ingredient yield), three new schedule payloads
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
5. **The siege** — which is what finally writes the cleared flag and closes H1.

- **Design:** [`15-social.md`](features/15-social.md) — complete.
- **Blocked on: OQ-35** (how a siege resolves — the design has an answer that
  scales from one player to ten, and it needs signing off), **OQ-33** (guild
  ranked or cooperative), **OQ-34** (help touches whose state), **OQ-36**,
  **OQ-38**, **OQ-39**. And **OQ-7** and **OQ-10** if ingredients ship with it.
- **Depends on:** Step 3's build-speed modifier stat.
- **Gate:** two playtesters in one guild each see the bar move because of what
  the other did; the daily cap holds against a client that spends it twice; a
  gift applied during an absence **still leaves the replay assertion true**.
- **Size:** weeks.

### The ingredient rework

Designed and deliberately not sequenced — large, a reshape rather than an
addition, and it needs answers first.

| Rework | Design | Blocked on |
|---|---|---|
| **Nine-piece ingredient sets, replacing Fragments** | [`09`](features/09-relics.md) §4 | **OQ-7**, **OQ-8**, **OQ-9**, **OQ-10** |

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
| **The map** — terrain, features, landmarks, ruins | `region-map.json` | **`?dev=map`** ([`map-editor.md`](map-editor.md)) |
| **Event and banner schedules** | a live-ops data file | hand-written — wall-clock dates are not balance numbers |

Data versus code, in one table:

| Data — no code change | Code |
|---|---|
| every balance number | a new quest **goal type** |
| **the whole map**, in the editor | a new terrain or feature id, or a sixth ruin |
| the whole quest chain — **row order is chain order** | a new modifier stat (one line plus one call site) |
| event and banner schedules, modifier magnitudes by template id | a new schedule payload kind and its handler |
| a seasonal hero = one hero row + one banner row | tech-tree node positions — `node_x` / `node_y` are authored content ([`07`](features/07-research.md) §2.2) |
| a second region = a JSON map + a row in the region table | anything multi-region beyond the discriminator |

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
