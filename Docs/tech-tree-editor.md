Tech tree editor
---

> **Scope.** How technologies are authored — created, described, priced,
> classified, placed and connected — and why they live outside the workbook.
> Covers the `?dev=tree` editor, the shared rule module every consumer
> validates against, and the dev-only save path.
>
> **Status: built.** There is no `Technologies` sheet, and no `required_tech`
> column on `Districts`, `Units` or `Harvest`. The tree this authors is
> designed in [`features/07-research.md`](features/07-research.md) and its
> content is [`features/tech-tree.md`](features/tech-tree.md).

## 1. Why technologies left the workbook

A tree is a graph, and a technology is not a row. Creating one used to mean
four files: the `TechId` union in `state.ts`, a second id list in
`scripts/balance.mjs`, a row on the `Technologies` sheet, and five lines of
identity in `definitions.ts`. Three of those are the same list.

- **The sheet showed ids, not the page.** `requires = Magistracy, Roadworks` is
  not a flow chart. Whether a page reads downward, whether a card has an
  incoming line at all, whether a band is three rows or twelve — none of it
  was visible in the cells that decided it.
- **A position is not a number.** `node_x = −3` meant something only to the
  renderer, and moving one card meant editing a cell and reloading the game.
- **What a technology was FOR lived somewhere else.** A district named its own
  `required_tech`, so "what does Forestry unlock" was answered by scanning
  every district, unit and harvest row backwards.
- **Errors arrived late and in a terminal**, half a minute after the mistake.

**The workbook is still the source of truth for every balancing number**
(invariant 5). A technology is not one: it is identity, a kind, a set of
unlocks or effects, a price, a slot and a set of edges — one object, authored
in one place. What it SAYS is not authored at all (§3.1).

## 2. What a technology is

`src/sim/data/tech-tree.json`, one object per technology:

```json
"Saws": {
  "name": "Saws", "glyph": "🪚", "kind": "unlock",
  "tome": "Civics", "era": 1, "row": 2, "col": 0,
  "requires": ["Forestry"],
  "gold": 175, "seconds": 20,
  "unlocks": [{ "district": "Sawmill" }]
}
```

Its card reads **"Unlocks the Sawmill"**, and nobody typed that: what a
technology says is generated from what it does (§3.1).

| Field | Means |
|---|---|
| the key | the `TechId`. `TechId` **is** `keyof` this file, so a new one is a type the moment it is saved |
| `name` · `glyph` | what the player reads on the card |
| `description` | **`mechanic` only** — the one kind with nothing in its own data to read (§3.1). Every other line is generated |
| `kind` | `unlock`, `bonus` or `mechanic` (§3) |
| `tome` · `era` | which book, which band — the book says how many it has (`eras`) |
| `row` · `col` | its slot on that book's three-column page; a requirement always sits on a smaller row |
| `requires` | one to three technologies, all on the **row immediately above** — none needed by anything on the page's first row |
| `gold` · `knowledge` · `seconds` | what it costs and how long it takes; `knowledge` omitted when 0 |
| `unlocks` | `kind: unlock` only (§3) |
| `effects` | `kind: bonus` only — one line each, so a rebalance diffs as the values that changed (§3) |
| `planned` | on the tree for its shape, does nothing yet |

Beside `technologies`, the file's other half is **`eras`**: one list per book,
`[cells to open era 1, era 2, …]`, so its LENGTH is how many bands the book
has. Two facts in one number on purpose — a band and its gate are the same
thing, and keeping the count in one file and the thresholds in another meant
dropping a middle band silently re-pointed the numbers left behind.

- `tome`, `era`, `row` and `col` are **absent together** on a technology taken
  OFF THE PAGE (§5). It still exists and is still editable; the rules count it
  as PENDING rather than wrong, and the file saves with it, so a book half
  rearranged survives being written down. The game leaves such a card out
  entirely (§4).
- `definitions.ts` builds `TECHNOLOGIES` by walking this file, and `TECH_ORDER`
  is its key order — which the editor writes in reading order, so it is also
  rank order inside a rank ladder.
