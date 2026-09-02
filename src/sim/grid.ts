// Square-grid map math. 4-neighbor (Von Neumann) adjacency is used uniformly
// for fog discovery, placement adjacency, worked-unit connectivity, and BFS
// distance (user decision — diagonals do not count as adjacent).

import { DISTRICTS } from './data/definitions';
import regionMap from './data/region-map.json';
import {
  cellsOfRect, coordKey, parseCoordKey,
  type Coord, type FeatureId, type RegionId, type TerrainId,
} from './state';

/** Authored regions, by id. One entry today; a second is a JSON file and a
 *  row, not a refactor. */
const REGIONS: Record<RegionId, typeof regionMap> = {
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
}

export const TOWNHALL_ORIGIN: Coord = { x: 0, y: 0 }; // anchor (top-left of its footprint)

export function buildMapData(regionId: RegionId = 'oakville'): MapData {
  const region = REGIONS[regionId];
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

  return {
    terrain,
    initialFeatures,
    distanceFromTownhall,
    cells: [...terrain.keys()].map(parseCoordKey),
  };
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
