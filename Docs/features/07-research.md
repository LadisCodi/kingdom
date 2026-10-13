# 7 · Research — the tree, its chapters, and the Knowledge bar

> **Scope.** The research **system**: technologies, the tree and the found
> books, the chapters, the Knowledge bar that pays for them, buying
> Knowledge, the Knowledge ↔ Stardust split, the research screen, and why the
> tree holds no spells. The **content** — every card, its price and its
> chapter — is [`tech-tree.md`](tech-tree.md).
>
> **Status.** Built: one tree, **Kingdom**, in nine chapters, and two found
> books, **Sagas** and **Atlas**, each opened by a fact about the world (§2);
> one page per book with its chapter bars; pouring and instant completion
> (§1); the climbing bonuses (§1.2); relic fragments for a finished chapter
> (§2.1); the Knowledge bar (§3) and buying Knowledge (§3.2). The shape is
> authored in `?dev=data#tree` ([`../tech-tree-editor.md`](../tech-tree-editor.md)).
> Designed, not built: guild investment (§8).

## 1. Technologies

- A technology is a one-time research that unlocks content — a building, a
  building level, one more of a building, a unit, a unit's rank, a harvest
  source, a terrain, a world building — or moves a number.
- **A technology is one object** in `src/sim/data/tech-tree.json`, authored at
  `?dev=data#tree` ([`../tech-tree-editor.md`](../tech-tree-editor.md)): its
  name and icon, its kind, what it unlocks or moves, its price, its slot on
  its book's page and what it requires.
- **What a technology says is generated from what it does**
  (`src/sim/techProse.ts`): from its `unlocks`, or one sentence per effect
  from the stat registry. Only a `mechanic` carries written prose.
- **Every technology is one of three kinds:**

| Kind | What it does | Authored |
|---|---|---|
| **`unlock`** | opens content, and names it | fully — one entry per thing it opens |
| **`bonus`** | moves numbers, and names them (`effects`) | fully — one entry per number it moves |
| **`mechanic`** | something the sim reads by id — `Tactics` softening a bad matchup, `Transplanting` letting a tree be moved | its prose only; the code does it |

- **The technology says what it opens; every gate is derived from that**
  (`GATES`, `src/sim/data/definitions.ts`). Two technologies claiming one gate
  is an error.
- **Price: Knowledge, then Gold. There is no research time.**
  - **Knowledge is poured in.** `Invest` moves Knowledge from the bar into the
    technology — as much as the bar holds, up to what is still missing — on as
    many visits as it takes (§3).
  - **The rest is paid once, when the Knowledge is full**, from the **city**
    purse: the Gold, and on some cards Wood, Stone and Food (the Atlas's first
    four), refined goods (from chapter 5) and precious materials — named, or
    "any precious", taken from what the city holds most of
    ([`19-world-map.md`](19-world-map.md) §7.6). **No precious material is
    asked while the Watchtower is unrepaired.**
  - **Paying completes the technology at that instant.** Nothing is under
    study, so research has no boundary source.
- **Poured Knowledge stays in its technology** for ever: never returned,
  moved or lost.
- **Any number of technologies may hold poured Knowledge at once.** There are
  no research slots.
- Pouring needs what researching needs: the book open, every requirement
  researched and the chapter open (§2.1).
- **Every card costs Knowledge and Gold**; the rules refuse one that costs no
  Knowledge.
- A card requires one to three cards, all on the row immediately above it,
  in its own book. A card on a page's first row requires nothing.
- **Gems never complete a technology.** They buy Knowledge (§3.2), which is
  poured like any other ([`14-monetization.md`](14-monetization.md) §1).
- The card count and the price of each chapter are in
  [`tech-tree.md`](tech-tree.md) §1.

### 1.1 Majors and minors

| Band | What it does | Price |
|---|---|---|
| **Major** | unlocks content | expensive |
| **Minor** | one numeric step; carries a roman numeral (`Sawpits I → II → III`) | cheap |

- A **rank ladder** is a naming convention — a stem plus a roman numeral —
  not a field and not a chain: rank II does not require rank I and need not
  sit near it. The numerals may not skip one.
- A ladder may **ramp**: each rank carries its own value.
- A rank costs Knowledge and Gold like any other card.

### 1.2 What a bonus moves

A `bonus` names its effects, each four fields:

