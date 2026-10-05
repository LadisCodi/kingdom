// BUYING TIME (Docs/features/14-monetization.md): one rule for every wait the
// player can finish with Gems — a build, a training line, an explorer's
// trip, a builder's work on the world board.

import { roundPrice } from './roundPrice';
import { RUSH } from './data/definitions';

/** Gems to finish a wait with `seconds` left: one per `rush.secondsPerGem`,
 *  rounded up, one at least. */
export const gemsToFinish = (seconds: number): number =>
  Math.max(1, roundPrice(Math.ceil(Math.max(0, seconds) / RUSH.secondsPerGem)));
