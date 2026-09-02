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
  DISTRICTS, HARVEST, TAP, TAXES, UPGRADES, WORKER, levelIndexed,
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
/** CELL-specific COLLECT-tap upgrades (each +1/level), the mirror of
 *  WORKER_YIELD_UPGRADES below. Both sit at the call site as small tables
 *  rather than as a general scoping mechanism, because that is what the
 *  handful of scoped upgrades in the game actually needs. */
const TAP_YIELD_UPGRADES: Partial<Record<HarvestSpec['id'], UpgradeId>> = {
  Meat: 'Butchery',
  Crops: 'Scythes',
};

export const effectiveTapYield = (state: GameState, spec: HarvestSpec): number => {
  const specific = TAP_YIELD_UPGRADES[spec.id];
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

/** CELL-specific worker-delivery upgrades (each +1/level). Keyed on the
 *  cell, not the currency: game and crop plots both pay Food, but Butchery
 *  is about butchering and Irrigation is about fields. */
const WORKER_YIELD_UPGRADES: Partial<Record<HarvestSpec['id'], UpgradeId>> = {
  Forest: 'Sawpits',
  Crops: 'Irrigation',
  Stone: 'Stonecutting',
  Fish: 'BigNets',
  Iron: 'IronPicks',
};

/** Units a worker delivery deposits (global WorkerLoad + the resource's own
 *  upgrade: Stonecutting/BigNets/IronPicks). */
export function effectiveWorkerYield(state: GameState, spec: HarvestSpec): number {
  const specific = WORKER_YIELD_UPGRADES[spec.id];
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
