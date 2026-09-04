// Workshops: the queue, the crew that works it, and how the crew shares
// itself out (Docs/plans/builder-30-days.md §3).
//
// The load-bearing property here is the sharing rule — one more villager is
// always faster, whatever the queue holds — and the one that is easiest to
// break by accident is that the whole thing replays exactly, because the rate
// changes every time an item finishes.
import { describe, expect, it } from 'vitest';
import { DISTRICTS, GOODS, RUSH } from '../src/sim/data/definitions';
import { advance, changeWorkers } from '../src/sim/commands';
import { getGood } from '../src/sim/goods';
import { mana } from '../src/sim/mana';
import { deserialize, serialize } from '../src/sim/save';
import {
  cancelWorkshopItem, finishItemWithGems, itemRushCost, queueGood, queueCapacity,
} from '../src/sim/workshops';
import { getWallet, type District, type GameState } from '../src/sim/state';
import { addBuilt, freshGame, fund, map, T0 } from './helpers';

const MIN = 60_000;

/** A built Carpenter with `crew` villagers on it. */
function withCarpenter(crew: number, level = 1): { state: GameState; shop: District } {
  const state = freshGame();
  addBuilt(state, 'Carpenter', { x: 3, y: 3 });
  const shop = state.city.districts.find((d) => d.definitionId === 'Carpenter')!;
  shop.level = level;
  state.city.population = crew;
  for (let i = 0; i < crew; i++) {
    expect(changeWorkers(state, map, shop.uniqueId, 1, T0)).toBe('Assigned');
  }
  fund(state, { Wood: 10_000, Stone: 10_000, Gold: 100_000, Gems: 10_000 });
  return { state, shop };
}

const queue = (state: GameState, shop: District, n: number, now = T0): void => {
  for (let i = 0; i < n; i++) expect(queueGood(state, shop.uniqueId, now)).toBe('Queued');
};

describe('a workshop with no crew', () => {
  it('does not advance at all', () => {
    const { state, shop } = withCarpenter(0);
    queue(state, shop, 2);
    advance(state, map, T0 + 10 * 60 * MIN);
    // No hand production and no collect tap: the worker is the only engine.
    expect(getGood(state.city.goods, 'Planks')).toBe(0);
    expect(state.city.workshops[shop.uniqueId].items).toHaveLength(2);
  });

  it('starts from the moment a villager arrives, not from when it was queued', () => {
    const { state, shop } = withCarpenter(0);
    queue(state, shop, 1);
    advance(state, map, T0 + 60 * MIN);
    state.city.population = 1;
    expect(changeWorkers(state, map, shop.uniqueId, 1, T0 + 60 * MIN)).toBe('Assigned');
    // Planks are 20 minutes of one villager. An hour of nobody working buys
    // nothing, so it is not ready one minute later.
    advance(state, map, T0 + 61 * MIN);
    expect(getGood(state.city.goods, 'Planks')).toBe(0);
    advance(state, map, T0 + 81 * MIN);
    expect(getGood(state.city.goods, 'Planks')).toBe(1);
  });
});

