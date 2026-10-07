// What a fight on the world board costs and what a camp pays, on the
// client's side (Docs/features/19-world-map.md §4, §5.4; 08-magic.md §1).
import { describe, expect, it } from 'vitest';
import { WORLD, WORLD_CAMPS } from '../src/sim/data/definitions';
import { manaNetRegen } from '../src/sim/mana';
import { cityMakesPerSecond } from '../src/sim/production';
import { roundPrice } from '../src/sim/roundPrice';
import { campLoot, campPay, fightMana, sendFights } from '../src/sim/world/fights';
import { freshGame } from './helpers';

describe('a fight on the board', () => {
  it('costs its hours of the city’s Mana regen', () => {
    const state = freshGame();
    expect(fightMana(state)).toBe(Math.max(1, roundPrice(manaNetRegen(state) * WORLD.fightManaHours)));
    expect(fightMana(state)).toBeGreaterThan(0);
  });

  it('is paid on sending only for a camp or a rival; rooms and floors pay their own', () => {
    expect(sendFights('clear')).toBe(true);
    expect(sendFights('attack')).toBe(true);
    for (const p of ['claim', 'garrison', 'delve', 'portal']) expect(sendFights(p)).toBe(false);
  });
});

describe('a camp’s loot', () => {
  it('pays Wood, Food and Stone in hours of the city’s own production', () => {
    const state = freshGame();
    const pay = campPay(state, 2);
    for (const c of ['Wood', 'Food', 'Stone'] as const) {
      const n = roundPrice(cityMakesPerSecond(state, c) * 2 * 3600);
      expect(pay[c] ?? 0).toBe(n);
    }
    expect(campPay(state, 0)).toEqual({});
  });

  it('shows Gold and Hero XP by its power beside them', () => {
    const state = freshGame();
    const loot = campLoot(state, 1000);
    expect(loot.Gold).toBe(roundPrice(1000 * WORLD_CAMPS.goldPerPower));
    expect(loot.HeroXp).toBe(roundPrice(1000 * WORLD_CAMPS.heroXpPerPower));
    expect({ ...loot, Gold: undefined, HeroXp: undefined }).toMatchObject(campPay(state, WORLD_CAMPS.productionHoursPer1000Power));
  });
});
