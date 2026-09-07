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

- **The sheet showed ids, not the page.** `requires = CharterII, Roadworks` is
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
(invariant 5). A technology is not one: it is identity, prose, a kind, a set
of unlocks, a price, a slot and a set of edges — one object, authored in one
place.

## 2. What a technology is

`src/sim/data/tech-tree.json`, one object per technology:

```json
"Saws": {
  "name": "Saws", "glyph": "🪚", "kind": "unlock",
  "description": "Unlocks the Sawmill — its workers chop nearby forests for you.",
  "tome": "Civics", "era": 1, "row": 2, "col": 0,
  "requires": ["CharterI"],
  "gold": 175, "seconds": 20,
  "unlocks": [{ "district": "Sawmill" }]
}
```

| Field | Means |
|---|---|
| the key | the `TechId`. `TechId` **is** `keyof` this file, so a new one is a type the moment it is saved |
| `name` · `glyph` · `description` | what the player reads |
| `kind` | `unlock`, `bonus` or `mechanic` (§3) |
| `tome` · `era` | which book, which band |
| `row` · `col` | its slot on that book's three-column page; a requirement always sits on a smaller row |
| `requires` | one to three technologies — none on a cover page, and none needed by anything on the page's first row |
| `gold` · `knowledge` · `seconds` | what it costs and how long it takes; `knowledge` omitted when 0 |
| `unlocks` | `kind: unlock` only (§3) |
| `line` · `effectPerRank` | `kind: bonus` only (§3) |
| `planned` | on the tree for its shape, does nothing yet |

- `tome`, `era`, `row` and `col` are **absent together** on a technology taken
  OFF THE PAGE (§5). It still exists and is still editable; the rules call it
  an error, so the repo never holds one.
- `definitions.ts` builds `TECHNOLOGIES` by walking this file, and `TECH_ORDER`
  is its key order — which the editor writes in reading order, so it is also
  rank order inside a minor line.
- It is written a few lines per technology, in reading order, so a change shows
  up in `git diff` as the technologies that changed.

## 3. The three kinds

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

**`bonus` — it moves one number.** A rank on a minor line: pick the `line` and
set `effectPerRank`. Every rank of a line is worth the same, because `effect()`
multiplies the completed rank count by the FIRST rank's number, and the step is
fractional — `0.1` is +10% tax income, `0.05` is −0.05s between auto-taps.
Rank N belongs in era N, and rank N requires rank N−1, which is the ladder
`lineRank` counts off.

**Which HOOK a line reaches is code**, and that is the one half of a bonus the
editor cannot author:

| To… | Change |
|---|---|
| add a rank to a line that exists | nothing — the editor |
| add a **new line** | `TECH_LINE_IDS` in `src/sim/data/techTreeRules.ts` (`TechLineId` is derived from it), then `+ effect(state, 'YourLine')` at the call site that owns the number (`src/sim/upgrades.ts` holds most of them) |
| let events or relics move the same number | a `ModifierStat` in `modifiers.ts` and a `resolve()` at that call site |

The `line` dropdown offers every line `TECH_LINE_IDS` declares, whether or not
a technology carries one yet — so a line added in code is pickable
immediately. `tests/techTree.test.ts` closes the loop both ways: every
declared line must be read by something in `src/sim`, and the file may only
name a line the code declares.

**`mechanic` — the code reads it by id.** A cover page opening its book,
`Conquest` bending the Knowledge rate, `SanctifiedRuins` doubling the per-ruin
drip. The editor can label these; it cannot write them. **A brand-new effect
is always a code change** — what the editor buys you is that everything
*around* it is not.

## 4. The rules, in one module

`src/sim/data/techTreeRules.ts` is the one statement of what a legal tree is,
read by the editor as you drag, by the save endpoint before it writes, and by
`tests/techTree.test.ts` against the shipped file. A rule added there is
enforced in all three or in none.

