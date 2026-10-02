// The rules a region map has to obey, in ONE place.
//
// These used to live in scripts/balance.mjs, where only `npm run balance`
// could run them — which meant the map editor would have had to re-implement
// them and then drift. They are pure functions of a document here, so the
// editor checks every keystroke against exactly what tests/regionMap.test.ts
// gates the build on. A rule added here is enforced in both, or neither.
//
// Errors block a save; warnings do not. The split is deliberate: an error is
// something the SIM cannot cope with (a Townhall that cannot stand, a lair in
// the sea), a warning is something a designer might mean but probably does
// not (an island nobody can walk to, whose fog is therefore free).

import {
  DISTRICTS, FEATURES, FOG, LANDMARK_ART, LAIR_ORDER, UNIT_ORDER,
} from './definitions';
import {
  cellsOfRect, coordKey, parseCoordKey, type Coord, type FeatureId, type TerrainId,
} from '../state';

/** The authored shape of src/sim/data/region-map.json. */
export interface RegionMapDoc {
  terrain: { cells: Array<{ x: number; y: number; id: string }> };
  features: { cells: Array<{ x: number; y: number; id: string }> };
  landmarks: Array<{
    id: string; kind: string; x: number; y: number; claimCost: number;
    /** Cells a side, anchored at (x, y). 1 when absent. */
    size?: number;
  }>;
  lairs: Record<string, {
    x: number; y: number; tier: number;
    /** Cells a side, anchored at (x, y). 1 when absent. */
    size?: number;
    /** How far its zone reaches past its footprint, in Chebyshev rings
     *  (Docs/proposals/lairs.md §3). */
    radius: number;
    /** How far it is sighted past the fog before it is found
     *  (Docs/features/01-map-and-fog.md §4.1). 0 = never. */
    sight: number;
    /** The garrison that holds it, and the warning before its first raid. */
    guard: { threat: string; power: number; warningMinutes: number };
    /** The card's line over its painting, two lines at most (§6). */
    flavour: string;
  }>;
  /** Buildings standing in ruin where the fog took them, to be found and
   *  repaired (Docs/features/01-map-and-fog.md §6.3). Absent = none. */
  abandoned?: Array<{
    id: string;
    /** Which building it is — a `buildings` entry. Its footprint is that
     *  building's size, anchored at (x, y). */
    district: string;
    x: number; y: number;
    /** How far its ruin is sighted past the fog (§4.1). 0 = never. */
    sight: number;
    /** What its card and its banner call it — *The Millers' house*. Absent =
     *  "The old <building>". */
    name?: string;
  }>;
}

export interface MapIssue {
  message: string;
  /** The cell to fly to, when the issue has one. */
  cell?: Coord;
}

export interface MapValidation {
  errors: MapIssue[];
  warnings: MapIssue[];
  ok: boolean;
}

export const TERRAIN_IDS: TerrainId[] =
  ['Grassland', 'Plains', 'Desert', 'Snow', 'Tundra', 'Water'];
export const FEATURE_IDS = Object.keys(FEATURES) as FeatureId[];
export const LANDMARK_KINDS = Object.keys(LANDMARK_ART) as Array<keyof typeof LANDMARK_ART>;

/** The Townhall's footprint, which every map must be able to host at (0,0). */
export const TOWNHALL_FOOTPRINT: Coord[] =
  cellsOfRect({ x: 0, y: 0 }, DISTRICTS.Townhall.size);

