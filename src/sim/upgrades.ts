// Minor ranks: what used to be instant, gold-only, LEVELLED upgrades.
//
// Every node in the tree is a technology now (Docs/features/tech-tree.md §1
// rule 2), so a level became a rank: `Sawpits I -> II -> III`, each requiring
// the one before, each costing Gold AND time like anything else in the tree.
// `effect()` is the whole difference — it counts completed ranks where it used
// to read a stored level.
//
// The effective-value helpers below are the ONE place effects are applied, and
// each is now a three-stage pipeline: base -> completed ranks -> the modifier
// stack (artifact passives, hero traits, seasons; see sim/modifiers.ts). An
// empty stack is the bit-exact identity, so nothing changes until something
// grants a modifier.
//
// Integer stats (workerYield) round ONCE, here at the boundary, because they
// feed addToWallet directly and a fractional wallet would leak into quest
// counters, the Market and every displayed number. Math.round rather than
// floor: flooring makes a small multiplier useless at base-1 yields. The tap
// is the exception — it owes a FRACTION on purpose, and `tapCarry` keeps the
// remainder (see `tapDraw`).

import {
  DISTRICTS, HARVEST, TAP, TAXES, TECHNOLOGIES, TECH_LINES, WORKER, levelIndexed,
  type HarvestSpec,
} from './data/definitions';
import type { CurrencyId, GameState, TechLineId } from './state';
import { isTechComplete } from './research';
import { resolve } from './modifiers';

/** How many ranks of a line the kingdom has researched. */
export const lineRank = (state: GameState, line: TechLineId): number => {
  let n = 0;
  for (const id of TECH_LINES[line]) {
    if (!isTechComplete(state, id)) break; // ranks complete in order
    n += 1;
  }
  return n;
};

/** The highest rank a line goes to. */
export const lineMaxRank = (line: TechLineId): number => TECH_LINES[line].length;

// -------------------------------------------------- effective values

/**
 * What a line is currently worth: completed ranks x the per-rank effect.
 *
 * The per-rank value is read off the FIRST rank because every rank of a line
 * carries the same number — one column in the workbook, not a ladder of them.
 */
export const effect = (state: GameState, line: TechLineId): number =>
  lineRank(state, line) * TECHNOLOGIES[TECH_LINES[line][0]].effectPerRank;

/**
 * What the city gathers of one resource per second, from its own numbers.
 *
 * A worker's loop is walk out, strike, walk back. Cell distances vary, so this
 * takes the influence radius as the distance: a NOMINAL rate, not a measured
 * one. That is the point — it needs no map and no clock.
 *
 * **The tap does NOT read this**, and that is the whole story of the
 * 2026-09-03 rebalance: pricing a tap against city-wide production made one
 * tap on one tree pay 413 Wood in a maxed city. A tap is priced against the
 * GROUND and the THUMB, never against the payroll — the ground's rate is its
 * chunk over its rhythm, with no travel in it, because travel is a property of
 * where you put the shed rather than of the cell. The remaining caller here is
 * order sizing, which is addressed to the CITY and so should read the city's
 * real throughput, travel and all.
 */
export function cityGatherPerSecond(state: GameState, currencyId: CurrencyId): number {
  let total = 0;
  for (const d of state.city.districts) {
    if (d.state !== 'Built' || d.assignedWorkers === 0) continue;
    const def = DISTRICTS[d.definitionId];
    const source = def.harvestSources.find((s) => HARVEST[s].currencyId === currencyId);
    if (source === undefined) continue;
    const spec = HARVEST[source];
    const radius = def.influenceRadiusPerLevel.length === 0
      ? 0 : levelIndexed(def.influenceRadiusPerLevel, d.level);
    const cycleSeconds = (2 * radius) / effectiveWorkerSpeed(state) + spec.secondsPerStrike;
    if (cycleSeconds <= 0) continue;
    // A building that goes after more than one thing splits its crew between
    // them. For every district with a single source it divides by one, so no
    // existing number moves.
    const crew = d.assignedWorkers / def.harvestSources.length;
    total += (crew * effectiveWorkerStrike(state, spec)) / cycleSeconds;
  }
  return total;
}

/** CELL-scoped ABUNDANCE lines (each +1 unit a strike a rank). They lift the
 *  tap and the worker ALIKE, because both draw from the same depot — which is
 *  the change that unifies the two feelings: nobody creates matter, everyone
 *  pulls from the same place at a different speed.
 *
 *  Keyed on the cell, not the currency: game and crop plots both pay Food, but
 *  Butchery is about butchering and Irrigation is about fields. Crops carry two
 *  and they simply stack. Table at the call site rather than a general scoping
 *  mechanism, because that is what the handful of scoped lines needs. */
const ABUNDANCE_LINES: Partial<Record<HarvestSpec['id'], readonly TechLineId[]>> = {
  Forest: ['Sawpits'],
  Crops: ['Irrigation', 'Scythes'],
  Meat: ['Butchery'],
  Stone: ['Stonecutting'],
  Fish: ['BigNets'],
  MountainIron: ['IronPicks'],
};

/** Units one extraction takes out of this kind of cell — the chunk, after the
 *  ground's own abundance lines. Shared by the thumb and the crew. */
export function effectiveUnitsPerStrike(state: GameState, spec: HarvestSpec): number {
  let units = spec.unitsPerStrike;
  for (const line of ABUNDANCE_LINES[spec.id] ?? []) units += effect(state, line);
  return Math.max(0, units);
}

