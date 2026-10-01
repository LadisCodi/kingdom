# Plan — the world board, step 1: board, fog and explorers

> **What this is.** The build order for step 1 of the world map
> ([`../features/02-map-scopes.md`](../features/02-map-scopes.md) §7): the
> board, client-side fog, explorers and the dispatch sheet. Lane C of
> [`the-4x-build.md`](the-4x-build.md) (C1, C2, C3, C6, plus explorers).
> What the board IS stays in [`../features/19-world-map.md`](../features/19-world-map.md).
>
> **Status: planned 2026-10-01, not started.** Branch `feat/world-map`.
> Mockups: [`../art/ui/mockups/`](../art/ui/mockups) m55–m59.

## 0. Decisions this plan rests on

- **An explorer's reveal is computed, not stepped.** A trip stores its path,
  `departedAt`, `msPerHex` and `radius`, all priced at dispatch.
  `worldFogAt(state, t)` = the stored bitset plus a disc of `radius` round
  every hex of the path reached by `t`. **One boundary per trip, at
  `returnsAt`**: it folds the trip's reveal into the bitset and frees the
  slot. An absence of any length adds at most `explorerSlots` boundaries.
  **The reveal starts at the first hex past the city**: a dispatch reveals
  nothing at once.
- **The board is generated, behind a source.** `generateBoard(seed, WORLD_GEN)`
  is pure and follows 19 §9: **one wedge rolled and turned six times**, the
  inner ring authored in data. It sits
  behind a `WorldSource` (`board()`, `seats()`, `controlOf(hex)`), so a server
  board later swaps the source, not the callers. **The save keeps only
  `{ id, seed, seat }`**, never the contents.
- **Only Revealed is stored**: 91 bits as `number[3]` (uint32, `>>> 0`). The
  city hex and the Portal are always revealed and never stored. **Sensed is
  derived**: not revealed and next to a hex the player revealed (the Portal
  senses nothing).
- **Cartography stays a `mechanic`** (it opens the Outpost in step 2 too).
  Slots = Cartography's 1 + a new flat tech stat `explorerSlots` (the Atlas
  ladder). Reveal radius = 1 + a new stat `worldRevealRadius`, capped at 2.

## 1. Hex maths — pure, no dependencies

- `src/sim/world/hex.ts`: axial `Hex`, `HEX_DIRS` in a fixed order,
  `neighbors`, `distance`, `ring`, `within`, a deterministic `hexLine`,
  `BOARD_RADIUS = 5`, the 91 `BOARD_HEXES` in a canonical order,
  `hexIndex` / `hexAt`, `ringOf`. Never imports `grid.ts`.
- `src/sim/world/fogBits.ts`: the 91-bit set.
- `tests/hex.test.ts`: 91 hexes, rings 1/6/12/18/24/30, index round trip,
  distance laws, `hexLine` steps adjacent and of length `distance + 1`.

## 2. The board and its data

- **New collection `world`** — file, schema, line in `balance.ts`, entry in
  `COLLECTIONS` and its rules, shipped together:

| Setting | First value |
|---|---|
| `marchSecondsPerHex` | ~600 (armies reuse it) |
| `explorerRevealRadius` | 1 (1–2) |
| `cartographyExplorers` | 1 |
| `rivals` | five stub names |
| `worldGen.innerRing` | six authored hexes: 2 Forest, 2 empty (one Fertile land), 2 Mountain |
| `worldGen.terrainWeights`, `featureChance`, `maxFeaturesPerHex` | per ring role |

- Rules refuse a Dungeon or Sanctuary chance off the outer ring, a Landmark
  chance off the corridors, an inner ring that is not six hexes.
- `src/sim/world/types.ts`: `WORLD_TERRAINS` and `WORLD_FEATURES` as unions
  (a new id is code).
- `src/sim/world/board.ts`: `Board`, `BoardHex { role, terrain, features, seat }`,
  `SEATS` = the six corners of ring 4, `roleOf`.
- `src/sim/world/generate.ts`: rolls one wedge (a seat's 15 hexes of rings
  1–5, minus its inner-ring hex) with `rand(seed, 'worldWedge', i, …)` and
  turns it six times; the seat is empty Grassland; a fix-up pass on the wedge
  guarantees a Grassland+Forest and an empty Grassland neighbour and no
  Dungeon beside the seat.
- `src/sim/world/source.ts`: `localWorld`; step 1's `controlOf` knows only
  the six seats. **No sim code reads another player's control.**
- `tests/worldBoard.test.ts`: role counts, seat distances, same seed same
  board, the six wedges identical under rotation, the §9 guarantees over
  ~500 seeds.

