// The Market: queue resources for sale and they drip-sell for Gold, one unit
// per interval, including offline (within the 8h cap). Queued units are
// escrowed out of the city wallet; unsold units can be withdrawn. Upgrade
// hooks for later: sell interval (speed), gold values (price), capacity.

import { CURRENCIES, MARKET } from './data/definitions';
import { addToWallet, getWallet, type CurrencyId, type GameState, type Wallet } from './state';

/** Sellable currencies in sell order (= Currencies sheet order). */
export const SELLABLE: CurrencyId[] = (Object.keys(CURRENCIES) as CurrencyId[])
  .filter((c) => CURRENCIES[c].goldValue !== null);

export const queuedUnits = (state: GameState): number =>
  Object.values(state.market.queue).reduce((sum, n) => sum + n, 0);

/** Gold the current queue will pay in total. */
export const queuedGoldValue = (state: GameState): number =>
  SELLABLE.reduce(
    (sum, c) => sum + getWallet(state.market.queue, c) * CURRENCIES[c].goldValue!, 0);

export type AddToSaleResult = 'Added' | 'NotSellable' | 'NotEnoughResources' | 'MarketFull';

/** Move units wallet → sell queue. Anchors the sale clock when the queue
 *  starts from empty (no banked time from idle-empty periods). */
export function addToSale(
  state: GameState,
  currency: CurrencyId,
  amount: number,
  now: number,
): AddToSaleResult {
  if (CURRENCIES[currency].goldValue === null) return 'NotSellable';
  const n = Math.min(amount, getWallet(state.city.wallet, currency));
  if (n <= 0) return 'NotEnoughResources';
  const space = MARKET.capacity - queuedUnits(state);
  if (space <= 0) return 'MarketFull';
  const moved = Math.min(n, space);
  if (queuedUnits(state) === 0) state.market.lastSaleAt = now;
  addToWallet(state.city.wallet, currency, -moved);
  addToWallet(state.market.queue, currency, moved);
  return 'Added';
}

export type RemoveFromSaleResult = 'Removed' | 'NothingQueued';

/** Return unsold units from the queue to the wallet. */
export function removeFromSale(
  state: GameState,
  currency: CurrencyId,
  amount: number,
): RemoveFromSaleResult {
  const n = Math.min(amount, getWallet(state.market.queue, currency));
  if (n <= 0) return 'NothingQueued';
  addToWallet(state.market.queue, currency, -n);
  addToWallet(state.city.wallet, currency, n);
  return 'Removed';
}

/** Drip-sell up to `toTime`: one unit per interval, in SELLABLE order.
 *  The anchor advances only by time paid out (whole units only), so partial
 *  intervals carry over. Returns the Gold earned. */
export function advanceMarket(state: GameState, toTime: number): number {
  const intervalMs = MARKET.sellIntervalSeconds * 1000;
  let earned = 0;
  for (;;) {
    if (queuedUnits(state) === 0) return earned; // idle queue banks no time
    if (toTime - state.market.lastSaleAt < intervalMs) return earned;
    const currency = SELLABLE.find((c) => getWallet(state.market.queue, c) > 0)!;
    addToWallet(state.market.queue, currency, -1);
    const gold = CURRENCIES[currency].goldValue!;
    addToWallet(state.city.wallet, 'Gold', gold);
    earned += gold;
    state.market.lastSaleAt += intervalMs;
  }
}

/** Snapshot for the Market menu. */
export const marketQueue = (state: GameState): Wallet => state.market.queue;
