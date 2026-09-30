// The presenter's half of a gate attempt: what the player actually taps.
//
// The sim tests prove the rules; these prove the ROUTE — that tapping a gate
// opens a sheet with a party already in it, that the fight resolves on the
// tap, and that a cleared gate closes the sheet and pays its first-clear lump
// (Docs/proposals/lairs.md §5). A ruin is its gate now: there is nothing
// behind it to walk on into.
//
// Node env, no jsdom: everything here is presenter state, which is exactly
// where the decisions live.
import { describe, expect, it } from 'vitest';
import { armyCap } from '../src/sim/army';
import { grantArtifactLevel, ownsArtifact } from '../src/sim/artifacts';
import { RUINS, UNITS } from '../src/sim/data/definitions';
import { firstClearLump } from '../src/sim/knowledge';
import { getWallet, type GameState, type UnitId } from '../src/sim/state';
import {
  addAllTrainers, freshGame, freshPresenter, fund, reveal,
} from './helpers';

const BARROW = 'HollowBarrow' as const;

/** A kingdom with a company under arms and the Barrow's gate standing —
 *  armed but not counting: the clock is tests/gates.test.ts's. */
function ready(units: Partial<Record<UnitId, number>> = { Warrior: 60 }): GameState {
  const state = freshGame();
  addAllTrainers(state);
  fund(state, { Gold: 500_000, Food: 200_000, Wood: 200_000, Stone: 50_000, Iron: 500 });
  reveal(state, [RUINS[BARROW].location]);
  state.gates[BARROW] = { nextRaidAt: null, trips: 0, hoard: {}, cleared: false };
  for (const [unitId, n] of Object.entries(units)) {
    for (let i = 0; i < n!; i++) {
      state.army.push({ uniqueId: `u_${unitId}_${i}`, definitionId: unitId as UnitId });
    }
  }
  return state;
}

describe('the route to a gate', () => {
  it('opens the sheet with a sensible party already in it', () => {
    const game = freshPresenter(ready({ Warrior: 60 }));
    game.openGate(BARROW);
    expect(game.openOverlay).toBe('gate');
    expect(game.partyHeroes.length).toBeGreaterThan(0);
    // A player should never have to assemble a party from nothing just to see
    // what a gate would take.
    expect(game.expeditionParty).toEqual([{ unitId: 'Warrior', count: 60 }]);
    expect(game.gateBlockText()).toBeNull();
  });

  it('never pre-fills more unit types than the board has slots', () => {
    const game = freshPresenter(ready({ Warrior: 30, Archer: 30, Lancer: 30, Cavalry: 30 }));
    game.openGate(BARROW);
    expect(game.expeditionParty.length).toBeLessThanOrEqual(game.troopSlotsOpen());
    expect(game.expeditionParty.length).toBeGreaterThan(1);
    expect(game.gateBlockText()).toBeNull();
  });

  it('proposes only what the player actually owns', () => {
    const state = ready({ Warrior: 20, Archer: 20 });
    const game = freshPresenter(state);
    game.openGate(BARROW);
    for (const slot of game.expeditionParty) {
      expect(slot.count).toBeLessThanOrEqual(UNITS[slot.unitId].squadSize);
    }
    expect(state.army.length).toBeLessThanOrEqual(armyCap(state));
    expect(game.gateBlockText()).toBeNull();
  });
});

describe('clearing the gate', () => {
  it('resolves on the tap, closes the sheet and pays the first-clear lump', () => {
    const game = freshPresenter(ready());
    game.openGate(BARROW);
    const lump = firstClearLump(game.state);
    const knowledge = getWallet(game.state.kingdom.wallet, 'Knowledge');
    expect(game.gatePreview()!.knowledge).toBe(lump);
    game.doClearGate();
    expect(game.gateIsCleared(BARROW)).toBe(true);
    expect(game.openOverlay).toBeNull();
    expect(game.gateRuin).toBeNull();
    expect(getWallet(game.state.kingdom.wallet, 'Knowledge')).toBe(knowledge + lump);
  });

  it('spends the supplies on the way in, whatever the fight does', () => {
    const state = ready({ Warrior: 2 });
    reveal(state, [RUINS.StarObservatory.location]);
    state.gates.StarObservatory = { nextRaidAt: null, trips: 0, hoard: {}, cleared: false };
    const game = freshPresenter(state);
    game.openGate('StarObservatory');
    const preview = game.gatePreview()!;
    const food = getWallet(game.state.city.wallet, 'Food');
    game.doClearGate();
    expect(game.gateIsCleared('StarObservatory')).toBe(false);
    expect(getWallet(game.state.city.wallet, 'Food'))
      .toBe(food - (preview.supplies.Food ?? 0));
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

// A relic never leaves the kingdom (Docs/features/09-relics.md §1): owning
// one changes nothing about a gate attempt, in either direction.
describe('a relic the player owns is no part of a fight', () => {
  it('does not block, arm, or otherwise reach the gate', () => {
    const state = ready();
    const game = freshPresenter(state);
    game.openGate(BARROW);
    const bare = game.gatePreview()!.stats.atk;
    grantArtifactLevel(game.state, 'ForemansSigil');
    expect(game.gateBlockText()).toBeNull();
    expect(game.gatePreview()!.stats.atk).toBe(bare);
  });

  it('is still the kingdom\'s after the gate is fought', () => {
    const state = ready();
    grantArtifactLevel(state, 'ForemansSigil');
    const game = freshPresenter(state);
    game.openGate(BARROW);
    game.doClearGate();
    expect(game.gateIsCleared(BARROW)).toBe(true);
    expect(ownsArtifact(game.state, 'ForemansSigil')).toBe(true);
  });
});
