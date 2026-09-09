// Every worked example from Docs/features/05-city-and-districts.md becomes an assertion.
import { describe, expect, it } from 'vitest';
import { freshGame } from './helpers';
import {
  LATE_FROM, buildCost, buildDuration, upgradeCost, upgradeDuration,
} from '../src/sim/districts';
import { DISTRICTS } from '../src/sim/data/definitions';
import type { DistrictId } from '../src/sim/state';
import { gemRushCost } from '../src/sim/commands';

describe('build cost by instance (Docs/04 table)', () => {
  it('Housing: 10 → 26 → 83 → 172 Wood', () => {
    expect(buildCost('Housing', 0)).toEqual({ Wood: 10 });
    expect(buildCost('Housing', 1)).toEqual({ Wood: 26 });
    expect(buildCost('Housing', 2)).toEqual({ Wood: 83 });
    expect(buildCost('Housing', 3)).toEqual({ Wood: 172 });
  });
  it('Farm: 30 → 169 → 623 Wood', () => {
    expect(buildCost('Farm', 0)).toEqual({ Wood: 30 });
    expect(buildCost('Farm', 1)).toEqual({ Wood: 169 });
    expect(buildCost('Farm', 2)).toEqual({ Wood: 623 });
  });
  it('Sawmill: 20 → 110 → 353 Wood', () => {
    expect(buildCost('Sawmill', 0)).toEqual({ Wood: 20 });
    expect(buildCost('Sawmill', 1)).toEqual({ Wood: 110 });
    expect(buildCost('Sawmill', 2)).toEqual({ Wood: 353 });
  });
  // The cheapest thing in the game, deliberately: a crop plot is a furrow,
  // and at 20 Wood it cost twice a House — which stranded the player at
  // onboarding step 10 with nothing left after the roof.
  it('FarmLands: 10 → 45 → 149 → 316 → 551 → 858', () => {
    const expected = [10, 45, 149, 316, 551, 858];
    expected.forEach((wood, n) => expect(buildCost('FarmLands', n)).toEqual({ Wood: wood }));
  });
});

describe('build time (Docs/04 examples)', () => {
  const base = freshGame(); // no Carpentry: the authored numbers, unmodified
  it('1st Housing 2 tiles out = 26 s', () => expect(buildDuration(base, 'Housing', 0, 2)).toBe(26));
  it('2nd Housing 3 tiles out = 37 s', () => expect(buildDuration(base, 'Housing', 1, 3)).toBe(37));
  it('1st FarmLands 2 tiles out = 13 s', () => expect(buildDuration(base, 'FarmLands', 0, 2)).toBe(13));
});

describe('upgrade cost & time (Docs/04 examples)', () => {
  const base = freshGame();
  it('single Farm L1→L2 = 50 Wood, 30 s', () => {
    expect(upgradeCost('Farm', 1, 1)).toEqual({ Wood: 50 });
    expect(upgradeDuration(base, 'Farm', 1)).toBe(30);
  });
  it('Sawmill upgrades: 60 then 150 Wood, 30 s then 45 s', () => {
    expect(upgradeCost('Sawmill', 1, 1)).toEqual({ Wood: 60 });
    expect(upgradeDuration(base, 'Sawmill', 1)).toBe(30);
    expect(upgradeCost('Sawmill', 1, 2)).toEqual({ Wood: 150 });
    expect(upgradeDuration(base, 'Sawmill', 2)).toBe(45);
  });
  // Wood ONLY, deliberately: the onboarding chain reaches Townhall 2 before
  // it reaches the Quarry (Docs/features/12-quests.md §2 (quest 35)), and
  // an upgrade that asks for Stone the player has no building for is a wall,
  // not a goal.
  it('Townhall L1→L2 = 60 Wood in 30 s; L2→L3 = 234 Wood in 120 s', () => {
    expect(upgradeCost('Townhall', 1, 1)).toEqual({ Wood: 60 });
    expect(upgradeDuration(base, 'Townhall', 1)).toBe(30);
    expect(upgradeCost('Townhall', 1, 2)).toEqual({ Wood: 234 });
    expect(upgradeDuration(base, 'Townhall', 2)).toBe(120);
  });
  it('Housing L1→L2 = 30 Wood + 10 Stone in 20 s', () => {
    expect(upgradeCost('Housing', 1, 1)).toEqual({ Wood: 30, Stone: 10 });
    expect(upgradeDuration(base, 'Housing', 1)).toBe(20);
  });
});

