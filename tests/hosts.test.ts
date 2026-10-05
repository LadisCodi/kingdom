// A relic's host (sim/hosts.ts; Docs/plans/relics-and-bag.md step 6): a
// restored city relic acts only over the aura of the Shrine that holds it.

import { beforeEach, describe, expect, it } from 'vitest';
import { castState } from '../src/sim/casting';
import { advance, moveDistrict } from '../src/sim/commands';
import { castHosted, hostOf, hostRelic, relicAura, unhostRelic } from '../src/sim/hosts';
import { houseGoldPerMinute } from '../src/sim/population';
import { districtAt, type GameState } from '../src/sim/state';
import { addBuilt, freshGame, fund, map, reveal, T0 } from './helpers';

/** A built Shrine at `at`, at `level`. */
function shrine(state: GameState, id: string, at: { x: number; y: number }, level = 1): void {
  state.city.districts.push({
    uniqueId: id, definitionId: 'Shrine', ordinal: 9, level, assignedWorkers: 0,
    location: at, state: 'Built', visualVariant: 1,
  });
}

describe('a city relic acts where a Shrine holds it', () => {
  let state: GameState;
  beforeEach(() => {
    state = freshGame();
    state.lastAdvance = T0;
    state.artifacts.levels.GildedLedger = 1;
    shrine(state, 'a', { x: 0, y: 0 });
    shrine(state, 'b', { x: 6, y: 0 });
  });

  it('does nothing until it is hosted', () => {
    expect(relicAura(state, 'taxRate', { x: 1, y: 1 })).toEqual({ add: 0, mul: 1 });
    expect(castHosted(state, map, 'GildedLedger', T0).result).toBe('NotHosted');
  });

  it('refuses a relic not restored, and a host that is not a Shrine', () => {
    expect(hostRelic(state, 'DowsingRod', 'a', T0)).toBe('NotRestored');
    state.artifacts.levels.MusterHorn = 1;
    expect(hostRelic(state, 'MusterHorn', 'a', T0)).toBe('NotACityRelic');
    expect(hostRelic(state, 'GildedLedger', 'nowhere', T0)).toBe('NotAShrine');
  });

  it('reaches the footprint and the ring round it, and no further', () => {
    expect(hostRelic(state, 'GildedLedger', 'a', T0)).toBe('Hosted');
    expect(relicAura(state, 'taxRate', { x: 1, y: 1 }).mul).toBeGreaterThan(1);
    expect(relicAura(state, 'taxRate', { x: 3, y: 3 }).mul).toBeGreaterThan(1);
    expect(relicAura(state, 'taxRate', { x: 4, y: 4 }).mul).toBe(1);
  });

  it('has one host: hosting it again moves it', () => {
    hostRelic(state, 'GildedLedger', 'a', T0);
    hostRelic(state, 'GildedLedger', 'b', T0);
    expect(hostOf(state, 'GildedLedger')?.uniqueId).toBe('b');
    expect(state.city.districts.find((d) => d.uniqueId === 'a')!.hosts).toBeUndefined();
  });

  it('goes back to the Bag when it is taken out', () => {
    hostRelic(state, 'GildedLedger', 'a', T0);
    expect(unhostRelic(state, 'GildedLedger', T0)).toBe(true);
    expect(hostOf(state, 'GildedLedger')).toBeNull();
    expect(relicAura(state, 'taxRate', { x: 1, y: 1 }).mul).toBe(1);
  });

  // RULE 2: where one relic's auras overlap the stronger counts — never both.
  it('counts once where two of its auras would overlap', () => {
    hostRelic(state, 'GildedLedger', 'a', T0);
    const once = relicAura(state, 'taxRate', { x: 3, y: 1 }).mul;
    // A second Shrine wrongly claiming the same relic still adds nothing.
    shrine(state, 'c', { x: 4, y: 0 });
    state.city.districts.find((d) => d.uniqueId === 'c')!.hosts = 'GildedLedger';
    expect(relicAura(state, 'taxRate', { x: 3, y: 1 }).mul).toBe(once);
  });

  // RULE 4: rent is priced house by house, so a house inside the aura pays more.
  it('raises the rent of a house inside the aura, not one outside', () => {
    addBuilt(state, 'Housing', { x: 2, y: 2 });
    addBuilt(state, 'Housing', { x: 12, y: 12 });
    state.city.population = 8;
    const near = districtAt(state, { x: 2, y: 2 })!;
    const far = districtAt(state, { x: 12, y: 12 })!;
    const [n0, f0] = [houseGoldPerMinute(state, near), houseGoldPerMinute(state, far)];
    hostRelic(state, 'GildedLedger', 'a', T0);
    expect(houseGoldPerMinute(state, near)).toBeGreaterThan(n0);
    expect(houseGoldPerMinute(state, far)).toBe(f0);
  });
});

describe('a hosted spell lands on the aura', () => {
  let state: GameState;
  beforeEach(() => {
    state = freshGame();
    state.lastAdvance = T0;
    state.artifacts.levels.ForemansSigil = 1;
    fund(state, { Mana: 999 });
    reveal(state, [{ x: 0, y: 0 }, { x: 5, y: 1 }, { x: 6, y: 1 }, { x: 5, y: 2 }, { x: 6, y: 2 }]);
    shrine(state, 'a', { x: 0, y: 0 });
    hostRelic(state, 'ForemansSigil', 'a', T0);
  });

  it('casts with no target, over the Shrine’s aura', () => {
    expect(castHosted(state, map, 'ForemansSigil', T0).result).toBe('Cast');
    const zone = state.modifiers.find((m) => m.area?.relic === 'ForemansSigil');
    expect(zone?.area?.centre).toEqual({ x: 0, y: 0 });
  });

  // §6: MOVING A SHRINE ENDS ITS ACTIVE, and the cooldown keeps counting.
  it('ends its spell when the Shrine moves, and keeps the cooldown', () => {
    castHosted(state, map, 'ForemansSigil', T0);
    const ready = state.artifacts.casts.ForemansSigil!.readyAt;
    const now = T0 + 1000;
    advance(state, map, now);
    expect(castState(state, 'ForemansSigil', now).phase).toBe('Active');
    expect(moveDistrict(state, map, 'a', { x: 5, y: 1 }, now)).toBe('Moved');
    expect(state.modifiers.some((m) => m.area?.relic === 'ForemansSigil')).toBe(false);
    expect(castState(state, 'ForemansSigil', now)).toEqual({ phase: 'Cooldown', until: ready });
  });
});
