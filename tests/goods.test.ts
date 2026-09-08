// Refined goods: the stockpile, and a building level priced in it
// (Docs/plans/builder-30-days.md §2).
//
// Nothing MAKES a good yet — the workshops are the next step — so what is
// under test here is the plumbing that has to exist before they can: the
// stockpile, the per-level price, and the two separate refusals an upgrade
// now has.
import { afterEach, describe, expect, it } from 'vitest';
import { DISTRICTS, GOODS, SAVE_VERSION, type DistrictDef } from '../src/sim/data/definitions';
import { upgradeDistrict } from '../src/sim/commands';
import { LATE_FROM, upgradeCost, upgradeGoodsCost } from '../src/sim/districts';
import {
  addGood, canAffordGoods, getGood, goodsCostForLevel, payGoods, refundGoods,
} from '../src/sim/goods';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet, type GoodsStock } from '../src/sim/state';
import { addBuilt, freshGame, fund, map, T0 } from './helpers';

/** Price one district's next level in goods, for the length of one test —
 *  a price at a LOW level, which the sheet never authors, so a refusal can be
 *  tested without a Townhall ladder in front of it. `unpriced` puts the
 *  authored column back rather than blanking it. */
const AUTHORED = DISTRICTS.Sawmill.upgradeCostGoodsPerLevel;
const priced = (id: 'Sawmill', levels: readonly GoodsStock[]): void => {
  (DISTRICTS[id] as { upgradeCostGoodsPerLevel: readonly GoodsStock[] })
    .upgradeCostGoodsPerLevel = levels;
};
const unpriced = (id: 'Sawmill'): void => priced(id, AUTHORED);

describe('the goods stockpile', () => {
  it('counts up and down, and never below zero', () => {
    const stock: GoodsStock = {};
    expect(getGood(stock, 'Planks')).toBe(0);
    addGood(stock, 'Planks', 5);
    addGood(stock, 'Planks', 3);
    expect(getGood(stock, 'Planks')).toBe(8);
    payGoods(stock, { Planks: 6 });
    expect(getGood(stock, 'Planks')).toBe(2);
    // A stockpile is a count, not a debt: nothing in the game can owe goods.
    addGood(stock, 'Planks', -10);
    expect(getGood(stock, 'Planks')).toBe(0);
  });

  it('affords a cost only when every good in it is covered', () => {
    const stock: GoodsStock = { Planks: 4, CutStone: 1 };
    expect(canAffordGoods(stock, {})).toBe(true);
    expect(canAffordGoods(stock, { Planks: 4 })).toBe(true);
    expect(canAffordGoods(stock, { Planks: 4, CutStone: 2 })).toBe(false);
    expect(canAffordGoods(stock, { Runestone: 1 })).toBe(false);
  });

  it('refunds exactly what it took', () => {
    const stock: GoodsStock = { Planks: 4 };
    const cost = { Planks: 3 };
    payGoods(stock, cost);
    refundGoods(stock, cost);
    expect(getGood(stock, 'Planks')).toBe(4);
  });

  it('is not a wallet row', () => {
    // Four coins on the plank is the genre's ceiling. A good that became a
    // currency would get a coin, a cap and a Market price it has no use for.
    const state = freshGame();
    expect(getWallet(state.city.wallet, 'Gold' as never)).toBeGreaterThanOrEqual(0);
    expect(Object.keys(state.city.wallet)).not.toContain('Planks');
    expect(state.city.goods).toEqual({});
  });
});

describe('the goods recipes', () => {
  it('names an input for every good', () => {
    for (const good of Object.values(GOODS)) {
      const raw = Object.keys(good.input).length > 0;
      const refined = good.inputGood !== null;
      const magic = good.inputMana > 0;
      expect(raw || refined || magic, `${good.id} is made of nothing`).toBe(true);
      expect(good.workSeconds, `${good.id} takes no work`).toBeGreaterThan(0);
    }
  });

  it('makes the tier-2 good out of a tier-1 one', () => {
    // The one recipe that reaches across tiers, and the reason the workshops
    // are a chain rather than four independent buildings.
    expect(GOODS.Runestone.tier).toBe(2);
    expect(GOODS.Runestone.inputGood).toBe('CutStone');
    expect(GOODS[GOODS.Runestone.inputGood!].tier).toBe(1);
    expect(GOODS.Runestone.inputGoodAmount).toBeGreaterThan(0);
  });
});

