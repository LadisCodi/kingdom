// Hero XP is easy early and hard late, and the big lump is a dungeon cleared
// to the bottom (Docs/features/10-heroes.md §4.2).

import { describe, expect, it } from 'vitest';
import { GARRISONS, HERO_LADDER, WORLD_DUNGEON } from '../src/sim/data/definitions';
import { xpLevelCost } from '../src/sim/heroLadder';
import { roomReward } from '../src/worldServer/core';

const toLevel = (n: number): number => {
  let total = 0;
  for (let l = 1; l < n; l += 1) total += xpLevelCost(l);
  return total;
};

describe('the Hero XP pacing', () => {
  it('gets dearer level by level, the last levels a hundred times the first', () => {
    expect(xpLevelCost(HERO_LADDER.heroMaxLevel - 1)).toBeGreaterThan(xpLevelCost(1) * 100);
  });

  it('carries a hero past its first ten levels on the first lair', () => {
    const tier1 = GARRISONS.find((g) => g.tier === 1)!.heroXp;
    expect(tier1).toBeGreaterThan(toLevel(10));
    const xp = GARRISONS.map((g) => g.heroXp);
    for (let i = 1; i < xp.length; i += 1) expect(xp[i]).toBeGreaterThan(xp[i - 1]!);
  });

  it('pays more for closing a dungeon than for all its rooms together', () => {
    let rooms = 0;
    for (let depth = 0; depth < WORLD_DUNGEON.depths; depth += 1) {
      for (let room = 1; room <= WORLD_DUNGEON.roomsPerDepth; room += 1) rooms += roomReward(depth, room).heroXp;
    }
    const last = roomReward(WORLD_DUNGEON.depths - 1, WORLD_DUNGEON.roomsPerDepth).heroXp;
    expect(last * WORLD_DUNGEON.closeHeroXpMultiplier).toBeGreaterThan(rooms);
  });
});
