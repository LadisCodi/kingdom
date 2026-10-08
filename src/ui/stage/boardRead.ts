// WHAT THE STAGE READS OFF THE WORLD BOARD (Docs/features/23-tutorials.md
// §4.3): the ground the player holds, the hex a first claim should take, and
// the nearest camp, dungeon and Portal — for the scenes that teach the board.
//
// Pure reads of the game's world source; nothing here writes.

import type { Game } from '../../game';
import { campShown } from '../../sim/world/camps';
import { fogStatesOf, homeIndex, worldFog, type FogState } from '../../sim/world/explorers';
import { boardNeighbors, hexAt, hexDistance, PORTAL_INDICES } from '../../sim/world/hex';
import type { BoardHex } from '../../sim/world/board';

const fogOf = (game: Game): FogState[] => fogStatesOf(worldFog(game.state));

/** Hexes the player has claimed beyond the city, standing or still building. */
export function heldHexes(game: Game): number {
  const source = game.worldSource();
  const seat = game.worldSeat();
  return source.board().hexes.filter((h) => source.hexOf(h.index)?.owner === seat).length;
}

/** The nearest hex to the city that answers `pred`, or null. */
function nearest(game: Game, pred: (h: BoardHex, fog: FogState) => boolean): number | null {
  const home = homeIndex(game.state);
  const fog = fogOf(game);
  let best: number | null = null;
  let bestD = Infinity;
  for (const h of game.worldSource().board().hexes) {
    if (!pred(h, fog[h.index])) continue;
    const d = hexDistance(hexAt(home), h.hex);
    if (d < bestD) { bestD = d; best = h.index; }
  }
  return best;
}

/** The hex a first claim should take: revealed, nobody's, unguarded, not a
 *  dungeon or the Portal, and beside the city or ground the player holds
 *  active (19-world-map.md §5.1). */
export function claimHex(game: Game): number | null {
  const source = game.worldSource();
  const seat = game.worldSeat();
  const home = homeIndex(game.state);
  const ours = (i: number): boolean => i === home
    || (source.hexOf(i)?.owner === seat && source.hexOf(i)?.active === true);
  return nearest(game, (h, fog) => fog === 'Revealed' && h.terrain !== null && h.seat === null
    && !h.features.includes('Dungeon') && source.controlOf(h.index) === null && source.hexOf(h.index) === null
    && (h.camp === null || source.campBeaten(h.index))
    && boardNeighbors(h.index).some(ours));
}

/** The nearest monster camp the player can see and has not beaten. */
export const campHex = (game: Game): number | null => {
  const source = game.worldSource();
  return nearest(game, (h, fog) => h.camp !== null && campShown(source, h, fog) && !source.campBeaten(h.index)
    && source.controlOf(h.index) === null);
};

/** The nearest dungeon out of the dark. */
export const dungeonHex = (game: Game): number | null =>
  nearest(game, (h, fog) => h.features.includes('Dungeon') && fog !== 'Unknown');

/** The player's own board's Portal: the one nearest the city. */
export const portalHex = (game: Game): number | null =>
  nearest(game, (h) => PORTAL_INDICES.includes(h.index));
