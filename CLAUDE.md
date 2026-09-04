# Kingdom — working notes for Claude

A cozy square-grid city-builder / idle game. Vite + TypeScript, Canvas 2D, no
framework. `src/sim/` is a **pure** simulation core — no DOM, no clock,
injectable randomness — so it can later run server-side.

**Read [`Docs/overview.md`](Docs/overview.md) before changing behaviour** — the
game in five minutes. Then:

| Where | What it holds |
|---|---|
| [`Docs/README.md`](Docs/README.md) | the index, the design intentions, and the house rules for the docs |
| `Docs/features/01`–`15` | **the live source of truth, one file per feature** |
| [`Docs/open-questions.md`](Docs/open-questions.md) | every decision still to make, with stable ids (`OQ-n`) |
| [`Docs/implementation-plan.md`](Docs/implementation-plan.md) | what is built, what is next, and which questions block it |

`Docs/` is **design**: no implementation detail unless a decision turned on it.
Code-level contracts are the invariants below.

## Commands

```bash
npm run dev          # vite; predev runs the balance import
npm test             # vitest run — 46 suites, keep them all green
npm run harness      # the 30-day pacing harness (slow, not in npm test)
npm run build        # tsc --noEmit && vite build
npm run balance      # balance.xlsx  → src/sim/data/balance.json
npm run balance:export   # balance.json → balance.xlsx  (the other direction)
npm run art          # rebuild the UI atlas
npm run art:check    # verify it
npm run art:characters   # Docs/art/characters/*.png → src/render/characters/ (atlas + index)
```

`?dev` in the URL adds the dev bar (time-warp to demo offline progress, save
reset). `?dev=kit` opens the UI primitive gallery. `?dev=map` opens the map
editor (`Docs/map-editor.md`) — paint terrain and features, place
landmarks and ruins; it saves straight into `src/sim/data/region-map.json`
through a dev-only Vite middleware.

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
at the cap. Timers — build queue, research, delve depths, event windows —
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

**5. The workbook is the source of truth for every NUMBER; the map editor is
the source of truth for the MAP.** `balance/balance.xlsx` → `npm run balance` →
`src/sim/data/balance.json`. **Editing `balance.json` by hand is silently
overwritten** on the next dev/build. To add a column: edit the JSON *and* the
importer schema in `scripts/balance.mjs`, then `npm run balance:export`, then
`npm run balance`.
Map *content* — terrain, features, landmarks and ruins — is authored by
coordinate, which a spreadsheet expresses badly, so it lives in
`src/sim/data/region-map.json` and is edited in `?dev=map`
(`Docs/map-editor.md`). `npm run balance` does not touch that file.
What a legal map is lives in **one** place, `src/sim/data/mapRules.ts`, checked
by the editor, by the save endpoint and by `tests/regionMap.test.ts`.

## Data or code?

| Data — no code change | Code |
|---|---|
| every balance number (`Districts`, `Harvest`, `Technologies`, `Upgrades`, `Quests`, `Currencies`, `Units`, `Artifacts`, `Heroes`, `Adjacency`, `Settings`) | new quest **goal types** |
| the whole map — terrain, features, landmark and ruin placement and properties — in `?dev=map` | a new terrain/feature id, or a sixth ruin (`RuinId` is a union) |
| the whole quest chain — **row order is chain order** | new `ModifierStat` values (a line in `modifiers.ts` + a `resolve()` call in the helper that owns that number) |
| event and banner schedules, modifier magnitudes by template id | new `SchedulePayload` kinds and their handlers |
| a Gem pack = a row on the `Store` sheet; a payer profile's monthly budget = a `payer.*` setting | a new payer profile (`PayerProfile` is a union), a non-Gem SKU |
| a seasonal hero = one hero row + one banner row; a major technology's place on its tome page (`node_x`/`node_y`), its tome, era and Knowledge price; a minor line's ranks (row order) | a new tome or a new minor line (`TomeId` and `TechLineId` are unions), or a new effect hook for a line (`modifiers.ts`) |
| a second region = a JSON map + a row in `grid.ts`'s `REGIONS` | anything multi-region beyond `regionId` |
| a refined good's recipe and work time (`Goods`); what a building level costs in goods (`Districts.upgrade_cost_goods_per_level`) | a new `GoodId` |
| a new animated character = its frames dropped in `Docs/art/characters/` + `npm run art:characters` | which building casts it (`src/render/cast.ts` — checked by `tests/characters.test.ts`) |

## Saves

`SAVE_VERSION` is 29; `MIN_MIGRATABLE_VERSION` is 16 (below that: fresh game).
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
  `delvePill.ts`, `adOfferPill.ts`. They hide behind any sheet.
- **Z-order is load-bearing.** The stack, bottom to top: map · ad-offer tab (4)
  · district card (6) · **menus and sheets — `#overlay` (7)** · header (8) · nav
  (10) · settings knob (20) · the rewarded video (200). `#overlay` has a
  z-index, so it is a **stacking context** and nothing inside it can rise above
  the header or the nav — **which is the design, not a limitation**: a menu is
  opened over the game, so the purse stays readable and the way out stays put.
  The ad screen lives at z 200 in its own mount for that reason, and carries
  `:empty { display: none }` — without it an `inset: 0` element swallows every
  tap on the map.
- **Countdowns derive from a timestamp**, never a decremented integer, so a
  throttled background tab resolves correctly on return.
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

- Don't hand-edit `src/sim/data/balance.json`. Hand-editing
  `src/sim/data/region-map.json` is allowed but pointless — use `?dev=map`,
  which validates as you go.
- Don't re-express upgrade levels as modifiers, or pass `now` through the
  `effectiveX` helpers — both were cut deliberately.
- Don't restructure `GameState` into `regions: Record<RegionId, RegionState>`;
  it touches every sim file and every test, and it is deliberately deferred
  (`Docs/implementation-plan.md` §5).
- Don't re-type a file's contents from tool output when editing — read and
  modify in place.
- Don't commit or push unless asked. Branch off `develop`.
