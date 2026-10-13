# Relics, Shrines and Chapels — UI/UX

> **Scope.** The screens of
> [`../proposals/relic-restoration.md`](../proposals/relic-restoration.md)
> outside the Bag: a relic's sheet, the Shrine on the province map, the Chapel
> on the world board, the areas they draw, trading, and the Excavation. The
> Bag and its Relics tab are [`ui-inventory.md`](ui-inventory.md). Built from
> the shipped kit ([`ui-menus-redesign.md`](ui-menus-redesign.md) §7.17).
>
> **Status: built, but for the Excavation.** Mockups M67, M68, M72
> ([`ui/mockups/relic-restoration-prompts.md`](ui/mockups/relic-restoration-prompts.md),
> [`ui/mockups/inventory-prompts.md`](ui/mockups/inventory-prompts.md)).

## 1. Where each thing is done

| The player wants to | Where |
|---|---|
| see their relics and fragments | the Bag, **Relics** tab (M72) |
| restore, level, host, forge a replica, buy a map | the **relic sheet** (§2), from a relic card |
| see what a Shrine does, swap its relic, cast | the **Shrine card** (§3), from a tap on the Shrine |
| place or move a Shrine | placement mode, with its aura drawn (§3.2) |
| build a Chapel, host a world relic, cast | the **world hex sheet** (§4) |
| send and ask for fragments | the **wanted board** (§5), from a relic sheet or the world |
| dig | the **Excavation** (§6, M68) |

- **One verb, one place.** A relic is hosted from its sheet *or* from its
  host's card; both open the same host picker (§2.2).

## 2. The relic sheet

