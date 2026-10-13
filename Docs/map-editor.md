Map editor
---

> **Scope.** How map content — terrain, features, landmarks, lairs and
> abandoned buildings — is authored: the map editor (the Region map board of
> the data editor, `?dev=data#map`, [`plans/data-editor.md`](plans/data-editor.md)),
> the shared rule module every consumer validates against, and the dev-only
> save path.
>
> **Status: built.** This is a **tool**, not a game feature — the map
> content it authors is designed in
> [`features/01-map-and-fog.md`](features/01-map-and-fog.md).

## 1. What it is

- A paint program for the province, drawn as the game draws it.
- Map content is authored **by coordinate**, so it is a board of its own
  inside the data editor rather than a collection of rows (invariant 5).
- It shows what a map edit does: the ring and fog price of every cell, the
  problems as they appear, a census per ring.
- It writes one file, `src/sim/data/region-map.json`, through one validator.

## 2. Where map content lives

`src/sim/data/region-map.json` is written by the editor and holds all five
kinds of map content:

```
terrain   { cells: [{x, y, id}] }   every cell that exists; absent = void
features  { cells: [{x, y, id}] }   at most one per cell
landmarks [{id, kind, x, y, claimCost}]
lairs     { <LairId>: {x, y, size, tier, radius, sight, guard, flavour} }
guard     { threat, power, warningMinutes, mix? }   on every lair
abandoned [{id, district, x, y, sight, name?}]   buildings the fog swallowed
```

- **An abandoned building** is a building from `buildings`, its anchor and its
  `sight` ([`features/01-map-and-fog.md`](features/01-map-and-fog.md) §6.3).
  The validator holds its ground to a site's rules, its id to the sites' one
  namespace, and its count to the Townhall cap at the level whose reach first
  covers it.
- **`guard`** is the lair's garrison and the clock finding it starts
  ([`features/18-garrisons-and-raids.md`](features/18-garrisons-and-raids.md)
  §2). The validator asks for a unit type or `Any`, a `power` of at least 1, a
  warning of at least one minute, a `mix` (when present) that names units and
  fields something, a `sight` that reaches past the `radius` (or 0 for
  never), and a flavour line that fits the card. The editor has no field for
  the `mix`; a save carries it through untouched.
- **A landmark's `kind`** is `StandingStones`, `Leyspring` or `Watchtower`
  (`LANDMARK_ART`). The map uses the first two; its Watchtower is an
  abandoned building.
- `definitions.ts` reads `LANDMARKS`, `LAIRS` and `ABANDONED` from here;
  `grid.ts` reads terrain and features.
- The file is written one cell per line, sorted in reading order, so a map
  change shows up in `git diff` as the cells that moved.
- **The lair roster is fixed in code.** `LairId` is a union in `state.ts` and
  the five lairs have hand-written names, art and sprites in `definitions.ts`,
  so the editor can move and retune a lair but not add or delete one.
  Landmarks and abandoned buildings are fully editable.

## 3. The rules, in one module

[`src/sim/data/mapRules.ts`](../src/sim/data/mapRules.ts) exports
`validateRegionMap(doc)` returning `{errors, warnings, ok}`. It is the *only*
statement of what a legal map is, and it has three consumers:

| Consumer | What it does with it |
|---|---|
| the editor | re-runs it on every edit; Save is refused while `errors` is non-empty, and each issue is a button that flies the camera to its cell |
| `scripts/vite-map-editor.mjs` | re-runs it server-side (via `ssrLoadModule`, so it is the same TypeScript) and answers `422` rather than writing |
| `tests/regionMap.test.ts` | asserts the shipped map has **no errors and no warnings**, and pins each rule against a deliberately broken copy |

A rule added to `mapRules.ts` is enforced in all three, or in none.

**Errors** are what the sim cannot cope with: an empty map; two terrains or
two features on one cell; an unknown id; a feature on void; a shoal on dry
land or a land feature at sea; a Townhall footprint that is not clear
Grassland; a site on water or void, under the Townhall or sharing a cell with
another site or a feature; a site size outside 1–3; a landmark with a blank or
duplicate id, an unknown kind or a claim cost that is not a positive whole
number; a lair missing or invented, or with a bad tier, guard, radius, sight
or flavour; an abandoned building that is not a building the player can
raise, with a bad sight or name, past every Townhall's reach, or more of its
kind inside a Townhall level's reach than that level's count cap allows.

**Warnings** are what a designer probably did not mean: **land the Townhall
cannot walk to**, and a site standing on it.

## 4. Using it

`npm run dev`, then `http://localhost:5173/?dev=data#map` — the **Region map**
board of the data editor ([`plans/data-editor.md`](plans/data-editor.md)).
`?dev=map` redirects there. It replaces the game rather than sitting inside
its 9:16 frame.

