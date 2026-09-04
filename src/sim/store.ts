// The simulated store (Docs/features/14-monetization.md §3).
//
// NOTHING HERE EVER TAKES MONEY. What it takes is a player's MONTHLY BUDGET,
// declared once when they pick a payer profile — and that budget is the whole
// instrument. A free tap on "buy" measures nothing: with no cost, everyone
// takes everything. A tap that spends a scarce allowance measures a
// preference, because buying one thing means not buying another.
//
// Three rules, all of them here so the UI cannot get them wrong:
//
//   1. A profile is chosen ONCE per save. The only way to another profile is
//      a fresh game, so a playtester cannot drift from Minnow to Whale the
//      afternoon they run short.
//   2. The budget is per CALENDAR MONTH (UTC) and never rolls over. The month
//      is derived from the timestamp the sim is given, never from a counter,
//      so a reload or a long absence cannot be used to bank one.
//   3. Refusals are recorded like purchases: a tap the budget could not cover
//      is unmet demand at that price, and the read-out wants it.
//
// F2P is a profile with a budget of zero rather than a "no store" flag: it
// walks the same code, sees the same prices and is refused the same way.

import { PAYER, STORE } from './data/definitions';
import type { GameState, PayerProfile, PayerState, StoreSkuId } from './state';
import { addToWallet } from './state';

export const PAYER_PROFILES: readonly PayerProfile[] = [
  'F2P', 'Minnow', 'Dolphin', 'Whale', 'SuperWhale',
];

/** What the player sees a profile called. `SuperWhale` is one word in code
 *  because it is an id; on a sheet it is two. */
export const PROFILE_LABEL: Record<PayerProfile, string> = {
  F2P: 'F2P', Minnow: 'Minnow', Dolphin: 'Dolphin', Whale: 'Whale', SuperWhale: 'Super Whale',
};

/** The profile's allowance, in cents, as the workbook authors it in dollars. */
export function monthlyBudgetCents(profile: PayerProfile): number {
  const usd = {
    F2P: PAYER.f2pMonthlyUsd,
    Minnow: PAYER.minnowMonthlyUsd,
    Dolphin: PAYER.dolphinMonthlyUsd,
    Whale: PAYER.whaleMonthlyUsd,
    SuperWhale: PAYER.superWhaleMonthlyUsd,
  }[profile];
  return Math.round(usd * 100);
}

/** Months since the epoch, UTC: January 1970 is 0. One number, so two dates in
 *  the same month compare equal and nothing else does. */
export const monthIndex = (t: number): number => {
  const d = new Date(t);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
};

/** Epoch ms of the first of next month, 00:00 UTC — when the budget refills. */
export const monthResetsAt = (t: number): number => {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
};

export const priceCents = (sku: StoreSkuId): number => Math.round(STORE[sku].priceUsd * 100);

/** Bring the running spend onto the current month. Idempotent; called by every
 *  command that writes the budget, so a stale month never leaks. */
function rollMonth(payer: PayerState, now: number): void {
  const month = monthIndex(now);
  if (month !== payer.monthIndex) {
    payer.monthIndex = month;
    payer.spentCentsThisMonth = 0;
  }
}

export type ChooseProfileResult = 'Chosen' | 'AlreadyChosen';

export function choosePayerProfile(
  state: GameState,
  profile: PayerProfile,
  now: number,
): ChooseProfileResult {
  if (state.player.payer !== null) return 'AlreadyChosen';
  state.player.payer = {
    profile,
    chosenAt: now,
    monthIndex: monthIndex(now),
    spentCentsThisMonth: 0,
    purchases: [],
    refusals: 0,
  };
  return 'Chosen';
}

/** What is left to spend this month, in cents. Null until a profile exists.
 *  Pure: a later month reads as a full budget without mutating anything. */
export function budgetRemainingCents(state: GameState, now: number): number | null {
  const payer = state.player.payer;
  if (payer === null) return null;
  const spent = monthIndex(now) === payer.monthIndex ? payer.spentCentsThisMonth : 0;
  return Math.max(0, monthlyBudgetCents(payer.profile) - spent);
}

export const canAffordSku = (state: GameState, sku: StoreSkuId, now: number): boolean => {
  const left = budgetRemainingCents(state, now);
  return left !== null && left >= priceCents(sku);
};

export type BuySkuResult = 'Purchased' | 'NoProfile' | 'NoBudget';

/**
 * The purchase. The price leaves the monthly budget and the Gems land in the
 * player's wallet — for real, so the economy stays coherent and the retention
 * data stays usable. A refusal is logged too, because a tap the budget could
 * not cover is exactly the data point the store exists to collect.
 */
export function buySku(state: GameState, sku: StoreSkuId, now: number): BuySkuResult {
  const payer = state.player.payer;
  if (payer === null) return 'NoProfile';
  rollMonth(payer, now);
  const cents = priceCents(sku);
  if (monthlyBudgetCents(payer.profile) - payer.spentCentsThisMonth < cents) {
    payer.refusals += 1;
    return 'NoBudget';
  }
  payer.spentCentsThisMonth += cents;
  payer.purchases.push({ sku, priceCents: cents, at: now });
  addToWallet(state.player.wallet, 'Gems', STORE[sku].gems);
  return 'Purchased';
}

/** `$4.99`, always two decimals, for every place a price is shown. Whole
 *  thousands stay readable: `$2,000.00`. */
export const formatUsd = (cents: number): string =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
