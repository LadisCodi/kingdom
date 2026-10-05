// Armies from the player's side (Docs/features/19-world-map.md §4, §6): the
// party leaves the city, its heroes are busy, and what is left comes home.
import { describe, expect, it } from 'vitest';
import { advance } from '../src/sim/commands';
import { WORLD, WORLD_BUILD } from '../src/sim/data/definitions';
import { armySize } from '../src/sim/army';
import { heroCanFight } from '../src/sim/heroHealth';
import { SEAT_INDICES } from '../src/sim/world/board';
import { armySlots, heroAway } from '../src/sim/world/armies';
import { homeIndex } from '../src/sim/world/explorers';
import { homeboundMs, outboundMs } from '../src/sim/world/travel';
import { boardNeighbors, hexAt, hexDistance } from '../src/sim/world/hex';
import { deserialize, serialize } from '../src/sim/save';
import { LocalWorldServer, memoryStore } from '../src/worldServer/local';
import { hexActions } from '../src/ui/world/worldActions';
import { HexCamera } from '../src/render/world/hexCamera';
import type { Game } from '../src/game';
import { freshGame, freshPresenter, fund, map, T0 } from './helpers';

/** How long a district takes to build: the claim. */
const CLAIM_MS = WORLD_BUILD.claim.buildSeconds * 1000;
/** The server's rules, read as if the hex were explored: the fog is the
 *  sheet's to apply (tests/worldScene.test.ts holds it there). */
const SEEN = { revealed: true };

/** A connected player with soldiers, and a rival who holds the hex beside
 *  the player's city — claimed by hand through the dev seat. */
async function frontier(): Promise<{ game: Game; clock: { t: number }; target: number; toasts: string[] }> {
  const game = freshPresenter(freshGame());
  const clock = { t: T0 };
  game.now = () => clock.t;
  game.worldCamera = new HexCamera({ clientWidth: 390, clientHeight: 844 });
  game.worldServer = new LocalWorldServer(memoryStore(), () => clock.t);
  const toasts: string[] = [];
  game.onToast((m) => toasts.push(m));
  await game.connectWorld();
  fund(game.state, { Gold: 100_000 });
  for (let i = 0; i < 40; i++) game.state.army.push({ uniqueId: `w${i}`, definitionId: 'Warrior' });
  const me = game.state.world.board.seat;
  const rival = (me + 1) % 6;
  // The rival claims its way to the player's door.
  game.actingSeat = rival;
  let target = -1;
  for (let step = 0; step < 4 && target < 0; step++) {
    const source = game.worldSource();
    const board = source.board();
    const options = board.hexes.filter((h) => hexActions(source, rival, h, SEEN).some((a) => a.kind === 'claim'));
    const beside = options.find((h) => boardNeighbors(SEAT_INDICES[me]).includes(h.index));
    const next = beside ?? options.sort((a, b) => dist(a.index, SEAT_INDICES[me]) - dist(b.index, SEAT_INDICES[me]))[0];
    await game.doClaimHex(next.index, 0);
    clock.t += CLAIM_MS;
    await game.refreshWorld();
    if (beside !== undefined) target = beside.index;
  }
  game.actingSeat = null;
  return { game, clock, target, toasts };
}

const dist = (a: number, b: number): number => hexDistance(hexAt(a), hexAt(b));

describe('an army on the board', () => {
  it('leaves with its troops and its heroes, takes the ground, and comes home', async () => {
    const { game, clock, target } = await frontier();
    expect(target).toBeGreaterThanOrEqual(0);
    expect(armySlots(game.state)).toBe(WORLD.armySlots);
    const before = armySize(game.state);

    game.openArmy(target, 'attack');
    expect(game.openOverlay).toBe('army');
    expect(game.armyBlockText()).toBeNull();
    const hero = game.partyHeroes[0];
    const route = game.armyRoute(target)!;
    expect(route.path).toEqual([homeIndex(game.state), target]);
    await game.doSendArmy();
    expect(game.state.world.armies).toHaveLength(1);
    expect(heroAway(game.state, hero)).toBe(true);
    expect(heroCanFight(game.state, hero, clock.t)).toBe(false);
    // Away, but still the kingdom's: the halls' cap still counts them.
    expect(armySize(game.state)).toBe(before);
    expect(game.state.army.length).toBeLessThan(before);

    // Every army slot is out.
    game.openArmy(target, 'attack');
    expect(game.armyBlockText()).toMatch(/Every army is out/);
    game.dismiss();

    clock.t += outboundMs(route.stepMs);
    await game.refreshWorld();
    expect(game.worldSource().hexOf(target)?.owner).toBe(game.state.world.board.seat);

    clock.t += homeboundMs(route.stepMs);
    advance(game.state, map, clock.t);
    await game.refreshWorld();
    expect(game.state.world.armies).toEqual([]);
    expect(heroAway(game.state, hero)).toBe(false);
    expect(game.state.army.length).toBe(before);
  });

  it('keeps an army out through a reload', async () => {
    const { game, clock, target } = await frontier();
    game.openArmy(target, 'attack');
    await game.doSendArmy();
    const loaded = deserialize(serialize(game.state, clock.t), map, clock.t)!;
    expect(loaded.world.armies).toEqual(game.state.world.armies);
    expect(armySize(loaded)).toBe(armySize(game.state));
  });
});