## 3. State, explorers and the save — headless, tested

- `GameState.world = { board: { id, seed, seat }, revealed, explorers }`;
  `ExplorerTrip = { id, target, path, departedAt, msPerHex, radius }`.
  `newGame` derives the seed and the seat from `state.seed`.
- `src/sim/world/explorers.ts`: `explorerSlots`, `freeExplorers`,
  `revealRadius`, `marchMsPerHex` (the first reader of `worldRevealSpeed`),
  `tripTimes`, `worldFogAt`, `fogStateOf`, `dispatchExplorer(state, target, now)`
  → `Sent | NoCartography | NoExplorerFree | Home | OffBoard`,
  `nextExplorerReturn`, `returnExplorers`.
- `commands.ts`: one `consider(nextExplorerReturn(...))` in `nextBoundary`,
  one branch in `applyDueAt`, `explorersHome` in `AdvanceResult`. Nothing in
  `runContinuous`.
- **Save:** module `kingdom.world`; `SAVE_VERSION` 74 → 75, additive, no
  migrator. The default for an old save is derived **after** `meta.seed` is
  restored in `deserialize`.
- `TECH_STATS`: `explorerSlots`, `worldRevealRadius` (flat, global).
- `tests/explorers.test.ts`: every refusal, slots from the tree, linear march
  time divided by the boon, the partial reveal mid-march, the slot freed at
  `returnsAt`; **one-call replay equals stepped ticking** over three days
  with a dispatch mid-way; save round trip mid-march; a v74 save loads.

## 4. The renderer — a second scene

- `src/render/world/hexLayout.ts`: pointy-top hex ↔ pixel, 256 × 296 plate.
- `src/render/world/hexCamera.ts`: hex 130 px at tactical, 45 px at
  strategic; `settle()` glides to the nearer register after a pinch; pan
  clamped to the board. `src/render/input.ts` takes a narrower camera type
  and an `onGestureEnd`.
- `src/render/world/boardRenderer.ts`: terrain plates (flat colours until the
  hex art exists), props, the three fog treatments, the Portal, ownership as
  edge borders via a pure `territoryEdges()`, the selected rim, the planned
  route with its hex count, explorer tokens interpolated from `now`, a mist
  fade on newly revealed hexes.
- `index.html` gets `<canvas id="world">`; `main.ts` draws one scene or the
  other. **Still one tick driver.**
- `tests/hexCamera.test.ts`: widths at both registers, `screenToHex` round
  trip on all 91 hexes, `settle`, `territoryEdges`.

## 5. Entering the world, the sheet, the explorers' status

- `Game`: `scene: 'province' | 'world'` (not saved), `enterWorld` /
  `leaveWorld` behind `isDoorOpen('world')`, `handleWorldTap`,
  `sendExplorer`. Overlay `worldHex`. **The preview `worldSheet.ts` goes.**
- `src/ui/worldKnob.ts`: in the province it enters the world; in the world it
  wears the castle and goes home. In the world the quest, daily and season
  pills hide; header and nav stay.
- `src/ui/world/dispatchSheet.ts`: the hex's name, what it holds (or
  silhouettes when Sensed), distance and march time, **Explore**; a refused
  Explore says why (no Cartography → the Atlas; every explorer out → the
  soonest return).
- `src/ui/world/explorerStrip.ts`: the explorers chip (*1/2*); a tap on a
  busy one glides to it. A toast when one comes home.
- Tree, in `?dev=data#tree`: Cartography loses `planned`; the explorer
  ladder and a reveal-radius card join the Atlas.
- Tests: the shut knob, entering, a tap opening the sheet, Explore creating a
  trip, each refusal line.

## 6. Docs that move with the code

`19` status and §3.1 numbers · `02` §7 · `tech-tree.md` §6, §8, §9 · `22` §5
(the preview is gone) · `10-heroes.md` (the Scout's boon is read) ·
`implementation-plan.md` · `CLAUDE.md` (`SAVE_VERSION` 75, the suite count).

## 7. Stubbed for later steps

- The seat and the rivals are local; `controlOf` knows only the cities.
- No outposts, connection, improvements or claimable rim yet (the edge helper
  is ready).
- No Portal counter.
- Armies will reuse `marchSecondsPerHex` and the reveal discs, but their march
  is server state and gets no boundary in the client.

## 8. Open points

- **A server seat that differs from the local one** invalidates the fog:
  rotate the bitset by the board's 60° symmetry, or reset it.
- **Retuning `worldGen` reshuffles every local board**; the fog survives
  because it indexes hexes. Acceptable until the server freezes the board.
- The province's era gates count revealed cells; **world hexes never count**.
