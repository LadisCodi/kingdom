// HOLD TO REPEAT (src/ui/kit/holdRepeat.ts): a held Train presses itself,
// faster the longer it is held, up to a ceiling.
import { describe, expect, it } from 'vitest';
import { holdRate } from '../src/ui/kit/holdRepeat';

describe('the hold rate', () => {
  it('starts slow, climbs, and stops climbing at its ceiling', () => {
    const start = holdRate(0);
    expect(start).toBeGreaterThan(0);
    expect(holdRate(1000)).toBeGreaterThan(start);
    const top = holdRate(60_000);
    expect(holdRate(10_000)).toBe(top);
    expect(top).toBeGreaterThan(holdRate(1000));
  });
});