| Field | What it says |
|---|---|
| `stat` | which number, from the registry (`src/sim/data/techEffectRules.ts`) |
| `op` | `percent` or `flat`, as the stat allows |
| `value` | **positive**, in whole points for a percent — `10` is +10% |
| `target` | what it aims at: a district, a unit, a unit tag, a harvest source, a tome, a kind of world district. Absent = every subject of that stat |

- **Every bonus climbs** ([`22-progression.md`](22-progression.md) §9):
  - a `value` is never negative; the rules refuse one;
  - a **wait** is moved by a **speed** the time is divided by, so no stack of
    ranks reaches zero;
  - **nothing discounts a price**; the tree makes the kingdom produce more;
  - a **yield** is a percentage of what the ground gives (`harvestYield`,
    `crewYield`); the fraction **carries** to the next strike, per worker
    (`Worker.strikeCarry`) and per currency for the thumb (`tapCarry`);
  - `flat` is for whole things: a bed, a ring of sight, a slot.
- A stat may **narrow which ids of a kind it accepts** where only some have
  the number (a regrowth bonus cannot aim at the berry bush, which is
  consumed). The narrowing is derived from the `harvest` data.
- A total is the **sum over completed technologies** whose effects match
  `(stat, target)`. An unaimed effect reaches every query of its stat; an
  aimed one only its target.
- Effects apply as a three-stage pipeline: base → **the completed
  technologies** (`src/sim/techEffects.ts`) → the modifier stack.
- **A new kind of bonus is data**: "+5% gold at Housing" is a stat and a
  target. A new *number* is code: one registry entry plus the call site that
  owns it.

### 1.3 Planned nodes

- A card may carry `planned: true`: on the page, researchable, doing nothing
  yet; its sheet says *Not yet in the prototype*.
- The shipped tree has none.

## 2. The shelf — one tree and the books you find

| Book | Kind | Opens when | Remit |
|---|---|---|---|
| **Kingdom** | the tree | from the first minute | everything the kingdom learns, in nine chapters |
| **Sagas** | found | a **Tavern** stands | heroes, and the Tavern that hosts them |
| **Atlas** | found | the **Watchtower** is repaired | the world board |

- **One tree** holds the city, the army and the magic, mixed in every chapter.
- **A found book opens on a fact about the world, never on a research**, and
  is open for ever after (`sim/research.ts` `TOME_OPENS`). A card in a shut
  book answers `TomeClosed`. A found book has no bookmark until it is found
  ([`22-progression.md`](22-progression.md) §3).
- **`TomeId` is the set of books in `tech-tree.json`**; what opens one is code.
- **A book is one page**, read top to bottom: three columns of cards, a
  chapter bar across the width wherever the next chapter begins (§2.2).
- **Nothing is granted and nothing is free.** A fresh kingdom has an empty
  `completed`.
- **No edge crosses books.**

### 2.1 Chapters

- **The tree's bands are its chapters**, one per Townhall step: chapter *n*
  runs from Townhall *n* to *n + 1*. Each chapter's cells and reward are in
  `tech-tree.json` (`eras`, `eraRewards`).
- **A chapter opens on revealed cells** (`eras`). A card in a shut chapter
  answers `EraLocked`, and the bar says how many cells are left. Each count
  fits inside the reach of the Townhall that opens the chapter
  ([`01-map-and-fog.md`](01-map-and-fog.md) §4).
- **A chapter ends in one finale**, alone on its last row, that opens the next
  Townhall level (`Forestry` → 2, `Bureaucracy` → 3, `Magistracy` → 4,
  `Charter` → 5, `Exchequer` → 6, `Chancery` → 7, `Dominion` → 8,
  `Sovereignty` → 9, `GoldenAge` → 10). The next chapter's first row requires
  it, so chapters are read in order.
- **The spine is required; the rest is optional.** The spine is every card
  that leads, in the end, to the finale. A card nothing below requires is a
  dead end.
- **Researching every card of a chapter, dead ends included, pays relic
  fragments**, once (`research.rewarded`): the chapter's `eraRewards` count,
  each a fragment of a relic the kingdom has already met
  ([`09-relics.md`](09-relics.md)). Chapter 1 pays none.
- The count is **paid reveals only** (`revealedCellCount`) — the same count
  the `DiscoverCells` quest goal follows.
- The gate is a state condition, not a timer: no boundary source, and it is
  never bought directly — only by clearing fog.

### 2.2 The page

- **Which book and chapter each card is in, its slot and what it requires**
  are authored in `?dev=data#tree` and live in `tech-tree.json`.
- A page is **three columns** wide and as many rows tall as the book needs.
- **A row is depth.** Every requirement sits on the row immediately above
  the card that needs it.
