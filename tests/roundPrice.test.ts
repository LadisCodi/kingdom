// Calculated costs and rewards read as three significant figures (sim/roundPrice.ts).
import { describe, expect, it } from 'vitest';
import { roundPrice } from '../src/sim/roundPrice';
import { DISTRICTS, HERO_LADDER, WORLD_DUNGEON, WORLD_PORTAL } from '../src/sim/data/definitions';
import { levelCost } from '../src/sim/districts';
import { populationCost } from '../src/sim/population';
import { gemsToFinish } from '../src/sim/rush';
import { ascensionStardustCost } from '../src/sim/heroes';
import { claimGold, floorReward, roomReward } from '../src/worldServer/core';
import type { DistrictId } from '../src/sim/state';
import { tierCost, xpLevelCost } from '../src/sim/heroLadder';

describe('a calculated number is rounded to what a player can read back', () => {
  it('keeps three significant figures, and a whole number below 1,000', () => {
    const cases: Array<[number, number]> = [
      [1, 1], [12, 12], [123, 123], [1234, 1230], [12345, 12300], [123456, 123000], [1234567, 1230000],
      [0, 0], [0.4, 0], [12.6, 13], [999.4, 999], [999.6, 1000], [15_847, 15_800], [99_960, 100_000],
    ];
    for (const [n, want] of cases) expect(roundPrice(n), `${n}`).toBe(want);
  });
});

// EVERY CALCULATED PRICE AND REWARD comes out already rounded: a sweep over
// the curves, at many steps each.

const isRound = (n: number): boolean => roundPrice(n) === n;

describe('the curves pay and charge round numbers', () => {
  it('prices every later instance of every building in three figures', () => {
    for (const id of Object.keys(DISTRICTS) as DistrictId[]) {
      for (let ordinal = 2; ordinal <= 12; ordinal++) {
        for (let level = 1; level <= DISTRICTS[id].costPerLevel.length; level++) {
          for (const [c, n] of Object.entries(levelCost(id, ordinal, level))) {
            expect(isRound(n as number), `${id} #${ordinal} L${level} ${c} ${n}`).toBe(true);
          }
        }
      }
    }
  });

  it('rounds the villagers, the world claims, the rush and the heroes', () => {
    for (let p = 0; p < 300; p++) expect(isRound(populationCost(p)), `population ${p}`).toBe(true);
    for (let h = 0; h < 40; h++) expect(isRound(claimGold(h)), `claim ${h}`).toBe(true);
    for (let s = 0; s < 400_000; s += 997) expect(isRound(gemsToFinish(s)), `rush ${s}`).toBe(true);
    for (let t = 1; t <= HERO_LADDER.maxTier; t++) {
      expect(isRound(ascensionStardustCost(t)), `ascension ${t}`).toBe(true);
      expect(isRound(tierCost(t)), `tier ${t}`).toBe(true);
    }
    for (let l = 1; l <= HERO_LADDER.heroMaxLevel; l++) expect(isRound(xpLevelCost(l)), `xp ${l}`).toBe(true);
  });

  it('rounds what a dungeon room and a Portal floor pay', () => {
    for (let depth = 0; depth < WORLD_DUNGEON.depths; depth++) {
      for (let room = 1; room <= WORLD_DUNGEON.roomsPerDepth; room++) {
        for (const [k, n] of Object.entries(roomReward(depth, room))) expect(isRound(n), `room ${depth}/${room} ${k}`).toBe(true);
      }
    }
    for (let f = 1; f <= WORLD_PORTAL.floors; f++) {
      for (const [k, n] of Object.entries(floorReward(f))) if (typeof n === 'number') expect(isRound(n), `floor ${f} ${k}`).toBe(true);
    }
  });
});
