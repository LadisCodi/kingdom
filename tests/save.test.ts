import { describe, expect, it } from 'vitest';
import { changeWorkers, enqueueBuild } from '../src/sim/commands';
import { SAVE_VERSION } from '../src/sim/data/definitions';
import {
  deserialize, migrate, serialize, MIN_MIGRATABLE_VERSION,
} from '../src/sim/save';
import { getWallet } from '../src/sim/state';
import { addBuilt, completeTech, freshGame, fund, map, reveal, T0, tickAt } from './helpers';

const FOREST = { x: 2, y: 2 };
const SAWMILL = { x: 1, y: 2 }; // (1,1) is inside the 2x2 Townhall footprint

const workingGame = () => {
  const state = freshGame();
  state.city.population = 4;
  fund(state, { Gold: 500, Wood: 500, Food: 42 });
  completeTech(state, 'Forestry');
  reveal(state, [FOREST]);
  enqueueBuild(state, map, 'Sawmill', SAWMILL);
  tickAt(state, T0);
  tickAt(state, T0 + 30_000); // sawmill built (23s)
  changeWorkers(state, map, state.city.districts[1].uniqueId, 1, T0 + 30_000);
  state.army.push({ uniqueId: 'unit_1', definitionId: 'Archer' });
  return state;
};

describe('save round-trip', () => {
  it('restores wallets, districts, workers, harvest state, fog, army', () => {
    const state = workingGame();
    const t = T0 + 60_000;
    tickAt(state, t); // a few harvest cycles happened
    const woodAtSave = getWallet(state.city.wallet, 'Wood');
    expect(state.harvest['2,2'].taps).toBeGreaterThan(0);

    const restored = deserialize(serialize(state, t), map, t)!;
    expect(restored).not.toBeNull();
    expect(restored.city.wallet).toEqual(state.city.wallet);
    expect(restored.city.population).toBe(4);
    expect(restored.city.districts.map((d) => d.definitionId).sort()).toEqual(['Sawmill', 'Townhall']);
    expect(restored.workers).toHaveLength(1);
    expect(restored.workers[0].activity).toBe(state.workers[0].activity);
    expect(restored.harvest['2,2']).toEqual(state.harvest['2,2']);
    expect(restored.army).toEqual([{ uniqueId: 'unit_1', definitionId: 'Archer' }]);
    expect(restored.player.wallet.Gems).toBe(10);
    expect(getWallet(restored.city.wallet, 'Wood')).toBe(woodAtSave); // zero-time load adds nothing
  });

  it('v1 saves are rejected (fresh game)', () => {
    expect(
      deserialize({ LastSaved: new Date(T0).toISOString(), GameVersion: 'x', Modules: {} }, map, T0),
    ).toBeNull();
  });

  it('offline replay: an aged save accrues housing taxes and pays deliveries', () => {
    const state = workingGame();
    addBuilt(state, 'Housing', { x: 2, y: 0 }); // 1 of the 4 villagers moves in
    const saveAt = T0 + 30_000; // tax clock already anchored here by the ticks
    const gold = getWallet(state.city.wallet, 'Gold');
    const wood = getWallet(state.city.wallet, 'Wood');
    const restored = deserialize(serialize(state, saveAt), map, saveAt + 10 * 60_000)!;
    expect(getWallet(restored.city.wallet, 'Gold')).toBe(gold + 300); // 1 housed × 30/min × 10 min
    expect(getWallet(restored.city.wallet, 'Wood')).toBeGreaterThan(wood + 10); // spans a recovery window
  });

  it('offline replay matches a live-ticked session exactly (same horizon)', () => {
    const horizon = 20 * 60_000;
    const saveAt = T0 + 30_000;
    const offline = deserialize(serialize(workingGame(), saveAt), map, saveAt + horizon)!;
    const live = workingGame();
    for (let t = 1000; t <= horizon; t += 1000) tickAt(live, saveAt + t);
    expect(getWallet(offline.city.wallet, 'Wood')).toBe(getWallet(live.city.wallet, 'Wood'));
    expect(getWallet(offline.city.wallet, 'Gold')).toBe(getWallet(live.city.wallet, 'Gold'));
  });

  it('the 8h offline cap: a 20h absence earns exactly what 8h earns; queue still completes', () => {
    const mk = () => {
      const s = workingGame();
      fund(s, { Gold: 5000, Wood: 5000 });
      enqueueBuild(s, map, 'Housing', { x: 2, y: 0 });
      return serialize(s, T0 + 30_000);
    };
    const capped = deserialize(mk(), map, T0 + 30_000 + 20 * 3_600_000)!;
    const exact8h = deserialize(mk(), map, T0 + 30_000 + 8 * 3_600_000)!;
    expect(getWallet(capped.city.wallet, 'Wood')).toBe(getWallet(exact8h.city.wallet, 'Wood'));
    expect(getWallet(capped.city.wallet, 'Gold')).toBe(getWallet(exact8h.city.wallet, 'Gold'));
    // The queued Housing finished regardless of the cap.
    expect(capped.city.districts.find((d) => d.definitionId === 'Housing')!.state).toBe('Built');
    // Workers resume from "now", not from 12h ago.
    const w = capped.workers[0];
    expect(w.stateUntil === null || w.stateUntil > T0 + 30_000 + 20 * 3_600_000 - 60_000).toBe(true);
  });
});

// The migration chain (Docs/features/engine-seams.md §4). Additive changes
// need no migrator — a version bump plus the defensive readers is enough —
// so this covers the two gates that DO have to hold on every bump.
describe('save versions', () => {
  it('rejects a save written by a newer client', () => {
    const save = serialize(freshGame(), T0);
    save.SaveVersion = SAVE_VERSION + 1;
    expect(deserialize(save, map, T0)).toBeNull();
  });

  it('rejects anything below MIN_MIGRATABLE_VERSION', () => {
    const save = serialize(freshGame(), T0);
    save.SaveVersion = MIN_MIGRATABLE_VERSION - 1;
    expect(deserialize(save, map, T0)).toBeNull();
  });

  it('carries a current save through the chain unchanged', () => {
    const save = serialize(freshGame(), T0);
    expect(migrate(save)).toBe(true);
    expect(save.SaveVersion).toBe(SAVE_VERSION);
  });
});
