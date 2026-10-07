# 7 · Research — the tree, its chapters, and the Knowledge bar

> **Scope.** The research **system**: technologies, the books and their
> eras, the Knowledge bar that pays for them, buying Knowledge, the
> Knowledge ↔ Stardust split, the research screen, and why Magic holds no spells. The **content** — every
> node, the rank ladders and the price bands — is
> [`tech-tree.md`](tech-tree.md).
>
> **Status.** Built: the five books — three general, two found — each opened
> by a fact about the world (§2), the one-page-per-book flow chart with its
> era bars, the climbing bonuses (§1.2), the Knowledge bar (§3), pouring and
> instant completion (§1) and buying Knowledge (§3.2). The shape is authored
> in `?dev=data#tree` ([`../tech-tree-editor.md`](../tech-tree-editor.md)).
> Designed, not built: guild investment (§8).

## 1. Technologies

- A technology is a one-time research that unlocks content: a building, a
  district level, a unit, a terrain, a mechanic, or one numeric step.
- **A technology is one object**, in `src/sim/data/tech-tree.json`, authored in
  `?dev=tree` ([`../tech-tree-editor.md`](../tech-tree-editor.md)): its name
  and icon, its KIND, what it unlocks or what it moves, its Gold and
  Knowledge, its slot on its tome page and what it requires.
- **What a technology SAYS is generated from what it does**
  (`src/sim/techProse.ts`) — from its `unlocks`, or from one sentence per
  effect written against the stat in the registry. Only a `mechanic` carries
  written prose, because only a mechanic's effect lives in code. A technology
  keeps no line it would have to hold in step with its own numbers.
- **Every technology is one of three kinds**, and it says which:

| Kind | What it does | Authored |
|---|---|---|
| **`unlock`** | opens content, and names it | fully — a dropdown per thing it opens |
| **`bonus`** | moves numbers, and names them (`effects`) | fully — a picker per number it moves |
| **`mechanic`** | what the sim reads by id — `Tactics` softening a bad matchup | labelled only; the code does it |

- **The technology says what it opens, and every gate is derived from that**
  (`GATES`, `src/sim/data/definitions.ts`): a district's `requiredTech`, a
  level's, one more of a district, a unit's, a harvest source's, a terrain's.
  No district, unit or harvest row names its own technology any more, and two
  technologies claiming one gate is an error.
- **Cost: Knowledge + Gold. There is no research time.**
  - **Knowledge is poured in.** `Invest` moves Knowledge from the bar into the
    technology — as much as the bar holds, up to what is still missing — on as
    many visits as it takes (§3).
  - **Gold is paid once, when the Knowledge is full**, from the **city**
    purse, so the tree competes with fog, buildings and Wonders for one budget
    ([`16-wonders.md`](16-wonders.md) §1).
  - **Paying the Gold completes the technology at that instant.** Nothing is
    under study and nothing waits, so research has no boundary source.
- **Poured Knowledge stays in its technology.** It is never returned, moved to
  another technology or lost; a half-filled technology keeps its progress for
  ever.
- **Any number of technologies may hold poured Knowledge at once.** There are
  no research slots.
- Pouring needs what starting needs: every requirement researched and the
  band open (§2.1). A technology that cannot be researched cannot be poured
  into.
- **Every era costs Knowledge, era 1 included** — 1 for a rank, 2 for a major
  — and the quest chain pays for what it asks for
  ([`12-quests.md`](12-quests.md) §2.1).
- Each node lists `requires` (one to three); content gates on `requiredTech`.
  A prerequisite never points into another tome, and never at a card further
  down its own page. A card on a page's **first row** requires nothing —
  there is nothing above it to require, which is what opening a book means.
- **Gems never complete a technology.** They buy Knowledge (§3.2), which is
  poured like any other; the Gold is always the city's
  ([`14-monetization.md`](14-monetization.md) §1).
- There are 124 cards: **Kingdom 111 · Sagas 6 · Atlas 7**, totalling
  **9,674,305 Gold and 607 Knowledge**. Prices per chapter are in
  [`tech-tree.md`](tech-tree.md) §1.

### 1.1 Majors and minors

| Band | What it does | Price |
|---|---|---|
| **Major** | unlocks content | expensive |
| **Minor** | one numeric step; carries a roman numeral (`Sawpits I → II → III`) | cheap |

