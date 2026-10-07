// Watching a fight that has already happened
// (Docs/features/11a-ruins-ui.md §2.5, Docs/features/combat.md §13).
//
// The screen is a pure function of these four fields and one clock, which is
// why the machine lives on the presenter: the phases, the two-second pause
// and the hand-off to the reveal are decisions, and decisions belong where
// they can be tested without a DOM.
import { describe, expect, it } from 'vitest';
import { advance } from '../src/sim/commands';
import { BATTLE_RESULT_DELAY_MS } from '../src/game';
import { UNIT_CREATURE_AVATAR } from '../src/render/lairMap';
import { COMBAT, LAIRS } from '../src/sim/data/definitions';
import { firstClearLump } from '../src/sim/knowledge';
import { buildBoard, resolveBattle } from '../src/sim/battle';
import { LocalWorldServer, memoryStore } from '../src/worldServer/local';
import type { DelveResult, WorldSnapshot } from '../src/worldServer/types';
import { getWallet, type GameState, type UnitId } from '../src/sim/state';
import {
  addAllTrainers, freshGame, freshPresenter, fund, map, reveal, T0, toLastFight } from './helpers';

const ORCS = 'Orcs' as const;

function mustered(units: Partial<Record<UnitId, number>> = { Warrior: 60 }): GameState {
  const state = freshGame();
  addAllTrainers(state);
  fund(state, { Gold: 200_000, Food: 90_000, Wood: 90_000, Stone: 40_000 });
  reveal(state, [LAIRS[ORCS].location]);
  // Standing, and not counting: these are about the screen, not the clock.
  state.lairs[ORCS] = { armedAt: 0, nextRaidAt: null, hoard: {}, defeated: false, cleared: false };
  for (const [unitId, n] of Object.entries(units)) {
    for (let i = 0; i < n!; i++) {
      state.army.push({ uniqueId: `u_${unitId}_${i}`, definitionId: unitId as UnitId });
    }
  }
  return state;
}

/** A presenter whose clock the test owns. */
const atTheDoor = (units?: Partial<Record<UnitId, number>>) => {
  const game = freshPresenter(mustered(units));
  let clock = T0;
  game.now = () => clock;
  game.state.lastAdvance = clock;
  return { game, tick: (ms: number) => { clock += ms; game.advanceBattle(clock); } };
};

describe('a lair attack opens the playback', () => {
  it('resolves everything first, and only then starts the replay', () => {
    const { game } = atTheDoor();
    toLastFight(game.state, ORCS);
    game.openLair(ORCS);
    const knowledge = getWallet(game.state.kingdom.wallet, 'Knowledge');
    game.doAttackLair();
    // The garrison is beaten the instant the button is pressed — the screen
    // is watching something that already happened — but nothing is paid:
    // the reward waits on the lair's card, for the claim.
    expect(game.lairFor(ORCS)!.defeated).toBe(true);
    expect(game.lairIsCleared(ORCS)).toBe(false);
    expect(getWallet(game.state.kingdom.wallet, 'Knowledge')).toBe(knowledge);
    const battle = game.battle!;
    expect(battle.phase).toBe('playing');
    expect(battle.log.winner).toBe('ours');
    expect(battle.log.events[0]!.kind).toBe('start');
    expect(battle.prizes).toEqual([]);
    // The enemy wears the lair's creatures in the playback, not our soldiers.
    expect(battle.enemyFaces).toEqual(UNIT_CREATURE_AVATAR);
  });

  it('walks playing → result → done on the clock — the spoils are the claim\'s', () => {
    const { game, tick } = atTheDoor();
    toLastFight(game.state, ORCS);
    game.openLair(ORCS);
    game.doAttackLair();
    const battle = game.battle!;
    const fight = battle.log.ticks * COMBAT.tickMs;

    tick(fight - 100);
    expect(game.battle!.phase).toBe('playing');
    // The last blow lands, and the plaque waits two seconds behind it.
    tick(200);
    expect(game.battle!.phase).toBe('result');
    tick(BATTLE_RESULT_DELAY_MS - 300);
    expect(game.battle!.phase).toBe('result');
    tick(400);
    // No spoils on the field: a lair pays when it is claimed.
    expect(game.battle!.phase).toBe('done');
    expect(game.battleTick(battle.startedAt)).toBe(0);
    expect(game.battleTick(battle.startedAt + 5 * COMBAT.tickMs)).toBe(5);
    expect(game.battleTick(battle.startedAt + 10 * 60_000)).toBe(battle.log.ticks);
  });

  it('holds the replay for a heavy blow, then walks on from where it stood', () => {
    const { game, tick } = atTheDoor();
    game.openLair(ORCS);
    game.doAttackLair();
    const at = game.battle!.startedAt;
    tick(500);
    expect(game.battleMs(at + 500)).toBe(500);
    game.holdBattle(80);
    // Frozen for the hold — never earlier, never later…
    expect(game.battleMs(at + 540)).toBe(500);
    expect(game.battleMs(at + 580)).toBe(500);
    // …then on at the playback's speed.
    expect(game.battleMs(at + 680)).toBe(600);
    // The end still stands at the end.
    expect(game.battleMs(at + 10 * 60_000)).toBe(game.battle!.log.ticks * COMBAT.tickMs);
  });

  it('runs a slow stretch slower, then at speed again — with nothing to switch it back', () => {
    const { game, tick } = atTheDoor();
    game.openLair(ORCS);
    game.doAttackLair();
    const at = game.battle!.startedAt;
    tick(500);
    game.slowBattle(0.25, 400);
    expect(game.battleMs(at + 700)).toBe(550);
    expect(game.battleMs(at + 900)).toBe(600);
    // Past the stretch the clock runs at full speed from where it got to.
    expect(game.battleMs(at + 1000)).toBe(700);
    // A hold inside a slow stretch freezes it, and what is left of the
    // stretch runs slow after it (still at +500 here: 500 ms of fight).
    game.slowBattle(0.5, 400);
    game.holdBattle(100);
    expect(game.battleMs(at + 600)).toBe(500);
    expect(game.battleMs(at + 700)).toBe(550);
    expect(game.battleMs(at + 900)).toBe(650);
    expect(game.battleMs(at + 1000)).toBe(750);
  });
});

