import { describe, expect, it } from 'vitest';
import { fogState, revealCost, revealTap } from '../src/sim/fog';
import { buildMapData, townhallDistance, TOWNHALL_ORIGIN } from '../src/sim/grid';
import { newGame } from '../src/sim/newGame';
import { coordKey, getWallet } from '../src/sim/state';

const map = buildMapData();
const NOW = Date.parse('2026-08-17T12:00:00Z');

describe('map data', () => {
  it('loads 342 terrain cells across six biomes and 42 features', () => {
    expect(map.terrain.size).toBe(342);
    expect([...map.terrain.values()].filter((t) => t === 'Grassland').length).toBe(93);
    expect([...map.terrain.values()].filter((t) => t === 'Plains').length).toBe(23);
    expect([...map.terrain.values()].filter((t) => t === 'Snow').length).toBe(18);
    expect([...map.terrain.values()].filter((t) => t === 'Mountain').length).toBe(28);
    expect([...map.terrain.values()].filter((t) => t === 'Water').length).toBe(171);
    expect([...map.terrain.values()].filter((t) => t === 'Tundra').length).toBe(9);
    expect(map.initialFeatures.size).toBe(42);
  });
  it('4-neighbor adjacency: distance 0 across the 2x2 footprint, 2 diagonal from it', () => {
    expect(townhallDistance(map, { x: 0, y: 0 })).toBe(0);
    expect(townhallDistance(map, { x: 1, y: 1 })).toBe(0); // inside the footprint
    expect(townhallDistance(map, { x: 2, y: 0 })).toBe(1); // beside its edge
    expect(townhallDistance(map, { x: 2, y: 2 })).toBe(2); // diagonal from its corner
    expect(townhallDistance(map, { x: -1, y: -1 })).toBe(2);
  });
});

describe('reveal cost curve (balance.xlsx FogRings)', () => {
  it('d 1–10 → 1,3,5,10,20,40,80,160,320,640 (doubling from d4)', () => {
    const expected = [1, 3, 5, 10, 20, 40, 80, 160, 320, 640];
    expected.forEach((cost, i) => expect(revealCost(i + 1)).toBe(cost));
  });
});

describe('fog state & seeding', () => {
  const state = newGame(map, NOW);
  it('seeds the Townhall fog radii: reveal 1 around the 2x2 footprint (4x4 block)', () => {
    expect(Object.keys(state.fog.revealed).length).toBe(16); // every cell exists here
    for (const cell of [TOWNHALL_ORIGIN, { x: 1, y: 1 }, { x: -1, y: -1 }, { x: 2, y: 2 }]) {
      expect(fogState(state, map, cell)).toBe('Revealed');
    }
  });
  it('marks Discovered out to the discover radius (3), even beyond tap-adjacency', () => {
    expect(fogState(state, map, { x: 3, y: 0 })).toBe('Discovered'); // adjacent + in radius
    expect(fogState(state, map, { x: 4, y: 0 })).toBe('Discovered'); // NOT adjacent — discover radius only
    expect(fogState(state, map, { x: 5, y: 0 })).toBe('Undiscovered'); // beyond radius 3
  });
});

describe('paying to reveal', () => {
  it('accumulates 1 Gold per tap and reveals when total cost is met', () => {
    const state = newGame(map, NOW);
    state.city.wallet.Gold = 50; // the start has 0 Gold
    // Distance 2 from the footprint → cost 3. Must be an UNGATED terrain:
    // (3,0) is Mountain and now needs Scaling Tools (see the gates block below).
    const cell = { x: 3, y: 1 };
    expect(revealTap(state, map, cell)).toBe('Paid');
    expect(revealTap(state, map, cell)).toBe('Paid');
    expect(state.fog.progress[coordKey(cell)]).toBe(2);
    expect(revealTap(state, map, cell)).toBe('Revealed');
    expect(state.fog.revealed[coordKey(cell)]).toBe(true);
    expect(state.fog.progress[coordKey(cell)]).toBeUndefined();
    expect(getWallet(state.city.wallet, 'Gold')).toBe(50 - 3);
  });
  it('rejects taps on Undiscovered cells', () => {
    const state = newGame(map, NOW);
    state.city.wallet.Gold = 50;
    expect(revealTap(state, map, { x: -6, y: -3 })).toBe('NotDiscovered');
  });
});

describe('exploration gates (Sailing / Scaling Tools)', () => {
  it('sea cells are locked until Sailing is researched', () => {
    const state = newGame(map, NOW);
    state.city.wallet.Gold = 5000;
    const sea = { x: -3, y: 0 }; // inside the Townhall discover radius
    expect(fogState(state, map, sea)).toBe('Discovered');
    expect(revealTap(state, map, sea)).toBe('TechLocked');
    state.research.completed.push('Sailing');
    expect(revealTap(state, map, sea)).toBe('Paid');
  });

  it('mountain cells are locked until Scaling Tools is researched', () => {
    const state = newGame(map, NOW);
    state.city.wallet.Gold = 5000;
    const peak = { x: 0, y: -9 }; // the northern ridge
    state.fog.discovered[coordKey(peak)] = true; // walk the frontier up in spirit
    expect(revealTap(state, map, peak)).toBe('TechLocked');
    state.research.completed.push('ScalingTools');
    expect(revealTap(state, map, peak)).toBe('Paid');
  });
});