// The late half of the ladder (Docs/plans/builder-30-days.md §4). The early
// examples above are the proof it did not move: they are the same numbers
// they were before the pivot existed.
describe('the late curve, from level 6', () => {
  const base = freshGame();
  const LATE: readonly DistrictId[] = (Object.keys(DISTRICTS) as DistrictId[])
    .filter((id) => DISTRICTS[id].maxLevel >= LATE_FROM);

  it('reaches the late city on sixteen buildings, and stops on the rest', () => {
    // Nine producers and halls, the Infirmary, the four workshops — and the
    // Townhall, whose ladder landed with step 7. The crop plot is a cell
    // rather than a building, and the six decorations have one level each.
    expect(LATE.length).toBe(16);
    expect(DISTRICTS.Townhall.maxLevel).toBe(10);
    expect(DISTRICTS.FarmLands.maxLevel).toBe(1);
  });

  it('grows every late level by ×1.7, the pivot included', () => {
    for (const id of LATE) {
      const wood = (level: number) => {
        const cost = upgradeCost(id, 1, level);
        return Object.values(cost).reduce((a, b) => a + b, 0);
      };
      for (let level = LATE_FROM - 1; level < DISTRICTS[id].maxLevel; level++) {
        // Floors, so compare the ratio rather than the exact integer.
        expect(wood(level) / wood(level - 1), `${id} level ${level + 1}`)
          .toBeCloseTo(1.7, 1);
      }
    }
  });

  it('waits two hours for level 6 and about seventeen for level 10', () => {
    for (const id of LATE) {
      if (id === 'Townhall') continue; // twice a district's — below
      expect(upgradeDuration(base, id, LATE_FROM - 1), `${id} level 6`).toBe(7200);
      expect(upgradeDuration(base, id, 9) / 3600, `${id} level 10`).toBeCloseTo(16.7, 1);
    }
  });

  it('makes the Townhall wait far longer than a district: six hours at 6, four days at 10', () => {
    // The Townhall is the clock every other ladder hangs from, so its late
    // wait starts at 6 h and DOUBLES a level — 12, 24, 48, 96 h — which is
    // what puts levels 8, 9 and 10 in weeks 3 and 4 (buildings.md §3.1).
    expect(upgradeDuration(base, 'Townhall', LATE_FROM - 1)).toBe(21_600);
    expect(upgradeDuration(base, 'Townhall', 7) / 3600).toBeCloseTo(24, 0);
    expect(upgradeDuration(base, 'Townhall', 9) / 3600).toBeCloseTo(96, 0);
  });

  it('is the only thing the pivot changes: every level below it is the old curve', () => {
    // The early columns alone, computed here rather than read from the sim.
    for (const id of LATE) {
      const def = DISTRICTS[id];
      for (let level = 1; level < LATE_FROM - 1; level++) {
        expect(upgradeDuration(base, id, level), `${id} level ${level + 1}`).toBe(
          Math.round(def.upgradeDurationSeconds * def.upgradeDurationLevelGrowth ** (level - 1)),
        );
      }
    }
  });
});

describe('gem rush cost (Docs/06)', () => {
  it('RUSH.secondsPerGem seconds per gem (5), minimum 1', () => {
    const now = 1_000_000;
    const item = {
      uniqueId: 'x', kind: 'build' as const, districtUniqueId: 'd',
      durationSeconds: 95, startedAt: now,
    };
    expect(gemRushCost(item, now)).toBe(19); // ceil(95/5)
    expect(gemRushCost(item, now + 94_000)).toBe(1); // 1s left
    expect(gemRushCost(item, now + 95_000)).toBe(1); // 0s left → still min 1
  });
});