describe('the crew shares the queue', () => {
  const PLANKS_MIN = GOODS.Planks.workSeconds / 60;

  it('one worker, one item: the authored time', () => {
    const { state, shop } = withCarpenter(1);
    queue(state, shop, 1);
    advance(state, map, T0 + (PLANKS_MIN - 1) * MIN);
    expect(getGood(state.city.goods, 'Planks')).toBe(0);
    advance(state, map, T0 + PLANKS_MIN * MIN);
    expect(getGood(state.city.goods, 'Planks')).toBe(1);
  });

  it('two workers on one item finish it in half the time', () => {
    const { state, shop } = withCarpenter(2, 2);
    queue(state, shop, 1);
    advance(state, map, T0 + (PLANKS_MIN / 2) * MIN);
    expect(getGood(state.city.goods, 'Planks')).toBe(1);
  });

  it('two workers on two items finish both in the whole time, not double it', () => {
    const { state, shop } = withCarpenter(2, 2);
    queue(state, shop, 2);
    advance(state, map, T0 + (PLANKS_MIN / 2) * MIN);
    expect(getGood(state.city.goods, 'Planks')).toBe(0); // neither is done yet
    advance(state, map, T0 + PLANKS_MIN * MIN);
    expect(getGood(state.city.goods, 'Planks')).toBe(2);
  });

  it('three workers on two items finish both in two thirds of it', () => {
    // The spare villager helps rather than idling — which is the whole reason
    // one more is always worth housing.
    const { state, shop } = withCarpenter(3, 4);
    queue(state, shop, 2);
    advance(state, map, T0 + Math.ceil((PLANKS_MIN * 2 / 3)) * MIN);
    expect(getGood(state.city.goods, 'Planks')).toBe(2);
  });

  it('holds throughput at one item-hour per worker-hour, whatever the queue', () => {
    const hour = 60 * MIN;
    for (const [crew, queued] of [[1, 1], [2, 2], [2, 4], [3, 3]] as const) {
      const { state, shop } = withCarpenter(crew, 10);
      queue(state, shop, queued);
      advance(state, map, T0 + hour);
      // An hour of `crew` villagers is `crew` hours of work; Planks take 20
      // minutes each, so three per worker-hour — capped by what was queued.
      const expected = Math.min(queued, crew * (60 / PLANKS_MIN));
      expect(getGood(state.city.goods, 'Planks'), `crew ${crew}, queued ${queued}`)
        .toBe(expected);
    }
  });
});

describe('the queue', () => {
  it('is as long as the level says, and no longer', () => {
    const { state, shop } = withCarpenter(1);
    const cap = queueCapacity(shop);
    expect(cap).toBe(DISTRICTS.Carpenter.queueLengthPerLevel[0]);
    queue(state, shop, cap);
    expect(queueGood(state, shop.uniqueId, T0)).toBe('QueueFull');
  });

  it('grows with the level, and the crew does too', () => {
    const { shop } = withCarpenter(0, 10);
    expect(queueCapacity(shop)).toBeGreaterThan(DISTRICTS.Carpenter.queueLengthPerLevel[0]);
  });

  it('pays for an item when it is queued, and refunds it in full on cancel', () => {
    const { state, shop } = withCarpenter(1);
    const before = getWallet(state.city.wallet, 'Wood');
    queue(state, shop, 1);
    expect(getWallet(state.city.wallet, 'Wood')).toBe(before - GOODS.Planks.input.Wood!);
    advance(state, map, T0 + 5 * MIN); // some work done, and lost
    expect(cancelWorkshopItem(state, shop.uniqueId, 0, T0 + 5 * MIN)).toBe('Cancelled');
    expect(getWallet(state.city.wallet, 'Wood')).toBe(before);
  });

  it('refuses what the city cannot pay for', () => {
    const state = freshGame();
    addBuilt(state, 'Carpenter', { x: 3, y: 3 });
    const shop = state.city.districts.find((d) => d.definitionId === 'Carpenter')!;
    expect(queueGood(state, shop.uniqueId, T0)).toBe('NotEnoughResources');
  });

  it('takes Mana for the good that is made of it', () => {
    const state = freshGame();
    addBuilt(state, 'RuneCarver', { x: 3, y: 3 });
    const shop = state.city.districts.find((d) => d.definitionId === 'RuneCarver')!;
    fund(state, { Gold: 10_000, Stone: 10_000 });
    // Cut Stone first: a Runestone is cut stone with Mana poured into it.
    expect(queueGood(state, shop.uniqueId, T0)).toBe('NotEnoughGoods');
    state.city.goods.CutStone = 10;
    const manaBefore = mana(state);
    expect(queueGood(state, shop.uniqueId, T0)).toBe('Queued');
    expect(mana(state)).toBe(manaBefore - GOODS.Runestone.inputMana);
    expect(getGood(state.city.goods, 'CutStone'))
      .toBe(10 - GOODS.Runestone.inputGoodAmount);
  });
});

