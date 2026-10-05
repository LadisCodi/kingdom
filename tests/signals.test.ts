import { describe, expect, it } from 'vitest';
import { FOG } from '../src/sim/data/definitions';
import { tally } from '../src/sim/events';
import { explorationGate, fogState, isPayable, recordVisibleSites, revealTap } from '../src/sim/fog';
import { deserialize, serialize } from '../src/sim/save';
import { coordKey, parseCoordKey, type Coord, type GameState } from '../src/sim/state';
import { pickUpTreasure } from '../src/sim/treasures';
import { firstGame, fund, map, T0 } from './helpers';

const frontier = (state: GameState): Coord[] =>
  [...map.terrain.keys()].map(parseCoordKey)
    .filter((c) => fogState(state, map, c) === 'Discovered' && isPayable(state, map, c))
    .filter((c) => explorationGate(map, c) === null)
    .sort((a, b) => a.y - b.y || a.x - b.x);

function payReveal(state: GameState, cell: Coord): void {
  fund(state, { Gold: 1_000_000 });
  for (let i = 0; i < FOG.tapsToReveal; i++) {
    if (revealTap(state, map, cell) === 'Revealed') return;
  }
  throw new Error(`could not reveal ${coordKey(cell)}`);
}

describe('the playtest signals (Docs/playtest.md §5)', () => {
  it('notes when each silhouette is first sighted, and never moves it', () => {
    const state = firstGame();
    state.lastAdvance = T0 + 1000;
    recordVisibleSites(state, map);
    const first = { ...state.signals.sightedAt };
    expect(Object.keys(first).length).toBeGreaterThan(0);
    state.lastAdvance = T0 + 9000;
    recordVisibleSites(state, map);
    expect(state.signals.sightedAt).toEqual(first);
  });

  it('times a treasure from placed to picked up', () => {
    const state = firstGame();
    state.lastAdvance = T0;
    payReveal(state, frontier(state)[0]);
    expect(tally(state, 'signal:treasurePlaced')).toBe(1);
    const at = parseCoordKey(Object.keys(state.fog.treasures)[0]);
    payReveal(state, at);
    state.lastAdvance = T0 + 60_000;
    expect(pickUpTreasure(state, map, at).kind).toBe('PickedUp');
    expect(tally(state, 'signal:treasurePicked')).toBe(1);
    expect(state.signals.treasureWaitMs).toBe(60_000);
  });

  it('survives a save, and a kingdom from before starts them empty', () => {
    const state = firstGame();
    recordVisibleSites(state, map);
    state.signals.treasureWaitMs = 1234;
    state.signals.returnTaps.push({ at: T0, kind: 'store' });
    const file = serialize(state, T0);
    expect(deserialize(file, map, T0)!.signals).toEqual(state.signals);
    delete (file.Modules as Record<string, unknown>)['kingdom.signals'];
    expect(deserialize(file, map, T0)!.signals)
      .toEqual({ sightedAt: {}, discoveredAt: {}, treasureWaitMs: 0, returnTaps: [], playMs: 0 });
  });
});
