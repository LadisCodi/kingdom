// Minor ranks: what used to be instant, gold-only, LEVELLED upgrades.
//
// Every node in the tree is a technology now (Docs/features/tech-tree.md §1
// rule 2), so a level became a rank: `Sawpits I -> II -> III`, each requiring
// the one before, each costing Gold AND time like anything else in the tree.
// `effect()` is the whole difference — it counts completed ranks where it used
// to read a stored level.
//
// The effective-value helpers below are the ONE place effects are applied, and
// each is now a three-stage pipeline: base -> upgrade levels -> the modifier
// stack (artifact passives, hero traits, seasons; see sim/modifiers.ts). An
// empty stack is the bit-exact identity, so nothing changes until something
// grants a modifier.
//
// Integer stats (tapYield, workerYield) round ONCE, here at the boundary,
// because they feed addToWallet directly and a fractional wallet would leak
// into quest counters, the Market and every displayed number. Math.round
// rather than floor: flooring makes a small multiplier useless at base-1
// yields.

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
 * A worker's loop is walk out, work, walk back. Cell distances vary, so this
 * takes the influence radius as the distance: a NOMINAL rate, not a measured
 * one. That is the point — it needs no map and no clock, so a tap can read it.
 *
 * It lives here rather than beside `cityGoldPerMinute` in population.ts
 * because population imports THIS module; putting it there and reading it from
 * `effectiveTapYield` would be a cycle. The radius lookup is inlined for the
 * same reason (workers.ts imports upgrades.ts).
 */
export function cityGatherPerSecond(state: GameState, currencyId: CurrencyId): number {
  let total = 0;
  for (const d of state.city.districts) {
    if (d.state !== 'Built' || d.assignedWorkers === 0) continue;
    const def = DISTRICTS[d.definitionId];
    const source = def.harvestSource;
    if (source === null || HARVEST[source].currencyId !== currencyId) continue;
    const radius = def.influenceRadiusPerLevel.length === 0
      ? 0 : levelIndexed(def.influenceRadiusPerLevel, d.level);
    const cycleSeconds = (2 * radius) / WORKER.moveSpeedTilesPerSecond + WORKER.workSeconds;
    if (cycleSeconds <= 0) continue;
    total += (d.assignedWorkers * effectiveWorkerYield(state, HARVEST[source])) / cycleSeconds;
  }
  return total;
}

/**
 * Units a player collect tap yields.
 *
 * A TAP HANDS YOU `tap.boostSeconds` OF WHAT YOU TAPPED IS PRODUCING. That is
 * the rule the house tap has always followed — it pulls `boostSeconds × share`
 * of city income forward, and `share × cityRate` IS that house's own rate — so
 * resource cells now say the same thing, and one sentence covers every tap in
 * the game: tapping hurries production along, and Mana is what it costs.
 *
 * It matters because the alternative goes stale. A flat yield is worth three
 * minutes of production against one Sawmill and two against six, so the whole
 * reason to spend Mana — and to watch an ad for more of it — evaporates as the
 * city grows. Priced against production, a full pool is worth the same
 * `cap × boostSeconds` of progress at every stage.
 *
 * The authored yield is a FLOOR, not a fallback: it is what tapping is worth
 * before a single worker exists, which is most of the first session.
 */
/** CELL-specific COLLECT-tap lines (each +1/rank), the mirror of
 *  WORKER_YIELD_LINES below. Both sit at the call site as small tables
 *  rather than as a general scoping mechanism, because that is what the
 *  handful of scoped lines in the game actually needs. */
const TAP_YIELD_LINES: Partial<Record<HarvestSpec['id'], TechLineId>> = {
  Meat: 'Butchery',
  Crops: 'Scythes',
};

export const effectiveTapYield = (state: GameState, spec: HarvestSpec): number => {
  const specific = TAP_YIELD_LINES[spec.id];
  // The floor rises with the upgrades; the production pull does not, because
  // it is already whatever the city makes.
  const floor = spec.yieldPerTap + effect(state, 'TapPower')
    + (specific ? effect(state, specific) : 0);
  return Math.max(0, Math.round(resolve(
    state,
    'tapYield',
    Math.max(floor, cityGatherPerSecond(state, spec.currencyId) * TAP.boostSeconds),
    spec.currencyId,
  )));
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
 *  convenience upgrade rather than a raw-throughput one, which is the right
 *  shape: it narrows the gap toward manual tapping without closing it (0.5s
 *  down to 0.25s at level 5, still slower than a determined tapper). */
export const effectiveAutoTapCooldownMs = (state: GameState): number =>
  Math.max(100, resolve(
    state, 'autoTapCooldown', (TAP.collectCooldownSeconds - effect(state, 'QuickHands')) * 1000,
  ));

/** CELL-specific worker-delivery lines (each +1/rank). Keyed on the
 *  cell, not the currency: game and crop plots both pay Food, but Butchery
 *  is about butchering and Irrigation is about fields. */
const WORKER_YIELD_LINES: Partial<Record<HarvestSpec['id'], TechLineId>> = {
  Forest: 'Sawpits',
  Crops: 'Irrigation',
  Stone: 'Stonecutting',
  Fish: 'BigNets',
  Iron: 'IronPicks',
};

/** Units a worker delivery deposits (global WorkerLoad + the resource's own
 *  upgrade: Stonecutting/BigNets/IronPicks). */
export function effectiveWorkerYield(state: GameState, spec: HarvestSpec): number {
  const specific = WORKER_YIELD_LINES[spec.id];
  const base = spec.yieldPerWorker + effect(state, 'WorkerLoad') +
    (specific ? effect(state, specific) : 0);
  return Math.max(0, Math.round(resolve(state, 'workerYield', base, spec.currencyId)));
}

/** Multiplier on Market sale prices (MarketStall: +5%/level). */
export const effectiveSalePriceMultiplier = (state: GameState): number =>
  Math.max(0, resolve(state, 'salePrice', 1 + effect(state, 'MarketStall')));

/** Tax gold per housed villager per minute (TradeRoutes: +10%/level). */
export const effectiveTaxRate = (state: GameState): number =>
  Math.max(0, resolve(
    state, 'taxRate', TAXES.goldPerPopulationPerMinute * (1 + effect(state, 'TradeRoutes')),
  ));
