import { describe, expect, it } from 'vitest';
import { populationCost } from '../src/sim/population';

describe('population cost (Docs/05 table)', () => {
  it('round(5 × 1.45^(pop − 1)) from pop 2 through 10', () => {
    const expected = [7, 11, 15, 22, 32, 46, 67, 98, 142]; // buying 3rd..11th point
    expected.forEach((cost, i) => expect(populationCost(2 + i)).toBe(cost));
  });
});
