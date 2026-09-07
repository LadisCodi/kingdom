// The rules a technology tree has to obey, in ONE place.
//
// Same arrangement as `mapRules.ts`, and for the same reason: technologies are
// authored in a tool (`?dev=tree`), so what counts as a legal tree has to be
// one pure function of the document that the editor, the dev save endpoint and
// `tests/techTree.test.ts` all read. A rule added here is enforced in all
// three, or in none.
//
// A technology is ONE object in `tech-tree.json`: its name and prose, what
// KIND it is and what it unlocks, its price and clock, and its slot on its
// tome page with what it needs before it. There is no `Technologies` sheet,
// and no district, unit or harvest source names its own gate any more — the
// technology says what it opens, which is the direction a designer thinks in
// and the only direction an editor can author.
//
// What it still reads from the workbook is the id lists it validates against:
// a technology may only unlock a district, unit, harvest source or terrain
// that exists.
//
// Errors block a save. Warnings do not. An error is something the renderer or
// the sim cannot cope with — two cards in one slot, a requirement pointing
// back up the page, two technologies claiming one gate. A warning is something
// a designer probably did not mean.

import balance from './balance.json';
import { COLS } from '../../ui/research/layout';
import type { TomeId } from '../state';

/** What a technology puts in the player's hands. One entry per thing it
 *  opens; every gate the game checks is derived from these. */
export type TechUnlock =
  | { district: string }
  | { districtLevel: { id: string; level: number } }
  | { districtCount: string }
  | { unit: string }
  | { harvest: string }
  | { terrain: string };

/**
 * What a technology IS, in one word.
 *
 * `unlock` opens content and says which (`unlocks`). `bonus` is a rank on a
 * minor line and moves one number (`line`, `effectPerRank`). `mechanic` is
 * everything the CODE reads by id — a cover page opening its book, `Conquest`
 * bending the Knowledge rate — which is the one kind whose effect the editor
 * cannot author, only label.
 */
export type TechKind = 'unlock' | 'bonus' | 'mechanic';

export const TECH_KINDS: TechKind[] = ['unlock', 'bonus', 'mechanic'];

