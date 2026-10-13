# Implementation plan

> **What this is.** What is built, what is not, what order the rest goes in, and
> **which design questions have to be answered before a given piece can start.**
>
> This file owns the *sequence*. It does not own designs — every design lives in
> [`features/`](features/), and every unanswered question lives in
> [`open-questions.md`](open-questions.md). Where this file names a question it
> names it by id (`OQ-n`). What is done is what is merged into `develop`.
>
> **State: 150 test suites, 2,022 tests, all green.**

## 1. The engine contract

Five properties the sim holds, and **breaking one is a bug even if the tests
pass.** They are restated in `CLAUDE.md` for anyone writing code; they are here
because they constrain what a *design* may ask for.

1. **One-call offline replay equals stepped ticking.** The load-bearing assertion
   of the whole codebase. The advance loop walks to the *earliest next boundary*
   and applies discrete work exactly at it; boundaries are **absolute time**,
   never relative to a tick. Anything newly scheduled or expiring is one
   boundary source plus one branch — nothing else.
2. **There is no offline cap.** An absence is replayed in full by the same
   advance. Production is bounded by ceilings of its own — each building's
   store, the Mana pool, the Knowledge bar, the workshop and training queues.
   Timers — build queue, gate raids, event windows — resolve in full.
   **When adding anything time-based that produces, name its ceiling in the
   design.**
3. **The clock is always passed in.** The sim never reads a clock and never
   closes over the UI. A modifier's expiry is read from the sim's own last-advance
   stamp, not from the wall clock.
4. **Randomness is counter/hash, not a stream.** The key must identify **the
   event**, never the moment of the query. A stream would desync, because the
   advance groups work differently in replay than in live ticking — and a new
   consumer would shift every later roll for every existing player. Integer
   arithmetic, so it is bit-identical across engines and portable to a server.
5. **`?dev=data` is the source of truth for every piece of game data** — every
   number, one file per collection in `src/sim/data/game/` with its schema in
   `schema/`, and the MAP and the TECH TREE as boards inside it. What a legal
   document is lives in `dataRules.ts`, `mapRules.ts` and `techTreeRules.ts`,
   each checked by its editor, its save endpoint and a test.

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

Every feature below is built. The right-hand column is what is **not** built
yet inside it.

