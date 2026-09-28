// What a building's card promises. DOM-free on purpose, like
// `kit/atlas.generated.ts`: `tests/buildPromise.test.ts` imports it under
// node to hold every line to the budget, and `buildMenu.ts` cannot be
// imported there — it reaches for the document.

import { DISTRICTS } from '../sim/data/definitions';
import type { DistrictId } from '../sim/state';

/**
 * WHAT THE CARD PROMISES — one line, present tense, what it does for you.
 *
 * Not `def.description`, which this used to fall back to: that is the long
 * form the district card and the upgrade sheet show, where 91 characters read
 * fine. The build card holds about 42, so the fallback was a paragraph cut
 * off mid-word on thirteen of the twenty-three buildings.
 *
 * So there is no fallback any more — EVERY building has a `promise` of its
 * own in `data/game/buildings.json`, the schema holds it to the budget as it
 * is typed in ?dev=data, and `tests/buildPromise.test.ts` keeps it that way. A building that gains a level, a crew or a recipe keeps its
 * promise; only what it DOES for the player changes it.
 *
 * The decorations say what they are and stop. What they do — the Harmony they
 * supply — is the chip beside the price, so a line repeating the number would
 * be the card saying it twice.
 */
export const PROMISE: Record<DistrictId, string> = Object.fromEntries(
  Object.entries(DISTRICTS).map(([id, d]) => [id, d.promise]),
) as Record<DistrictId, string>;

/** What the build card can show without cutting a word in half. Measured:
 *  three lines of about fourteen characters in the 87px the text column has
 *  at 426, which is the phone the mockups were drawn for. */
export const PROMISE_MAX = 42;