- A **rank ladder** is a chain of ranks; each rank requires the one before.
  A ladder is a naming convention — a stem plus a roman numeral — not a field.
- **A ladder's rank N sits in era N.** Era N holds its own new majors, rank N
  of every earlier ladder, and rank I of the ladders it introduces.
- A ladder may **ramp**: each rank carries its own value, so +10%, +15%,
  +20% is as legal as +10%, +10%, +10%.
- A rank costs Knowledge and Gold like any other node.
- The ladders per book are listed in [`tech-tree.md`](tech-tree.md) §2–§6.

### 1.2 What a bonus moves

A `bonus` names its effects, and each is four fields:

| Field | What it says |
|---|---|
| `stat` | which number, from the registry (`src/sim/data/techEffectRules.ts`) |
| `op` | `percent` or `flat` |
| `value` | **positive**, in whole points for a percent — `10` is +10% |
| `target` | what it aims at: a district, a unit, a unit tag, a harvest source, a tome. Absent = every subject of that stat |

- **Every bonus climbs** ([`22-progression.md`](22-progression.md) §9):
  - a `value` is never negative, and the rules refuse one;
  - a WAIT is moved by a **speed** the time is divided by — build speed,
    regrowth speed, auto-tap speed, training speed, workshop speed — so no
    stack of ranks ever reaches zero;
  - **nothing discounts a price**: the fog, a claim, a recruit and a cast
    cost what they cost; the tree makes the kingdom produce more instead;
  - a **yield** is a percentage of what the ground gives (`harvestYield`,
    `crewYield`), never "+1 a strike". A strike owes a fraction and takes the
    whole units; the remainder **carries** to the next strike, per worker
    (`Worker.strikeCarry`) and per currency for the thumb (`tapCarry`);
  - `flat` is kept for the numbers that are whole things: a bed, a ring of
    sight.
- A stat may **narrow which ids of a kind it accepts**, where only some of
  them have the number at all: a recovery bonus aimed at a berry bush, which
  is consumed rather than regrown, is refused the way a `flat` on a bare
  multiplier is. The narrowing is derived from the `harvest` data, so giving the
  berries a regrowth time is what makes them aimable.

- A total is the **sum over completed technologies** whose effects match
  `(stat, target)`. An unaimed effect reaches every query of its stat; an aimed
  one only its own target.
- Effects apply in one place, as a three-stage pipeline: base → **the completed
  technologies** (`src/sim/techEffects.ts`) → the modifier stack. Both the
  middle stage and an empty stack are the exact identity.
- A technology may carry several effects; most carry one.
- **A new kind of bonus is data.** "+5% gold income at Housing" and "+8% at
  the Townhall" are one stat with two targets — no new code. A new *number* is code:
  one registry entry plus the call site that owns it.

### 1.3 Planned nodes

- A row may carry `planned: true`: it is on the tree, researchable, and does
  nothing yet.
- Its info panel says so ("Not yet in the prototype").
- 5 cards are planned; the list is [`tech-tree.md`](tech-tree.md) §9.

## 2. The shelf — one tree and the books you find

| Book | Kind | Opens when | Remit |
|---|---|---|---|
| **Kingdom** | the tree | from the first minute | everything the kingdom learns, in nine chapters |
| **Sagas** | found | a **Tavern** stands | heroes, and the Tavern that hosts them |
| **Atlas** | found | the **Watchtower** is claimed | sight, landmarks, the world beyond |

- **One tree** holds the city, the army and the magic, mixed in every chapter;
  its content is [`tech-tree.md`](tech-tree.md).
- **A found book opens on a fact about the world, never on a research**, and
  is open for ever after (`sim/research.ts` `TOME_OPENS`). A card in a shut
  book answers `TomeClosed`. A found book has no bookmark until it is found
  ([`22-progression.md`](22-progression.md) §3).
- **`TomeId` is the set of books authored in `tech-tree.json`**; what opens one
  is code.
- **A book is one page**, read top to bottom: three columns of cards with a
  chapter bar across the width wherever the next chapter begins (§2.2).
- **Nothing is granted and nothing is free.** A fresh kingdom has an empty
  `completed`; every card in the tree costs Knowledge and Gold, from
  chapter 5 goods, and some from chapter 5 precious materials
  ([`19-world-map.md`](19-world-map.md) §7.6).