- It is written a few lines per technology, in reading order, so a change shows
  up in `git diff` as the technologies that changed.

## 3. The three kinds

### 3.1 What a card says, and who writes it

Nobody types it. A technology's line is **generated from what it does**
(`src/sim/techProse.ts`): from its `unlocks` for an `unlock`, from its
`effects` for a `bonus`. Rebalance a rank and its own sentence follows.

| Kind | Its line | Example |
|---|---|---|
| `unlock` | `Unlocks …`, one clause per thing, with display names. Building levels that share a number fold into one clause | *Unlocks Barracks, Spear Hall, Shooting Grounds and Stables at level 4* |
| `bonus` | one sentence per effect, from the stat's `says` in the registry | *+1 Wood per tap and delivery from a forest* |
| `mechanic` | its `description`, the only written prose left in the tree | *Paved ways — every worker walks a quarter faster.* |

In the game the card shows only the glyph and the name; the line is read in
the info panel a tap opens ([`features/07-research.md`](features/07-research.md)
§5.4). In the editor it is on the card, because a designer arranging a page is
reading what each one does.

**`unlock` — it opens content.** The technology says what, and every gate in
the game is derived from that (`GATES`, `definitions.ts`):

| `unlocks` entry | The gate it becomes |
|---|---|
| `{ "district": "Sawmill" }` | `DISTRICTS.Sawmill.requiredTech` |
| `{ "districtLevel": { "id": "Housing", "level": 3 } }` | `DISTRICTS.Housing.requiredTechPerLevel[1]` |
| `{ "districtCount": "Market" }` | `DISTRICTS.Market.extraCountTech` — one more may stand |
| `{ "unit": "Archer" }` | `UNITS.Archer.requiredTech` |
| `{ "harvest": "Forest" }` | `HARVEST.Forest.requiredTech` |
| `{ "terrain": "Water" }` | `terrainGate('Water')` — what `explorationGate` reads |

One technology per gate: two claiming the same door is an error, because the
derivation would otherwise answer with whichever it read last.

Nothing opens a BOOK — every book is open — and nothing but the era bar opens
a band. A card that raises the Townhall's level is an ordinary `unlock` sitting
wherever it is placed.

**`bonus` — it moves numbers, and names them.** Each effect is four fields:

| Field | Picked from |
|---|---|
| `stat` | the registry — every number the game can be told to move |
| `op` | `percent` or `flat`, narrowed to the ops that stat accepts |
| `value` | **signed**, in whole points for a percent. `-22` is −22%, `-0.05` is 0.05 s off the auto-tap |
| `target` | narrowed to the target kinds that stat accepts: a district, a unit, a unit tag, a harvest source, a tome — or `global` for every subject |

The three selects narrow each other, so the row can only produce an effect the
rules accept: `unitAtk` offers `flat` and no `percent`, and only `global` or a
unit tag. A stat may also narrow the IDS of a kind, where only some of them
have the number — `harvestRecovery` reaches the sources that grow back in
place and not the berry bush, which is consumed and reappears elsewhere. That
narrowing is **enforced by the rules rather than by the select**: the dropdown
still lists every id of the kind (`TARGET_IDS`), and `effectProblems` refuses
the ones the stat cannot reach, so a mis-aimed effect is caught on save with a
sentence rather than being unpickable. Narrowing the select too is one line at
`mount.ts:949`. A technology may carry several effects; most carry one. Rank N
belongs in era N and requires rank N−1, which is what makes a ladder a chain
down the page.

**Aim is exact.** An effect with no target reaches every query of its stat; an
aimed one reaches only its own target. That is what lets Irrigation and Scythes
both sit on `Crops` and sum, without either touching the forest.

**Which numbers EXIST is code**, and that is the one half of a bonus the editor
cannot author:

