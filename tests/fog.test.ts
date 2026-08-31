import { describe, expect, it } from 'vitest';
import { fogState, revealCost, revealTap } from '../src/sim/fog';
import { buildMapData, townhallDistance, TOWNHALL_ORIGIN } from '../src/sim/grid';
import { newGame } from '../src/sim/newGame';
import { coordKey, getWallet } from '../src/sim/state';

const map = buildMapData();
const NOW = Date.parse('2026-08-17T12:00:00Z');

describe('map data', () => {
  it('loads 155 terrain cells (98 Grassland, 57 Water) and 17 features', () => {
    expect(map.terrain.size).toBe(155);
    expect([...map.terrain.values()].filter((t) => t === 'Grassland').length).toBe(98);
    expect(map.initialFeatures.size).toBe(17); // 13 Trees + 2 BerryBush + 2 WildAnimals
  });
  it('8-neighbor adjacency: distance 0 across the 2x2 footprint, 1 diagonal from it', () => {
    expect(townhallDistance(map, { x: 0, y: 0 })).toBe(0);
    expect(townhallDistance(map, { x: 1, y: 1 })).toBe(0); // inside the footprint
    expect(townhallDistance(map, { x: 2, y: 2 })).toBe(1); // diagonal from its corner
    expect(townhallDistance(map, { x: -1, y: -1 })).toBe(1);
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
  it('seeds the Townhall fog radii: reveal 3 around the 2x2 footprint (8x8 block)', () => {
    expect(Object.keys(state.fog.revealed).length).toBe(64); // every cell exists here
    for (const cell of [TOWNHALL_ORIGIN, { x: 1, y: 1 }, { x: -3, y: -3 }, { x: 4, y: 4 }]) {
      expect(fogState(state, map, cell)).toBe('Revealed');
    }
  });
  it('marks Discovered out to the discover radius (5), even beyond tap-adjacency', () => {
    expect(fogState(state, map, { x: 5, y: 0 })).toBe('Discovered'); // adjacent + in radius
    expect(fogState(state, map, { x: 6, y: 0 })).toBe('Discovered'); // NOT adjacent — discover radius only
    expect(fogState(state, map, { x: -6, y: -3 })).toBe('Undiscovered'); // beyond radius 5
  });
});

describe('paying to reveal', () => {
  it('accumulates 1 Silver per tap and reveals when total cost is met', () => {
    const state = newGame(map, NOW);
    const cell = { x: 5, y: 0 }; // distance 4 from the footprint → cost 10
    const silverBefore = getWallet(state.city.wallet, 'Silver');
    expect(revealTap(state, map, cell)).toBe('Paid');
    expect(revealTap(state, map, cell)).toBe('Paid');
    expect(state.fog.progress[coordKey(cell)]).toBe(2);
    let taps = 2;
    let r: string = 'Paid';
    while (r === 'Paid') { r = revealTap(state, map, cell); taps++; }
    expect(r).toBe('Revealed');
    expect(taps).toBe(10);
    expect(state.fog.revealed[coordKey(cell)]).toBe(true);
    expect(state.fog.progress[coordKey(cell)]).toBeUndefined();
    expect(getWallet(state.city.wallet, 'Silver')).toBe(silverBefore - 10);
  });
  it('rejects taps on Undiscovered cells', () => {
    const state = newGame(map, NOW);
    expect(revealTap(state, map, { x: -6, y: -3 })).toBe('NotDiscovered');
  });
});
