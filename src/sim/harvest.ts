// Resource cells: tapping, exhaustion, lazy recovery
// (Docs/features/harvest-loop.md §1, §4).

import { FEATURES, HARVEST, type HarvestSpec } from './data/definitions';
import { effectiveCollectCooldownMs, effectiveTapYield } from './upgrades';
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
  const key = coordKey(cell);
  const s = cellState(state, key);
  recoverIfDue(s, now);
  s.taps += 1;
  if (s.taps < spec.tapsToExhaust) return false;
  if (spec.recoverySeconds <= 0) {
    // Finite source (Berry bush, Wild animals): consumed — the feature
    // vanishes from the map for good.
    delete state.features[key];
    delete state.harvest[key];
    return true;
  }
  s.exhaustedUntil = now + spec.recoverySeconds * 1000;
  return true;
}

export type TapCellResult = 'Harvested' | 'Exhausted' | 'NotHarvestable' | 'NotRevealed';
export type CollectTapResult = TapCellResult | 'OnCooldown';

/** Free player tap on a resource cell: +yield to the city wallet, +1 tap.
 *  No cooldown — the raw primitive (also handy for test setup). */
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
  addToWallet(state.city.wallet, spec.currencyId, effectiveTapYield(state, spec));
  registerTap(state, cell, spec, now);
  return 'Harvested';
}

/** The PLAYER's collect tap: tapCell gated by the collect cooldown. The same
 *  gate paces hold-to-collect — the input layer retries and this decides. */
export function collectTap(
  state: GameState,
  map: MapData,
  cell: Coord,
  now: number,
): CollectTapResult {
  if (now - state.lastCollectTapAt < effectiveCollectCooldownMs(state)) return 'OnCooldown';
  const result = tapCell(state, map, cell, now);
  if (result === 'Harvested') state.lastCollectTapAt = now;
  return result;
}
