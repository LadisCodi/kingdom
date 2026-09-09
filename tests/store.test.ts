// The simulated store (Docs/features/14-monetization.md §2–§3): a profile
// chosen once, a monthly budget that never rolls over, purchases that grant
// Gems for real, and refusals that are counted rather than swallowed.
import { describe, expect, it } from 'vitest';
import { PAYER, SAVE_VERSION, STORE, STORE_ORDER } from '../src/sim/data/definitions';
import { newGame } from '../src/sim/newGame';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet } from '../src/sim/state';
import {
  PAYER_PROFILES, budgetRemainingCents, buySku, canAffordSku, choosePayerProfile, formatUsd,
  monthIndex, monthResetsAt, monthlyBudgetCents, priceCents,
} from '../src/sim/store';
import { freshPresenter, map, T0 } from './helpers';

const DAY = 86_400_000;
// T0 is 2026-08-20; the first of the next month, 00:00 UTC.
const NEXT_MONTH = Date.parse('2026-09-01T00:00:00Z');

const blank = () => newGame(map, T0); // no profile yet

describe('the payer profile', () => {
  it('is null on a new game and chosen exactly once', () => {
    const state = blank();
    expect(state.player.payer).toBeNull();
    expect(choosePayerProfile(state, 'Minnow', T0)).toBe('Chosen');
    expect(state.player.payer?.profile).toBe('Minnow');
    // The only way to another profile is a fresh game.
    expect(choosePayerProfile(state, 'Whale', T0)).toBe('AlreadyChosen');
    expect(state.player.payer?.profile).toBe('Minnow');
  });

  it('reads its monthly budget off the workbook, in cents, and the ladder climbs', () => {
    expect(monthlyBudgetCents('F2P')).toBe(0);
    expect(monthlyBudgetCents('Minnow')).toBe(Math.round(PAYER.minnowMonthlyUsd * 100));
    expect(monthlyBudgetCents('Dolphin')).toBe(Math.round(PAYER.dolphinMonthlyUsd * 100));
    expect(monthlyBudgetCents('Whale')).toBe(Math.round(PAYER.whaleMonthlyUsd * 100));
    expect(monthlyBudgetCents('SuperWhale')).toBe(Math.round(PAYER.superWhaleMonthlyUsd * 100));
    for (let i = 1; i < PAYER_PROFILES.length; i++) {
      expect(monthlyBudgetCents(PAYER_PROFILES[i]))
        .toBeGreaterThan(monthlyBudgetCents(PAYER_PROFILES[i - 1]));
    }
  });

  it('has no budget to report until it exists', () => {
    expect(budgetRemainingCents(blank(), T0)).toBeNull();
    expect(buySku(blank(), 'GemsPouch', T0)).toBe('NoProfile');
  });

  it('prints dollars the way a store does', () => {
    expect(formatUsd(199)).toBe('$1.99');
    expect(formatUsd(5000)).toBe('$50.00');
    expect(formatUsd(200_000)).toBe('$2,000.00');
  });
});

describe('the monthly budget', () => {
  it('counts calendar months in UTC', () => {
    expect(monthIndex(NEXT_MONTH - 1)).toBe(monthIndex(T0));
    expect(monthIndex(NEXT_MONTH)).toBe(monthIndex(T0) + 1);
    expect(monthResetsAt(T0)).toBe(NEXT_MONTH);
    // December rolls into the next year's January.
    expect(monthResetsAt(Date.parse('2026-12-31T23:59:59Z'))).toBe(Date.parse('2027-01-01T00:00:00Z'));
  });

  it('spends a purchase against the budget and grants the Gems for real', () => {
    const state = blank();
    choosePayerProfile(state, 'Dolphin', T0);
    const gems = getWallet(state.player.wallet, 'Gems');
    const budget = monthlyBudgetCents('Dolphin');

    expect(buySku(state, 'GemsChest', T0)).toBe('Purchased');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(gems + STORE.GemsChest.gems);
    expect(budgetRemainingCents(state, T0)).toBe(budget - priceCents('GemsChest'));
    expect(state.player.payer?.purchases).toEqual([
      { sku: 'GemsChest', priceCents: priceCents('GemsChest'), at: T0 },
    ]);
  });

  it('adds cents exactly, so two prices never leave a rounding crumb', () => {
    const state = blank();
    choosePayerProfile(state, 'Whale', T0);
    buySku(state, 'GemsPouch', T0);
    buySku(state, 'GemsChest', T0);
    expect(state.player.payer?.spentCentsThisMonth).toBe(99 + 999);
    expect(budgetRemainingCents(state, T0)).toBe(monthlyBudgetCents('Whale') - 1098);
  });

  it('refuses what the budget cannot cover, grants nothing, and counts the refusal', () => {
    const state = blank();
    choosePayerProfile(state, 'Minnow', T0); // $10: a chest fits, a vault does not
    const gems = getWallet(state.player.wallet, 'Gems');
    expect(canAffordSku(state, 'GemsChest', T0)).toBe(true);
    expect(canAffordSku(state, 'GemsVault', T0)).toBe(false);

    expect(buySku(state, 'GemsVault', T0)).toBe('NoBudget');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(gems);
    expect(state.player.payer?.refusals).toBe(1);
    expect(state.player.payer?.purchases).toEqual([]);

    // A chest is $9.99; a pouch on top would be $10.98 against $10.00.
    expect(buySku(state, 'GemsChest', T0)).toBe('Purchased');
    expect(buySku(state, 'GemsPouch', T0)).toBe('NoBudget');
    expect(state.player.payer?.refusals).toBe(2);
  });

  it('F2P walks the same store and is refused every price', () => {
    const state = blank();
    choosePayerProfile(state, 'F2P', T0);
    expect(budgetRemainingCents(state, T0)).toBe(0);
    for (const id of STORE_ORDER) {
      expect(canAffordSku(state, id, T0)).toBe(false);
      expect(buySku(state, id, T0)).toBe('NoBudget');
    }
    expect(state.player.payer?.refusals).toBe(STORE_ORDER.length);
  });

  it('refills on the first of the month and never rolls over', () => {
    const state = blank();
    choosePayerProfile(state, 'Minnow', T0);
    buySku(state, 'GemsChest', T0);
    const spent = priceCents('GemsChest');
    const budget = monthlyBudgetCents('Minnow');

    // The last second of the month: still spent.
    expect(budgetRemainingCents(state, NEXT_MONTH - 1)).toBe(budget - spent);
    // The first: a full budget — not budget + what was unspent last month.
    expect(budgetRemainingCents(state, NEXT_MONTH)).toBe(budget);
    // A read does not mutate; a purchase in the new month rolls the counter.
    expect(state.player.payer?.spentCentsThisMonth).toBe(spent);
    expect(buySku(state, 'GemsChest', NEXT_MONTH + DAY)).toBe('Purchased');
    expect(state.player.payer?.monthIndex).toBe(monthIndex(NEXT_MONTH));
    expect(state.player.payer?.spentCentsThisMonth).toBe(spent);
  });
});

