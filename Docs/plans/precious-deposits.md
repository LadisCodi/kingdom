# Plan — precious deposits, and a world of many boards

> **What this is.** The precious materials stop being a hidden "rich" state
> on ordinary hexes ([`../features/19-world-map.md`](../features/19-world-map.md)
> §7.4) and become **deposits**: three features of their own, dealt to every
> seat 3/2/1 from a bag. Phase 1 builds that on today's board of six, with
> the generator ready for a world made of many boards. Phase 2, later, makes
> that world. Decisions taken with the user on 2026-10-06.
>
> **Phase 1 built** (the live design is
> [`../features/19-world-map.md`](../features/19-world-map.md) §7.4–§7.6,
> §9). Step 1 (geometry for many boards) moved to the start of phase 2: the
> six-seat assumptions are already single constants, and their per-board
> shape is phase 2's to decide.

## 1. The design (phase 1)

### 1.1 Three deposits

| Feature | On terrain | Its district | Yields |
|---|---|---|---|
| **Heartwood Grove** — an enchanted wood | Grassland, Plains | Grove Camp | Heartwood |
| **Starfall Crater** — a fallen star | Desert | Starmetal Dig | Starmetal |
| **Moonglass Spires** — crystal needles | Plains | Spire Quarry | Moonglass |

- A feature like Forest or Mountain: **it is the deposit**, not a state of
  another feature. Its district yields only its material.
- Art of their own (ChatGPT), on the map and in the district card.

### 1.2 Dealt 3/2/1 from a bag

- Each seat has **six deposits** in its corridor, two to three hexes from
  its city (rings 3–4): **3 of its strong material, 2 of its middle, 1 of
  its weak**.
- **The six places are the same in every wedge** (the wedge is still
  rolled once and rotated); only which material sits on each differs.
- **The bag:** the six orders of (3, 2, 1) over the three materials, one per
  seat, shuffled by the board's seed (counter/hash). Every material is
  strong for two seats, middle for two, weak for two: **12 deposits of each
  per board**.
- **The inner ring** holds six more, outside the deal: the inner hex facing
  each seat is that seat's **weak** material — so two of each, by the bag's
  own arithmetic. Guarded by their strong inner camps, +200% as every
  inner district.
- **Conquered and denied like any hex** (§6). Losing the one weak deposit
  is losing a supply, not the game: trade covers it.
- **Lumps** (camps, scouting, dungeon rooms, the Portal) are **uniform**: a
  third of each material.
- The "rich" state goes: `richFeatureShare`, `richDesertShare`, `ownShare`,
  the second store on ordinary districts, the sparkle.

### 1.3 Demand

- **Early and low, by name.** A few (2–3) of a named material at building
  levels 4–5 and in the first cards after the world opens (the Atlas), the
  three materials asked for equally across them; rising to the current
  prices at levels 8–10.
- With 3/2/1 everyone can pay every price; trading pays it **twice as fast**
  for the weak material (§1.4).

### 1.4 Why the numbers

- Equal demand for the three, supply 3:2:1: alone, the weak material sets
  the pace (1); trading one for one evens the six out (2 each). Trade
  doubles the late game's speed; it never gates it.
- **Supply per deposit** is set so a seat's total matches today's at the
  same development — measured with the pacing harness, not guessed (step 7).

### 1.5 Live boards: a fresh world

- The release that ships this **resets the world**: every board is replaced.
  A player keeps their nickname, crest and friends, and is seated again on a
  new board the next time they go out; what they held on the old board is
  gone.
- **Nothing is lost that the rules say is never lost:** armies out come home
  whole, a world relic hosted in a Chapel goes back to the inventory, an
  offer or store in flight is paid.

## 2. Steps (phase 1)

Each step lands with its tests green and the game playable.

1. **Geometry ready for many boards.** The board's hexes, rings, wedges and
   seats read from one geometry object with an origin, instead of
   `BOARD_RADIUS`/`SEAT_INDICES` constants scattered over ~25 sites
   (generator, server, fog, camera, renderer). Behaviour unchanged: a world
   of one board at the origin is today's game. The stale comments on the
   fog's size go.
2. **The features and districts.** `HeartwoodGrove`, `StarfallCrater`,
   `MoonglassSpires` (feature ids are code); `featureRules` for their
   terrain; three world districts producing a precious material into the
   district's precious store; their sheet lines.
