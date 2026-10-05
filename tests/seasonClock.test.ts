// The shared 28-day calendar (src/sim/seasonClock.ts).

import { describe, expect, it } from 'vitest';
import { PASS } from '../src/sim/data/definitions';
import { SEASON_EPOCH, seasonAt, seasonEndsAt, seasonStartsAt } from '../src/sim/seasonClock';

describe('the season clock', () => {
  it('runs on a shared calendar, with no state in the answer', () => {
    expect(seasonAt(SEASON_EPOCH)).toBe(0);
    expect(seasonStartsAt(0)).toBe(SEASON_EPOCH);
    const oneSeason = PASS.seasonDays * 86_400_000;
    expect(seasonEndsAt(0)).toBe(SEASON_EPOCH + oneSeason);
    expect(seasonAt(SEASON_EPOCH + oneSeason)).toBe(1);
    // A player arriving on the last day is in the same season as everyone
    // else — asked in fractions of a season, so the length stays a dial.
    expect(seasonAt(SEASON_EPOCH + oneSeason - 1)).toBe(0);
    expect(seasonAt(seasonEndsAt(7) - 1)).toBe(7);
    // A WHOLE NUMBER OF WEEKS, so a season always opens on the epoch's
    // weekday: the shared calendar is the argument for the whole feature and a
    // season that drifted through the week would undo it.
    expect(PASS.seasonDays % 7).toBe(0);
  });
});
