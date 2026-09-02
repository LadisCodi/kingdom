// Every worked example from Docs/04-districts.md becomes an assertion.
import { describe, expect, it } from 'vitest';
import { buildCost, buildDuration, upgradeCost, upgradeDuration } from '../src/sim/districts';
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
  it('1st Housing 2 tiles out = 26 s', () => expect(buildDuration('Housing', 0, 2)).toBe(26));
  it('2nd Housing 3 tiles out = 37 s', () => expect(buildDuration('Housing', 1, 3)).toBe(37));
  it('1st FarmLands 2 tiles out = 13 s', () => expect(buildDuration('FarmLands', 0, 2)).toBe(13));
});

describe('upgrade cost & time (Docs/04 examples)', () => {
  it('single Farm L1→L2 = 50 Wood, 30 s', () => {
    expect(upgradeCost('Farm', 1, 1)).toEqual({ Wood: 50 });
    expect(upgradeDuration('Farm', 1)).toBe(30);
  });
  it('Sawmill upgrades: 60 then 150 Wood, 30 s then 45 s', () => {
    expect(upgradeCost('Sawmill', 1, 1)).toEqual({ Wood: 60 });
    expect(upgradeDuration('Sawmill', 1)).toBe(30);
    expect(upgradeCost('Sawmill', 1, 2)).toEqual({ Wood: 150 });
    expect(upgradeDuration('Sawmill', 2)).toBe(45);
  });
  // Wood ONLY, deliberately: the onboarding chain reaches Townhall 2 before
  // it reaches the Quarry (Docs/onboarding.md, woven in around step 14), and
  // an upgrade that asks for Stone the player has no building for is a wall,
  // not a goal.
  it('Townhall L1→L2 = 60 Wood in 30 s; L2→L3 = 234 Wood in 120 s', () => {
    expect(upgradeCost('Townhall', 1, 1)).toEqual({ Wood: 60 });
    expect(upgradeDuration('Townhall', 1)).toBe(30);
    expect(upgradeCost('Townhall', 1, 2)).toEqual({ Wood: 234 });
    expect(upgradeDuration('Townhall', 2)).toBe(120);
  });
  it('Housing L1→L2 = 30 Wood + 10 Stone in 20 s', () => {
    expect(upgradeCost('Housing', 1, 1)).toEqual({ Wood: 30, Stone: 10 });
    expect(upgradeDuration('Housing', 1)).toBe(20);
  });
});

describe('gem rush cost (Docs/06)', () => {
  it('10 seconds per gem, minimum 1', () => {
    const now = 1_000_000;
    const item = {
      uniqueId: 'x', kind: 'build' as const, districtUniqueId: 'd',
      durationSeconds: 95, startedAt: now,
    };
    expect(gemRushCost(item, now)).toBe(10); // ceil(95/10)
    expect(gemRushCost(item, now + 94_000)).toBe(1); // 1s left
    expect(gemRushCost(item, now + 95_000)).toBe(1); // 0s left → still min 1
  });
});
