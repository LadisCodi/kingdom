// The tree editor's working copy of `tech-tree.json`, plus undo.
//
// Same arrangement as the map editor's MapDoc, and for the same reasons: the
// validation a designer is looking at is the REAL one — `validateTechTree`,
// the module the save endpoint and `tests/techTree.test.ts` also call, never
// an editor-side approximation — and undo is whole-document snapshots because
// a 60 KB structuredClone per edit is free at this size and a diff stack
// would be the thing quietly getting a case wrong.
//
// The file holds the WHOLE technology now (identity, kind, unlocks, price,
// clock, slot, requirements), so this is where a technology is born and dies.
// Everything that decides one is here; the renderer in mount.ts asks
// questions and calls these, and never reaches into the document.

import {
  MAX_ERA, MAX_REQUIRES, TECH_KINDS, TECH_LINE_IDS, isCoverPage, isPlaced, isTechId, techIds,
  validateTechTree,
  type PlacedTech, type TechKind, type TechNodeDoc, type TechTreeDoc, type TechTreeValidation,
  type TechUnlock,
} from '../../sim/data/techTreeRules';
import { authoredRows, COLS, type PageRow } from '../../ui/research/layout';
import type { TomeId } from '../../sim/state';

const MAX_UNDO = 200;

export const ERAS: number[] = Array.from({ length: MAX_ERA }, (_, i) => i + 1);

/** What a band of one book costs, for the pass the spreadsheet used to do. */
export interface BandTotals {
  era: number;
  count: number;
  gold: number;
  knowledge: number;
  seconds: number;
}

export class TreeDoc {
  private doc: TechTreeDoc;
  private past: string[] = [];
  private future: string[] = [];
  private revision = 0;
  private derivedAt = -1;
  private cachedValidation!: TechTreeValidation;
  /** The document as last written to disk, so "dirty" is a fact, not a flag. */
  private savedText: string;

  constructor(initial: TechTreeDoc) {
    this.doc = { technologies: structuredClone(initial.technologies) };
    this.savedText = this.serialise();
  }

  // ------------------------------------------------------------- reading

  get document(): TechTreeDoc { return this.doc; }

  /** Every technology, in file order — which is reading order. */
  get ids(): string[] { return techIds(this.doc); }

  node(id: string): TechNodeDoc | null { return this.doc.technologies[id] ?? null; }

  /** Every technology with no slot — taken off the page, or newly arrived and
   *  not put anywhere yet. The rules make each of them an error, so this is
   *  also the list blocking the save. */
  get offPage(): string[] {
    return this.ids.filter((id) => !isPlaced(this.doc.technologies[id]));
  }

  placed(id: string): boolean {
    const node = this.doc.technologies[id];
    return node !== undefined && isPlaced(node);
  }

  /**
   * Every minor line the GAME has — not just the ones already in use.
   *
   * A line's HOOK is a call site (`effect(state, 'X')`), so the editor may
   * only put a rank on a line that exists in the code; `TECH_LINE_IDS` is that
   * list. Reading the file instead would have made a line added to the code
   * unpickable until something already carried it, which is the wrong way
   * round for the one gesture that needs both halves.
   */
  get lines(): string[] {
    return [...TECH_LINE_IDS].sort();
  }

  get validation(): TechTreeValidation {
    if (this.derivedAt !== this.revision) {
      this.cachedValidation = validateTechTree(this.doc);
      this.derivedAt = this.revision;
    }
    return this.cachedValidation;
  }

  /** The page as the editor draws it: every authored row of every band, plus
   *  a spare row at the end of each band to drop into. */
  rows(tome: TomeId): PageRow[] {
    return authoredRows(this.doc.technologies, tome, ERAS);
  }

  /** What sits in a slot, or null. */
  at(tome: TomeId, row: number, col: number): string | null {
    for (const [id, node] of Object.entries(this.doc.technologies)) {
      if (node.tome === tome && node.row === row && node.col === col) return id;
    }
    return null;
  }

