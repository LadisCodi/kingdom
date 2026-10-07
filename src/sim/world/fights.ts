// What a fight on the world board costs and what a camp pays, on the
// client's side (Docs/features/19-world-map.md §4, §5.4; 08-magic.md §1).
//
// MANA IS THE ENERGY A FIGHT SPENDS: an army sent to a camp or a rival, a
// dungeon room, a Portal floor. Priced in hours of the city's own Mana regen
// (`world.fightManaHours`), so a full pool buys the same number of fights at
// every Sanctum level. The server never sees Mana: the client checks it,
// asks, and pays only once the server has said yes.
//
// A CAMP'S WOOD, FOOD AND STONE are owed by the server in hours
// (`hours` on its loot) and priced here, in the city's own production, when
// the army is home — the `tap.workSeconds` rule.

import { WORLD, WORLD_CAMPS } from '../data/definitions';
import { manaNetRegen } from '../mana';
import { cityMakesPerSecond } from '../production';
import { roundPrice } from '../roundPrice';
import type { GameState, Wallet } from '../state';

/** The Mana one fight on the board costs now; at least 1 while fights cost
 *  anything. */
export function fightMana(state: GameState): number {
  if (WORLD.fightManaHours <= 0) return 0;
  return Math.max(1, roundPrice(manaNetRegen(state) * WORLD.fightManaHours));
}

/** Does sending an army for `purpose` start a fight on arrival? A dungeon's
 *  and the Portal's fights are paid one room or floor at a time instead. */
export const sendFights = (purpose: string): boolean => purpose === 'clear' || purpose === 'attack';

/** What beating a camp of `power` pays now, before a hero's skills: Gold
 *  and Hero XP by its power, Wood, Food and Stone in hours of the city's
 *  production (19 §5.4). The server's loot is the one that counts. */
export function campLoot(state: GameState, power: number): Wallet {
  return {
    Gold: roundPrice(power * WORLD_CAMPS.goldPerPower),
    ...campPay(state, (power / 1000) * WORLD_CAMPS.productionHoursPer1000Power),
    HeroXp: roundPrice(power * WORLD_CAMPS.heroXpPerPower),
  };
}

/** The Wood, Food and Stone `hours` of the city's production comes to. */
export function campPay(state: GameState, hours: number): Wallet {
  const out: Wallet = {};
  if (!(hours > 0)) return out;
  for (const c of ['Wood', 'Food', 'Stone'] as const) {
    const n = roundPrice(cityMakesPerSecond(state, c) * hours * 3600);
    if (n > 0) out[c] = n;
  }
  return out;
}
