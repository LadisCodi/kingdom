Data editor — replacing the balance workbook
---

> **Scope.** `?dev=data`: one tool for every piece of game data, and the
> migration that retires `balance/balance.xlsx`.
>
> **Status: phases 1 and 2 built.** The balance collections read
> `balance.json`, edit in memory, validate and show the diff; they do not save.
> The map and the tech tree are collections of the tool and save to their own
> files.

## 1. What it is

- One tool, `?dev=data`, for everything a designer can change: numbers, the
  map and the tech tree.
- A **rail** of collections grouped by game domain (World, City, Research,
  Army, Magic, Progression, Store). Settings sit with the system that reads
  them.
- Each collection has a **kind**, and the kind decides its view:
  - **Entity** — few entries, many fields, a look (buildings).
  - **Table** — many entries, same few fields.
  - **Ordered list** — the order is data (quests).
  - **Settings** — one-of-a-kind values, grouped.
  - **Canvas** — authored by position (map, tech tree).
- A **breadcrumb**: each crumb goes up; its ▾ lists its siblings.
- **Ctrl K** jumps to any collection, entry, field or command.
- Every reference is a link, with **Used by** back. Renaming an id renames
  every reference to it.
- Every screen is a URL hash (`?dev=data#buildings/Sawmill/levels`).
- Per-level numbers are cells. A chart draws the table; it stores nothing.
- The **Grid** view lays one ladder across every building for bulk edits
  (×, +, =, round to 3 s.f., copy). No formulas.
- A **Schema** view per collection: each field's type, range, length rule
  and meaning.

## 2. Where the rules live

- `src/sim/data/dataRules.ts` — the registry of collections, the schema
  (inferred from the data, sharpened by overrides) and the validator.
  `tests/dataRules.test.ts` holds the shipped data to zero errors.
- `src/editor/data/doc.ts` — the working copy: set by path, batched undo,
  diff against the document as loaded.
- `src/editor/data/mount.ts` — the tool.

## 3. Phases

1. **The tool beside the workbook.** New files only. Reads `balance.json`;
   cannot save, because `npm run dev` regenerates that file from the xlsx.
2. **Map and tech tree become collections of Data.** Each is its own editor
   hosted in the tool's main area, kept alive while other collections are
   shown, saving through its own endpoint. `?dev=map` and `?dev=tree`
   redirect to `?dev=data#map` and `?dev=data#tree`; `#tree/<id>` opens a
   technology on its page, which is where every link to one lands.
3. **The migration, in one change.** A one-off script writes one JSON file
   per collection and a schema file per collection; saving is switched on;
   `balance.xlsx`, `scripts/balance.mjs`, `balance.json` and the `balance`
   commands are deleted; `definitions.ts` reads the new files; building
   visuals (art tiers, crew) and identity (name, description, glyph) become
   fields; new fields can be added from the Schema view. `CLAUDE.md`
   invariant 5 becomes: *`?dev=data` is the source of truth for every piece
   of game data; the schema says what is legal, and the editor, the save
   endpoint and a test check it.*

## 4. Decided

- The workbook goes entirely. No xlsx import or export.
- No formulas between cells; outside calculations are pasted in as values.
- The tool creates entries and fields, never collections. A new collection
  is a new game element, and its view in Data ships with it.
- The migration happens in one change.
