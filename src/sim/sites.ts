// Where the authored map SITES are — landmarks and ruins — and nothing else.
//
// This module deliberately knows about coordinates and content ids only, never
// about GameState. That is what lets districts.ts ask "is this cell a site?"
// without importing landmarks.ts, which needs fog.ts, which needs districts.ts.
// The claiming and delving rules live in landmarks.ts and expeditions.ts; only
// the geography lives here.

import { LANDMARKS, RUINS, type LandmarkDef, type RuinDef } from './data/definitions';
import { cellsOfRect, coordKey, type Coord, type RuinId } from './state';

/**
 * Every cell a site stands on, not just the one it is anchored at.
 *
 * A sanctuary or a ruin may be more than one cell a side
 * (Docs/features/01-map-and-fog.md §3.1), and every cell of it answers as the
 * site: you cannot build on any of them, and a tap anywhere on it is a tap on
 * it. The size is AUTHORED here rather than grouped, because a ruin is
 * placed, not painted.
 */
const spread = <T extends { location: Coord; size: number }>(
  sites: readonly T[],
): ReadonlyMap<string, T> => {
  const out = new Map<string, T>();
  for (const s of sites) {
    for (const c of cellsOfRect(s.location, { x: s.size, y: s.size })) {
      out.set(coordKey(c), s);
    }
  }
  return out;
};

const LANDMARK_BY_CELL = spread(LANDMARKS);
const RUIN_BY_CELL = spread(Object.values(RUINS));

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
