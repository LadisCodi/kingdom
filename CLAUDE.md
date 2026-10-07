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
npm test             # vitest run — 124 suites, keep them all green
npm run harness      # the 30-day pacing harness (slow, not in npm test)
npm run build        # tsc --noEmit && vite build
npm run art          # rebuild the UI atlas
npm run art:check    # verify it
npm run art:characters   # Docs/art/characters/*.png → src/render/characters/ (atlas + index)
npm run server:bundle    # the world server's rules → supabase/functions/_shared/world.js (Deno)
```

`?dev` in the URL adds the dev bar (time-warp to demo offline progress, save
reset, 🌍 — the world board opened, a Watchtower claimed without finding it —
🎓 — every tutorial scene played, what each would hand over handed over —
a button per currency, and 📱 — the frame at an iPhone X, iPhone 17 or iPad Pro 12.9"
aspect ratio, with that device's safe-area insets and its notch or Dynamic Island
and home bar drawn over it, to sign off a menu per device from a desktop
browser). `?dev=kit`
opens the UI primitive gallery. `?dev=data` opens the data editor
(`Docs/plans/data-editor.md`) — every piece of game data in one tool, saving
straight into `src/sim/data/` through dev-only Vite middleware.
The map editor (`Docs/map-editor.md`) lives in it at `?dev=data#map` — paint
terrain and features, place landmarks and lairs; it writes
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

