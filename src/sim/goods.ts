// Refined goods: the stockpile, and what an advanced building level costs in
// it (Docs/plans/builder-30-days.md §2).
//
// A good is NOT a currency. It has no cap, no Market price and no coin on the
// plank: the city keeps a counter per good, the way the collection keeps
// ingredients, and it is read where it is spent — a workshop's queue and the
// price of the next level. Four coins on the plank is the genre's ceiling,
// and a fifth row would have to earn itself.

import { GOODS, type DistrictDef } from './data/definitions';
import type { GameState, GoodId, GoodsStock } from './state';

export const getGood = (stock: GoodsStock, id: GoodId): number => stock[id] ?? 0;

export function addGood(stock: GoodsStock, id: GoodId, amount: number): void {
  stock[id] = Math.max(0, getGood(stock, id) + amount);
}

export const canAffordGoods = (stock: GoodsStock, cost: GoodsStock): boolean =>
  Object.entries(cost).every(([id, n]) => getGood(stock, id as GoodId) >= n);

/** Callers must have checked `canAffordGoods` first. */
export function payGoods(stock: GoodsStock, cost: GoodsStock): void {
  for (const [id, n] of Object.entries(cost)) addGood(stock, id as GoodId, -n);
}

export function refundGoods(stock: GoodsStock, cost: GoodsStock): void {
  for (const [id, n] of Object.entries(cost)) addGood(stock, id as GoodId, n);
}

/** Is this cost asking for anything at all? An empty price is the common case
 *  — every level up to 5 is paid in raw resources alone. */
export const isFreeOfGoods = (cost: GoodsStock): boolean => Object.keys(cost).length === 0;

/**
 * What reaching `level` costs in goods — level 1 being the BUILD, the same
 * row of `DistrictCosts` that prices it in currencies.
 *
 * The instance ordinal never enters: a recipe does not know how many of the
 * thing the city owns (Docs/features/05-city-and-districts.md §3.2).
 */
export function goodsCostForLevel(def: DistrictDef, level: number): GoodsStock {
  return def.costPerLevel[level - 1]?.goods ?? {};
}

/** Everything the city holds, in authored order, for a card that lists it. */
export const goodsHeld = (state: GameState): { id: GoodId; amount: number }[] =>
  (Object.keys(GOODS) as GoodId[])
    .map((id) => ({ id, amount: getGood(state.city.goods, id) }))
    .filter((g) => g.amount > 0);
