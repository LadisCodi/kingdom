// Scouting rewards (Docs/features/19-world-map.md §3.2): what exploring a hex
// promises, and that only the explorer sent to it collects, once — at the
// player's tap on its hex.
import { describe, expect, it } from 'vitest';
import { advance } from '../src/sim/commands';
import { WORLD_SCOUTING } from '../src/sim/data/definitions';
import { serialize } from '../src/sim/save';
import { getWallet, type GameState } from '../src/sim/state';
import { generateBoard } from '../src/sim/world/board';
import { dispatchExplorer, finishExplorerWithGems, homeIndex, readyAt, returnsAt, revealExplored } from '../src/sim/world/explorers';
import { boardWithin, hexAt, hexDistance } from '../src/sim/world/hex';
import { scoutPay } from '../src/sim/world/scouting';
import { boardOf } from '../src/sim/world/source';
import { PORTAL_INDEX, boardNeighbors, hexIndex, localHex, miniBoardOf, rotate60, worldHex } from '../src/sim/world/hex';
import { freshGame, fund, map, T0 } from './helpers';

function exploring(): GameState {
  const state = freshGame();
  fund(state, { Gold: 1e9 });
  return state;
}

/** The city's neighbour whose promise is Gold, Wood, Food or Stone. */
const producing = (state: GameState) => boardNeighbors(homeIndex(state)).find((n) => {
  const s = boardOf(state.world.board).hexes[n].scout;
  return n !== PORTAL_INDEX && s !== null && ['Gold', 'Wood', 'Food', 'Stone'].includes(s.reward);
});

describe('what a hex promises', () => {
  const board = generateBoard('test', 0x5eed);

  it('is rolled for every hex but the cities, the Portal and the dungeons', () => {
    for (const h of board.hexes) {
      const none = h.seat !== null || h.role === 'portal' || h.features.includes('Dungeon');
      expect(h.scout === null).toBe(none);
    }
  });

  it('comes from its ring’s list, and is the same in every wedge past the inner ring', () => {
    for (const h of board.hexes) {
      if (h.scout === null || h.role === 'portal') continue;
      expect(WORLD_SCOUTING.rewards[h.role].map((e) => e.reward)).toContain(h.scout.reward);
      if (h.role === 'inner') continue;
      const twin = board.hexes[hexIndex(worldHex(miniBoardOf(h.hex), rotate60(localHex(h.hex))))];
      if (twin.scout !== null) expect(twin.scout).toEqual(h.scout);
    }
  });

  it('pays Gold, Wood, Food and Stone in the city’s production, floored', () => {
    const state = freshGame();
    const floor = { reward: 'Gold' as const, weight: 1, amount: 123, pack: null };
    expect(scoutPay(state, floor, 'home').wallet.Gold).toBeGreaterThanOrEqual(123);
    expect(scoutPay(state, { ...floor, reward: 'Stardust' }, 'inner').wallet).toEqual({ Stardust: 123 });
    const lump = scoutPay(state, { ...floor, reward: 'Precious' }, 'inner', 40).goods;
    expect(Object.values(lump)).toEqual([123]);
    expect(scoutPay(state, { reward: 'Pack', weight: 1, amount: 1, pack: 'Rose' }, 'inner'))
      .toEqual({ wallet: {}, goods: {}, pack: 'Rose' });
  });
});

describe('the tap on its hex pays it', () => {
  it('pays nothing while the explorer waits, then its target’s promise, once, at the tap', () => {
    const state = exploring();
    const target = producing(state);
    expect(target).toBeDefined();
    if (target === undefined) return;
    const scout = boardOf(state.world.board).hexes[target].scout!;
    const r = dispatchExplorer(state, target, T0);
    if (r.kind !== 'Sent') throw new Error(r.kind);
    advance(state, map, readyAt(r.trip) + 3_600_000);
    const before = getWallet(state.city.wallet, scout.reward as 'Gold');
    const tap = revealExplored(state, target, readyAt(r.trip) + 3_600_000);
    expect(tap.kind === 'Revealed' && tap.found.paid).not.toBeNull();
    expect(getWallet(state.city.wallet, scout.reward as 'Gold')).toBeGreaterThan(before);
    // Revealed now: nothing more to send an explorer for, and nothing more paid home.
    const after = getWallet(state.city.wallet, scout.reward as 'Gold');
    advance(state, map, returnsAt(r.trip));
    expect(getWallet(state.city.wallet, scout.reward as 'Gold')).toBe(after);
    expect(dispatchExplorer(state, target, returnsAt(r.trip) + 1).kind).not.toBe('Sent');
  });

  it('pays when the trip is finished with Gems, too', () => {
    const state = exploring();
    fund(state, { Gems: 1e6 });
    const target = boardNeighbors(homeIndex(state)).find((n) => n !== PORTAL_INDEX)!;
    const r = dispatchExplorer(state, target, T0);
    if (r.kind !== 'Sent') throw new Error(r.kind);
    const done = finishExplorerWithGems(state, r.trip.id, T0 + 1000);
    expect(done.kind === 'Finished' && done.finished.found?.paid).not.toBeNull();
  });

  it('pays its target even when another trip’s reveal uncovered it first: that trip was paid for', () => {
    const state = exploring();
    const home = homeIndex(state);
    // Two of the city's neighbours, two hexes apart: neither inside the other's
    // reveal, but each next to a hex both reveals reach.
    const ring = boardNeighbors(home).filter((n) => n !== PORTAL_INDEX);
    const [a, b] = ring.flatMap((x) => ring.filter((y) => hexDistance(hexAt(x), hexAt(y)) === 2).map((y) => [x, y]))[0];
    state.world.explorersBought = 1;
    const far = dispatchExplorer(state, a, T0);
    const near = dispatchExplorer(state, b, T0);
    if (far.kind !== 'Sent' || near.kind !== 'Sent') throw new Error('not sent');
    expect(boardWithin(b, near.trip.radius)).not.toContain(a);
    const tap = Math.max(readyAt(far.trip), readyAt(near.trip));
    expect(revealExplored(state, b, tap).kind).toBe('Revealed');
    const second = revealExplored(state, a, tap);
    expect(second.kind === 'Revealed' && (boardOf(state.world.board).hexes[a].scout === null || second.found.paid !== null)).toBe(true);
  });

  it('replays in one call as it ticks', () => {
    const play = (step: number) => {
      const state = exploring();
      const target = boardNeighbors(homeIndex(state)).find((n) => n !== PORTAL_INDEX)!;
      const r = dispatchExplorer(state, target, T0);
      if (r.kind !== 'Sent') throw new Error(r.kind);
      const tap = readyAt(r.trip) + 60_000;
      const end = tap + 3_600_000;
      for (let t = T0 + step; t < tap; t += step) advance(state, map, t);
      advance(state, map, tap);
      revealExplored(state, target, tap);
      for (let t = tap + step; t < end; t += step) advance(state, map, t);
      advance(state, map, end);
      return { state, end };
    };
    const once = play(1e12);
    const stepped = play(7_000);
    expect(serialize(stepped.state, stepped.end)).toEqual(serialize(once.state, once.end));
  });
});