- **No edge crosses books.**
- Landmarks and lairs pay the tree in Knowledge (§7).

### 2.1 Chapters

- **The tree's bands are its chapters**, one per Townhall step: chapter *n*
  runs from Townhall *n* to *n + 1*. Each band's cells and pack are authored
  in `?dev=tree` (`eras`, `eraRewards`).
- **A chapter opens on revealed cells**: 0 · 20 · 100 · 160 · 220 · 280 · 340 ·
  400 · 460. Nothing in a locked chapter is startable — `startTech` answers
  `EraLocked` — and the bar says how many cells are left. Each count fits
  inside the reach of the Townhall that opens the chapter
  ([`01-map-and-fog.md`](01-map-and-fog.md) §4).
- **A chapter ends in one finale**, alone on its last row, that opens the next
  Townhall level (`Forestry` → 2, `Bureaucracy` → 3, `Magistracy` → 4,
  `Charter` → 5, `Exchequer` → 6, `Chancery` → 7, `Dominion` → 8,
  `Sovereignty` → 9, `GoldenAge` → 10). The next chapter's first row requires
  it, so chapters are read in order.
- **The spine is required; a dead end is optional.** A card that nothing below
  requires is a dead end. Every other card leads, in the end, to the finale.
- **Researching every card of a chapter, dead ends included, pays its card
  pack**, once (`research.rewarded`).
- The count is **paid reveals only** (`revealedCellCount`): a cell a building
  merely *discovered* has been seen, not opened, and the same count is what
  the `DiscoverCells` quest goal follows.
- The gate is a state condition, not a timer: no boundary source, and it
  cannot be bought with Gems or Gold directly — only by clearing fog, which
  Gold pays for.

### 2.2 The page

- **The shape of the tree — which tome and band each card is in, where on the
  page, and what it requires — is authored in `?dev=tree`** and lives in
  `src/sim/data/tech-tree.json`
  ([`../tech-tree-editor.md`](../tech-tree-editor.md)). Every other NUMBER lives
  in the `?dev=data` collections. Neither file can overwrite the other.
- A page is **three columns** wide and as many rows tall as the book needs.
  Three, because a fourth does not fit a phone and the flow stops reading as a
  flow past three.
- **A row is depth.** Every requirement sits on the row IMMEDIATELY above the
  card that needs it, so the page reads a line at a time and no edge is traced
  past cards it does not touch. One to three requirements per card; a card on
  the page's FIRST ROW requires nothing, because there is nothing above it.
- **A chapter's last row holds exactly one card**, its finale; a card that
  nothing below requires is a dead end, legal anywhere above it.
- **A rank ladder is a name, not a chain.** `Sawpits II` does not require
  `Sawpits I`, nor sit anywhere near it: the numeral tells the player the bonus
  goes further down the book, and every rank is an ordinary card gated by the
  row above it.
- **Every technology has a slot, ranks included.** `Sawpits II` is a card in
  band 2, not a bead hanging off its parent — the fan the old canvas needed is
  gone, and so are `FAN_DX`/`FAN_DY`.
- A card is 120 × 96 px: its name on one line and three lines of what it does.
  Both at 18px, the only size the body face has, which is what fixes the
  numbers ([`../../src/ui/research/layout.ts`](../../src/ui/research/layout.ts)).
- **A connector never crosses a card, by construction.** It runs down its own
  column while that column is empty and crosses in the GUTTER between two
  rows; where the column is occupied it steps out into a side CHANNEL, down
  the outside of the page, and back in above its target. So there is no rule
  about connectors and nodes to get wrong.
- **A requirement that reaches back over an era bar IS drawn**, passing under
  the bar (`isDrawnEdge`): that edge is how two bands connect, and a band
  whose cards appear to grow from nothing reads as a page starting over rather
  than one continuing. The gate is a thing you cross, not a thing that severs
  the tree.
- `src/sim/data/techTreeRules.ts` is the one statement of what a legal tree
  is, checked by the editor as you drag, by the save endpoint, and by
  `tests/techTree.test.ts` against the shipped file.

### 2.3 The books you find

> **A book is a choice about what kind of kingdom this is.**

- A found book is **the same object as the tree** — one page, three columns,
  bands. What differs is that it is **narrow**: it does one thing the tree
  does not, and it is not on the shelf until the kingdom finds it.
