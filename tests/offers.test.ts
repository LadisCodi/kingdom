// The store's offers (Docs/features/14-monetization.md §2.4): windows opened
// by triggers, closed by the clock they are handed, sold out by their limit;
// chains, the daily draw, the computed value, the slots a pack opens for good
// and the first-purchase reward.
import { describe, expect, it } from 'vitest';
import {
  DAILY_POOL, FIRST_PURCHASE, KINGDOM_DEF, LANDMARKS, OFFERS, OFFER_ORDER, STORE, WORLD,
} from '../src/sim/data/definitions';
import { newGame } from '../src/sim/newGame';
import {
  dailyOffers, dailyOn, dailyResetsAt, gemsPerDollar, offerOn, offerTrigger, refreshOffers, skuGemWorth,
  skuValuePercent,
} from '../src/sim/offers';
import { deserialize, serialize } from '../src/sim/save';
import { addToWallet, getWallet, townhall, type GameState, type StoreSkuId } from '../src/sim/state';
import { buySku, buyStoreSku, choosePayerProfile, firstPurchaseDone } from '../src/sim/store';
import { buyExplorer, explorerGemCost, explorerSlots } from '../src/sim/world/explorers';
import { map, T0 } from './helpers';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A kingdom with the store open (Townhall 2) and a big spender's budget. */
function shop(): GameState {
  const state = newGame(map, T0);
  townhall(state).level = 2;
  choosePayerProfile(state, 'SuperWhale', T0);
  return state;
}

const byTrigger = (t: string): StoreSkuId => OFFER_ORDER.find((id) => STORE[id].opensOn === t)!;

describe('an offer window', () => {
  it('opens nothing until the store does', () => {
    const state = newGame(map, T0);
    refreshOffers(state, T0);
    expect(state.player.offers.windows).toEqual({});
  });

  it('opens on its door, once, and stays open until bought out', () => {
    const state = shop();
    const sku = OFFER_ORDER.find((id) => STORE[id].opensOn === 'door' && STORE[id].door === 'store')!;
    refreshOffers(state, T0);
    expect(offerOn(state, sku, T0)).toBe(true);
    expect(state.player.offers.windows[sku]!.closes).toBeNull();
    for (let i = 0; i < STORE[sku].limit; i++) expect(buyStoreSku(state, sku, T0)).toBe('Purchased');
    expect(offerOn(state, sku, T0)).toBe(false);
    expect(buyStoreSku(state, sku, T0)).toBe('NotOnSale');
    // A one-time trigger never opens it again.
    refreshOffers(state, T0 + 400 * DAY);
    expect(offerOn(state, sku, T0 + 400 * DAY)).toBe(false);
  });

  it('opens the next step of a chain the moment the step before is bought', () => {
    const state = shop();
    refreshOffers(state, T0);
    const next = OFFER_ORDER.find((id) => STORE[id].opensOn === 'after')!;
    const before = STORE[next].after!;
    expect(offerOn(state, next, T0)).toBe(false);
    expect(buyStoreSku(state, before, T0)).toBe('Purchased');
    expect(offerOn(state, next, T0)).toBe(true);
  });

  it('closes on the clock it is handed, and a trigger that comes back waits out its cooldown', () => {
    const state = shop();
    const sku = byTrigger('buildersBusy');
    const { hours, cooldownHours } = STORE[sku];
    expect(offerTrigger(state, 'buildersBusy', T0)).toContain(sku);
    expect(offerOn(state, sku, T0 + hours * HOUR - 1)).toBe(true);
    expect(offerOn(state, sku, T0 + hours * HOUR)).toBe(false);
    // Asked again while the window is open, or cooling, it does not reopen.
    expect(offerTrigger(state, 'buildersBusy', T0 + HOUR)).toEqual([]);
    const cooled = T0 + (hours + cooldownHours) * HOUR;
    expect(offerTrigger(state, 'buildersBusy', cooled - 1)).toEqual([]);
    expect(offerTrigger(state, 'buildersBusy', cooled)).toContain(sku);
    expect(offerOn(state, sku, cooled)).toBe(true);
  });

  it('opens on a Townhall level raised, from its first level on', () => {
    const state = shop();
    const sku = byTrigger('townhall');
    refreshOffers(state, T0);
    expect(offerOn(state, sku, T0)).toBe(false);
    townhall(state).level = STORE[sku].townhall;
    refreshOffers(state, T0 + 1);
    expect(offerOn(state, sku, T0 + 1)).toBe(true);
  });

  it('opens when the Mana pool runs low', () => {
    const state = shop();
    const sku = byTrigger('manaLow');
    addToWallet(state.city.wallet, 'Mana', -getWallet(state.city.wallet, 'Mana'));
    refreshOffers(state, T0);
    expect(offerOn(state, sku, T0)).toBe(true);
  });

  it('is held back while a slot it opens would go over the ceiling', () => {
    const state = shop();
    state.kingdom.builders = KINGDOM_DEF.maxBuilders;
    refreshOffers(state, T0);
    const builderPack = OFFER_ORDER.find((id) => STORE[id].builders > 0)!;
    expect(state.player.offers.windows[builderPack]).toBeUndefined();
  });

  it('survives a save', () => {
    const state = shop();
    offerTrigger(state, 'buildersBusy', T0);
    refreshOffers(state, T0);
    const back = deserialize(serialize(state, T0), map, T0);
    expect(back?.player.offers).toEqual(state.player.offers);
  });
});

