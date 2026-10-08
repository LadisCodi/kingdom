// What the city's research adds to a fight's pay on the world board
// (Docs/features/19-world-map.md §5.4, §8.2, §10.3).
//
// The server prices a camp, a dungeon room or a Portal floor; the city
// collects it (game.ts, the 'loot' effect), so the Atlas's share on top is
// the city's own arithmetic, applied when the effect lands. Gems, packs and
// relic fragments are never multiplied.

import { roundPrice } from '../roundPrice';
import type { GameState } from '../state';
import { techMultiplier } from '../techEffects';
import type { WorldEffect } from '../../worldServer/types';

type Loot = Extract<WorldEffect, { kind: 'loot' }>;

/** Where a fight's pay was won. */
export type LootSource = 'camp' | 'room' | 'boss' | 'portal';

/** Where this pay came from: the server says so, but for a camp, which is
 *  told by the hours of production it pays. */
export const lootSource = (e: Loot): LootSource =>
  e.from ?? (e.hours !== undefined ? 'camp' : e.pack ? 'portal' : 'room');

/** How much more the research makes a fight of this kind pay. */
export function lootMultiplier(state: GameState, from: LootSource): number {
  const stat = from === 'camp' ? techMultiplier(state, 'campLoot')
    : from === 'portal' ? techMultiplier(state, 'portalLoot') : techMultiplier(state, 'dungeonLoot');
  return Math.max(1, stat);
}

/** How much more Hero XP any fight on the world board pays. */
export const worldHeroXpMultiplier = (state: GameState): number => Math.max(1, techMultiplier(state, 'worldHeroXp'));

/** A loot effect as the city collects it: every amount but Gems scaled by
 *  its source's share, Hero XP by the world's Hero XP share too, and every
 *  scaled amount rounded as a reward is. Unchanged with no research. */
export function boostLoot(state: GameState, e: Loot): Loot {
  const k = lootMultiplier(state, lootSource(e));
  const xp = k * worldHeroXpMultiplier(state);
  if (k === 1 && xp === 1) return e;
  const scale = (n: number, by: number): number => (n > 0 && by > 1 ? roundPrice(n * by) : n);
  return {
    ...e,
    gold: scale(e.gold, k),
    knowledge: scale(e.knowledge, k),
    stardust: scale(e.stardust, k),
    heroXp: scale(e.heroXp, xp),
    ...(e.hours !== undefined ? { hours: e.hours * k } : {}),
    ...(e.precious ? { precious: { ...e.precious, amount: scale(e.precious.amount, k) } } : {}),
  };
}
