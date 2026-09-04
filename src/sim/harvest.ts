// Resource cells: tapping, exhaustion, lazy recovery
// (Docs/features/04-harvest.md §2, §3).

import {
  DISTRICTS, FEATURES, HARVEST, TAP, terrainYield, type HarvestSpec,
} from './data/definitions';
import { recordResourceDiscovery } from './discovery';
import { payMana } from './mana';
import { recordQuestEvent } from './quests';
import { isTechComplete } from './research';
import { effectiveAutoTapCooldownMs, tapDraw } from './upgrades';
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

/** What ONE player collect tap on this cell would pay right now, capped by
 *  what the cell still holds (0 = not harvestable, or empty). For the UI —
 *  the tap itself settles its own fraction, so this ignores the carry. */
export function tapYieldAt(
  state: GameState, map: MapData, cell: Coord, now: number,
): number {
  const source = harvestSourceAt(state, cell);
  if (source === null) return 0;
  const spec = HARVEST[source];
  const want = Math.max(1, Math.floor(tapDraw(state, spec, 0)));
  return Math.min(want, stockAt(state, map, cell, now));
}

/**
 * How much this cell holds when full, after the ground under it.
 *
 * The terrain multiplier lands HERE, on the depot, and that is the whole
 * design: a desert tree holds five Wood where a grassland tree holds thirteen,
 * so the thumb and the crew are both affected without a second set of books —
 * they draw the same depot. Floored at one unit, so no ground is worth
 * literally nothing.
 *
 * It could not go on the chunk instead: `unitsPerStrike` is 1 on most cells
 * and 1 x 0.75 rounds back to 1, which would make every percentage a no-op.
 */
export function effectiveStock(map: MapData, cell: Coord, spec: HarvestSpec): number {
  if (spec.stock <= 0) return 0; // bedrock stays bedrock
  const terrain = map.terrain.get(coordKey(cell));
  const m = terrain === undefined ? 1 : terrainYield(terrain, spec.currencyId);
  return Math.max(1, Math.round(spec.stock * m));
}

