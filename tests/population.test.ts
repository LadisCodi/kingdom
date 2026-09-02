// Villager pricing (Docs/05): authored for the opening, exponential after it.
//
// The first handful of villagers ARE the early game — each is a decision the
// player makes minutes apart — so their prices are hand-written rather than
// sampled off a curve. A pure `base × growth^n` could not say 5, 20, 100, 300
// without deforming everything past it, which is exactly the grip the designer
// wanted at the start.
import { describe, expect, it } from 'vitest';
import { CITY_DEF } from '../src/sim/data/definitions';
import { populationCost } from '../src/sim/population';

describe('population cost (Docs/05)', () => {
  it('pays the authored ladder for the first villagers, in order', () => {
    expect(CITY_DEF.populationCostFirst).toEqual([5, 20, 100, 300, 500, 1000]);
    CITY_DEF.populationCostFirst.forEach((cost, i) => {
      expect(populationCost(i), `villager ${i + 1}`).toBe(cost);
    });
  });

  it('hands over to the curve from the LAST authored price, with no step', () => {
    const authored = CITY_DEF.populationCostFirst;
    const last = authored[authored.length - 1];
    const first = populationCost(authored.length);

    // Continuous: the first curved price is one growth step past the last
    // authored one, not a jump back to some base.
    expect(first).toBe(Math.round(last * CITY_DEF.populationCostGrowth));
    expect(first).toBeGreaterThan(last);

    // ...and it keeps climbing at the authored rate from there.
    for (let n = authored.length; n < authored.length + 5; n++) {
      expect(populationCost(n + 1) / populationCost(n))
        .toBeCloseTo(CITY_DEF.populationCostGrowth, 1);
    }
  });

  it('never goes backwards', () => {
    for (let n = 1; n < 20; n++) {
      expect(populationCost(n), `villager ${n + 1}`)
        .toBeGreaterThan(populationCost(n - 1));
    }
  });
});