**Errors** (a save is refused):

- an illegal id, or no name, glyph or description
- a technology **off the page** — one error for it, not four, and one on
  anything still waiting for it
- two cards in one slot of one page (the same slot on another page is fine)
- a tome that is not a tome, a band outside 1–4, a column outside 0–2
- one row shared by two eras — an era bar takes a whole line
- more than three requirements; a cover page with any; **no requirements on a
  card that is not on its page's first row** — the first row is where a root
  belongs, because there is nothing above it to require
- a requirement in another tome, at or below the card, or naming itself
- a band that starts at or above the one before it
- a negative or fractional price; anything free that is not a cover page;
  Knowledge charged in era 1, where the clock has not started
- a kind that disagrees with what the technology carries — an `unlock` that
  unlocks nothing (unless `planned`), a `bonus` with no line or worth 0, a
  `mechanic` that carries either
- an unlock naming a district, level, unit, harvest source or terrain that
  does not exist; two technologies unlocking one thing
- a minor rank that does not require the rank before it, or is worth a
  different amount from the rest of its line

**Warnings** (a save goes through): a requirement on a `planned` technology,
which does nothing yet.

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

- **+ new technology** asks for an id, name, glyph, prose, kind, era, Gold and
  seconds, and drops the result at the end of that band — placed, because a
  technology with no slot is one the game cannot draw. Then say what it
  unlocks; the problem list will be asking you to.
- **Drag** a technology from the palette (or from another slot) onto a slot.
  Dropping onto an occupied slot **swaps** the two.
- **A drop sets the requirements**: the filled slot directly above the target,
  or the whole of the nearest row above when that one is empty. That is the
  converge-and-fan the flow chart is made of, and it is a starting point, not
  a verdict.
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
- **Everything in the inspector is editable** — name, glyph, prose, Gold,
  Knowledge, seconds, kind, line, per-rank effect, `planned`. Switching the
  kind clears the fields that no longer mean anything.
- **`+ unlock`** adds one: pick what kind of thing, then which one (and which
  level, for a building level). Click a chip to cut it.
- **`+` and `−`** in the left channel open a gap above a row and close an empty
  one. Everything below renumbers; nothing else moves.
- The last row of each band is an empty **spare row**. Dropping into it pushes
  the bands below down a line.
- **Off the page is not deleted.** `⤴ take off the page` (or `Delete`) lets go
  of the slot and keeps the technology — its prose, price, kind and unlocks all
  survive; only where it sat, and what it required, do not. It waits in the
  **off the page** group at the top of the palette, and the tree cannot be
  saved while anything is there, which is what keeps the holding pen inside one
  session. Drag it into a slot and the slot hands it new requirements.
  `🗑 delete for good` is the other verb: it ends the technology, and every
  requirement pointing at it.
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

- **A new effect.** A `bonus` reaches an existing hook and a `mechanic` is read
  by id; both are code. The editor authors everything around an effect, never
  the effect.
- **A new minor line.** `TechLineId` is a union and a line's hook is a call
  site, so the editor picks from the lines that exist.
- **Editing anything else's numbers.** A district's cost is the workbook's. The
  editor shows what a technology unlocks; it does not price it.
- **A free canvas.** Three columns and whole rows are what make a page fit a
  phone and a requirement mean depth. Pixel positions were what this replaced.
- **Auto-layout.** The one-off that seeded the current pages laid them out from
  the old graph; there is no button for it, because a designer arranging a page
  is the point of the tool.
- **Undo across a save.** Undo is the session's; the file's history is git's.
- **Shipping a technology that is off the page.** The state exists for the
  minutes a book is being rearranged, and the rules refuse to save it — a
  technology the game cannot draw is not a state the repo can hold.
- **Renaming a technology's id.** A save holds completed ids, so a rename is a
  delete and a create — which the save reader survives (it drops ids the build
  no longer has), and which loses that technology's progress.
