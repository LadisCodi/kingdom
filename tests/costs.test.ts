// Every worked example from Docs/04-districts.md becomes an assertion.
import { describe, expect, it } from 'vitest';
import { buildCost, buildDuration, upgradeCost, upgradeDuration } from '../src/sim/districts';
import { gemRushCost } from '../src/sim/commands';

describe('build cost by instance (Docs/04 table)', () => {
  it('Housing: 75/20 → 133/35 → 444/118 → 954/254', () => {
    expect(buildCost('Housing', 0, 0)).toEqual({ Silver: 75, Wood: 20 });
    expect(buildCost('Housing', 1, 0)).toEqual({ Silver: 133, Wood: 35 });
    expect(buildCost('Housing', 2, 0)).toEqual({ Silver: 444, Wood: 118 });
    expect(buildCost('Housing', 3, 0)).toEqual({ Silver: 954, Wood: 254 });
  });
  it('Farm: 50/10 → 282/56 → 1039/207', () => {
    expect(buildCost('Farm', 0, 0)).toEqual({ Silver: 50, Wood: 10 });
    expect(buildCost('Farm', 1, 0)).toEqual({ Silver: 282, Wood: 56 });
    expect(buildCost('Farm', 2, 0)).toEqual({ Silver: 1039, Wood: 207 });
  });
  it('Sawmill: 50 → 546 → 1967', () => {
    expect(buildCost('Sawmill', 0, 0)).toEqual({ Silver: 50 });
    expect(buildCost('Sawmill', 1, 0)).toEqual({ Silver: 546 });
    expect(buildCost('Sawmill', 2, 0)).toEqual({ Silver: 1967 });
  });
  it('FarmLands: 20 → 91 → 298 → 633 → 1103 → 1717', () => {
    const expected = [20, 91, 298, 633, 1103, 1717];
    expected.forEach((wood, n) => expect(buildCost('FarmLands', n, 0)).toEqual({ Wood: wood }));
  });
  it('distance growth is off for all buildables (distMult = 1)', () => {
    expect(buildCost('Housing', 0, 7)).toEqual(buildCost('Housing', 0, 0));
  });
});

describe('build time (Docs/04 examples)', () => {
  it('1st Housing 2 tiles out = 26 s', () => expect(buildDuration('Housing', 0, 2)).toBe(26));
  it('2nd Housing 3 tiles out = 37 s', () => expect(buildDuration('Housing', 1, 3)).toBe(37));
  it('1st FarmLands 2 tiles out = 13 s', () => expect(buildDuration('FarmLands', 0, 2)).toBe(13));
});

describe('upgrade cost & time (Docs/04 examples)', () => {
  it('single Farm L1→L2 = 300 Silver + 50 Wood, 30 s', () => {
    expect(upgradeCost('Farm', 1, 1)).toEqual({ Silver: 300, Wood: 50 });
    expect(upgradeDuration('Farm', 1)).toBe(30);
  });
  it('single Sawmill L1→L2 = 300 / 30 s, L2→L3 = 450 / 45 s', () => {
    expect(upgradeCost('Sawmill', 1, 1)).toEqual({ Silver: 300 });
    expect(upgradeDuration('Sawmill', 1)).toBe(30);
    expect(upgradeCost('Sawmill', 1, 2)).toEqual({ Silver: 450 });
    expect(upgradeDuration('Sawmill', 2)).toBe(45);
  });
  it('with TWO Sawmill camps, each L1→L2 = 3278 Silver (count multiplier applies)', () => {
    expect(upgradeCost('Sawmill', 2, 1)).toEqual({ Silver: 3278 });
  });
  it('Townhall L1→L2 = 200 Silver + 25 Wood, instant', () => {
    expect(upgradeCost('Townhall', 1, 1)).toEqual({ Silver: 200, Wood: 25 });
    expect(upgradeDuration('Townhall', 1)).toBe(0);
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
