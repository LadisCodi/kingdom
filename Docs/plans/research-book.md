# The research book — UX

> **Scope.** The research screen and its technology sheet, redesigned for
> research without time: pour Knowledge, pay the rest, researched at once
> ([`../features/07-research.md`](../features/07-research.md) §1, §3). The
> reference is Elvenar's research screen and sheet; the look is a page of a
> magic book with its sections as bookmarks (Heroes III's spellbook).
>
> **Status.** Proposal, for mockups M37–M39. Folds into
> `07-research.md` §5 and `ui-menus-redesign.md` §5.9 once chosen.

## 1. The flow

A technology goes through four states, and the screen shows which one each
is in without opening it:

| State | What the player does next | The card shows |
|---|---|---|
| **Locked** — a requirement missing or its band shut | nothing; read what it needs | drained of colour; the band's bar says how many cells are left |
| **Pouring** — requirements met, Knowledge short | pour Knowledge into it | a Knowledge bar **poured / needed**, e.g. `3 / 8` |
| **Ready** — Knowledge full, Gold to pay | pay the Gold | the bar full with a tick, and the card lit — the one thing on the page asking to be pressed |
| **Researched** | nothing | a gold seal; the bar gone |

- The three steps the player takes: **1. pour** until the bar is full, **2.
  pay** the Gold, **3. it is researched at once** — no wait, no slot.
- Pouring is **per point or all at once**: most taps are "all I have", but a
  bar of 10 shared between several technologies wants the single point.
- **Buying the gap** — the points the bar cannot cover — is one press in Gems
  or in Gold, and pours them straight in.

## 2. The book

- The screen is **one page of an open magic book**: yellowed parchment inside
  a tooled leather cover, the page's edge visible, as if the book lies open
  under the header.
- **Each tome is a bookmark**: a cloth ribbon tucked into the page's top or
  bottom edge, in its own colour with its own emblem (Civics — the scroll,
  Warfare — crossed swords, Magic — the orb). The open tome's ribbon is pulled
  out further and lit; the others sit flush. A found book adds a ribbon.
- **An era is a chapter** inside the page, not a bookmark: an illuminated
  heading across the page (*Civics — Chapter II*) where the band begins, with
  the cells still to reveal written under it while it is shut. The page scrolls
  down through the chapters.
- The plank carries **Gold and Knowledge**, the two halves of every price on
  the page.

## 3. The page

- **Three columns** of cards, a row at a time, with inked connectors in the
  gutters (the layout of §2.2, unchanged).
- **A card**: the technology's emblem, its name, and the **Knowledge bar**
  `poured / needed` along its foot. Ready: the bar full and a tick, the card
  glowing. Researched: a gold seal over the emblem and no bar.
- A connector that leads out of a researched card is **gold ink**; the rest
  are sepia.
- The `?` silhouette of the fog stays: a fold in the parchment, one step
  ahead.
- On open the page lands on **the work**: a Ready card, then a Pouring one,
  then the last one researched.

## 4. The sheet

A centred sheet over the page, the page blurred behind it.

1. **Header**: the emblem, the name (with its rank numeral), the ✕.
2. **What it gives**: the generated line, and what it unlocks as pictures — the
   building's sprite, the unit's portrait — or for a rank, **before → after**.
3. **Requirements**: the medallions of what it needs, ✓ / ✗, tappable.
4. **Knowledge**: the bar, **poured / needed**, and under it the pours, side
   by side, each a price on its button:
   - **+1** — one point from the bar;
   - **+N** — all the bar holds, up to what is missing (the N is live);
   - **Buy the other M**, when the bar cannot cover the gap — two buttons, the
     M points in **Gold** and in **Gems**, poured the moment they are bought.
5. **Cost to research**: the Gold, as a price tile.
6. **Research** — one wide button, lit only when the bar is full and the Gold
   is there; it researches on the press.

- One reason for the whole sheet when a requirement or a shut chapter stops
  it; affordability is the red on a price, never a sentence.
- The sheet stays open after a pour, so the bar can be watched to fill; it
  closes itself after Research, with the completion banner.

## 5. Deliberately not here

- A Gem "research now" that pours, buys and pays the Gold in one press — Gems
  never pay the city's Gold (07-research.md §1).
- Attempts or cooldowns on pouring.
- Eras as bookmarks: they are the page's chapters, and the page is one scroll.
