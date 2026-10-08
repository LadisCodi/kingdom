// What the city's research does on the world board
// (Docs/features/19-world-map.md §7).
//
// A district's output and store, a build's time, how many Fortresses and
// Chapels may stand and which buildings may be raised at all are the world
// server's numbers — but the research that moves them is the player's: the
// city prices its own boost and sends it, the way it sends an army's pace
// (worldServer/core.ts#setBoost). The server settles every store at the
// moment it takes a new boost, so what was made before the research is never
// repriced.

import { WORLD_BUILD, worldUpgradeGate, type TechnologyDef } from '../data/definitions';
import { isTechComplete } from '../research';
import type { GameState } from '../state';
import { techFlat, techMultiplier, techPctAimed } from '../techEffects';
import type { SeatBoost } from '../../worldServer/types';
import { WORLD_DISTRICTS, WORLD_UPGRADES } from './types';

/** Everything the city's research does on the world board, as the server
 *  takes it. */
export function worldImprovementBoost(state: GameState): SeatBoost {
  // Every district's share, then each kind's own on top.
  const districts: NonNullable<SeatBoost['districts']> = {};
  for (const d of WORLD_DISTRICTS) {
    const produce = 1 + techPctAimed(state, 'improvementYield', { worldDistrict: d });
    const store = 1 + techPctAimed(state, 'improvementStore', { worldDistrict: d });
    if (produce > 1 || store > 1) districts[d] = { produce, store };
  }
  return {
    produce: Math.max(1, techMultiplier(state, 'improvementYield')),
    store: Math.max(1, techMultiplier(state, 'improvementStore')),
    ...(Object.keys(districts).length > 0 ? { districts } : {}),
    build: Math.max(1, techMultiplier(state, 'worldBuildSpeed')),
    repair: Math.max(1, techMultiplier(state, 'worldRepairSpeed')),
    fortresses: WORLD_BUILD.fortresses + Math.max(0, Math.floor(techFlat(state, 'fortressSlots'))),
    chapels: Math.max(0, Math.floor(techFlat(state, 'chapelSlots'))),
    upgrades: WORLD_UPGRADES.filter((u) => {
      const gate = worldUpgradeGate(u);
      return gate === null || isTechComplete(state, gate);
    }),
  };
}

/** The stats whose ranks change what this city sends the server. */
const SENT_STATS = new Set([
  'improvementYield', 'improvementStore', 'worldBuildSpeed', 'worldRepairSpeed', 'fortressSlots', 'chapelSlots',
]);

/** Does researching a technology change what this city sends the server? */
export const movesWorldBoost = (tech: Pick<TechnologyDef, 'effects' | 'unlocks'>): boolean =>
  tech.effects.some((e) => SENT_STATS.has(e.stat)) || tech.unlocks.some((u) => 'worldUpgrade' in u);