/**
 * Seconds of work one player tap is worth.
 *
 * > **One tap is `tap.workSeconds` of work on the thing you tapped.**
 *
 * `TapPower` buys this DURATION, +20% a rank, so it is a relative ladder that
 * never goes stale (README working rule 2) and, priced in Gold and time, the
 * permanent sink the economy loses when the tech tree runs out.
 *
 * It is also the number behind what a rewarded ad is worth: the thumb is worth
 * `tapWorkSeconds / collectCooldown` workers, and **that has to stay ahead of
 * the crew** or the hand stops beating the machine (`04-harvest.md` §4.3).
 */
export const tapWorkSeconds = (state: GameState): number =>
  Math.max(0, resolve(state, 'tapYield', TAP.workSeconds * (1 + effect(state, 'TapPower'))));

/** Units a tap owes on this kind of cell — a FRACTION on most ground, which is
 *  why `tapCarry` exists. `carry` is the remainder the last tap could not pay.
 *  The caller floors it, floors it at one unit, and caps it at what the cell
 *  actually holds. */
export const tapDraw = (state: GameState, spec: HarvestSpec, carry: number): number =>
  (spec.secondsPerStrike <= 0 ? 0
    : (tapWorkSeconds(state) * effectiveUnitsPerStrike(state, spec)) / spec.secondsPerStrike)
  + carry;

/** Units one worker strike deposits: the ground's abundance plus the global
 *  WorkerLoad, which is the one payroll-only dial and therefore the pressure
 *  generator — more units a strike empties a cell faster. */
export function effectiveWorkerStrike(state: GameState, spec: HarvestSpec): number {
  const base = effectiveUnitsPerStrike(state, spec) + effect(state, 'WorkerLoad');
  return Math.max(0, Math.round(resolve(state, 'workerYield', base, spec.currencyId)));
}

/** Milliseconds between one worker's strikes on this kind of cell. A property
 *  of the CELL, not of the worker: a farm plot is fast and thirsty where an
 *  iron mountain is a heavy swing. No modifier scales it yet — a worker-speed
 *  stat would be a new `ModifierStat`, which is code, and nothing has asked.
 *  (`workerSpeed` below is how fast they WALK, which is a different thing.) */
export const workerStrikeMs = (state: GameState, spec: HarvestSpec): number => {
  void state;
  return Math.max(100, Math.round(spec.secondsPerStrike * 1000));
};

/** Cooldown between AUTO-taps — the repeats a held pointer generates, ms
 *  (QuickHands buys it down; floor 0.1s).
 *
 *  Deliberately asymmetric, and this is the whole design: a *manual* tap is
 *  never gated, so tapping fast stays a skill the player is rewarded for,
 *  while holding trades that speed for not having to work. Nothing here is
 *  ever consulted on a deliberate tap — see `collectTap`.
 *
 *  It follows that QuickHands only ever speeds HOLDING up. That makes it a
 *  convenience line rather than a raw-throughput one, which is the right
 *  shape: it narrows the gap toward manual tapping without closing it (0.5s
 *  down to 0.25s at rank 5, still slower than a determined tapper).
 *
 *  It is also half of what the thumb is worth: `tapWorkSeconds` over this is
 *  how many workers a held finger is equal to, and that number has to stay
 *  ahead of the crew (`04-harvest.md` §4.3). */
export const effectiveAutoTapCooldownMs = (state: GameState): number =>
  Math.max(100, resolve(
    state, 'autoTapCooldown', (TAP.collectCooldownSeconds - effect(state, 'QuickHands')) * 1000,
  ));

/** Tiles per second a worker walks (Cartage: +5%/rank). Read by the worker
 *  FSM when a leg STARTS, so a rank landing mid-walk shortens the next leg
 *  rather than teleporting the one in progress — which is also what keeps a
 *  one-call replay and stepped ticking on the same StateUntil. */
export const effectiveWorkerSpeed = (state: GameState): number =>
  Math.max(0.1, resolve(state, 'workerSpeed',
    WORKER.moveSpeedTilesPerSecond
      * (isTechComplete(state, 'Roadworks') ? 1.25 : 1) // paved ways: a quarter faster
      * (1 + effect(state, 'Cartage'))));

/** Multiplier on build and upgrade time (Carpentry: −5%/rank), floor 0.25. */
export const effectiveBuildTimeMultiplier = (state: GameState): number =>
  Math.max(0.25, resolve(state, 'buildTime', 1 - effect(state, 'Carpentry')));

/** Multiplier on research time (Scriveners: −5%/rank), floor 0.25. Applied
 *  ONCE, when a research starts, and persisted on it — see research.ts. */
export const effectiveResearchTimeMultiplier = (state: GameState): number =>
  Math.max(0.25, resolve(state, 'researchTime', 1 - effect(state, 'Scriveners')));

/** Multiplier on Market sale prices (MarketStall: +5%/rank). */
export const effectiveSalePriceMultiplier = (state: GameState): number =>
  Math.max(0, resolve(state, 'salePrice', 1 + effect(state, 'MarketStall')));

/** Tax gold per housed villager per minute (TradeRoutes: +10%/rank). */
export const effectiveTaxRate = (state: GameState): number =>
  Math.max(0, resolve(
    state, 'taxRate', TAXES.goldPerPopulationPerMinute * (1 + effect(state, 'TradeRoutes')),
  ));
