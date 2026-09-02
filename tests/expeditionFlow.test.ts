// The presenter's half of the delve loop: what the player actually taps.
//
// The sim tests prove the rules; these prove the ROUTE — that tapping a ruin
// opens a sheet with a party already in it, that launching empties the map of
// that hero, that the checkpoint pill appears when a party is waiting, and
// that both answers at the checkpoint do what they say.
//
// Node env, no jsdom: everything here is presenter state, which is exactly
// where the decisions live.
import { describe, expect, it } from 'vitest';
import { advance } from '../src/sim/commands';
import { RUINS } from '../src/sim/data/definitions';
import { depthDurationMs } from '../src/sim/combat';
import { getWallet, type GameState, type UnitId } from '../src/sim/state';
import { addAllTrainers, freshGame, freshPresenter, fund, map, reveal } from './helpers';

const BARROW = 'HollowBarrow' as const;

function ready(units: Partial<Record<UnitId, number>> = { Warrior: 4 }): GameState {
  const state = freshGame();
  addAllTrainers(state);
  fund(state, { Gold: 5000, Food: 2000, Wood: 2000, Stone: 500, Iron: 500 });
  reveal(state, [RUINS[BARROW].location]);
  for (const [unitId, n] of Object.entries(units)) {
    for (let i = 0; i < n!; i++) {
      state.army.push({ uniqueId: `u_${unitId}_${i}`, definitionId: unitId as UnitId });
    }
  }
  return state;
}

describe('the route into a ruin', () => {
  it('says WHY a ruin cannot be delved, in words the player can act on', () => {
    const bare = freshPresenter(freshGame());
    // A brand-new kingdom has the free hero but nothing to send with them.
    expect(bare.expeditionBlock(BARROW)).toMatch(/Barracks|army/);

    const armed = freshPresenter(ready());
    expect(armed.expeditionBlock(BARROW)).toBeNull();
  });

  it('opens the sheet with a sensible party already in it', () => {
    const game = freshPresenter(ready({ Warrior: 3 }));
    game.openExpedition(BARROW);
    expect(game.openOverlay).toBe('expedition');
    expect(game.expeditionHero).not.toBeNull();
    // A player should never have to assemble a party from nothing just to see
    // what a ruin would take.
    expect(game.expeditionParty).toEqual([{ unitId: 'Warrior', count: 3 }]);
    expect(game.expeditionPreview()!.safeDepth).toBeGreaterThan(0);
  });

  it('never pre-fills more unit types than there are slots', () => {
    const game = freshPresenter(ready({ Warrior: 2, Archer: 2, Lancer: 2, Cavalry: 2 }));
    game.openExpedition(BARROW);
    expect(game.expeditionParty.length).toBeLessThanOrEqual(1); // base slots = 2, minus the hero
    expect(game.expeditionLaunchBlock()).toBeNull();
  });

  it('the stepper cannot commit units the player does not have', () => {
    const game = freshPresenter(ready({ Warrior: 2 }));
    game.openExpedition(BARROW);
    game.setExpeditionCount('Warrior', 99);
    expect(game.expeditionParty).toEqual([{ unitId: 'Warrior', count: 2 }]);
    game.setExpeditionCount('Warrior', 0);
    expect(game.expeditionParty).toEqual([]);
    expect(game.expeditionLaunchBlock()).toBe('Send at least one unit with them');
  });

  it('launching closes the sheet and commits the hero', () => {
    const game = freshPresenter(ready());
    game.openExpedition(BARROW);
    game.doLaunchExpedition();
    expect(game.openOverlay).toBeNull();
    expect(game.state.delves).toHaveLength(1);
    // The same ruin now reports the party that is already in it.
    expect(game.expeditionBlock(BARROW)).toBe('Your party is already down there');
  });
});

describe('the checkpoint', () => {
  /** The presenter reads the real clock, so the sim is advanced relative to
   *  ITS now rather than to the fixture's T0. */
  const launched = () => {
    const game = freshPresenter(ready());
    game.state.lastAdvance = game.now();
    game.openExpedition(BARROW);
    game.doLaunchExpedition();
    advance(game.state, map, game.now() + depthDurationMs(BARROW, 1));
    return game;
  };

  it('a waiting party is visible without demanding an answer', () => {
    const game = launched();
    expect(game.waitingDelves()).toHaveLength(1);
    expect(game.state.delves[0].phase).toBe('checkpoint');
  });

  it('"go deeper" sends them on', () => {
    const game = launched();
    game.openCheckpointFor(game.state.delves[0].id);
    expect(game.checkpointDelve()).toBeDefined();
    game.doPushDeeper();
    expect(game.state.delves[0].phase).toBe('descending');
    expect(game.openOverlay).toBeNull();
    expect(game.waitingDelves()).toHaveLength(0);
  });

  it('"take the haul" banks it and brings everyone home', () => {
    const game = launched();
    const gold = getWallet(game.state.city.wallet, 'Gold');
    game.openCheckpointFor(game.state.delves[0].id);
    game.doExtract();
    expect(game.state.delves).toHaveLength(0);
    expect(getWallet(game.state.city.wallet, 'Gold')).toBeGreaterThan(gold);
    expect(game.openOverlay).toBeNull();
    // The hero is free again, so the ruin is available again.
    expect(game.expeditionBlock(BARROW)).toBeNull();
  });

  it('dismissing closes the checkpoint without answering it', () => {
    const game = launched();
    game.openCheckpointFor(game.state.delves[0].id);
    game.dismiss();
    expect(game.openCheckpoint).toBeNull();
    expect(game.state.delves[0].phase).toBe('checkpoint'); // still waiting, forever
  });
});

describe('the HUD only shows magic once the player has met it', () => {
  it('is hidden with no landmark in sight and no relic', () => {
    const game = freshPresenter(freshGame());
    // The starting view has a landmark in it deliberately, to teach the
    // mechanic — so this asserts the RULE by removing the reason.
    game.state.fog.revealed = {};
    game.state.fog.discovered = {};
    expect(game.showsMana()).toBe(false);
  });

  it('is sticky once true', () => {
    const game = freshPresenter(freshGame());
    game.state.fog.revealed = {};
    game.state.artifacts.owned.push('DowsingRod');
    expect(game.showsMana()).toBe(true);
  });

  it('shows one pool and one net rate — never the breakdown', () => {
    const game = freshPresenter(freshGame());
    const info = game.manaInfo();
    expect(info.cap).toBeGreaterThan(0);
    expect(info.net).toBe(info.production - info.upkeep);
  });
});
