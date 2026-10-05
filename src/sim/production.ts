// What the city makes of each coin a second, RIGHT NOW — the number every
// reward priced in production reads (`tap.workSeconds`'s rule, applied to a
// city instead of a cell): a treasure, a mission, a scout's pay, a chest.
//
// It reads the city's NOMINAL throughput (`cityGatherPerSecond`, travel and
// all), so a shed nobody works pays nothing and a maxed Sawmill pays a
// Sawmill's worth.

import type { CurrencyId, GameState } from './state';
import { cityGatherPerSecond } from './upgrades';
import { cityGoldPerMinute } from './population';

/** Gold a second, taxes and gatherers together. */
export const cityGoldPerSecond = (state: GameState): number =>
  cityGoldPerMinute(state) / 60 + cityGatherPerSecond(state, 'Gold');

/** What the city makes of `coin` a second: rent and gatherers for Gold, the
 *  gatherers alone for anything else. */
export const cityMakesPerSecond = (state: GameState, coin: CurrencyId): number =>
  coin === 'Gold' ? cityGoldPerSecond(state) : cityGatherPerSecond(state, coin);