describe('the save', () => {
  it('round-trips the payer, and a save from before it comes back with none', () => {
    const state = blank();
    choosePayerProfile(state, 'Minnow', T0);
    buySku(state, 'GemsPouch', T0);
    buySku(state, 'GemsVault', T0); // refused: $19.99 against $9.01 left
    const restored = deserialize(serialize(state, T0), map, T0)!;
    expect(restored.player.payer).toEqual(state.player.payer);
    expect(getWallet(restored.player.wallet, 'Gems')).toBe(getWallet(state.player.wallet, 'Gems'));

    // Additive: an older save has no `player.payer` module and reads as null,
    // which is what makes the profile sheet ask on the next launch.
    const old = serialize(blank(), T0);
    delete (old.Modules as Record<string, unknown>)['player.payer'];
    old.SaveVersion = SAVE_VERSION - 1;
    expect(deserialize(old, map, T0)!.player.payer).toBeNull();
  });

  it('forgets a profile this build no longer has, so the sheet asks again', () => {
    const state = blank();
    choosePayerProfile(state, 'Minnow', T0);
    const save = serialize(state, T0);
    (save.Modules['player.payer'] as { Profile: string }).Profile = 'Casual'; // the weekly roster
    expect(deserialize(save, map, T0)!.player.payer).toBeNull();
  });
});

describe('the presenter', () => {
  it('holds the screen on the profile sheet until a profile is chosen', () => {
    const game = freshPresenter(blank());
    game.setOverlay('build');
    expect(game.openOverlay).toBe('payerProfile'); // forced, and remembers the ask
    game.dismiss();
    expect(game.openOverlay).toBe('payerProfile'); // cannot be dismissed

    game.doChoosePayerProfile('Minnow');
    expect(game.state.player.payer?.profile).toBe('Minnow');
    expect(game.openOverlay).toBe('build'); // the ask that was waiting
    game.dismiss();
    expect(game.openOverlay).toBeNull();
  });

  it('opens the confirmation from a price and buys only from there', () => {
    const game = freshPresenter(); // Dolphin, from the helper
    const gems = game.walletValue('Gems');
    game.setOverlay('store');
    game.openIap('GemsPouch');
    expect(game.openOverlay).toBe('iapConfirm');
    expect(game.pendingSku).toBe('GemsPouch');
    expect(game.walletValue('Gems')).toBe(gems); // nothing granted yet

    game.confirmIap();
    expect(game.walletValue('Gems')).toBe(gems + STORE.GemsPouch.gems);
    expect(game.openOverlay).toBe('store'); // back to shopping
    expect(game.pendingSku).toBeNull();
  });

  it('reports the budget the confirmation sheet draws', () => {
    const game = freshPresenter();
    const info = game.payerInfo()!;
    expect(info.profile).toBe('Dolphin');
    expect(info.label).toBe('Dolphin');
    expect(info.budgetCents).toBe(monthlyBudgetCents('Dolphin'));
    expect(info.remainingCents).toBe(monthlyBudgetCents('Dolphin'));
    expect(info.resetsIn).toMatch(/^in \d+ (day|hour|minute)s?$/);
  });

  it('keeps the store open when a builder is hired from it', () => {
    const game = freshPresenter();
    game.state.player.wallet.Gems = 5000;
    game.setOverlay('store');
    game.doBuyBuilder({ closeSheet: false });
    expect(game.openOverlay).toBe('store');
    expect(game.state.kingdom.builders).toBe(2);
  });
});
