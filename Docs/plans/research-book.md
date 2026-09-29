# The research book — UX

> **Scope.** The research screen and its technology sheet, redesigned for
> research without time: pour Knowledge, pay the rest, researched at once
> ([`../features/07-research.md`](../features/07-research.md) §1, §3). The
> reference is Elvenar's research screen and sheet; the look is a page of a
> magic book with its sections as bookmarks (Heroes III's spellbook).
>
> **Status.** The tree is M43; the sheet is being mocked (M44). M37–M42 were
> the rounds before. Folds into
> `07-research.md` §5 and `ui-menus-redesign.md` §5.9 once chosen.

## 1. The states

Every technology is on the page from the first minute — **there is no tree
fog**: nothing is hidden and nothing is a `?`. What varies is what the
player can do with it, and a technology is in exactly one of three states:

| State | When | The card shows |
|---|---|---|
| **Undiscovered** | a requirement is not researched, or its chapter is shut | **greyscale** — the same card, drained of colour, a padlock at the end of its bar; readable, never pressable to pour |
| **In progress** | every requirement researched and its chapter open | full colour, and the Knowledge bar **poured / needed**, e.g. `5 / 8`. **Full** is still this state, lit: the bar full and glowing, the one card on the page asking to be finished |
| **Completed** | researched | a tick on a full green bar; its connectors inked gold |

- The steps the player takes: **1. pour** until the bar is full, **2. pay**
  the Gold, **3. it is researched at once** — no wait, no slot.
- Pouring is **per point or all at once**; **buying the gap** is one press in
  Gems or in Gold, and pours straight in.

## 2. The book

- **One page, never a spread.** The screen is a single sheet of parchment
  centred on the screen, lying on a small stack of papers behind it, so on a
  tablet it is the same object centred on a wider screen — there is no second
  page to explain.
- **The nav bar is gone while the book is open**, and **the bookmarks take its
  place**: one ribbon per book, hanging from the bottom edge of the page into
  the space the nav bar leaves. The open book's ribbon is pulled out further;
  a book not found yet is a ribbon with a padlock.
- An **era is a chapter**: a heading across the page where the band begins —
  *Chapter II* — with *Reveal 14 more cells* under it while it is shut. One
  vertical scroll through the chapters.
- The plank carries **Gold and Knowledge**.

### 2.1 Built from reusable pieces

The book must grow by data, not by art: a new book, a new chapter or a new
state costs no new sprite.

| Piece | One asset, reused as |
|---|---|
| **The page** | a nine-sliced parchment sheet; the stack behind it is the same sheet twice, offset and rotated a few degrees |
| **The bookmark** | one ribbon, nine-sliced vertically and **tinted per book** in CSS, the book's emblem (an icon from the atlas) stamped on it |
| **The chapter heading** | one ornament line either side of the text |
| **The card** | one plate, nine-sliced; the greyscale state is a CSS filter, not a second plate |
| **The bar** | the kit's progress bar (`progress()`), the same one everywhere |
| **The sheet's areas** | the kit's `.k-section` tiles |

## 3. The page

- **Three columns** of cards, a row at a time, with plain inked connectors in
  the gutters (§2.2 of the research doc).
- **A card**: a title plate with the name, the emblem at the left and the
  Knowledge bar at the right, the numbers on the bar — Elvenar's card, cut to a
  third of a phone.
- On open the page lands on **the work**: a full card, then one in progress,
  then the last completed.

## 4. The sheet — three parts, read top to bottom

A centred sheet over the page, the tree darkened behind it. Three parts, one
below the other, in the order the player works through them — a way to order
the sheet, never numbered on it:

1. **About** — laid out like the top of a building card, without its upgrade
   button: the technology's emblem in its framed picture, the name, and one
   plain sentence of what it unlocks or does.
2. **Knowledge** — the kit's blue progress bar, poured / needed, the numbers
   inside it; under it **three buttons with the price on the button**:
   - **Gems** — buys the Knowledge still missing and pours it;
   - **+1** — one point from the bar;
   - **+N** — as much as it can: the least of what the bar holds and what is
     missing.
3. **Research** — the upgrade popup's block: the Gold **above** the button, a
   wide **Research** button, and while the Knowledge is short the button is
   disabled with a line under it: *Assign all its Knowledge to research it*.

- An undiscovered technology's sheet shows part 1 and what it needs; parts 2
  and 3 are disabled with the reason.
- The sheet stays open after a pour; it closes itself after Research, with the
  completion banner.

## 5. Deliberately not here

- A Gem "research now" that pours, buys and pays the Gold in one press — Gems
  never pay the city's Gold (07-research.md §1).
- Attempts or cooldowns on pouring.
- Eras as bookmarks: they are the page's chapters, and the page is one scroll.
- **Tree fog** — the `?` silhouettes and hidden cards: every technology is on
  the page, greyscale until it can be worked on.
- A two-page spread: it has no answer on a tablet.
- Art made for one book or one state: tint and filter the shared pieces.
