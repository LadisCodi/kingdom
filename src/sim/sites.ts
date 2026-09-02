// Where the authored map SITES are — landmarks and ruins — and nothing else.
//
// This module deliberately knows about coordinates and content ids only, never
// about GameState. That is what lets districts.ts ask "is this cell a site?"
// without importing landmarks.ts, which needs fog.ts, which needs districts.ts.
// The claiming and delving rules live in landmarks.ts and expeditions.ts; only
// the geography lives here.

import { LANDMARKS, RUINS, type LandmarkDef, type RuinDef } from './data/definitions';
import { coordKey, type Coord, type RuinId } from './state';

const LANDMARK_BY_CELL: ReadonlyMap<string, LandmarkDef> = new Map(
  LANDMARKS.map((l) => [coordKey(l.location), l]),
);

const RUIN_BY_CELL: ReadonlyMap<string, RuinDef> = new Map(
  Object.values(RUINS).map((r) => [coordKey(r.location), r]),
);

export const landmarkDefAt = (cell: Coord): LandmarkDef | undefined =>
  LANDMARK_BY_CELL.get(coordKey(cell));

export const ruinDefAt = (cell: Coord): RuinDef | undefined => RUIN_BY_CELL.get(coordKey(cell));

/** True when the cell holds authored content — never building ground. Paving
 *  over a ruin would silently delete a whole dungeon. */
export const cellHasSite = (cell: Coord): boolean => {
  const key = coordKey(cell);
  return LANDMARK_BY_CELL.has(key) || RUIN_BY_CELL.has(key);
};

export const allLandmarkCells = (): Coord[] => LANDMARKS.map((l) => l.location);
export const allRuinCells = (): Array<{ id: RuinId; location: Coord }> =>
  Object.values(RUINS).map((r) => ({ id: r.id, location: r.location }));
