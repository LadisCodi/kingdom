# Kingdom — working notes for Claude

An accessible 4X: a square-grid city-builder on a fog-shrouded province that
opens onto a shared hex world map. Vite + TypeScript, Canvas 2D, no
framework. `src/sim/` is a **pure** simulation core — no DOM, no clock,
injectable randomness — so it can later run server-side.

**Read [`Docs/overview.md`](Docs/overview.md) before changing behaviour** — the
game in five minutes. Then:

| Where | What it holds |
|---|---|
| [`Docs/README.md`](Docs/README.md) | the index, the design intentions, and the house rules for the docs |
| `Docs/features/01`–`21` | **the live source of truth, one file per feature** |
| [`Docs/open-questions.md`](Docs/open-questions.md) | every decision still to make, with stable ids (`OQ-n`); the taken ones are in [`Docs/open-questions-closed.md`](Docs/open-questions-closed.md) |
| [`Docs/implementation-plan.md`](Docs/implementation-plan.md) | what is built, what is next, and which questions block it |

`Docs/` is **design**: no implementation detail unless a decision turned on it.
Code-level contracts are the invariants below.

## Commands

```bash
npm run dev          # vite
npm test             # vitest run — 72 suites, keep them all green
npm run harness      # the 30-day pacing harness (slow, not in npm test)
npm run build        # tsc --noEmit && vite build
npm run art          # rebuild the UI atlas
npm run art:check    # verify it
npm run art:characters   # Docs/art/characters/*.png → src/render/characters/ (atlas + index)
```

`?dev` in the URL adds the dev bar (time-warp to demo offline progress, save
reset). `?dev=kit` opens the UI primitive gallery. `?dev=data` opens the
data editor (`Docs/plans/data-editor.md`) — every piece of game data in one
tool, saving straight into `src/sim/data/` through dev-only Vite middleware.
The map editor (`Docs/map-editor.md`) lives in it at `?dev=data#map` — paint
terrain and features, place landmarks and ruins; it writes
`src/sim/data/region-map.json`. The tech tree editor
(`Docs/tech-tree-editor.md`) is `?dev=data#tree` — drag technologies into
the slots of a tome page, which sets their requirements; it writes
`src/sim/data/tech-tree.json`. `?dev=map` and `?dev=tree` redirect there.

## Five invariants. Breaking one is a bug even if the tests pass.

**1. One-call offline replay equals stepped ticking.** The load-bearing
assertion of the whole codebase (see `tests/taxes.test.ts`, `advance.test.ts`,
`catchUp.test.ts`). `advance(state, map, toTime)` walks to the *earliest next
boundary* and applies discrete work exactly at it; boundaries are in **absolute
time**, never relative to a tick. Any new scheduled or expiring thing is a
`consider()` in `nextBoundary` plus a branch in `applyDueAt` — nothing else.
`MAX_BOUNDARY_STEPS` (10,000, `commands.ts`) is a seatbelt, not a design limit:
never register a source that fires more often than the sim needs to observe it.

**2. The offline cap limits what the city *produces*, never what a *timer*
does.** `offlineCapHours` is 8. Production — workers, taxes, Mana regen — stops
at the cap. Timers — build queue, research, gate raids, event windows —
resolve in the uncapped tail advance. When adding anything time-based, decide
which it is and say so in the doc.

**3. `now` is always passed in.** The sim never reads a clock, never calls
`Date.now()`, never closes over the UI. Handlers are pure functions of
`(state, …, t)`. A modifier's expiry is read from `state.lastAdvance`, not from
the wall clock.

**4. Randomness is counter/hash, not a stream.** `rand(seed, ...parts)` in
`rng.ts`. `parts` must identify **the event**, never the moment of the query —
a stream would desync because `advance()` groups work differently in replay
than in live ticking, and a new consumer would shift every later roll. Integer
arithmetic (`Math.imul`, `>>> 0`) so it is bit-identical across engines.

