// The Market: a late-game DISTRICT (behind the Commerce tech) that trades
// surplus goods for Gold, instantly — an optional extra income on top of the
// passive housing taxes. Tap the built Market to open its trade screen.

import { CURRENCIES } from './data/definitions';
import { recordResourceDiscovery } from './discovery';
import { recordQuestEvent } from './quests';
import { effectiveSalePriceMultiplier } from './upgrades';
import { addToWallet, getWallet, type CurrencyId, type GameState } from './state';

/** Sellable currencies in menu order (= Currencies sheet order). */
export const SELLABLE: CurrencyId[] = (Object.keys(CURRENCIES) as CurrencyId[])
  .filter((c) => CURRENCIES[c].goldValue !== null);

export const hasMarket = (state: GameState): boolean =>
  state.city.districts.some((d) => d.definitionId === 'Market' && d.state === 'Built');

/** Gold paid for selling `amount` units right now (MarketStall boosts it). */
export const salePayout = (state: GameState, currency: CurrencyId, amount: number): number =>
  Math.floor(amount * (CURRENCIES[currency].goldValue ?? 0) *
    effectiveSalePriceMultiplier(state));

export type SellResult = 'Sold' | 'NoMarket' | 'NotSellable' | 'NothingToSell';

/** Instant sale: up to `amount` units (clamped to what's on hand) for Gold. */
export function sellGoods(
  state: GameState,
  currency: CurrencyId,
  amount: number,
): { result: SellResult; units: number; gold: number } {
  if (!hasMarket(state)) return { result: 'NoMarket', units: 0, gold: 0 };
  if (CURRENCIES[currency].goldValue === null) {
    return { result: 'NotSellable', units: 0, gold: 0 };
  }
  const units = Math.min(amount, getWallet(state.city.wallet, currency));
  if (units <= 0) return { result: 'NothingToSell', units: 0, gold: 0 };
  const gold = salePayout(state, currency, units);
  addToWallet(state.city.wallet, currency, -units);
  addToWallet(state.city.wallet, 'Gold', gold);
  recordResourceDiscovery(state, 'Gold');
  recordQuestEvent(state, { kind: 'sell', units });
  recordQuestEvent(state, { kind: 'collect', currency: 'Gold', amount: gold });
  return { result: 'Sold', units, gold };
}
