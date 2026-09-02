// The type system is the art checklist.
//
// ICON_EMOJI is exhaustive over IconName by construction, so adding a
// currency or district without a glyph already fails tsc. What tsc cannot
// see is the ATLAS: a new currency compiles fine and then renders as emoji
// next to a dozen pixel icons, which nobody notices in review.
//
// Runs in node — atlas.generated.ts is deliberately DOM-free.
import { describe, expect, it } from 'vitest';
import { ICON_INDEX } from '../src/ui/kit/atlas.generated';
import { ICON_EMOJI } from '../src/ui/kit/icon';
import { CURRENCIES, DISTRICTS } from '../src/sim/data/definitions';

const cells = new Set(Object.keys(ICON_INDEX));
/** Cells the tool derived rather than an artist drawing them. */
const isDerived = (cell: string) => /-(sm|locked)$/.test(cell);

/**
 * Content that has shipped in the sim but is still WAITING for its sheet.
 *
 * This list is the honest version of "the art is coming": it keeps every gate
 * below live for everything else — nothing already drawn can silently vanish —
 * while making the outstanding ask reviewable in one place instead of hiding
 * in a green test run.
 *
 * `noPendingArtIsAlreadyDrawn` is what stops it rotting: the moment a sheet
 * lands, leaving the name here fails.
 */
const AWAITING_ART: readonly string[] = [
  'Mana', 'Sanctum',
];

const pending = new Set(AWAITING_ART);
const outstanding = (missing: string[]): string[] => missing.filter((n) => !pending.has(n));

describe('the icon atlas', () => {
  it('ships no cell the kit cannot name', () => {
    // Catches a typo in the manifest, which would otherwise pack a cell that
    // no call site can ever reach.
    const known = new Set(Object.keys(ICON_EMOJI));
    const orphans = [...cells]
      .map((c) => c.replace(/-(sm|locked)$/, '').replace(/-sm$/, ''))
      .filter((base) => !known.has(base));
    expect([...new Set(orphans)]).toEqual([]);
  });

  it('every currency has art', () => {
    const missing = (Object.keys(CURRENCIES) as Array<keyof typeof CURRENCIES>)
      .filter((c) => !cells.has(c));
    expect(outstanding(missing)).toEqual([]);
  });

  it('every district has art', () => {
    const missing = Object.keys(DISTRICTS).filter((d) => !cells.has(d));
    expect(outstanding(missing)).toEqual([]);
  });

  it('everything that can be gated has a locked variant', () => {
    // Currencies and districts are the things the UI greys out. Pure symbols
    // (a plus sign, a tick) never lock, and the manifest excludes them.
    const gateable = [...Object.keys(CURRENCIES), ...Object.keys(DISTRICTS)];
    const missing = gateable.filter((n) => !cells.has(`${n}-locked`));
    expect(outstanding(missing)).toEqual([]);
  });

  it('every currency has a 16px variant, since costs render inline', () => {
    const missing = (Object.keys(CURRENCIES) as Array<keyof typeof CURRENCIES>)
      .filter((c) => !cells.has(`${c}-sm`));
    expect(outstanding(missing)).toEqual([]);
  });

  it('the drawn set covers every name the kit can ask for', () => {
    // The remaining gap, stated rather than assumed: these still fall back to
    // emoji, and the fallback is deliberate — not an oversight.
    const drawn = new Set([...cells].filter((c) => !isDerived(c)));
    const stillEmoji = Object.keys(ICON_EMOJI).filter((n) => !drawn.has(n));
    expect(outstanding(stillEmoji)).toEqual([]);
  });

  it('the pending list has not rotted — nothing on it is already drawn', () => {
    expect(AWAITING_ART.filter((n) => cells.has(n))).toEqual([]);
  });
});
