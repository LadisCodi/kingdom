// The presenter's half of the room loop: what the player actually taps.
//
// The sim tests prove the rules; these prove the ROUTE — that tapping a ruin
// opens a sheet with a party already in it, that the fight resolves on the
// tap, that the sheet redraws on the next room rather than closing, and that
// it closes itself when the ruin runs out.
//
// There is no journey any more, so there is nothing here about checkpoints,
// standing orders or how far to send: a room is one fight, decided now
// (Docs/features/11-expeditions.md §5).
//
// Node env, no jsdom: everything here is presenter state, which is exactly
// where the decisions live.
import { describe, expect, it } from 'vitest';
import { armyCap } from '../src/sim/army';
import { attune, grantArtifact, normaliseSlots } from '../src/sim/artifacts';
import { RUINS, UNITS, roomCount } from '../src/sim/data/definitions';
import { getWallet, type GameState, type UnitId } from '../src/sim/state';
import {
  addAllTrainers, freshGame, freshPresenter, fund, openRuin, reveal,
} from './helpers';

const BARROW = 'HollowBarrow' as const;

// A COMPANY, not a squad of four: a room is fought by dozens now
// (Docs/features/combat.md §14).
function ready(units: Partial<Record<UnitId, number>> = { Warrior: 60 }): GameState {
  const state = freshGame();
  addAllTrainers(state);
  fund(state, { Gold: 500_000, Food: 200_000, Wood: 200_000, Stone: 50_000, Iron: 500 });
  reveal(state, [RUINS[BARROW].location]);
  // The garrison is somebody else's test (tests/gates.test.ts): these are
  // about the route into the ruin behind it.
  openRuin(state, BARROW);
  for (const [unitId, n] of Object.entries(units)) {
    for (let i = 0; i < n!; i++) {
      state.army.push({ uniqueId: `u_${unitId}_${i}`, definitionId: unitId as UnitId });
    }
  }
  return state;
}

/** A party big enough to walk the Barrow out, in every slot the board has. */
const HOST = { Warrior: 100, Lancer: 100, Archer: 80, Cavalry: 60 } as const;

describe('the route into a ruin', () => {
  it('says WHY a ruin cannot be entered, in words the player can act on', () => {
    const bare = freshPresenter(freshGame());
    // A brand-new kingdom has the free hero but nothing to send with them.
    expect(bare.expeditionBlock(BARROW)).toMatch(/Barracks|army/);

    const armed = freshPresenter(ready());
    expect(armed.expeditionBlock(BARROW)).toBeNull();
  });

  it('opens the sheet with a sensible party already in it', () => {
    const game = freshPresenter(ready({ Warrior: 60 }));
    game.openExpedition(BARROW);
    expect(game.openOverlay).toBe('expedition');
    expect(game.partyHeroes.length).toBeGreaterThan(0);
    // A player should never have to assemble a party from nothing just to see
    // what a room would take.
    expect(game.expeditionParty).toEqual([{ unitId: 'Warrior', count: 60 }]);
    // And the sheet opens where the player is standing: the frontier.
    const preview = game.expeditionPreview()!;
    expect([preview.depth, preview.room]).toEqual([1, 1]);
    expect(preview.done).toBe(false);
  });

  it('never pre-fills more unit types than the board has slots', () => {
    const game = freshPresenter(ready({ Warrior: 30, Archer: 30, Lancer: 30, Cavalry: 30 }));
    game.openExpedition(BARROW);
    expect(game.expeditionParty.length).toBeLessThanOrEqual(game.troopSlotsOpen());
    // Every slot is open from the start, so the pre-fill spends the roster on
    // the types that answer this ruin best rather than stopping at one.
    expect(game.expeditionParty.length).toBeGreaterThan(1);
    expect(game.expeditionLaunchBlock()).toBeNull();
  });

  it('the stepper cannot commit units the player does not have', () => {
    const game = freshPresenter(ready({ Warrior: 2 }));
    game.openExpedition(BARROW);
    game.setExpeditionCount('Warrior', 99);
    expect(game.expeditionParty).toEqual([{ unitId: 'Warrior', count: 2 }]);
    game.setExpeditionCount('Warrior', 0);
    expect(game.expeditionParty).toEqual([]);
  });
});