  /**
   * What each band of one book costs.
   *
   * The `Technologies` sheet is gone, so the price-band pass — "is era 2
   * really ten times era 1" (Docs/features/tech-tree.md §5) — has nowhere
   * else to happen. It happens here.
   */
  totals(tome: TomeId): BandTotals[] {
    return ERAS.map((era) => {
      const band = this.ids.filter((id) => {
        const node = this.doc.technologies[id];
        return node.tome === tome && node.era === era;
      });
      return {
        era,
        count: band.length,
        gold: band.reduce((sum, id) => sum + (this.doc.technologies[id].gold ?? 0), 0),
        knowledge: band.reduce((sum, id) => sum + (this.doc.technologies[id].knowledge ?? 0), 0),
        seconds: band.reduce((sum, id) => sum + (this.doc.technologies[id].seconds ?? 0), 0),
      };
    });
  }

  get dirty(): boolean { return this.serialise() !== this.savedText; }
  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }

  serialise(): string { return JSON.stringify(this.doc.technologies); }

  markSaved(): void { this.savedText = this.serialise(); }

  // ------------------------------------------------------------- writing

  private edit(mutate: () => void): void {
    this.past.push(this.serialise());
    if (this.past.length > MAX_UNDO) this.past.shift();
    this.future = [];
    mutate();
    this.revision += 1;
  }

  undo(): void { this.step(this.past, this.future); }
  redo(): void { this.step(this.future, this.past); }

  private step(from: string[], to: string[]): void {
    const text = from.pop();
    if (text === undefined) return;
    to.push(this.serialise());
    this.doc = { technologies: JSON.parse(text) as Record<string, TechNodeDoc> };
    this.revision += 1;
  }

  /**
   * A brand-new technology, placed at the end of a band.
   *
   * It is placed rather than left in limbo because a technology with no slot
   * is one the game cannot draw — the rules would refuse the save either way,
   * and a card you can see is a card you can drag. Returns an error message,
   * or null.
   */
  create(id: string, tome: TomeId, era: number, fields: Partial<TechNodeDoc>): string | null {
    if (!isTechId(id)) return `"${id}" is not a legal id — start with a capital, letters only`;
    if (this.doc.technologies[id] !== undefined) return `${id} already exists`;
    const slot = this.freeSlot(tome, era);
    this.edit(() => {
      // Only if the band had no room left: `pushDown` decides.
      this.pushDown(tome, era, slot.row);
      this.doc.technologies[id] = {
        name: fields.name?.trim() || id,
        glyph: fields.glyph?.trim() || '📜',
        description: fields.description?.trim() || '',
        kind: fields.kind ?? 'unlock',
        tome,
        era,
        row: slot.row,
        col: slot.col,
        requires: [],
        gold: fields.gold ?? 0,
        seconds: fields.seconds ?? 0,
        ...(fields.knowledge ? { knowledge: fields.knowledge } : {}),
      };
      const node = this.doc.technologies[id];
      if (node.requires.length === 0 && !isCoverPage(id)) {
        node.requires = this.defaultRequires(tome, slot.row, slot.col);
      }
    });
    return null;
  }

  /**
   * Take a technology OFF THE PAGE without deleting it.
   *
   * It keeps everything that makes it a technology — prose, price, kind,
   * unlocks — and loses only where it sat. Its requirements go too, because
   * "above me on the page" is exactly what it no longer has, and so does
   * every requirement pointing AT it: a card cannot wait on something that is
   * nowhere. Put it back with a drag and the slot hands it new ones.
   *
   * The rules call this an error, so a tree with anything off the page cannot
   * be saved — which is the difference from deleting: this is a holding pen
   * inside one session's work, not a state the repo can hold.
   */
  unplace(id: string): void {
    this.edit(() => {
      const node = this.doc.technologies[id];
      if (node === undefined) return;
      delete node.tome;
      delete node.era;
      delete node.row;
      delete node.col;
      node.requires = [];
      for (const [other, waiting] of Object.entries(this.doc.technologies)) {
        if (!waiting.requires.includes(id)) continue;
        waiting.requires = waiting.requires.filter((req) => req !== id);
        if (waiting.requires.length === 0 && !isCoverPage(other) && isPlaced(waiting)) {
          waiting.requires = this.defaultRequires(waiting.tome, waiting.row, waiting.col);
        }
      }
    });
  }

  /** Delete a technology outright, and every requirement pointing at it. */
  remove(id: string): void {
    this.edit(() => {
      delete this.doc.technologies[id];
      for (const [other, node] of Object.entries(this.doc.technologies)) {
        if (!node.requires.includes(id)) continue;
        node.requires = node.requires.filter((req) => req !== id);
        // A card the deletion left with nothing takes its slot's default, so
        // one delete never leaves the page in a state the rules refuse.
        if (node.requires.length === 0 && !isCoverPage(other) && isPlaced(node)) {
          node.requires = this.defaultRequires(node.tome, node.row, node.col);
        }
      }
    });
  }

  /** Change anything about a technology except where it sits. */
  update(id: string, patch: Partial<TechNodeDoc>): void {
    this.edit(() => {
      const node = this.doc.technologies[id];
      if (node === undefined) return;
      Object.assign(node, patch);
      // The kind decides which fields mean anything, so switching it clears
      // the ones that no longer do — a bonus that used to be an unlock must
      // not keep a stale district on it.
      if (node.kind !== 'unlock') delete node.unlocks;
      if (node.kind !== 'bonus') { delete node.line; delete node.effectPerRank; }
      if (node.knowledge === 0) delete node.knowledge;
      if (node.planned !== true) delete node.planned;
      if (node.unlocks?.length === 0) delete node.unlocks;
    });
  }

  setKind(id: string, kind: TechKind): void {
    if (!TECH_KINDS.includes(kind)) return;
    this.update(id, { kind });
  }

  addUnlock(id: string, unlock: TechUnlock): void {
    const node = this.doc.technologies[id];
    if (node === undefined) return;
    this.update(id, { kind: 'unlock', unlocks: [...(node.unlocks ?? []), unlock] });
  }

  removeUnlock(id: string, index: number): void {
    const node = this.doc.technologies[id];
    if (node === undefined) return;
    this.update(id, { unlocks: (node.unlocks ?? []).filter((_, i) => i !== index) });
  }

  /**
   * Put a technology in a slot — the editor's other whole gesture.
   *
   * Requirements come with the slot, which is the point of dragging into one:
   * the card takes the filled slot directly above it, or the whole row above
   * when that one is empty (Docs/tech-tree-editor.md §4). A MOVE keeps what it
   * had and only drops the requirements the move has made illegal — one that
   * now sits at or below the card cannot be drawn or satisfied.
   */
  place(id: string, tome: TomeId, era: number, row: number, col: number): void {
    this.edit(() => {
      const nodes = this.doc.technologies;
      const before = nodes[id];
      if (before === undefined) return;
      const from = { tome: before.tome, era: before.era, row: before.row, col: before.col };
      this.pushDown(tome, era, row, id);
      const occupant = Object.entries(nodes)
        .find(([o, n]) => o !== id && n.tome === tome && n.row === row && n.col === col);
      if (occupant !== undefined) {
        // A swap, not a silent overwrite: the card already there goes where
        // this one came from — and when this one came from OFF THE PAGE, that
        // is where the occupant goes. Trading places with nothing is being
        // taken off the page.
        if (isPlaced(before)) Object.assign(occupant[1], from);
        else {
          delete occupant[1].tome;
          delete occupant[1].era;
          delete occupant[1].row;
          delete occupant[1].col;
          occupant[1].requires = [];
        }
      }
      Object.assign(nodes[id], { tome, era, row, col });
      // Anything that reached DOWN to this card is now illegal; so is any
      // requirement of its own that no longer sits above it.
      for (const [other, node] of Object.entries(nodes)) {
        node.requires = node.requires.filter((req) => this.reachable(other, req));
        if (node.requires.length === 0 && !isCoverPage(other) && isPlaced(node)) {
          node.requires = this.defaultRequires(node.tome, node.row, node.col);
        }
      }
    });
  }

  setRequires(id: string, requires: string[]): void {
    this.edit(() => {
      const node = this.doc.technologies[id];
      if (node === undefined) return;
      node.requires = requires.filter((req) => this.reachable(id, req)).slice(0, MAX_REQUIRES);
    });
  }

  /**
   * Add one requirement — what a port-to-port connection means.
   *
   * Separate from `toggleRequirement` because a port says "connect these",
   * never "disconnect these": cutting has two affordances of its own (the
   * connector, and the chip in the inspector), and a gesture that silently
   * undid a link would be the one that surprises. Returns why not, or null.
   */
  require(id: string, req: string): string | null {
    const node = this.doc.technologies[id];
    if (node === undefined) return `${id} is gone`;
    if (!this.reachable(id, req)) return `${req} does not sit above ${id} on this page`;
    if (node.requires.includes(req)) return `${id} already requires ${req}`;
    if (node.requires.length >= MAX_REQUIRES) {
      return `${id} already has ${MAX_REQUIRES} requirements — cut one first`;
    }
    this.edit(() => { node.requires = [...node.requires, req]; });
    return null;
  }

  toggleRequirement(id: string, req: string): void {
    const node = this.doc.technologies[id];
    if (node === undefined) return;
    const has = node.requires.includes(req);
    this.setRequires(id, has
      ? node.requires.filter((r) => r !== req)
      : [...node.requires, req]);
  }

  /** Open a gap at `row` by pushing everything below it down one line. */
  insertRow(tome: TomeId, row: number): void {
    this.edit(() => {
      for (const node of Object.values(this.doc.technologies)) {
        if (node.tome === tome && node.row !== undefined && node.row >= row) node.row += 1;
      }
    });
  }

  /** Close an EMPTY row: everything below it comes up one line. */
  removeRow(tome: TomeId, row: number): void {
    if (Object.values(this.doc.technologies).some(
      (n) => n.tome === tome && n.row === row)) return;
    this.edit(() => {
      for (const node of Object.values(this.doc.technologies)) {
        if (node.tome === tome && node.row !== undefined && node.row > row) node.row -= 1;
      }
    });
  }

  // ------------------------------------------------------------- helpers

  /**
   * Make room at `row` for a card joining `era`.
   *
   * Only when the row is BEYOND the band's last one — a drop into a band's
   * spare row, which shares its number with the next band's first. Landing in
   * a row the band already occupies needs no room made, and pushing then
   * moved every later band down a line for nothing.
   */
  private pushDown(tome: TomeId, era: number, row: number, except?: string): void {
    const last = Object.entries(this.doc.technologies)
      .filter(([other, node]) => other !== except && node.tome === tome && node.era === era)
      .reduce((max, [, node]) => Math.max(max, node.row ?? -1), -1);
    if (row <= last) return;
    for (const [other, node] of Object.entries(this.doc.technologies)) {
      if (other === except || node.tome !== tome) continue;
      if (node.era === undefined || node.row === undefined) continue;
      if (node.era > era && node.row >= row) node.row += 1;
    }
  }

  /** The first free slot at the end of a band — where a new card lands. */
  private freeSlot(tome: TomeId, era: number): { row: number; col: number } {
    const band = this.ids
      .map((id) => this.doc.technologies[id])
      .filter((node) => node.tome === tome && node.era === era);
    if (band.length === 0) {
      // An empty band starts below everything above it.
      const above = this.ids
        .map((id) => this.doc.technologies[id])
        .filter((node) => node.tome === tome && (node.era ?? MAX_ERA) < era)
        .reduce((max, node) => Math.max(max, node.row ?? -1), -1);
      return { row: above + 1, col: 1 };
    }
    const last = band.reduce((max, node) => Math.max(max, node.row ?? 0), 0);
    for (let col = 0; col < COLS; col++) {
      if (this.at(tome, last, col) === null) return { row: last, col };
    }
    return { row: last + 1, col: 1 };
  }

  /** Could `req` be a requirement of `id` — same page, further up it? */
  reachable(id: string, req: string): boolean {
    const to = this.doc.technologies[id];
    const from = this.doc.technologies[req];
    if (to === undefined || from === undefined || id === req) return false;
    // Off the page is off the graph: there is no "above" either way.
    if (!isPlaced(to) || !isPlaced(from)) return false;
    return from.tome === to.tome && from.row < to.row;
  }

  /**
   * What a card dropped into a slot requires, before anyone edits it.
   *
   * The filled slot directly above, when there is one — a chain read straight
   * down a column is the commonest thing a designer draws. Otherwise the
   * whole of the nearest row above, which is the converge the flow chart is
   * made of. Nothing above means nothing required, which only a cover page is
   * allowed to be.
   */
  defaultRequires(tome: TomeId, row: number, col: number): string[] {
    const rows = [...new Set(Object.values(this.doc.technologies)
      .filter((n): n is PlacedTech => isPlaced(n) && n.tome === tome && n.row < row)
      .map((n) => n.row))].sort((a, b) => b - a);
    const above = rows[0];
    if (above === undefined) return [];
    const straight = this.at(tome, above, col);
    if (straight !== null) return [straight];
    const whole: string[] = [];
    for (let c = 0; c < COLS; c++) {
      const id = this.at(tome, above, c);
      if (id !== null) whole.push(id);
    }
    return whole.slice(0, MAX_REQUIRES);
  }
}
