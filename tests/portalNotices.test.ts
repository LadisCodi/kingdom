// The Dark Portal's notices (Docs/features/26-notices.md §2): its opening is
// news, once an opening; its close pays the ranking as a prize to claim.
import { describe, expect, it, vi } from 'vitest';
import { WORLD_PORTAL } from '../src/sim/data/definitions';
import { newsOf } from '../src/sim/notices';
import { deserialize, serialize } from '../src/sim/save';
import { portalEvent, portalOpensAt } from '../src/worldServer/core';
import { LocalWorldServer, memoryStore } from '../src/worldServer/local';
import type { WorldEffect, WorldSnapshot } from '../src/worldServer/types';
import { allNotices } from '../src/ui/notices/model';
import type { Game } from '../src/game';
import { freshGame, freshPresenter, map, T0 } from './helpers';

vi.mock('../src/render/sprites', () => ({ spriteUrl: () => null, buildingArtUrl: () => null, spriteImg: () => null, spriteImgAt: () => null }));

async function seated(): Promise<{ game: Game; clock: { t: number } }> {
  const game = freshPresenter(freshGame());
  const clock = { t: T0 };
  game.now = () => clock.t;
  game.worldServer = new LocalWorldServer(memoryStore(), () => clock.t);
  await game.connectWorld();
  await game.doJoinWorld('Mel');
  return { game, clock };
}

/** The last snapshot again, carrying `effects` past the last one applied. */
function deliver(game: Game, ...effects: WorldEffect[]): void {
  const snap = game.worldView as WorldSnapshot;
  let seq = game.state.world.effectSeq;
  (game as unknown as { applyWorldSnapshot(s: WorldSnapshot): void })
    .applyWorldSnapshot({ ...snap, effects: effects.map((e) => ({ ...e, seq: ++seq })) });
}

describe('the Portal in the notices', () => {
  it('announces an opening once, even after its news is read', async () => {
    const { game, clock } = await seated();
    expect(newsOf(game.state, 'portal')).toHaveLength(0);
    clock.t = portalOpensAt(portalEvent(T0) + 1) + 1000;
    await game.refreshWorld();
    await game.refreshWorld();
    expect(newsOf(game.state, 'portal').map((n) => n.group === 'portal' && n.open)).toEqual([true]);
    game.openNotice('news:portal');
    await game.refreshWorld();
    expect(newsOf(game.state, 'portal')).toHaveLength(0);
  });

  it('keeps a ranked place’s Gems to claim, through a save, and files a place that pays nothing as news', async () => {
    const { game } = await seated();
    const at = game.now();
    const gems = WORLD_PORTAL.rankGems[0];
    deliver(game,
      { kind: 'portalClosed', at, event: 7, place: 1, of: 5, floor: 12, gems },
      { kind: 'portalClosed', at, event: 7, place: 1, of: 5, floor: 12, gems }, // the same opening again
      { kind: 'portalClosed', at, event: 8, place: 9, of: 9, floor: 1, gems: 0 });
    expect(game.portalPrizes().map((p) => p.event)).toEqual([7]);
    expect(newsOf(game.state, 'portal').map((n) => n.key)).toEqual(['portal:closed:8']);
    expect(allNotices(game).find((n) => n.id === 'state:portalPrize')?.action?.label).toBe('Claim');

    const back = deserialize(serialize(game.state, at), map, at)!;
    expect(back.world.portalPrizes).toEqual(game.state.world.portalPrizes);

    const before = game.state.player.wallet.Gems ?? 0;
    game.claimPortalPrize(7);
    expect(game.state.player.wallet.Gems).toBe(before + gems);
    expect(game.portalPrizes()).toHaveLength(0);
    expect(allNotices(game).some((n) => n.id === 'state:portalPrize')).toBe(false);
  });
});
