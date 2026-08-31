import { describe, expect, it } from 'vitest';
import { fogState, revealCost, revealTap } from '../src/sim/fog';
import { buildMapData, neighbors, townhallDistance, TOWNHALL_ORIGIN } from '../src/sim/grid';
import { newGame } from '../src/sim/newGame';
import { coordKey, getWallet } from '../src/sim/state';

const map = buildMapData();
const NOW = Date.parse('2026-08-17T12:00:00Z');

describe('map data', () => {
  it('loads 155 terrain cells (98 Grassland, 57 Water) and 13 Trees', () => {
    expect(map.terrain.size).toBe(155);
    expect([...map.terrain.values()].filter((t) => t === 'Grassland').length).toBe(98);
    expect(map.initialFeatures.size).toBe(13);
  });
  it('8-neighbor adjacency: distance 0 across the 2x2 footprint, 1 diagonal from it', () => {
    expect(townhallDistance(map, { x: 0, y: 0 })).toBe(0);
    expect(townhallDistance(map, { x: 1, y: 1 })).toBe(0); // inside the footprint
    expect(townhallDistance(map, { x: 2, y: 2 })).toBe(1); // diagonal from its corner
    expect(townhallDistance(map, { x: -1, y: -1 })).toBe(1);
  });
});

describe('reveal cost curve (Docs/02 table)', () => {
  it('d 1–10 → 3,3,4,5,6,8,10,12,15,19', () => {
    const expected = [3, 3, 4, 5, 6, 8, 10, 12, 15, 19];
    expected.forEach((cost, i) => expect(revealCost(i + 1)).toBe(cost));
  });
});

describe('fog state & seeding', () => {
  const state = newGame(map, NOW);
  it('seeds the 2x2 Townhall footprint + all its neighbors as Revealed (4x4 block)', () => {
    expect(Object.keys(state.fog.revealed).length).toBe(16);
    for (const cell of [TOWNHALL_ORIGIN, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]) {
      expect(fogState(state, map, cell)).toBe('Revealed');
      for (const n of neighbors(map, cell)) {
        expect(fogState(state, map, n)).toBe('Revealed');
      }
    }
  });
  it('derives Discovered for unrevealed cells with a revealed neighbor', () => {
    expect(fogState(state, map, { x: 3, y: 0 })).toBe('Discovered');
    expect(fogState(state, map, { x: 5, y: 5 })).toBe('Undiscovered');
  });
});

describe('paying to reveal', () => {
  it('accumulates 1 Silver per tap and reveals when total cost is met', () => {
    const state = newGame(map, NOW);
    const cell = { x: 3, y: 0 }; // distance 2 from the footprint → cost 3
    const silverBefore = getWallet(state.city.wallet, 'Silver');
    expect(revealTap(state, map, cell)).toBe('Paid');
    expect(revealTap(state, map, cell)).toBe('Paid');
    expect(state.fog.progress[coordKey(cell)]).toBe(2);
    expect(revealTap(state, map, cell)).toBe('Revealed');
    expect(state.fog.revealed[coordKey(cell)]).toBe(true);
    expect(state.fog.progress[coordKey(cell)]).toBeUndefined();
    expect(getWallet(state.city.wallet, 'Silver')).toBe(silverBefore - 3);
  });
  it('rejects taps on Undiscovered cells', () => {
    const state = newGame(map, NOW);
    expect(revealTap(state, map, { x: 5, y: 5 })).toBe('NotDiscovered');
  });
});
