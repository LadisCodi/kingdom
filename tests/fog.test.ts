import { describe, expect, it } from 'vitest';
import { TECH_ORDER } from '../src/sim/data/definitions';
import { fogState, isReachable, revealCost, revealKnowledge, revealTap } from '../src/sim/fog';
import { buildMapData, townhallDistance, TOWNHALL_ORIGIN } from '../src/sim/grid';
import { newGame } from '../src/sim/newGame';
import { techCost } from '../src/sim/research';
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

describe('the frontier stays connected', () => {
  // A building's discover radius reaches further than its reveal radius, so a
  // fresh kingdom can SEE cells three rings out while standing on one. Paying
  // for those directly turned exploration into a shopping list — pick the
  // interesting tile, leave a doughnut of fog around it — and made the
  // distance cost curve meaningless, because you could jump to the cheap side
  // of the map without clearing the way there.
  it('refuses a cell you can see but cannot reach', () => {
    const state = newGame(map, NOW);
    state.city.wallet.Gold = 5000;
    // Two rings out: discovered by the Townhall, not touching cleared ground.
    const far = { x: 3, y: 3 };
    expect(fogState(state, map, far)).toBe('Discovered');
    expect(isReachable(state, map, far)).toBe(false);
    expect(revealTap(state, map, far)).toBe('NotReachable');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(5000); // and charges nothing
  });

  it('opens up the moment a neighbour is cleared', () => {
    const state = newGame(map, NOW);
    state.city.wallet.Gold = 5000;
    const far = { x: 3, y: 3 };
    expect(revealTap(state, map, far)).toBe('NotReachable');
    state.fog.revealed[coordKey({ x: 3, y: 2 })] = true;
    expect(isReachable(state, map, far)).toBe(true);
    expect(revealTap(state, map, far)).toBe('Paid');
  });

  it('the ring touching the Townhall is payable from the first minute', () => {
    const state = newGame(map, NOW);
    state.city.wallet.Gold = 5000;
    // (2,1) is revealed by the Townhall's radius, so (3,1) touches it.
    expect(isReachable(state, map, { x: 3, y: 1 })).toBe(true);
    expect(revealTap(state, map, { x: 3, y: 1 })).toBe('Paid');
  });
});

describe('exploration gates (Sailing / Scaling Tools)', () => {
  it('sea cells are locked until Sailing is researched', () => {
    const state = newGame(map, NOW);
    state.city.wallet.Gold = 5000;
    const sea = { x: -3, y: 0 }; // inside the Townhall discover radius
    expect(fogState(state, map, sea)).toBe('Discovered');
    // Stand on the shore first: the frontier rule is a separate gate, and
    // this test is about the TECH one.
    state.fog.revealed[coordKey({ x: -2, y: 0 })] = true;
    expect(revealTap(state, map, sea)).toBe('TechLocked');
    state.research.completed.push('Sailing');
    expect(revealTap(state, map, sea)).toBe('Paid');
  });

  it('mountain cells are locked until Scaling Tools is researched', () => {
    const state = newGame(map, NOW);
    state.city.wallet.Gold = 5000;
    const peak = { x: 0, y: -9 }; // the northern ridge
    state.fog.revealed[coordKey({ x: 0, y: -8 })] = true; // walk the frontier up
    expect(revealTap(state, map, peak)).toBe('TechLocked');
    state.research.completed.push('ScalingTools');
    expect(revealTap(state, map, peak)).toBe('Paid');
  });
});

// Docs/features/knowledge.md — where the research tree is actually paid for.
//
// CLAIM: clearing a cell pays Knowledge linear in its distance from the
// Townhall, into the KINGDOM purse, and only on the tap that finishes it.
// Linear against a reveal cost that doubles is the whole shape of the
// economy: the far map is worth going to, but no single cell is a jackpot,
// so the tree is bought by pushing the border outward rather than by finding
// one lucky tile.
describe('exploring is what buys research', () => {
  it('pays Knowledge equal to the ring, and only when the cell finally clears', () => {
    const state = newGame(map, NOW);
    state.city.wallet.Gold = 5000;
    const cell = { x: 4, y: 1 }; // ring 3, reachable once (3,1) is cleared
    expect(townhallDistance(map, cell)).toBe(3);
    expect(revealKnowledge(map, cell)).toBe(3);

    const near = { x: 3, y: 1 }; // ring 2
    while (revealTap(state, map, near) === 'Paid') { /* pay it off */ }
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(2);

    // Partial payments on the next cell bank nothing.
    expect(revealTap(state, map, cell)).toBe('Paid');
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(2);
    while (revealTap(state, map, cell) === 'Paid') { /* pay it off */ }
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(2 + 3);
  });

  it('the map holds more Knowledge than the whole tech tree costs', () => {
    // Supply against demand, asserted on the AUTHORED numbers so a balance
    // edit that puts the tree out of reach fails here rather than in
    // playtest. Quests carry roughly another 590 on top of this.
    let supply = 0;
    for (const key of map.terrain.keys()) {
      const [x, y] = key.split(',').map(Number);
      supply += revealKnowledge(map, { x, y });
    }
    const tree = TECH_ORDER.reduce((sum, id) => sum + techCost(id), 0);
    expect(supply).toBe(2902);
    expect(tree).toBe(643);
    // Comfortable, but not free: about a quarter of the map funds all of it.
    expect(supply).toBeGreaterThan(tree * 4);
  });
});
