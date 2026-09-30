// Where the authored map SITES are — landmarks and lairs — and nothing else.
//
// This module deliberately knows about coordinates and content ids only, never
// about GameState. That is what lets districts.ts ask "is this cell a site?"
// without importing landmarks.ts, which needs fog.ts, which needs districts.ts.
// The claiming and delving rules live in landmarks.ts and expeditions.ts; only
// the geography lives here.

import { LANDMARKS, LAIRS, type LandmarkDef, type LairDef } from './data/definitions';
import { cellsOfRect, coordKey, type Coord, type LairId } from './state';

/**
 * Every cell a site stands on, not just the one it is anchored at.
 *
 * A sanctuary or a lair may be more than one cell a side
 * (Docs/features/01-map-and-fog.md §3.1), and every cell of it answers as the
 * site: you cannot build on any of them, and a tap anywhere on it is a tap on
 * it. The size is AUTHORED here rather than grouped, because a lair is
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
const LAIR_BY_CELL = spread(Object.values(LAIRS));

export const landmarkDefAt = (cell: Coord): LandmarkDef | undefined =>
  LANDMARK_BY_CELL.get(coordKey(cell));

export const lairDefAt = (cell: Coord): LairDef | undefined => LAIR_BY_CELL.get(coordKey(cell));

/** True when the cell holds authored content — never building ground. Paving
 *  over a lair would silently delete a whole dungeon. */
export const cellHasSite = (cell: Coord): boolean => {
  const key = coordKey(cell);
  return LANDMARK_BY_CELL.has(key) || LAIR_BY_CELL.has(key);
};

export const allLandmarkCells = (): Coord[] => LANDMARKS.map((l) => l.location);
export const allLairCells = (): Array<{ id: LairId; location: Coord }> =>
  Object.values(LAIRS).map((r) => ({ id: r.id, location: r.location }));