- **It is outside the pacing**: never required by a chapter or a Townhall
  level. **It costs Knowledge and Gold** like every card, so it competes with
  the chapters for the bar.
- **The two that ship** are found in the province itself: the **Sagas** with
  the first Tavern, the **Atlas** with the Watchtower.
- **Later ones** are the pattern for a far lair, an event or the world map.
- A found book **arrives open and stays open.** It cannot be lost, spent, or
  traded away.
- **A book is the only reward that changes how the game is played rather than
  how fast.**

## 3. Knowledge, the bar

- **Kingdom-scoped.** Lives in `state.kingdom.wallet` under the key
  `Knowledge`; survives a province reset.
- **Buys technologies and nothing else** (plus guild investment, §8, when
  built). It is spent by pouring (§1).
- **The bar: 1 an hour, up to 10.** Both numbers are fixed for the whole
  game; nothing raises the rate or the cap.
  - **The drip stops while the balance is at or over 10.**
  - **Everything else lands in full, even over 10** — a quest, a claim, a
    first clear, an event, a purchase (§3.2). Nothing is ever lost; the cost
    of a full bar is the drip it did not earn.
  - The drip resumes as soon as pouring takes the balance back under 10.
- **Offline, the bar is the cap.** Away for ten hours or more, the player
  comes back to a full bar.
- **Territory and fights pay in lumps, never in rate.** Claiming a
  landmark and a lair's first clear each pay once; every world-map dungeon
  room and Portal floor pays as it is cleared. The ladders and mechanics that raise
  those lumps are in the table.
- **A lump raise pays back.** A technology that raises a lump pays its raise
  at once for every site already claimed or cleared, so researching it late
  never costs what researching it early would have paid.
- **A new kingdom starts with no Knowledge.** The opening chain pays for its
  own cards: eighteen quests pay Knowledge, enough to carry the chain's own
  research with no drip ([`12-quests.md`](12-quests.md) §2.1). After the
  opening the drip, the lumps and the purchases are the funding.

| Source | Pays | Key |
|---|---|---|
| the **drip** | 1/h while under 10 | `knowledge.basePerHour` · `knowledge.cap` |
| claiming a **landmark** | 3, once | `knowledge.landmarkClaimLump` |
| a lair's **first clear** | 3, once | `delve.firstClearKnowledge` |
| every **dungeon room** and **Portal floor** (world map) | at least 1, rising with depth and room ([`19-world-map.md`](19-world-map.md) §8.1, §10) | `worldDungeon.knowledge` (0.25) · `worldPortal` |
| a held **world-map landmark** | 4 a day into a store of 8, collected with a tap | `worldBuild.landmark` |
| `knowledgeYield` modifier | × on every lump | the Necromancer's boon (×1.25, [`10-heroes.md`](10-heroes.md) §2.6) |
| the **quest chain** | 41 across eighteen quests | `quests` › `rewardKnowledge` |
| **events** | a lump in the reward table (**OQ-12**) | [`13-events.md`](13-events.md) |
| **buying it** | Gold or Gems (§3.2) | `knowledge.goldPriceBase` · `knowledge.goldPriceExponent` · `knowledge.gemsPerPoint` |

- The drip pays **at most 24 a day**, and only to a player who pours before
  the bar is full.
- A fully held province — eleven landmarks, five lairs — pays **48** in lumps.
- A lump is rounded as it is paid, so a +10% rank adds nothing to a lump of 3
  on its own; the second rank adds a point.
- The drip (at most 24 a day) is the steady source; the lumps and the chain
  are the spikes. The pace they set is [`22-progression.md`](22-progression.md) §8.
- The clock banks whole units against an anchor, the same shape as taxes and
  Mana, so one-call replay equals stepped ticking (invariant 1).
- **The bar is always on the map**, as a tab of its own centred under the
  plank ([`../art/ui-menus-redesign.md`](../art/ui-menus-redesign.md) §5.1,
  M33, its gauge M54): what is held; a glass tube of ten phials, full for each
  point held and rising in the next one as it drips in; and when the next
  point and the full bar arrive, to the minute. Its **+** opens the purchase (§3.2). It stays down over the menus
  that spend Knowledge — the research book and the Knowledge sheet — and
  steps aside for every other one; Knowledge is never a coin on the plank.

### 3.1 Knowledge and Mana

