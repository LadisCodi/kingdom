// Finite-feature respawning: a drained Berry bush / Wild animals pack
// reappears in a random tile ADJACENT TO ITS ORIGINAL MAP CELL after
// respawn_seconds — or is gone for good when no valid cell remains.
import { describe, expect, it } from 'vitest';
import { HARVEST } from '../src/sim/data/definitions';
import { tapCell } from '../src/sim/harvest';
import { deserialize, serialize } from '../src/sim/save';
import { coordKey, parseCoordKey, type Coord, type GameState } from '../src/sim/state';
import { BERRIES, canGather, freshGame, map, reveal, T0, tickAt } from './helpers';

const ORIGIN = BERRIES; // the one authored BerryBush
const RESPAWN_MS = HARVEST.Berries.respawnSeconds * 1000; // 120s

const chebyshev = (a: Coord, b: Coord) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

const bushCells = (state: GameState): Coord[] =>
  Object.entries(state.features)
    .filter(([, id]) => id === 'BerryBush')
    .map(([k]) => parseCoordKey(k));

// Tap until the bush stops answering. Written against the DEPOT rather than a
// tap count, so it survives a change to `tap.work_seconds` or to Berries' stock.
const drain = (state: GameState, cell: Coord, t: number) => {
  reveal(state, [cell]);
  canGather(state); // berries sit behind Forestry now
  let taken = 0;
  while (tapCell(state, map, cell, t) === 'Harvested') {
    if (++taken > 100) throw new Error('bush never drained');
  }
  expect(taken).toBeGreaterThan(0);
};

describe('feature respawning', () => {
  it('a drained bush reappears adjacent to its origin after respawn_seconds', () => {
    const state = freshGame();
    const bushesBefore = bushCells(state).length;
    drain(state, ORIGIN, T0);
    expect(state.features[coordKey(ORIGIN)]).toBeUndefined();
    expect(state.featureRespawns).toHaveLength(1);

    tickAt(state, T0 + RESPAWN_MS - 1000);
    expect(bushCells(state)).toHaveLength(bushesBefore - 1); // still gone
    tickAt(state, T0 + RESPAWN_MS);
    const bushes = bushCells(state);
    expect(bushes).toHaveLength(bushesBefore);
    const respawned = bushes.find((c) => chebyshev(c, ORIGIN) === 1)!;
    expect(respawned).toBeDefined();
    expect(coordKey(respawned)).not.toBe(coordKey(ORIGIN)); // adjacent, never on it
    expect(state.featureRespawns).toHaveLength(0);
  });

  it('respawn distance is measured from the ORIGINAL cell, not the last spawn', () => {
    const state = freshGame();
    drain(state, ORIGIN, T0);
    tickAt(state, T0 + RESPAWN_MS);
    const first = bushCells(state).find((c) => chebyshev(c, ORIGIN) === 1)!;

    drain(state, first, T0 + RESPAWN_MS);
    tickAt(state, T0 + 2 * RESPAWN_MS);
    const second = bushCells(state).find((c) => chebyshev(c, ORIGIN) === 1)!;
    expect(second).toBeDefined(); // adjacent to (3,1) again — wherever it last stood
  });

  it('with no valid neighbor left, the feature is removed for good', () => {
    const state = freshGame();
    // Block every neighbour the bush could possibly land on. Derived from the
    // map rather than listed by hand, so moving the bush on the Map sheet
    // cannot quietly turn this into a test of nothing.
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const c = { x: ORIGIN.x + dx, y: ORIGIN.y + dy };
        if (map.terrain.has(coordKey(c))) state.features[coordKey(c)] = 'Trees';
      }
    }
    drain(state, ORIGIN, T0);
    tickAt(state, T0 + RESPAWN_MS + 1000);
    expect(bushCells(state).some((c) => chebyshev(c, ORIGIN) <= 1)).toBe(false);
    expect(state.featureRespawns).toHaveLength(0); // dropped, not retried
  });

  it('a pending respawn survives the save and lands during the absence', () => {
    const state = freshGame();
    drain(state, ORIGIN, T0);
    const restored = deserialize(serialize(state, T0 + 1000), map, T0 + RESPAWN_MS + 5000)!;
    const respawned = bushCells(restored).find((c) => chebyshev(c, ORIGIN) === 1);
    expect(respawned).toBeDefined();
    expect(restored.featureRespawns).toHaveLength(0);
  });

  it('one-call replay places respawns exactly like stepped ticking', () => {
    const mk = () => {
      const s = freshGame();
      drain(s, ORIGIN, T0);
      return s;
    };
    const oneCall = mk();
    tickAt(oneCall, T0 + RESPAWN_MS + 30_000);
    const stepped = mk();
    for (let t = 1000; t <= RESPAWN_MS + 30_000; t += 1000) tickAt(stepped, T0 + t);
    expect(oneCall.features).toEqual(stepped.features);
    expect(oneCall.featureMeta).toEqual(stepped.featureMeta);
  });
});
