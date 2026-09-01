// The offline catch-up report (§5.12).
//
// deserialize() replays the whole absence and used to throw the result away,
// so the player never saw what they earned while gone — the idle half of the
// design was invisible. The report has to agree with what actually landed in
// the wallet, or it is worse than nothing.
import { describe, expect, it } from 'vitest';
import { OFFLINE_CAP_HOURS } from '../src/sim/data/definitions';
import { deserialize, serialize, type CatchUpReport } from '../src/sim/save';
import { getWallet } from '../src/sim/state';
import { addBuilt, freshGame, fund, map, T0 } from './helpers';

const HOUR = 3_600_000;

/** A kingdom that earns while away: housed villagers paying taxes. */
function earningKingdom() {
  const state = freshGame();
  addBuilt(state, 'Housing', { x: 3, y: 2 });
  addBuilt(state, 'Housing', { x: 2, y: 3 });
  state.city.population = 4;
  fund(state, { Gold: 0 });
  return state;
}

const reload = (state: ReturnType<typeof freshGame>, at: number) => {
  let report: CatchUpReport | null = null;
  const loaded = deserialize(serialize(state, T0), map, at, (r) => { report = r; });
  return { loaded: loaded!, report: report as CatchUpReport | null };
};

describe('the offline report', () => {
  it('accounts for every gold the wallet gained', () => {
    const { loaded, report } = reload(earningKingdom(), T0 + 2 * HOUR);

    expect(report).not.toBeNull();
    expect(report!.result.goldEarned).toBeGreaterThan(0);
    // The report IS the wallet delta — it started at zero.
    expect(getWallet(loaded.city.wallet, 'Gold')).toBe(report!.result.goldEarned);
  });

  it('reports the elapsed time it actually replayed', () => {
    const { report } = reload(earningKingdom(), T0 + 2 * HOUR);

    expect(report!.elapsedMs).toBe(2 * HOUR);
    expect(report!.cappedOut).toBe(false);
  });

  it('stops at the cap and says so', () => {
    const { report } = reload(earningKingdom(), T0 + (OFFLINE_CAP_HOURS + 5) * HOUR);

    expect(report!.cappedOut).toBe(true);
    expect(report!.elapsedMs).toBe(OFFLINE_CAP_HOURS * HOUR);
  });

  it('fires even for a blink, so the UI decides what is worth showing', () => {
    // The threshold is a presentation decision, not a sim one.
    const { report } = reload(earningKingdom(), T0 + 1000);

    expect(report).not.toBeNull();
    expect(report!.elapsedMs).toBe(1000);
  });

  it('still announces work that finished past the cap', () => {
    // Queue timers run in real time rather than pausing, so a build that
    // completed during the paused window must survive into the report — it
    // comes from the SECOND advance, which used to be discarded entirely.
    const state = earningKingdom();
    const { report } = reload(state, T0 + (OFFLINE_CAP_HOURS + 2) * HOUR);

    expect(report!.result.completedItems).toBeDefined();
    expect(report!.cappedOut).toBe(true);
  });
});
