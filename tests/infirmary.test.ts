// The infirmary: what a fight leaves behind that can still be saved
// (Docs/features/combat.md §4, Docs/features/buildings.md).
//
// A casualty used to be one thing — gone. It is two now: most of the fallen
// are carried back to a military hall and wait there, off the roster, until
// the player pays a fraction of what recruiting them would cost. That is the
// whole claim these tests protect, and its two edges: the ward has a ceiling,
// and what does not fit in it dies.
import { describe, expect, it } from 'vitest';
import {
  armyCap, armySize, cancelTraining, committedTroops, healCost, healSeconds,
  healWounded, lineFor, takeCasualties, trainCost, trainUnit, woundedCap,
  woundedCount, woundedOf,
} from '../src/sim/army';
import { advance } from '../src/sim/commands';
import { ARMY, DISTRICTS, UNITS } from '../src/sim/data/definitions';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet, type GameState, type UnitId } from '../src/sim/state';
import {
  addAllTrainers, addBuilt, completeTech, freshGame, fund, map, T0,
} from './helpers';

/** A city with halls, coin, and a company standing in it. */
function mustered(units: Partial<Record<UnitId, number>> = { Warrior: 60 }): GameState {
  const state = freshGame();
  addAllTrainers(state);
  fund(state, { Gold: 20_000, Food: 8000, Wood: 8000, Stone: 4000 });
  for (const [unitId, n] of Object.entries(units)) {
    for (let i = 0; i < n!; i++) {
      state.army.push({ uniqueId: `u_${unitId}_${i}`, definitionId: unitId as UnitId });
    }
  }
  return state;
}

/** The hall that turns out this type — the one the player would press on. */
const hallFor = (state: GameState, unitId: UnitId) =>
  state.city.districts.find((d) => d.state === 'Built'
    && DISTRICTS[d.definitionId].trains.includes(unitId))!;

describe('a casualty is two different things', () => {
  it('splits the fallen between the grave and the ward', () => {
    const state = mustered({ Warrior: 60 });
    const { losses, wounded } = takeCasualties(state, [{ unitId: 'Warrior', count: 60 }], 200);
    const fell = losses.reduce((sum, l) => sum + l.count, 0);
    const hurt = wounded.reduce((sum, l) => sum + l.count, 0);
    expect(fell).toBeGreaterThan(0);
    expect(hurt).toBe(Math.round(fell * ARMY.woundedShare));
    // Every one of them leaves the ranks — a wounded soldier cannot be sent.
    expect(armySize(state)).toBe(60 - fell);
    expect(woundedOf(state, 'Warrior')).toBe(hurt);
    // …and the dead are simply gone.
    expect(fell - hurt).toBeGreaterThan(0);
  });

  it('the ward has a ceiling, and what does not fit dies', () => {
    const state = mustered({ Warrior: 200 });
    const cap = woundedCap(state);
    expect(cap).toBeGreaterThan(0);
    expect(cap).toBeLessThan(armyCap(state));
    // Fill it to the brim first…
    state.city.wounded.Warrior = cap;
    const before = armySize(state);
    const { losses, wounded } = takeCasualties(state, [{ unitId: 'Warrior', count: 200 }], 900);
    const fell = losses.reduce((sum, l) => sum + l.count, 0);
    expect(fell).toBeGreaterThan(0);
    expect(wounded).toEqual([]); // nowhere to put them
    expect(woundedCount(state)).toBe(cap);
    expect(armySize(state)).toBe(before - fell);
  });

  it('a hero is never in it — only soldiers fall', () => {
    const state = mustered({ Warrior: 40 });
    takeCasualties(state, [{ unitId: 'Warrior', count: 40 }], 150);
    expect(state.heroes.owned.length).toBeGreaterThan(0);
  });
});