describe('the lair opens the same screen', () => {
  it('plays the fight, and leaves the hoard and the lump for the claim', () => {
    const state = mustered();
    advance(state, map, T0); // arm the lair
    state.lairs[ORCS] = { armedAt: 0, nextRaidAt: null, hoard: { Gold: 40 }, defeated: false, cleared: false };
    const game = freshPresenter(state);
    let clock = T0;
    game.now = () => clock;
    toLastFight(game.state, ORCS);
    game.openLair(ORCS);
    const lump = firstClearLump(game.state);
    game.doAttackLair();
    const battle = game.battle!;
    expect(battle.log.winner).toBe('ours');
    expect(battle.prizes).toEqual([]);
    // Back on the lair's card, where Claim pays the hoard and the lump.
    expect(game.inspectedSite).toEqual(LAIRS[ORCS].location);
    const gold = getWallet(game.state.city.wallet, 'Gold');
    const knowledge = getWallet(game.state.kingdom.wallet, 'Knowledge');
    game.doClaimLair(ORCS);
    expect(game.lairIsCleared(ORCS)).toBe(true);
    expect(getWallet(game.state.city.wallet, 'Gold')).toBe(gold + 40);
    expect(getWallet(game.state.kingdom.wallet, 'Knowledge')).toBe(knowledge + lump);
    expect(game.inspectedSite).toBeNull();
    expect(game.vanishingLairs.has(ORCS)).toBe(true);
  });
});

describe('a world fight wears the right faces and ground', () => {
  /** A seated presenter whose server answers every fight with `boss`. */
  async function fighting(boss: boolean) {
    const game = freshPresenter(freshGame());
    let clock = T0;
    game.now = () => clock;
    const server = new LocalWorldServer(memoryStore(), () => clock);
    game.worldServer = server;
    await game.connectWorld();
    await game.doJoinWorld('Mel');
    clock += 1000;
    const answer = async (): Promise<DelveResult> => ({
      ok: true, won: true, depth: 0, room: 1, boss, lost: 0,
      log: resolveBattle(buildBoard([{ unitId: 'Warrior', count: 20 }], []), buildBoard([{ unitId: 'Archer', count: 5 }], [])),
      snapshot: { ...(game.worldView as WorldSnapshot), effects: [] },
    });
    server.delveRoom = answer;
    server.descendPortal = answer;
    return game;
  }

  it('draws a dungeon room’s squads as the creatures the delve screen shows, on a dungeon floor', async () => {
    const game = await fighting(false);
    await game.doDelveRoom('a1');
    expect(game.battle!.enemyFaces).toEqual(UNIT_CREATURE_AVATAR);
    expect(game.battle!.backdrop).toBe('dungeon');
  });

  it('puts a boss room in the boss hall', async () => {
    const game = await fighting(true);
    await game.doDelveRoom('a1');
    expect(game.battle!.backdrop).toBe('boss');
  });

  it('draws the Portal’s squads as creatures too, in its depths', async () => {
    const game = await fighting(false);
    await game.doDescendPortal('a1');
    expect(game.battle!.enemyFaces).toEqual(UNIT_CREATURE_AVATAR);
    expect(game.battle!.backdrop).toBe('portal');
  });
});
