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

import { TAP, TAXES, UPGRADES, type HarvestSpec } from './data/definitions';
import type { GameState, UpgradeId } from './state';
import { isTechComplete } from './research';
import { resolve } from './modifiers';
import { canAfford, pay } from './wallet';

export const upgradeLevel = (state: GameState, id: UpgradeId): number =>
  state.upgrades[id] ?? 0;

/** Gold for the NEXT level (level is 0-based: first purchase costs costBase). */
export const upgradeCost = (id: UpgradeId, level: number): number =>
  Math.round(UPGRADES[id].costBase * UPGRADES[id].costGrowth ** level);

export type BuyUpgradeResult = 'Purchased' | 'AtMax' | 'TechRequired' | 'NotEnoughResources';

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

const effect = (state: GameState, id: UpgradeId): number =>
  upgradeLevel(state, id) * UPGRADES[id].effectPerLevel;

/** Units a player collect tap yields (TapPower, plus tapYield modifiers). */
export const effectiveTapYield = (state: GameState, spec: HarvestSpec): number =>
  Math.max(0, Math.round(resolve(
    state, 'tapYield', spec.yieldPerTap + effect(state, 'TapPower'), spec.currencyId,
  )));

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

/** Resource-specific worker-delivery upgrades (each +1/level). */
const WORKER_YIELD_UPGRADES: Partial<Record<HarvestSpec['currencyId'], UpgradeId>> = {
  Stone: 'Stonecutting',
  Fish: 'BigNets',
  Iron: 'IronPicks',
};

/** Units a worker delivery deposits (global WorkerLoad + the resource's own
 *  upgrade: Stonecutting/BigNets/IronPicks). */
export function effectiveWorkerYield(state: GameState, spec: HarvestSpec): number {
  const specific = WORKER_YIELD_UPGRADES[spec.currencyId];
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
