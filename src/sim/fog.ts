// Fog of war: state derivation, reveal cost curve, pay-per-tap reveal (Docs/02).

import { DISTRICTS, FOG } from './data/definitions';
import { cellsWithinRadiusOfRect, neighbors, townhallDistance, type MapData } from './grid';
import { resolve } from './modifiers';
import { recordQuestEvent } from './quests';
import { isTechComplete } from './research';
import {
  addToWallet, coordKey, districtCells, getWallet,
  type Coord, type District, type GameState, type TechId,
} from './state';

export type FogState = 'Revealed' | 'Discovered' | 'Undiscovered';

export function fogState(state: GameState, map: MapData, cell: Coord): FogState {
  if (state.fog.revealed[coordKey(cell)]) return 'Revealed';
  if (state.fog.discovered[coordKey(cell)]) return 'Discovered';
  for (const n of neighbors(map, cell)) {
    if (state.fog.revealed[coordKey(n)]) return 'Discovered';
  }
  return 'Undiscovered';
}

/** Total Gold to reveal a cell at BFS distance d (FogOfWarSettings.GetTotalCost). */
export function revealCost(d: number): number {
  const rings = FOG.rings;
  let cost: number;
  if (d <= rings[0].distance) {
    cost = rings[0].cost;
  } else {
    const last = rings[rings.length - 1];
    if (d <= last.distance) {
      // nearest LOWER authored ring
      let c = rings[0].cost;
      for (const r of rings) if (r.distance <= d) c = r.cost;
      cost = c;
    } else {
      cost = Math.round(last.cost * Math.max(1, FOG.fallbackGrowth) ** (d - last.distance));
    }
  }
  return Math.max(cost, FOG.goldPerTap);
}

/** The cost the PLAYER actually pays, after the Dowsing Rod and anything else
 *  that discounts the fog. Every consumer reads this rather than revealCost(),
 *  so a discount can never apply to the bar but not the charge. */
export const revealCostForCell = (state: GameState, map: MapData, cell: Coord): number =>
  Math.max(
    FOG.goldPerTap,
    Math.round(resolve(state, 'revealCost', revealCost(townhallDistance(map, cell)))),
  );

/** Exploration gates: sea and mountain cells need their tech before the
 *  player can pay to reveal them (building fog radii ignore this). */
export function explorationGate(map: MapData, cell: Coord): TechId | null {
  const terrain = map.terrain.get(coordKey(cell));
  if (terrain === 'Water') return 'Sailing';
  if (terrain === 'Mountain') return 'ScalingTools';
  return null;
}

export type RevealTapResult = 'Paid' | 'Revealed' | 'NotDiscovered' | 'NotEnoughGold' | 'TechLocked';

/** One tap on a Discovered cell: pay min(goldPerTap, remaining) toward its reveal. */
export function revealTap(state: GameState, map: MapData, cell: Coord): RevealTapResult {
  if (fogState(state, map, cell) !== 'Discovered') return 'NotDiscovered';
  const gate = explorationGate(map, cell);
  if (gate !== null && !isTechComplete(state, gate)) return 'TechLocked';
  const key = coordKey(cell);
  const total = revealCostForCell(state, map, cell);
  const paid = state.fog.progress[key] ?? 0;
  const payment = Math.min(FOG.goldPerTap, total - paid);
  if (getWallet(state.city.wallet, 'Gold') < payment) return 'NotEnoughGold';
  addToWallet(state.city.wallet, 'Gold', -payment);
  const nowPaid = paid + payment;
  if (nowPaid >= total) {
    delete state.fog.progress[key];
    delete state.fog.discovered[key];
    state.fog.revealed[key] = true;
    recordQuestEvent(state, { kind: 'reveal' });
    return 'Revealed'; // caller must trigger a production recalc
  }
  state.fog.progress[key] = nowPaid;
  return 'Paid';
}

/** Apply a district's fog radii: reveal fogRevealRadius around the footprint
 *  (footprint included), mark Discovered out to fogDiscoverRadius. Called at
 *  the new-game seed and when a build completes. */
export function revealAroundDistrict(state: GameState, map: MapData, district: District): void {
  const def = DISTRICTS[district.definitionId];
  for (const cell of districtCells(district)) {
    if (map.terrain.has(coordKey(cell))) state.fog.revealed[coordKey(cell)] = true;
  }
  for (const cell of cellsWithinRadiusOfRect(map, district.location, def.size, def.fogRevealRadius)) {
    state.fog.revealed[coordKey(cell)] = true;
  }
  for (const cell of cellsWithinRadiusOfRect(map, district.location, def.size, def.fogDiscoverRadius)) {
    if (!state.fog.revealed[coordKey(cell)]) state.fog.discovered[coordKey(cell)] = true;
  }
}

/** New-game seed: every district applies its fog radii. */
export function seedFog(state: GameState, map: MapData): void {
  for (const d of state.city.districts) revealAroundDistrict(state, map, d);
}
