// The board: what each of its 127 hexes holds, and where the six cities stand
// (Docs/features/19-world-map.md §1, §2, §9).
//
// A board is a pure function of its seed and the data — `generateBoard`
// below — so the save never carries its contents, only which board and
// which seat (`state.world.board`). The server will later hand the client a
// board of the same shape; only `source.ts` changes then.

import { WORLD_GEN, type WorldGenDef } from '../data/definitions';
import { rand } from '../rng';
import {
  BOARD_HEXES, BOARD_RADIUS, HEX_DIRS, hexAdd, hexIndex, hexNeighbors, hexScale, ringOf, rotateBy,
  type Hex,
} from './hex';
import {
  WORLD_FEATURES, WORLD_TERRAINS,
  type HexRole, type RolledRole, type WorldFeature, type WorldTerrain,
} from './types';

export interface BoardHex {
  index: number;
  hex: Hex;
  role: HexRole;
  /** Null on the Portal, which has no ground. */
  terrain: WorldTerrain | null;
  features: WorldFeature[];
  /** The seat whose city stands here, or null. */
  seat: number | null;
}

export interface Board {
  /** Which board this is. Local boards are named for their seed. */
  id: string;
  seed: number;
  hexes: BoardHex[];
}

/** The ring the cities stand on: one inside the rim, five hexes apart. */
export const HOME_RING = BOARD_RADIUS - 1;

/** The six city hexes: the corners of the home ring, seat i in direction i. */
export const SEATS: readonly Hex[] = HEX_DIRS.map((d) => hexScale(d, HOME_RING));
export const SEAT_INDICES: readonly number[] = SEATS.map(hexIndex);

export function roleOf(h: Hex): HexRole {
  const k = ringOf(h);
  if (k === 0) return 'portal';
  if (k === 1) return 'inner';
  if (k < HOME_RING) return 'corridor';
  if (k === HOME_RING) return 'home';
  return 'outer';
}

// ------------------------------------------------------------- the wedge

/**
 * A place in the wedge every seat shares: ring `k` (1..6) and step `j`
 * (0..k-1) along it, from the corner in the seat's own direction towards
 * the next one. Wedge `w` is wedge 0 turned `w` sixths, so the six seats
 * stand on identical ground (19 §9).
 */
interface WedgeAt { wedge: number; k: number; j: number }

const wedgeHex = (k: number, j: number, wedge: number): Hex =>
  rotateBy(hexAdd(hexScale(HEX_DIRS[0], k), hexScale(HEX_DIRS[2], j)), wedge);

/** Where a hex sits in the wedges: null for the Portal. */
function wedgeOf(h: Hex): WedgeAt | null {
  const k = ringOf(h);
  if (k === 0) return null;
  for (let wedge = 0; wedge < 6; wedge++) {
    for (let j = 0; j < k; j++) {
      const w = wedgeHex(k, j, wedge);
      if (w.q === h.q && w.r === h.r) return { wedge, k, j };
    }
  }
  return null; // unreachable: every ring-k hex is in exactly one wedge
}

const localKey = (k: number, j: number): string => `${k}:${j}`;

/** Which sixth of the board a hex is in; null for the Portal. */
export const wedgeIndexOf = (h: Hex): number | null => wedgeOf(h)?.wedge ?? null;

/**
 * The board with its dungeons where the world server says they are now:
 * dungeons move when they are closed (19 §8.1), so the generated board only
 * says where they started. A dungeon stands alone on its hex, covering what
 * the ground holds. Cached per board and set of places.
 */
const LIVE = new Map<string, Board>();
export function withDungeons(board: Board, dungeons: readonly number[]): Board {
  const at = [...dungeons].sort((a, b) => a - b);
  const key = `${board.id}:${board.seed}:${at.join(',')}`;
  let live = LIVE.get(key);
  if (live === undefined) {
    const set = new Set(at);
    live = {
      ...board,
      hexes: board.hexes.map((h) => {
        const has = h.features.includes('Dungeon');
        if (has === set.has(h.index)) return h;
        // A dungeon covers the ground while it stands; gone, the ground is
        // what it was generated as.
        return { ...h, features: has ? h.features.filter((f) => f !== 'Dungeon') : ['Dungeon'] };
      }),
    };
    if (LIVE.size > 64) LIVE.clear();
    LIVE.set(key, live);
  }
  return live;
}

interface Contents { terrain: WorldTerrain; features: WorldFeature[] }

function rollTerrain(seed: number, k: number, j: number, role: RolledRole, gen: WorldGenDef): WorldTerrain {
  const weights = gen.terrainWeights[role];
  const total = WORLD_TERRAINS.reduce((s, t) => s + Math.max(0, weights[t] ?? 0), 0);
  if (total <= 0) return 'Grassland';
  let x = rand(seed, 'worldWedge', k, j, 'terrain') * total;
  for (const t of WORLD_TERRAINS) {
    x -= Math.max(0, weights[t] ?? 0);
    if (x < 0) return t;
  }
  return WORLD_TERRAINS[WORLD_TERRAINS.length - 1];
}

/** Whether a feature may join a hex of this terrain already holding `held`
 *  (Docs/plans/world-hex-art.md §1). */
export function featureFits(gen: WorldGenDef, terrain: WorldTerrain, held: readonly WorldFeature[], f: WorldFeature): boolean {
  const rule = gen.featureRules[f];
  if (rule === undefined || !rule.terrains.includes(terrain)) return false;
  return held.every((h) => !rule.excludes.includes(h) && !(gen.featureRules[h]?.excludes.includes(f) ?? false));
}