describe('a purchase', () => {
  it('hands over the Gems, the items and the slots for good', () => {
    const state = shop();
    refreshOffers(state, T0);
    const sku = OFFER_ORDER.find((id) => STORE[id].builders > 0 && offerOn(state, id, T0))!;
    const builders = state.kingdom.builders;
    const gems = getWallet(state.player.wallet, 'Gems');
    expect(buyStoreSku(state, sku, T0)).toBe('Purchased');
    expect(state.kingdom.builders).toBe(builders + STORE[sku].builders);
    expect(getWallet(state.player.wallet, 'Gems')).toBe(gems + STORE[sku].gems + FIRST_PURCHASE.gems);
    for (const [item, n] of Object.entries(STORE[sku].items)) {
      expect(state.bag.held[item as keyof typeof state.bag.held] ?? 0).toBeGreaterThanOrEqual(n!);
    }
  });

  it('refused for want of budget, charges nothing and sells nothing', () => {
    const state = newGame(map, T0);
    townhall(state).level = 2;
    choosePayerProfile(state, 'F2P', T0);
    refreshOffers(state, T0);
    const sku = OFFER_ORDER.find((id) => offerOn(state, id, T0))!;
    expect(buyStoreSku(state, sku, T0)).toBe('NoBudget');
    expect(state.player.offers.windows[sku]!.bought).toBe(0);
    expect(firstPurchaseDone(state)).toBe(false);
  });

  it('pays the first-purchase reward once, on the first purchase of anything', () => {
    const state = shop();
    expect(firstPurchaseDone(state)).toBe(false);
    expect(buySku(state, 'GemsPouch', T0)).toBe('Purchased');
    expect(firstPurchaseDone(state)).toBe(true);
    if (FIRST_PURCHASE.hero !== null) expect(state.heroes.owned).toContain(FIRST_PURCHASE.hero);
    const keys = { ...state.bag.held };
    buySku(state, 'GemsPouch', T0);
    expect(state.bag.held).toEqual(keys);
  });
});

describe('the daily offers', () => {
  it('draws the same products however often it is asked, and a new set tomorrow', () => {
    const state = shop();
    const today = dailyOffers(state, T0);
    expect(today.length).toBeLessThanOrEqual(OFFERS.dailyCount);
    expect(today.every((id) => DAILY_POOL.includes(id))).toBe(true);
    expect(dailyOffers(state, T0 + HOUR)).toEqual(today);
    const days = new Set(Array.from({ length: 10 }, (_, d) => dailyOffers(state, T0 + d * DAY).join()));
    expect(days.size).toBeGreaterThan(1);
  });

  it('sells each today up to its limit, and again after the reset', () => {
    const state = shop();
    const sku = dailyOffers(state, T0)[0]!;
    for (let i = 0; i < STORE[sku].limit; i++) expect(buyStoreSku(state, sku, T0)).toBe('Purchased');
    expect(dailyOn(state, sku, T0)).toBe(false);
    // A product not in a day's draw is not for sale that day.
    const tomorrow = dailyResetsAt(T0);
    if (dailyOffers(state, tomorrow).includes(sku)) expect(dailyOn(state, sku, tomorrow)).toBe(true);
  });
});

describe('the value a pack prints', () => {
  it('is 100% for a Gem pack at the best rate, and well over for an offer', () => {
    const state = shop();
    const best = (['GemsPouch', 'GemsTreasury'] as StoreSkuId[])
      .find((id) => STORE[id].gems / STORE[id].priceUsd === gemsPerDollar())!;
    expect(skuValuePercent(state, best)).toBe(100);
    for (const id of OFFER_ORDER) expect(skuValuePercent(state, id)).toBeGreaterThan(100);
  });

  it('counts the slots a pack opens at their Gem price', () => {
    const state = shop();
    const sku = OFFER_ORDER.find((id) => STORE[id].explorers > 0)!;
    const without = skuGemWorth(state, sku) - explorerGemCost(state) * STORE[sku].explorers;
    expect(without).toBeGreaterThan(0);
  });
});

describe('an explorer bought', () => {
  it('waits for Cartography, then adds one out at once, on a rising Gem price', () => {
    const state = shop();
    state.landmarks.claimed[LANDMARKS.find((l) => l.kind === 'Watchtower')!.id] = true;
    addToWallet(state.player.wallet, 'Gems', 1_000_000);
    const first = explorerGemCost(state);
    expect(buyExplorer(state)).toBe('Bought');
    expect(explorerSlots(state)).toBe(0);
    state.research.completed.push('Cartography');
    expect(explorerSlots(state)).toBe(WORLD.cartographyExplorers + 1);
    expect(explorerGemCost(state)).toBeGreaterThan(first);
    while (buyExplorer(state) === 'Bought');
    expect(state.world.explorersBought).toBe(WORLD.explorersForSale);
    expect(buyExplorer(state)).toBe('AtMax');
  });
});
