import { describe, expect, it } from 'vitest';
import {
  DISTRICTS, FEATURES, FOG, LANDMARKS, RUINS, TECHNOLOGIES, TECH_ORDER, CURRENCIES,
} from '../src/sim/data/definitions';
import {
  explorationGate, fogState, isReachable, nextRevealTapCost, recordVisibleSites,
  revealAroundDistrict, revealCost, revealCostForCell, revealTap, revealTapCost,
  revealTapsDone,
} from '../src/sim/fog';
import { buildMapData, townhallDistance, TOWNHALL_ORIGIN } from '../src/sim/grid';
import { newGame } from '../src/sim/newGame';
import { siteDiscoveryKey } from '../src/sim/discovery';
import { claimLandmark, landmarkClaimCost } from '../src/sim/landmarks';
import { techCost } from '../src/sim/research';
import { deserialize, serialize } from '../src/sim/save';
import { addBuilt, reveal, T0 } from './helpers';
import { coordKey, getWallet, parseCoordKey, type Coord } from '../src/sim/state';

const map = buildMapData();
const NOW = Date.parse('2026-08-17T12:00:00Z');

/** A land cell touching water, and the water beside it — in reading order, so
 *  the answer is stable for a given map without being written down. */
function firstShore(): { land: Coord; sea: Coord } | null {
  const cells = [...map.terrain.keys()].map(parseCoordKey)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  for (const land of cells) {
    if (map.terrain.get(coordKey(land)) === 'Water') continue;
    for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      const sea = { x: land.x + d.x, y: land.y + d.y };
      if (map.terrain.get(coordKey(sea)) === 'Water') return { land, sea };
    }
  }
  return null;
}