| Feature | Doc | Not built yet |
|---|---|---|
| The map, fog, terrain, features, reveal curve, Townhall reach, treasures, abandoned buildings, landmarks, the sea of clouds | [`01`](features/01-map-and-fog.md) | the wisps of a tear and a reveal (§4.2) |
| The province and the world board as two scopes | [`02`](features/02-map-scopes.md) | a second region; temporary provinces |
| Currencies, taxes, adjacency, building stores | [`03`](features/03-economy.md) | — |
| Harvest as a depot, the tap as a duration, the strike | [`04`](features/04-harvest.md) | the map editor's production census (OQ-50) |
| Districts, placement, costs per level, moving buildings | [`05`](features/05-city-and-districts.md), [`buildings`](features/buildings.md) | — |
| Builders, the priced refusal | [`06`](features/06-construction.md) | — |
| The tech tree — the Kingdom tree in nine chapters, the Sagas and the Atlas, the Knowledge bar | [`07`](features/07-research.md), [`tech-tree`](features/tech-tree.md) | guild investment (§8) |
| Mana, the Sanctum, landmarks, refills, the rewarded ad | [`08`](features/08-magic.md) | — |
| Relics — fragments, restoration, Shrines, Chapels, trading | [`09`](features/09-relics.md) | three world relics move numbers nothing reads (OQ-113) |
| Heroes, their stat blocks and skills, the gacha, the Tavern | [`10`](features/10-heroes.md) | the rarity multipliers (§2.1); the banner in the Tavern |
| Dungeons on the world board and their screens | [`11`](features/11-expeditions.md), [`11a`](features/11a-ruins-ui.md) | — |
| The quest chain | [`12`](features/12-quests.md) | — |
| The timeline and its scheduling | [`13`](features/13-events.md) | the event archetype; the catalogue is empty |
| The store, the payer profile, three ad placements, the funnel | [`14`](features/14-monetization.md) | ad placements 4–6, the cosmetic probe (§5) |
| Friends, the crest, the Inbox, the wish board, daily help | [`15`](features/15-social.md) | the guild, the guild week, the siege |
| Workshops and refined goods | [`17`](features/17-workshops-and-goods.md) | — |
| Lairs and raids | [`18`](features/18-garrisons-and-raids.md) | — |
| The world — seven boards, explorers, claims, armies, conquest, camps, dungeons, the Portal, stand-in rivals, on the world server | [`19`](features/19-world-map.md) | the season (OQ-3) |
| Harmony and the decorations | [`21`](features/21-harmony.md) | — |
| Progression doors, tutorials, the dialogue stage | [`22`](features/22-progression.md), [`23`](features/23-tutorials.md), [`24`](features/24-dialogue.md) | the advisor's portrait |
| The Royal Survey | [`25`](features/25-the-survey.md) | the seal that flies to the pill (§4) |
| Notices — the bubbles in the corner | [`26`](features/26-notices.md) | — |
| Plantables | [`27`](features/27-plantables.md) | — |
| Languages | [`28`](features/28-languages.md) | — |
| The tick auto-battler and its replay screen | [`combat`](features/combat.md) | authored boss formations, villains in a dungeon's standard room (OQ-86) |
| The fantasy signals and the analytics pipeline | [`playtest`](playtest.md) §5, [`plans/analytics.md`](plans/analytics.md) | — |
| The data editor, the map editor, the tree editor | [`data-editor`](plans/data-editor.md), [`map-editor`](map-editor.md), [`tech-tree-editor`](tech-tree-editor.md) | — |

**The load-bearing assertion holds** across a research completion, a modifier
expiry, a Mana cap fill, army training, a raid falling due, an explorer's or
an army's march, and an event window opening and closing during an absence.

## 3. Holes in what is built

**These are not design questions** — each has an answer, or has one waiting in a doc.

| # | Hole | Where |
|---|---|---|
| **H3** | **A scheduled banner does nothing but post its news.** `banner` is the timeline's one payload; no schedule is authored and nothing reads an active one. | [`13`](features/13-events.md) |
| **H6** | **The dev primitive gallery does not show the newer UI primitives.** | — |
| **H7** | **No new sounds.** Casting, claiming, clearing a room and taking a depth reuse existing SFX. | [`audio-wishlist.md`](audio-wishlist.md) |

## 4. What is next, and what blocks it

Each "blocked on" is a hard gate: do not start until those questions are
answered, because the answer changes the shape of what gets built, not just its
numbers. Questions that only set numbers are listed as "numbers".

### The balance pass

Numbers only, measured with the thirty-day harness (`npm run harness`) and the playtest.

- **The tree's pace and prices:** OQ-13, OQ-105, OQ-116 — the harness has
  Townhall 4 on day 12 against a target of 8.