**2. There is no offline cap.** An absence is replayed in full by the one
`advance()`. Production is bounded by ceilings of its own, all inside that
advance: each building's store (`sim/storage.ts` — rent and hauls land there,
a full store stops the building), the Mana pool, the Knowledge bar (10), the
workshop and training queues. Timers — build queue, gate raids, event windows
— simply resolve. Research takes no time at all. **Anything time-based that
produces needs a ceiling of its own**; say which it is in the doc.

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
file's keys, and the build menu reads `buildable`, `buildTab`, `produces`
and `harmonySupply`, so a building made in the tool needs no code to exist.
Two kinds of content are authored on a BOARD rather than in fields, each in
its own editor inside the tool. Map content — terrain, features, landmarks
and lairs — is authored by coordinate, so it lives in
`src/sim/data/region-map.json` and is edited at `?dev=data#map`
(`Docs/map-editor.md`). A **technology is whole** in
`src/sim/data/tech-tree.json`, edited at `?dev=data#tree`
(`Docs/tech-tree-editor.md`): its name and icon (an atlas cell), what KIND it is
(`unlock` / `bonus` / `mechanic`) and what it unlocks, its Gold and
Knowledge, its slot on its tome's three-column page, and what it requires. What
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
| the whole map — terrain, features, landmark and lair placement and properties — at `?dev=data#map` | a new terrain/feature id, or a sixth lair (`LairId` is a union) |
| the whole quest chain — **list order is chain order**, reordered by dragging | new `ModifierStat` values (a line in `modifiers.ts` + a `resolve()` call in the helper that owns that number) |
| event and banner schedules, modifier magnitudes by template id | new `SchedulePayload` kinds and their handlers |
| **any product sold for money** — a Gem pack, a bundle, an **offer** or a **daily offer** = an entry in `store`, whole: name, art, price, Gems, items, a hero, slots for good, its trigger, window, limit and cooldown, a next-day part and whether it is shown full screen (`splash`); a payer profile's monthly budget = a `payer.*` setting | a new payer profile (`PayerProfile` is a union), a new offer trigger (`OfferTrigger`, `sim/offers.ts`), a new kind of thing a product hands over |
| a seasonal hero = one `heroes` entry + one `banners` entry; **how many bands a book has and what each asks for** — the tree editor creates and drops them per book; **a whole new BOOK** — general or found — since `TomeId` is the books authored in `tech-tree.json` | what makes a found book *found*: the drop that grants it |
| **a whole new technology** — id, name, glyph, kind, unlocks, **what numbers it moves**, price, slot, requirements (prose only for a `mechanic`) — at `?dev=data#tree` (`Docs/tech-tree-editor.md`); `TechId` is the file's keys, so the type follows | a new `TechKind`, a new kind of `TechUnlock`, or a rule about what a legal tree is (`src/sim/data/techTreeRules.ts`) |
| **what a bonus moves** — a `stat` from the registry, an `op`, a signed `value` and what it aims at. A kind of bonus nothing has yet ("+5% gold income at Housing") is a target, not code. A rank ladder is a stem plus a roman numeral, not a field, and each rank carries its own value | a **new number** a technology can move: an entry in `TECH_STATS` (`src/sim/data/techEffectRules.ts`) — including `says`, the sentence a player reads, one per op it accepts — plus a `techValue(...)` read at the call site that owns it |
| **which technology unlocks a building, a building level, one more of a building, a unit, a harvest source or a terrain** — it is a dropdown on the technology | a gate on something that has no `TechUnlock` yet |
| **a whole new building, unit, hero, quest… — any new entry** of a collection; **a new field** on a collection (Schema view: its type, range, default and meaning) — the game ignores a field until code reads it, and the Schema view marks one nothing reads | the code that READS a new field; **a new collection**, which is a new game element: its file, its line in `balance.ts`, its entry in `COLLECTIONS` (`dataRules.ts`) and the code that uses it ship together |
| a second region = a JSON map + a row in `grid.ts`'s `REGIONS` | anything multi-region beyond `regionId` |
| **a Bag item** — a chest, speed-up, boost, flask, tome or key — = an `items` entry; an item bundle = a `store` row with `items`; which source pays which item = its `rewardItems`, `freeItems`/`paidItems` or `treasure.items` | a new item `kind` (what using it does: `sim/bag.ts`, `sim/speedups.ts`) |
| a relic's `kind` (city/world) and `door` — the lair or world source its first fragment is found at; drop sizes, level costs, the forge and the store's fragment pack = `relics.fragments` | a new world source that drops fragments |
| the friends list's caps and its reward path — milestones, Gems, items, the Townhall a friend must reach — at `?dev=data` › Friends (`social.json`) | what a friend's progress IS (Townhall + cells, `friendsClient.ts`), a new social command (`src/socialServer/serve.ts`) |
| a refined good's recipe and work time (`goods`); what a building level costs in goods (that level's `costPerLevel` entry); a workshop's good and queue length (`produces`, `queueLengthPerLevel`) | a new `GoodId` |
| **a decoration** = a building with `harmonySupply` (one level, no crew), priced in goods on its level-1 `costPerLevel` entry, capped and Townhall-gated by `maxCountPerTownhallLevel`, discovered by a card in the tech tree; **what a level demands** = `harmonyCostPerLevel`, a TOTAL from level 1; the surplus tiers = `harmony.surplusTiers` | a new number the surplus moves (it is the tax rate, at the base stage in `effectiveTaxRate`); Harmony with reach |
| a new animated character = its frames dropped in `Docs/art/characters/` + `npm run art:characters`; which building it crews = that building's `crew` (checked by `tests/characters.test.ts`) | how a crew moves (`src/render/cast.ts`) |
| a building's store = its `storageCapacityPerLevel` (required on anything that makes Gold or harvests, refused elsewhere); when a store is ready to collect = `storage.collectFraction` | what a full store stops, and where a collect is recorded (`sim/storage.ts`) |
| a new adjacency rule = an `adjacency` entry (`district`, `neighbor`, `stat`, `magnitude`; either side may name `AnyHall`/`AnyWorkshop`/`AnyProducer`/`AnyDecoration`) | a new `AdjacencyStat` (one line in `definitions.ts` plus the call site that owns that number) or a new group token |
| an unlock splash = an `unlocks` entry: which door or book opens it, its title, its paragraph, its icon (`Docs/features/23-tutorials.md` §4.6); list order = the order two show in | a splash for something that is neither a door (`sim/doors.ts`) nor a book (`TOME_OPENS`) |
| **a tutorial scene, a line, a speaker** — who says what, where the box sits, what it points at, what locks, what moves it on — at `?dev=data` › Scenes / Speakers / Tutorial help (`Docs/features/23-tutorials.md`, `24-dialogue.md`) | a new scene **condition kind** (`src/ui/stage/conditions.ts`), a new pointer target syntax (`targets.ts`) |
| which quest opens a UI door is its position in the chain | **what opens a door** (`sim/doors.ts`) and **what opens a book** (`sim/research.ts` `TOME_OPENS`) |

