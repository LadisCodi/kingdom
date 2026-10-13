Tech tree editor
---

> **Scope.** How technologies are authored — created, classified, priced,
> placed and connected. Covers the tech tree editor — the Tech tree collection
> of the data editor (`?dev=data#tree`, [`plans/data-editor.md`](plans/data-editor.md))
> — the shared rule module every consumer validates against, and the dev-only
> save path.
>
> **Status: built.** The tree
> this authors is designed in [`features/07-research.md`](features/07-research.md)
> and its content is [`features/tech-tree.md`](features/tech-tree.md).

## 1. What it is

- **A board, not a table**: each book is drawn as its page — three columns of
  slots, chapter bars between bands — and a technology is placed by dragging
  it into a slot.
- **A technology is one object, authored in one place**: identity, kind,
  unlocks or effects, price, slot and requirements, in
  `src/sim/data/tech-tree.json`.
- **Buildings, units and harvest sources name no technology**: a technology
  says what it opens, and every gate is derived from that (§3).
- What a technology **says** is not authored (§3.1).
- Every other number lives in the data editor's collections (invariant 5).

## 2. What a technology is

`src/sim/data/tech-tree.json`, one object per technology:

```json
"Saws": {
  "name": "Saws", "icon": "Sawmill", "kind": "unlock",
  "tome": "Kingdom", "era": 2, "row": 2, "col": 2,
  "requires": ["Agriculture"],
  "gold": 30, "knowledge": 2,
  "unlocks": [{ "district": "Sawmill" }]
}
```

Its card reads **"Unlocks the Sawmill"**, generated from what it does (§3.1).

| Field | Means |
|---|---|
| the key | the `TechId`. `TechId` **is** `keyof` this file |
| `name` · `icon` | what the player reads and sees; `icon` is a cell of the UI atlas by name, and `tests/icons.test.ts` refuses one that is not drawn |
| `description` | **`mechanic` only** (§3.1) |
| `kind` | `unlock`, `bonus` or `mechanic` (§3) |
| `tome` · `era` | which book, which band (chapter) |
| `row` · `col` | its slot on that book's three-column page |
| `requires` | one to three technologies, all on the **row immediately above**; none on a card on the page's first row |
| `gold` · `knowledge` | what it costs; both required, and Knowledge above 0 |
| `materials` · `goods` · `anyPrecious` | paid with the Gold: the city's Wood, Stone and Food; refined goods and precious materials by name; precious material of any kind — each omitted when empty |
| `unlocks` | `kind: unlock` only (§3) |
| `effects` | `kind: bonus` only (§3) |
| `planned` | on the page for its shape, does nothing yet |

Beside `technologies` the file holds, per book:

- **`eras`**: `[cells to open era 1, era 2, …]`. Its length is how many bands
  the book has; era 1 is always 0.
- **`eraRewards`**: what finishing each band pays, in relic fragments, or
  `null`. Same length as `eras`.

- `tome`, `era`, `row` and `col` are **absent together** on a technology taken
  **off the page** (§5). It still exists and saves; the game leaves it out
  entirely (§4).
- `definitions.ts` builds `TECHNOLOGIES` by walking this file; `TECH_ORDER`
  is its key order, which the save writes in reading order (book, then down
  the page, then left to right).
- It is written a few lines per technology, so a change shows in `git diff`
  as the technologies that changed.

## 3. The three kinds

### 3.1 What a card says

A technology's line is **generated from what it does**
(`src/sim/techProse.ts`):

| Kind | Its line | Example |
|---|---|---|
| `unlock` | `Unlocks …`, one clause per thing, with display names; building levels that share a number fold into one clause | *Unlocks Barracks, Spear Hall, Shooting Grounds and Stables at level 4* |
| `bonus` | one sentence per effect, from the stat's `says` in the registry | *+15% Wood per tap and delivery from a forest* |
| `mechanic` | its `description` | *Reading the ground — a bad matchup costs a tenth less.* |

In the game the line is read in the sheet a card opens
([`features/07-research.md`](features/07-research.md) §5.4); in the editor it
is on the card.

**`unlock` — it opens content.** Every gate in the game is derived from it
(`GATES`, `definitions.ts`):

| `unlocks` entry | The gate it becomes |
|---|---|
| `{ "district": "Sawmill" }` | `DISTRICTS.Sawmill.requiredTech` |
| `{ "districtLevel": { "id": "Housing", "level": 3 } }` | `DISTRICTS.Housing.requiredTechPerLevel[1]` |
| `{ "districtCount": "Sanctum" }` | `DISTRICTS.Sanctum.extraCountTech` — one more may stand |
| `{ "unit": "Archer" }` | `UNITS.Archer.requiredTech` |
| `{ "evolution": { "unit": "Archer", "rank": 3 } }` | the gate on training Archers III, beside its hall's level ([`features/combat.md`](features/combat.md) §6) |
| `{ "harvest": "Forest" }` | `HARVEST.Forest.requiredTech` |
| `{ "terrain": "Water" }` | `terrainGate('Water')` |
| `{ "worldUpgrade": "Fortress" }` | `worldUpgradeGate('Fortress')` — a new Fortress (or Chapel) on the world board; the city tells the server which it has opened |

