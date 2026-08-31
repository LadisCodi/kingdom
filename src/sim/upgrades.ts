// Upgrades: instant, gold-only, leveled boosts to existing mechanics.
// Effects reach the sim through the effective-value helpers below — consumers
// read these instead of raw balance values, so each upgrade level is applied
// in exactly one place.

import { MARKET, TAP, UPGRADES, type HarvestSpec } from './data/definitions';
import type { GameState, UpgradeId } from './state';
import { isTechComplete } from './research';
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

/** Units a player collect tap yields (TapPower). */
export const effectiveTapYield = (state: GameState, spec: HarvestSpec): number =>
  spec.yieldPerTap + effect(state, 'TapPower');

/** Cooldown between player collects, ms (QuickHands; floor 0.1s). */
export const effectiveCollectCooldownMs = (state: GameState): number =>
  Math.max(100, (TAP.collectCooldownSeconds - effect(state, 'QuickHands')) * 1000);

/** Units a worker delivery deposits (WorkerLoad). */
export const effectiveWorkerYield = (state: GameState, spec: HarvestSpec): number =>
  spec.yieldPerWorker + effect(state, 'WorkerLoad');

/** Market queue capacity (MarketStall). */
export const effectiveMarketCapacity = (state: GameState): number =>
  MARKET.capacity + effect(state, 'MarketStall');

/** Time between Market sales, ms (TradeRoutes; floor 0.5s). */
export const effectiveSellIntervalMs = (state: GameState): number =>
  Math.max(500, (MARKET.sellIntervalSeconds - effect(state, 'TradeRoutes')) * 1000);