## Branching — Git Flow

`main` is what is live (a push to it deploys GitHub Pages); `develop` is
where work lands. Neither is committed to directly — everything arrives by
PR, merged with a merge commit.

| Branch | From | Merges into | For |
|---|---|---|---|
| `feature/<slug>` | `develop` | `develop` | new behaviour, art, docs, chores |
| `bugfix/<slug>` | `develop` | `develop` | a bug not yet on `main` |
| `release/<x.y.z>` | `develop` | `main`, then back into `develop` | shipping; tag `v<x.y.z>` on `main` |
| `hotfix/<slug>` | `main` | `main`, then back into `develop` | a bug that is live; bumps the patch |

- **GitHub runs no tests.** The gate is local: `npm test` and `npm run build`
  both green before a branch is pushed for a PR, and again on the release
  branch before it goes to `main`. Red means no PR.
- **Finishing a feature or bugfix is one motion**: commit, run the gate,
  push, open the PR into `develop`, merge it. No need to ask.
- **A release or hotfix to `main` is only on request** — it deploys.
- **A release or hotfix also deploys the server.** On the release branch,
  once the gate is green and BEFORE it merges into `main` (the push to
  `main` ships the client, and a new client must never meet an old server):
  ```bash
  npx supabase db push --dry-run   # read what will apply
  npx supabase db push             # the migrations in supabase/migrations/
  npm run server:bundle && npx supabase functions deploy world && npx supabase functions deploy social
  ```
  The project is the one `supabase link` points at (`supabase/.temp/`,
  never committed — a fresh worktree links again). A migration must keep
  the server the live client talks to working, since the server goes
  first. Nothing changed under `supabase/` or in what `server:bundle`
  builds → say so, and skip it.

## Saves

`SAVE_VERSION` is 107; `MIN_MIGRATABLE_VERSION` is 16 (below that: fresh game).
**Prototype only:** `PROTOTYPE_FRESH_START` (`save.ts`, 107) — the boot
discards any older save and starts a fresh kingdom. To restart every tester
again, bump `SAVE_VERSION` and raise it to match. **It must go before
production**, where a kingdom is never discarded and every change migrates.
**Check the constant in `src/sim/data/definitions.ts` before quoting it** — this
line drifted fifteen versions once.
`MIGRATIONS` is ordered, gapless and append-only.

**Every module read in `save.ts` is already defensive** (`if (dto)` + `?? default`),
so an **additive** change — a new module key, a new optional field — needs
**no migrator**: bump `SAVE_VERSION` and the reader fills it in. Migrators exist
only for renames, reshapes and semantic changes. A save with a *higher* version
than the build is rejected rather than downgraded.

## Conventions that are easy to get wrong

- **The world server has one door.** Every world request goes through
  `handleWorld` (`src/worldServer/handle.ts`), which the stand-in and the
  edge function both call. A request carries no time — the server's clock is
  the game's (`Game.now`) — and a command id, so a retry runs once. An effect
  the server owes is applied past `state.world.effectSeq`, saved, then
  acknowledged (`Docs/plans/online-server.md` §2).
