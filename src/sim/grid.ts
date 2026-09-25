// Square-grid map math. 4-neighbor (Von Neumann) adjacency is used uniformly
// for fog discovery, placement adjacency, worked-unit connectivity, and BFS
// distance (user decision — diagonals do not count as adjacent).

import { DISTRICTS, FEATURES } from './data/definitions';
import { groupFootprints, type RegionMapDoc } from './data/mapRules';
import regionMap from './data/region-map.json';
import {
  cellsOfRect, coordKey, parseCoordKey,
  type Coord, type FeatureId, type RegionId, type TerrainId,
} from './state';

/** Authored regions, by id. One entry today; a second is a JSON file and a
 *  row, not a refactor. */
const REGIONS: Record<RegionId, RegionMapDoc> = {
  oakville: regionMap,
};

const NEIGHBOR_OFFSETS: ReadonlyArray<Coord> = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
];

export interface MapData {
  terrain: ReadonlyMap<string, TerrainId>;
  initialFeatures: ReadonlyMap<string, FeatureId>;
  /** BFS distance from the Townhall footprint over existing cells; unreachable → 0 (as built). */
  distanceFromTownhall: ReadonlyMap<string, number>;
  cells: ReadonlyArray<Coord>;
  /**
   * WHICH BLOCK EACH CELL BELONGS TO, for features that span more than one
   * cell (Docs/features/01-map-and-fog.md §3.1).
   *
   * Every cell inside a block maps to its anchor's key, the anchor included;
   * a cell in no block is absent. Derived from the painted cells by
   * `groupFootprints`, so nothing in the authored map declares a size.
   *
   * MAP data and not state: a mountain never moves. Only finite features
   * respawn, and none of those spans.
   */
  footprintOf: ReadonlyMap<string, string>;
  /** Anchor key → how many cells a side. Anchors only. */
  footprintSize: ReadonlyMap<string, number>;
}

export const TOWNHALL_ORIGIN: Coord = { x: 0, y: 0 }; // anchor (top-left of its footprint)

export const buildMapData = (regionId: RegionId = 'oakville'): MapData =>
  buildMapDataFrom(REGIONS[regionId]);

/** The same derivation over a document that is not (yet) the shipped one —
 *  the map editor rebuilds this on every stroke to keep its fog-cost overlay
 *  honest, so the numbers a designer sees are the ones the game will use. */
export function buildMapDataFrom(region: RegionMapDoc): MapData {
  const terrain = new Map<string, TerrainId>();
  for (const c of region.terrain.cells) {
    terrain.set(coordKey({ x: c.x, y: c.y }), c.id as TerrainId);
  }
  const initialFeatures = new Map<string, FeatureId>();
  for (const c of region.features.cells) {
    initialFeatures.set(coordKey({ x: c.x, y: c.y }), c.id as FeatureId);
  }

  // Multi-source BFS over existing cells from the Townhall's whole footprint
  // (every footprint cell is distance 0).
  const distanceFromTownhall = new Map<string, number>();
  const frontier: Coord[] = [];
  for (const c of cellsOfRect(TOWNHALL_ORIGIN, DISTRICTS.Townhall.size)) {
    if (terrain.has(coordKey(c))) {
      distanceFromTownhall.set(coordKey(c), 0);
      frontier.push(c);
    }
  }
  {
    while (frontier.length > 0) {
      const cell = frontier.shift()!;
      const d = distanceFromTownhall.get(coordKey(cell))!;
      for (const off of NEIGHBOR_OFFSETS) {
        const n = { x: cell.x + off.x, y: cell.y + off.y };
        const k = coordKey(n);
        if (terrain.has(k) && !distanceFromTownhall.has(k)) {
          distanceFromTownhall.set(k, d + 1);
          frontier.push(n);
        }
      }
    }
  }

  // Group each spanning feature's painted cells into blocks. Per feature, so
  // a mountain never joins an iron one into a block that is neither.
  const footprintOf = new Map<string, string>();
  const footprintSize = new Map<string, number>();
  for (const def of Object.values(FEATURES)) {
    const max = def.maxFootprint ?? 1;
    if (max <= 1) continue;
    const mine: Coord[] = [];
    for (const [k, id] of initialFeatures) if (id === def.id) mine.push(parseCoordKey(k));
    for (const { anchor, size } of groupFootprints(mine, max)) {
      // A block of one is what `footprintAt` answers for a cell it has never
      // heard of, so recording them would only be bulk.
      if (size === 1) continue;
      const anchorKey = coordKey(anchor);
      footprintSize.set(anchorKey, size);
      for (const c of cellsOfRect(anchor, { x: size, y: size })) {
        footprintOf.set(coordKey(c), anchorKey);
      }
    }
  }

  return {
    terrain,
    initialFeatures,
    distanceFromTownhall,
    cells: [...terrain.keys()].map(parseCoordKey),
    footprintOf,
    footprintSize,
  };
}