**5. `?dev=data` is the source of truth for every piece of game data.** Every
number lives in one JSON file per collection, `src/sim/data/game/<collection>.json`,
and what each field is — type, range, what it names, how long a ladder is —
in `src/sim/data/schema/<collection>.json`. `src/sim/data/balance.ts` puts
the files back into the one object `definitions.ts` reads. What a legal
document is lives in **one** place, `src/sim/data/dataRules.ts`, checked by
the tool as you type, by the save endpoint (`scripts/vite-data-editor.mjs`,
which refuses a document with errors) and by `tests/dataRules.test.ts`,
which also holds every file to exactly what a save would write. Edit the
files in the tool, not by hand; a hand edit that breaks a rule fails the
test. A **building is whole** in `buildings.json`: its name, promise,
description, glyph, sprite and crew beside every number. What it COSTS is its
`costPerLevel` — one `{ cost, goods }` per level, level 1 being the build.
There is no cost curve: `instanceLinearGrowth` and
`instanceExponentialGrowth` say how much dearer a LATER instance is
(`Docs/features/05-city-and-districts.md` §3). Art tiers are files: a level
draws the highest `<sprite>_l<n>.png` at or below it. `DistrictId` is the
file's keys, and the build menu reads `buildable`, `produces` and
`harmonySupply`, so a building made in the tool needs no code to exist.
Two kinds of content are authored on a BOARD rather than in fields, each in
its own editor inside the tool. Map content — terrain, features, landmarks
and ruins — is authored by coordinate, so it lives in
`src/sim/data/region-map.json` and is edited at `?dev=data#map`
(`Docs/map-editor.md`). A **technology is whole** in
`src/sim/data/tech-tree.json`, edited at `?dev=data#tree`
(`Docs/tech-tree-editor.md`): its name and glyph, what KIND it is
(`unlock` / `bonus` / `mechanic`) and what it unlocks, its Gold, Knowledge and
seconds, its slot on its tome's three-column page, and what it requires. What
it SAYS is not authored at all — the card is generated from its unlocks or its
effects (`src/sim/techProse.ts`), and only a `mechanic`, whose effect is code,
carries written prose. The
same file says what BANDS each book has and what each one asks for in revealed
cells (`eras`), because a band and its gate are one fact and the count has to
travel with the number. **A technology says what it opens**, so buildings,
units and harvest sources name no technology: every gate
(`DISTRICTS[x].requiredTech`, `requiredTechPerLevel`, `extraCountTech`,
`UNITS[x].requiredTech`, `HARVEST[x].requiredTech`, `terrainGate`) is derived
from the technologies in `definitions.ts`.
What a legal map is lives in `src/sim/data/mapRules.ts`, checked by the
editor, by the save endpoint and by `tests/regionMap.test.ts`; what a legal
tech tree is lives in `src/sim/data/techTreeRules.ts`, checked the same three
ways (`tests/techTree.test.ts`).
**A data file changing is an event, not a reload** (`kingdom:data`): the game
reloads on it; the tool keeps unsaved work and offers the reload.

## Data or code?

