// The rules a region map has to obey, in ONE place.
//
// These used to live in scripts/balance.mjs, where only `npm run balance`
// could run them — which meant the map editor would have had to re-implement
// them and then drift. They are pure functions of a document here, so the
// editor checks every keystroke against exactly what tests/regionMap.test.ts
// gates the build on. A rule added here is enforced in both, or neither.
//
// Errors block a save; warnings do not. The split is deliberate: an error is
// something the SIM cannot cope with (a Townhall that cannot stand, a ruin in
// the sea), a warning is something a designer might mean but probably does
// not (an island nobody can walk to, whose fog is therefore free).

import {
  ARTIFACT_ORDER, CURRENCIES, DISTRICTS, FEATURES, LANDMARK_ART, RUIN_ORDER, UNIT_ORDER,
} from './definitions';
import {
  cellsOfRect, coordKey, parseCoordKey, type Coord, type FeatureId, type TerrainId,
} from '../state';

/** The authored shape of src/sim/data/region-map.json. */
export interface RegionMapDoc {
  terrain: { cells: Array<{ x: number; y: number; id: string }> };
  features: { cells: Array<{ x: number; y: number; id: string }> };
  landmarks: Array<{
    id: string; kind: string; x: number; y: number; defended: boolean; claimCost: number;
  }>;
  ruins: Record<string, {
    x: number; y: number; tier: number; difficulty: number; baseDepthSeconds: number;
    depthGrowth: number; maxDepth: number; supplies: Record<string, number>;
    affinity: string; artifact: string;
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
  ['Grassland', 'Plains', 'Desert', 'Snow', 'Tundra', 'Water', 'Mountain'];
export const FEATURE_IDS = Object.keys(FEATURES) as FeatureId[];
export const LANDMARK_KINDS = Object.keys(LANDMARK_ART) as Array<keyof typeof LANDMARK_ART>;

/** The Townhall's footprint, which every map must be able to host at (0,0). */
export const TOWNHALL_FOOTPRINT: Coord[] =
  cellsOfRect({ x: 0, y: 0 }, DISTRICTS.Townhall.size);

const NEIGHBOURS: ReadonlyArray<Coord> =
  [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

const isCount = (v: unknown): boolean => typeof v === 'number' && Number.isInteger(v) && v >= 0;

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

  // ---------------------------------------------------- landmarks & ruins
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
    claimCell(what, l.x, l.y);
  }

  for (const id of RUIN_ORDER) {
    if (!doc.ruins[id]) err(`ruin "${id}" is missing — every ruin in the code has to be authored`);
  }
  for (const [id, r] of Object.entries(doc.ruins)) {
    const what = `ruin ${id}`;
    if (!(RUIN_ORDER as string[]).includes(id)) {
      err(`"${id}" is not a ruin the code knows about — RuinId is a union in state.ts`, r);
      continue;
    }
    if (r.affinity !== 'Any' && !(UNIT_ORDER as string[]).includes(r.affinity)) {
      err(`${what}'s affinity must be a unit or "Any" (got "${r.affinity}")`, r);
    }
    if (!(ARTIFACT_ORDER as string[]).includes(r.artifact)) {
      err(`${what} rewards an unknown artifact "${r.artifact}"`, r);
    }
    if (!isCount(r.tier) || r.tier < 1) err(`${what} needs a tier of 1 or more`, r);
    if (!isCount(r.difficulty) || r.difficulty < 1) err(`${what} needs a difficulty of 1 or more`, r);
    if (!isCount(r.baseDepthSeconds) || r.baseDepthSeconds < 1) {
      err(`${what} needs a base depth time of 1 s or more`, r);
    }
    if (!isCount(r.maxDepth) || r.maxDepth < 1) err(`${what} needs a max depth of 1 or more`, r);
    if (typeof r.depthGrowth !== 'number' || !(r.depthGrowth >= 1)) {
      err(`${what}'s depth growth must be 1 or more — below 1 makes deeper delves faster`, r);
    }
    for (const [currency, amount] of Object.entries(r.supplies ?? {})) {
      if (!(currency in CURRENCIES)) err(`${what} asks for an unknown currency "${currency}"`, r);
      else if (!isCount(amount) || amount <= 0) {
        err(`${what}'s ${currency} supply must be a positive whole number (got ${amount})`, r);
      }
    }
    claimCell(what, r.x, r.y);
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
