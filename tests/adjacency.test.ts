// Adjacency rules (Adjacency sheet): what a district gains — or LOSES — per
// adjacent neighbour of a given kind, on any of the stats the sheet can name.
//
// Adjacency is the ONLY thing that guides a layout (OQ-48, 2026-09-07):
// placement itself is free, so every rule here pays or charges and none
// refuses. The clamp is what keeps that true — no stat moves more than 25%,
// so a layout is better or worse and never wrong.
import { describe, expect, it } from 'vitest';
import {
  adjacencyEffect, adjacencyInEffect, adjacencyMultiplier, placementAdjacency,
} from '../src/sim/adjacency';
import {
  ADJACENCY, ADJACENCY_CLAMP, ADJACENCY_GROUPS, DISTRICTS,
} from '../src/sim/data/definitions';
import { trainSeconds, trainSecondsAt, trainUnit, trainingCompletesAt } from '../src/sim/army';
import { queueGood, queuedWorkMs } from '../src/sim/workshops';
import { cityGoldPerMinute, houseGoldPerMinute } from '../src/sim/population';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet, type DistrictId, type GameState } from '../src/sim/state';
import { addBuilt, completeTech, freshGame, fund, map, T0, tickAt } from './helpers';

const A = { x: 2, y: 0 };
const B = { x: 2, y: 1 }; // adjacent to A
const C = { x: 2, y: 2 }; // adjacent to B → B is crowded from both sides

const house = (state: GameState, cell: { x: number; y: number }) =>
  state.city.districts.find((d) => d.definitionId === 'Housing' &&
    d.location.x === cell.x && d.location.y === cell.y)!;

describe('housing adjacency', () => {
  it('the workbook seeds the Housing↔Housing crowding penalty', () => {
    expect(ADJACENCY).toContainEqual({
      district: 'Housing', neighbor: 'Housing', stat: 'goldPerMinute', magnitude: -1,
    });
  });

  it('adjacent houses pay less tax per minute', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', A);
    addBuilt(state, 'Housing', B);
    state.city.population = 4; // 2 residents each (an L1 house holds two)
    state.city.wallet.Gold = 0; // measuring INCOME, not the opening grant
    // Each house: 2 × 30/min − 1 (one crowding neighbor) = 59.
    expect(houseGoldPerMinute(state, house(state, A))).toBe(59);
    expect(cityGoldPerMinute(state)).toBe(118);
    tickAt(state, T0 + 60_100); // a hair past the minute
    expect(getWallet(state.city.wallet, 'Gold')).toBe(118); // vs 120 if built apart
  });

  it('crowding stacks per neighbor (and would clamp at 0, never negative)', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', A);
    addBuilt(state, 'Housing', B); // two neighbors
    addBuilt(state, 'Housing', C);
    state.city.population = 6; // 2 residents each
    expect(houseGoldPerMinute(state, house(state, B))).toBe(58); // 60 − 2
    expect(cityGoldPerMinute(state)).toBe(59 + 58 + 59);
    state.city.population = 4; // A: 2, B: 2, C: 0 — houses fill in build order
    expect(cityGoldPerMinute(state)).toBe(59 + 58); // empty C pays nothing
  });

  it('placement preview reports both directions: given to neighbors, received by the ghost', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', A);
    const next = placementAdjacency(state, 'Housing', B);
    expect(next.given).toHaveLength(1);
    expect(next.given[0].district.location).toEqual(A);
    expect(next.given[0].stat).toBe('goldPerMinute');
    expect(next.given[0].magnitude).toBe(-1);
    expect(next.received).toEqual([{ stat: 'goldPerMinute', total: -1 }]);

    const apart = placementAdjacency(state, 'Housing', { x: 0, y: -1 });
    expect(apart.given).toHaveLength(0);
    expect(apart.received).toEqual([]);
  });

  it('the Townhall has no rule: a house beside it is unaffected', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', A); // touches the 2x2 Townhall footprint
    state.city.population = 1;
    expect(houseGoldPerMinute(state, house(state, A))).toBe(30); // no penalty
  });
});

// ------------------------------------------------------- the sheet's shape

