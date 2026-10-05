// Holding ground, from the player's side (Docs/features/19-world-map.md
// §5–§7): the client asks the world server — the local stand-in here — and
// pays in Gold and a builder's time.
import { describe, expect, it } from 'vitest';
import { advance } from '../src/sim/commands';
import { WORLD_BUILD } from '../src/sim/data/definitions';
import { busyBuilders, getWallet } from '../src/sim/state';
import { SEAT_INDICES } from '../src/sim/world/board';
import { boardNeighbors } from '../src/sim/world/hex';
import { LocalWorldServer, memoryStore } from '../src/worldServer/local';
import { hexActions, hexWork } from '../src/ui/world/worldActions';
import { gemsToFinish } from '../src/sim/rush';
import { fittingImprovements } from '../src/worldServer/core';
import type { Game } from '../src/game';
import { freshGame, freshPresenter, fund, map, T0 } from './helpers';
import { HexCamera } from '../src/render/world/hexCamera';

const OUTPOST_MS = WORLD_BUILD.outpost.buildSeconds * 1000;
/** The server's rules, read as if the hex were explored: the fog is the
 *  sheet's to apply (tests/worldScene.test.ts holds it there). */
const SEEN = { revealed: true };

async function connected(): Promise<{ game: Game; clock: { t: number }; toasts: string[] }> {
  const game = freshPresenter(freshGame());
  const clock = { t: T0 };
  game.now = () => clock.t;
  game.worldCamera = new HexCamera({ clientWidth: 390, clientHeight: 844 });
  game.worldServer = new LocalWorldServer(memoryStore());
  const toasts: string[] = [];
  game.onToast((m) => toasts.push(m));
  await game.connectWorld();
  // The rivals asleep, so only what the test does moves.
  return { game, clock, toasts };
}

/** A hex beside the player's city that can be claimed and can take a
 *  producing improvement. */
function claimable(game: Game): number {
  const source = game.worldSource();
  const board = source.board();
  return boardNeighbors(SEAT_INDICES[game.state.world.board.seat]).find((n) =>
    hexActions(source, game.worldSeat(), board.hexes[n], SEEN).some((a) => a.kind === 'claim'))!;
}

describe('connecting to the world server', () => {
  it('keeps the board the player already explored', async () => {
    const game = freshPresenter(freshGame());
    game.now = () => T0;
    const before = { ...game.state.world.board };
    game.worldServer = new LocalWorldServer(memoryStore());
    await game.connectWorld();
    expect(game.state.world.board).toEqual(before);
    expect(game.worldView?.seats.filter((s) => s.bot)).toHaveLength(5);
  });
});

describe('claiming with a builder', () => {
  it('pays the Outpost in Gold and holds a builder until it stands', async () => {
    const { game, clock, toasts } = await connected();
    fund(game.state, { Gold: 100_000 });
    const at = claimable(game);
    const before = getWallet(game.state.city.wallet, 'Gold');
    const offer = hexActions(game.worldSource(), game.worldSeat(), game.worldSource().board().hexes[at], SEEN)[0];
    expect(offer.kind).toBe('claim');
    await game.doClaimHex(at, offer.kind === 'claim' ? offer.gold : 0);
    expect(getWallet(game.state.city.wallet, 'Gold')).toBe(before - WORLD_BUILD.outpost.gold);
    expect(busyBuilders(game.state)).toBe(1);
    expect(game.worldSource().hexOf(at)?.held).toBe(false);

    // Every builder is busy: a second claim is refused before it is sent,
    // and raises the builder sheet with the builder out on the board.
    const second = boardNeighbors(SEAT_INDICES[game.state.world.board.seat]).find((n) => n !== at
      && hexActions(game.worldSource(), game.worldSeat(), game.worldSource().board().hexes[n], SEEN).some((a) => a.kind === 'claim'));
    if (second !== undefined) {
      const toastsBefore = toasts.length;
      await game.doClaimHex(second, 0);
      expect(toasts).toHaveLength(toastsBefore);
      expect(game.openOverlay).toBe('builder');
      expect(game.builderWorldJobs()).toHaveLength(1);
      expect(game.builderWorldJobs()[0].durationMs).toBe(OUTPOST_MS);
      expect(game.builderAskJob()?.verb).toBe('Claim');
      expect(busyBuilders(game.state)).toBe(1);
    }

    clock.t = T0 + OUTPOST_MS;
    const r = advance(game.state, map, clock.t);
    expect(r.worldBuildsDone.map((b) => b.index)).toEqual([at]);
    expect(busyBuilders(game.state)).toBe(0);
    await game.refreshWorld();
    expect(game.worldSource().hexOf(at)?.held).toBe(true);
    expect(game.worldSource().controlOf(at)?.owner.you).toBe(true);
  });

  it('refuses a claim it cannot afford, and pays nothing', async () => {
    const { game, toasts } = await connected();
    fund(game.state, { Gold: 0 });
    await game.doClaimHex(claimable(game), WORLD_BUILD.outpost.gold);
    expect(toasts.at(-1)).toBe('Not enough Gold');
    expect(busyBuilders(game.state)).toBe(0);
  });
});

