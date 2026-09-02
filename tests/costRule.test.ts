// A price lives inside the button that spends it
// (Docs/art/ui-menus-redesign.md §6.4).
//
// The claim these tests protect is that affordability is a COLOUR, not a
// sentence — and, more importantly, that it is not *only* a colour. The old
// layout made every screen decide for itself whether to disable a button it
// had just priced, and they each did it by hand with a `Short 28 Wood` string.
// Now `cost` + `have` is one contract that yields the price, the red and the
// disabled state together, so a screen cannot show a price it will not
// enforce, or refuse a press it never explained.
//
// Node env, no jsdom, so this tests the DECISION rather than the markup: the
// rendering is verified in the browser, the rule is verified here.
import { describe, expect, it } from 'vitest';
import { isShort } from '../src/ui/kit/stats';

describe('a cost the player cannot pay', () => {
  const have = (wallet: Record<string, number>) => (c: string) => wallet[c] ?? 0;

  it('is short when any single term is beyond the purse', () => {
    const cost = { Wood: 40, Stone: 20 };
    expect(isShort(cost, have({ Wood: 40, Stone: 20 }))).toBe(false);
    expect(isShort(cost, have({ Wood: 39, Stone: 20 }))).toBe(true);
    expect(isShort(cost, have({ Wood: 40, Stone: 19 }))).toBe(true);
    // Rich in one thing and poor in another is still short: a cost is paid
    // whole or not at all, which is why EVERY term is checked and only the
    // failing one turns clay.
    expect(isShort(cost, have({ Wood: 9999, Stone: 0 }))).toBe(true);
  });

  it('is never short when nothing is being charged', () => {
    expect(isShort({}, have({}))).toBe(false);
    // A zero term is not a debt. It is filtered out of the row entirely, so
    // it must not be able to disable the button either.
    expect(isShort({ Gold: 0 }, have({ Gold: 0 }))).toBe(false);
  });

  it('cannot judge affordability without being told what the player has', () => {
    // The gallery prices specimens with no wallet behind them. Those must
    // render as prices, not as refusals.
    expect(isShort({ Gold: 999999 }, undefined)).toBe(false);
  });
});
