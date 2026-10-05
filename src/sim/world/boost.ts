// What the city's research does to its improvements on the world board
// (Docs/features/19-world-map.md §7).
//
// An improvement's output and store are the world server's numbers, but the
// research that lifts them is the player's: the city prices its own boost
// and sends it, the way it sends an army's pace (worldServer/core.ts#setBoost).
// The server settles every store at the moment it takes a new boost, so what
// was made before the research is never repriced.

import type { GameState } from '../state';
import { techMultiplier } from '../techEffects';

/** Multipliers (≥ 1) on what every improvement makes an hour, and on what
 *  its store holds. */
export function worldImprovementBoost(state: GameState): { produce: number; store: number } {
  return {
    produce: Math.max(1, techMultiplier(state, 'improvementYield')),
    store: Math.max(1, techMultiplier(state, 'improvementStore')),
  };
}

/** Does researching a technology change what this city sends the server? */
export const movesWorldBoost = (effects: ReadonlyArray<{ stat: string }>): boolean =>
  effects.some((e) => e.stat === 'improvementYield' || e.stat === 'improvementStore');
