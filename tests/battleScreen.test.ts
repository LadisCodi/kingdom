// The screen before a fight: slots, panels and the two ladders that lock them
// (Docs/features/11a-ruins-ui.md §2.5, §2.6; Docs/features/10-heroes.md §3).
//
// Everything here is presenter state, which is exactly where the decisions
// live: a slot is tapped, a panel of cards rises, and a card fills the first
// free slot with as much as it legally can. No jsdom — the rules are testable
// without a DOM, and the DOM is a pure function of them.
import { describe, expect, it } from 'vitest';
import { advance } from '../src/sim/commands';
import { PARTY, LAIRS, UNITS } from '../src/sim/data/definitions';
import { heroSlotGemCost, heroSlots } from '../src/sim/heroes';
import { armyCap } from '../src/sim/army';
import { getWallet, type GameState, type UnitId } from '../src/sim/state';
import { attackLair } from '../src/sim/expeditions';
import {
  addAllTrainers, addBuilt, freshGame, freshPresenter, fund, map, reveal, T0, toLastFight } from './helpers';

const ORCS = 'Orcs' as const;

/** A kingdom standing on the orc lair's doorstep, with an army at home. */
function atTheLair(units: Partial<Record<UnitId, number>> = { Warrior: 30, Archer: 24 }) {
  const state: GameState = freshGame();
  addBuilt(state, 'Housing', { x: 3, y: 2 });
  state.city.population = 4;
  addAllTrainers(state);
  fund(state, { Gold: 20_000, Food: 5000, Wood: 2000, Stone: 800, Gems: 100_000 });
  reveal(state, [LAIRS[ORCS].location]);
  advance(state, map, T0); // arms the lair
  for (const [unitId, n] of Object.entries(units)) {
    for (let i = 0; i < n!; i++) {
      state.army.push({ uniqueId: `u_${unitId}_${i}`, definitionId: unitId as UnitId });
    }
  }
  const game = freshPresenter(state);
  game.openLair(ORCS);
  return game;
}

describe('the troop slots', () => {
  it('closes on the way out — there is no panel over it any more', () => {
    const game = atTheLair();
    expect(game.openOverlay).toBe('lair');
    game.dismiss();
    expect(game.openOverlay).toBeNull();
  });

  it('fills the first free slot with as big a squad as the type allows', () => {
    const game = atTheLair({ Warrior: 12 });
    game.expeditionParty = [];
    const would = game.troopsAvailableFor('Warrior');
    game.assignTroop('Warrior');
    expect(game.expeditionParty).toEqual([{ unitId: 'Warrior', count: would }]);
    expect(would).toBeGreaterThan(0);
  });

  it('never sends more than a squad holds, than the roster has, or than the cap allows', () => {
    const game = atTheLair({ Warrior: 12 });
    game.expeditionParty = [];
    // Twelve at home, a squad holds a hundred, and the cap is what it is.
    const cap = Math.floor(armyCap(game.state) / UNITS.Warrior.power);
    expect(game.troopsAvailableFor('Warrior'))
      .toBe(Math.min(UNITS.Warrior.squadSize, 12, cap));

    // A roster far past the squad size is capped BY the squad size.
    for (let i = 0; i < 200; i++) {
      game.state.army.push({ uniqueId: `extra_${i}`, definitionId: 'Warrior' });
    }
    addBuilt(game.state, 'Barracks', { x: 12, y: 8 });
    addBuilt(game.state, 'Barracks', { x: 14, y: 8 });
    addBuilt(game.state, 'Barracks', { x: 16, y: 8 });
    expect(game.troopsAvailableFor('Warrior')).toBeLessThanOrEqual(UNITS.Warrior.squadSize);
  });

  it('counts what is already committed, so two slots of one type never double-send', () => {
    const game = atTheLair({ Archer: 8 });
    game.expeditionParty = [];
    const first = game.troopsAvailableFor('Archer');
    game.assignTroop('Archer');
    expect(game.expeditionParty[0].count).toBe(first);
    // Whatever the first slot took is gone from what a second one may take —
    // whether the roster or the army cap is what ran out.
    expect(game.troopsAvailableFor('Archer')).toBeLessThanOrEqual(Math.max(0, 8 - first));
    // …and clearing the slot hands all of it back.
    game.clearTroopSlot(0);
    expect(game.troopsAvailableFor('Archer')).toBe(first);
  });

  it('clears a slot with its own X, and leaves the rest of the party alone', () => {
    const game = atTheLair({ Warrior: 12, Archer: 8 });
    game.expeditionParty = [
      { unitId: 'Warrior', count: 4 },
      { unitId: 'Archer', count: 2 },
    ];
    game.clearTroopSlot(0);
    expect(game.expeditionParty).toEqual([{ unitId: 'Archer', count: 2 }]);
  });

  // Nothing locks a troop slot and nothing sells one: the row the player sees
  // on their first fight is the row they will see on their last.
  it('opens every slot the board has, from the first fight', () => {
    const game = atTheLair();
    expect(game.troopSlotsOpen()).toBe(PARTY.troopSlots);
    expect(game.troopSlotCeiling()).toBe(game.troopSlotsOpen());
    expect(freshPresenter(freshGame()).troopSlotsOpen()).toBe(PARTY.troopSlots);
  });
});

