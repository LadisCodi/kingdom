// The rules a technology tree has to obey, in ONE place.
//
// Same arrangement as `mapRules.ts`, and for the same reason: the shape of the
// tree is authored in a tool (`?dev=tree`), so what counts as a legal tree has
// to be one pure function of the document that the editor, the dev save
// endpoint and `tests/research.test.ts` all read. A rule added here is
// enforced in all three, or in none.
//
// It reads the raw workbook rather than `definitions.ts`, which is what keeps
// this importable from there: the tome, era and line of a technology are
// NUMBERS and stay in `balance.xlsx`; the position and the requirements are
// SHAPE and live in `tech-tree.json`.
//
// Errors block a save. Warnings do not. An error is something the renderer or
// the sim cannot cope with — two nodes on one cell, a connector drawn through
// an unrelated node, a requirement that loops. A warning is something a
// designer probably did not mean.

import balance from './balance.json';
import { edgeCells, type GridPoint } from '../../ui/research/layout';

/** One technology's place on its page, and what it needs before it. */
export interface TechNodeDoc {
  /** Absent = no authored position. A minor rank without one is drawn as a
   *  bead fanned under its line's parent (the stopgap `FAN_DY` exists for
   *  exactly these); a MAJOR without one is an error. */
  x?: number;
  y?: number;
  requires: string[];
}

/** The authored shape of src/sim/data/tech-tree.json. */
export interface TechTreeDoc {
  technologies: Record<string, TechNodeDoc>;
}

export interface TechIssue {
  message: string;
  /** The technology to fly to, when the issue has one. */
  tech?: string;
}

export interface TechTreeValidation {
  errors: TechIssue[];
  warnings: TechIssue[];
  ok: boolean;
}

/** What the workbook says about a technology, which this file may read but
 *  never write. */
interface TechMeta {
  tome: string;
  era: number;
  line: string | null;
}

const META = balance.technologies as unknown as Record<string, TechMeta>;

export const TECH_IDS: string[] = Object.keys(META);
export const TOME_IDS: string[] = [...new Set(TECH_IDS.map((id) => META[id].tome))];

/** A cover page is granted when its tome opens, so it needs nothing. */
export const isCoverPage = (id: string): boolean => /^(Charter|Warband|Attunement)I$/.test(id);

export const positionOf = (node: TechNodeDoc): GridPoint | null =>
  node.x === undefined || node.y === undefined ? null : { x: node.x, y: node.y };

/**
 * Is this edge DRAWN on the page?
 *
 * Every requirement is real, but not every one is worth a line. A minor
 * rank's requirement on its era's cover page is the band it sits in — the
 * page says it by where the node is — and drawing all 119 of them into three
 * keystones would be a hairball that hides the edges that carry information.
 * So that one is implied, and everything else is drawn.
 */
export function isDrawnEdge(from: string, to: string): boolean {
  if (META[to] === undefined || META[from] === undefined) return false;
  return !(META[to].line !== null && isCoverPageOfEra(from));
}

const isCoverPageOfEra = (id: string): boolean =>
  /^(Charter|Warband|Attunement)(I|II|III|IV)$/.test(id);

/**
 * Every rule, over one document — the editor's live check, the save
 * endpoint's gate and the test's assertion, all the same call.
 */
