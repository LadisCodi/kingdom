// Upgrades: instant, gold-only, leveled boosts to existing mechanics.
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
  DISTRICTS, HARVEST, TAP, TAXES, UPGRADES,
  type HarvestSpec,
} from './data/definitions';
import type { CurrencyId, GameState, UpgradeId } from './state';
import { isTechComplete } from './research';
import { resolve } from './modifiers';
import { canAfford, pay } from './wallet';

export const upgradeLevel = (state: GameState, id: UpgradeId): number =>
  state.upgrades[id] ?? 0;

/** Gold for the NEXT level (level is 0-based: first purchase costs costBase). */
export const upgradeCost = (id: UpgradeId, level: number): number =>
  Math.round(UPGRADES[id].costBase * UPGRADES[id].costGrowth ** level);

export type BuyUpgradeResult = 'Purchased' | 'AtMax' | 'TechRequired' | 'NotEnoughResources';

/** Could the player buy this upgrade this second? Mirrors every gate
 *  `buyUpgrade` checks, so the node dot and the button never disagree. */
export function canBuyUpgrade(state: GameState, id: UpgradeId): boolean {
  const def = UPGRADES[id];
  const level = upgradeLevel(state, id);
  if (level >= def.maxLevel) return false;
  if (def.requiredTech !== null && !isTechComplete(state, def.requiredTech)) return false;
  return canAfford(state.city.wallet, { Gold: upgradeCost(id, level) });
}

/** Anything on the upgrade side worth a trip to the Research screen. */
export const anyUpgradeActionable = (state: GameState): boolean =>
  (Object.keys(UPGRADES) as UpgradeId[]).some((id) => canBuyUpgrade(state, id));

export function buyUpgrade(state: GameState, id: UpgradeId): BuyUpgradeResult {
  const def = UPGRADES[id];
  const level = upgradeLevel(state, id);
  if (level >= def.maxLevel) return 'AtMax';
  if (def.requiredTech !== null && !isTechComplete(state, def.requiredTech)) return 'TechRequired';
  const cost = { Gold: upgradeCost(id, level) };
  if (!canAfford(state.city.wallet, cost)) return 'NotEnoughResources';
  pay(state.city.wallet, cost);
  state.upgrades[id] = level + 1;
  return 'Purchased';
}

// -------------------------------------------------- effective values

export const effect = (state: GameState, id: UpgradeId): number =>
  upgradeLevel(state, id) * UPGRADES[id].effectPerLevel;

/**
 * What the city gathers of one resource per second, from its own numbers.
 *
 * A worker's rate is now exactly its chunk over its rhythm — there is no
 * travel term to estimate, because a worker strikes the cell in place and
 * credits the wallet on the strike (`04-harvest.md` §5). What is left nominal
 * is only which cells exist to be worked.
 *
 * **The tap does NOT read this**, and that is the whole story of the
 * 2026-09-03 rebalance: pricing a tap against city-wide production made one
 * tap on one tree pay 413 Wood in a maxed city. A tap is priced against the
 * GROUND and the THUMB, never against the payroll. The remaining caller is
 * order sizing, which is addressed to the city and so should read it.
 */
export function cityGatherPerSecond(state: GameState, currencyId: CurrencyId): number {
  let total = 0;
  for (const d of state.city.districts) {
    if (d.state !== 'Built' || d.assignedWorkers === 0) continue;
    const def = DISTRICTS[d.definitionId];
    const source = def.harvestSources.find((s) => HARVEST[s].currencyId === currencyId);
    if (source === undefined) continue;
    const spec = HARVEST[source];
    if (spec.secondsPerStrike <= 0) continue;
    // A building that goes after more than one thing splits its crew between
    // them. For every district with a single source it divides by one, so no
    // existing number moves.
    const crew = d.assignedWorkers / def.harvestSources.length;
    total += (crew * effectiveWorkerStrike(state, spec)) / spec.secondsPerStrike;
  }
  return total;
}

/** CELL-scoped ABUNDANCE upgrades (each +1 unit a strike). They lift the tap
 *  and the worker ALIKE, because both draw from the same depot — which is the
 *  change that unifies the two feelings: nobody creates matter, everyone pulls
 *  from the same place at a different speed.
 *
 *  Keyed on the cell, not the currency: game and crop plots both pay Food, but
 *  Butchery is about butchering and Irrigation is about fields. Crops carry two
 *  and they simply stack. Table at the call site rather than a general scoping
 *  mechanism, because that is what the handful of scoped upgrades needs. */
const ABUNDANCE_UPGRADES: Partial<Record<HarvestSpec['id'], readonly UpgradeId[]>> = {
  Forest: ['Sawpits'],
  Crops: ['Irrigation', 'Scythes'],
  Meat: ['Butchery'],
  Stone: ['Stonecutting'],
  Fish: ['BigNets'],
  MountainIron: ['IronPicks'],
};

/** Units one extraction takes out of this kind of cell — the chunk, after the
 *  ground's own abundance upgrades. Shared by the thumb and the crew. */
export function effectiveUnitsPerStrike(state: GameState, spec: HarvestSpec): number {
  let units = spec.unitsPerStrike;
  for (const id of ABUNDANCE_UPGRADES[spec.id] ?? []) units += effect(state, id);
  return Math.max(0, units);
}

/**
 * Seconds of work one player tap is worth.
 *
 * > **One tap is `tap.workSeconds` of work on the thing you tapped.**
 *
 * `TapPower` buys this DURATION, +20% a level over ten levels, so it is a
 * relative ladder that never goes stale (README working rule 2) and, priced in
 * Gold, the permanent sink the economy loses when the tech tree runs out.
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
 *  stat would be a new `ModifierStat`, which is code, and nothing has asked. */
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
 *  convenience upgrade rather than a raw-throughput one, which is the right
 *  shape: it narrows the gap toward manual tapping without closing it (0.5s
 *  down to 0.25s at level 5, still slower than a determined tapper).
 *
 *  It is also half of what the thumb is worth: `tapWorkSeconds` over this is
 *  how many workers a held finger is equal to, and that number has to stay
 *  ahead of the crew (`04-harvest.md` §4.3). */
export const effectiveAutoTapCooldownMs = (state: GameState): number =>
  Math.max(100, resolve(
    state, 'autoTapCooldown', (TAP.collectCooldownSeconds - effect(state, 'QuickHands')) * 1000,
  ));

/** Multiplier on Market sale prices (MarketStall: +5%/level). */
export const effectiveSalePriceMultiplier = (state: GameState): number =>
  Math.max(0, resolve(state, 'salePrice', 1 + effect(state, 'MarketStall')));

/** Tax gold per housed villager per minute (TradeRoutes: +10%/level). */
export const effectiveTaxRate = (state: GameState): number =>
  Math.max(0, resolve(
    state, 'taxRate', TAXES.goldPerPopulationPerMinute * (1 + effect(state, 'TradeRoutes')),
  ));
