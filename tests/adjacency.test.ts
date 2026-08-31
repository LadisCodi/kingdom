// Adjacency rules (Adjacency sheet): flat gold/min and gold/tap modifiers a
// district gains — or LOSES — per adjacent neighbor of a given type.
// Initial content: crowded houses (Housing next to Housing) pay less.
import { describe, expect, it } from 'vitest';
import { placementAdjacency } from '../src/sim/adjacency';
import { ADJACENCY } from '../src/sim/data/definitions';
import { collectTap, tapYieldAt } from '../src/sim/harvest';
import { cityGoldPerMinute, houseGoldPerMinute } from '../src/sim/population';
import { getWallet, type GameState } from '../src/sim/state';
import { addBuilt, freshGame, map, T0, tickAt } from './helpers';

const A = { x: 2, y: 0 };
const B = { x: 2, y: 1 }; // adjacent to A
const C = { x: 2, y: 2 }; // adjacent to B → B is crowded from both sides

const house = (state: GameState, cell: { x: number; y: number }) =>
  state.city.districts.find((d) => d.definitionId === 'Housing' &&
    d.location.x === cell.x && d.location.y === cell.y)!;

describe('housing adjacency', () => {
  it('the workbook seeds the Housing↔Housing crowding penalty', () => {
    expect(ADJACENCY).toContainEqual(
      { district: 'Housing', neighbor: 'Housing', goldPerMinute: -1, goldPerTap: -1 });
  });

  it('adjacent houses pay less tax per minute', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', A);
    addBuilt(state, 'Housing', B);
    state.city.population = 4; // 2 residents each
    // Each house: 2 × 2/min − 1 (one crowding neighbor) = 3.
    expect(houseGoldPerMinute(state, house(state, A))).toBe(3);
    expect(cityGoldPerMinute(state)).toBe(6);
    tickAt(state, T0 + 60_000);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(6); // vs 8 if built apart
  });

  it('crowding stacks, and both taxes and taps clamp at 0', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', A);
    addBuilt(state, 'Housing', B); // two neighbors
    addBuilt(state, 'Housing', C);
    state.city.population = 6;
    expect(houseGoldPerMinute(state, house(state, B))).toBe(2); // 4 − 2
    expect(cityGoldPerMinute(state)).toBe(3 + 2 + 3);
    // Tap on the middle house: 2 base − 2 crowding = 0 — tapping pays nothing.
    expect(tapYieldAt(state, B)).toBe(0);
    expect(tapYieldAt(state, A)).toBe(1); // 2 − 1
    expect(collectTap(state, map, A, T0)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(1);
  });

  it('placement preview reports both directions: given to neighbors, received by the ghost', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', A);
    const next = placementAdjacency(state, 'Housing', B);
    expect(next.given).toHaveLength(1);
    expect(next.given[0].district.location).toEqual(A);
    expect(next.given[0]).toMatchObject({ goldPerMinute: -1, goldPerTap: -1 });
    expect(next.received).toEqual({ goldPerMinute: -1, goldPerTap: -1 });

    const apart = placementAdjacency(state, 'Housing', { x: 0, y: -1 });
    expect(apart.given).toHaveLength(0);
    expect(apart.received).toEqual({ goldPerMinute: 0, goldPerTap: 0 });
  });

  it('the Townhall has no rule: a house beside it is unaffected', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', A); // touches the 2x2 Townhall footprint
    state.city.population = 2;
    expect(houseGoldPerMinute(state, house(state, A))).toBe(4); // no penalty
  });
});