| | Mana | Knowledge |
|---|---|---|
| Scope | city | kingdom |
| Fills with | time | time; lumps from landmarks, lairs, dungeons, quests and events |
| Ceiling | capped; what arrives over the cap is lost | 10; only the drip stops, and lumps and purchases land over it |
| Spent on | taps on the ground and casts on the map ([`08-magic.md`](08-magic.md) §1) | technologies, poured |
| Bought with | Gems, a rewarded video | Gold, Gems (§3.2) |

### 3.2 Buying Knowledge

- **Knowledge is bought with Gold or with Gems.** The bar's own sheet offers
  three: **1 for Gold, 1 for Gems, 10 for Gems**, landing in the bar (over the
  cap if it must). A technology's sheet offers one: **every point it still
  misses, for Gems**, poured into it at once (§5.4).
- **Gold: every point costs more than the last, for ever.**

```
the nth point ever bought with Gold costs  knowledge.goldPriceBase × n^knowledge.goldPriceExponent
```

  - At 400 × n²: the 1st point 400, the 5th 10,000, the 10th 40,000, the
    20th 160,000 — a valve for a Gold-rich city, never a second faucet.

  - The count is the kingdom's and **never resets** —
    not daily, not at a season, not at a province reset.
  - Buying several at once costs the sum of their prices, shown as one number.
  - Gold is the city's purse: a point bought is fog, a building or a Wonder
    level not bought.
- **Gems: a fixed price per point**, `knowledge.gemsPerPoint` (200). It
  never rises: a full bar of 10 costs 2,000 Gems, under the $4.99 pack's
  2,500. A point is an hour of the bar, so it buys an hour of the tree's
  gate for 200 Gems, where rushing an hour of building costs 720.
- Buying never needs a free anything: there is nothing to occupy.

## 4. Knowledge and Stardust

| Currency | Buys | Source | Scope | Shown in |
|---|---|---|---|---|
| **Knowledge** | technologies | the drip, lumps from landmarks, lairs, dungeon rooms, quests and events, Gold, Gems | kingdom | its tab under the plank (§3) |
| **Stardust** | the hero ascension toll (`src/sim/heroes.ts`; [`10-heroes.md`](10-heroes.md) §4) | dungeon rooms and Portal floors (`worldDungeon.stardust`), calls' loot (`banners.loot`), the chain (`rewardStardust`, 140 total) and the Survey | kingdom | the hero screens |

- One job each. `knowledgeYield` multiplies a Knowledge lump; `stardustYield`
  is read by nothing (**OQ-113**).
- Stardust has no row on the plank: a currency spent in exactly one screen
  lives in that screen's header. Knowledge is the exception that has to be
  seen from the map, because a full bar stops earning, so it has a tab of its
  own under the plank. The full currency table is
  [`03-economy.md`](03-economy.md) §1.
- The code and doc key is `Stardust`; *Polvo estelar* is the localised string
  only.

## 5. The screen — the research book

The research screen is a book (mockups M43 and M46).

### 5.1 The page and the bookmarks

- **One page, never a spread**: a sheet of parchment centred on the screen,
  on a small stack of the same sheet, pinned at its top corners — the same
  object on a phone and on a tablet.
- **Each open book is a bookmark**: a ribbon hanging from the page's bottom
  edge into the room the nav bar leaves (it steps aside while a menu is open).
  One ribbon, tinted per book, the book's emblem on it; the open one hangs
  longer. Order: the Kingdom's tree, then found books.
- **An era is a chapter**: *Chapter I* at the top of the page, and a heading
  wherever the next band begins, with *Reveal N more cells* while it is shut.
  One vertical scroll.
- The plank carries **Gold** only; Knowledge is its tab under the plank
  (§3), which stays down while the book or the Knowledge sheet is open and
  steps aside for every other menu.
- It is built from shared pieces — the page, the ribbon, the pin, the kit's
  stat tile, bar and buttons — so a new book or state costs no new art.

### 5.2 The three states

**There is no tree fog**: every technology is on its page from the first
minute. Each is in one of three states:

| State | When | The card |
|---|---|---|
| **Locked** | a requirement is not researched, or its band is shut | greyscale, a padlock after the bar |
| **In progress** | it can be worked on | full colour, the blue bar **poured / needed**; **full**, it glows gold — the one card asking to be finished |
| **Done** | researched | the green bar, full, and a tick |