const NEIGHBOURS: ReadonlyArray<Coord> =
  [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

const isCount = (v: unknown): boolean => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** A zone of more than four rings is a quarter of the province. */
export const MAX_LAIR_RADIUS = 4;
/** The farthest a lair is sighted past the fog. */
export const MAX_LAIR_SIGHT = 8;
/** Two lines over the card's painting, in the sheet's body size. */
export const MAX_FLAVOUR = 120;
/** An abandoned building's name fits the site card's title line. */
export const MAX_ABANDONED_NAME = 32;

export function validateRegionMap(doc: RegionMapDoc): MapValidation {
  const errors: MapIssue[] = [];
  const warnings: MapIssue[] = [];
  const err = (message: string, cell?: Coord) => errors.push({ message, cell });
  const warn = (message: string, cell?: Coord) => warnings.push({ message, cell });

  // ------------------------------------------------------------- terrain
  const terrain = new Map<string, TerrainId>();
  for (const c of doc.terrain.cells) {
    const key = coordKey(c);
    if (terrain.has(key)) err(`two terrain entries for (${c.x},${c.y})`, c);
    if (!(TERRAIN_IDS as string[]).includes(c.id)) {
      err(`unknown terrain "${c.id}" at (${c.x},${c.y})`, c);
      continue;
    }
    terrain.set(key, c.id as TerrainId);
  }
  if (terrain.size === 0) err('the map is empty — paint at least one cell');

  // ------------------------------------------------------------ features
  const features = new Map<string, FeatureId>();
  for (const c of doc.features.cells) {
    const key = coordKey(c);
    if (features.has(key)) err(`two features on (${c.x},${c.y})`, c);
    if (!(FEATURE_IDS as string[]).includes(c.id)) {
      err(`unknown feature "${c.id}" at (${c.x},${c.y})`, c);
      continue;
    }
    const feature = c.id as FeatureId;
    features.set(key, feature);
    const under = terrain.get(key);
    if (under === undefined) {
      err(`the ${FEATURES[feature].name} at (${c.x},${c.y}) is on void, not on a map cell`, c);
      continue;
    }
    // respawnTerrain is the terrain a finite feature comes BACK on, which is
    // also the only terrain it makes sense to author it on: a shoal is water,
    // everything else is dry. Trees on Plains stays legal — only the water
    // line is drawn.
    const wantsWater = FEATURES[feature].respawnTerrain === 'Water';
    if (wantsWater && under !== 'Water') {
      err(`the ${FEATURES[feature].name} at (${c.x},${c.y}) is on ${under}, not on Water`, c);
    }
    if (!wantsWater && under === 'Water') {
      err(`the ${FEATURES[feature].name} at (${c.x},${c.y}) is in the water`, c);
    }
  }

  // ------------------------------------------------------------ Townhall
  for (const c of TOWNHALL_FOOTPRINT) {
    const key = coordKey(c);
    const under = terrain.get(key);
    if (under === undefined) err(`the Townhall cell (${c.x},${c.y}) is void`, c);
    else if (under !== 'Grassland') err(`the Townhall cell (${c.x},${c.y}) is ${under}, not Grassland`, c);
    if (features.has(key)) {
      err(`the Townhall cell (${c.x},${c.y}) is blocked by a ${FEATURES[features.get(key)!].name}`, c);
    }
  }
  const townhall = new Set(TOWNHALL_FOOTPRINT.map(coordKey));

  // ---------------------------------------------------- landmarks & lairs
  // Every site is authored by coordinate, so this is the only place that can
  // check the cell is real, dry, empty and not under the Townhall. Getting it
  // wrong authors a site nobody can ever reach, which stays invisible until a
  // player fails to find it.
  const siteAt = new Map<string, string>();
  const claimCell = (what: string, x: number, y: number) => {
    const cell = { x, y };
    const key = coordKey(cell);
    const taken = siteAt.get(key);
    if (taken !== undefined) err(`${what} shares (${x},${y}) with ${taken}`, cell);
    else siteAt.set(key, what);

    const under = terrain.get(key);
    if (under === undefined) err(`${what} is on (${x},${y}), which is not a map cell`, cell);
    else if (under === 'Water') err(`${what} is on water at (${x},${y})`, cell);
    if (features.has(key)) {
      err(`${what} shares (${x},${y}) with a ${FEATURES[features.get(key)!].name}`, cell);
    }
    if (townhall.has(key)) err(`${what} is under the Townhall at (${x},${y})`, cell);
  };

  /**
   * The same checks over every cell a site stands on. A sanctuary or a lair
   * may be more than one cell a side (Docs/features/01-map-and-fog.md §3.1),
   * and a 3×3 whose far corner hangs off the map would be a site the player
   * can see and never finish paying for.
   */
  const claimSite = (what: string, x: number, y: number, size: number | undefined) => {
    if (size !== undefined && (!isCount(size) || size < 1 || size > 3)) {
      err(`${what} has a size of ${String(size)}; it must be 1, 2 or 3`, { x, y });
      return;
    }
    const n = size ?? 1;
    for (const c of cellsOfRect({ x, y }, { x: n, y: n })) claimCell(what, c.x, c.y);
  };

  const landmarkIds = new Set<string>();
  for (const l of doc.landmarks) {
    const what = `landmark ${l.id}`;
    if (!l.id.trim()) err('a landmark has a blank id');
    if (landmarkIds.has(l.id)) err(`duplicate landmark id "${l.id}"`, l);
    landmarkIds.add(l.id);
    if (!(LANDMARK_KINDS as string[]).includes(l.kind)) {
      err(`${what} has unknown kind "${l.kind}"`, l);
    }
    if (!isCount(l.claimCost) || l.claimCost <= 0) {
      err(`${what} needs a positive whole claim cost (got ${l.claimCost})`, l);
    }
    claimSite(what, l.x, l.y, l.size);
  }

  for (const id of LAIR_ORDER) {
    if (!doc.lairs[id]) err(`lair "${id}" is missing — every lair in the code has to be authored`);
  }
  for (const [id, r] of Object.entries(doc.lairs)) {
    const what = `lair ${id}`;
    if (!(LAIR_ORDER as string[]).includes(id)) {
      err(`"${id}" is not a lair the code knows about — LairId is a union in state.ts`, r);
      continue;
    }
    if (!isCount(r.tier) || r.tier < 1) err(`${what} needs a tier of 1 or more`, r);
    // What lives here is where the lair is and who holds it: the garrison is
    // the whole of it (Docs/proposals/lairs.md §1). A lair without one would be a dungeon nobody is asked to
    // hurry to, and the counter is what makes discovering one an event.
    const g = r.guard;
    if (!g || typeof g !== 'object') {
      err(`${what} has no guard — every lair holds a garrison`, r);
    } else {
      if (g.threat !== 'Any' && !(UNIT_ORDER as string[]).includes(g.threat)) {
        err(`${what}'s guard threat must be a unit or "Any" (got "${g.threat}")`, r);
      }
      if (!isCount(g.power) || g.power < 1) err(`${what}'s guard needs a power of 1 or more`, r);
      if (!isCount(g.warningMinutes) || g.warningMinutes < 1) {
        err(`${what}'s guard needs a warning of 1 minute or more`, r);
      }
    }
    if (!isCount(r.radius) || r.radius > MAX_LAIR_RADIUS) {
      err(`${what} needs a radius from 0 to ${MAX_LAIR_RADIUS}`, r);
    }
    // Every cell within its radius is its ground, and revealing one FINDS it:
    // a sight no wider than that is a silhouette nobody could ever see.
    if (!isCount(r.sight) || r.sight > MAX_LAIR_SIGHT) {
      err(`${what} needs a sight from 0 to ${MAX_LAIR_SIGHT}`, r);
    } else if (r.sight !== 0 && isCount(r.radius) && r.sight <= r.radius) {
      err(`${what}'s sight (${r.sight}) must reach past its radius (${r.radius}), or be 0 for never`, r);
    }
    if (typeof r.flavour !== 'string' || r.flavour.trim() === '') {
      err(`${what} needs a flavour line for its card`, r);
    } else if (r.flavour.length > MAX_FLAVOUR) {
      err(`${what}'s flavour is ${r.flavour.length} characters; the card holds ${MAX_FLAVOUR}`, r);
    }
    claimSite(what, r.x, r.y, r.size);
  }

  // ------------------------------------------------- abandoned buildings
  // A building the fog swallowed, to be found and repaired
  // (Docs/features/01-map-and-fog.md §6.3). Its ground is checked as a
  // site's, and its id shares the sites' one namespace, since a discovery
  // is recorded by id.
  const siteIds = new Set<string>([...doc.landmarks.map((l) => l.id), ...Object.keys(doc.lairs)]);
  const ringOf = (c: Coord): number => {
    const gap = (d: number, n: number): number => (d < 0 ? -d : d > n - 1 ? d - (n - 1) : 0);
    const th = DISTRICTS.Townhall.size;
    return Math.max(gap(c.x - TOWNHALL_FOOTPRINT[0].x, th.x), gap(c.y - TOWNHALL_FOOTPRINT[0].y, th.y));
  };
  /** The first Townhall level whose reach covers the ring, or null. */
  const levelReaching = (ring: number): number | null => {
    const at = FOG.reachPerTownhallLevel.findIndex((r) => r >= ring);
    return at === -1 ? null : at + 1;
  };
  const byKind = new Map<string, number[]>();
  for (const a of doc.abandoned ?? []) {
    const what = `the abandoned ${a.district} "${a.id}"`;
    if (typeof a.id !== 'string' || a.id.trim() === '') err('an abandoned building needs an id', a);
    else if (siteIds.has(a.id)) err(`the id "${a.id}" is already taken`, a);
    siteIds.add(a.id);
    const def = (DISTRICTS as Record<string, (typeof DISTRICTS)[keyof typeof DISTRICTS] | undefined>)[a.district];
    if (def === undefined) { err(`${what} is not a building`, a); continue; }
    if (!def.buildable) err(`${what} is not a building the player can raise`, a);
    if (!isCount(a.sight) || a.sight > MAX_LAIR_SIGHT) err(`${what} needs a sight from 0 to ${MAX_LAIR_SIGHT}`, a);
    if (a.name !== undefined && (typeof a.name !== 'string' || a.name.trim() === '' || a.name.length > MAX_ABANDONED_NAME)) {
      err(`${what}'s name must be 1 to ${MAX_ABANDONED_NAME} characters`, a);
    }
    const cells = cellsOfRect({ x: a.x, y: a.y }, def.size);
    for (const c of cells) claimCell(what, c.x, c.y);
    // It must be repairable where it is first reached: the Townhall level
    // that first covers it leaves room in the count cap for it and for every
    // other abandoned one of its kind already inside that reach.
    const level = levelReaching(Math.min(...cells.map(ringOf)));
    if (level === null) { err(`${what} lies past every Townhall's reach`, a); continue; }
    byKind.set(a.district, [...(byKind.get(a.district) ?? []), level]);
  }
  for (const [district, levels] of byKind) {
    const caps = DISTRICTS[district as keyof typeof DISTRICTS].maxCountPerTownhallLevel;
    if (caps.length === 0) continue;
    for (const level of levels) {
      const within = levels.filter((l) => l <= level).length;
      const cap = caps[Math.min(level, caps.length) - 1];
      if (within > cap) {
        err(`${within} abandoned ${district} lie inside Townhall ${level}'s reach, and it allows ${cap}`);
      }
    }
  }

  // --------------------------------------------------------- reachability
  // Fog cost is a BFS distance from the Townhall, and an unreachable cell
  // reports distance 0 — i.e. it is FREE to reveal. That is a silent trap, so
  // any land the Townhall cannot walk to is called out.
  const reachable = reachableFrom(terrain, TOWNHALL_FOOTPRINT);
  let stranded = 0;
  let strandedExample: Coord | undefined;
  for (const [key, t] of terrain) {
    if (t === 'Water' || reachable.has(key)) continue;
    stranded += 1;
    strandedExample ??= parseCoordKey(key);
  }
  if (stranded > 0) {
    warn(
      `${stranded} land cell${stranded === 1 ? '' : 's'} cannot be walked to from the Townhall — `
      + 'their fog is free (distance 0)',
      strandedExample,
    );
  }
  for (const [key, what] of siteAt) {
    if (!reachable.has(key)) warn(`${what} sits on a cell the Townhall cannot reach`, parseCoordKey(key));
  }

  return { errors, warnings, ok: errors.length === 0 };
}

/** Multi-source 4-way flood over EXISTING cells (water included — a shoal is
 *  reachable, and the game's own BFS crosses water too). */
function reachableFrom(terrain: ReadonlyMap<string, TerrainId>, sources: Coord[]): Set<string> {
  const seen = new Set<string>();
  const frontier: Coord[] = [];
  for (const c of sources) {
    const key = coordKey(c);
    if (terrain.has(key) && !seen.has(key)) { seen.add(key); frontier.push(c); }
  }
  for (let i = 0; i < frontier.length; i++) {
    const cell = frontier[i];
    for (const off of NEIGHBOURS) {
      const n = { x: cell.x + off.x, y: cell.y + off.y };
      const key = coordKey(n);
      if (terrain.has(key) && !seen.has(key)) { seen.add(key); frontier.push(n); }
    }
  }
  return seen;
}

// ------------------------------------------------- footprints (§3.1 of 01)

/** A block of one feature: its anchor cell and how many cells it is a side. */
export interface Footprint {
  anchor: Coord;
  size: number;
}

/**
 * GROUP PAINTED CELLS OF ONE FEATURE INTO SQUARE BLOCKS.
 *
 * A mountain is one object, not a mass of small ones, so a designer paints
 * mountain cells and the blocks are DERIVED — here, by the one function the
 * editor previews with and the sim loads with, so the two can never disagree
 * (Docs/features/01-map-and-fog.md §3.1).
 *
 * Greedy from the largest size down, scanning row by row and left to right.
 * The order is arbitrary but FIXED, and that is the whole requirement: the
 * same painted cells must give the same blocks every time, or the map shifts
 * under saves that were written against the old grouping.
 */
export function groupFootprints(cells: Iterable<Coord>, maxSize: number): Footprint[] {
  const free = new Set<string>();
  for (const c of cells) free.add(coordKey(c));
  // Row by row, left to right. Sorting the keys is not enough: they are
  // strings, and "10,2" sorts before "2,2".
  const order = [...free].map(parseCoordKey)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const out: Footprint[] = [];
  for (let size = Math.max(1, Math.floor(maxSize)); size >= 2; size--) {
    for (const anchor of order) {
      if (!free.has(coordKey(anchor))) continue;
      const block: string[] = [];
      let whole = true;
      for (let dy = 0; dy < size && whole; dy++) {
        for (let dx = 0; dx < size && whole; dx++) {
          const k = coordKey({ x: anchor.x + dx, y: anchor.y + dy });
          if (free.has(k)) block.push(k);
          else whole = false;
        }
      }
      if (!whole) continue;
      for (const k of block) free.delete(k);
      out.push({ anchor, size });
    }
  }
  // Whatever no block could take is its own cell.
  for (const anchor of order) {
    if (free.delete(coordKey(anchor))) out.push({ anchor, size: 1 });
  }
  return out;
}