- **A chapter's last row holds exactly one card**, its finale.
- **Every technology has a slot, ranks included.**
- A card is 120 × 108 px (`src/ui/research/layout.ts`).
- **A connector never crosses a card, by construction.** It runs down its own
  column while that column is empty and crosses in the gutter between two
  rows; otherwise it steps out into a side channel down the outside of the
  page. The edge from a finale to the next chapter's first row passes under
  the chapter bar.
- `src/sim/data/techTreeRules.ts` is the one statement of a legal tree,
  checked by the editor, by the save endpoint and by `tests/techTree.test.ts`.

### 2.3 The books you find

- A found book is **the same object as the tree** — one page, three columns,
  chapters — but **narrow**: it does one thing the tree does not, and it is
  not on the shelf until the kingdom finds it.
- **It is outside the pacing**: never required by a chapter or a Townhall
  level. It costs Knowledge and Gold like every card.
- **Two ship**, both found in the province: the **Sagas** with the first
  Tavern, the **Atlas** with the Watchtower repaired.
- A found book **arrives open and stays open.** It cannot be lost, spent or
  traded.

## 3. Knowledge, the bar

- **Kingdom-scoped**: `state.kingdom.wallet`, key `Knowledge`.
- **Buys technologies and nothing else**, by pouring (§1).
- **The bar: 1 an hour, up to 10.** Nothing raises the rate or the cap.
  - **The drip stops while the balance is at or over 10.**
  - **Everything else lands in full, even over 10.**
  - The drip resumes as soon as pouring takes the balance under 10.
- **Offline, the bar is the ceiling** (invariant 2).
- **Territory and fights pay in lumps, never in rate.**
- **A lump raise pays back**: a technology that raises the landmark or lair
  lump pays the raise at once for every site already claimed or cleared.
- **A new kingdom starts with no Knowledge.** Through the opening the chain
  pays for the cards it asks for ([`12-quests.md`](12-quests.md) §2.1).

| Source | Pays | Key |
|---|---|---|
| the **drip** | 1/h while under 10 | `knowledge.basePerHour` · `knowledge.cap` |
| claiming a **landmark**, repairing the **Watchtower** | 3, once | `knowledge.landmarkClaimLump` |
| a lair's **first clear** | 3, once | `delve.firstClearKnowledge` |
| a fog **treasure** | 1, on a treasure that rolls Knowledge | `treasure.knowledge` · `treasure.weights` |
| the **quest chain** | 35 across 21 quests | `quests` › `rewardKnowledge` |
| a **tome** from the Bag | 2 or 5 | `items` › `KnowledgeTomeSmall` · `KnowledgeTome` |
| every **dungeon room** and **Portal floor** (world board) | at least 1, rising with depth ([`19-world-map.md`](19-world-map.md) §8.1, §10) | `worldDungeon.knowledge` · `worldPortal` |
| a held **Observatory** (world board) | 4 a day into a store of 8, collected with a tap | `worldBuild.districts.Observatory` |
| a **scouted hex** (world board) | 2, on a corridor hex that rolls it | `worldScouting.rewards` |
| `knowledgeYield` | × on every lump | the Necromancer's boon (×1.25, [`10-heroes.md`](10-heroes.md) §2.6) |
| **events** | a lump in the reward table (**OQ-12**) | [`13-events.md`](13-events.md) |
| **buying it** | Gold or Gems (§3.2) | `knowledge.goldPriceBase` · `knowledge.goldPriceExponent` · `knowledge.gemsPerPoint` |

- The drip pays **at most 24 a day**, and only to a player who pours before
  the bar is full.
- A fully held province — six landmarks, the Watchtower, five lairs — pays
  **36** in lumps.
- A lump is rounded as it is paid.
- The pace these set is [`22-progression.md`](22-progression.md) §8.
- The clock banks whole units against an anchor, like taxes and Mana, so
  one-call replay equals stepped ticking (invariant 1).
- **The bar is always on the map**, as a tab of its own centred under the
  plank ([`../art/ui-menus-redesign.md`](../art/ui-menus-redesign.md) §5.1):
  what is held, a tube of ten phials, and when the next point and the full
  bar arrive. Its **+** opens the purchase (§3.2). It stays down over the
  research book and the Knowledge sheet and steps aside for every other menu.

### 3.1 Knowledge and Mana