- **Analytics are events, never reads of the save** (`Docs/plans/analytics.md`).
  A new one is `track(state, name, props)` in the sim (`sim/analytics.ts`,
  an outbox the tick drains) or `game.track(name, props)` in the game, and
  a line in the plan's table. Testers' numbers are in the `analytics.v_*`
  views.
- **One tick driver.** The Unity build double-ticked its timer; the web build
  ticks from exactly one place. Do not add a second.
- **Three distance metrics coexist by design.** Adjacency — fog state, the
  connected frontier, placement — uses **4-way von Neumann** (`grid.ts` —
  diagonals are not adjacent); every radius and the Townhall's rings use
  **Chebyshev**, a square that the isometric view draws as a tile-shaped
  diamond; worker travel uses **Euclidean**.
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
- **A calculated cost or reward is rounded to three significant figures**
  (`roundPrice`, `src/sim/roundPrice.ts`): 1,234 → 1,230, a whole number
  below 1,000. Every price off a curve and every reward priced in production
  goes through it before it is charged or paid (`tests/roundPrice.test.ts`
  sweeps the curves); an authored number never does.
- **Every tap on the ground costs 1 Mana** (trees, berries, crops, rocks,
  mountains, shoals); paying fog costs Gold. **A tap on a building never costs
  Mana**: a ready store is collected free, otherwise the building opens.
  There is no house tap, and nothing pulls rent forward. Beyond taps, Mana
  pays a city relic's activation in its Shrine and a world relic's spell;
  artifact upkeep was removed.
  A tap refused by a tech gate costs no Mana.
- **Pills and notices, not modals**, for anything waiting for the player:
  `questPill.ts`, and the notices column (`ui/notices/`,
  `Docs/features/26-notices.md`) for news and standing states. They hide
  behind any sheet; a notice opens its card only when tapped.
- **Z-order is load-bearing.** The stack, bottom to top: map · the notices
  column (4) · district card (6) · **menus and sheets — `#overlay` (7)** · header (8) · nav
  (10) · **the battle playback (90)** · the stage (95) · the offer splash (96) · the unlock splash (97) · the gacha reveal (100) · the rewarded
  video (200) · the loading screen (1000, `#boot` in `index.html`, gone once
  the first screen's images are in — `ui/bootScreen.ts`). `#overlay` has a z-index, so it is a **stacking context** and nothing
  inside it can rise above the header — **which is the design, not a
  limitation**: a menu is opened over the game, so the purse stays readable.
  The nav bar is the exception that steps aside: it slides out of the frame
  while `#overlay` has content or the district card is open, and every menu
  carries its own way out.
  The ad screen lives at z 200 in its own mount for that reason, and the gacha
  reveal at z 100 and the unlock splash at z 97 in their own for the same one; all carry
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
  thing waiting** (`TrainingItem.seconds`, `WorkshopItem.needMs`): a neighbour that moves must never reprice a wait already
  running. An adjacency on a RATE is computed on read. Neither is a modifier —
  positional facts belong at the base stage.
- **The UI is made of materials** (`Docs/art/ui-menus-redesign.md` §2.5):
  warm, natural, textured — wood, yellowed parchment, rope, cloth, wax,
  brass — lit from above, never flat fills or plastic gloss. A symbol on a
  piece is carved or embossed INTO it (the close X is a groove in red wood),
  and a pressed state is the same material pushed in. Ask "what is this made
  of?" before drawing or requesting any new UI art.
- **Every number the UI prints goes through `src/ui/format.ts`**
  (`formatExact`, `formatCount`, `formatShort`, `formatNumber`, `formatUsd`),
  which writes it in the viewer's locale — *25,000* / *25.000*. Never
  `String(n)` or `${n}` for a count the player reads, and never
  `toLocaleString` / `Intl.NumberFormat` elsewhere (`tests/numberFormat.test.ts`);
  the sim reads no locale. The suite pins `en-US` (`tests/setup.ts`).
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
- Don't push to `main` or open a release unless asked; everything else
  follows Git Flow above.
