// What a city price asks in precious materials (Docs/features/19-world-map.md
// §7.6).
//
// Two kinds of term: named materials, which sit in a level's `goods` like any
// good, and `anyPrecious` — so many of ANY of the three, the early price that
// shows the mechanic. "Any" is resolved here into named materials, taken from
// what the player holds most of, so every check and payment downstream is an
// ordinary goods price.
//
// NEVER WHILE THE WORLD IS SHUT. A price asks for no precious material
// before the Watchtower opens the world: the only place they come from.

import { WORLD_BUILD } from './data/definitions';
import { watchtowerClaimed } from './landmarks';
import { getGood } from './goods';
import { PRECIOUS, type GameState, type GoodsStock, type PreciousId } from './state';

const isPrecious = (id: string): id is PreciousId => (PRECIOUS as readonly string[]).includes(id);

/** What a world upgrade's level costs in goods — a Fortress level's
 *  precious materials. */
export function worldUpgradeGoods(state: GameState, upgrade: keyof typeof WORLD_BUILD.upgrades, level: number): GoodsStock {
  const def = WORLD_BUILD.upgrades[upgrade]?.levels[level - 1];
  return def === undefined ? {} : resolvePrice(state, def.goods ?? {}, def.anyPrecious ?? 0);
}

/** Does a price ask for precious material yet? Only once the world is open. */
export const preciousAsked = (state: GameState): boolean => watchtowerClaimed(state);

/**
 * A goods price as the player pays it now: its named goods, its `anyPrecious`
 * resolved into the materials the player holds most of (after what the named
 * terms take), and — while the world is shut — no precious term at all.
 */
export function resolvePrice(state: GameState, goods: GoodsStock, anyPrecious = 0): GoodsStock {
  const asked = preciousAsked(state);
  const out: GoodsStock = {};
  for (const [id, n] of Object.entries(goods) as Array<[keyof GoodsStock, number]>) {
    if (n > 0 && (asked || !isPrecious(id))) out[id] = n;
  }
  if (!asked || anyPrecious <= 0) return out;
  let left = anyPrecious;
  // What each material has to spare once the named terms are paid, most first;
  // ties in the authored order, so the same holdings always pay the same way.
  const spare = PRECIOUS.map((id) => ({ id, n: Math.max(0, getGood(state.city.goods, id) - (out[id] ?? 0)) }))
    .sort((a, b) => b.n - a.n);
  for (const s of spare) {
    if (left <= 0) break;
    const take = Math.min(s.n, left);
    if (take > 0) out[s.id] = (out[s.id] ?? 0) + take;
    left -= take;
  }
  // Short: the rest is asked of the most-held, so the price shows it short.
  if (left > 0) out[spare[0].id] = (out[spare[0].id] ?? 0) + left;
  return out;
}
