// Resource cells: tapping, exhaustion, lazy recovery
// (Docs/features/harvest-loop.md §1, §4).

import { FEATURES, HARVEST, type HarvestSpec } from './data/definitions';
import type { MapData } from './grid';
import {
  addToWallet, coordKey, districtAt,
  type CellHarvestState, type Coord, type GameState, type HarvestSourceId,
} from './state';

/** What (if anything) this cell yields when tapped/worked. */
export function harvestSourceAt(state: GameState, cell: Coord): HarvestSourceId | null {
  const district = districtAt(state, cell);
  if (district) {
    // A built crop plot (FarmLands) IS a Crops cell; any other district blocks.
    if (district.definitionId === 'FarmLands' && district.state === 'Built') return 'Crops';
    return null;
  }
  const feature = state.features[coordKey(cell)];
  if (feature) return FEATURES[feature].source;
  return null;
}

export const harvestSpecAt = (state: GameState, cell: Coord): HarvestSpec | null => {
  const source = harvestSourceAt(state, cell);
  return source === null ? null : HARVEST[source];
};

const cellState = (state: GameState, key: string): CellHarvestState => {
  let s = state.harvest[key];
  if (!s) {
    s = { taps: 0, exhaustedUntil: null };
    state.harvest[key] = s;
  }
  return s;
};

/** Lazy recovery: an elapsed exhaustedUntil resets the cell. */
function recoverIfDue(s: CellHarvestState, now: number): void {
  if (s.exhaustedUntil !== null && s.exhaustedUntil <= now) {
    s.exhaustedUntil = null;
    s.taps = 0;
  }
}

export function isExhausted(state: GameState, cell: Coord, now: number): boolean {
  const s = state.harvest[coordKey(cell)];
  if (!s) return false;
  recoverIfDue(s, now);
  return s.exhaustedUntil !== null;
}

/** When the cell will next be workable; null if it is workable now. */
export function recoversAt(state: GameState, cell: Coord, now: number): number | null {
  const s = state.harvest[coordKey(cell)];
  if (!s) return null;
  recoverIfDue(s, now);
  return s.exhaustedUntil;
}

/** Remaining tap fraction for UI (1 = fresh, 0 = about to exhaust). */
export function tapFraction(state: GameState, cell: Coord, spec: HarvestSpec, now: number): number {
  const s = state.harvest[coordKey(cell)];
  if (!s) return 1;
  recoverIfDue(s, now);
  return 1 - s.taps / spec.tapsToExhaust;
}

/** Register one extraction (player tap or worker delivery) against the cell.
 *  Returns true if this tap exhausted the cell. Caller has verified the cell
 *  is a live resource cell. */
export function registerTap(
  state: GameState,
  cell: Coord,
  spec: HarvestSpec,
  now: number,
): boolean {
  const s = cellState(state, coordKey(cell));
  recoverIfDue(s, now);
  s.taps += 1;
  if (s.taps < spec.tapsToExhaust) return false;
  s.exhaustedUntil = now + spec.recoverySeconds * 1000;
  return true;
}

export type TapCellResult = 'Harvested' | 'Exhausted' | 'NotHarvestable' | 'NotRevealed';

/** Free player tap on a resource cell: +yield to the city wallet, +1 tap. */
export function tapCell(
  state: GameState,
  map: MapData,
  cell: Coord,
  now: number,
): TapCellResult {
  void map;
  if (!state.fog.revealed[coordKey(cell)]) return 'NotRevealed';
  const source = harvestSourceAt(state, cell);
  if (source === null) return 'NotHarvestable';
  if (isExhausted(state, cell, now)) return 'Exhausted';
  const spec = HARVEST[source];
  addToWallet(state.city.wallet, spec.currencyId, spec.yieldPerTap);
  registerTap(state, cell, spec, now);
  return 'Harvested';
}
