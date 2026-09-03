Map editor
---

> **Scope.** How map content — terrain, features, landmarks and ruins — is
> authored, and why it left the workbook to get here. Covers the `?dev=map`
> editor, the shared rule module every consumer validates against, and the
> dev-only save path.
>
> **Status: built.** Replaces the `Map`, `Landmarks` and `Ruins` sheets, which
> are gone from `balance.xlsx`. This is a **tool**, not a game feature — the map
> content it authors is designed in
> [`features/01-map-and-fog.md`](features/01-map-and-fog.md). Open questions
> live in [`open-questions.md`](open-questions.md) (OQ-49, OQ-50).

## 1. Why the map left the workbook

The `Map` sheet encoded the world as one spreadsheet cell per map cell:
lowercase terrain letter, uppercase feature letter, `pT` for trees on plains,
blank for void, with conditional formatting painting the fills as you typed. It
was a genuinely clever use of Excel and it worked. What it could not do was any
of the things that actually make map authoring hard:

- **It showed codes, not the map.** A coloured `wF` is not a fish shoal. The
  only way to see what a change looked like was to run the importer and boot
  the game.
- **Sites lived somewhere else entirely.** A landmark's position was a row on
  the `Landmarks` sheet, three tabs away from the cell it stood on, so "is this
  shrine in the water" was a question you answered by cross-referencing two
  sheets by hand — which is why the importer had to grow `checkSites()` to
  catch it.
- **It could not show a derived number.** Every fog price in the game is a BFS
  distance from the Townhall. A spreadsheet cell cannot know its own distance
  through the world, so the single most important consequence of a map edit was
  invisible in the tool that made it.
- **Errors arrived late and in a terminal.** `npm run balance` failing with
  `cell (3,-9): unknown terrain code "x"` is a fine error, half a minute after
  the mistake, in a different window.

None of that is Excel's fault — a map is not tabular data, and the workbook was
being asked to be a paint program. **The workbook is still the source of truth
for every balancing number** (invariant 5). Map content simply is not one.

## 2. Where map content lives now

`src/sim/data/region-map.json` is hand-authored (by the editor) and holds all
four kinds of map content:

```
terrain   { cells: [{x, y, id}] }   every cell that exists; absent = void
features  { cells: [{x, y, id}] }   at most one per cell
landmarks [{id, kind, x, y, defended, claimCost}]
ruins     { <RuinId>: {x, y, tier, difficulty, baseDepthSeconds,
                       depthGrowth, maxDepth, supplies, affinity, artifact} }
```

`definitions.ts` reads `LANDMARKS` and `RUINS` from here rather than from
`balance.json`; `grid.ts` reads terrain and features as before. The file is
written one cell per line, sorted in reading order, so a map change shows up in
`git diff` as the cells that moved rather than as a reflowed blob.

**`npm run balance` no longer touches this file.** It used to overwrite it on
every `predev`, which is precisely why the map had to stop being a sheet before
an editor could exist.

The one asymmetry worth knowing: **the ruin roster is fixed in code.** `RuinId`
is a union in `state.ts` and five ruins have hand-written names, descriptions
and sprites in `definitions.ts`, so the editor can move and retune a ruin but
not add or delete one. Landmarks have no code-side identity beyond their
`kind`, so they are fully editable.

## 3. The rules, in one module

[`src/sim/data/mapRules.ts`](../src/sim/data/mapRules.ts) exports
`validateRegionMap(doc)` returning `{errors, warnings, ok}`. It is the *only*
statement of what a legal map is, and it has three consumers:

| Consumer | What it does with it |
|---|---|
| the editor | re-runs it on every edit; Save is disabled while `errors` is non-empty, and each issue is a button that flies the camera to its cell |
| `scripts/vite-map-editor.mjs` | re-runs it server-side (via `ssrLoadModule`, so it is the same TypeScript) and answers `422` rather than writing |
| `tests/regionMap.test.ts` | asserts the shipped map has **no errors and no warnings**, and pins each rule against a deliberately broken copy |

That triple is the point. The old arrangement had the rules inside the importer,
where only the CLI could reach them; an editor would have had to re-implement
them and then drift. A rule added to `mapRules.ts` is enforced in all three, or
in none.

**Errors** are what the sim cannot cope with: a Townhall footprint that is not
clear Grassland, a site on water or void or sharing a cell, a shoal on dry land
or a forest at sea, an unknown id, a ruin missing or invented, a delve number
that makes no sense (`depthGrowth < 1` would make deeper delves *faster*).

**Warnings** are what a designer probably did not mean. Today there is one that
matters: **land the Townhall cannot walk to**. `townhallDistance()` returns 0
for an unreachable cell, and `revealCost(0)` is the cheapest ring — so a
stranded island is *free* to reveal. That is invisible in play until someone
finds it, and it was invisible in the spreadsheet by construction.

## 4. Using it