| To… | Change |
|---|---|
| add a rank to a ladder, or a bonus of a kind nothing has yet — "+5% gold at Housing" | nothing — the editor |
| move a **number nothing reads yet** | an entry in `TECH_STATS` (`src/sim/data/techEffectRules.ts`) — including `says`, the sentence a player reads, one per op it accepts — then `techValue(state, 'yourStat', base, target?)` at the call site that owns it |
| let events or relics move the same number | a `ModifierStat` in `modifiers.ts` and a `resolve()` at that call site |

The `stat` dropdown offers every stat the registry declares, whether or not a
technology moves it yet — so a stat added in code is pickable immediately.
`tests/techTree.test.ts` closes the loop both ways: every declared stat must be
read by something in `src/sim`, and the file may only name a stat the registry
declares.

**`mechanic` — the code reads it by id.** `Conquest` bending the Knowledge
rate, `SanctifiedRuins` doubling the per-ruin drip. The editor can label these;
it cannot write them. What is left in this kind is what genuinely is code: a
`planned` node, and the few mechanics whose arithmetic does not fit
`(base + Σflat) × (1 + Σpct)`.

## 4. The rules, in one module

`src/sim/data/techTreeRules.ts` is the one statement of what a legal tree is,
read by the editor as you drag, by the save endpoint before it writes, and by
`tests/techTree.test.ts` against the shipped file. A rule added there is
enforced in all three or in none.

The rules give three answers, not two. **Pending** is the third: a technology
**off the page** has no slot yet, which is unfinished work and not a mistake —
clearing a band (§6) makes a dozen at once. It is counted, never listed
card-by-card among the errors, and it **does not block the save**: a book half
rearranged has to survive being written down. A rule that depends on where a
card sits is not applied to one that sits nowhere, so a cleared band raises no
errors at all; the links are checked again when the cards are placed. A card
still on the page that requires one off it **is** an error, in its own words.

A saved technology with no slot is **not in the game**: no card on any page,
nothing to research, and it gates nothing — whatever it unlocks is simply
ungated until it is placed again.

**Errors** (they do not stop a save — see below):

- an illegal id, or no name or glyph
- prose on a technology whose `unlocks` or `effects` already say what it does
- no prose on a `mechanic`, whose effect is code and whose card has nothing
  else to read
- two cards in one slot of one page (the same slot on another page is fine)
- a tome that is not a tome, a band outside 1–4, a column outside 0–2
- one row shared by two eras — an era bar takes a whole line
- more than three requirements; **no requirements on a card that is not on its
  page's first row** — the first row is where a root belongs, because there is
  nothing above it to require
- a requirement in another tome, at or below the card, or naming itself
- a requirement that reaches **further up than the row above**: every
  prerequisite is the card directly before this one, so the page can be read a
  line at a time
- a band that starts at or above the one before it
- a negative or fractional price; anything free at all, since nothing is
  granted any more; Knowledge charged in era 1, where the clock has not started
- a book with no bands, or more than eight; a band asking for fewer cells than
  the one above it; era 1 asking for anything at all
- a kind that disagrees with what the technology carries — an `unlock` that
  unlocks nothing (unless `planned`), a `bonus` that moves no number, an
  `unlock` or `mechanic` that carries effects
- an unlock naming a district, level, unit, harvest source or terrain that
  does not exist; two technologies unlocking one thing
- an effect naming a stat the registry does not have, an op that stat does not
  accept, a target of a kind it does not accept, or a target id that does not
  exist
- a ladder whose numerals skip one. A ladder is a NAME, not a chain: rank II
  does not require rank I and need not sit near it — the numeral tells the
  player the bonus goes further down the book, and carries no mechanism

**Warnings**: a requirement on a `planned` technology, which does nothing yet.
The drop default already prefers a card that does something, so this only
happens where a whole row is planned.

**Nothing is refused.** The rules exist to say what is wrong, not to withhold
the file: a page mid-rearrangement is exactly when the work most needs writing
down, and a save button that says no is one that loses an afternoon. The save
reports what it found — errors, warnings, cards still in the palette — and
writes anyway. What SHIPS is held by `tests/techTree.test.ts`, which is the
right place for it: there a broken tree fails a build, here it is a Tuesday.

