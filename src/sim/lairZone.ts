// A lair's ZONE — the ground it holds (Docs/proposals/lairs.md §3).
//
// Every cell within a lair's `radius` of its footprint, Chebyshev, is its
// zone. While the lair stands, and once it is DISCOVERED, nothing inside the
// zone may be tapped, built on or harvested, and a spell skips it. The fog
// inside is not the zone's: revealing a cell of it is how a lair is found.
//
// Its own module, depending on the data and the state alone, because the four
// places that ask — the tap, placement, the crews and the spells — sit below
// `lairs.ts` in the import graph, and a lair's zone is a fact about the map
// plus one bit of state, not about raids.

import { LAIRS, LAIR_ORDER } from './data/definitions';
import { coordKey, type Coord, type GameState, type LairId } from './state';

/** The cells one lair's zone covers, footprint included — unclipped: a cell
 *  off the map simply never comes up. */
export function lairZoneCells(lairId: LairId): Coord[] {
  const { location: o, size, radius } = LAIRS[lairId];
  const out: Coord[] = [];
  for (let y = o.y - radius; y < o.y + size + radius; y++) {
    for (let x = o.x - radius; x < o.x + size + radius; x++) out.push({ x, y });
  }
  return out;
}

/** Cell → the lairs whose zone covers it, in lair order. Zones that overlap
 *  are one zone (§3), so a cell may answer to two. Static: the map is. */
const ZONE_BY_CELL: ReadonlyMap<string, readonly LairId[]> = (() => {
  const out = new Map<string, LairId[]>();
  for (const id of LAIR_ORDER) {
    for (const c of lairZoneCells(id)) {
      const k = coordKey(c);
      const list = out.get(k);
      if (list) list.push(id); else out.set(k, [id]);
    }
  }
  return out;
})();

/** The lairs whose zone covers this cell, standing or not, found or not. */
export const zoneLairsAt = (cell: Coord): readonly LairId[] =>
  ZONE_BY_CELL.get(coordKey(cell)) ?? [];

/** True while the lair holds its ground: discovered, and not cleared. */
export const lairHoldsGround = (state: GameState, lairId: LairId): boolean => {
  const lair = state.lairs[lairId];
  return lair !== undefined && !lair.cleared;
};

/**
 * THE question every refusal asks: which lair, if any, holds this cell right
 * now. The first in lair order when two zones overlap — the refusal names one
 * lair, and it names the same one every time.
 */
export function lairHolding(state: GameState, cell: Coord): LairId | null {
  for (const id of zoneLairsAt(cell)) {
    if (lairHoldsGround(state, id)) return id;
  }
  return null;
}

/**
 * A lair is FOUND the moment any cell of its zone is Revealed (§2.1) — by a
 * paid fog tap, a building's reveal ring, a spell, anything that reveals. A
 * cell that is only Discovered, under the scrim, does not wake it: a
 * building's or a claim's discover ring never finds a lair.
 */
export const lairIsFound = (state: GameState, lairId: LairId): boolean =>
  lairZoneCells(lairId).some((c) => state.fog.revealed[coordKey(c)] === true);
