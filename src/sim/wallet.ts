// Wallet math with currency equivalence ("counts as"): some currencies are
// stored separately but carry value in a base currency — a Berry is 1 Food,
// a Meat is 3. Costs are authored in base currencies only; affordability
// checks the EFFECTIVE amount, and paying drains the base currency first,
// then equivalents cheapest-first, crediting overshoot back as base currency
// (breaking a 3-Food Meat on a 2-Food cost returns 1 Food in change).

import { CURRENCIES } from './data/definitions';
import { addToWallet, getWallet, type CurrencyId, type Wallet } from './state';

/** The currencies that count as `base`, cheapest per unit first. */
export const equivalentsOf = (base: CurrencyId): Array<{ id: CurrencyId; value: number }> =>
  (Object.keys(CURRENCIES) as CurrencyId[])
    .filter((id) => CURRENCIES[id].countsAs?.currency === base)
    .map((id) => ({ id, value: CURRENCIES[id].countsAs!.value }))
    .sort((a, b) => a.value - b.value);

/** Base amount plus everything that counts as it. */
export function effectiveAmount(wallet: Wallet, c: CurrencyId): number {
  let total = getWallet(wallet, c);
  for (const m of equivalentsOf(c)) total += getWallet(wallet, m.id) * m.value;
  return total;
}

export const canAfford = (wallet: Wallet, cost: Wallet): boolean =>
  Object.entries(cost).every(([c, amount]) => effectiveAmount(wallet, c as CurrencyId) >= amount);

/** Deterministic payment: base first, then equivalents ascending by unit
 *  value, with change. Callers must have checked canAfford first. */
export function pay(wallet: Wallet, cost: Wallet): void {
  for (const [c0, amount] of Object.entries(cost)) {
    const c = c0 as CurrencyId;
    const fromBase = Math.min(getWallet(wallet, c), amount);
    if (fromBase > 0) addToWallet(wallet, c, -fromBase);
    let remaining = amount - fromBase;
    for (const m of equivalentsOf(c)) {
      if (remaining <= 0) break;
      const units = Math.min(getWallet(wallet, m.id), Math.ceil(remaining / m.value));
      if (units <= 0) continue;
      addToWallet(wallet, m.id, -units);
      const paid = units * m.value;
      if (paid > remaining) addToWallet(wallet, c, paid - remaining); // change
      remaining -= paid;
    }
  }
}

/** Refunds are paid out in the base currency (payment composition is not
 *  remembered — a cancelled build gives plain Food back). */
export const refund = (wallet: Wallet, cost: Wallet): void => {
  for (const [c, amount] of Object.entries(cost)) addToWallet(wallet, c as CurrencyId, amount);
};
