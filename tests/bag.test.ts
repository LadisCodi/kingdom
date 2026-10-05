// The Bag (Docs/plans/relics-and-bag.md, step 1): chests priced in the
// city's own production at the moment of use.

import { describe, expect, it } from 'vitest';
import { BAG, ITEMS, ITEM_ORDER } from '../src/sim/data/definitions';
import {
  chestValue, grantItem, heldItems, itemCount, markBagOpened, markItemSeen, useItem,
} from '../src/sim/bag';
import { cityMakesPerSecond } from '../src/sim/production';
import { buyKeys } from '../src/sim/commands';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet, townhall } from '../src/sim/state';
import { addBuilt, freshGame, freshPresenter, map, T0 } from './helpers';

const gold = (s: ReturnType<typeof freshGame>) => getWallet(s.city.wallet, 'Gold');

describe('the Bag', () => {
  it('holds what it is given, fresh until the tile is tapped', () => {
    const state = freshGame();
    grantItem(state, 'WoodChest1h', 3);
    expect(itemCount(state, 'WoodChest1h')).toBe(3);
    expect(heldItems(state)).toEqual(['WoodChest1h']);
    expect(state.bag.fresh.WoodChest1h).toBe(true);
    expect(state.bag.badge).toBe(3);
    markItemSeen(state, 'WoodChest1h');
    markBagOpened(state);
    expect(state.bag.fresh.WoodChest1h).toBeUndefined();
    expect(state.bag.badge).toBe(0);
  });

  it('pays a chest in what the city makes now — two Townhall levels, two amounts', () => {
    const low = freshGame();
    const high = freshGame();
    townhall(high).level = 5;
    const a = chestValue(low, 'GoldChest8h').Gold!;
    const b = chestValue(high, 'GoldChest8h').Gold!;
    expect(b).toBeGreaterThan(a);
    expect(b).toBe(Math.round(cityMakesPerSecond(high, 'Gold') * ITEMS.GoldChest8h.seconds));
  });

  it('pays at least its floor for a coin the city does not make yet', () => {
    const state = freshGame();
    expect(cityMakesPerSecond(state, 'Stone')).toBe(0);
    expect(chestValue(state, 'StoneChest1h').Stone).toBe(BAG.chestFloorPerHour);
  });

  it('lands in the wallet, and Use ×N equals N single uses', () => {
    const once = freshGame();
    const many = freshGame();
    for (const s of [once, many]) {
      addBuilt(s, 'Housing', { x: 2, y: 0 });
      grantItem(s, 'GoldChest1h', 4);
    }
    const before = gold(once);
    for (let i = 0; i < 4; i++) expect(useItem(once, 'GoldChest1h', 1, T0)).toBe('Used');
    expect(useItem(many, 'GoldChest1h', 4, T0)).toBe('Used');
    expect(gold(many)).toBe(gold(once));
    expect(gold(once) - before).toBe(4 * chestValue(once, 'GoldChest1h').Gold!);
    expect(itemCount(many, 'GoldChest1h')).toBe(0);
    expect(many.bag.held.GoldChest1h).toBeUndefined();
  });

  it('refuses what it does not hold', () => {
    const state = freshGame();
    grantItem(state, 'FoodChest10m', 1);
    expect(useItem(state, 'FoodChest10m', 2, T0)).toBe('NotHeld');
    expect(useItem(state, 'FoodChest10m', 0, T0)).toBe('NotHeld');
    expect(useItem(state, 'WoodChest8h', 1, T0)).toBe('NotHeld');
    expect(itemCount(state, 'FoodChest10m')).toBe(1);
  });

  it('records each use for the analytics outbox', () => {
    const state = freshGame();
    grantItem(state, 'FoodChest10m', 2);
    useItem(state, 'FoodChest10m', 2, T0);
    expect(state.pendingAnalytics.at(-1)).toMatchObject({ name: 'item_used', props: { item: 'FoodChest10m', count: 2 } });
  });

  it('survives a save, and drops what the build no longer knows', () => {
    const state = freshGame();
    grantItem(state, 'GoldChest10m', 2);
    grantItem(state, 'StoneChest8h', 1);
    markItemSeen(state, 'GoldChest10m');
    const file = serialize(state, T0);
    const bag = file.Modules['kingdom.bag'] as { Held: Record<string, number>; Fresh: string[] };
    bag.Held.NoSuchChest = 5;
    bag.Fresh.push('NoSuchChest');
    const back = deserialize(file, map, T0)!;
    expect(back.bag.held).toEqual({ GoldChest10m: 2, StoneChest8h: 1 });
    expect(back.bag.fresh).toEqual({ StoneChest8h: true });
    expect(back.bag.badge).toBe(3);
  });

  it('sorts by kind, then by size — the file is authored in that order', () => {
    const chests = ITEM_ORDER.filter((id) => ITEMS[id].kind === 'chest');
    for (const coin of ['Gold', 'Food', 'Wood', 'Stone']) {
      const sizes = chests.filter((id) => ITEMS[id].coin === coin).map((id) => ITEMS[id].seconds);
      expect(sizes).toEqual([...sizes].sort((x, y) => x - y));
    }
  });
});

describe('the Bag on screen', () => {
  it('clears the nav orb when opened, and a Use lands what the popover promised', () => {
    const game = freshPresenter();
    grantItem(game.state, 'WoodChest1h', 2);
    expect(game.bagBadge()).toBe(2);
    game.setOverlay('bag');
    expect(game.openOverlay).toBe('bag');
    expect(game.bagBadge()).toBe(0);
    game.pickBagItem('WoodChest1h');
    const item = game.bagScreen().items.find((i) => i.id === 'WoodChest1h')!;
    expect(game.bagScreen().picked).toBe('WoodChest1h');
    expect(item.fresh).toBe(false);
    const wood = getWallet(game.state.city.wallet, 'Wood');
    game.doUseItem('WoodChest1h', 2);
    expect(getWallet(game.state.city.wallet, 'Wood') - wood).toBe(2 * item.worth.Wood!);
    expect(game.bagScreen().items).toEqual([]);
    expect(game.bagScreen().picked).toBeNull();
  });
});

describe('the keys', () => {
  it('move from an old save\'s purse to the Bag', () => {
    const state = freshGame();
    const file = serialize(state, T0);
    file.SaveVersion = 90;
    (file.Modules['player.currencies'] as Record<string, number>).SilverKey = 3;
    (file.Modules['player.currencies'] as Record<string, number>).GoldKey = 1;
    delete file.Modules['kingdom.bag'];
    const back = deserialize(file, map, T0)!;
    expect(back.bag.held).toEqual({ SilverKey: 3, GoldKey: 1 });
    expect(back.bag.fresh).toEqual({});
    expect((back.player.wallet as Record<string, number>).SilverKey).toBeUndefined();
  });

  it('are what a call spends, and what the store sells', () => {
    const state = freshGame();
    state.player.wallet.Gems = 10_000;
    expect(buyKeys(state, 'advanced', 2)).toBe('Purchased');
    expect(itemCount(state, 'GoldKey')).toBe(2);
    expect(useItem(state, 'GoldKey', 1, T0)).toBe('UsedElsewhere');
  });
});
