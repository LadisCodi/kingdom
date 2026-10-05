// The shared 28-day calendar (Docs/features/20-season-pass.md).
//
// Seasons run back to back from `SEASON_EPOCH`, every player in the same one
// at the same time: floor division from the epoch, no state, so two clients
// never disagree about which season `t` falls in. The pass reads it; the card
// collection reads it until relics leave the season
// (Docs/plans/relics-and-bag.md).

import { PASS } from './data/definitions';

/**
 * 2026-01-05T00:00:00Z, a Monday, so a season always opens on one — which is
 * why the length is a whole number of weeks.
 */
export const SEASON_EPOCH = Date.UTC(2026, 0, 5);

export const SEASON_MS = (): number => PASS.seasonDays * 86_400_000;

/** Which occurrence of the shared calendar `t` falls in. */
export const seasonAt = (t: number): number =>
  Math.max(0, Math.floor((t - SEASON_EPOCH) / SEASON_MS()));

export const seasonStartsAt = (occurrence: number): number =>
  SEASON_EPOCH + occurrence * SEASON_MS();

/** The absolute instant this season ends — and the next one opens. */
export const seasonEndsAt = (occurrence: number): number =>
  seasonStartsAt(occurrence + 1);