describe('the hero slots', () => {
  it('start at one free, and the board holds three', () => {
    const game = atTheLair();
    expect(game.heroSlotsOpen()).toBe(1);
    expect(game.heroSlotCeiling()).toBe(3);
    expect(heroSlots(game.state)).toBe(1);
  });

  it('unlock with Gems, one at a time, and stop at the board', () => {
    const game = atTheLair();
    const cost = heroSlotGemCost(game.state);
    const gems = getWallet(game.state.player.wallet, 'Gems');
    game.doBuyHeroSlot();
    expect(game.heroSlotsOpen()).toBe(2);
    expect(getWallet(game.state.player.wallet, 'Gems')).toBe(gems - cost);
    // The second is dearer than the first — the slot ladder, as everywhere.
    expect(heroSlotGemCost(game.state)).toBeGreaterThan(cost);
    game.doBuyHeroSlot();
    expect(game.heroSlotsOpen()).toBe(3);
    game.doBuyHeroSlot();
    expect(game.heroSlotsOpen()).toBe(3); // three is the whole board
  });

  it('refuses a purchase the purse cannot cover', () => {
    const game = atTheLair();
    game.state.player.wallet.Gems = 0;
    game.doBuyHeroSlot();
    expect(game.heroSlotsOpen()).toBe(1);
  });

  it('fills the first free slot, never the same hero twice', () => {
    const game = atTheLair();
    game.state.heroes.owned.push('Adventurer');
    game.state.heroes.levels.Adventurer = 1;
    game.state.heroes.ascension.Adventurer = 0;
    game.partyHeroes = [];
    game.assignHero('Warden');
    game.assignHero('Warden');
    expect(game.partyHeroes).toEqual(['Warden']);
    // One slot open, so the second hero has nowhere to stand yet.
    game.assignHero('Adventurer');
    expect(game.partyHeroes).toEqual(['Warden']);
    game.doBuyHeroSlot();
    game.assignHero('Adventurer');
    expect(game.partyHeroes).toEqual(['Warden', 'Adventurer']);
  });

  it('clears a slot, and soldiers may still go alone — but not nobody', () => {
    const game = atTheLair();
    game.partyHeroes = ['Warden'];
    game.clearHeroSlot(0);
    expect(game.partyHeroes).toEqual([]);
    expect(game.lairBlockText()).toBeNull();
    game.expeditionParty = [];
    // The fight refuses, in words, rather than the screen hiding the button.
    expect(game.lairBlockText()).toBe('Pick who goes in');
  });
});