- **The fog:** OQ-92 (reach and count dials), OQ-120 (treasures), OQ-121 (the
  Survey's ladder).
- **The city:** OQ-93 (villagers per Townhall level), OQ-107 (store
  capacities).
- **Combat and lairs:** OQ-72, OQ-109, OQ-110, OQ-112.

### Step 3 · The event archetype

The timeline ships: a recurring window with a hard deadline, persisted phases and
pre-replay reconciliation. What is missing is **the archetype** — the thing
authored ten times a year.

- **Design:** [`13-events.md`](features/13-events.md).
- **Widen once:** the modifier stats an event needs, schedule payloads beyond
  `banner` (a modifier by template id, an event track, an event shop), and the
  schedules as data.
- **Blocked on:** **OQ-18** (does the event currency get a wallet row) and
  **OQ-19** (do events close). OQ-4 and OQ-22 shape the cost of the island but
  do not block starting.
- **Gate:** author the second event and record the hours it took — the
  marginal cost of a content drop decides whether ten a year is possible.
- **Also closes H3.**

### Step 4 · Simulated monetisation

The store, its funnel and the analytics pipeline ship. What is left: rewarded
placements 4–6 and the cosmetic probe.

- **Design:** [`14-monetization.md`](features/14-monetization.md).
- **Blocked on:** **OQ-26** (does cosmetic content exist), **OQ-29**
  (disclosure — settle before a playtester sees a price). **OQ-31** is a price
  to watch.
- **Gate:** a one-page ranking of surfaces by intent from at least two weeks of
  playtester sessions. If the ranking is not stable between week one and week
  two, the sample is the finding.

### Step 5 · The social layer

Ordered so each step is playable before the next exists. Step 5.1 is worth
shipping on its own: **the save stops evaporating.**

1. Profiles and a display name. **Built** (15 §2, §2.1); account linking
   is not in the prototype.
2. Daily help with a cap, gifts drained at load. **Built**, between
   friends (15 §3).
3. Guilds and membership.
4. The guild week: the bar, contributions, threshold chests.
5. The siege — the world board's co-op encounter.

- **Design:** [`15-social.md`](features/15-social.md).
- **Blocked on:** **OQ-33**, **OQ-36**, **OQ-38**, **OQ-39**.
- **Depends on:** Step 3's build-speed modifier.
- **Gate:** two playtesters in one guild each see the bar move because of what
  the other did; the daily cap holds against a client that spends it twice; a
  gift applied during an absence still leaves the replay assertion true.

### The Dragon's Nest

The one building of the thirty-day ladder still unbuilt: an egg incubated on a
timer hatches a creature that joins the party in a slot of its own.

- **Design:** [`proposals/builder-30-days.md`](proposals/builder-30-days.md) §3.
- **The engine:** an incubation is a **timer** — one `consider()` in
  `nextBoundary`, one branch in `applyDueAt`, resolved in full across an
  absence. Feeding is Food's late sink.
- **Blocked on:** nothing. A creature slot sits outside the Gem slot ladder.

### The world board's season

- **Blocked on: OQ-3** — how long a season on the board lasts. It decides
  whether a lost corridor is a setback or a permanent demotion, and whether a
  new player can land on a carved-up board.

### Wonders — designed and closed, deliberately unsequenced

**The late-game sink:** a district whose level ladder is a curve, with no
`maxLevel`.

- **Design:** [`16-wonders.md`](features/16-wonders.md).
- **Numbers:** OQ-57 (the art bill), OQ-58 (the three balance numbers), OQ-59
  (the social hook).
- **Why it is not next:** it gates on the last era. A playtester who does not
  reach the last era never meets it.
- **Why it is cheap:** a Wonder level is instant on payment, so it adds no
  boundary and the state needs no change.

## 5. Deliberately after everything above

Named here so nobody rediscovers them, and so they stay out of scope.

- **A guild league.** Small once the bar exists, and meaningless at prototype
  population (OQ-33).
- **Cosmetics as a pipeline**, if and only if the probe ranks (OQ-26).
- **A region generator.** It needs the game state restructured into a
  per-region record — the city, the fog, the features, the harvest state and
  the workers down a level, touching every sim file and every test. That plus a
  seeded generator turns "a second region" from a project into a row.
- **Server-side combat resolution.** Feasible, because the resolver is
  deterministic.
- **The sim on the server.** Not needed by a prototype with named playtesters.
  **The reason to keep the sim pure is that this stays possible.**
- **A rotating-stock recycling shop, dynamic difficulty that rescales weekly.**

## 6. Authoring: where content comes from

Every piece of game data is authored in **`?dev=data`**
([`plans/data-editor.md`](plans/data-editor.md)): the numbers, one file per
collection; the map at `#map` ([`map-editor.md`](map-editor.md)); the tech
tree at `#tree` ([`tech-tree-editor.md`](tech-tree-editor.md)). What is data
and what is code is the table in `CLAUDE.md`.

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
