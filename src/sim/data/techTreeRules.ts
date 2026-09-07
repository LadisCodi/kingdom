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
import { effectProblems, type TechEffect } from './techEffectRules';
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
 * `unlock` opens content and says which (`unlocks`). `bonus` moves numbers and
 * says which (`effects`). `mechanic` is
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
  /**
   * Its slot, or nothing at all.
   *
   * All four are absent together on a technology that has been taken OFF THE
   * PAGE — which exists, is editable, and is an ERROR until it is put back
   * (the game has nowhere to draw it). That is a different state from deleted,
   * and the difference is the point: a technology can be set aside while its
   * page is rearranged without losing its prose, its price or its unlocks.
   */
  tome?: TomeId;
  era?: number;
  row?: number;
  col?: number;
  /** One to three, and exactly none on a tome's cover page. */
  requires: string[];
  /** City Gold, kingdom Knowledge, and seconds on a scholar's desk. */
  gold: number;
  knowledge?: number;
  seconds: number;
  /** `kind: 'unlock'` only. */
  unlocks?: TechUnlock[];
  /** `kind: 'bonus'` only: what this technology moves, and what it aims at
   *  (`techEffectRules.ts`). A stat, an op, a signed value and a target. */
  effects?: TechEffect[];
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
  /**
   * Technologies with no slot, which is neither an error nor a warning.
   *
   * It is a PENDING state and the third answer this function can give. A
   * card off the page is not a mistake in the tree — it is work the designer
   * has not finished, and `?dev=tree` produces a dozen of them on purpose
   * every time a band is cleared to be rearranged. Listing those among the
   * errors buries the ones that are actually wrong, which is the whole job of
   * an error list.
   *
   * It still stops the save: `ok` is false while any of them exist, so the
   * holding pen lives inside one session and never reaches the repo, where
   * the game would have nowhere to draw them.
   */
  offPage: string[];
  ok: boolean;
}

/** The `TomeId` union, spelled out: the file names a tome, so the rules have
 *  to know the set, and importing `definitions.ts` from here would be a cycle
 *  (it imports this). Typed against the union, so a typo is a compile error
 *  even though a missing tome is not. */
export const TOME_IDS: TomeId[] = ['Civics', 'Warfare', 'Magic'];

/**
 * A RANK LADDER is a naming convention, not a field: a stem plus a roman
 * numeral — `SawpitsI`, `SawpitsII`, `SawpitsIII`.
 *
 * It used to be a `line` field naming a hook in code, which is why adding a
 * kind of bonus was a code change. A technology now says what it moves in its
 * own `effects`, so a ladder is only the thing the PAGE needs it to be: a
 * chain of cards, each requiring the one above. This reads that chain off the
 * ids, and nothing else in the file records it.
 *
 * The numeral is DECODED rather than matched against a list of suffixes,
 * because `IV` ends with `V` and suffix matching would read the fourth rank as
 * the fifth.
 */
const ROMAN = /^(.+?)([IVX]+)$/;
const ROMAN_DIGIT: Record<string, number> = { I: 1, V: 5, X: 10 };

/** `SawpitsIII` → `{ stem: 'Sawpits', rank: 3 }`; `Cartography` → `null`. */
export function ladderRank(id: string): { stem: string; rank: number } | null {
  const m = ROMAN.exec(id);
  if (m === null) return null;
  let rank = 0;
  for (let i = 0; i < m[2].length; i++) {
    const here = ROMAN_DIGIT[m[2][i]];
    rank += here < (ROMAN_DIGIT[m[2][i + 1]] ?? 0) ? -here : here;
  }
  return { stem: m[1], rank };
}

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

/** A technology that HAS a slot — the same object, with the four fields known
 *  to be there, so one check narrows all of them. */
export type PlacedTech = TechNodeDoc & Required<Pick<TechNodeDoc, 'tome' | 'era' | 'row' | 'col'>>;

