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
import { maxArmyPower } from '../src/sim/army';
import { attune, grantArtifact, normaliseSlots } from '../src/sim/artifacts';
import { RUINS, UNITS } from '../src/sim/data/definitions';
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

// Magic used to be hidden from the HUD until the player had met it — a gauge
// with nothing to spend on was exactly the spreadsheet chrome the redesign
// killed. Mana now pays for every tap, so hiding it would hide the reason a
// tap refused: the gate is gone and the gauge is unconditional.
describe('the Mana gauge', () => {
  it('is readable from the first minute, with nothing met yet', () => {
    const game = freshPresenter(freshGame());
    game.state.fog.revealed = {};
    game.state.fog.discovered = {};
    const m = game.manaInfo();
    expect(m.cap).toBeGreaterThan(0);
    expect(m.value).toBe(m.cap); // a new kingdom starts full
  });

  it('shows one pool and one net rate — never the breakdown', () => {
    const game = freshPresenter(freshGame());
    const info = game.manaInfo();
    expect(info.cap).toBeGreaterThan(0);
    // Nothing draws against the pool, so the rate IS the production.
    expect(info.net).toBe(info.production);
    expect(info.over).toBe(false);
  });
});

describe('the pre-filled party is always launchable', () => {
  it('clamps to the army cap rather than opening pre-blocked', () => {
    // Proposing a party the player cannot field reads as the game refusing
    // its own suggestion.
    const state = ready({ Warrior: 20, Archer: 20 });
    const game = freshPresenter(state);
    game.openExpedition(BARROW);
    const power = game.expeditionParty
      .reduce((sum, s) => sum + UNITS[s.unitId].power * s.count, 0);
    expect(power).toBeLessThanOrEqual(maxArmyPower(state));
    expect(game.expeditionLaunchBlock()).toBeNull();
  });
});

// The socket next to the hero (Docs/features/10-heroes.md §2).
//
// The rule is in the sim; what these prove is that the SHEET presents it as a
// choice — the socket starts empty, a worn relic is visible-but-refused rather
// than missing, and the read-out shows what socketing one actually bought.
describe('arming a hero from the expedition sheet', () => {
  const armed = () => {
    const state = ready();
    grantArtifact(state, 'ForemansSigil');
    normaliseSlots(state);
    const game = freshPresenter(state);
    game.openExpedition(BARROW);
    return game;
  };

  it('opens with an empty socket — the game never spends your passive for you', () => {
    const game = armed();
    expect(game.expeditionArtifact).toBe(null);
    expect(game.expeditionPreviewUnarmed()).toBe(null);
    expect(game.expeditionLaunchBlock()).toBeNull();
  });

  it('socketing one is reversible right up until the party leaves', () => {
    const game = armed();
    game.setExpeditionArtifact('ForemansSigil');
    expect(game.expeditionArtifact).toBe('ForemansSigil');
    // Tapping the same relic again takes it back out.
    game.setExpeditionArtifact('ForemansSigil');
    expect(game.expeditionArtifact).toBe(null);
  });

  it('shows what the relic bought, against the same party without it', () => {
    const game = armed();
    game.setExpeditionArtifact('ForemansSigil');
    const armedPreview = game.expeditionPreview()!;
    const bare = game.expeditionPreviewUnarmed()!;
    expect(armedPreview.stats.atk).toBeGreaterThan(bare.stats.atk);
  });

  it('refuses a relic the kingdom is wearing, and says which', () => {
    const game = armed();
    attune(game.state, 0, 'ForemansSigil', game.now());
    game.setExpeditionArtifact('ForemansSigil');
    expect(game.expeditionLaunchBlock()).toMatch(/attuned/i);
    game.doLaunchExpedition();
    expect(game.state.delves).toHaveLength(0);
  });

  it('never shows the stats of a party it is refusing to send', () => {
    const game = armed();
    game.setExpeditionArtifact('ForemansSigil');
    const armedStats = game.expeditionPreview()!.stats.atk;
    // Attuning it behind the sheet's back must take the relic OUT of the
    // read-out, not leave the numbers arguing with the blocked launch button.
    attune(game.state, 0, 'ForemansSigil', game.now());
    expect(game.expeditionLaunchBlock()).toMatch(/attuned/i);
    expect(game.expeditionPreview()!.stats.atk).toBeLessThan(armedStats);
    expect(game.expeditionPreviewUnarmed()).toBe(null);
  });

  it('carries it down, and the Reliquary cannot take it back until it returns', () => {
    const game = armed();
    game.setExpeditionArtifact('ForemansSigil');
    game.doLaunchExpedition();
    expect(game.state.delves).toHaveLength(1);
    expect(game.state.delves[0].artifactId).toBe('ForemansSigil');
    expect(attune(game.state, 0, 'ForemansSigil', game.now())).toBe('Carried');
  });
});
