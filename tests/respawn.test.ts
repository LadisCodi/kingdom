// Finite-feature respawning: a drained Berry bush / Wild animals pack
// reappears in a random tile ADJACENT TO ITS ORIGINAL MAP CELL after
// respawn_seconds — or is gone for good when no valid cell remains.
import { describe, expect, it } from 'vitest';
import { HARVEST } from '../src/sim/data/definitions';
import { tapCell } from '../src/sim/harvest';
import { deserialize, serialize } from '../src/sim/save';
import { coordKey, parseCoordKey, type Coord, type GameState } from '../src/sim/state';
import { freshGame, map, reveal, T0, tickAt } from './helpers';

const ORIGIN = { x: 3, y: 1 }; // authored BerryBush
const RESPAWN_MS = HARVEST.Berries.respawnSeconds * 1000; // 120s

const chebyshev = (a: Coord, b: Coord) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

const bushCells = (state: GameState): Coord[] =>
  Object.entries(state.features)
    .filter(([, id]) => id === 'BerryBush')
    .map(([k]) => parseCoordKey(k));

const drain = (state: GameState, cell: Coord, t: number) => {
  reveal(state, [cell]);
  for (let i = 0; i < HARVEST.Berries.tapsToExhaust; i++) {
    expect(tapCell(state, map, cell, t)).toBe('Harvested');
  }
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
    // Block every neighbor of the origin (the Trees at (2,2) already block one).
    for (const c of [
      { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 1 },
      { x: 4, y: 1 }, { x: 3, y: 2 }, { x: 4, y: 2 },
    ]) {
      state.features[coordKey(c)] = 'Trees';
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