describe('a building level priced in goods', () => {
  afterEach(() => unpriced('Sawmill'));

  it('indexes the price the way every other per-level column does', () => {
    const def = { upgradeCostGoodsPerLevel: [{ Planks: 2 }, { Planks: 4 }] } as unknown as DistrictDef;
    expect(goodsCostForLevel(def, 2)).toEqual({ Planks: 2 }); // entry 0 = reaching level 2
    expect(goodsCostForLevel(def, 3)).toEqual({ Planks: 4 });
    // Past the end of the list is free of goods, which is what every level of
    // every building is today.
    expect(goodsCostForLevel(def, 4)).toEqual({});
  });

  it('charges nothing below the late city, and something at every level of it', () => {
    for (const def of Object.values(DISTRICTS)) {
      if (def.maxLevel < LATE_FROM) {
        expect(def.upgradeCostGoodsPerLevel, `${def.id} stops early and is priced in goods`)
          .toEqual([]);
        continue;
      }
      for (let level = 2; level < LATE_FROM; level++) {
        // The one exception: the Townhall's ladder is priced in goods from
        // level 5, one level before the pivot — it is the clock every other
        // ladder hangs from, and the workshops open at 4 so that a good exists
        // before the first level that asks for one.
        if (def.id === 'Townhall' && level === LATE_FROM - 1) continue;
        expect(goodsCostForLevel(def, level), `${def.id} level ${level}`).toEqual({});
      }
      // Every late level asks for a good, so no building's ladder can be
      // climbed without a workshop (the whole point of §2).
      for (let level = LATE_FROM; level <= def.maxLevel; level++) {
        expect(Object.keys(goodsCostForLevel(def, level)), `${def.id} level ${level}`)
          .not.toEqual([]);
      }
    }
  });

  it('refuses the upgrade, and says which purse is short', () => {
    const state = freshGame();
    addBuilt(state, 'Sawmill', { x: 3, y: 3 });
    const sawmill = state.city.districts.find((d) => d.definitionId === 'Sawmill')!;
    priced('Sawmill', [{ Planks: 3 }]);
    expect(upgradeGoodsCost('Sawmill', 2)).toEqual({ Planks: 3 });

    // Short of both: the raw resources are asked for first, because that is
    // the errand the player can run right now.
    expect(upgradeDistrict(state, sawmill.uniqueId)).toBe('NotEnoughResources');

    fund(state, upgradeCost('Sawmill', 1, 1) as Record<string, number>);
    expect(upgradeDistrict(state, sawmill.uniqueId)).toBe('NotEnoughGoods');

    addGood(state.city.goods, 'Planks', 3);
    expect(upgradeDistrict(state, sawmill.uniqueId)).toBe('Started');
    // Paid, not merely checked.
    expect(getGood(state.city.goods, 'Planks')).toBe(0);
  });

  it('leaves the stockpile alone when the level is free of goods', () => {
    const state = freshGame();
    addBuilt(state, 'Sawmill', { x: 3, y: 3 });
    const sawmill = state.city.districts.find((d) => d.definitionId === 'Sawmill')!;
    fund(state, upgradeCost('Sawmill', 1, 1) as Record<string, number>);
    addGood(state.city.goods, 'Planks', 2);
    expect(upgradeDistrict(state, sawmill.uniqueId)).toBe('Started');
    expect(getGood(state.city.goods, 'Planks')).toBe(2);
  });
});

describe('the stockpile in the save', () => {
  it('survives a round trip', () => {
    const state = freshGame();
    addGood(state.city.goods, 'Planks', 7);
    addGood(state.city.goods, 'Runestone', 1);
    const loaded = deserialize(serialize(state, T0), map, T0)!;
    expect(loaded.city.goods).toEqual({ Planks: 7, Runestone: 1 });
  });

  it('reads a save written before goods existed as an empty stockpile', () => {
    const state = freshGame();
    const save = serialize(state, T0);
    // The additive case: a save from the build before this one simply has no
    // Goods key, and a city that never built a workshop holds none anyway.
    delete (save.Modules as Record<string, any>)['kingdom.cities'].Cities[0].Goods;
    (save as { SaveVersion: number }).SaveVersion = SAVE_VERSION - 1;
    const loaded = deserialize(save, map, T0)!;
    expect(loaded.city.goods).toEqual({});
  });
});
