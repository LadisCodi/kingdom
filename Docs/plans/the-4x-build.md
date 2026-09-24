# Plan — building the 4X

> **What this is.** The work left to turn the design into the game, **cut into
> lanes that can run at the same time on different machines**. It owns the
> *sequence* and the *coordination*; what each thing should BE stays in the
> feature docs.
>
> **Status: not started.** Every lane is open.
>
> **Read first:** [`../overview.md`](../overview.md) for what the game is,
> `CLAUDE.md` for the engine contract, and the lane's own design docs below.

## 0. How to work in parallel without a merge war

**The rule that makes everything else work: a lane owns paths, and never writes
outside them.** Conflicts are prevented by territory, not by care.

1. **One branch per lane**, off `develop`, named for the lane: `feat/iso-city`,
   `feat/world-board`, `art/asset-set`, `feat/found-books`, `docs/design-debt`.
2. **A lane writes only inside its own paths (§1).** If the work genuinely needs
   a file another lane owns, **stop and say so** rather than reaching across.
   That is a coordination event, not a detail.
3. **A lane never edits another lane's section of this file.** Sections merge
   cleanly because they are different hunks; the whole file does not.
4. **Every lane ends green**: `npm test`, `npm run build`, and `npm run art:check`
   if it touched art. A lane that cannot land green is not done.
5. **Small, frequent merges into `develop` beat one big one.** A lane that runs
   for a week without merging has stopped being a lane and become a fork.
6. **`Docs/` is always the safe lane.** Design work can run at any time against
   anything.

### The three files that cannot be shared

| File | Why it is dangerous | The rule |
|---|---|---|
| **`balance/balance.xlsx`** | binary — git cannot merge it, and a conflict means one side's work is simply gone | **One lane holds it at a time.** Say so before opening it, and merge before letting go |
| **`src/sim/data/definitions.ts`** → `SAVE_VERSION` | two lanes bumping it produce a save that claims a version it does not have | **Never reserve a number in advance.** The second lane to merge rebases and re-bumps. `MIGRATIONS` is append-only, so the order it lands in is the order it must be written in |
| **`src/game.ts`** (4,492 lines) | everything wants to touch it, so everything collides in it | Put the work in **your own module** and touch `game.ts` in as few and as small hunks as you can. It is a wiring file; do not let it become the work |

### The seam between code and art is a filename

`src/render/sprites.ts` picks up any PNG dropped in `src/render/assets/` **by
filename**, and falls back to an emoji glyph when the file is not there
(`src/render/assets/README.md`). So:

> **Art never blocks code and code never blocks art.** The renderer can be
> finished against glyphs, the assets can land one file at a time against a
> renderer that is not, and neither lane ever waits for the other or has to talk
> to it.

Names and per-level suffixes are already fixed by that README. **Do not invent a
new name**; if a new asset needs one, it is added there first.

## 1. The lanes

| Lane | Owns | Blocked by | Can start |
|---|---|---|---|
| **A · The isometric city** | `src/render/` (not `world/`), `src/render/palette.ts`, `tests/render*` | nothing | **now** |
| **B · The asset set** | `Docs/art/`, `src/render/assets/` | nothing | **now** |
| **C · The hex board** | `src/sim/world/`, `src/render/world/`, `src/ui/world*`, `tests/world*` | nothing | **now** |
| **D · Books become content** | `src/sim/research.ts`, `src/sim/data/techTreeRules.ts`, `src/editor/tree/` | nothing | **now** |
| **E · Design debt** | `Docs/` | nothing | **now** |

**All five can run at once.** That is deliberate: no lane's first task depends on
another lane's output, because the seams are filenames and module boundaries
rather than handoffs.

---

## 2. Lane A · The isometric city

> **Branch `feat/iso-city`. Spec: [`../art/art-direction.md`](../art/art-direction.md) §3.**

**The sim does not change.** Not one file in `src/sim/`. The grid stays square,
the three distance metrics stay, fog and placement and influence are untouched.
**Isometric is a projection, not a grid** — this lane is `src/render/` and
nothing else, which is what makes it safe to run beside everything.

| # | Task | Notes |
|---|---|---|
| A1 | `palette.ts`: retire `TILE_SIZE = 72` for `TILE_W = 128` / `TILE_H = 64` | every other module reads these |
| A2 | `camera.ts`: `cellToScreen` as `((x-y)*64, (x+y)*32)` | the easy half |
| A3 | `camera.ts`: **the inverse** — `screenToCell`, and `screenToCellExact` for zoom-about-pointer | the fiddly half; get it wrong and every tap lands on the wrong tile |
| A4 | `mapRenderer.ts`: terrain pass draws diamonds, **draw order `x + y` ascending** | painter's algorithm |
| A5 | Sprite anchors: the per-footprint canvas/anchor table (bible §3.1) | anchor is the ground diamond's centre |
| A6 | `input.ts`: hit-test a **diamond**, not a rectangle | point-in-diamond |
| A7 | Overlays as diamonds: selection, valid target, influence, reach, spell zones | `palette.ts` already names them all |
| A8 | Test: **round-trip** `cell → screen → cell` for every cell at several zooms | the one test that proves A3 |

- **Do it against the old sprites.** They will look wrong — top-down art on an
  isometric floor — and that is fine: the geometry is what is being validated,
  and lane B replaces them underneath without a code change.
- `villagers.ts`, `tapFx.ts`, `floaters.ts` and `characters.ts` all position
  against the camera; they follow A2/A3 for free, but check them.

## 3. Lane B · The asset set

> **Branch `art/asset-set`. Spec: [`../art/art-direction.md`](../art/art-direction.md).**