There is deliberately **no rule about connectors crossing cards**. The routing
makes it impossible: a line runs down its own column only while that column is
empty, and steps out into the side channel when it is not
([`../src/ui/research/layout.ts`](../src/ui/research/layout.ts)).

## 5. Using it

`npm run dev`, then `http://localhost:5173/?dev=tree` — or the **🌳 tree
editor** button on the `?dev` bar. `← game` in the status bar goes back.

| Pane | What it holds |
|---|---|
| left | **the open book first**, then the other two under their own heading, with the filter box and **+ new technology**. A faint green ground means SETTLED — in a slot the rules are happy with; red means the problem list is still asking about it, and the row's tooltip says what. A row names its book only when it is not the one on screen |
| middle | the open book's page: three columns of slots, era bars between bands |
| right | the selected technology's fields, its unlocks, and the problem list |

- **+ new technology** asks for an id, name, glyph, kind, era, Gold and
  seconds — and for prose only when the kind is `mechanic`, because every
  other card writes its own line. It drops the result at the end of that band,
  placed. Then say what it unlocks or moves; the problem list will be asking
  you to.
- **Drag** a technology from the palette (or from another slot) onto a slot.
  Dropping onto an occupied slot **swaps** the two.
- **A drop sets the requirements**: the filled slot directly above the target,
  or the rest of that row when that slot is empty — the row IMMEDIATELY above
  and no further, which is the only place a requirement may point. It prefers
  a card that does something over a `planned` one. That is the converge-and-fan
  the flow chart is made of, and it is a starting point, not a verdict.
- **Hover a card and two ports appear**, one over its top edge (its INPUT,
  where a line from the row above lands) and one under its bottom edge (its
  OUTPUT). Press one to start a connection:
  - from an **output**, the **inputs of the row below** light up green;
  - from an **input**, the **outputs of the row above** do.
  Press one of them and the connection is made — the requirement points up the
  page either way, so the lower card is the one that gains it. Press the port
  you started from, click the page, or `Esc` to let go. Only the ports the
  connection could land on are drawn while wiring, so a press cannot reach one
  that would refuse it; it says so when the row is full, when the pair is
  already connected, or when there is no row that way.
- **Click a connector to cut it.** `⇢ link` is the same gesture for cards that
  are NOT on neighbouring rows: select one, press it, click the other.
  `take the slot's default` puts the drop's guess back.
- **Everything in the inspector is editable** — name, glyph, Gold, Knowledge,
  seconds, kind, what it unlocks or moves, `planned`. Switching the kind clears
  the fields that no longer mean anything. Where the prose box would be, a
  technology that says it itself shows **the sentence the player will read**,
  and cannot be typed over; only a `mechanic` still has the box.
- **The first unlock or effect takes the prose with it**, which is the one
  gesture that deletes writing as a side effect of adding data. It says so
  when it happens, and `⌘Z` puts it back.
- **`+ unlock`** adds one: pick what kind of thing, then which one (and which
  level, for a building level). **`+ effect`** is the same gesture for a bonus:
  stat, op, value, then what it aims at. Click a chip to cut either.
- **`+` and `−`** in the left channel open a gap above a row and close an empty
  one. Everything below renumbers; nothing else moves.
- **Every band has a header** — the era bar, which in the game only exists
  BETWEEN bands. Here it is the band's handle: what the band asks for in
  revealed cells (era 1 has no gate; it is the top of the page), and the 🗑
  that drops it.
- **`+ era`** at the foot of the page adds a band at the END, which is the only
  place one can go: the ladder of thresholds only climbs, and a band inserted
  in the middle would have to renumber every card below it. It opens at
  whatever the band above asks for, which is the only default legal on arrival.
- **🗑 in a band's header** drops it: every card in it goes to the palette, and
  every band below shifts up one — cards and thresholds together, so era 4's
  "220 cells" follows era 4 when it becomes era 3. Rows are not renumbered;
  they only have to ascend from band to band. Asks first, and it is one undo.
  A book is at least one band, so the last one cannot go.