- One technology per gate, counted on the page: two claiming one is an error.
- No technology opens a **book** (`TOME_OPENS`, `sim/research.ts`), and
  nothing but its chapter bar opens a band. A card that raises the Townhall's
  level is an ordinary `unlock`.

**`bonus` — it moves numbers, and names them.** Each effect is four fields:

| Field | Picked from |
|---|---|
| `stat` | the registry — every number the game can be told to move |
| `op` | `percent` or `flat`, narrowed to the ops that stat accepts |
| `value` | **positive**, in whole points for a percent — `10` is +10% |
| `target` | narrowed to the target kinds that stat accepts: a district, a unit, a unit tag, a harvest source, a tome, a kind of world district — or none, for every subject |

- The selects narrow each other: `unitAtk` offers `percent` only, aimed at
  everything or a unit tag.
- A stat may also narrow the **ids** of a kind (`regrowthSpeed` reaches the
  sources that grow back in place, not the berry bush). That narrowing is
  enforced by the rules, not the select: the dropdown lists every id, and
  `effectProblems` refuses the ones the stat cannot reach.
- A technology may carry several effects; most carry one.
- **Aim is exact.** An unaimed effect reaches every query of its stat; an
  aimed one only its own target — Irrigation I and II both aim
  `harvestYield` at `Crops` and sum, without touching the forest.

**Which numbers exist is code:**

| To… | Change |
|---|---|
| add a rank, or a bonus of a kind nothing has yet — "+5% gold at Housing" | nothing — the editor |
| move a **number nothing reads yet** | an entry in `TECH_STATS` (`src/sim/data/techEffectRules.ts`), including `says`, one sentence per op — then `techValue(state, 'yourStat', base, target?)` at the call site that owns it |
| let events or relics move the same number | a `ModifierStat` in `modifiers.ts` and a `resolve()` at that call site |

- The `stat` dropdown offers every stat the registry declares.
  `tests/techTree.test.ts` holds both ways: every declared stat is read by
  something in `src/sim`, and the file names only declared stats.

**`mechanic` — the code reads it by id**: `Tactics` softening a bad matchup,
`Transplanting` letting a tree be moved. The editor labels these; it cannot
write them.

## 4. The rules, in one module

`src/sim/data/techTreeRules.ts` is the one statement of what a legal tree is,
read by the editor as you drag, by the save endpoint before it writes, and by
`tests/techTree.test.ts` against the shipped file.

**Pending**: a technology **off the page** has no slot. It is counted, never
listed among the errors, and it does not block a save. Rules that depend on
where a card sits skip it; a card on the page that requires one off it is an
error. A saved technology with no slot is **not in the game**: no card, no
research, no gate.

**Errors:**

- an illegal id, or no name or icon;
- prose on a technology whose `unlocks` or `effects` already say what it does;
  no prose on a `mechanic`;
- two cards in one slot of one page;
- a tome that is not a tome, a band the book does not have, a column outside
  0–2; one row shared by two bands; a band that starts at or above the one
  before;
- **a band whose last row is not one card alone** — its finale;
- more than three requirements, or the same one twice; **no requirements on a
  card not on its page's first row**;
- a requirement in another tome, naming itself, or **not on the row
  immediately above**;
- a negative or fractional price; **a card that costs nothing, or no
  Knowledge**; `materials` naming anything but Wood, Stone or Food, or goods
  naming no good, or an amount that is not a whole number above 0;
- a book with no bands or more than ten; era 1 asking for any cells; a band
  asking for fewer cells than the one above;
- `eraRewards` not one entry per band, or an entry that is neither `null`
  nor a whole number above 0;
- a kind that disagrees with what the technology carries — an `unlock` that
  unlocks nothing, a `bonus` that moves nothing, an `unlock` or `mechanic`
  with effects, a `bonus` or `mechanic` with unlocks;
- an unlock naming a district, level, unit, rank, harvest source, terrain or
  world building that does not exist; two technologies on the page unlocking
  one thing;
- an effect naming a stat the registry does not have, an op or target kind
  that stat does not accept, a target id that does not exist or that the stat
  cannot reach, a value of 0 or below, a fractional percent;
- a ladder whose numerals skip one. A ladder is a name: rank II need not
  require rank I nor sit near it.

**Warnings**: a requirement on a `planned` technology.