`npm run dev`, then `http://localhost:5173/?dev=map`. It replaces the game
rather than sitting inside it — the game frames itself to a 9:16 phone, which
is the wrong shape for looking at a region.

| Tool | Key | |
|---|---|---|
| Brush | `B` | drag to paint; painting into void **creates** cells, which is how the world grows |
| Rectangle | `R` | or hold `Shift` |
| Fill | `F` | or hold `Ctrl`; a feature fill spreads over one *terrain*, not one feature |
| Pick | `I` | or hold `Alt` |
| Sites | `S` | three modes of its own, below |

The Sites tool splits into three modes, shown as labelled buttons in the
toolbar because "what does a click do right now" is the one question a modal
tool has to answer out loud:

| Mode | A click | |
|---|---|---|
| **Select & move** | selects a site and opens its inspector; drag moves it | the default |
| **Place landmark** | drops a new landmark on any cell | `N` also does this from any tool, wherever the pointer is |
| **Erase landmark** | deletes the landmark under the cursor | `Delete` also does this to the selected one |

The cursor changes per mode, and Place and Erase each carry a one-line note
saying what you are about to get: a new landmark arrives as an unnamed `Shrine`
at 25,000 Gold, to be renamed and priced in the inspector, and a ruin refuses
to be erased with a toast rather than silently doing nothing.

Two guard rails worth knowing. Placing onto an occupied cell **selects what is
there** instead of stacking two sites, since a second site on one cell is a
hard error and never what was meant. And placement is not otherwise validated:
you can drop a landmark in the sea, and what happens is the error appears, the
cell hatches red and Save locks until you move it — the editor lets you put a
thing down and then put it down properly, rather than refusing a click without
saying why.

Picking a terrain or feature swatch switches back to the Brush, because
reaching for a colour means you want to paint with it.

Brush size `1`–`5`. Space or right-drag pans, the wheel zooms about the
pointer. `Ctrl+Z` / `Ctrl+Shift+Z` undo and redo — **one drag is one step**.
`Ctrl+S` saves.

Overlays, all toggleable: grid `G`, **distance & fog cost** `D` (the ring and
the Gold price on every cell), ring bands `K`, problems `W`, sites `H`.

The right-hand panel carries the problem list, the selected site's full
property form, and a **census**: counts per terrain and feature, then a table of
cells and features **per distance ring** with that ring's Gold price. "Is there
enough Wood inside ring 4" is the question the spreadsheet could never answer
and this one answers at a glance.

## 5. Saving

Save POSTs the document to `/__map/save`, a middleware registered by
`scripts/vite-map-editor.mjs` with `apply: 'serve'` — it **cannot exist in a
build**. The middleware validates, then writes `region-map.json`.

Writing that file is an HMR edit, so the page reloads immediately afterwards.
That is deliberate: camera, tool, brush and overlay state ride through it in
`sessionStorage`, and the reload doubles as proof that what was written parses
and loads. If the endpoint is not there — someone opened the editor against a
built bundle — the save falls back to downloading the JSON rather than losing
the work.

The serialiser is a **fixed point**: re-saving an unchanged map produces
byte-identical output, so a save never shows up as a diff on its own.

## 6. Dials

In the order to reach for them.

| Want | Change |
|---|---|
| the world itself | the editor |
| what a legal map is | `validateRegionMap()` in `src/sim/data/mapRules.ts` — then a case in `tests/regionMap.test.ts` |
| fog price per ring | `FogRings` in the workbook (still a balancing number, still a sheet) |
| a new terrain or feature | `TerrainId` / `FeatureId` in `state.ts`, `FEATURES` and a sprite in `definitions.ts`, `TERRAIN_IDS` in `mapRules.ts` — the editor's palette is generated from those |
| a sixth ruin | `RuinId` in `state.ts` + a `ruinContent` entry in `definitions.ts`, then place it in the editor |
| how wide a void fill may spread | `FILL_MARGIN` / `FILL_LIMIT` in `src/editor/mount.ts` |

## 7. What was deliberately not built

- **Round-tripping back into the workbook.** Considered, and rejected: two
  writable homes for one fact is the drift this change exists to remove. The
  three sheets are gone, not stale.
- **Multi-region.** The editor edits `oakville` because that is the only
  authored region. A second is a second JSON file and a row in `REGIONS` —
  see [`implementation-plan.md`](implementation-plan.md) §5 before assuming it is only that.
- **Undo as a command stack.** Whole-document snapshots, because a few hundred
  cells makes a `structuredClone` free and a diff stack is the thing that would
  quietly get a case wrong.
- **Editing the Townhall.** It anchors at (0,0) by definition and every fog
  price derives from it; it is drawn, and validated, and not movable.

## Open questions

- **Should a map change force a `SAVE_VERSION` bump?** — OQ-49.
- **Should the census have budgets?** — OQ-50.
- **Tests pin cells near the Townhall.** The onboarding tests play the real
  opening over the real map, so repainting the first few rings breaks them —
  correctly, but with an error that talks about quests rather than about the
  cell that moved.
