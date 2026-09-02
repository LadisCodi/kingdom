// Wallet math. A cost is a map of currency → amount; you can afford it when
// you hold at least that much of each, and paying subtracts it.
//
// This used to carry a currency-equivalence engine ("counts as"): Berries,
// Meat and Fish were stored as their own wallet rows that paid Food costs at
// 1, 3 and 1, so affordability had to sum equivalents and `pay` had to drain
// them cheapest-first and credit change. That whole mechanism existed to say
// "a berry is a unit of food" — which the harvest table now says directly, by
// paying Food at the cell's own rate (see HARVEST in data/definitions.ts).

import { addToWallet, getWallet, type CurrencyId, type Wallet } from './state';

export const canAfford = (wallet: Wallet, cost: Wallet): boolean =>
  Object.entries(cost).every(([c, amount]) => getWallet(wallet, c as CurrencyId) >= amount);

/** Callers must have checked canAfford first. */
export function pay(wallet: Wallet, cost: Wallet): void {
  for (const [c, amount] of Object.entries(cost)) addToWallet(wallet, c as CurrencyId, -amount);
}

export const refund = (wallet: Wallet, cost: Wallet): void => {
  for (const [c, amount] of Object.entries(cost)) addToWallet(wallet, c as CurrencyId, amount);
};