describe('what the screen adds up to', () => {
  it('opens with the roster in the slots it has, and ready to fight', () => {
    const game = atTheLair();
    expect(game.partyHeroes.length).toBe(game.heroSlotsOpen());
    expect(game.lairBlockText()).toBeNull();
    expect(game.lairPreview()!.enough).toBe(true);
  });

  it('shows the enemy squads, and a second hero moves the number', () => {
    const game = atTheLair();
    game.state.heroes.owned.push('Adventurer');
    game.state.heroes.levels.Adventurer = 1;
    game.state.heroes.ascension.Adventurer = 0;
    game.partyHeroes = ['Warden'];
    game.expeditionParty = [];
    const alone = game.lairPreview()!;
    expect(alone.enemy.length).toBeGreaterThan(0);
    expect(alone.power).toBeGreaterThan(0);

    game.doBuyHeroSlot();
    game.assignHero('Adventurer');
    expect(game.lairPreview()!.attack).toBeGreaterThan(alone.attack);

    // …and so do troops.
    const twoHeroes = game.lairPreview()!.attack;
    game.assignTroop('Warrior');
    expect(game.lairPreview()!.attack).toBeGreaterThan(twoHeroes);
  });

  it('sends every hero in the slots into the fight', () => {
    const game = atTheLair();
    game.state.heroes.owned.push('Adventurer');
    game.state.heroes.levels.Adventurer = 1;
    game.state.heroes.ascension.Adventurer = 0;
    game.doBuyHeroSlot();
    game.partyHeroes = ['Warden', 'Adventurer'];
    // Twenty orcs hold the orc lair, so the heroes bring the company with them.
    game.expeditionParty = [{ unitId: 'Warrior', count: 30 }];
    toLastFight(game.state, ORCS);
    game.doAttackLair();
    expect(game.lairFor(ORCS)!.defeated).toBe(true);
  });
});

// The roster (Docs/proposals/lairs.md §6): one tile per type, a squad per
// tap, into that unit's own row, three to a row.
describe('the roster', () => {
  it('sends another squad beside the first on a second tap, until none are left', () => {
    const game = atTheLair({ Warrior: 30 });
    game.expeditionParty = [];
    const squad = UNITS.Warrior.squadSize;
    game.assignTroop('Warrior');
    game.assignTroop('Warrior');
    const sent = game.expeditionParty.reduce((n, s) => n + s.count, 0);
    expect(game.expeditionParty.every((s) => s.unitId === 'Warrior')).toBe(true);
    expect(sent).toBeLessThanOrEqual(Math.min(30, 2 * squad));
    expect(game.troopsLeftAtHome('Warrior')).toBe(30 - sent);
  });

  it('holds six squads of anything — the type never decides whether one fits', () => {
    const game = atTheLair({ Warrior: 700 }); // seven squads' worth
    game.expeditionParty = [];
    // Six of one melee type: there is no row to fill, only six slots.
    for (let i = 0; i < 6; i++) game.assignTroop('Warrior');
    expect(game.expeditionParty).toHaveLength(6);
    expect(game.troopRefusal('Warrior')).toBe('Every troop slot is full');
    game.assignTroop('Warrior');
    expect(game.expeditionParty).toHaveLength(6);
  });

  it('toggles a hero in and out with one tile', () => {
    const game = atTheLair();
    game.partyHeroes = [];
    game.toggleHero('Warden');
    expect(game.partyHeroes).toEqual(['Warden']);
    game.toggleHero('Warden');
    expect(game.partyHeroes).toEqual([]);
  });

  it('quick-deploys a hero and a board inside every rule a tap obeys', () => {
    const game = atTheLair({ Warrior: 60, Archer: 60 });
    game.expeditionParty = [];
    game.partyHeroes = [];
    game.quickDeploy();
    expect(game.partyHeroes.length).toBeGreaterThan(0);
    expect(game.expeditionParty.length).toBeGreaterThan(0);
    expect(game.expeditionParty.length).toBeLessThanOrEqual(6);
  });

  it('states the soldiers the fight will cost before it is paid', () => {
    const game = atTheLair({ Warrior: 24 });
    const preview = game.lairPreview()!;
    const before = game.state.army.length;
    const report = attackLair(game.state, map, game.lairId!, game.partyHeroes, game.expeditionParty);
    const fell = report.losses.reduce((n, l) => n + l.count, 0);
    expect(preview.fallen).toBe(fell);
    expect(game.state.army.length).toBe(before - fell);
  });
});
