// Square-grid map math. 8-neighbor (Moore) adjacency is used uniformly for fog
// discovery, placement adjacency, worked-unit connectivity, and BFS distance
// (user decision — replaces the Unity hex grid's 6-neighbor adjacency).

import regionMap from './data/region-map.json';
import { coordKey, parseCoordKey, type Coord, type FeatureId, type TerrainId } from './state';

const NEIGHBOR_OFFSETS: ReadonlyArray<Coord> = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

export interface MapData {
  terrain: ReadonlyMap<string, TerrainId>;
  initialFeatures: ReadonlyMap<string, FeatureId>;
  /** BFS distance from the Townhall origin (0,0) over existing cells; unreachable → 0 (as built). */
  distanceFromTownhall: ReadonlyMap<string, number>;
  cells: ReadonlyArray<Coord>;
}

export const TOWNHALL_ORIGIN: Coord = { x: 0, y: 0 };

export function buildMapData(): MapData {
  const terrain = new Map<string, TerrainId>();
  for (const c of regionMap.terrain.cells) {
    terrain.set(coordKey({ x: c.x, y: c.y }), c.id as TerrainId);
  }
  const initialFeatures = new Map<string, FeatureId>();
  for (const c of regionMap.features.cells) {
    initialFeatures.set(coordKey({ x: c.x, y: c.y }), c.id as FeatureId);
  }

  // BFS over existing cells from the Townhall origin.
  const distanceFromTownhall = new Map<string, number>();
  const originKey = coordKey(TOWNHALL_ORIGIN);
  if (terrain.has(originKey)) {
    distanceFromTownhall.set(originKey, 0);
    const frontier: Coord[] = [TOWNHALL_ORIGIN];
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

  return {
    terrain,
    initialFeatures,
    distanceFromTownhall,
    cells: [...terrain.keys()].map(parseCoordKey),
  };
}

export const cellExists = (map: MapData, cell: Coord): boolean =>
  map.terrain.has(coordKey(cell));

/** The (up to 8) neighbors of a cell that exist on the map. */
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
export function cellsWithinRadius(map: MapData, center: Coord, radius: number): Coord[] {
  const out: Coord[] = [];
  for (let r = 1; r <= radius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // ring r only
        const c = { x: center.x + dx, y: center.y + dy };
        if (map.terrain.has(coordKey(c))) out.push(c);
      }
    }
  }
  return out;
}

export const euclideanTiles = (a: Coord, b: Coord): number =>
  Math.hypot(a.x - b.x, a.y - b.y);