describe('a rule names a stat, a magnitude, and either side by kind', () => {
  it('authors every stat it uses, and no rule that does nothing', () => {
    for (const r of ADJACENCY) {
      expect(r.magnitude, `${r.district}+${r.neighbor}`).not.toBe(0);
      if (r.stat !== 'goldPerMinute') {
        expect(Math.abs(r.magnitude), `${r.district}+${r.neighbor}`)
          .toBeLessThanOrEqual(ADJACENCY_CLAMP);
      }
    }
  });

  it('resolves a GROUP token to every district that is one', () => {
    const halls = (Object.keys(DISTRICTS) as DistrictId[])
      .filter((id) => ADJACENCY_GROUPS.AnyHall(DISTRICTS[id]));
    expect(halls).toEqual(['Barracks', 'SpearHall', 'ShootingGrounds', 'Stables']);
    const shops = (Object.keys(DISTRICTS) as DistrictId[])
      .filter((id) => ADJACENCY_GROUPS.AnyWorkshop(DISTRICTS[id]));
    expect(shops).toEqual(['Carpenter', 'MasonsYard', 'Smelter', 'RuneCarver']);
    // Derived, so a district joins a group by BEING one — nothing is authored
    // twice and a new hall needs no new row.
    expect(ADJACENCY_GROUPS.AnyProducer(DISTRICTS.Sawmill)).toBe(true);
    expect(ADJACENCY_GROUPS.AnyProducer(DISTRICTS.Housing)).toBe(false);
  });

  it('pays a group rule from any member, in either column', () => {
    const state = freshGame();
    addBuilt(state, 'Barracks', { x: 4, y: 4 });
    addBuilt(state, 'Stables', { x: 4, y: 5 }); // edge to edge
    const barracks = state.city.districts.find((d) => d.definitionId === 'Barracks')!;
    const stables = state.city.districts.find((d) => d.definitionId === 'Stables')!;
    // One row — AnyHall beside AnyHall — read from both ends.
    expect(adjacencyEffect(state, 'Barracks', barracks.location, 'trainTime',
      barracks.uniqueId)).toBeCloseTo(-0.1);
    expect(adjacencyEffect(state, 'Stables', stables.location, 'trainTime',
      stables.uniqueId)).toBeCloseTo(-0.1);
  });

  it('clamps a fractional stat at ±25%, however many neighbours pile up', () => {
    const state = freshGame();
    // A hall ringed by four other halls would be −40% without the clamp.
    addBuilt(state, 'Barracks', { x: 4, y: 4 });
    addBuilt(state, 'SpearHall', { x: 4, y: 3 });
    addBuilt(state, 'ShootingGrounds', { x: 4, y: 5 });
    addBuilt(state, 'Stables', { x: 3, y: 4 });
    addBuilt(state, 'Sanctum', { x: 5, y: 4 }); // not a hall: no rule
    const barracks = state.city.districts.find((d) => d.definitionId === 'Barracks')!;
    expect(adjacencyMultiplier(state, barracks, 'trainTime')).toBeCloseTo(1 - ADJACENCY_CLAMP);
  });

  it('does not confuse one stat with another', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', A);
    addBuilt(state, 'Housing', B);
    const a = house(state, A);
    expect(adjacencyEffect(state, 'Housing', a.location, 'goldPerMinute', a.uniqueId)).toBe(-1);
    expect(adjacencyEffect(state, 'Housing', a.location, 'workTime', a.uniqueId)).toBe(0);
    expect(adjacencyInEffect(state, a)).toEqual([{ stat: 'goldPerMinute', total: -1 }]);
  });
});

// ----------------------------------------- a timer is priced when it starts

describe('a rule on a TIMER is priced when the timer starts', () => {
  const withHalls = () => {
    const state = freshGame();
    fund(state, { Gold: 100_000, Wood: 100_000, Stone: 100_000, Food: 100_000 });
    completeTech(state, 'Warrior'); // the unit, not the building
    addBuilt(state, 'Barracks', { x: 4, y: 4 });
    addBuilt(state, 'SpearHall', { x: 4, y: 5 });
    return state;
  };

  it('a military quarter trains faster than a lone hall', () => {
    const lone = freshGame();
    addBuilt(lone, 'Barracks', { x: 4, y: 4 });
    const together = withHalls();
    const id = (s: GameState) => s.city.districts.find((d) => d.definitionId === 'Barracks')!.uniqueId;
    expect(trainSecondsAt(together, id(together), 'Warrior'))
      .toBeLessThan(trainSecondsAt(lone, id(lone), 'Warrior'));
    expect(trainSecondsAt(lone, id(lone), 'Warrior')).toBe(trainSeconds('Warrior'));
  });

  it('stamps the seconds on the trainee, so a neighbour that leaves does not reprice it', () => {
    const state = withHalls();
    const barracks = state.city.districts.find((d) => d.definitionId === 'Barracks')!;
    expect(trainUnit(state, 'Warrior', T0, barracks)).toBe('Queued');
    const item = state.city.trainingQueue[0];
    expect(item.seconds).toBe(trainSecondsAt(state, barracks.uniqueId, 'Warrior'));
    const finishesAt = trainingCompletesAt(item);

    // The Spear Hall next door is demolished from the state — the wait the
    // player was promised does not move.
    state.city.districts = state.city.districts.filter((d) => d.definitionId !== 'SpearHall');
    expect(trainingCompletesAt(item)).toBe(finishesAt);
  });

  it('carries the stamped seconds through a save', () => {
    const state = withHalls();
    const barracks = state.city.districts.find((d) => d.definitionId === 'Barracks')!;
    trainUnit(state, 'Warrior', T0, barracks);
    const before = trainingCompletesAt(state.city.trainingQueue[0]);
    const loaded = deserialize(serialize(state, T0), map, T0)!;
    expect(trainingCompletesAt(loaded.city.trainingQueue[0])).toBe(before);
  });

  it('prices a workshop item when it is queued, beside the Sawmill or not', () => {
    const alone = freshGame();
    addBuilt(alone, 'Carpenter', { x: 4, y: 4 });
    const beside = freshGame();
    addBuilt(beside, 'Carpenter', { x: 4, y: 4 });
    addBuilt(beside, 'Sawmill', { x: 4, y: 5 });
    const shop = (s: GameState) => s.city.districts.find((d) => d.definitionId === 'Carpenter')!;
    expect(queuedWorkMs(beside, shop(beside), 'Planks'))
      .toBeLessThan(queuedWorkMs(alone, shop(alone), 'Planks'));

    fund(beside, { Wood: 1000 });
    expect(queueGood(beside, shop(beside).uniqueId, T0)).toBe('Queued');
    const item = beside.city.workshops[shop(beside).uniqueId].items[0];
    expect(item.needMs).toBe(queuedWorkMs(beside, shop(beside), 'Planks'));

    // And the item keeps its price when the Sawmill moves away.
    beside.city.districts = beside.city.districts.filter((d) => d.definitionId !== 'Sawmill');
    expect(item.needMs).toBe(queuedWorkMs(alone, shop(alone), 'Planks') * 0.9);
  });
});