| | Mana | Knowledge |
|---|---|---|
| Scope | city | kingdom |
| Fills with | time | time; lumps |
| Ceiling | capped; what arrives over the cap is lost | 10; only the drip stops, and lumps and purchases land over it |
| Spent on | taps on the ground, a city relic's activation, fights ([`08-magic.md`](08-magic.md) §1) | technologies, poured |
| Bought with | Gems, a rewarded video | Gold, Gems (§3.2) |

### 3.2 Buying Knowledge

- **The bar's sheet offers three**: **1 for Gold, 1 for Gems, 10 for Gems**,
  landing in the bar (over the cap if it must). **A technology's sheet offers
  one**: every point it still misses, for Gems, poured into it at once (§5.4).
- **Gold: every point costs more than the last, for ever.**

```
the nth point ever bought with Gold costs  knowledge.goldPriceBase × n^knowledge.goldPriceExponent
```

  - At 400 × n²: the 1st point 400, the 5th 10,000, the 10th 40,000.
  - The count is the kingdom's and **never resets**.
  - Buying several at once costs the sum of their prices, as one number.
- **Gems: a fixed price per point**, `knowledge.gemsPerPoint` (200). A full
  bar of 10 costs 2,000 Gems.

## 4. Knowledge and Stardust

| Currency | Buys | Source | Scope | Shown in |
|---|---|---|---|---|
| **Knowledge** | technologies | §3 | kingdom | its tab under the plank (§3) |
| **Stardust** | relic levels ([`09-relics.md`](09-relics.md)) and the hero ascension toll ([`10-heroes.md`](10-heroes.md) §4) | dungeon rooms and Portal floors, calls' loot (`banners.loot`), the chain (`rewardStardust`, 120 in all), the Survey, scouted hexes | kingdom | the screens that spend it |

- `knowledgeYield` multiplies a Knowledge lump; `stardustYield` is read by
  nothing (**OQ-113**).
- Stardust has no row on the plank. The full currency table is
  [`03-economy.md`](03-economy.md) §1.

## 5. The screen — the research book

### 5.1 The page and the bookmarks

- **One page, never a spread**: a sheet of parchment centred on the screen,
  on a small stack of the same sheet, pinned at its top corners.
- **Each open book is a bookmark**: a ribbon hanging from the page's bottom
  edge, tinted per book, the book's emblem on it; the open one hangs longer.
  Order: the tree, then found books.
- **A chapter heading**: *Chapter I* at the top of the page, and a heading
  wherever the next chapter begins, with *Reveal N more cells* while it is
  shut. One vertical scroll.
- The plank carries **Gold**; Knowledge is its tab (§3).
- Built from shared pieces — the page, the ribbon, the pin, the kit's stat
  tile, bar and buttons.

### 5.2 The three states

Every technology is on its page from the first minute, in one of three states:

| State | When | The card |
|---|---|---|
| **Locked** | a requirement is not researched, or its chapter is shut | greyscale, a padlock |
| **In progress** | it can be worked on | full colour, the blue bar **poured / needed**; **full**, it glows gold |
| **Done** | researched | the green bar, full, and a tick |

- **A book opens centred on its earliest card the kingdom may research
  now**, whether or not it can pay; with none, on the last one researched. A
  tutorial's pointer wins over it.
- Nothing rebuilds the page while a finger is on it.

### 5.3 Cards

- A card is the building card's **stat tile**: the name, the emblem, the
  kit's **progress bar with the numbers inside it**, the tick or the padlock.
- The orb marks a card with a press worth making now: filled and payable, or
  pourable to full from the bar.
- Connectors are **quill-drawn arrows** in sepia ink.
- A planned card is dashed (§1.3).

### 5.4 The technology's sheet

**A loose research page** over the dimmed book, the name as its heading, a
close knob; the scrim closes it too. Every sheet is the same size. Top to
bottom:

1. **What it is** — the emblem and one plain sentence of what it unlocks or
   does (§1).
2. **Knowledge** — the blue bar, poured / needed, and three buttons with the
   price on the button:
   - **Gems** — buys every point still missing and pours it (§3.2);
   - **+1** — one point from the bar;
   - **+N** — the least of what the bar holds and what is missing.
   Once the Knowledge is in, a line takes the buttons' place: *All its
   Knowledge is in — it is ready to research*.
3. **Research** — the price (Gold, and any materials and goods) above a wide
   **Research** button, locked with *Assign all its Knowledge to research it*
   until the bar is full. It researches on the press and closes the sheet.

