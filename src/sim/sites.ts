// Where the authored map SITES are — landmarks and lairs — and nothing else.
//
// This module deliberately knows about coordinates and content ids only, never
// about GameState. That is what lets districts.ts ask "is this cell a site?"
// without importing landmarks.ts, which needs fog.ts, which needs districts.ts.
// The claiming and delving rules live in landmarks.ts and expeditions.ts; only
// the geography lives here.

import { LANDMARKS, LAIRS, type LandmarkDef, type LairDef } from './data/definitions';
import { cellsOfRect, coordKey, type Coord, type GameState, type LairId } from './state';

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

/**
 * The lair standing on this cell, as the player sees it: FOUND (it has a
 * clock) and not cleared. A lair nobody has found has no picture and no tap
 * (Docs/proposals/lairs.md §2.1), and a cleared one is gone — its cells are
 * ordinary ground (§5).
 */
export const standingLairAt = (state: GameState, cell: Coord): LairDef | undefined => {
  const lair = LAIR_BY_CELL.get(coordKey(cell));
  if (!lair) return undefined;
  const held = state.lairs[lair.id];
  return held !== undefined && !held.cleared ? lair : undefined;
};

/** True when the cell holds authored content — never building ground. A
 *  landmark always; a lair until it is cleared, found or not, since a lair's
 *  footprint sits inside its own zone and is refused either way. */
export const cellHasSite = (state: GameState, cell: Coord): boolean => {
  const key = coordKey(cell);
  if (LANDMARK_BY_CELL.has(key)) return true;
  const lair = LAIR_BY_CELL.get(key);
  return lair !== undefined && state.lairs[lair.id]?.cleared !== true;
};

export const allLandmarkCells = (): Coord[] => LANDMARKS.map((l) => l.location);
export const allLairCells = (): Array<{ id: LairId; location: Coord }> =>
  Object.values(LAIRS).map((r) => ({ id: r.id, location: r.location }));
