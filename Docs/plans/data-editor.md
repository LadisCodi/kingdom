Data editor
---

> **Scope.** `?dev=data`: the one tool every piece of game data is authored
> in — its collections, views and navigation, the files it writes, and the
> module that says what legal data is. The map and the tech tree are boards
> inside it ([`../map-editor.md`](../map-editor.md),
> [`../tech-tree-editor.md`](../tech-tree-editor.md)).
>
> **Status: built.** There is no workbook.

## 1. What it is

- One tool, `?dev=data`, for everything a designer can change. It replaces the
  game in the page, like the other dev tools; `?dev=map` and `?dev=tree`
  redirect into it.
- A **rail** of collections grouped by game domain (World, City, Research,
  Army, Magic, Progression, Store). Settings sit with the system that reads
  them.
- Each collection has a **kind**, and the kind decides its view:
  - **Entity** — few entries, many fields, a look (Buildings): a level table
    with a chart, a Grid of one field across every entry, and tabs for
    identity, visuals, adjacency and the technologies that gate it.
  - **Table** — many entries, same few fields; a row opens in the inspector.
  - **Ordered list** — the order is data (Quests); drag to reorder.
  - **Settings** — one-of-a-kind values, grouped.
  - **Canvas** — authored by position (Region map, Tech tree): the editor is
    hosted whole and kept alive while other collections are shown.
- Every collection also has a **Schema** view (§3).
- A **breadcrumb**: each crumb goes up; its ▾ lists its siblings.
- **Ctrl K** jumps to any collection, entry, field or command.
- Every reference is a link, with **Used by** back. Renaming an id renames
  every reference to it.
- Every screen is a URL hash (`?dev=data#buildings/Sawmill/levels`,
  `#tree/<id>` for a technology on its page).
- Per-level numbers are cells. A chart draws the table; it stores nothing.
- Bulk edits in the Grid: ×, +, =, round to 3 s.f., copy. No formulas.
- **Undo / redo** per collection kind: the hosted boards keep their own.

## 2. Files

- One file per collection: `src/sim/data/game/<collection>.json`.
- One schema per collection: `src/sim/data/schema/<collection>.json`.
- `src/sim/data/balance.ts` puts the files back into the one object
  `definitions.ts` reads.
- Every file is written by `formatData`: the root and each entry one key per
  line, anything short enough on one line. A changed number is one changed
  line in `git diff`.
- A **building is whole** in `buildings.json`: name, promise, description,
  glyph, sprite, crew, what it harvests and trains, and every number. Art
  tiers are files: a level draws the highest `<sprite>_l<n>.png` at or below
  it. `DistrictId` is the file's keys; the build menu reads `buildable`,
  `produces` and `harmonySupply`.

## 3. Schema

- A field has a type (`int`, `float`, `text`, `bool`, `list`, `map`,
  `object`) and may carry: what it names (`ref`, `keysRef`), `options`, `min`,
  `max`, `maxLength`, a length rule (exact, or tied to `maxLevel` or the
  Townhall's max level), `nullable`, and a `doc`.
- The Schema view edits a field's type (int / float), range and meaning in
  place.
- **+ Field** adds a field to the schema and, unless optional, to every entry
  with its default: a number, text, on/off, an id of a kind, one of a list, a
  per-level ladder, an amount per currency or per good.
- **Read by** lists every source file that names a field. One nothing reads is
  marked, and only such a field can be removed.
- The tool creates entries and fields, never collections. A new collection is
  a new game element: its file, its line in `balance.ts`, its entry in
  `COLLECTIONS` (`dataRules.ts`) and the code that uses it ship together.

## 4. Rules, saving and reloads

- `src/sim/data/dataRules.ts` holds the registry of collections, the schema
  loader, the validator and the formatter. The tool, the save endpoint and
  `tests/dataRules.test.ts` read it.
- The tool validates as you type; problems show on the field, the entry, the
  rail and the top bar.
- **Save** (Ctrl S) posts the changed collections to `/__data/save`
  (`scripts/vite-data-editor.mjs`, dev only). It validates the whole document,
  **refuses one with errors**, and writes only the files whose text changed.
- `tests/dataRules.test.ts` holds the shipped data to zero errors, every file
  to exactly what a save writes, and one data and one schema file per
  collection.
- A data file changing is a **`kingdom:data` event**, not a module reload,
  naming who wrote it. The game reloads on it. The tool ignores its own saves
  and its boards'; a change from disk reloads it when nothing is unsaved, and
  otherwise shows **changed on disk · reload**.

## 5. Deliberately not in this design

- An xlsx import or export: one writable home per fact.
- Formulas between cells: outside calculations are pasted in as values.
- Collections created from the tool (§3).
- Art tiers as data: the files on disk are the truth.