describe('entering a room', () => {
  it('resolves the fight on the tap and leaves nothing in flight', () => {
    const game = freshPresenter(ready(HOST));
    game.openExpedition(BARROW);
    const dust = getWallet(game.state.kingdom.wallet, 'Stardust');
    const reward = game.expeditionPreview()!.reward;
    game.doLaunchExpedition();
    // Paid the moment the room fell — there is no haul to carry home.
    expect(getWallet(game.state.kingdom.wallet, 'Stardust'))
      .toBe(dust + (reward.wallet.Stardust ?? 0));
    expect(game.ruinProgress(BARROW).cleared).toBe(1);
    // The sheet stays open on the NEXT room: the decision the player just
    // made is the one they are about to make again.
    expect(game.openOverlay).toBe('expedition');
    expect(game.expeditionPreview()!.room).toBe(2);
    // And the ruin is enterable again straight away — nobody is "down there".
    expect(game.expeditionBlock(BARROW)).toBeNull();
  });

  it('spends supplies and soldiers on the way in, and nothing banked', () => {
    const game = freshPresenter(ready({ Warrior: 20 }));
    game.openExpedition(BARROW);
    const preview = game.expeditionPreview()!;
    expect(preview.enough).toBe(false);
    const food = getWallet(game.state.city.wallet, 'Food');
    const army = game.state.army.length;
    game.doLaunchExpedition();
    expect(game.ruinProgress(BARROW).cleared).toBe(0); // the room is still there
    expect(getWallet(game.state.city.wallet, 'Food'))
      .toBe(food - (preview.supplies.Food ?? 0));
    // The room fights back, and the dead do not come home
    // (Docs/features/combat.md §4).
    expect(game.state.army.length).toBeLessThan(army);
  });

  it('costs soldiers when it goes well, too, and re-forms the board', () => {
    const game = freshPresenter(ready(HOST));
    game.openExpedition(BARROW);
    const army = game.state.army.length;
    game.doLaunchExpedition();
    expect(game.ruinProgress(BARROW).cleared).toBe(1);
    expect(game.state.army.length).toBeLessThan(army);
    // The squads on the board came down with the roster, so the next room is
    // enterable without the player touching a slot.
    const roster = game.availableTroops();
    const board = game.expeditionParty
      .reduce((sum, s) => sum + s.count, 0);
    expect(board).toBe(game.state.army.length);
    for (const slot of game.expeditionParty) {
      expect(slot.count).toBeLessThanOrEqual(roster[slot.unitId]);
    }
    expect(game.expeditionLaunchBlock()).toBeNull();
  });

  it('clearing the last room of a depth opens the next one', () => {
    const game = freshPresenter(ready(HOST));
    game.openExpedition(BARROW);
    while (game.ruinProgress(BARROW).depth === 1) game.doLaunchExpedition();
    const at = game.ruinProgress(BARROW);
    expect(at.depth).toBe(2);
    expect(at.room).toBe(1);
    expect(at.cleared).toBeGreaterThan(0);
  });

  it('closes itself when the ruin runs out, and the relic comes home', () => {
    const game = freshPresenter(ready(HOST));
    game.openExpedition(BARROW);
    for (let i = 0; i < roomCount(BARROW); i++) game.doLaunchExpedition();
    expect(game.ruinProgress(BARROW).done).toBe(true);
    expect(game.state.ruinsCleared[BARROW]).toBe(true);
    expect(game.openOverlay).toBeNull();
    expect(game.expeditionBlock(BARROW)).toBe('Every room of this ruin has fallen');
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
  it('proposes only what the player actually owns', () => {
    // Proposing a party the player cannot field reads as the game refusing
    // its own suggestion.
    const state = ready({ Warrior: 20, Archer: 20 });
    const game = freshPresenter(state);
    game.openExpedition(BARROW);
    for (const slot of game.expeditionParty) {
      expect(slot.count).toBeLessThanOrEqual(UNITS[slot.unitId].squadSize);
    }
    expect(state.army.length).toBeLessThanOrEqual(armyCap(state));
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
    expect(game.ruinProgress(BARROW).cleared).toBe(0);
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

  it('carries it into the room, and hands it straight back', () => {
    const game = freshPresenter((() => {
      const state = ready(HOST);
      grantArtifact(state, 'ForemansSigil');
      normaliseSlots(state);
      return state;
    })());
    game.openExpedition(BARROW);
    game.setExpeditionArtifact('ForemansSigil');
    game.doLaunchExpedition();
    expect(game.ruinProgress(BARROW).cleared).toBe(1);
    // The fight is over the instant it is fought, so the Reliquary can take
    // the relic back on the next tap — nothing is away.
    expect(attune(game.state, 0, 'ForemansSigil', game.now())).toBe('Attuned');
  });
});