/** Each feature rolled in its order; one that does not fit the terrain or a
 *  feature already kept is skipped. */
function rollFeatures(seed: number, k: number, j: number, role: RolledRole, terrain: WorldTerrain, gen: WorldGenDef): WorldFeature[] {
  const chances = gen.featureChance[role];
  const out: WorldFeature[] = [];
  for (const f of WORLD_FEATURES) {
    if (out.length >= gen.maxFeaturesPerHex) break;
    if ((gen.placedPerWedge[f] ?? 0) > 0) continue; // placed, not rolled
    if (rand(seed, 'worldWedge', k, j, 'feature', f) >= (chances[f] ?? 0)) continue;
    if (featureFits(gen, terrain, out, f)) out.push(f);
  }
  return out;
}

/** The city's neighbours, in HEX_DIRS order, as the local places of the
 *  wedge they map to. */
function seatNeighbourPlaces(): string[] {
  const around: string[] = [];
  for (const n of hexNeighbors(SEATS[0])) {
    const at = wedgeOf(n);
    if (at === null) continue;
    const key = localKey(at.k, at.j);
    if (!around.includes(key)) around.push(key);
  }
  return around;
}

/** The outer-ring places of a wedge that a placed site may take: not beside
 *  the city (19 §9). */
export function siteRoom(around: readonly string[] = seatNeighbourPlaces()): string[] {
  return Array.from({ length: BOARD_RADIUS }, (_, j) => localKey(BOARD_RADIUS, j)).filter((key) => !around.includes(key));
}

/**
 * The sites placed rather than rolled (`placedPerWedge`): exactly so many of
 * each on the wedge's outer ring, each on a place of its own, the ground
 * turned to a terrain it stands on when it does not already fit.
 */
function placeSites(seed: number, local: Map<string, Contents>, gen: WorldGenDef, around: readonly string[]): void {
  const taken = new Set<string>();
  for (const f of WORLD_FEATURES) {
    const count = gen.placedPerWedge[f] ?? 0;
    for (let i = 0; i < count; i++) {
      const free = siteRoom(around).filter((key) => !taken.has(key));
      if (free.length === 0) return;
      const key = free[Math.floor(rand(seed, 'worldWedge', 'place', f, i) * free.length)];
      const terrains = gen.featureRules[f]?.terrains ?? [];
      const was = local.get(key)!.terrain;
      local.set(key, { terrain: terrains.includes(was) ? was : (terrains[0] ?? was), features: [f] });
      taken.add(key);
    }
  }
}

/**
 * Wedge 0's contents, keyed by its local place. The inner ring is not here:
 * it is authored, and each of its six hexes is different (19 §9).
 *
 * After the roll, the seat's fix-up (19 §9): a Forest neighbour, an empty
 * Grassland neighbour, and no Dungeon beside it. The seat's
 * neighbours fall in this wedge and its two siblings, but every sibling is a
 * turn of this one, so mending the LOCAL place a neighbour maps to mends it
 * for all six seats at once.
 */
function rollWedge(seed: number, gen: WorldGenDef): Map<string, Contents> {
  const local = new Map<string, Contents>();
  for (let k = 2; k <= BOARD_RADIUS; k++) {
    for (let j = 0; j < k; j++) {
      const role = roleOf(wedgeHex(k, j, 0)) as RolledRole;
      const terrain = rollTerrain(seed, k, j, role, gen);
      local.set(localKey(k, j), { terrain, features: rollFeatures(seed, k, j, role, terrain, gen) });
    }
  }
  // The city's own hex.
  local.set(localKey(HOME_RING, 0), { terrain: 'Grassland', features: [] });

  const around = seatNeighbourPlaces();
  placeSites(seed, local, gen, around);
  const cell = (key: string): Contents => local.get(key)!;
  for (const key of around) cell(key).features = cell(key).features.filter((f) => f !== 'Dungeon');
  const isForest = (c: Contents) => c.features.includes('Forest');
  const isOpen = (c: Contents) => c.terrain === 'Grassland' && c.features.length === 0;
  let forest = around.find((key) => isForest(cell(key)));
  if (forest === undefined) {
    forest = around.find((key) => !isOpen(cell(key))) ?? around[0];
    local.set(forest, { terrain: 'Grassland', features: ['Forest'] });
  }
  if (!around.some((key) => isOpen(cell(key)))) {
    const open = around.find((key) => key !== forest)!;
    local.set(open, { terrain: 'Grassland', features: [] });
  }
  return local;
}

/** A board from its seed. Pure: the same seed and data give the same board. */
export function generateBoard(id: string, seed: number, gen: WorldGenDef = WORLD_GEN): Board {
  const local = rollWedge(seed, gen);
  const hexes = BOARD_HEXES.map((hex, index): BoardHex => {
    const role = roleOf(hex);
    const seat = SEAT_INDICES.indexOf(index);
    const base = { index, hex, role, seat: seat >= 0 ? seat : null };
    if (role === 'portal') return { ...base, terrain: null, features: [] };
    const at = wedgeOf(hex)!;
    if (role === 'inner') {
      const authored = gen.innerRing[at.wedge];
      return { ...base, terrain: authored.terrain, features: [...authored.features] };
    }
    const c = local.get(localKey(at.k, at.j))!;
    return { ...base, terrain: c.terrain, features: [...c.features] };
  });
  return { id, seed, hexes };
}