/** One technology, whole. */
export interface TechNodeDoc {
  name: string;
  glyph: string;
  description: string;
  kind: TechKind;
  /** Which book. The tab it is on — a drag, not a spreadsheet edit. */
  tome: TomeId;
  /** Which band of that book, 1–4. The era bar above it is the gate. */
  era: number;
  /** The page reads downward: a requirement always sits on a smaller row. */
  row: number;
  /** 0, 1 or 2 — left, middle, right. */
  col: number;
  /** One to three, and exactly none on a tome's cover page. */
  requires: string[];
  /** City Gold, kingdom Knowledge, and seconds on a scholar's desk. */
  gold: number;
  knowledge?: number;
  seconds: number;
  /** `kind: 'unlock'` only. */
  unlocks?: TechUnlock[];
  /** `kind: 'bonus'` only. The line is a `TechLineId`: which HOOK the number
   *  reaches is code (`src/sim/upgrades.ts`), so a new line is a code change
   *  and this may only name one that already exists. */
  line?: string | null;
  effectPerRank?: number;
  /** On the tree for its shape; does nothing yet. */
  planned?: boolean;
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

/** The `TomeId` union, spelled out: the file names a tome, so the rules have
 *  to know the set, and importing `definitions.ts` from here would be a cycle
 *  (it imports this). Typed against the union, so a typo is a compile error
 *  even though a missing tome is not. */
export const TOME_IDS: TomeId[] = ['Civics', 'Warfare', 'Magic'];

/** Bands per book. Era 4 is the sealed one. */
export const MAX_ERA = 4;

/** One to three requirements — past three the flow stops reading as a flow,
 *  and the row above only has three slots to point from. */
export const MAX_REQUIRES = 3;

/** What a technology may name as unlocked, from the workbook's id lists. */
export const DISTRICT_IDS = Object.keys(balance.districts);
export const UNIT_IDS = Object.keys(balance.units);
export const HARVEST_IDS = Object.keys(balance.harvest);
export const TERRAIN_IDS = Object.keys(balance.terrain);
const DISTRICT_MAX_LEVEL = balance.districts as unknown as Record<string, { maxLevel: number }>;

/** A cover page is granted when its tome opens, so it needs nothing — and is
 *  the one technology allowed to cost nothing. */
export const isCoverPage = (id: string): boolean => /^(Charter|Warband|Attunement)I$/.test(id);

/** A legal technology id: an identifier, because it is a key everywhere. */
export const isTechId = (id: string): boolean => /^[A-Z][A-Za-z0-9]*$/.test(id);

/** Every technology in the document, in file order — which is reading order. */
export const techIds = (doc: TechTreeDoc): string[] =>
  Object.keys(doc.technologies ?? {}).filter((id) => !id.startsWith('_'));

/**
 * Is this edge DRAWN on the page?
 *
 * Every requirement is real, but not every one is worth a line. A requirement
 * that reaches back over an ERA BAR is said by the bar: the band a card sits
 * in is a statement about everything above it, and a minor line's numeral
 * says the rest. Drawing all 119 of those would put a line across every gate
 * in the book and hide the edges that carry information.
 *
 * So a cross-band requirement is implied, and everything inside a band is
 * drawn.
 */
export function isDrawnEdge(doc: TechTreeDoc, from: string, to: string): boolean {
  const a = doc.technologies?.[from];
  const b = doc.technologies?.[to];
  if (a === undefined || b === undefined) return false;
  return a.tome === b.tome && a.era === b.era;
}

/** One unlock as a key, so "two technologies claiming one gate" is a lookup. */
export function unlockKey(unlock: TechUnlock): string {
  if ('district' in unlock) return `district:${unlock.district}`;
  if ('districtLevel' in unlock) {
    return `districtLevel:${unlock.districtLevel.id}:${unlock.districtLevel.level}`;
  }
  if ('districtCount' in unlock) return `districtCount:${unlock.districtCount}`;
  if ('unit' in unlock) return `unit:${unlock.unit}`;
  if ('harvest' in unlock) return `harvest:${unlock.harvest}`;
  if ('terrain' in unlock) return `terrain:${unlock.terrain}`;
  return 'unknown';
}

/** What an unlock reads as, on a card and in the problem list. */
export function unlockLabel(unlock: TechUnlock): string {
  if ('district' in unlock) return `the ${unlock.district}`;
  if ('districtLevel' in unlock) {
    return `${unlock.districtLevel.id} level ${unlock.districtLevel.level}`;
  }
  if ('districtCount' in unlock) return `one more ${unlock.districtCount}`;
  if ('unit' in unlock) return `the ${unlock.unit}`;
  if ('harvest' in unlock) return `${unlock.harvest} cells`;
  if ('terrain' in unlock) return `${unlock.terrain} cells`;
  return 'nothing';
}

/** Does this unlock name something that exists? A message, or null. */
function unlockProblem(unlock: TechUnlock): string | null {
  if ('district' in unlock) {
    return DISTRICT_IDS.includes(unlock.district) ? null
      : `unlocks "${unlock.district}", which is not a district`;
  }
  if ('districtCount' in unlock) {
    return DISTRICT_IDS.includes(unlock.districtCount) ? null
      : `raises the count of "${unlock.districtCount}", which is not a district`;
  }
  if ('districtLevel' in unlock) {
    const { id, level } = unlock.districtLevel ?? { id: '', level: 0 };
    if (!DISTRICT_IDS.includes(id)) return `unlocks a level of "${id}", which is not a district`;
    if (!Number.isInteger(level) || level < 2) {
      return `unlocks ${id} level ${level} — a gate opens level 2 or higher`;
    }
    const max = DISTRICT_MAX_LEVEL[id]?.maxLevel ?? 0;
    return level <= max ? null : `unlocks ${id} level ${level}, but it only reaches ${max}`;
  }
  if ('unit' in unlock) {
    return UNIT_IDS.includes(unlock.unit) ? null
      : `trains "${unlock.unit}", which is not a unit`;
  }
  if ('harvest' in unlock) {
    return HARVEST_IDS.includes(unlock.harvest) ? null
      : `works "${unlock.harvest}", which is not a harvest source`;
  }
  if ('terrain' in unlock) {
    return TERRAIN_IDS.includes(unlock.terrain) ? null
      : `crosses "${unlock.terrain}", which is not a terrain`;
  }
  return 'has an unlock that is not of any known kind';
}

/**
 * Every rule, over one document — the editor's live check, the save
 * endpoint's gate and the test's assertion, all the same call.
 */
export function validateTechTree(doc: TechTreeDoc): TechTreeValidation {
  const errors: TechIssue[] = [];
  const warnings: TechIssue[] = [];
  const nodes = doc.technologies ?? {};
  const all = techIds(doc);

  // ---- identity ---------------------------------------------------------
  for (const id of all) {
    const node = nodes[id];
    if (!isTechId(id)) {
      errors.push({ message: `"${id}" is not a legal technology id`, tech: id });
    }
    if ((node.name ?? '').trim() === '') errors.push({ message: `${id} has no name`, tech: id });
    if ((node.glyph ?? '').trim() === '') errors.push({ message: `${id} has no glyph`, tech: id });
    if ((node.description ?? '').trim() === '') {
      errors.push({ message: `${id} has no description`, tech: id });
    }
  }

  // ---- slots ------------------------------------------------------------
  const byCell = new Map<string, string>();
  const placed: string[] = [];
  for (const id of all) {
    const node = nodes[id];
    if (!TOME_IDS.includes(node.tome)) {
      errors.push({ message: `${id} sits in "${node.tome}", which is not a tome`, tech: id });
      continue;
    }
    if (!Number.isInteger(node.era) || node.era < 1 || node.era > MAX_ERA) {
      errors.push({
        message: `${id} is in era ${node.era} — the bands are 1 to ${MAX_ERA}`, tech: id,
      });
      continue;
    }
    if (!Number.isInteger(node.row) || node.row < 0) {
      errors.push({ message: `${id} sits on row ${node.row}`, tech: id });
      continue;
    }
    if (!Number.isInteger(node.col) || node.col < 0 || node.col >= COLS) {
      errors.push({
        message: `${id} sits in column ${node.col} — a page has ${COLS}`, tech: id,
      });
      continue;
    }
    const key = `${node.tome}:${node.row},${node.col}`;
    const sitting = byCell.get(key);
    if (sitting !== undefined) {
      errors.push({
        message: `${id} and ${sitting} share the slot (row ${node.row}, column ${node.col}) `
          + `on the ${node.tome} page`,
        tech: id,
      });
    } else {
      byCell.set(key, id);
      placed.push(id);
    }
  }

  // ---- one row never straddles two eras ---------------------------------
  const eraOfRow = new Map<string, { era: number; tech: string }>();
  for (const id of placed) {
    const node = nodes[id];
    const key = `${node.tome}:${node.row}`;
    const seen = eraOfRow.get(key);
    if (seen === undefined) eraOfRow.set(key, { era: node.era, tech: id });
    else if (seen.era !== node.era) {
      errors.push({
        message: `${id} (era ${node.era}) shares row ${node.row} with ${seen.tech} `
          + `(era ${seen.era}) — an era bar takes a whole line`,
        tech: id,
      });
    }
  }

  // ---- requirements -----------------------------------------------------
  for (const id of placed) {
    const node = nodes[id];
    const requires = node.requires ?? [];
    if (isCoverPage(id)) {
      if (requires.length > 0) {
        errors.push({
          message: `${id} is a cover page, granted when its tome opens — it may require nothing`,
          tech: id,
        });
      }
    } else if (requires.length === 0) {
      errors.push({
        message: `${id} requires nothing, so it would be available from the first minute`,
        tech: id,
      });
    } else if (requires.length > MAX_REQUIRES) {
      errors.push({
        message: `${id} has ${requires.length} requirements — ${MAX_REQUIRES} is the most a `
          + 'row above can point from',
        tech: id,
      });
    }
    if (new Set(requires).size !== requires.length) {
      errors.push({ message: `${id} names the same requirement twice`, tech: id });
    }
    for (const req of requires) {
      const from = nodes[req];
      if (from === undefined) {
        errors.push({ message: `${id} requires "${req}", which is not a technology`, tech: id });
        continue;
      }
      if (req === id) {
        errors.push({ message: `${id} requires itself`, tech: id });
        continue;
      }
      // A page cannot draw an edge that leaves it, so a requirement across
      // tomes would be invisible to the player who has to satisfy it.
      if (from.tome !== node.tome) {
        errors.push({
          message: `${id} (${node.tome}) requires ${req} (${from.tome}) — `
            + 'a page cannot draw an edge to another tome',
          tech: id,
        });
        continue;
      }
      // The page reads downward, and this one rule is what makes a loop
      // impossible and a row number mean "depth".
      if (from.row >= node.row) {
        errors.push({
          message: `${id} on row ${node.row} requires ${req} on row ${from.row} — `
            + 'a requirement always sits higher up the page',
          tech: id,
        });
      }
    }
  }

  // ---- the page reads downward: an era never sits above the one before --
  const lowestOf = new Map<string, number>();
  const highestOf = new Map<string, number>();
  for (const id of placed) {
    const node = nodes[id];
    const key = `${node.tome}:${node.era}`;
    lowestOf.set(key, Math.min(lowestOf.get(key) ?? node.row, node.row));
    highestOf.set(key, Math.max(highestOf.get(key) ?? node.row, node.row));
  }
  for (const tome of TOME_IDS) {
    for (let era = 2; era <= MAX_ERA; era++) {
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

  // ---- the price and the clock ------------------------------------------
  for (const id of all) {
    const node = nodes[id];
    const gold = node.gold ?? 0;
    const knowledge = node.knowledge ?? 0;
    const seconds = node.seconds ?? 0;
    const money: Array<readonly [string, number]> = [
      ['gold', gold], ['knowledge', knowledge], ['seconds', seconds],
    ];
    for (const [what, value] of money) {
      if (!Number.isInteger(value) || value < 0) {
        errors.push({ message: `${id} has ${what} of ${value}`, tech: id });
      }
    }
    // A cover page is GRANTED when its book opens, so it is the only
    // technology that may be free — anything else free would be startable for
    // nothing, which is what `isGranted` recognises by exactly that.
    if (gold === 0 && seconds === 0 && !isCoverPage(id)) {
      errors.push({
        message: `${id} costs nothing and takes no time — only a cover page may`,
        tech: id,
      });
    }
    // Era 1 runs on Gold and time alone: the clock has not started in the
    // first band, and charging Knowledge there would strangle the opening
    // (Docs/features/07-research.md §3).
    if (node.era === 1 && knowledge > 0) {
      errors.push({
        message: `${id} is in era 1 and costs ${knowledge} Knowledge — `
          + 'the clock has not started there',
        tech: id,
      });
    }
  }

  // ---- what kind of technology it is ------------------------------------
  const claimed = new Map<string, string>(); // an unlock → the tech claiming it
  for (const id of all) {
    const node = nodes[id];
    const unlocks = node.unlocks ?? [];
    const line = node.line ?? null;
    if (!TECH_KINDS.includes(node.kind)) {
      errors.push({
        message: `${id} is a "${node.kind}" — a technology is one of ${TECH_KINDS.join(', ')}`,
        tech: id,
      });
    } else if (node.kind === 'unlock') {
      // A PLANNED unlock has nothing to name yet: it is on the tree for its
      // shape, and what it will open does not exist (tech-tree.md §7).
      if (unlocks.length === 0 && node.planned !== true) {
        errors.push({
          message: `${id} unlocks nothing — say what it opens, or make it a mechanic`,
          tech: id,
        });
      }
      if (line !== null) {
        errors.push({ message: `${id} unlocks content AND carries the line ${line}`, tech: id });
      }
    } else if (node.kind === 'bonus') {
      if (line === null || line === '') {
        errors.push({ message: `${id} is a bonus with no line`, tech: id });
      }
      if ((node.effectPerRank ?? 0) === 0) {
        errors.push({ message: `${id} is a bonus worth nothing a rank`, tech: id });
      }
      if (unlocks.length > 0) {
        errors.push({ message: `${id} is a bonus and also unlocks content`, tech: id });
      }
    } else {
      if (unlocks.length > 0) {
        errors.push({
          message: `${id} is a mechanic and also unlocks ${unlockLabel(unlocks[0])}`, tech: id,
        });
      }
      if (line !== null) {
        errors.push({ message: `${id} is a mechanic and also carries the line ${line}`, tech: id });
      }
    }
    for (const unlock of unlocks) {
      const problem = unlockProblem(unlock);
      if (problem !== null) {
        errors.push({ message: `${id} ${problem}`, tech: id });
        continue;
      }
      // ONE technology per gate. Two would leave the game asking which of them
      // opens the Sawmill, and the answer would be whichever the loop that
      // derives the gates happened to read last.
      const key = unlockKey(unlock);
      const holder = claimed.get(key);
      if (holder !== undefined) {
        errors.push({
          message: `${id} and ${holder} both unlock ${unlockLabel(unlock)}`, tech: id,
        });
      } else {
        claimed.set(key, id);
      }
    }
  }

  // ---- a line climbs in order, and by the same step each time ------------
  for (const id of all) {
    const line = nodes[id].line ?? null;
    if (line === null) continue;
    const ranks = all.filter((t) => (nodes[t].line ?? null) === line);
    const i = ranks.indexOf(id);
    // The order is the file's, which is reading order, and `lineRank` counts
    // completed ranks off it — so a rank taken out of turn would credit the
    // wrong number of steps.
    if (i > 0 && !(nodes[id].requires ?? []).includes(ranks[i - 1])) {
      errors.push({
        message: `${id} does not require ${ranks[i - 1]}, the rank before it`,
        tech: id,
      });
    }
    // `effect()` multiplies the completed rank count by the FIRST rank's
    // number, so a rank worth something different would be quietly ignored.
    if (i > 0 && (nodes[id].effectPerRank ?? 0) !== (nodes[ranks[0]].effectPerRank ?? 0)) {
      errors.push({
        message: `${id} is worth ${nodes[id].effectPerRank} a rank but ${ranks[0]} is worth `
          + `${nodes[ranks[0]].effectPerRank} — a line's ranks are all the same size`,
        tech: id,
      });
    }
  }

  // ---- warnings ---------------------------------------------------------
  //
  // Deliberately NOT warned about: a card nothing requires (the last rank of
  // every line is one, so is every `planned` node and each era-4 keystone —
  // 40-odd correct leaves would bury anything worth reading), and a
  // requirement that reaches back several rows (such a connector runs in the
  // side channel, where it crosses nothing).
  for (const id of all) {
    for (const req of nodes[id].requires ?? []) {
      // A no-op in front of real content. `planned` nodes are on the tree for
      // its shape and do nothing yet (tech-tree.md §7), so anything waiting
      // on one is waiting on nothing.
      if (nodes[req]?.planned === true) {
        warnings.push({
          message: `${id} requires ${req}, which is planned and does nothing yet`,
          tech: id,
        });
      }
    }
  }

  return { errors, warnings, ok: errors.length === 0 };
}