**Nothing is refused.** The save reports what it found — errors, warnings,
cards off the page — and writes anyway. What ships is held by
`tests/techTree.test.ts`.

There is **no rule about connectors crossing cards**: the routing makes it
impossible ([`../src/ui/research/layout.ts`](../src/ui/research/layout.ts)).

## 5. Using it

`npm run dev`, then `?dev=data#tree` — the **Tech tree** collection of the
data editor, or the **🌳 tree** button on the `?dev` bar. `?dev=tree`
redirects there, and `?dev=data#tree/<id>` opens that technology on its page.
`← game` in the status bar goes back.

| Pane | What it holds |
|---|---|
| left | the open book first, then the others, with the filter box and **+ new technology**. Green: settled in a slot; red: the problem list is asking about it, and the tooltip says what |
| middle | the open book's page: three columns of slots, a header per band |
| right | the selected technology's fields, its unlocks or effects, and the problem list |

- **+ new technology** asks for an id, name, icon, kind, era and Gold — and
  prose only for a `mechanic`. It drops the card at the end of that band.
- **Drag** a technology from the palette or another slot onto a slot.
  Dropping onto an occupied slot **swaps** the two.
- **A drop sets the requirements**: the filled slot directly above, or the
  rest of that row when that slot is empty — never further up. It prefers a
  card that does something over a `planned` one.
- **Hover a card and two ports appear**, its input above and its output
  below. Press one, then a lit port on the row below (from an output) or above
  (from an input), to connect them; press the first port again, click the
  page, or `Esc` to let go.
- **Click a connector or a chip to cut it.** `⇢ link` connects cards that are
  not on neighbouring rows. `take the slot's default` puts the drop's guess
  back.
- **The inspector edits everything** — name, icon, price, kind, what it
  unlocks or moves, `planned`. Switching the kind clears the fields that no
  longer apply. A technology that says itself shows the sentence the player
  will read in place of the prose box; the first unlock or effect drops any
  prose, and says so (`⌘Z` puts it back).
- **`+ unlock`** picks a kind of thing, then which one (and the level).
  **`+ effect`** picks a stat, op, value, then what it aims at.
- **`+` and `−`** in the left channel open a row above or close an empty one;
  everything below renumbers.
- **Every band has a header**: what it asks for in revealed cells, the relic
  fragments finishing it pays (0 for nothing), and the 🗑 that drops it — its
  cards go to the palette and every band below shifts up one, cards,
  thresholds and rewards together. A book keeps at least one band.
- A band added pays nothing until its header says so.
- **`+ era`** adds a band at the end, opening at the cells the band above asks
  for.
- The last row of each band is an empty **spare row**; dropping into it pushes
  the bands below down a line.
- **`⤴ take off the page`** (or `Delete`) frees the slot and keeps the
  technology, minus its requirements; it waits in the **off the page** group.
  **`🗑 delete for good`** ends it and every requirement pointing at it.
- **`⤴ clear era…`** takes a whole band off the page, after asking with the
  count; it is one undo.
- Each pane keeps its scroll across a redraw; opening another book starts at
  the top.
- `⌘Z` / `⌘S` undo and save.
- A technology the rules object to is red on the page and in the palette;
  every problem in the list flies to it.
- The status bar carries **each band's card count, Gold and Knowledge** — the
  price pass ([`features/tech-tree.md`](features/tech-tree.md) §1) happens
  here.

## 6. Saving

- Save POSTs to `/__tree/save`, a **dev-only** Vite middleware
  (`scripts/vite-tree-editor.mjs`, `apply: 'serve'`), which validates with the
  same `techTreeRules.ts`, loaded through Vite, and writes
  `src/sim/data/tech-tree.json`. The endpoint cannot exist in a build.
- **A saved file is an event, not a reload** (`kingdom:data`): the game
  reloads on it.

## 7. Dials

| Dial | Where |
|---|---|
| a technology: everything about it | here |
| what opens a band | the band header's cells, saved as the book's `eras` |
| what finishing a band pays | the band header's fragments, saved as the book's `eraRewards` |
| three columns, card and gutter sizes, the side channel | `src/ui/research/layout.ts` |
| what a district, unit or harvest source costs and does | its collection in `?dev=data` |

## 8. Deliberately not in this design

- **A new stat.** A `bonus` may move any number the registry declares; the
  editor picks from the stats that exist.
- **A `mul` op.** The mechanics that multiply an inner term stay `mechanic`.
- **Editing anything else's numbers.** A district's cost is its entry in
  Buildings.
- **A free canvas** or **auto-layout**: three columns and whole rows, placed
  by a designer.
- **Undo across a save.** The file's history is git's.
- **A per-technology prose override** beside generated text.
- **Drawing a technology that is off the page.**
- **Renaming a technology's id.** A rename is a delete and a create; a save
  holding the old id drops it, and its progress, on load.