describe('mending them', () => {
  it('costs less than recruiting the same soldiers, in coin and in clock', () => {
    const state = mustered();
    const recruit = trainCost(state, 'Warrior');
    const mend = healCost(state, 'Warrior', 10);
    // Ten mended against ten recruited, coin for coin.
    for (const [c, n] of Object.entries(mend)) {
      expect(n).toBeLessThan((recruit[c] ?? 0) * 10);
    }
    expect(healSeconds('Warrior', 10))
      .toBeLessThan(UNITS.Warrior.trainDurationSeconds * 10);
  });

  it('is one order, one wait, and hands back the whole ward', () => {
    const state = mustered({ Warrior: 10 });
    state.city.wounded.Warrior = 8;
    const gold = getWallet(state.city.wallet, 'Gold');
    const hall = hallFor(state, 'Warrior');
    expect(healWounded(state, 'Warrior', 8, T0, hall)).toBe('Queued');
    // Paid up front, off the ward, and ONE item in the hall's line.
    expect(getWallet(state.city.wallet, 'Gold')).toBeLessThan(gold);
    expect(woundedOf(state, 'Warrior')).toBe(0);
    expect(lineFor(state, hall.uniqueId)).toHaveLength(1);
    // Still committed against the cap while they are on the table — the queue
    // is never a way to exceed it.
    expect(committedTroops(state)).toBe(18);

    advance(state, map, T0 + healSeconds('Warrior', 8) * 1000 + 1000);
    expect(armySize(state)).toBe(18);
    expect(lineFor(state, hall.uniqueId)).toHaveLength(0);
  });

  it('refuses what the ranks have no room for', () => {
    const state = mustered({ Warrior: 10 });
    state.city.wounded.Warrior = 5;
    // Fill the roster to the ceiling; the wounded have nowhere to come back to.
    while (armySize(state) < armyCap(state)) {
      state.army.push({ uniqueId: `u_fill_${armySize(state)}`, definitionId: 'Warrior' });
    }
    expect(healWounded(state, 'Warrior', 5, T0, hallFor(state, 'Warrior')))
      .toBe('ArmyAtCapacity');
    expect(woundedOf(state, 'Warrior')).toBe(5); // still waiting
  });

  it('refuses an order the purse cannot cover, and one with nobody in it', () => {
    const state = mustered({ Warrior: 10 });
    state.city.wounded.Warrior = 6;
    const hall = hallFor(state, 'Warrior');
    expect(healWounded(state, 'Archer', 3, T0, hall)).toBe('NoneWounded');
    state.city.wallet.Gold = 0;
    state.city.wallet.Food = 0;
    state.city.wallet.Wood = 0;
    expect(healWounded(state, 'Warrior', 6, T0, hall)).toBe('NotEnoughResources');
    expect(woundedOf(state, 'Warrior')).toBe(6);
  });

  it('cancelling puts them back in their beds, and the coin back in the purse', () => {
    const state = mustered({ Warrior: 10 });
    state.city.wounded.Warrior = 4;
    const hall = hallFor(state, 'Warrior');
    const gold = getWallet(state.city.wallet, 'Gold');
    healWounded(state, 'Warrior', 4, T0, hall);
    const item = lineFor(state, hall.uniqueId)[0];
    expect(cancelTraining(state, item.uniqueId)).toBe('Cancelled');
    expect(woundedOf(state, 'Warrior')).toBe(4);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(gold);
  });

  it('shares the hall with recruiting — one bench, one line', () => {
    const state = mustered({ Warrior: 0 });
    state.city.wounded.Warrior = 3;
    const hall = hallFor(state, 'Warrior');
    // Recruiting a Warrior is gated; mending one the city already owns is
    // not — they are already trained, and the tech was paid for once.
    completeTech(state, UNITS.Warrior.requiredTech!);
    expect(trainUnit(state, 'Warrior', T0, hall)).toBe('Queued');
    expect(healWounded(state, 'Warrior', 3, T0, hall)).toBe('Queued');
    const line = lineFor(state, hall.uniqueId);
    expect(line).toHaveLength(2);
    expect(line[1].startedAt).toBeNull(); // waiting its turn behind the recruit
  });
});

describe('the ward and the engine', () => {
  it('one-call replay equals stepped ticking with a heal in flight', () => {
    const build = (): GameState => {
      const state = mustered({ Warrior: 4 });
      state.city.wounded.Warrior = 6;
      healWounded(state, 'Warrior', 6, T0, hallFor(state, 'Warrior'));
      return state;
    };
    const to = T0 + healSeconds('Warrior', 6) * 1000 + 60_000;
    const oneCall = build();
    advance(oneCall, map, to);
    const stepped = build();
    for (let t = T0 + 1000; t <= to; t += 1000) advance(stepped, map, t);
    expect(armySize(oneCall)).toBe(armySize(stepped));
    expect(oneCall.city.trainingQueue).toEqual(stepped.city.trainingQueue);
  });

  it('survives a save: the ward, and the order on the bench', () => {
    const state = mustered({ Warrior: 5 });
    state.city.wounded.Warrior = 7;
    healWounded(state, 'Warrior', 4, T0, hallFor(state, 'Warrior'));
    const back = deserialize(serialize(state, T0), map, T0)!;
    expect(woundedOf(back, 'Warrior')).toBe(3);
    const item = back.city.trainingQueue[0];
    expect(item.kind).toBe('heal');
    expect(item.count).toBe(4);
  });

  it('a save written before the infirmary reads back with an empty ward', () => {
    const state = mustered({ Warrior: 5 });
    const save = serialize(state, T0);
    delete (save.Modules as any)['kingdom.cities'].Cities[0].Wounded;
    const back = deserialize(save, map, T0)!;
    expect(woundedCount(back)).toBe(0);
  });
});

describe('the ward is a building decision', () => {
  it('a kingdom with no hall has no infirmary either', () => {
    const bare = freshGame();
    expect(woundedCap(bare)).toBe(0);
    addBuilt(bare, 'Barracks', { x: 3, y: 2 });
    expect(woundedCap(bare)).toBeGreaterThan(0);
    // …and it grows with the halls that hold the army.
    const many = mustered();
    expect(woundedCap(many)).toBeGreaterThan(woundedCap(bare));
  });
});