- **Every book opens centred on its earliest card the kingdom may research
  now** — its requirements met, whether or not it can pay yet — when the menu
  opens and when a bookmark turns to another book; with none, on the last one
  researched. A tutorial's pointer wins over it.
- The page scrolls by dragging on a phone: nothing rebuilds it while a finger
  is on it.

### 5.3 Cards

- Three columns (§2.2). A card is the building card's **stat tile**: the
  name at the top, the emblem under it, and the kit's **progress bar with the numbers inside it**,
  plus the tick or the padlock.
- The orb marks a card with a press worth making now: filled and payable, or
  pourable to full from the bar.
- Connectors are **quill-drawn arrows** in sepia ink, into the card that
  needs the one above.
- A planned node is dashed and says so on its sheet.

### 5.4 The technology's sheet

**A loose research page** over the dimmed book — a small stack of parchment,
the name as its heading, a close knob in its top corner, on the paper; the
scrim closes it too. **Every sheet is the same size**: as tall as the tallest
technology's needs, whatever state it is in. It reads top to bottom in three parts, never numbered:

1. **What it is** — the emblem in a framed square and one plain sentence of
   what it unlocks or does (§1). A minor rank's sentence carries its numbers.
2. **Knowledge** — the blue bar, poured / needed, and three buttons with the
   price on the button:
   - **Gems** — buys every point still missing and pours it (§3.2);
   - **+1** — one point from the bar;
   - **+N** — as much as it can: the least of what the bar holds and what is
     missing.
   Once the Knowledge is in, the full bar stays and a line takes the buttons'
   place, as tall as they are: *All its Knowledge is in — it is ready to
   research*.
3. **Research** — the upgrade popup's block: the Gold above a wide
   **Research** button, which is locked with *Assign all its Knowledge to
   research it* under it until the bar is full. It researches on the press
   and closes the sheet. **Nothing announces it**: the press is the news.

- **A locked technology's sheet** is part 1 and its **requirements**, as the
  upgrade popup's rows — a met one ticked, a missing one pink with a cross,
  a shut band as *Reveal N more cells* — and nothing else.
- Buying Knowledge with Gold is the Knowledge sheet's (§3.2), not this one's.

## 6. The tree holds no spells

**Research does not cast.** An ability is a **relic's**, cast from the relic
that owns it ([`09-relics.md`](09-relics.md) §2.1); the tree's magic lane opens
the Sanctum and its levels.
- **A relic's level is the ability's ladder.** There is nothing to research, so
  a player who wants a stronger active closes that relic's album — which is the
  collection's whole promise and the reason the split had to go one way.

## 7. Lairs and landmarks

- A **lair** pays 3 Knowledge on its first clear (§3).
- A **province landmark** pays 3 on claiming.
- A **world-map landmark** fills a store of Knowledge while its hex is held
  and active ([`19-world-map.md`](19-world-map.md) §8).

## 8. Guild investment — designed, not built

- The same "invest N Knowledge" action points at a guild structure; the top
  contributors are paid when it completes.
- It is the same gesture as pouring into a technology (§1), aimed at a
  guild structure instead.
- Dependency of [`15-social.md`](15-social.md) §7. Donating to another
  player's Wonder is kept out of [`16-wonders.md`](16-wonders.md) §12 and is
  **OQ-59**.

## 9. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Era price bands | [`tech-tree.md`](tech-tree.md) §7 — **OQ-13** | `tech-tree.json`, with per-band totals in **`?dev=tree`** |
| **The bar** | 1/h up to 10 | `knowledge.basePerHour` · `knowledge.cap` |
| **Gold price of a point** | 400 × n², never reset — **OQ-105** | `knowledge.goldPriceBase` · `knowledge.goldPriceExponent` |
| **Gem price of a point** | 200, fixed — **OQ-105** | `knowledge.gemsPerPoint` |
| Landmark claim lump | 3 | `knowledge.landmarkClaimLump` |
| First-clear lump | 3 | `delve.firstClearKnowledge` |
| Chain Knowledge | 41 total | `quests` › `rewardKnowledge` |
| What opens a found book | §2 | `sim/research.ts` `TOME_OPENS` |
| **A whole technology** — name, icon, kind, unlocks or effects, Gold, Knowledge, tome, band, slot, requirements (prose only for a `mechanic`) | per technology | `tech-tree.json`, through **`?dev=tree`** ([`../tech-tree-editor.md`](../tech-tree-editor.md)) |
| **What a card says about one number** | one sentence per stat and op | `TECH_STATS[...].says` (`src/sim/data/techEffectRules.ts`) |
| How many chapters the tree has, and what each asks for | 9 chapters; 0 · 20 · 100 · 160 · 220 · 280 · 340 · 400 · 460 cells | `tech-tree.json` `eras`, through **`?dev=tree`** |
| What finishing a chapter pays | a card pack per chapter | `tech-tree.json` `eraRewards` |
| Three columns, card size, gutter, side channel | 3 · 120×96 · 36 · 14 px | `src/ui/research/layout.ts` |