| Data — no code change | Code |
|---|---|
| every balance number, in `?dev=data` — every collection's entries and settings | new quest **goal types** |
| the whole map — terrain, features, landmark and ruin placement and properties — at `?dev=data#map` | a new terrain/feature id, or a sixth ruin (`RuinId` is a union) |
| the whole quest chain — **list order is chain order**, reordered by dragging | new `ModifierStat` values (a line in `modifiers.ts` + a `resolve()` call in the helper that owns that number) |
| event and banner schedules, modifier magnitudes by template id | new `SchedulePayload` kinds and their handlers |
| a Gem pack = an entry in `store`; a payer profile's monthly budget = a `payer.*` setting | a new payer profile (`PayerProfile` is a union), a non-Gem SKU |
| a seasonal hero = one `heroes` entry + one `banners` entry; **how many bands a book has and what each asks for** — the tree editor creates and drops them per book; **a whole new BOOK** — general or found — since `TomeId` is the books authored in `tech-tree.json` | what makes a found book *found*: the drop that grants it |
| **a whole new technology** — id, name, glyph, kind, unlocks, **what numbers it moves**, price, clock, slot, requirements (prose only for a `mechanic`) — at `?dev=data#tree` (`Docs/tech-tree-editor.md`); `TechId` is the file's keys, so the type follows | a new `TechKind`, a new kind of `TechUnlock`, or a rule about what a legal tree is (`src/sim/data/techTreeRules.ts`) |
| **what a bonus moves** — a `stat` from the registry, an `op`, a signed `value` and what it aims at. A kind of bonus nothing has yet ("+5% gold income at Housing") is a target, not code. A rank ladder is a stem plus a roman numeral, not a field, and each rank carries its own value | a **new number** a technology can move: an entry in `TECH_STATS` (`src/sim/data/techEffectRules.ts`) — including `says`, the sentence a player reads, one per op it accepts — plus a `techValue(...)` read at the call site that owns it |
| **which technology unlocks a building, a building level, one more of a building, a unit, a harvest source or a terrain** — it is a dropdown on the technology | a gate on something that has no `TechUnlock` yet |
| **a whole new building, unit, hero, quest… — any new entry** of a collection; **a new field** on a collection (Schema view: its type, range, default and meaning) — the game ignores a field until code reads it, and the Schema view marks one nothing reads | the code that READS a new field; **a new collection**, which is a new game element: its file, its line in `balance.ts`, its entry in `COLLECTIONS` (`dataRules.ts`) and the code that uses it ship together |
| a second region = a JSON map + a row in `grid.ts`'s `REGIONS` | anything multi-region beyond `regionId` |
| a refined good's recipe and work time (`goods`); what a building level costs in goods (that level's `costPerLevel` entry); a workshop's good and queue length (`produces`, `queueLengthPerLevel`) | a new `GoodId` |
| **a decoration** = a building with `harmonySupply` (one level, no crew), priced in goods on its level-1 `costPerLevel` entry, capped and Townhall-gated by `maxCountPerTownhallLevel`, discovered by a card in the tech tree; **what a level demands** = `harmonyCostPerLevel`, a TOTAL from level 1; the surplus tiers = `harmony.surplusTiers` | a new number the surplus moves (it is the tax rate, at the base stage in `effectiveTaxRate`); Harmony with reach |
| a new animated character = its frames dropped in `Docs/art/characters/` + `npm run art:characters`; which building it crews = that building's `crew` (checked by `tests/characters.test.ts`) | how a crew moves (`src/render/cast.ts`) |
| a new adjacency rule = an `adjacency` entry (`district`, `neighbor`, `stat`, `magnitude`; either side may name `AnyHall`/`AnyWorkshop`/`AnyProducer`/`AnyDecoration`) | a new `AdjacencyStat` (one line in `definitions.ts` plus the call site that owns that number) or a new group token |

## Saves

`SAVE_VERSION` is 60; `MIN_MIGRATABLE_VERSION` is 16 (below that: fresh game).
**Check the constant in `src/sim/data/definitions.ts` before quoting it** — this
line drifted fifteen versions once.
`MIGRATIONS` is ordered, gapless and append-only.

**Every module read in `save.ts` is already defensive** (`if (dto)` + `?? default`),
so an **additive** change — a new module key, a new optional field — needs
**no migrator**: bump `SAVE_VERSION` and the reader fills it in. Migrators exist
only for renames, reshapes and semantic changes. A save with a *higher* version
than the build is rejected rather than downgraded.

## Conventions that are easy to get wrong

- **One tick driver.** The Unity build double-ticked its timer; the web build
  ticks from exactly one place. Do not add a second.
- **Three distance metrics coexist by design.** Fog, placement and BFS use
  **4-way von Neumann** (`grid.ts` — diagonals are not adjacent); building areas
  of influence use **Chebyshev**; worker travel uses **Euclidean**.
- **Money and identity are different things.** A cell's feature is not its
  currency: berries, game and shoals all pay Food (1, 3, 2 a tap) and an iron
  vein is a rich Stone node. `HarvestSpec.id` vs `HarvestSpec.currencyId`.
  Four coins on the plank is the genre's ceiling, not its floor — adding a
  wallet row needs an argument, and the Fragments precedent (a per-collectible
  counter, not a row) is usually the better answer. **Refined goods follow it**:
  `state.city.goods` is a counter map, not a `CurrencyId` (`sim/goods.ts`).
- **A tap is priced in production, not in units.** `tap.workSeconds` (10)
  hands the player that many seconds of what they tapped is producing, floored
  at the authored yield. **Follow this for every new reward** — absolute
  amounts in a spreadsheet go stale on their own as the city grows.