Every one of the 221 sprites in `src/render/assets/` and the 606 frames in
`Docs/art/characters/` is top-down pixel art and contradicts the direction.
**They are replaced one file at a time**, and the game keeps running throughout.

| # | Task | Why this order |
|---|---|---|
| B1 | **Terrain ×6** — grassland, plains, desert, snow, tundra, water | the floor. Lands first because it is what makes lane A's projection visible, and it blocks nothing |
| B2 | **Features** — forest, berries, game, farmlands, rocks, mountain (iron/gold), shoal, each with its exhausted variant | second most-seen thing on the map |
| B3 | **Buildings by level** — the long tail, `<sprite>_l<level>.png` | the biggest block; lands one building at a time, in any order |
| B4 | **Characters** — villager first, then the work loops | `npm run art:characters` rebuilds the atlas |
| B5 | **Hex plates and props** for lane C | not needed until C6 |

- Generate against `style-reference.png` with the `LOCKED VISUAL STYLE` block
  verbatim, per the bible §9. **Attach a montage of already-landed assets** as a
  second anchor — the reference is a scene, the assets are trimmed tiles.
- **The normalisation scripts need one edit before first use**: `-filter point`
  in `Docs/art/originals/v3-sheets/norm_sq.fish` must become a smooth filter.
  Nearest-neighbour is the pixel era.
- Verify the alpha on every sheet (bible §9.3). A baked-in background is the
  failure that survives a contact sheet and dies in the game.

## 4. Lane C · The hex board

> **Branch `feat/world-board`. Spec: [`../features/19-world-map.md`](../features/19-world-map.md),
> authority in [`../features/02-map-scopes.md`](../features/02-map-scopes.md) §3.**

Greenfield: nothing of this exists but the `worldRevealSpeed` modifier stat.
**Keep it in `src/sim/world/` and `src/render/world/`** so it never meets lane A.

| # | Task | Notes |
|---|---|---|
| C1 | Axial coordinates, distance, neighbours, rings | pure, testable, zero dependencies. **Do not reuse `grid.ts`** |
| C2 | Board generation under [`19`](../features/19-world-map.md) §9 | inner ring is authored, not rolled |
| C3 | Fog as a bitset in the save | 91 bits; client-authoritative by design |
| C4 | **Armies and the march** | see the warning below |
| C5 | Control, connection chains, the inactive recompute | one pass on any change of control, never per-tick |
| C6 | The flat hex renderer, both zoom registers | bible §7 |
| C7 | Attacks: conquest, denial, the Fortress | the resolver is [`combat.md`](../features/combat.md), already built |

> **C4 is the task that can break the engine's first invariant.** A march is a
> **timer**, so it is a `consider()` in `nextBoundary` plus a branch in
> `applyDueAt` — **nothing else**, and it resolves uncapped in the tail advance.
> Read `CLAUDE.md` invariants 1 and 2 before writing a line of it, and add the
> one-call-replay-equals-stepped-ticking test in the same commit.

- **Randomness is counter/hash** (invariant 4). Board generation seeds on the
  board's id and the hex's coordinates — never on a call order.
- Control is server-authoritative in the design. **For the prototype it may be
  local**, but the module boundary has to assume it is not: no sim code should
  read another player's control directly.

## 5. Lane D · Books become content

> **Branch `feat/found-books`. Spec: [`../features/07-research.md`](../features/07-research.md) §2.3.**

| # | Task | Notes |
|---|---|---|
| D1 | `TomeId` stops being a hand-written union and becomes the keys of `tech-tree.json` | exactly what `TechId` already does — copy it |
| D2 | `techTreeRules.ts`: what a legal tree with N books is | checked by the editor, the save endpoint and `tests/techTree.test.ts` — all three |
| D3 | `?dev=tree`: create and delete a book | [`../tech-tree-editor.md`](../tech-tree-editor.md) |
| D4 | The drop that grants a book — province ruins pay basic, outer-ring dungeons pay rare | the only part that is not mechanical |
| D5 | The save records which books are owned | additive: bump `SAVE_VERSION`, no migrator (`CLAUDE.md` §Saves) |

- `isTomeOpen` is already per-book and §5.1 already hides an unopened book's
  tab. **Most of the UI work is already done** — check before writing it.

## 6. Lane E · Design debt

> **Branch `docs/design-debt`. Always safe to run.**

| # | Task | Blocks |
|---|---|---|
| E1 | **Close `OQ-3` — how long a season on the board lasts** | **lane C5.** It decides whether a lost corridor is a setback or a permanent demotion, and whether a new player can land on a carved-up board |
| E2 | Audit `implementation-plan.md` §4 against what the last three passes changed | steps 2 and 5 point at designs that have moved |
| E3 | Sweep the feature docs for numbers the code has since changed | `CLAUDE.md`'s `SAVE_VERSION` had drifted **fifteen versions**; assume it is not the only one |

## 7. What is deliberately not here

- **A schedule, or estimates.** The lanes are ordered by dependency, not by date.
- **Server infrastructure** for world control. The prototype is
  client-authoritative and says so ([`02`](../features/02-map-scopes.md) §3).
- **A second region.** `regionId` exists; everything beyond it is deferred
  (`CLAUDE.md`).
- **Reworking the chrome.** It is specified, mocked up and working
  ([`../art/ui-menus-redesign.md`](../art/ui-menus-redesign.md)).
- **A checkbox per task in this file.** Five machines editing one checklist is
  the merge war §0 exists to prevent. **What is done is what is merged into
  `develop`** — `git log` is the status board.
