// The type system is the art checklist.
//
// ICON_EMOJI is exhaustive over IconName by construction, so adding a
// currency or district without a glyph already fails tsc. What tsc cannot
// see is the ATLAS: a new currency compiles fine and then renders as emoji
// next to eleven pixel icons, which nobody notices in review.
//
// Runs in node — atlas.generated.ts is deliberately DOM-free.
import { describe, expect, it } from 'vitest';
import { ICON_INDEX } from '../src/ui/kit/atlas.generated';
import { ICON_EMOJI } from '../src/ui/kit/icon';
import { CURRENCIES, DISTRICTS } from '../src/sim/data/definitions';

const cells = new Set(Object.keys(ICON_INDEX));

describe('the icon atlas', () => {
  it('every cell it ships is a name the kit knows', () => {
    // Catches a typo in the manifest, which would otherwise pack a cell no
    // call site can ever reach.
    const known = new Set(Object.keys(ICON_EMOJI));
    const orphans = [...cells]
      .map((c) => c.replace(/-(sm|locked|sm-locked)$/, ''))
      .filter((base) => !known.has(base));
    expect([...new Set(orphans)]).toEqual([]);
  });

  it('every currency has a cell, or is knowingly still on emoji', () => {
    // Not a hard requirement yet — sheets land one at a time. This asserts
    // the CURRENT state so adding a currency without art is a visible diff
    // rather than a silent downgrade.
    const missing = (Object.keys(CURRENCIES) as Array<keyof typeof CURRENCIES>)
      .filter((c) => !cells.has(c));
    expect(missing).toEqual(['Meat']); // UI-A had twelve slots; Meat waits for UI-C
  });

  it('districts are all still on emoji — UI-B has not been generated', () => {
    const withArt = Object.keys(DISTRICTS).filter((d) => cells.has(d));
    expect(withArt).toEqual([]);
  });

  it('a locked variant exists for every drawn icon that can be gated', () => {
    const drawn = [...cells].filter((c) => !c.includes('-'));
    const missingLocked = drawn.filter((c) => !cells.has(`${c}-locked`));
    expect(missingLocked).toEqual([]);
  });
});