describe('building and collecting', () => {
  it('builds an improvement, fills its store, and collects it into the purse', async () => {
    const { game, clock } = await connected();
    fund(game.state, { Gold: 100_000, Wood: 0, Food: 0, Stone: 0 });
    const board = game.worldSource().board();
    const at = boardNeighbors(SEAT_INDICES[game.state.world.board.seat]).find((n) =>
      hexActions(game.worldSource(), game.worldSeat(), board.hexes[n], SEEN).some((a) => a.kind === 'claim')
      // Every city has a forest beside it (19 §9), so a Logging Camp fits.
      && fittingImprovements(board.hexes[n]).includes('LoggingCamp'))!;
    await game.doClaimHex(at, WORLD_BUILD.outpost.gold);
    clock.t += OUTPOST_MS;
    advance(game.state, map, clock.t);
    await game.refreshWorld();
    const build = hexActions(game.worldSource(), game.worldSeat(), board.hexes[at], SEEN).find((a) => a.kind === 'build'
      && WORLD_BUILD.improvements[a.improvement].produces !== '');
    if (build === undefined || build.kind !== 'build') throw new Error('no producing improvement offered');
    await game.doBuildHex(at, build.improvement, 1, build.gold);
    clock.t += build.seconds * 1000 + 10 * 3_600_000;
    advance(game.state, map, clock.t);
    await game.refreshWorld();
    const produces = WORLD_BUILD.improvements[build.improvement].produces as 'Wood' | 'Food' | 'Stone';
    const before = getWallet(game.state.city.wallet, produces);
    await game.doCollectHex(at);
    expect(getWallet(game.state.city.wallet, produces)).toBeGreaterThan(before);
  });
});

describe('playing as a rival', () => {
  it('claims ground for that seat, free', async () => {
    const { game } = await connected();
    fund(game.state, { Gold: 0 });
    const rival = game.worldView!.seats.find((s) => !s.you)!.seat;
    game.actingSeat = rival;
    const board = game.worldSource().board();
    const at = boardNeighbors(SEAT_INDICES[rival]).find((n) =>
      hexActions(game.worldSource(), rival, board.hexes[n], SEEN).some((a) => a.kind === 'claim'))!;
    await game.doClaimHex(at, 0);
    expect(game.worldSource().hexOf(at)?.owner).toBe(rival);
    expect(busyBuilders(game.state)).toBe(0);
    expect(game.worldSource().controlOf(at)?.owner.you).toBe(false);
  });
});

// A builder's work on the board can be finished with Gems, like every other
// wait: the server makes it stand, the client pays and the builder comes home.
describe('finishing a world build with Gems', () => {
  it('makes the Outpost stand at once, for the time it had left', async () => {
    const { game, clock } = await connected();
    fund(game.state, { Gold: 100_000 });
    const at = claimable(game);
    await game.doClaimHex(at, WORLD_BUILD.outpost.gold);
    clock.t += 60_000;
    const work = hexWork(game.worldSource().hexOf(at)!)!;
    expect(work.startedAt).toBe(T0);
    expect(work.endsAt).toBe(T0 + OUTPOST_MS);
    const gems = gemsToFinish((work.endsAt - clock.t) / 1000);
    game.state.player.wallet.Gems = gems;
    await game.doFinishHexWork(at);
    expect(game.state.player.wallet.Gems).toBe(0);
    expect(busyBuilders(game.state)).toBe(0);
    expect(game.worldSource().hexOf(at)?.held).toBe(true);
    expect(game.worldSource().controlOf(at)?.owner.you).toBe(true);
  });

  it('raises a level at once, and refuses with nothing building', async () => {
    const { game, clock, toasts } = await connected();
    fund(game.state, { Gold: 100_000 });
    const board = game.worldSource().board();
    const at = boardNeighbors(SEAT_INDICES[game.state.world.board.seat]).find((n) =>
      hexActions(game.worldSource(), game.worldSeat(), board.hexes[n], SEEN).some((a) => a.kind === 'claim')
      && fittingImprovements(board.hexes[n]).includes('LoggingCamp'))!;
    await game.doClaimHex(at, WORLD_BUILD.outpost.gold);
    clock.t += OUTPOST_MS;
    advance(game.state, map, clock.t);
    await game.refreshWorld();
    game.state.player.wallet.Gems = 1e6;
    await game.doFinishHexWork(at); // nothing is building: nothing happens
    expect(game.state.player.wallet.Gems).toBe(1e6);
    await game.doBuildHex(at, 'LoggingCamp', 1, WORLD_BUILD.improvements.LoggingCamp.levels[0].gold);
    expect(busyBuilders(game.state)).toBe(1);
    await game.doFinishHexWork(at);
    expect(busyBuilders(game.state)).toBe(0);
    expect(game.worldSource().hexOf(at)?.improvement).toEqual({ kind: 'LoggingCamp', level: 1 });
    expect(toasts.at(-1)).toMatch(/reached level 1/);
  });

  it('is not finished without the Gems', async () => {
    const { game } = await connected();
    fund(game.state, { Gold: 100_000 });
    const at = claimable(game);
    await game.doClaimHex(at, WORLD_BUILD.outpost.gold);
    game.state.player.wallet.Gems = 0;
    await game.doFinishHexWork(at);
    expect(busyBuilders(game.state)).toBe(1);
    expect(game.worldSource().hexOf(at)?.held).toBe(false);
  });
});
