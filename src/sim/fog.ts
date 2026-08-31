// Fog of war: state derivation, reveal cost curve, pay-per-tap reveal (Docs/02).

import { FOG } from './data/definitions';
import { neighbors, townhallDistance, type MapData } from './grid';
import { addToWallet, coordKey, districtCells, getWallet, type Coord, type GameState } from './state';

export type FogState = 'Revealed' | 'Discovered' | 'Undiscovered';

export function fogState(state: GameState, map: MapData, cell: Coord): FogState {
  if (state.fog.revealed[coordKey(cell)]) return 'Revealed';
  for (const n of neighbors(map, cell)) {
    if (state.fog.revealed[coordKey(n)]) return 'Discovered';
  }
  return 'Undiscovered';
}

/** Total Silver to reveal a cell at BFS distance d (FogOfWarSettings.GetTotalCost). */
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
  return Math.max(cost, FOG.silverPerTap);
}

export const revealCostForCell = (map: MapData, cell: Coord): number =>
  revealCost(townhallDistance(map, cell));

export type RevealTapResult = 'Paid' | 'Revealed' | 'NotDiscovered' | 'NotEnoughSilver';

/** One tap on a Discovered cell: pay min(silverPerTap, remaining) toward its reveal. */
export function revealTap(state: GameState, map: MapData, cell: Coord): RevealTapResult {
  if (fogState(state, map, cell) !== 'Discovered') return 'NotDiscovered';
  const key = coordKey(cell);
  const total = revealCostForCell(map, cell);
  const paid = state.fog.progress[key] ?? 0;
  const payment = Math.min(FOG.silverPerTap, total - paid);
  if (getWallet(state.city.wallet, 'Silver') < payment) return 'NotEnoughSilver';
  addToWallet(state.city.wallet, 'Silver', -payment);
  const nowPaid = paid + payment;
  if (nowPaid >= total) {
    delete state.fog.progress[key];
    state.fog.revealed[key] = true;
    return 'Revealed'; // caller must trigger a production recalc
  }
  state.fog.progress[key] = nowPaid;
  return 'Paid';
}

/** New-game seed: every cell of every district footprint plus all their neighbors. */
export function seedFog(state: GameState, map: MapData): void {
  for (const d of state.city.districts) {
    for (const cell of districtCells(d)) {
      state.fog.revealed[coordKey(cell)] = true;
      for (const n of neighbors(map, cell)) state.fog.revealed[coordKey(n)] = true;
    }
  }
}
