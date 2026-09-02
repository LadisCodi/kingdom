// Adjacency rules (Adjacency sheet): a flat gold/min modifier a district
// gains — or LOSES — per adjacent neighbor of a given type.
// Initial content: crowded houses (Housing next to Housing) pay less.
import { describe, expect, it } from 'vitest';
import { placementAdjacency } from '../src/sim/adjacency';
import { ADJACENCY } from '../src/sim/data/definitions';
import { cityGoldPerMinute, houseGoldPerMinute } from '../src/sim/population';
import { getWallet, type GameState } from '../src/sim/state';
import { addBuilt, freshGame, T0, tickAt } from './helpers';

const A = { x: 2, y: 0 };
const B = { x: 2, y: 1 }; // adjacent to A
const C = { x: 2, y: 2 }; // adjacent to B → B is crowded from both sides

const house = (state: GameState, cell: { x: number; y: number }) =>
  state.city.districts.find((d) => d.definitionId === 'Housing' &&
    d.location.x === cell.x && d.location.y === cell.y)!;

describe('housing adjacency', () => {
  it('the workbook seeds the Housing↔Housing crowding penalty', () => {
    expect(ADJACENCY).toContainEqual(
      { district: 'Housing', neighbor: 'Housing', goldPerMinute: -1 });
  });

  it('adjacent houses pay less tax per minute', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', A);
    addBuilt(state, 'Housing', B);
    state.city.population = 2; // 1 resident each (capacity 1)
    // Each house: 1 × 30/min − 1 (one crowding neighbor) = 29.
    expect(houseGoldPerMinute(state, house(state, A))).toBe(29);
    expect(cityGoldPerMinute(state)).toBe(58);
    tickAt(state, T0 + 60_100); // a hair past the minute
    expect(getWallet(state.city.wallet, 'Gold')).toBe(58); // vs 60 if built apart
  });

  it('crowding stacks per neighbor (and would clamp at 0, never negative)', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', A);
    addBuilt(state, 'Housing', B); // two neighbors
    addBuilt(state, 'Housing', C);
    state.city.population = 3; // 1 resident each
    expect(houseGoldPerMinute(state, house(state, B))).toBe(28); // 30 − 2
    expect(cityGoldPerMinute(state)).toBe(29 + 28 + 29);
    state.city.population = 2; // A: 1, B: 1, C: 0
    expect(cityGoldPerMinute(state)).toBe(29 + 28); // empty C pays nothing
  });

  it('placement preview reports both directions: given to neighbors, received by the ghost', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', A);
    const next = placementAdjacency(state, 'Housing', B);
    expect(next.given).toHaveLength(1);
    expect(next.given[0].district.location).toEqual(A);
    expect(next.given[0].goldPerMinute).toBe(-1);
    expect(next.received).toBe(-1);

    const apart = placementAdjacency(state, 'Housing', { x: 0, y: -1 });
    expect(apart.given).toHaveLength(0);
    expect(apart.received).toBe(0);
  });

  it('the Townhall has no rule: a house beside it is unaffected', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', A); // touches the 2x2 Townhall footprint
    state.city.population = 1;
    expect(houseGoldPerMinute(state, house(state, A))).toBe(30); // no penalty
  });
});