The board is drawn **as the game draws it**:

- the game's isometric camera — every cell a 2:1 diamond, picked through the
  same projection a tap uses;
- the ground's per-cell variants and the fringes where two terrains meet;
- features, landmarks, lairs, abandoned buildings and the Townhall (level 1)
  standing on their plots with the game's sprites, painted back to front,
  multi-cell blocks drawn once over the whole block;
- **no fog**: the province is shown revealed, so every cell can be painted.

Everything the tool adds — grid, distances, ring bands, problems, site
outlines and labels — is an overlay drawn over that view.

| Tool | Key | |
|---|---|---|
| Brush | `B` | drag to paint; painting into void **creates** cells |
| Rectangle | `R` | or hold `Shift` |
| Fill | `F` | or hold `Ctrl`; a feature fill spreads over one *terrain*, not one feature |
| Pick | `I` | or hold `Alt` |
| Sites | `S` | four modes of its own, below |

The Sites tool has four modes, shown as labelled buttons in the toolbar:

| Mode | A click | |
|---|---|---|
| **Select & move** | selects a site and opens its inspector; drag moves it | the default |
| **Place landmark** | drops a new landmark on any cell | `N` also does this from any tool, wherever the pointer is |
| **Place abandoned** | drops a new abandoned building — a House seen from 3 rings — on any cell | pick the building, its name and its sight in the inspector |
| **Erase** | deletes the landmark or abandoned building under the cursor | `Delete` also does this to the selected one |

- The cursor changes per mode, and Place and Erase each carry a one-line
  note. A new landmark arrives as standing stones (`NewShrine<n>`) at
  25,000 Gold, to be renamed and priced in the inspector. A lair refuses to be erased with a
  toast.
- Placing onto an occupied cell **selects what is there** instead of stacking
  two sites.
- Placement is not otherwise refused: a landmark dropped in the sea raises its
  error, the cell hatches red and Save is refused until it is moved.
- Picking a terrain or feature swatch switches back to the Brush.
- Brush size `1`–`5`. Space or right-drag pans, the wheel zooms about the
  pointer. `Ctrl+Z` / `Ctrl+Shift+Z` (or `Ctrl+Y`) undo and redo — **one drag
  is one step**. `Ctrl+S` saves.
- Overlays, all toggleable: grid `G`, **distance & fog cost** `D` (the ring
  and the Gold price on every cell), ring bands `K`, problems `W`, sites `H`.
- The right-hand panel carries the problem list, the selected site's full
  property form, and a **census**: counts per terrain and feature, then a
  table of cells and features **per distance ring** with that ring's Gold
  price.

## 5. Saving

- Save POSTs the document to `/__map/save`, a middleware registered by
  `scripts/vite-map-editor.mjs` with `apply: 'serve'` — it **cannot exist in a
  build**. The middleware validates, then writes `region-map.json`.
- Camera, tool, brush and overlay state are kept in `sessionStorage`, so they
  survive the reload a data change brings.
- If the endpoint is not there — the editor opened against a built bundle —
  the save downloads the JSON instead.
- The serialiser is a **fixed point**: re-saving an unchanged map produces
  byte-identical output.

## 6. Dials, in the order to reach for them

| Want | Change |
|---|---|
| the world itself | the editor |
| what a legal map is | `validateRegionMap()` in `src/sim/data/mapRules.ts` — then a case in `tests/regionMap.test.ts` |
| fog price per ring | `fog.rings` in the Exploration settings (`?dev=data#exploration`) |
| a new terrain or feature | `TerrainId` / `FeatureId` in `state.ts`, `FEATURES` and a sprite in `definitions.ts`, `TERRAIN_IDS` in `mapRules.ts` — the editor's palette is generated from those |
| a sixth lair | `LairId` in `state.ts` + a `lairContent` entry in `definitions.ts`, then place it in the editor |
| how wide a void fill may spread | `FILL_MARGIN` / `FILL_LIMIT` in `src/editor/mount.ts` |

## 7. Deliberately not in this design

- **Multi-region.** The editor edits `oakville`, the only authored region. A
  second is a second JSON file and a row in `REGIONS` — see
  [`implementation-plan.md`](implementation-plan.md) §5 before assuming it is
  only that.
- **Undo as a command stack.** Undo keeps whole-document snapshots.
- **Editing the Townhall.** It anchors at (0,0) and every fog price derives
  from it; it is drawn and validated, and not movable.
- **A field for a lair's `mix`.** It is edited in the file.

**Open questions:** OQ-49, OQ-50 in [`open-questions.md`](open-questions.md).
The onboarding tests play the real opening over the real map, so repainting
the first few rings breaks them with an error that talks about quests rather
than about the cell that moved.