## 10. Deliberately not in this design

- **Tree fog** — `?` silhouettes and hidden cards: every technology is on its page, locked in greyscale until it can be worked on (§5.2).
- A two-page spread, or art made for one book or one state (§5.1).

- Instant, Gold-only upgrades as a second kind of node (`UPGRADES`,
  `buyUpgrade`, `state.upgrades`, the `BuyUpgrade` quest goal).
- **A hand-written line on a technology.** Prose beside the numbers it
  describes drifts the first time a ladder is rebalanced: 150 cards once
  shared 68 sentences, and five contradicted their own effects. The card is
  generated (§1); a `mechanic` writes one because its effect is code.
- **A Knowledge rate or cap that anything raises** — not territory, a building, a technology, the Townhall or population.
- Territory paying Knowledge by the hour.
- City-scoped Knowledge.
- Buying Knowledge with anything but Gold and Gems; a Gold price that resets.
- A library district or a scholar assignment as Knowledge sources
  ([`03-economy.md`](03-economy.md) §9).
- Mana paying for research.
- **Research time**, and anything that shortens it.
- Withdrawing poured Knowledge, or moving it to another technology.
- Gems completing a technology, or paying its Gold.
- A Knowledge or Stardust row on the plank (§4).
- Five *general* books; one radial canvas for the whole tree; a tab per band.
- **A bonus that shrinks a number, and a card that discounts a price** (§1.2).
- A flat yield bonus ("+1 Wood a strike").
- A global age ladder instead of per-tome eras.
- A keystone that holds a band shut, or that requires every built major of the
  band above it (§2.1).
- **A technology that opens a book.** A book opens on a fact about the world
  (§2), never by researching towards it.
- **Giving a book up.** Books are found, never chosen between, so there is
  nothing to renounce and no build to regret (§2.3).
- **Losing a book.** Not to a lost hex, not to a season's end, not to anything.
- Gems or Gold spent to open a band directly (§2.1).
- A minor rank drawn as a bead fanned under its parent instead of a card in a
  slot of its own (§2.2).
- A rule about connectors crossing cards: the routing makes it impossible
  (§2.2).
- A technology split across files, or a hand-written list of technology ids (§1).
- A district, unit or harvest source naming its own `requiredTech`: the
  technology says what it opens, once (§1).
- An editor that can author a new STAT. A `bonus` may move any number the
  registry declares, and aim it at anything that stat accepts, but the number
  itself has to be read by code
  ([`../tech-tree-editor.md`](../tech-tree-editor.md) §8).
- Exclusive branch picks.
- A prerequisite that crosses tomes (§2).
- The same stat appearing in two tomes (§2).
- **Research slots** of any kind, bought or granted.
- A contested landmark that raises the Knowledge rate (§7).
- A `mul` op beside `percent` and `flat`. `SanctifiedRuins` and `Roadworks`
  multiply an inner term, and giving them an op would make the resolver's one
  shape — `(base + Σflat) × (1 + Σpct)` — two shapes (§1.2). `Salvage` and
  `Tactics` are additive but sit where folding them would RE-ASSOCIATE the sum,
  and float addition is not associative. All four stay `mechanic`.
- A per-ladder HOOK in code — one union member and one call site per kind of
  bonus. Replaced by the stat registry, which is what makes a new bonus data
  (§1.2).

**Open questions:** **OQ-12**, **OQ-13**, **OQ-14**, **OQ-15**, **OQ-41**,
**OQ-59**, **OQ-69**, **OQ-105**. (**OQ-68** is retired: a band is not held by a keystone
any more, and what each bar asks for is a number, so it is OQ-13.)
