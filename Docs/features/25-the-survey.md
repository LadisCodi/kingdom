# 25 · The Survey — a ladder that pays for exploring

> **Scope.** The kingdom's **Survey**: one ladder over the whole province,
> climbed by the cells revealed, with a free column and a paid one. It is what
> the game sells of its column, the treasure hunt in the fog
> ([`../overview.md`](../overview.md) § *The fantasies*). The other ladder
> is the season pass ([`20-season-pass.md`](20-season-pass.md)).
>
> **Status: designed 2026-10-02, not built.**

## 1. Shape

- **One ladder for the whole province**: its levels sit at counts of revealed
  cells, the last at the province bought out.
- **Two columns**, free and paid. The paid column is one purchase, `Survey`,
  **$9.99, once per kingdom**.
- **It never resets and never expires.** A level reached stays reached.

**The split against the season pass**, one sentence each:

| Ladder | Climbs on | Pays for |
|---|---|---|
| The season pass | mission XP | playing |
| **The Survey** | **cells revealed** | **exploring** |

## 2. What climbs it

- **Every revealed cell of the province counts**, whatever revealed it: a tap,
  a building's ground, a claim.
- The count only rises: a revealed cell never goes back to fog.
- Cells of a temporary province ([`13-events.md`](13-events.md) §2.3) and
  hexes of the world map do not count.
- **Nothing else climbs it.** No level is ever sold, and nothing skips one.

## 3. The ladder

**36 levels**, dense at the start and spread out where the fog is dear:

| Levels | Cells revealed |
|---|---|
| 1–9 | every 10, from 20 to 100 |
| 10–19 | every 20, to 300 |
| 20–29 | every 50, to 800 |
| 30–35 | every 100, to 1,400 |
| **36** | **the whole province** |

- **Every cell of both columns pays something.** No rung is empty.
- Rewards follow the house rule: Gold and materials are **hours of the
  kingdom's own production**, never amounts.

| Column | Pays |
|---|---|
| Free | production chests, Knowledge, Green and Yellow packs, silver keys; a gold key every fifth level |
| Paid | Gems, gold keys, Gold and Star packs, Stardust, Hero XP — on every level |
| **Level 36, both** | the grand prize: the free column's gold keys and Gems, the paid column's Star packs and a pile of Gems |

## 4. Claiming

- **Every cell is its own claim**, out of order, at the player's pace; no
  claim-all, as on the season pass.
- **Buying the Survey opens every level already reached**: a column of cells
  to tap, not a payout.
- **A level reached is a moment on the map**: the reveal that crosses it
  sends a small seal from the cell to the Survey's pill, which glows while a
  cell waits.
- A pack opens itself in the card reveal ([`09-relics.md`](09-relics.md) §6).

## 5. The door

- **The Survey opens with the Store**, when the Townhall reaches level 2
  ([`22-progression.md`](22-progression.md) §3). Its pill appears on the map
  with the levels the kingdom has already reached waiting in it.
- Its introduction is Isolde's ([`23-tutorials.md`](23-tutorials.md) §4.1).
- **A kingdom saved before this design** opens it with every level its cells
  have reached.

## 6. The screen

- **One sheet, the season pass's ladder**: two columns on the same rows, the
  paid column's head the buy button while the Survey is unbought.
- Above the ladder, **the province**: cells revealed out of the whole, and the
  next level's count.
- A cell is a button exactly when it can be taken. One padlock per cell.

## 7. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| The levels, in cells revealed | §3 | `survey.levels` › `cells` |
| What each level pays, both columns | §3 | `survey.levels` › `free`, `paid` |
| The paid column's price | **$9.99** | `store` › `Survey` |
| A production chest | hours of the kingdom's production | `survey.levels` › `free` |

## 8. Deliberately not in this design

- **A season.** The province is finite and its fog dearer every ring; a reset
  would slow the ladder exactly when the player plays most.
- **A level for sale**, a reveal for sale, or anything that climbs it but
  revealing.
- **Instant reveals as a product** (the Fog charter is cut): the Survey sells
  what exploring finds, never a way round exploring.
- A second paid tier above the paid column.
- Counting the world map or a temporary province.

**Open questions:** OQ-121 in [`../open-questions.md`](../open-questions.md).
