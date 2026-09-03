# Implementation plan

> **What this is.** What is built, what is not, what order the rest goes in, and
> **which design questions have to be answered before a given piece can start.**
>
> This file owns the *sequence*. It does not own designs — every design lives in
> [`features/`](features/), and every unanswered question lives in
> [`open-questions.md`](open-questions.md). Where this file names a question it
> names it by id (`OQ-n`).
>
> **State: 43 test suites, 596 tests. 586 green; the 10 red are map-content
> assertions left behind by the province being re-authored, not code.**

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
| The technology tree, tree fog, instant upgrades | [`07`](features/07-research.md) | **built** — Gold-priced |
| Mana, the Sanctum, landmarks, the rewarded ad | [`08`](features/08-magic.md) | **built** |
| Five relics, passives, actives, attunement, attune-or-arm | [`09`](features/09-relics.md) | **built** — Fragments, not ingredients |
| Heroes, the collection substrate, the gacha | [`10`](features/10-heroes.md) | **built** — two holes, §3 |
| Ruins, delves, checkpoints, combat, military buildings | [`11`](features/11-expeditions.md) | **built** — no contested landmarks |
| The quest chain, the onboarding, the daily chest | [`12`](features/12-quests.md) | **built** — orders unstarted |
| The timeline, the weekly event, the save migration chain | [`13`](features/13-events.md) | **the machinery is built** |
| The map editor, the shared map rules | [`map-editor.md`](map-editor.md) | **built** |

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

Five pieces of work. **Step 0 is done** — it had to come first, because every
number the others author is priced against production. Each row's "blocked on"
column is a hard gate: do not start the row until those questions are answered,
because the answer changes the shape of what gets built, not just its numbers.

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
  [`08-magic.md`](features/08-magic.md) §8.
- **What landed:** a cell is a **depot** of `stock` units that thumb and crew
  both draw down; a tap is **`tap.workSeconds` = 20 seconds of the cell's own
  work**, floored at one unit, with a per-currency carry so a +20% upgrade is
  not lost to rounding; `TapPower` buys that **duration** (+20%/level over ten,
  ×3); workers **strike in place** and credit on the strike — no load, no return
  trip, and migration is what is left of travel; the seven cell-scoped upgrades
  became **abundance of the ground**, lifting tap and crew alike; the queue taps
  (villagers and soldiers) are **gone**; the Gem refill became a **fraction of the
  cap** (0.34, so 3 Gems a pool); idle workers now loiter outside their
  building. `SAVE_VERSION` 24 forgives the old wear.
- **One piece was built and cut the same day:** a per-house **advance budget**,
  capping how far a house's rent could be pulled forward and therefore capping a
  house at twice its own rent. It was consistent and it read as an arbitrary
  refusal in the hand, on the building the player taps most. The argument, the
  numbers and the risk it leaves live are kept in
  [`04-harvest.md`](features/04-harvest.md) §4.1.1 and **OQ-55**, because the
  reasoning is still sound and somebody will reach for it again.
- **The numbers:** `tap.workSeconds` is **10**, a tactile choice — about ten
  taps to a ten-unit tree. It was briefly 20 (five taps) and came back down on
  play. A full pool is then ~**5.5 minutes** of the city's own production **at
  both ends of the game**, and the province has a stated ceiling of **180
  Wood/min** across 57 trees — the first number in the project's history that
  says what this map can make. What the halving costs is priced in
  [`04-harvest.md`](features/04-harvest.md) §1.1 and §4.3: a bare thumb is worth
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

### Step 1 · Generated orders

**The only infinite resource sink in the game**, and the cheapest thing on this
list — the goal predicates, the replay-safe generator, the reward payment and the
building it lives in all already exist. **It needs a generator, not new goal
types.**

- **Design:** [`12-quests.md`](features/12-quests.md) §3 — complete.
- **Blocked on:** nothing. **OQ-16** and **OQ-17** both have recommendations
  strong enough to build against; if either flips it is a dial, not a rewrite.
- **Acceptance:** a player who has finished every authored quest opens the game
  on day 15 and **has three orders and a chest waiting**; an order's ask is a
  similar *fraction* of hourly output at Townhall 1 and Townhall 3; the same
  `(seed, day, slot)` produces the same order live and in replay; **no new goal
  type was added to the union.**
- **Size:** days.

### Step 2 · Bound the plot

**A balance number, not a refactor** — and the thing that makes placement a
decision, makes moving a building a decision, and gives adjacency something to
bite on. It is also the one item on this list that is a **30-day retention
question** rather than a content question, which is why it comes early despite
belonging to a post-prototype structure.

- **Design:** [`02-map-scopes.md`](features/02-map-scopes.md) §7.
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
- **Blocked on: OQ-25** (how a pass is bought), **OQ-26** (does cosmetic content
  exist), **OQ-28** (the credit budget), **OQ-29** (disclosure — settle this
  before a playtester sees a price). **OQ-27**, **OQ-30** and **OQ-31** are prices
  to watch rather than gates.
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

### The tomes rework, and the ingredient rework

Both are **designed and deliberately not sequenced**, because both are large,
both are reshapes rather than additions, and both need answers first.

| Rework | Design | Blocked on |
|---|---|---|
| **Knowledge ↔ Stardust, and Knowledge as a clock** | [`07`](features/07-research.md) §3, [`03`](features/03-economy.md) §1.1 | **OQ-12**, **OQ-13** |
| **Nine-piece ingredient sets, replacing Fragments** | [`09`](features/09-relics.md) §4 | **OQ-7**, **OQ-8**, **OQ-9**, **OQ-10** |

Two notes that will otherwise be rediscovered painfully:

**The rename lands as ONE change — balance keys, code, migrator and docs
together.** Renaming in the docs first would leave them describing a currency the
build does not have, which is exactly the doc/code drift this documentation pass
exists to remove.

**Both reworks need a real migrator, not a version bump**, and both have the same
trap: **a player mid-flight holds a balance earned under the old meaning.** A
bare key rename hands the whole technology tree to anyone holding Knowledge.
**Balances convert at the rates they were earned** — the rule the currency
simplification's migrator already followed.

## 5. Deliberately after everything above

Named here so nobody rediscovers them, and so they stay out of scope.

- **The world map.** The node graph, scouting, derived fog, outposts, shards and
  contested claims. [`02-map-scopes.md`](features/02-map-scopes.md) §8 stages it,
  and §7 lists the four cheap things to spend *now* — because the save cannot be
  changed retroactively.
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
| a seasonal hero = one hero row + one banner row | tech-tree node positions — **the layout is authored content** |
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
