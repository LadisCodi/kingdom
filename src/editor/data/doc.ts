// `?dev=data`'s working copy of the game's data: the document as loaded, the
// document as edited, an undo stack, and the diff between the two.
//
// DOM-free so tests can drive it. Every edit is a `set(path, value)` on the
// whole document — a path is the list of keys from the root
// (['districts', 'Sawmill', 'costPerLevel', 5, 'cost', 'Wood']) — so undo is
// one stack of (path, before) pairs and the diff is a walk of two trees.

import { getAt, type DataDoc } from '../../sim/data/dataRules';

export type Path = ReadonlyArray<string | number>;

export interface Change {
  path: Path;
  before: unknown;
  after: unknown;
}

interface Step { path: Path; before: unknown; existed: boolean }

export class DataModel {
  readonly reference: DataDoc;
  doc: DataDoc;
  private undoStack: Step[][] = [];
  private redoStack: Step[][] = [];
  private listeners = new Set<() => void>();

  constructor(source: DataDoc) {
    this.reference = structuredClone(source);
    this.doc = structuredClone(source);
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void { for (const fn of this.listeners) fn(); }

  get(path: Path): unknown { return getAt(this.doc, path); }

  /** Set one value. `undefined` deletes a map key. Grouped into one undo step
   *  with any other `set` inside the same `batch`. */
  set(path: Path, value: unknown): void {
    this.batch(() => this.write(path, value));
  }

  private pending: Step[] | null = null;

  /** Run several writes as ONE undo step (a bulk ×1.1, a rename). */
  batch(fn: () => void): void {
    const outer = this.pending === null;
    if (outer) this.pending = [];
    try { fn(); } finally {
      if (outer) {
        const steps = this.pending!;
        this.pending = null;
        if (steps.length > 0) {
          this.undoStack.push(steps);
          this.redoStack = [];
          this.emit();
        }
      }
    }
  }

  private write(path: Path, value: unknown): void {
    if (path.length === 0) throw new Error('cannot replace the whole document');
    const parent = getAt(this.doc, path.slice(0, -1)) as Record<string | number, unknown> | unknown[];
    if (parent === null || typeof parent !== 'object') throw new Error(`no parent at ${path.join('.')}`);
    const key = path[path.length - 1];
    const existed = Object.prototype.hasOwnProperty.call(parent, key);
    const before = existed ? structuredClone((parent as Record<string | number, unknown>)[key]) : undefined;
    if (existed && sameValue(before, value)) return;
    this.pending!.push({ path: [...path], before, existed });
    if (value === undefined && !Array.isArray(parent)) delete (parent as Record<string, unknown>)[key as string];
    else (parent as Record<string | number, unknown>)[key] = structuredClone(value);
  }

  /** Replace a whole list at once — reordering, inserting or removing an
   *  entry of an ordered collection. */
  setList(path: Path, list: unknown[]): void { this.set(path, list); }

  /** Rename a map key in place, keeping its position. */
  renameKey(path: Path, from: string, to: string): void {
    const map = this.get(path) as Record<string, unknown>;
    if (!map || typeof map !== 'object' || !(from in map) || to in map) return;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(map)) next[k === from ? to : k] = v;
    this.set(path, next);
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }

  undo(): void { this.replay(this.undoStack, this.redoStack); }
  redo(): void { this.replay(this.redoStack, this.undoStack); }

  private replay(from: Step[][], to: Step[][]): void {
    const steps = from.pop();
    if (!steps) return;
    const inverse: Step[] = [];
    for (const s of [...steps].reverse()) {
      const parent = getAt(this.doc, s.path.slice(0, -1)) as Record<string | number, unknown>;
      const key = s.path[s.path.length - 1];
      const existed = Object.prototype.hasOwnProperty.call(parent, key);
      inverse.push({ path: s.path, before: existed ? structuredClone(parent[key]) : undefined, existed });
      if (!s.existed) delete parent[key];
      else parent[key] = structuredClone(s.before);
    }
    to.push(inverse.reverse());
    this.emit();
  }

  /** Every leaf that differs from the document as loaded. */
  diff(): Change[] {
    const out: Change[] = [];
    walkDiff(this.reference, this.doc, [], out);
    return out;
  }

  /** Changes under one path prefix — a collection, an entry. */
  diffUnder(prefix: Path): Change[] {
    return this.diff().filter((c) => prefix.every((p, i) => String(c.path[i]) === String(p)));
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

function walkDiff(a: unknown, b: unknown, path: Array<string | number>, out: Change[]): void {
  if (isObj(a) && isObj(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walkDiff(a[k], b[k], [...path, k], out);
    return;
  }
  // Lists of equal length diff element by element, so one edited level reads
  // as one change; a list that grew or shrank is one change of the whole.
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    a.forEach((x, i) => walkDiff(x, b[i], [...path, i], out));
    return;
  }
  if (!sameValue(a, b)) out.push({ path, before: a, after: b });
}