/**
 * The block a cell belongs to — its anchor and how many cells a side — or a
 * block of one when it is in none. Every caller that has to treat a mountain
 * as ONE THING goes through this: fog, exhaustion, and the renderer.
 */
export function footprintAt(map: MapData, cell: Coord): { anchor: Coord; size: number } {
  const anchorKey = map.footprintOf.get(coordKey(cell));
  if (anchorKey === undefined) return { anchor: cell, size: 1 };
  return { anchor: parseCoordKey(anchorKey), size: map.footprintSize.get(anchorKey) ?? 1 };
}

/** Every cell of the block `cell` belongs to, the cell itself included. */
export function footprintCells(map: MapData, cell: Coord): Coord[] {
  const { anchor, size } = footprintAt(map, cell);
  return size === 1 ? [anchor] : [...cellsOfRect(anchor, { x: size, y: size })];
}

export const cellExists = (map: MapData, cell: Coord): boolean =>
  map.terrain.has(coordKey(cell));

/** The (up to 4) orthogonal neighbors of a cell that exist on the map. */
export function neighbors(map: MapData, cell: Coord): Coord[] {
  const out: Coord[] = [];
  for (const off of NEIGHBOR_OFFSETS) {
    const n = { x: cell.x + off.x, y: cell.y + off.y };
    if (map.terrain.has(coordKey(n))) out.push(n);
  }
  return out;
}

/** BFS distance from the Townhall; unreachable or off-map → 0 (no penalty, as built). */
export const townhallDistance = (map: MapData, cell: Coord): number =>
  map.distanceFromTownhall.get(coordKey(cell)) ?? 0;

/** Existing cells within Chebyshev distance ≤ radius of `center`, excluding it.
 *  Ordered nearest-first (then reading order) so "claim the nearest cell" is a
 *  simple first-match. */
export const cellsWithinRadius = (map: MapData, center: Coord, radius: number): Coord[] =>
  cellsWithinRadiusOfRect(map, center, { x: 1, y: 1 }, radius);

/** Like cellsWithinRadius, but around a size.x × size.y footprint anchored
 *  (top-left) at `anchor` — the footprint's own cells are excluded. Same
 *  nearest-first, then reading-order contract. */
export function cellsWithinRadiusOfRect(
  map: MapData,
  anchor: Coord,
  size: { x: number; y: number },
  radius: number,
): Coord[] {
  const out: Coord[] = [];
  for (let r = 1; r <= radius; r++) {
    for (let dy = -r; dy < size.y + r; dy++) {
      for (let dx = -r; dx < size.x + r; dx++) {
        // Chebyshev distance from (dx,dy) to the [0,size) rect; ring r only.
        const ox = Math.max(-dx, dx - (size.x - 1), 0);
        const oy = Math.max(-dy, dy - (size.y - 1), 0);
        if (Math.max(ox, oy) !== r) continue;
        const c = { x: anchor.x + dx, y: anchor.y + dy };
        if (map.terrain.has(coordKey(c))) out.push(c);
      }
    }
  }
  return out;
}

export const euclideanTiles = (a: Coord, b: Coord): number =>
  Math.hypot(a.x - b.x, a.y - b.y);
