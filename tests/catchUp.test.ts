// The offline catch-up report (§5.12).
//
// deserialize() replays the whole absence — there is no offline cap — and
// reports what it made. Rent and hauls land in the buildings' stores, so the
// report has to agree with what is waiting there, not with the wallet.
import { describe, expect, it } from 'vitest';
import { DISTRICTS } from '../src/sim/data/definitions';
import { deserialize, serialize, type CatchUpReport } from '../src/sim/save';
import { getWallet } from '../src/sim/state';
import { addBuilt, freshGame, fund, map, stored, T0 } from './helpers';

const HOUR = 3_600_000;
/** Shorter than a level-1 store takes to fill (five minutes of its rent). */
const SHORT = 4 * 60_000;

/** A kingdom that earns while away: housed villagers paying rent. */
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
  it('accounts for every gold the stores gained, and leaves the wallet alone', () => {
    const { loaded, report } = reload(earningKingdom(), T0 + SHORT);

    expect(report).not.toBeNull();
    expect(report!.result.goldEarned).toBeGreaterThan(0);
    expect(stored(loaded, 'Gold')).toBe(report!.result.goldEarned);
    expect(getWallet(loaded.city.wallet, 'Gold')).toBe(0);
  });

  it('reports the whole absence it replayed', () => {
    const { report } = reload(earningKingdom(), T0 + SHORT);

    expect(report!.elapsedMs).toBe(SHORT);
    expect(report!.storesFull).toBe(false);
  });

  it('replays a long absence in full, and says when the stores filled', () => {
    const { loaded, report } = reload(earningKingdom(), T0 + 30 * HOUR);

    expect(report!.elapsedMs).toBe(30 * HOUR);
    expect(report!.storesFull).toBe(true);
    // Each house holds its level's capacity and no more: what bounds an
    // absence is the store, not a clock.
    for (const d of loaded.city.districts.filter((x) => x.definitionId === 'Housing')) {
      expect(d.stored?.Gold).toBe(DISTRICTS.Housing.storageCapacityPerLevel[0]);
    }
  });

  it('fires even for a blink, so the UI decides what is worth showing', () => {
    // The threshold is a presentation decision, not a sim one.
    const { report } = reload(earningKingdom(), T0 + 1000);

    expect(report).not.toBeNull();
    expect(report!.elapsedMs).toBe(1000);
  });
});