const cellState = (
  state: GameState, map: MapData, key: string, cell: Coord, spec: HarvestSpec,
): CellHarvestState => {
  let s = state.harvest[key];
  if (!s) {
    s = { units: effectiveStock(map, cell, spec), exhaustedUntil: null };
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

/** A depot with no capacity never runs down and never recovers, because it
 *  never went anywhere: `stock` 0 is how the workbook says "this is bedrock".
 *  Checked before the finite branch, so a 0 recovery on such a source cannot
 *  be read as "consume the feature". */
export const isInexhaustible = (spec: HarvestSpec): boolean => spec.stock <= 0;

/** Lazy recovery: an elapsed exhaustedUntil refills the depot to full.
 *
 *  Binary, and chosen over continuous regrowth on purpose: a stump is the most
 *  legible state in the game, emptying a cell is what sends a worker looking
 *  for another one, and buying faster recovery is then something you can SEE
 *  (Docs/features/04-harvest.md §2). */
function recoverIfDue(
  s: CellHarvestState, map: MapData, cell: Coord, spec: HarvestSpec, now: number,
): void {
  if (s.exhaustedUntil !== null && s.exhaustedUntil <= now) {
    s.exhaustedUntil = null;
    s.units = effectiveStock(map, cell, spec);
  }
}

/** Units this cell still holds. Bedrock is bottomless. */
export function stockAt(state: GameState, map: MapData, cell: Coord, now: number): number {
  const spec = harvestSpecAt(state, cell);
  if (spec === null) return 0;
  if (isInexhaustible(spec)) return Number.POSITIVE_INFINITY;
  const s = state.harvest[coordKey(cell)];
  if (!s) return effectiveStock(map, cell, spec);
  recoverIfDue(s, map, cell, spec, now);
  return s.units;
}

export function isExhausted(
  state: GameState, map: MapData, cell: Coord, now: number,
): boolean {
  return stockAt(state, map, cell, now) <= 0;
}

/** When the cell will next be workable; null if it is workable now. */
export function recoversAt(
  state: GameState, map: MapData, cell: Coord, now: number,
): number | null {
  const spec = harvestSpecAt(state, cell);
  if (spec === null || isInexhaustible(spec)) return null;
  const s = state.harvest[coordKey(cell)];
  if (!s) return null;
  recoverIfDue(s, map, cell, spec, now);
  return s.exhaustedUntil;
}

/** Remaining depot fraction for UI (1 = full, 0 = empty). */
export function stockFraction(
  state: GameState,
  map: MapData,
  cell: Coord,
  spec: HarvestSpec,
  now: number,
): number {
  if (isInexhaustible(spec)) return 1;
  const s = state.harvest[coordKey(cell)];
  if (!s) return 1;
  recoverIfDue(s, map, cell, spec, now);
  return Math.max(0, Math.min(1, s.units / effectiveStock(map, cell, spec)));
}

/** Draw up to `want` units out of the cell. Returns what was ACTUALLY there,
 *  which may be less — and the shortfall is owed back to nobody: you paid one
 *  Mana for what the tree held, and that waste is the signal that your thumb
 *  has outgrown your ground. Caller has verified the cell is live.
 *
 *  This is the ONE place anything leaves the ground, and it is why no tap in
 *  the game can mint matter: the thumb and the worker draw the same depot. */
export function drawFromCell(
  state: GameState,
  map: MapData,
  cell: Coord,
  spec: HarvestSpec,
  want: number,
  now: number,
): number {
  // A mountain does not get used up by picking at it. An inexhaustible source
  // keeps NO cell state at all — there is no wear to remember, so there is
  // nothing to persist and nothing to grow without bound in the save.
  const asked = Math.max(0, Math.floor(want));
  if (isInexhaustible(spec)) return asked;
  const key = coordKey(cell);
  const s = cellState(state, map, key, cell, spec);
  recoverIfDue(s, map, cell, spec, now);
  const taken = Math.min(asked, s.units);
  if (taken <= 0) return 0;
  s.units -= taken;
  if (s.units > 0) return taken;
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
    return taken;
  }
  s.exhaustedUntil = now + effectiveRecoveryMs(state, spec);
  return taken;
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

export type TapCellResult =
  | 'Harvested' | 'Exhausted' | 'NotHarvestable' | 'NotRevealed' | 'TechLocked';
export type CollectTapResult = TapCellResult | 'OnCooldown' | 'NoMana';

/** Why this cell would refuse a tap, or null if it would harvest. Shared by
 *  the raw primitive and the player's tap, so the energy charge can be decided
 *  BEFORE anything is harvested without restating the guards. */
export function harvestBlock(
  state: GameState,
  map: MapData,
  cell: Coord,
  now: number,
): Exclude<TapCellResult, 'Harvested'> | null {
  if (!state.fog.revealed[coordKey(cell)]) return 'NotRevealed';
  const source = harvestSourceAt(state, cell);
  if (source === null) return 'NotHarvestable';
  // Checked before exhaustion: "you cannot work this yet" is the useful thing
  // to hear about a forest you have never been able to touch, and it is true
  // whether or not somebody has already worn the cell out.
  const gate = HARVEST[source].requiredTech;
  if (gate !== null && !isTechComplete(state, gate)) return 'TechLocked';
  if (isExhausted(state, map, cell, now)) return 'Exhausted';
  return null;
}

/** Free player tap on a resource cell: +yield to the city wallet, +1 tap.
 *  No cooldown — the raw primitive (also handy for test setup). */
export function tapCell(
  state: GameState,
  map: MapData,
  cell: Coord,
  now: number,
): TapCellResult {
  void map;
  const blocked = harvestBlock(state, map, cell, now);
  if (blocked !== null) return blocked;
  const spec = HARVEST[harvestSourceAt(state, cell)!];
  // A tap owes `tap.workSeconds` of this cell's own work — a fractional number
  // of units on most ground — so the remainder rides along in `tapCarry` until
  // it adds up. Without that, a +20% TapPower on a cell paying two units a tap
  // is destroyed by rounding and the upgrade is decorative.
  const carry = state.tapCarry[spec.currencyId] ?? 0;
  const owed = tapDraw(state, spec, carry);
  // Floored at one unit: ten seconds of work on slow ground is a fraction, and
  // a tap that pays nothing is a bug the player experiences as one. The floor
  // is generous on slow ground on purpose — that is where a worker is slowest
  // and the thumb matters most.
  const want = Math.max(1, Math.floor(owed));
  state.tapCarry[spec.currencyId] = Math.max(0, owed - want);
  const units = drawFromCell(state, map, cell, spec, want, now);
  if (units <= 0) return 'Exhausted';
  addToWallet(state.city.wallet, spec.currencyId, units);
  recordResourceDiscovery(state, spec.currencyId);
  recordQuestEvent(state, { kind: 'collect', currency: spec.currencyId, amount: units });
  // A WORKER's strike deliberately does NOT record this: the two look alike on
  // screen now, but a quest asking the player to tap is asking for the hand.
  recordQuestEvent(state, { kind: 'tap' });
  return 'Harvested';
}

/** The PLAYER's collect tap.
 *
 *  A deliberate tap is never gated by TIME — tapping fast is a skill. Only the
 *  repeats a HELD pointer generates pass `autoRepeat`, and those wait out
 *  `effectiveAutoTapCooldownMs` so holding stays the lazier, slower option.
 *  Every successful collect stamps the clock, so starting a hold right after
 *  a manual tap still waits one full cooldown.
 *
 *  It IS gated by energy: every collect costs `TAP.manaCost` Mana, the same
 *  price a house tap pays. Mana is what lets a player accelerate any
 *  generator by hand, so it is one budget across every tap in the game rather
 *  than a rule that happens to apply to houses.
 *
 *  The cell is asked first and charged second: tapping an exhausted or
 *  unrevealed cell costs nothing, and says the more useful thing. */
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
  const blocked = harvestBlock(state, map, cell, now);
  if (blocked !== null) return blocked;
  if (!payMana(state, TAP.manaCost)) return 'NoMana';
  const result = tapCell(state, map, cell, now);
  if (result === 'Harvested') state.lastCollectTapAt = now;
  return result;
}
