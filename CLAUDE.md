# Kingdom — working notes for Claude

A cozy square-grid city-builder / idle game. Vite + TypeScript, Canvas 2D, no
framework. `src/sim/` is a **pure** simulation core — no DOM, no clock,
injectable randomness — so it can later run server-side.

**Read [`Docs/00-design-intent.md`](Docs/00-design-intent.md) before changing
behaviour**, and [`Docs/road-to-mvp.md`](Docs/road-to-mvp.md) for what is being
built next and why. `Docs/features/*.md` is the live source of truth per
feature. `Docs/01`–`11` is a **frozen Unity as-built snapshot** describing an
earlier, different game (hex grid, Silver, generator vaults, spells) — it is
history, not spec, and it says so at the top of each file.

## Commands

```bash
npm run dev          # vite; predev runs the balance import
npm test             # vitest run — 39 suites, keep them all green
npm run build        # tsc --noEmit && vite build
npm run balance      # balance.xlsx  → src/sim/data/balance.json
npm run balance:export   # balance.json → balance.xlsx  (the other direction)
npm run art          # rebuild the UI atlas
npm run art:check    # verify it
```

`?dev` in the URL adds the dev bar (time-warp to demo offline progress, save
reset). `?dev=kit` opens the UI primitive gallery.

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

**5. The workbook is the source of truth.** `balance/balance.xlsx` →
`npm run balance` → `src/sim/data/balance.json`. **Editing `balance.json` by
hand is silently overwritten** on the next dev/build. To add a column: edit the
JSON *and* the importer schema in `scripts/balance.mjs`, then
`npm run balance:export`, then `npm run balance`.

## Data or code?

| Data — no code change | Code |
|---|---|
| every balance number (`Districts`, `Harvest`, `Technologies`, `Upgrades`, `Quests`, `Currencies`, `Units`, `Ruins`, `Artifacts`, `Heroes`, `Adjacency`, `Settings`) | new quest **goal types** |
| the whole quest chain — **row order is chain order** | new `ModifierStat` values (a line in `modifiers.ts` + a `resolve()` call in the helper that owns that number) |
| event and banner schedules, modifier magnitudes by template id | new `SchedulePayload` kinds and their handlers |
| a seasonal hero = one hero row + one banner row | tech-tree node positions (`node:{x,y}` in `definitions.ts` — the layout is content) |
| a second region = a JSON map + a row in `grid.ts`'s `REGIONS` | anything multi-region beyond `regionId` |

## Saves

`SAVE_VERSION` is 24; `MIN_MIGRATABLE_VERSION` is 16 (below that: fresh game).
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
  counter, not a row) is usually the better answer.
- **A tap is priced in production, not in units.** `tap.boostSeconds` (45)
  hands the player that many seconds of what they tapped is producing, floored
  at the authored yield. **Follow this for every new reward** — absolute
  amounts in a spreadsheet go stale on their own as the city grows.
- **Every player tap costs 1 Mana**, except paying fog (which already costs
  Gold). Nothing else draws against the pool; artifact upkeep was removed.
  A tap refused by a tech gate costs no Mana.
- **Pills, not modals**, for anything waiting for the player: `questPill.ts`,
  `delvePill.ts`, `adOfferPill.ts`. They hide behind any sheet.
- **Z-order is load-bearing.** `#overlay` is z 5 and is a stacking context, so
  nothing inside it can rise above the nav (10) or the settings knob (20). The
  ad screen lives at z 200 in its own mount for that reason, and carries
  `:empty { display: none }` — without it an `inset: 0` element swallows every
  tap on the map.
- **Countdowns derive from a timestamp**, never a decremented integer, so a
  throttled background tab resolves correctly on return.
- **No emoji fallbacks.** `tests/icons.test.ts` refuses to let anything in the
  game quietly fall back to an emoji glyph.

## Doc house style

Feature docs open with a `>` blockquote giving scope and **status**, use
numbered `##` sections referenced elsewhere as `§n`, carry a table of dials
"in the order to reach for them", and end with **Open questions** /
**Open decisions**. They record *why* a number is what it is and what was
deliberately cut, and they mark their own steps done and point at the canonical
backlog in `00-design-intent.md` rather than each keeping a partial list.
Docs are written in **English**. Keep it that way.

When a doc and the code disagree, **the code is usually right and the doc is
stale** — `Docs/features/balancing-v3.md` found three of these in one pass. Fix
the doc in the same commit, and prefer a test over a paragraph for any number
that has now been argued twice.

## Don't

- Don't hand-edit `src/sim/data/balance.json`.
- Don't re-express upgrade levels as modifiers, or pass `now` through the
  `effectiveX` helpers — both were cut deliberately (`engine-seams.md` §10).
- Don't restructure `GameState` into `regions: Record<RegionId, RegionState>`
  without reading `engine-seams.md` §6 first; it touches every sim file and
  every test, and it is deliberately deferred.
- Don't re-type a file's contents from tool output when editing — read and
  modify in place.
- Don't commit or push unless asked. Branch off `develop`.
