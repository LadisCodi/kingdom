// The day an instant falls in — the one calendar unit the sim reads.
//
// UTC, deliberately. A local-midnight rollover would make a daily cap depend
// on where the device thinks it is, so a player crossing a timezone could take
// a day's allowance twice or lose one — and the sim is not allowed to read
// anything that is not passed in.

const DAY_MS = 86_400_000;

/**
 * Which day an instant falls in.
 *
 * Derived from the instant every time, never stored as a counter that
 * something has to remember to increment — the same pull-based rule as
 * `isActive(m, state.lastAdvance)` and `recoverIfDue`, so a throttled tab or a
 * three-week absence resolves to the right number instead of drifting.
 */
export const dayIndex = (t: number): number => Math.floor(t / DAY_MS);
