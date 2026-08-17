import { describe, expect, it } from 'vitest';
import { enqueueBuild } from '../src/sim/commands';
import { deserialize, serialize } from '../src/sim/save';
import { coordKey, townhall } from '../src/sim/state';
import { freshGame, fund, map, reveal, rng, T0, tickAt } from './helpers';

describe('save round-trip', () => {
  it('restores wallets, population, districts, queue, fog, features, army', () => {
    const state = freshGame();
    fund(state, { Silver: 500, Wood: 500, Food: 42 });
    reveal(state, [{ x: 2, y: 2 }]);
    state.fog.progress['3,0'] = 2;
    state.city.population = 5;
    state.army.push({ uniqueId: 'unit_1', definitionId: 'Archer' });
    state.features['2,2'].taps = 3;
    state.features['2,2'].threshold = 7;
    expect(enqueueBuild(state, map, 'Lumber', { x: 1, y: 1 }, T0, rng)).toBe('Started');
    tickAt(state, T0); // start the build so StartedAtUtc is persisted

    const restored = deserialize(serialize(state, T0 + 1000), map, T0 + 2000, rng);

    expect(restored.city.wallet).toEqual(state.city.wallet);
    expect(restored.city.population).toBe(5);
    expect(restored.city.districts.map((d) => d.definitionId).sort()).toEqual(['Lumber', 'Townhall']);
    expect(restored.city.queue).toHaveLength(1);
    expect(restored.city.queue[0].startedAt).toBe(state.city.queue[0].startedAt);
    expect(Object.keys(restored.fog.revealed).sort()).toEqual(Object.keys(state.fog.revealed).sort());
    expect(restored.fog.progress['3,0']).toBe(2);
    expect(restored.features['2,2']).toEqual({ featureId: 'Trees', taps: 3, threshold: 7 });
    expect(restored.army).toEqual([{ uniqueId: 'unit_1', definitionId: 'Archer' }]);
    expect(restored.player.wallet.Gems).toBe(10);
  });

  it('rates are rebuilt after load (never saved): Townhall tax reflects population', () => {
    const state = freshGame();
    state.city.population = 7;
    const restored = deserialize(serialize(state, T0), map, T0, rng);
    const gen = townhall(restored).generators.find((g) => g.currencyId === 'Silver')!;
    const flat = gen.modifiers.filter((m) => m.kind === 'Flat').reduce((s, m) => s + m.value, 0);
    expect(flat).toBe(35); // 5 Silver/min × 7 population
  });

  it('a save aged 10 minutes pays out on the first tick, clamped at the vault cap', () => {
    const state = freshGame();
    state.city.population = 7; // 35 Silver/min
    const save = serialize(state, T0);
    const restored = deserialize(save, map, T0 + 600_000, rng);
    tickAt(restored, T0 + 600_000);
    const gen = townhall(restored).generators.find((g) => g.currencyId === 'Silver')!;
    expect(gen.vaultStored).toBe(50); // 350 produced, vault cap 50 — overflow lost
  });

  it('offline-expired active spells are dropped without removal effects', () => {
    const state = freshGame();
    state.features['5,5'] = { featureId: 'TreesCut', taps: 0, threshold: 0 };
    state.activeSpells.push({
      spellId: 'Rain', cell: { x: 5, y: 5 }, level: 1, magnitude: 5,
      expiresAt: T0 + 30_000, sourceId: 'spell_test',
    });
    const restored = deserialize(serialize(state, T0), map, T0 + 600_000, rng);
    expect(restored.activeSpells).toHaveLength(0);
    // The forest did NOT regrow (removal effects skipped for offline expiry).
    expect(restored.features[coordKey({ x: 5, y: 5 })].featureId).toBe('TreesCut');
  });
});
