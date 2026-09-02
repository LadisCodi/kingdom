// Resource cells: tapping, exhaustion, lazy recovery
// (Docs/features/harvest-loop.md §1, §4).

import { DISTRICTS, FEATURES, HARVEST, type HarvestSpec } from './data/definitions';
import { recordResourceDiscovery } from './discovery';
import { recordQuestEvent } from './quests';
import { effectiveAutoTapCooldownMs, effectiveTapYield } from './upgrades';
import { neighbors, type MapData } from './grid';
import { resolve } from './modifiers';
import { pick } from './rng';
import {
  addToWallet, coordKey, districtAt, parseCoordKey,
  type CellHarvestState, type Coord, type GameState, type HarvestSourceId,
} from './state';

/** What (if anything) this cell yields when tapped/worked. */
export function harvestSourceAt(state: GameState, cell: Coord): HarvestSourceId | null {
  const district = districtAt(state, cell);
  if (district) {
    // Some districts ARE resource cells (a built FarmLands is a Crops cell);
    // every other district blocks. Buildings with timers (Townhall, Housing)
    // are NOT harvest sources — tapping them boosts their timers instead.
    const provides = DISTRICTS[district.definitionId].providesHarvestSource;
    return district.state === 'Built' ? provides : null;
  }
  const feature = state.features[coordKey(cell)];
  if (feature) return FEATURES[feature].source;
  return null;
}

export const harvestSpecAt = (state: GameState, cell: Coord): HarvestSpec | null => {
  const source = harvestSourceAt(state, cell);
  return source === null ? null : HARVEST[source];
};

/** What ONE player collect tap on this cell pays (0 = not harvestable). */
export function tapYieldAt(state: GameState, cell: Coord): number {
  const source = harvestSourceAt(state, cell);
  return source === null ? 0 : effectiveTapYield(state, HARVEST[source]);
}

const cellState = (state: GameState, key: string): CellHarvestState => {
  let s = state.harvest[key];
  if (!s) {
    s = { taps: 0, exhaustedUntil: null };
    state.harvest[key] = s;
  }
  return s;
};

/** How long a cell stays exhausted, after the Verdant Seal and anything else
 *  that shortens it. Stamped ONCE at the moment of exhaustion — a relic
 *  attuned afterwards does not retroactively wake sleeping cells, which keeps
 *  the timer a fact about the cell rather than a live query. */
export const effectiveRecoveryMs = (state: GameState, spec: HarvestSpec): number =>
  Math.max(1000, Math.round(resolve(state, 'cellRecovery', spec.recoverySeconds * 1000)));

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
    // vanishes from this cell. With respawnSeconds it later reappears in a
    // random tile ADJACENT TO ITS ORIGINAL MAP CELL; otherwise it is gone.
    const feature = state.features[key];
    if (feature && spec.respawnSeconds > 0) {
      const meta = state.featureMeta[key] ?? { origin: key, generation: 0 };
      state.featureRespawns.push({
        origin: meta.origin,
        feature,
        readyAt: now + spec.respawnSeconds * 1000,
        generation: meta.generation + 1,
      });
    }
    delete state.features[key];
    delete state.featureMeta[key];
    delete state.harvest[key];
    return true;
  }
  s.exhaustedUntil = now + effectiveRecoveryMs(state, spec);
  return true;
}

// -------------------------------------------------------------- respawning

/** Place every due respawn: a random valid neighbor of the ORIGIN cell
 *  (the feature's respawn terrain — Grassland for bushes/animals, Water for
 *  fish shoals — no district, no feature). No valid cell → gone for good. */
export function advanceRespawns(state: GameState, map: MapData, toTime: number): void {
  const due = state.featureRespawns
    .filter((r) => r.readyAt <= toTime)
    .sort((a, b) => a.readyAt - b.readyAt);
  if (due.length === 0) return;
  state.featureRespawns = state.featureRespawns.filter((r) => r.readyAt > toTime);
  for (const r of due) {
    const terrain = FEATURES[r.feature].respawnTerrain;
    const candidates = neighbors(map, parseCoordKey(r.origin)).filter((c) => {
      const k = coordKey(c);
      return map.terrain.get(k) === terrain &&
        state.features[k] === undefined &&
        districtAt(state, c) === undefined;
    });
    if (candidates.length === 0) continue; // nowhere left — removed for good
    // Keyed by the EVENT (this origin, this generation), so where a bush
    // reappears is the same whether the window was replayed or ticked.
    const cell = pick(state.seed, candidates, 'respawn', r.origin, r.generation);
    const key = coordKey(cell);
    state.features[key] = r.feature;
    state.featureMeta[key] = { origin: r.origin, generation: r.generation };
  }
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
  const units = tapYieldAt(state, cell);
  addToWallet(state.city.wallet, spec.currencyId, units);
  recordResourceDiscovery(state, spec.currencyId);
  recordQuestEvent(state, { kind: 'collect', currency: spec.currencyId, amount: units });
  recordQuestEvent(state, { kind: 'tap' });
  registerTap(state, cell, spec, now);
  return 'Harvested';
}

/** The PLAYER's collect tap.
 *
 *  A deliberate tap is never gated — tapping fast is a skill. Only the
 *  repeats a HELD pointer generates pass `autoRepeat`, and those wait out
 *  `effectiveAutoTapCooldownMs` so holding stays the lazier, slower option.
 *  Every successful collect stamps the clock, so starting a hold right after
 *  a manual tap still waits one full cooldown. */
export function collectTap(
  state: GameState,
  map: MapData,
  cell: Coord,
  now: number,
  autoRepeat = false,
): CollectTapResult {
  if (autoRepeat && now - state.lastCollectTapAt < effectiveAutoTapCooldownMs(state)) {
    return 'OnCooldown';
  }
  const result = tapCell(state, map, cell, now);
  if (result === 'Harvested') state.lastCollectTapAt = now;
  return result;
}