- **Every player tap costs 1 Mana**, except paying fog (which already costs
  Gold). Nothing else draws against the pool; artifact upkeep was removed.
  A tap refused by a tech gate costs no Mana.
- **Pills, not modals**, for anything waiting for the player: `questPill.ts`,
  `raidPill.ts`, `adOfferPill.ts`. They hide behind any sheet.
- **Z-order is load-bearing.** The stack, bottom to top: map · the right-edge
  column — raid countdown, then the ad offer — (4) · district card (6) · **menus and sheets — `#overlay` (7)** · header (8) · nav
  (10) · **the battle playback (90)** · the gacha reveal (100) · the rewarded
  video (200). `#overlay` has a z-index, so it is a **stacking context** and nothing
  inside it can rise above the header — **which is the design, not a
  limitation**: a menu is opened over the game, so the purse stays readable.
  The nav bar is the exception that steps aside: it slides out of the frame
  while `#overlay` has content or the district card is open, and every menu
  carries its own way out.
  The ad screen lives at z 200 in its own mount for that reason, and the gacha
  reveal at z 100 in its own for the same one; both carry
  `:empty { display: none }` — without it an `inset: 0` element swallows every
  tap on the map.
- **A building's price is a fact about that building, not about the city.**
  `District.ordinal` is stamped when it is placed and never changes; it prices
  every level of it for ever, and it is what a card calls it (*Housing #3*).
  It stays unique without a counter because nothing ever leaves the district
  list: there is no demolish, and **a build cannot be cancelled** — a
  misplaced building is MOVED, which is why `canMoveDistrict` allows an
  unfinished one.
- **Countdowns derive from a timestamp**, never a decremented integer, so a
  throttled background tab resolves correctly on return.
- **An adjacency on a TIMER is priced when the timer starts and stored on the
  thing waiting** (`TrainingItem.seconds`, `WorkshopItem.needMs`, and research
  already did it): a neighbour that moves must never reprice a wait already
  running. An adjacency on a RATE is computed on read. Neither is a modifier —
  positional facts belong at the base stage.
- **The UI is made of materials** (`Docs/art/ui-menus-redesign.md` §2.5):
  warm, natural, textured — wood, yellowed parchment, rope, cloth, wax,
  brass — lit from above, never flat fills or plastic gloss. A symbol on a
  piece is carved or embossed INTO it (the close X is a groove in red wood),
  and a pressed state is the same material pushed in. Ask "what is this made
  of?" before drawing or requesting any new UI art.
- **No emoji fallbacks.** `tests/icons.test.ts` refuses to let anything in the
  game quietly fall back to an emoji glyph.

## Doc house style

Feature docs open with a `>` blockquote giving scope and **status**, use
numbered `##` sections referenced elsewhere as `§n`, carry a table of dials
"in the order to reach for them", and end with **deliberately not in this
design**. They record *why* a number is what it is and what was deliberately
cut. **Open questions do not live in the feature doc** — they live in
`Docs/open-questions.md`, and the feature names them by id (`OQ-n`).
Docs are written in **English**. Keep it that way.

When a doc and the code disagree, **the code is usually right and the doc is
stale.** Fix the doc in the same commit, and prefer a test over a paragraph for
any number that has now been argued twice.

Rules for writting design documents:
- Only write the specification of HOW something works, no the design process for WHY it works that way
- Only write the current design of the feature, not how it has changed or why it has changed
- Describe feature as simple as possible, preferring using bullet points lists when possible. Less is more.

## Don't

- Don't hand-edit the files in `src/sim/data/game/` and `schema/`, or
  `region-map.json` and `tech-tree.json` — use `?dev=data`, which validates
  as you go. A hand edit is allowed but has to survive `tests/dataRules.test.ts`
  (and the map and tree tests).
- Don't re-express upgrade levels as modifiers, or pass `now` through the
  `effectiveX` helpers — both were cut deliberately.
- Don't restructure `GameState` into `regions: Record<RegionId, RegionState>`;
  it touches every sim file and every test, and it is deliberately deferred
  (`Docs/implementation-plan.md` §5).
- Don't re-type a file's contents from tool output when editing — read and
  modify in place.
- Don't commit or push unless asked. Branch off `develop`.