/** Is this technology on a page at all? All four slot fields, or none. */
export const isPlaced = (node: TechNodeDoc): node is PlacedTech =>
  node.tome !== undefined && node.era !== undefined
  && node.row !== undefined && node.col !== undefined;

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
  const offPage: string[] = [];
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
  /** The ones with a slot, narrowed once here so nothing below re-asserts it. */
  const onPage = new Map<string, PlacedTech>();
  for (const id of all) {
    const node = nodes[id];
    // OFF THE PAGE. Recorded on its own and none of the checks below run — a
    // technology with no slot has no column to be out of range and no row to
    // be above its requirements, and reporting four things about one fact
    // would bury the one that can be acted on.
    if (!isPlaced(node)) {
      offPage.push(id);
      continue;
    }
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
      onPage.set(id, node);
    }
  }

  // ---- one row never straddles two eras ---------------------------------
  const eraOfRow = new Map<string, { era: number; tech: string }>();
  for (const [id, node] of onPage) {
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
  //
  // A ROOT is a card with nothing above it on its page, and a root requires
  // nothing because there is nothing it could require — which is what the
  // FIRST ROW of a book means. The rule used to name the three cover pages
  // instead, so a designer opening a tome with anything else was told their
  // own first row was an error while `defaultRequires` handed it exactly that.
  // Positional, and the two agree now.
  const firstRow = new Map<string, number>();
  for (const node of onPage.values()) {
    const seen = firstRow.get(node.tome);
    if (seen === undefined || node.row < seen) firstRow.set(node.tome, node.row);
  }

  for (const [id, node] of onPage) {
    const requires = node.requires ?? [];
    const isRoot = node.row <= (firstRow.get(node.tome) ?? node.row);
    if (isCoverPage(id)) {
      if (requires.length > 0) {
        errors.push({
          message: `${id} is a cover page, granted when its tome opens — it may require nothing`,
          tech: id,
        });
      }
    } else if (requires.length === 0 && !isRoot) {
      errors.push({
        message: `${id} requires nothing, so it would be available from the first minute — `
          + 'put it on the page\'s first row, or say what it needs',
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
      if (nodes[req] === undefined) {
        errors.push({ message: `${id} requires "${req}", which is not a technology`, tech: id });
        continue;
      }
      if (req === id) {
        errors.push({ message: `${id} requires itself`, tech: id });
        continue;
      }
      const from = onPage.get(req);
      if (from === undefined) {
        errors.push({
          message: `${id} requires ${req}, which is off the page`, tech: id,
        });
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
  for (const node of onPage.values()) {
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
    } else if (node.kind === 'bonus') {
      // A bonus that moves nothing is a card the player pays for and nothing
      // collects — the failure the `line` field used to make impossible by
      // being mandatory, and `effects` inherits the duty.
      if ((node.effects ?? []).length === 0) {
        errors.push({ message: `${id} is a bonus that moves no number`, tech: id });
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

  // ---- what a technology moves ------------------------------------------
  //
  // Checked wherever `effects` is present, whatever the kind, so a stray one
  // on an `unlock` or a `mechanic` is caught too rather than silently summed.
  // A `bonus` is required to carry at least one, above.
  for (const id of all) {
    const node = nodes[id];
    for (const effect of node.effects ?? []) {
      for (const problem of effectProblems(effect)) {
        errors.push({ message: `${id} ${problem}`, tech: id });
      }
    }
    if ((node.effects ?? []).length > 0 && node.kind !== 'bonus') {
      errors.push({
        message: `${id} is a ${node.kind} and also moves a number`, tech: id,
      });
    }
  }

  // ---- a bonus ladder climbs in order, without a gap ----------------------
  //
  // Rank II must REQUIRE rank I, or the ladder is not a chain down the page:
  // two cards sharing a name with no edge between them, each buyable on its
  // own. And the numerals must run `I…n`, because `SawpitsI` then
  // `SawpitsIII` reads as a three-rank ladder missing its middle everywhere a
  // stem gets grouped.
  //
  // Scoped to BONUSES, which is the scope the `line` field had. The three
  // tome ladders — `CharterI…IV` and its siblings — share the naming and are
  // deliberately not chains: a keystone gates its era and hangs off that
  // era's own requirements, not off the keystone before it.
  //
  // What is NOT a rule any more: that every rank be worth the same step. A
  // ladder may ramp (+1, +2, +3), because each rank carries its own value
  // instead of the whole line being priced off rank I's.
  const bonusRanks = new Map<string, Map<number, string>>();
  for (const id of all) {
    if (nodes[id].kind !== 'bonus') continue;
    const r = ladderRank(id);
    if (r === null) continue;
    const stem = bonusRanks.get(r.stem) ?? new Map<number, string>();
    stem.set(r.rank, id);
    bonusRanks.set(r.stem, stem);
  }
  for (const [stem, ranks] of bonusRanks) {
    const top = Math.max(...ranks.keys());
    for (let n = 1; n <= top; n++) {
      const id = ranks.get(n);
      if (id === undefined) {
        // A hole in the NAMING, which placement has nothing to do with: the
        // cards all still exist wherever they sit.
        errors.push({ message: `the ${stem} ladder reaches ${top} but has no rank ${n}` });
        continue;
      }
      const above = ranks.get(n - 1);
      if (above === undefined) continue;
      // Both ends have to be ON THE PAGE. A card off the page has no
      // requirements by construction — `unplace` empties them, because
      // "above me on the page" is exactly what it no longer has — so asking
      // it to require anything would report the holding pen as a mistake,
      // once per rank. The link is checked again the moment it is placed.
      if (!isPlaced(nodes[id]) || !isPlaced(nodes[above])) continue;
      if (!(nodes[id].requires ?? []).includes(above)) {
        errors.push({ message: `${id} does not require ${above}, the rank before it`, tech: id });
      }
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

  return {
    errors, warnings, offPage,
    ok: errors.length === 0 && offPage.length === 0,
  };
}