describe('map data', () => {
  // A per-biome census had to be hand-corrected after every paint, and it
  // guaranteed nothing: `regionMap.test.ts` already proves the map is LEGAL.
  // What nobody was checking is the thing that actually breaks the game —
  // a map that is perfectly legal and still leaves a worker building with
  // nothing to work. See Docs/open-questions.md OQ-50.
  it('loads, and every district that sends workers out has something to work', () => {
    expect(map.terrain.size).toBeGreaterThan(0);
    expect(map.initialFeatures.size).toBeGreaterThan(0);

    const onMap = new Set(
      [...map.initialFeatures.values()].map((f) => FEATURES[f].source),
    );
    // A crop plot IS its own Crops cell, so that source is built rather than
    // authored and never shows up as a map feature.
    const built = new Set(Object.values(DISTRICTS)
      .map((d) => d.providesHarvestSource).filter((s) => s !== null));
    for (const def of Object.values(DISTRICTS)) {
      for (const source of def.harvestSources) {
        if (built.has(source)) continue;
        expect(onMap.has(source),
          `the ${def.name} works ${source} and the map holds no cell of it`)
          .toBe(true);
      }
    }
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
  it('d 1–10 → 3,5,10,20,40,75,120,250,500,1000', () => {
    const expected = [3, 5, 10, 20, 40, 75, 120, 250, 500, 1000];
    expected.forEach((cost, i) => expect(revealCost(i + 1)).toBe(cost));
  });
  // The workbook authors twenty rings, and the second ten is a clean
  // doubling: the far province is priced by the curve, not by the fallback.
  it('doubles from d10 to d20, then falls back on ×1.25 a ring', () => {
    for (let d = 11; d <= 20; d += 1) {
      expect(revealCost(d), `ring ${d}`).toBe(revealCost(d - 1) * 2);
    }
    const last = revealCost(20);
    expect(revealCost(21)).toBe(Math.round(last * FOG.fallbackGrowth));
    expect(revealCost(23)).toBe(Math.round(last * FOG.fallbackGrowth ** 3));
  });
  // Five taps a cell, so a ring price five does not divide charges uneven
  // fifths. Every ring from 3 out — the whole of the province a player really
  // buys — is a multiple of five; rings 1 and 2 are pennies inside the
  // Townhall's own shadow and stay pennies.
  it('prices every ring past the opening in whole fifths', () => {
    for (const ring of FOG.rings) {
      if (ring.distance <= 2) continue;
      expect(ring.cost % FOG.tapsToReveal, `ring ${ring.distance}`).toBe(0);
    }
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
  it('marks Discovered out to the discover radius (2), even beyond tap-adjacency', () => {
    expect(DISTRICTS.Townhall.fogDiscoverRadius).toBe(2);
    expect(fogState(state, map, { x: 3, y: 0 })).toBe('Discovered'); // adjacent + in radius
    expect(fogState(state, map, { x: 4, y: 0 })).toBe('Undiscovered'); // beyond radius 2
  });
});

describe('paying to reveal', () => {
  it('counts the taps and reveals on the fifth', () => {
    const state = newGame(map, NOW);
    state.city.wallet.Gold = 50; // the start has 0 Gold
    // Distance 2 from the footprint → 5 Gold, on ungated ground.
    const cell = { x: 3, y: 1 };
    for (let tap = 1; tap < FOG.tapsToReveal; tap += 1) {
      expect(revealTap(state, map, cell)).toBe('Paid');
      expect(state.fog.progress[coordKey(cell)]).toBe(tap);
    }
    expect(revealTap(state, map, cell)).toBe('Revealed');
    expect(state.fog.revealed[coordKey(cell)]).toBe(true);
    expect(state.fog.progress[coordKey(cell)]).toBeUndefined();
    expect(getWallet(state.city.wallet, 'Gold')).toBe(50 - 5);
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
    state.city.wallet.Gold = 99_999_999; // the shore is thirty rings out
    // Water is the ONE remaining reveal gate (mountains became a feature, so
    // Scaling Tools gates working one instead — see explorationGate). The
    // cell is found rather than pinned: the coastline moves whenever the
    // region is repainted, and a moved coast is not a broken gate.
    const shore = firstShore();
    expect(shore, 'the map has no land cell touching water').not.toBeNull();
    const { land, sea } = shore!;
    // Stand on the shore first: the frontier rule is a separate gate, and
    // this test is about the TECH one.
    state.fog.revealed[coordKey(land)] = true;
    expect(fogState(state, map, sea)).toBe('Discovered');
    expect(revealTap(state, map, sea)).toBe('TechLocked');
    state.research.completed.push('Sailing');
    expect(revealTap(state, map, sea)).toBe('Paid');
  });
});

// Docs/features/10-heroes.md §4 — clearing fog pays no currency at all.
//
// CLAIM: a reveal buys GROUND. Resource cells, buildable land, ruins and
// landmarks, against a Gold price that doubles from ring 4 — and nothing
// else. Knowledge used to be paid here, linear in the ring, because it
// bought the tech tree; the tree is Gold now and Knowledge comes out of
// dungeons, so the faucet went with the reason for it.
describe('exploring pays in ground, not in currency', () => {
  it('banks no Knowledge, however far out the cell is', () => {
    const state = newGame(map, NOW);
    state.city.wallet.Gold = 5000;

    const near = { x: 3, y: 1 }; // ring 2
    while (revealTap(state, map, near) === 'Paid') { /* pay it off */ }
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(CURRENCIES.Knowledge.start);

    const far = { x: 4, y: 1 }; // ring 3, reachable now
    expect(townhallDistance(map, far)).toBe(3);
    while (revealTap(state, map, far) === 'Paid') { /* pay it off */ }
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(CURRENCIES.Knowledge.start);
  });

  it('the tech tree is priced against what the CITY earns, in Gold', () => {
    // Supply against demand, asserted on the AUTHORED numbers so a balance
    // edit that puts the tree out of reach fails here rather than in
    // playtest.
    //
    // 502,335 in Gold, down 16,620 when the Market left the game
    // (2026-09-09): its own card, the four Market Stall ranks and Guildhalls,
    // which existed only to allow a second one. Before that it was 518,955,
    // down 875 when Cartography and Surveying I–II left the tree with the
    // fog's tap ladder (01-map-and-fog.md §5). It was 6,600 before the 15
    // levelled upgrades became ranked technologies, 520,165 when the three
    // tomes added their keystones, 485,330 when Civics became a whole book
    // (2026-09-08: 67 cards, two planned ones cut, the ranks re-priced for
    // their rows), and it went back up by 34,500 when the four decoration
    // technologies joined Civics' third band the same day, and by 3,775 more
    // when `Field Medicine` stopped being one planned card and became a
    // three-rank Warfare ladder (2026-09-09). 07-research.md
    // calls a tree the quest chain funds twice over "not a sink, a
    // formality"; this is the other side of that.
    // 504,430: the opening stopped charging Gold at all (2026-09-09) —
    // Forestry, Agriculture, Farming and Saws are priced in the clock alone,
    // and `Hunting` came back to era 1 with them, off 1,500 Gold.
    const tree = TECH_ORDER.reduce((sum, id) => sum + techCost(id), 0);
    expect(tree).toBe(504_430);
    // Every tech is Gold AND Knowledge, era 1 included since the clock gained
    // a base rate (2026-09-08) — the research clock, 07-research.md §3. Never
    // materials: a full quarry buys no research, which is what keeps the tree
    // in the same contest as fog and buildings.
    for (const id of TECH_ORDER) {
      const keys = Object.keys(TECHNOLOGIES[id].cost);
      expect(keys.every((k) => k === 'Gold' || k === 'Knowledge'), `${id} costs ${keys}`).toBe(true);
      expect(keys, `${id} is priced in the clock`).toContain('Knowledge');
    }
  });
});

// Docs/features/01-map-and-fog.md §5 — a cell is FIVE taps at every ring.
//
// The tap used to be the unit of money AND time: one Gold a press, so the far
// rings cost hundreds of presses and the thumb, not the purse, was what
// rationed exploring. A fixed five puts the whole price in the Gold, and what
// the ring decides is what each of the five charges.
describe('a cell is five taps at every ring', () => {
  /** Clear a cell the way a player does, reporting the taps and the Gold. */
  const payFor = (state: ReturnType<typeof newGame>, cell: Coord) => {
    const before = getWallet(state.city.wallet, 'Gold');
    const charges: number[] = [];
    let r: string = 'Paid';
    while (r === 'Paid') {
      charges.push(nextRevealTapCost(state, map, cell));
      r = revealTap(state, map, cell);
    }
    expect(r).toBe('Revealed');
    return { taps: charges.length, charges, spent: before - getWallet(state.city.wallet, 'Gold') };
  };

  it('takes exactly fog.tapsToReveal taps, near ring and far ring alike', () => {
    const near = newGame(map, NOW);
    near.city.wallet.Gold = 99_999;
    reveal(near, [{ x: 0, y: 3 }]);
    const cheap = payFor(near, { x: 0, y: 4 }); // ring 3
    expect(cheap.taps).toBe(FOG.tapsToReveal);
    expect(cheap.spent).toBe(revealCost(3));

    // The dearest cell the frontier can reach from the same seed, walked out
    // one ring at a time so the far price is a real one and not a fixture.
    const far = newGame(map, NOW);
    far.city.wallet.Gold = 999_999;
    let last = { x: 0, y: 3 };
    reveal(far, [last]);
    for (let step = 0; step < 4; step += 1) {
      const next = { x: last.x, y: last.y + 1 };
      if (map.terrain.get(coordKey(next)) === undefined) break;
      if (explorationGate(map, next) !== null) break;
      const walked = payFor(far, next);
      expect(walked.taps, `ring ${townhallDistance(map, next)} took ${walked.taps} taps`)
        .toBe(FOG.tapsToReveal);
      expect(walked.spent).toBe(revealCost(townhallDistance(map, next)));
      last = next;
    }
  });

  it('charges a fifth a tap, and the five sum to the price exactly', () => {
    const state = newGame(map, NOW);
    state.city.wallet.Gold = 99_999;
    reveal(state, [{ x: 0, y: 3 }]);
    const cell = { x: 0, y: 4 };
    const total = revealCostForCell(state, map, cell);
    const { charges, spent } = payFor(state, cell);

    expect(spent).toBe(total);
    expect(charges.reduce((a, b) => a + b, 0)).toBe(total);
    // Every ring price is a multiple of five, so the fifths come out whole.
    expect(charges).toEqual(charges.map(() => total / FOG.tapsToReveal));
  });

  // A discount is the one thing that can break the divisibility, and a price
  // it cannot divide must still be charged to the last Gold — never rounded
  // up into the player's purse, never rounded down into free ground.
  it('splits a price five does not divide without losing a Gold either way', () => {
    for (const total of [1, 3, 7, 14, 999]) {
      const charges = Array.from({ length: FOG.tapsToReveal },
        (_, i) => revealTapCost(total, i));
      expect(charges.reduce((a, b) => a + b, 0), `${total} split five ways`).toBe(total);
      expect(charges.every((c) => c >= 0)).toBe(true);
    }
  });

  it('counts taps, not Gold, so the bar means the same on every cell', () => {
    const state = newGame(map, NOW);
    state.city.wallet.Gold = 99_999;
    reveal(state, [{ x: 0, y: 3 }]);
    const cell = { x: 0, y: 4 };
    expect(revealTapsDone(state, cell)).toBe(0);
    revealTap(state, map, cell);
    revealTap(state, map, cell);
    expect(revealTapsDone(state, cell)).toBe(2);
    expect(fogState(state, map, cell)).toBe('Discovered');
  });

  it('refuses the tap the purse cannot cover, and takes nothing', () => {
    const state = newGame(map, NOW);
    reveal(state, [{ x: 0, y: 3 }]);
    const cell = { x: 0, y: 4 };
    state.city.wallet.Gold = nextRevealTapCost(state, map, cell) - 1;
    expect(revealTap(state, map, cell)).toBe('NotEnoughGold');
    expect(revealTapsDone(state, cell)).toBe(0);
  });
});

// Sighting a site announces it, once, ever.
//
// The interesting part is that "became visible" is not a mutation — fog state
// is derived, so a shrine can come into view because a NEIGHBOUR was cleared,
// because a building's radius landed near it, or because another sanctuary
// was claimed. These check all three routes, because a hook on any one of
// them would have missed the other two.
describe('a site announces itself when it comes into view', () => {
  const near = (cell: Coord, of: Coord, r: number) =>
    Math.max(Math.abs(cell.x - of.x), Math.abs(cell.y - of.y)) <= r;

  it('says nothing at all on a brand-new map', () => {
    const state = newGame(map, T0);
    expect(state.pendingDiscoveries.filter((k) => k.startsWith('site:'))).toEqual([]);
  });

  it('announces one the moment the fog THINS, not when the cell is bought', () => {
    const state = newGame(map, T0);
    const shrine = LANDMARKS.reduce((a, b) =>
      townhallDistance(map, a.location) <= townhallDistance(map, b.location) ? a : b);

    // Clear a neighbour of the shrine. The shrine's own cell is untouched —
    // it only becomes Discovered because something beside it was revealed.
    reveal(state, [{ x: shrine.location.x, y: shrine.location.y + 1 }]);
    recordVisibleSites(state, map);

    expect(fogState(state, map, shrine.location)).toBe('Discovered');
    expect(state.discoveries[siteDiscoveryKey(shrine.id)]).toBe(true);
    expect(state.pendingDiscoveries).toContain(siteDiscoveryKey(shrine.id));
  });

  it('announces once, ever — and survives a save', () => {
    const state = newGame(map, T0);
    const shrine = LANDMARKS[0];
    reveal(state, [shrine.location]);
    recordVisibleSites(state, map);
    expect(state.pendingDiscoveries).toContain(siteDiscoveryKey(shrine.id));

    state.pendingDiscoveries = []; // the UI drained the banner
    recordVisibleSites(state, map);
    expect(state.pendingDiscoveries).toEqual([]); // not announced twice

    const restored = deserialize(serialize(state, T0), map, T0)!;
    expect(restored.discoveries[siteDiscoveryKey(shrine.id)]).toBe(true);
    recordVisibleSites(restored, map);
    expect(restored.pendingDiscoveries).toEqual([]); // nor after a reload
  });

  // The three routes, each through the real function that takes them.
  it('fires when a paid reveal brings one into view', () => {
    const state = newGame(map, T0);
    state.city.wallet.Gold = 100_000;
    const target = LANDMARKS.reduce((a, b) =>
      townhallDistance(map, a.location) <= townhallDistance(map, b.location) ? a : b);
    const toward = (c: Coord) =>
      Math.abs(c.x - target.location.x) + Math.abs(c.y - target.location.y);

    // Push the border AT the nearest sanctuary, one payable cell at a time,
    // and stop the moment something is sighted — which must happen before the
    // player ever stands on it.
    for (let i = 0; i < 30; i++) {
      if (state.pendingDiscoveries.some((k) => k.startsWith('site:'))) break;
      const next = [...map.terrain.keys()].map(parseCoordKey)
        .filter((c) => fogState(state, map, c) === 'Discovered'
          && isReachable(state, map, c) && explorationGate(map, c) === null)
        .sort((a, b) => toward(a) - toward(b))[0];
      expect(next, 'the frontier ran out').toBeDefined();
      let r: string = 'Paid';
      while (r === 'Paid') r = revealTap(state, map, next);
    }
    expect(state.pendingDiscoveries).toContain(siteDiscoveryKey(target.id));
    // Sighted, not reached: its own cell is still under the fog.
    expect(fogState(state, map, target.location)).toBe('Discovered');
  });

  it('fires when a claimed sanctuary lifts the fog over another site', () => {
    const state = newGame(map, T0);
    const claimed = LANDMARKS[0];
    reveal(state, [claimed.location]);
    state.city.wallet.Gold = landmarkClaimCost(state, claimed) + 10;
    state.pendingDiscoveries = [];

    expect(claimLandmark(state, map, claimed.location)).toBe('Claimed');

    // Everything inside the lantern is now announced — and nothing outside it.
    for (const l of LANDMARKS) {
      const inside = near(l.location, claimed.location, FOG.claimDiscoverRadius);
      if (!inside) continue;
      expect(state.discoveries[siteDiscoveryKey(l.id)], `${l.id} went unannounced`)
        .toBe(true);
    }
    const unseen = LANDMARKS.find((l) =>
      fogState(state, map, l.location) === 'Undiscovered');
    if (unseen) expect(state.discoveries[siteDiscoveryKey(unseen.id)]).toBeUndefined();
  });

  it("fires when a building's fog radius lands near one", () => {
    const state = newGame(map, T0);
    const ruin = Object.values(RUINS).reduce((a, b) =>
      townhallDistance(map, a.location) <= townhallDistance(map, b.location) ? a : b);
    state.pendingDiscoveries = [];

    // A Sawmill dropped beside the ruin: its own radii do the revealing.
    addBuilt(state, 'Sawmill', { x: ruin.location.x, y: ruin.location.y - 2 });
    revealAroundDistrict(state, map,
      state.city.districts.find((d) => d.definitionId === 'Sawmill')!);

    expect(fogState(state, map, ruin.location)).not.toBe('Undiscovered');
    expect(state.pendingDiscoveries).toContain(siteDiscoveryKey(ruin.id));
  });
});