- The last row of each band is an empty **spare row**. Dropping into it pushes
  the bands below down a line.
- **Off the page is not deleted.** `⤴ take off the page` (or `Delete`) lets go
  of the slot and keeps the technology — its name, price, kind and unlocks all
  survive; only where it sat, and what it required, do not. It waits in the
  **off the page** group at the top of the palette, and the tree saves with it
  there; the game leaves it out until it has a slot (§4). Drag it into a slot
  and the slot hands it new requirements.
  `🗑 delete for good` is the other verb: it ends the technology, and every
  requirement pointing at it.
- **`⤴ clear era…`** is the same gesture for a whole band: pick the era, and
  every technology in it goes to the palette. It asks first, with the COUNT —
  "clear era 2" is not a sentence anyone can check and "20 technologies" is —
  and it is **one undo**, not twenty.
- **The scroll stays where you left it.** Every gesture redraws all four
  panes, so each one keeps its own position across the redraw — a click on a
  card, or on a connector, is a gesture you make deep in a page, and being
  thrown back to row 0 for it made the bottom of a book unworkable. Opening
  another book is the one thing that starts at the top, because it is another
  page.
- `⌘Z`/`⌘S` undo and save. Undo covers both verbs.
- A technology the rules object to is red in **both** panes — outlined on the
  page, and on its palette row — and every problem in the list is a button
  that flies to it.
- **Click a chip to cut what it names**, whether that is an unlock or a
  requirement. They go red under the pointer to say so.
- The status bar carries **each band's Gold and Knowledge total** — the
  price-band pass ([`features/tech-tree.md`](features/tech-tree.md) §5) used
  to be a spreadsheet formula and happens here now.

## 6. Saving

The Save button POSTs to `/__tree/save`, a **dev-only** Vite middleware
(`scripts/vite-tree-editor.mjs`, `apply: 'serve'`) that validates with the same
`techTreeRules.ts` the editor uses — loaded through Vite, so there is one copy
of the rules and no chance of the server accepting what the editor refused —
and writes `src/sim/data/tech-tree.json`. The endpoint cannot exist in a build.

`npm run balance` never touches this file, and the editor never writes
`balance.json`. Neither can overwrite the other.

## 7. Dials

| Dial | Where |
|---|---|
| a technology: everything about it | here |
| three columns, card and gutter sizes, the side channel | `src/ui/research/layout.ts` |
| what opens a band | the `Eras` sheet (`unlock_cells`) |
| what a district, unit or harvest source costs and does | the workbook, as ever |

## 8. What was deliberately not built

- **A new STAT.** A `bonus` may move any number the registry declares and aim
  it at anything that stat accepts, but something has to READ the number. The
  editor picks from the stats that exist.
- **A `mul` op.** Three of the hard-coded mechanics multiply an inner term.
  Giving them an op would make the resolver's one shape two shapes, so they
  stay `mechanic`.
- **Editing anything else's numbers.** A district's cost is the workbook's. The
  editor shows what a technology unlocks; it does not price it.
- **A free canvas.** Three columns and whole rows are what make a page fit a
  phone and a requirement mean depth. Pixel positions were what this replaced.
- **Auto-layout.** The one-off that seeded the current pages laid them out from
  the old graph; there is no button for it, because a designer arranging a page
  is the point of the tool.
- **Undo across a save.** Undo is the session's; the file's history is git's.
- **A per-technology prose override.** A written line beside the numbers it
  describes drifts the first time a ladder is rebalanced: 150 cards once
  shared 68 sentences, and five of them contradicted their own effects. A
  `mechanic` writes prose because its effect is code; nothing else needs the
  door open.
- **Drawing a technology that is off the page.** The file may hold one, and
  the game shows nothing of it — no card, no research, no gate. Where it goes
  is a decision the editor makes, not one the renderer guesses.
- **Renaming a technology's id.** A save holds completed ids, so a rename is a
  delete and a create — which the save reader survives (it drops ids the build
  no longer has), and which loses that technology's progress.
