// The "one extra worker works one adjacent thing" mechanic (Docs/03, 05).

import { DISTRICTS, levelIndexed } from './data/definitions';
import { neighbors, type MapData } from './grid';
import { coordKey, districtAt, type Coord, type District, type GameState } from './state';

/**
 * The units a district currently works, nearest first.
 * - Feature source (Lumber → Trees): BFS from the district's neighbors through
 *   cells that carry the worked feature and are adjacent, connected, AND revealed.
 * - Adjacent-district source (Farm → FarmLands): direct neighbors that are
 *   active (Built) districts of the worked category.
 */
export function workedUnitCells(state: GameState, map: MapData, district: District): Coord[] {
  const def = DISTRICTS[district.definitionId];
  const source = def.workedSource;
  if (!source) return [];

  if (source.kind === 'district') {
    return neighbors(map, district.location).filter((n) => {
      const d = districtAt(state, n);
      return d !== undefined && d.definitionId === source.districtId && d.state === 'Built';
    });
  }

  // Feature source: BFS breadth-first (nearest first). Unrevealed cells neither
  // count nor conduct connectivity.
  const carries = (cell: Coord): boolean =>
    state.features[coordKey(cell)]?.featureId === source.featureId &&
    state.fog.revealed[coordKey(cell)] === true;

  const found: Coord[] = [];
  const visited = new Set<string>([coordKey(district.location)]);
  const frontier: Coord[] = [];
  for (const n of neighbors(map, district.location)) {
    const k = coordKey(n);
    if (!visited.has(k)) {
      visited.add(k);
      if (carries(n)) {
        found.push(n);
        frontier.push(n);
      }
    }
  }
  while (frontier.length > 0) {
    const cell = frontier.shift()!;
    for (const n of neighbors(map, cell)) {
      const k = coordKey(n);
      if (!visited.has(k)) {
        visited.add(k);
        if (carries(n)) {
          found.push(n);
          frontier.push(n);
        }
      }
    }
  }
  return found;
}

export const worksUnits = (definitionId: District['definitionId']): boolean => {
  const def = DISTRICTS[definitionId];
  return def.workedSource !== null && Object.keys(def.yieldPerWorkedTile).length > 0;
};

/** min(MaxWorkersForLevel, 1 + workableUnitCount); worker #1 staffs the base. */
export function assignableWorkerLimit(state: GameState, map: MapData, district: District): number {
  const def = DISTRICTS[district.definitionId];
  if (def.maxWorkersPerLevel.length === 0) return 0;
  const maxForLevel = levelIndexed(def.maxWorkersPerLevel, district.level);
  if (!worksUnits(district.definitionId)) return maxForLevel;
  return Math.min(maxForLevel, 1 + workedUnitCells(state, map, district).length);
}

/** The nearest (workers − 1) worked units — highlighted while the district card is open. */
export function staffedWorkedCells(state: GameState, map: MapData, district: District): Coord[] {
  const cells = workedUnitCells(state, map, district);
  return cells.slice(0, Math.max(0, district.assignedWorkers - 1));
}