describe('the workshop under the engine contract', () => {
  it('replays in one call exactly as it ticks', () => {
    const build = (): GameState => {
      const { state, shop } = withCarpenter(3, 10);
      queue(state, shop, 5);
      return state;
    };
    const once = build();
    advance(once, map, T0 + 4 * 60 * MIN);
    const stepped = build();
    for (let i = 1; i <= 48; i++) advance(stepped, map, T0 + i * 5 * MIN);
    expect(getGood(stepped.city.goods, 'Planks'))
      .toBe(getGood(once.city.goods, 'Planks'));
    expect(JSON.stringify(serialize(stepped, T0 + 4 * 60 * MIN)))
      .toBe(JSON.stringify(serialize(once, T0 + 4 * 60 * MIN)));
  });

  it('is production, so it stops at the eight-hour offline cap', () => {
    // A Smelter, because Iron takes an hour: twelve queued is twelve hours of
    // one villager, which is more work than the cap can ever pay out.
    const state = freshGame();
    addBuilt(state, 'Smelter', { x: 3, y: 3 });
    const shop = state.city.districts.find((d) => d.definitionId === 'Smelter')!;
    shop.level = 10;
    state.city.population = 1;
    expect(changeWorkers(state, map, shop.uniqueId, 1, T0)).toBe('Assigned');
    fund(state, { Gold: 100_000, Stone: 10_000 });
    queue(state, shop, queueCapacity(shop));
    // Twelve hours away: eight hours of it land, not twelve.
    const loaded = deserialize(serialize(state, T0), map, T0 + 12 * 60 * MIN)!;
    expect(getGood(loaded.city.goods, 'Iron')).toBe(8);
  });

  it('keeps its queue and its work through a save', () => {
    const { state, shop } = withCarpenter(2, 10);
    queue(state, shop, 3);
    advance(state, map, T0 + 25 * MIN);
    const loaded = deserialize(serialize(state, T0 + 25 * MIN), map, T0 + 25 * MIN)!;
    expect(loaded.city.workshops[shop.uniqueId].items)
      .toEqual(state.city.workshops[shop.uniqueId].items);
  });
});

describe('gems finish the item in progress', () => {
  it('are priced on the time left, and buy only that item', () => {
    const { state, shop } = withCarpenter(1, 10);
    queue(state, shop, 2);
    advance(state, map, T0 + 10 * MIN); // half a plank in
    const cost = itemRushCost(state, shop, T0 + 10 * MIN)!;
    // Ten minutes left at one villager, five seconds a Gem.
    expect(cost).toBe(Math.ceil(10 * 60 / RUSH.secondsPerGem));
    const gems = getWallet(state.player.wallet, 'Gems');
    expect(finishItemWithGems(state, shop.uniqueId, T0 + 10 * MIN)).toBe('Success');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(gems - cost);
    advance(state, map, T0 + 10 * MIN);
    expect(getGood(state.city.goods, 'Planks')).toBe(1);
    // The one behind it is untouched: the queue is not for sale.
    expect(state.city.workshops[shop.uniqueId].items).toHaveLength(1);
    expect(state.city.workshops[shop.uniqueId].items[0].workMs).toBe(0);
  });

  it('costs less the more villagers are on it', () => {
    const one = withCarpenter(1, 10);
    queue(one.state, one.shop, 1);
    const two = withCarpenter(2, 10);
    queue(two.state, two.shop, 1);
    expect(itemRushCost(two.state, two.shop, T0)!)
      .toBeLessThan(itemRushCost(one.state, one.shop, T0)!);
  });

  it('refuses when nothing is being worked', () => {
    const { state, shop } = withCarpenter(0);
    queue(state, shop, 1);
    expect(finishItemWithGems(state, shop.uniqueId, T0)).toBe('NothingWorking');
  });
});
