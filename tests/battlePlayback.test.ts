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
import { COMBAT, RUINS } from '../src/sim/data/definitions';
import { getWallet, type GameState, type UnitId } from '../src/sim/state';
import {
  addAllTrainers, freshGame, freshPresenter, fund, map, openRuin, reveal, T0,
} from './helpers';

const BARROW = 'HollowBarrow' as const;

function mustered(units: Partial<Record<UnitId, number>> = { Warrior: 60 }): GameState {
  const state = freshGame();
  addAllTrainers(state);
  fund(state, { Gold: 200_000, Food: 90_000, Wood: 90_000, Stone: 40_000 });
  reveal(state, [RUINS[BARROW].location]);
  openRuin(state, BARROW);
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

describe('entering a room opens the playback', () => {
  it('resolves everything first, and only then starts the replay', () => {
    const { game } = atTheDoor();
    game.openExpedition(BARROW);
    const gold = getWallet(game.state.city.wallet, 'Gold');
    game.doLaunchExpedition();
    // The room is cleared and paid the instant the button is pressed: the
    // screen is watching something that already happened.
    expect(game.ruinProgress(BARROW).cleared).toBe(1);
    expect(getWallet(game.state.city.wallet, 'Gold')).not.toBe(gold);
    const battle = game.battle!;
    expect(battle.phase).toBe('playing');
    expect(battle.log.winner).toBe('ours');
    expect(battle.log.events[0]!.kind).toBe('start');
    expect(battle.prizes.length).toBeGreaterThan(0);
  });

  it('walks playing → result → rewards → done on the clock', () => {
    const { game, tick } = atTheDoor();
    game.openExpedition(BARROW);
    game.doLaunchExpedition();
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
    // The spoils are handed to the reveal — the one screen that already
    // knows how to deal things one at a time.
    expect(game.battle!.phase).toBe('rewards');
    expect(game.gachaReveal!.prizes).toEqual(battle.prizes);
    expect(game.gachaReveal!.caption).toBe('Spoils');
    // …and the way out appears when the player has finished with it.
    game.dismissGachaReveal();
    tick(0);
    expect(game.battle!.phase).toBe('done');
  });

  it('has nothing to deal after a defeat, and says so straight away', () => {
    const { game, tick } = atTheDoor({ Warrior: 1 });
    // Two soldiers and a hero at the bottom of the first ruin: the fight is
    // lost before it is watched, which is exactly what the screen must say.
    game.state.ruins[BARROW] = { depth: 3, cleared: 7 };
    game.openExpedition(BARROW);
    game.doLaunchExpedition();
    const battle = game.battle!;
    expect(battle.log.winner).toBe('theirs');
    expect(battle.prizes).toEqual([]);
    tick(battle.log.ticks * COMBAT.tickMs + BATTLE_RESULT_DELAY_MS + 100);
    expect(game.battle!.phase).toBe('done');
    expect(game.gachaReveal).toBeNull();
  });

  it('leaves the room sheet standing on the next room when it closes', () => {
    const { game, tick } = atTheDoor();
    game.openExpedition(BARROW);
    game.doLaunchExpedition();
    tick(game.battle!.log.ticks * COMBAT.tickMs + BATTLE_RESULT_DELAY_MS + 100);
    game.dismissGachaReveal();
    tick(0);
    game.dismissBattle();
    expect(game.battle).toBeNull();
    expect(game.openOverlay).toBe('expedition');
    expect(game.expeditionPreview()!.room).toBe(2);
  });

  it('draws the tick the log is at, and never past its end', () => {
    const { game } = atTheDoor();
    game.openExpedition(BARROW);
    game.doLaunchExpedition();
    const battle = game.battle!;
    expect(game.battleTick(battle.startedAt)).toBe(0);
    expect(game.battleTick(battle.startedAt + 5 * COMBAT.tickMs)).toBe(5);
    expect(game.battleTick(battle.startedAt + 10 * 60_000)).toBe(battle.log.ticks);
  });
});

describe('the gate opens the same screen', () => {
  it('plays the fight, and the hoard is what it deals', () => {
    const state = mustered();
    advance(state, map, T0); // arm the gate
    state.gates[BARROW] = { nextRaidAt: null, trips: 0, hoard: { Gold: 40 }, cleared: false };
    const game = freshPresenter(state);
    let clock = T0;
    game.now = () => clock;
    game.openGate(BARROW);
    game.doClearGate();
    const battle = game.battle!;
    expect(battle.log.winner).toBe('ours');
    expect(battle.prizes).toEqual([{ kind: 'currency', currency: 'Gold', amount: 40 }]);
    clock += battle.log.ticks * COMBAT.tickMs + BATTLE_RESULT_DELAY_MS + 100;
    game.advanceBattle(clock);
    expect(game.battle!.phase).toBe('rewards');
  });
});