export function validateTechTree(doc: TechTreeDoc): TechTreeValidation {
  const errors: TechIssue[] = [];
  const warnings: TechIssue[] = [];
  const nodes = doc.technologies ?? {};

  // ---- every technology is here, once, and nothing invented ------------
  for (const id of TECH_IDS) {
    if (nodes[id] === undefined) {
      errors.push({ message: `${id} has no entry — every technology needs one`, tech: id });
    }
  }
  for (const id of Object.keys(nodes)) {
    if (id.startsWith('_')) continue; // a note, not a technology
    if (META[id] === undefined) {
      errors.push({ message: `"${id}" is not a technology in the workbook`, tech: id });
    }
  }

  const known = Object.keys(nodes).filter((id) => META[id] !== undefined);

  // ---- positions --------------------------------------------------------
  const byCell = new Map<string, string>();
  for (const id of known) {
    const node = nodes[id];
    const pos = positionOf(node);
    if (pos === null) {
      // A major carries the page's structure, so it must be placed. A rank
      // may still fan.
      if (META[id].line === null) {
        errors.push({ message: `${id} is a major with no position`, tech: id });
      }
      continue;
    }
    if (!Number.isInteger(pos.x) || !Number.isInteger(pos.y)) {
      errors.push({ message: `${id} sits at a fractional position`, tech: id });
      continue;
    }
    const key = `${META[id].tome}:${pos.x},${pos.y}`;
    const sitting = byCell.get(key);
    if (sitting !== undefined) {
      errors.push({
        message: `${id} and ${sitting} share the cell (${pos.x}, ${pos.y}) on the `
          + `${META[id].tome} page`,
        tech: id,
      });
    } else {
      byCell.set(key, id);
    }
  }

  // ---- requirements -----------------------------------------------------
  for (const id of known) {
    for (const req of nodes[id].requires ?? []) {
      if (META[req] === undefined) {
        errors.push({ message: `${id} requires "${req}", which is not a technology`, tech: id });
        continue;
      }
      if (req === id) {
        errors.push({ message: `${id} requires itself`, tech: id });
        continue;
      }
      // A page cannot draw an edge that leaves it, so a requirement across
      // tomes would be invisible to the player who has to satisfy it.
      if (META[req].tome !== META[id].tome) {
        errors.push({
          message: `${id} (${META[id].tome}) requires ${req} (${META[req].tome}) — `
            + 'a page cannot draw an edge to another tome',
          tech: id,
        });
      }
      // Nothing may require a LATER era: the page reads downward.
      if (META[req].era > META[id].era) {
        errors.push({
          message: `${id} (era ${META[id].era}) requires ${req} from era ${META[req].era}`,
          tech: id,
        });
      }
    }
  }

  // ---- no cycles --------------------------------------------------------
  const cycle = findCycle(nodes, known);
  if (cycle !== null) {
    errors.push({ message: `these require each other in a loop: ${cycle.join(' → ')}`, tech: cycle[0] });
  }

  // ---- the page reads downward: an era never sits above the one before --
  const lowestOf = new Map<string, number>();
  const highestOf = new Map<string, number>();
  for (const id of known) {
    const pos = positionOf(nodes[id]);
    if (pos === null) continue;
    const key = `${META[id].tome}:${META[id].era}`;
    lowestOf.set(key, Math.min(lowestOf.get(key) ?? pos.y, pos.y));
    highestOf.set(key, Math.max(highestOf.get(key) ?? pos.y, pos.y));
  }
  for (const tome of TOME_IDS) {
    for (let era = 2; era <= 4; era++) {
      const top = lowestOf.get(`${tome}:${era}`);
      const above = highestOf.get(`${tome}:${era - 1}`);
      if (top === undefined || above === undefined) continue;
      if (top <= above) {
        errors.push({
          message: `${tome} era ${era} starts at row ${top}, at or above era ${era - 1}`
            + ` which reaches row ${above}`,
        });
      }
    }
  }

  // ---- no drawn connector passes through an unrelated node --------------
  for (const id of known) {
    const to = positionOf(nodes[id]);
    if (to === null) continue;
    for (const req of nodes[id].requires ?? []) {
      if (META[req] === undefined) continue;
      const from = positionOf(nodes[req]);
      if (from === null || !isDrawnEdge(req, id)) continue;
      if (META[req].tome !== META[id].tome) continue; // already an error
      for (const cell of edgeCells(from, to)) {
        const blocker = byCell.get(`${META[id].tome}:${cell.x},${cell.y}`);
        if (blocker !== undefined) {
          errors.push({
            message: `the ${req} → ${id} connector runs through ${blocker}`,
            tech: id,
          });
        }
      }
    }
  }

  // ---- warnings ---------------------------------------------------------
  //
  // Deliberately NOT warned about: a node nothing requires. The last rank of
  // every line is one, so is every `planned` node (no keystone may require
  // one, tech-tree.md §7), and so is each era-4 keystone — 40-odd leaves that
  // are all correct would bury the two warnings below.
  for (const id of known) {
    const node = nodes[id];
    if ((node.requires ?? []).length === 0 && !isCoverPage(id)) {
      warnings.push({
        message: `${id} requires nothing, so it is available from the first minute`,
        tech: id,
      });
    }
    // A line's ranks come in order, and the order is the sheet's. A rank that
    // does not require the one before it can be taken out of turn.
    const line = META[id].line;
    if (line !== null) {
      const ranks = TECH_IDS.filter((t) => META[t].line === line);
      const i = ranks.indexOf(id);
      if (i > 0 && !(node.requires ?? []).includes(ranks[i - 1])) {
        warnings.push({
          message: `${id} does not require ${ranks[i - 1]}, the rank before it`,
          tech: id,
        });
      }
    }
  }

  return { errors, warnings, ok: errors.length === 0 };
}

/** The first requirement loop found, as the ids on it, or null. */
function findCycle(
  nodes: Record<string, TechNodeDoc>, known: string[],
): string[] | null {
  const state = new Map<string, 'open' | 'done'>();
  const stack: string[] = [];
  const walk = (id: string): string[] | null => {
    if (state.get(id) === 'done') return null;
    if (state.get(id) === 'open') return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, 'open');
    stack.push(id);
    for (const req of nodes[id]?.requires ?? []) {
      if (nodes[req] === undefined) continue;
      const found = walk(req);
      if (found !== null) return found;
    }
    stack.pop();
    state.set(id, 'done');
    return null;
  };
  for (const id of known) {
    const found = walk(id);
    if (found !== null) return found;
  }
  return null;
}