Opened from a relic card in the Bag. A full-screen menu (header plank kept,
title plank with the relic's name, close knob). Its layout is **M67's lower
panel**, grown to the screen:

- **The relic, large**, in its six slots: found shards set, missing ones as
  chalk outlines, the keystone centred and larger; a blue seal with its level.
- **What it does**, one line each, in ink with an icon:
  - the passive with its number at this level and the next: *Houses pay +18%
    → +20%*;
  - the active, its Mana cost and its cooldown;
  - *Found in: lairs, mountains* — where its fragments drop.
- **Spares**: the count, with the shard icon.
- **One primary button**, by state:

| State | Button |
|---|---|
| fewer than six distinct | **Forge** (a replica, when one is missing) — two buttons: wood *Forge — 12 spares* and green *Forge* with *3 spares + 3,000* and the blue gem inside it |
| six distinct, not restored | green **Restore** |
| restored | green **Level up** with *4 spares* inside it; under it, the host line (§2.1) |

- **Under it, two wood buttons**: *Dowser's map* (with the map count) and
  *Ask the board* (§5).

### 2.1 The host line

- Restored relics show where they are: a parchment row with the host's icon
  and name — *Shrine of the North Field* / *Chapel · Logging Camp* — and a
  wood **Change** button; or *Not hosted* with a green **Host**.
- **A city relic shows Shrines, a world relic Chapels.** Never both.

### 2.2 The host picker

- A centred sheet, title *Host Gilded Ledger*.
- **Rows**, one per host of the right kind: the host's name, a mini-map chip
  of where it stands, and what it holds now (*empty* or the relic's icon).
- Picking an empty host hosts it. Picking a full one shows **one line** —
  *The Dowsing Rod goes back to the Bag* — and the green **Swap**.
- At the bottom, when the player has no empty host: one line *Repair a Shrine
  in the fog, or build one for Gems* with a wood button to the premium Shrine.

## 3. The Shrine on the map

- A 2×2 building with its own art; **the hosted relic floats over it**, small,
  turning slowly, with the relic's glyph — the map says *which* relic, not just
  *a* relic.
- **A Shrine ruin in the fog** is a silhouette like the abandoned buildings;
  revealed, it is repaired like them, with the same card and **Repair**.

### 3.1 The Shrine card

The building card (M2 pattern), with:

- the hosted relic's icon, name, level, and its passive in one line;
- a **Change** button (the host picker, filtered to city relics in the Bag);
- the **active**: a green **Cast** with its Mana cost inside it, or the
  cooldown wheel and time left;
- *Aura: radius 2 · Level up for 3* and the usual **Upgrade** of a building.

### 3.2 The aura

- **Drawn when it matters, never always**: when the Shrine card is open, while
  the Shrine is being placed or moved, and while its active runs.
- **Gold**, not violet: violet is a running spell (09 §11.6) and stays so. The
  aura is the existing area overlay (`drawArea`) in warm gold, its border
  tracing the outside of the area.
- **While placing or moving**, every building the aura would touch gets a
  small gold **+** over its roof; the ones it would leave lose it. This is the
  read that makes moving a Shrine a layout decision.
- **Overlap**: where another Shrine with the same relic is stronger, its cells
  keep their own border; the moving Shrine's tint stops there.
- **The active** draws the violet zone of 09 §11.6 on the aura's cells, the
  wheel on the Shrine. Moving the Shrine ends it, with a short toast: *Haste
  ended — the Shrine moved*.

## 4. The Chapel on the world board

- **A district's hex sheet** gets a second upgrade row under the Fortress:
  **Chapel** — its Gold price, the builder, **Build**.
- A Chapel stands as a small chapel at the hex's rear corner (the Fortress
  keeps the other); a hosted relic floats over it, as in the city.
- **Its area** is the hex and its six neighbours, drawn as a gold ring of hex
  edges when the sheet is open.
- The sheet's Chapel row: the relic's icon and passive, **Change**, and **Cast**
  with its Mana cost — the first Mana price on the world, so the Mana gauge is
  shown on the sheet beside it.
- **Count**: the row says *Chapels 2 / 3* — held / allowed by the hexes held.
- **A rival's Chapel** shows its relic over it to everyone; its hex sheet reads
  the relic and its level, and nothing else.

### 4.1 Losing it

- A conquest or a denial of a hex with a hosted Chapel adds one line to the
  battle report: *The Bailiff's Tally came home*.
- The relic's card in the Bag shows *Not hosted*; the Bag's tab dot lights.

## 5. Trading

### 5.1 The wanted board

- A centred sheet, opened from a relic sheet's *Ask the board* or a world
  button. Title *The board's wants*.
- **Your pins**, up to three: the fragment's icon in a pinned parchment card,
  a red pin, a tap to unpin. A **+** card opens a picker of missing fragments.
- **The board's pins**: a row per rival — portrait, nickname, their pinned
  fragments. A fragment the player holds a **found spare** of shows a green
  **Send**; bound spares never count.
- *Sends today 1 / 3* at the top.

### 5.2 The envoy

- **Send** dispatches an envoy: a small figure with a satchel marches on the
  world board from the player's city to the rival's, like an explorer, with a
  chip on the city: *Envoy · 1h 20m*.
- Arrival is a toast for the receiver at next load: *Mirelle sent you a piece
  of the Verdant Seal*, and the fragment flies to the Bag's door.

## 6. The Excavation (M68)

- **On the board**: the dig site on its hexes, a plank with the site's name
  and time left, a brass pickaxe medallion over the next diggable hex.
- **The event sheet**, docked above the nav beam: *The board* (shared bar,
  three chests, six portraits), *Your dig* (free and *Pass* rows, the new relic
  at the end of the free row, a green *Pass* with its price inside), the tools
  count with a green **+**, and a big green **Dig**.
- **Dig** spends one tool on the hex under the medallion; the earth falls
  away, what was there flies to the sheet. The next medallion moves to the
  next hex.
- **The board's bar** moves when a rival digs; its tick is the next load.
- When the site closes: a banner over the map, the last chest opened for
  those who dug, and the relic's fragments join the drops.

## 7. Mockups

| # | Screen | File |
|---|---|---|
| **M67** | a relic's sheet — **its lower panel**; its plinth wall is superseded by the Bag's Relics tab | `ui/mockups/m67-reliquary.png` |
| **M68** | the Excavation | `ui/mockups/m68-excavation.png` |
| **M72** | the Bag, Relics | `ui/mockups/m72-bag-relics.png` |

Not mocked yet: the host picker, the Shrine card with its aura, the Chapel row,
the wanted board.

## 8. Deliberately not in this design

- The aura drawn all the time.
- A relic hosted by dragging it onto the map.
- A trade screen with offers or counter-offers.
- The Excavation as a separate full-screen map.
