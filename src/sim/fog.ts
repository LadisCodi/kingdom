// Fog of war: state derivation, reveal cost curve, pay-per-tap reveal (Docs/02).

import { DISTRICTS, FOG, KNOWLEDGE } from './data/definitions';
import { recordResourceDiscovery } from './discovery';
import { cellsWithinRadiusOfRect, neighbors, townhallDistance, type MapData } from './grid';
import { resolve } from './modifiers';
import { effect } from './upgrades';
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

/**
 * Can the player pay to clear this cell yet?
 *
 * The frontier has to stay CONNECTED: a cell is only payable when it touches
 * ground you have already cleared. A building's discover radius reaches
 * further than its reveal radius, so without this the player could buy an
 * island three tiles out and leave a ring of fog around it — exploration
 * became a shopping list of whatever looked interesting rather than a border
 * you push outward, and the distance cost curve stopped meaning anything
 * because you could skip straight to the cheap side of the map.
 *
 * Being Discovered still means "you can SEE something is there". This is only
 * about what you can buy.
 */
export const isReachable = (state: GameState, map: MapData, cell: Coord): boolean =>
  neighbors(map, cell).some((n) => state.fog.revealed[coordKey(n)] === true);

/** Exploration gates: sea and mountain cells need their tech before the
 *  player can pay to reveal them (building fog radii ignore this). */
export function explorationGate(map: MapData, cell: Coord): TechId | null {
  const terrain = map.terrain.get(coordKey(cell));
  if (terrain === 'Water') return 'Sailing';
  if (terrain === 'Mountain') return 'ScalingTools';
  return null;
}

/**
 * Knowledge for clearing one cell: linear in its distance from the Townhall,
 * so ring 3 pays 3 and ring 10 pays 10.
 *
 * Linear against a reveal cost that grows steeply, which is the point — the
 * far map is where the research tree comes from, but no single cell is a
 * jackpot, so the player earns the tree by pushing the border outward rather
 * than by finding one lucky tile. Revealing the whole map pays 2,902 against
 * a 643-Knowledge tree; quests carry another 591. Exploring roughly a quarter
 * of the map funds all the research there is.
 *
 * The Townhall's own ring pays 0, which never comes up: ring 0 starts
 * revealed and this is only ever reached by paying for fog.
 */
export const revealKnowledge = (map: MapData, cell: Coord): number =>
  townhallDistance(map, cell) * KNOWLEDGE.perRevealRing;

/**
 * How much reveal progress ONE tap on the fog buys.
 *
 * None of this makes a cell CHEAPER — the Gold a cell costs never moves. What
 * it buys back is the player's TIME, which is what exploring actually spends
 * once the far rings cost 320 and 640 Gold and a single cell wants hundreds
 * of taps.
 *
 * Two sources, and they stack: **Cartography** doubles a tap on its own (a
 * tech with an effect rather than a gate, the same shape as Communities
 * adding +1 to every bed), and **Surveying** adds one more per level. So the
 * ladder a player climbs is ×1 → ×2 on the research → ×3 → ×4.
 */
export const revealPerTap = (state: GameState): number =>
  FOG.goldPerTap
  * (1 + (isTechComplete(state, 'Cartography') ? 1 : 0) + effect(state, 'Surveying'));

export type RevealTapResult =
  | 'Paid' | 'Revealed' | 'NotDiscovered' | 'NotReachable' | 'NotEnoughGold' | 'TechLocked';

/** One tap on a Discovered cell: pay min(goldPerTap, remaining) toward its reveal. */
export function revealTap(state: GameState, map: MapData, cell: Coord): RevealTapResult {
  if (fogState(state, map, cell) !== 'Discovered') return 'NotDiscovered';
  // Checked before the tech gate: "you cannot reach it yet" is the more
  // useful thing to be told about a cell two rings out, and it is true
  // whether or not the player has the tech for that terrain.
  if (!isReachable(state, map, cell)) return 'NotReachable';
  const gate = explorationGate(map, cell);
  if (gate !== null && !isTechComplete(state, gate)) return 'TechLocked';
  const key = coordKey(cell);
  const total = revealCostForCell(state, map, cell);
  const paid = state.fog.progress[key] ?? 0;
  const payment = Math.min(revealPerTap(state), total - paid);
  if (getWallet(state.city.wallet, 'Gold') < payment) return 'NotEnoughGold';
  addToWallet(state.city.wallet, 'Gold', -payment);
  const nowPaid = paid + payment;
  if (nowPaid >= total) {
    delete state.fog.progress[key];
    delete state.fog.discovered[key];
    state.fog.revealed[key] = true;
    // Kingdom-scoped, like every other source of Knowledge.
    addToWallet(state.kingdom.wallet, 'Knowledge', revealKnowledge(map, cell));
    recordResourceDiscovery(state, 'Knowledge');
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