3. **The deal.** `dealDeposits(seed)` — the bag of six orders; the six
   deposit places per wedge authored in data (`worldGen.depositPlaces`, ring
   keys like `3:1`), checked by the data rules (on the corridor, not beside
   the city, not on a site); the inner ring's deposits from the deal.
   `materials` per seat becomes `deposits` per seat (strong, middle, weak).
4. **Remove "rich".** The rich roll, `materialAt`, the precious store on
   ordinary districts, the renderer's sparkle; lumps uniform.
5. **The world server.** Rates from the district (`perDay` per deposit,
   `storeDays`, the inner ring's ×3 and the seat's boost as today); the
   snapshot's precious store on deposits; a board version bump that
   **unseats everyone** (the fresh world, §1.5) with armies home and
   Chapels emptied as effects the client already applies.
6. **The client.** Map art and labels for the three; the world sheet's
   *Yields Heartwood*; the player's 3/2/1 shown where the board tells them
   their material today; re-seating after the reset without asking for the
   name again.
7. **Numbers.** The pacing harness: supply per deposit against the price
   curve; set `perDay`; early prices (levels 4–5, Atlas cards) in
   `?dev=data`, the three materials asked for equally.
8. **Art.** Three deposit hexes and three district sprites, ChatGPT, in the
   board's style (`Docs/art/` pipeline).
9. **Docs.** 19 §7.4–§7.6 rewritten; 17's note on precious goods; this plan
   marked built.

**Server:** steps 5 and later ship with a release (migration-free — boards
are documents — but the world function and the reset go first).

## 3. Phase 2 — a world of seven boards

Decided with the user on 2026-10-06, after 0.10.0 shipped.

### 3.1 The design

- **A world is seven mini-boards**: one in the middle and six round it, in
  a honeycomb — 42 seats, 889 hexes. To the player it is one board: hexes,
  claims, armies, explorers and fog run across the seams as anywhere else.
- **Every mini-board is today's board**: its own Portal at its centre, its
  inner ring of deposits, its six seats and wedges, its own 3/2/1 bag and
  its own roll (a seed of its own, from the world's).
- **The seams are left rich**: where two mini-boards touch, their outer
  rings lie side by side — twice the dungeons and sanctuaries, a frontier
  two neighbourhoods contest.
- **Seating, mini-board by mini-board**: a world is born with rivals in all
  42 seats; a new player takes a rival's seat in the mini-board with the most
  players that still has one (the middle one first). When no rival is left,
  a new world opens.
- **Everything is the world's**: one Portal ranking across all seven
  Portals (a player dives any Portal their army reaches), the dungeon races
  and the raids as today but over the whole world.
- **Navigation**: the strategic zoom opens out to the whole world, and a
  **minimap** in a corner shows the world, every kingdom's ground and the
  camera's frame; a tap there moves the camera.
- **A fresh world** when it ships, by the 0.10.0 mechanism.

**Built** (steps 1–6 below). Two things learnt on the way:

- A rival's size is the ground it holds now: in a world of 41 rivals, one
  whose ground was taken grows again rather than standing empty.
- With the whole world revealed, the strategic zoom is crowded with labels;
  the camera stops at one board across and the minimap shows the world.
  Thinning the labels at the far zoom is still to do.

### 3.2 Steps

Each step keeps the game playable; a world of ONE mini-board is the game
of 0.10.0 until step 4 turns on seven.

1. **Geometry.** One world geometry — every hex in world axial coordinates,
   the world index, each hex's mini-board and its local ring and wedge,
   the seats (42), the Portals (7) — in place of `BOARD_RADIUS`,
   `BOARD_HEXES`, `SEAT_INDICES`, `PORTAL_INDEX` and the ring maths that
   assume one centre. Built for N mini-boards, run with one.
2. **Generation.** The world is its mini-boards, each generated as today on
   local coordinates from its own seed and placed at its offset; the bag
   and the inner ring per mini-board.
3. **Server.** The world document: 42 seats, seating by mini-board, seven
   Portals and one ranking, dungeons and their races per sixth (42 of
   them), bots, raids; the fog bits sized for the world.
4. **Seven.** The world grows to seven; the client's camera, clouds,
   layout and renderer read the world's bounds; seat colours for 42.
5. **Minimap.**
6. **Fresh world** (store version 5, a migration) and **docs**
   (19 rewritten for a world of seven).