- **A locked technology's sheet** is part 1 and its **requirements** — a met
  one ticked, a missing one with a cross, a shut chapter as *Reveal N more
  cells*.
- Buying Knowledge with Gold is the Knowledge sheet's (§3.2).

## 6. The tree holds no spells

- **Research does not cast.** An active effect is a **relic's**
  ([`09-relics.md`](09-relics.md)); the tree's magic cards open the Sanctum
  and its levels.
- **A relic's level is its ladder**: a stronger relic is restored and levelled
  from its fragments and Stardust, never researched.

## 7. Lairs and landmarks

- A **lair** pays 3 Knowledge on its first clear (§3).
- A **province landmark** pays 3 on claiming; the **Watchtower** pays 3 when
  it is repaired.
- A **world-board Observatory** fills a store of Knowledge while its hex is
  held ([`19-world-map.md`](19-world-map.md) §8).

## 8. Guild investment — designed, not built

- The same "invest N Knowledge" gesture as pouring into a technology (§1),
  aimed at a guild structure; the top contributors are paid when it completes.
- Depends on the guild ([`15-social.md`](15-social.md) §4–§5). Donating to another player's
  Wonder is **OQ-59**.

## 9. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| **A whole technology** — name, icon, kind, unlocks or effects, price, book, chapter, slot, requirements (prose only for a `mechanic`) | per technology | `tech-tree.json`, through **`?dev=data#tree`** |
| Chapter prices | [`tech-tree.md`](tech-tree.md) §1 — **OQ-13** | `tech-tree.json` |
| **The bar** | 1/h up to 10 | `knowledge.basePerHour` · `knowledge.cap` |
| **Gold price of a point** | 400 × n², never reset — **OQ-105** | `knowledge.goldPriceBase` · `knowledge.goldPriceExponent` |
| **Gem price of a point** | 200, fixed — **OQ-105** | `knowledge.gemsPerPoint` |
| Landmark claim lump | 3 | `knowledge.landmarkClaimLump` |
| First-clear lump | 3 | `delve.firstClearKnowledge` |
| Chain Knowledge | 35 in all | `quests` › `rewardKnowledge` |
| What each chapter asks for | 0 · 20 · 100 · 160 · 220 · 280 · 340 · 400 · 460 cells | `tech-tree.json` `eras` |
| What finishing a chapter pays | — · 1 · 1 · 1 · 2 · 2 · 2 · 3 · 4 relic fragments | `tech-tree.json` `eraRewards` |
| What opens a found book | §2 | `sim/research.ts` `TOME_OPENS` |
| **What a card says about one number** | one sentence per stat and op | `TECH_STATS[...].says` (`src/sim/data/techEffectRules.ts`) |
| Columns, card size, gutter, side channel | 3 · 120×108 · 36 · 14 px | `src/ui/research/layout.ts` |

## 10. Deliberately not in this design

- Tree fog: every technology is on its page from the first minute (§5.2).
- A two-page spread, or art made for one book or one state (§5.1).
- Instant Gold-only upgrades beside the tree.
- A hand-written line on a technology that is not a `mechanic` (§1).
- A Knowledge rate or cap that anything raises.
- Territory paying Knowledge by the hour.
- City-scoped Knowledge.
- Buying Knowledge with anything but Gold and Gems; a Gold price that resets.
- Mana paying for research.
- **Research time**, and anything that shortens it.
- Withdrawing poured Knowledge, or moving it to another technology.
- Gems completing a technology, or paying its Gold.
- A Knowledge or Stardust row on the plank (§4).
- More than one general book; a tab per chapter.
- **A bonus that shrinks a number, or a card that discounts a price** (§1.2).
- A flat yield bonus ("+1 Wood a strike").
- **A technology that opens a book** (§2).
- **Choosing, giving up or losing a book** (§2.3).
- Gems or Gold spent to open a chapter directly (§2.1).
- A rule about connectors crossing cards: the routing makes it impossible
  (§2.2).
- A district, unit or harvest source naming its own `requiredTech` (§1).
- An editor that can author a new stat
  ([`../tech-tree-editor.md`](../tech-tree-editor.md) §8).
- Exclusive branch picks; a prerequisite that crosses books.
- **Research slots** of any kind.
- A `mul` op beside `percent` and `flat`: the few mechanics whose arithmetic
  does not fit `(base + Σflat) × (1 + Σpct)` stay `mechanic` (§1.2).

**Open questions:** **OQ-12**, **OQ-13**, **OQ-59**, **OQ-105**, **OQ-113**.
