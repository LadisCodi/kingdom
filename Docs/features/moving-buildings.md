# Moving buildings, and dragging the ghost

**Built 2026-09-02.**

A building could be placed and never moved again. Every mistake was permanent,
which is a strange rule in a game whose first promise is that *nothing you own
is ever taken from you* — a house in a bad spot is a loss you took and cannot
undo, and the only remedy was to leave it there.

Two changes, one gesture between them:

1. **A Move button on the district card**, which enters a targeting mode.
2. **The placement ghost is draggable**, for a new building and a relocated
   one alike. It was pan-only before: the ghost could be tapped to a new cell
   but never carried to one.

---

## 1. The rule

> **A move is free, instant, and it never fails halfway.**

Free because the alternative is a tax on tidying up. It is also what the
comparable games do — Clash of Clans and Everdale both move buildings for
nothing — and a priced move would be a new Gold sink to balance against the
tree, the fog and the upgrades, for no design gain.

Instant because there is nothing to build. The building never leaves the
`Built` state, never enters the queue, never stops paying taxes or working its
cells.

A move gains the player nothing *directly*. What it changes is **position**,
and position is already priced by everything that reads it: housing adjacency,
influence radius, worker walking distance, the fog the building pushes back.
That is the whole design — the move itself is free precisely because it is
never free of consequence.

## 2. What may be moved

`canMoveDistrict` (`src/sim/districts.ts`) has two gates:

- **Built only.** An unfinished building's duration is measured from the
  Townhall (`buildDurationForCell`), so relocating one mid-build would
  silently reprice the wait. Its card already offers **Cancel**, which is a
  full refund, so nothing is lost by excluding it.
- **`buildable` only**, which is exactly the Townhall's exclusion. It is the
  origin every fog ring, every build duration and every worker distance is
  measured from; moving it would reprice the whole world without saying so.
  No new flag was added for this — `DistrictDef.buildable` already said it.

## 3. Where it may go

`placementBlock` takes an optional `movingId`, and it changes **two rules and
nothing else**:

| Rule | Building | Moving |
|---|---|---|
| `Occupied` | any district blocks | the mover does not block *itself* |
| `CountLimit` | applies | does not — a move adds nothing to the count |

Everything else — terrain, features, sites, fog, tech, shoreline, housing
adjacency — is the same question it is at build time. **A spot you may not
build on is a spot you may not move to.**

The self-overlap exception is what makes a one-cell nudge possible at all;
without it nothing could ever move by less than its own footprint, which is
most of the moves a player actually wants. The housing-adjacency rule gets the
mirror of it: a house may not anchor its own move on itself, because standing
next to where you already are is not neighbourliness.

## 4. What follows the building

- **Adjacency** is computed from locations on read, so it just follows. But
  the move runs inside **`repriceTaxAnchorAround`**: moving a house in or out
  of a neighbour's range changes the city's gold rate *at that instant*, and
  the tax anchor has to be settled then or the player is paid the new rate for
  time already elapsed at the old one. Same mechanism a completed build uses.
- **The fog**: the new address calls `revealAroundDistrict`, exactly as
  finishing a build does. Otherwise a building could be walked to the frontier
  and sit there staring at ground it has already paid to see.
- **The crew** (`relocateCrew` in `workers.ts`) splits two ways, and the split
  is the point:
  - a worker **carrying** a load keeps its claim and simply walks to the new
    address — the deposit still lands on arrival, so a move never costs the
    player a trip already worked for;
  - a worker **not** carrying releases its claim and goes Idle, because the
    cell it was walking to may be outside the new influence radius.
    `tryDispatch` then picks one that is in range.

## 5. The two gestures

**Tap** a legal cell to send the ghost there. **Drag** the ghost to carry it.

The gesture split is decided **once, at `pointerdown`** (`render/input.ts`): if
the press landed inside the ghost's own footprint, the drag moves the ghost;
otherwise it pans the camera. Deciding on press is what stops the two
fighting mid-flick — hit-testing every move would hand the ghost off to the
camera the instant the finger left it. It also means the rest of the world
stays reachable while a ghost is out: the ghost is a thing you put your finger
on, not a mode that captures every drag.

Two details that are easy to get wrong:

- **The anchor follows the finger by CELL, not by pixel offset**, and an
  illegal cell is simply not taken. Dragging across a lake leaves the ghost on
  the shore rather than following the finger somewhere it would snap back
  from — the ghost is always showing where a release would actually put it.
- **A press on the ghost never starts the hold-to-collect timer.** There is
  nothing under a ghost to harvest, and the timer would only race the drag.

The same code serves a **new** building being placed. That was the smaller
half of the change and the more visible one: placement was tap-only before.

## 6. What the player sees

- **A ✥ knob on the district card**, above Close. Moving is not an upgrade
  path, so it does not belong in the footer's one-primary-action slot (§2.2 of
  `ui-menus-redesign.md`) — it is something you do *to* a building rather than
  something you buy *for* it, and being free it carries no price to show.
  Close stays last in the column so its position never shifts.
- **The placement bar, reused.** Same bar, because it is the same decision:
  *is this a good spot*. A move differs in three words — the button says
  **Move here**, and there is no price and no wait. The empty space where the
  hourglass would be is the message.
- **The building draws faint at its old address** while its ghost is out
  (`liftedDistrictId`, alpha 0.28). Without it the player sees two of the same
  building and no way to tell which one is real.
- **Cancel, and dropping it home, both mean the same thing.** Confirming a
  move to the cell it started on is treated as a cancel, not an error: the
  player dragged it around, changed their mind, and put it back.
- **Confirming reopens the card** it was started from — the building you just
  repositioned is very likely the one you still want.

## 7. Not done

- **No undo.** A move is instant and free, so the remedy for a bad move is
  another move. That is fine while moves are free; it stops being fine the
  moment anyone prices them.
- **Multi-select.** Moving a row of houses one at a time is tedious once a
  city is large. Nothing here forecloses it.
- **The refusal is silent.** Dragging onto ground the building may not occupy
  leaves the ghost where it was, and the only feedback is the green outline of
  the cells that *are* legal (drawn for restricted buildings only — Housing,
  Farm, FarmLands, Docks). For an unrestricted building there is no outline to
  read, so a refused drag looks like a dropped gesture. Worth a playtest.
