// Combat as a scoring pass, and a ruin as a path of rooms
// (Docs/features/11-expeditions.md §1, §5, §6).
//
// The claim these tests exist to protect is that a room is a DECISION and not
// a wait: it is entered, it resolves, and the player decides again. Nothing
// is ever in flight, nothing is carried, and what a room asks for is on the
// screen before it is entered — the two numbers it compares.
import { describe, expect, it } from 'vitest';
import {
  armyCap, finishLineWithGems, lineFor, lineRemainingSeconds, lineRushCost, trainUnit,
  woundedOf,
} from '../src/sim/army';
import { BEATS, typeMultiplier } from '../src/sim/combat';
import { buildBoard, resolveBattle } from '../src/sim/battle';
import { attune, grantArtifact, normaliseSlots } from '../src/sim/artifacts';
import { advance } from '../src/sim/commands';
import { techKnowledgeCost } from '../src/sim/research';
import {
  ARMY, CURRENCIES, DISTRICTS, HEROES, KNOWLEDGE, LANDMARKS, RUINS,
  RUIN_ORDER, TECH_ORDER, UNITS, depthCount, depthDef, depthsOf, roomCount, roomPower,
} from '../src/sim/data/definitions';
import {
  enterRoom, frontier, previewRoom, roomBlock, roomBoard, roomReward, roomsCleared,
  ruinIsFinished, supplyCost,
} from '../src/sim/expeditions';
import { claimLandmark } from '../src/sim/landmarks';
import { knowledgePerHour } from '../src/sim/mana';
import { deserialize, serialize } from '../src/sim/save';
import {
  getWallet, townhall, type GameState, type RuinId, type UnitId,
} from '../src/sim/state';
import {
  addAllTrainers, addBuilt, completeTech, freshGame, fund, map, openRuin, reveal, T0,
} from './helpers';

const BARROW = 'HollowBarrow' as const;

/** A kingdom that can actually send a party into the shallowest ruin — which
 *  now means a COMPANY, not a pair: a depth is fought by dozens
 *  (Docs/features/combat.md §14, the cap is a headcount). */
function readyToDelve(units: Partial<Record<UnitId, number>> = { Warrior: 60 }): GameState {
  const state = freshGame();
  addAllTrainers(state);
  fund(state, { Gold: 5000, Food: 2000, Wood: 2000, Stone: 500, Iron: 500 });
  reveal(state, [RUINS[BARROW].location]);
  // The gate is tests/gates.test.ts's subject; every delve test starts on the
  // far side of it (Docs/features/18-garrisons-and-raids.md §1).
  for (const id of RUIN_ORDER) openRuin(state, id);
  for (const [unitId, n] of Object.entries(units)) {
    for (let i = 0; i < n!; i++) {
      state.army.push({ uniqueId: `u_${unitId}_${i}`, definitionId: unitId as UnitId });
    }
  }
  return state;
}


describe('the type chart', () => {
  it('is a cycle, and nothing beats itself', () => {
    const seen = new Set<UnitId>();
    let cursor: UnitId = 'Warrior';
    for (let i = 0; i < 4; i++) {
      expect(seen.has(cursor)).toBe(false);
      seen.add(cursor);
      expect(BEATS[cursor]).not.toBe(cursor);
      cursor = BEATS[cursor];
    }
    expect(cursor).toBe('Warrior'); // back where it started
  });

  it('is soft on purpose — one bad guess is a worse trip, not a wasted one', () => {
    expect(typeMultiplier('Lancer', 'Cavalry')).toBe(ARMY.typeAdvantage);
    expect(typeMultiplier('Cavalry', 'Lancer')).toBe(ARMY.typeDisadvantage);
    expect(typeMultiplier('Lancer', 'Archer')).toBe(1);
    // A ruin that answers to nothing in particular is always neutral.
    expect(typeMultiplier('Lancer', 'Any')).toBe(1);
    expect(ARMY.typeAdvantage).toBeLessThanOrEqual(1.5);
    expect(ARMY.typeDisadvantage).toBeGreaterThanOrEqual(0.75);
  });

  it('does its work inside the FIGHT, on the swing (§7)', () => {
    // Four Lancers against a Cavalry squad and against an Archer one: the
    // same troops, the same swing, three halves against a quarter less.
    const swing = (against: UnitId): number => {
      const log = resolveBattle(
        buildBoard([{ unitId: 'Lancer', count: 4 }], []),
        buildBoard([{ unitId: against, count: 40 }], []),
      );
      const first = log.events.find((e) => e.kind === 'attack' && e.from.side === 'ours');
      return first?.kind === 'attack' ? first.dealt : 0;
    };
    // Lancer beats Cavalry, loses to Warrior, and is neutral to an Archer.
    expect(swing('Cavalry')).toBeGreaterThan(swing('Archer'));
    expect(swing('Warrior')).toBeLessThan(swing('Archer'));
  });
});

describe('unit stats make a real trade', () => {
  it('Archers buy reach, Warriors buy survival — neither is right alone', () => {
    const archer = UNITS.Archer;
    const warrior = UNITS.Warrior;
    // An archer line puts more troops in range of the enemy than any other
    // type; a warrior line outlasts it.
    expect(archer.frontage).toBeGreaterThan(warrior.frontage);
    expect(warrior.hp).toBeGreaterThan(archer.hp);
    expect(warrior.def).toBeGreaterThan(archer.def);
  });

  it('prices POWER apart from damage, because they answer different questions', () => {
    // `power` is what a troop costs against the army cap and what a room's
    // budget is written in; `dmg` is what it hits for. They were one number
    // while combat was a scoring pass, and the resolver made them two
    // (Docs/features/combat.md §5, §12).
    for (const u of Object.values(UNITS)) {
      expect(u.power).toBeGreaterThan(0);
      expect(u.dmg).toBeGreaterThan(u.power);
      expect(u.frontage).toBeLessThanOrEqual(u.squadSize);
      expect(u.cooldown).toBeGreaterThan(0);
    }
  });
});

describe('the army cap is a city decision', () => {
  it('comes from military buildings, not from the Townhall', () => {
    const state = freshGame();
    expect(armyCap(state)).toBe(0);
    state.city.districts.find((d) => d.definitionId === 'Townhall')!.level = 3;
    expect(armyCap(state)).toBe(0); // levelling the hall buys no soldiers

    addBuilt(state, 'Barracks', { x: 3, y: 2 });
    const perLevel = DISTRICTS.Barracks.armyCapPerLevel;
    expect(armyCap(state)).toBe(perLevel[0]);
    state.city.districts.find((d) => d.definitionId === 'Barracks')!.level = 3;
    expect(armyCap(state)).toBe(perLevel[2]);
  });

  it('holds companies, not pairs: a first hall is a hundred and a half', () => {
    const state = freshGame();
    addBuilt(state, 'Barracks', { x: 3, y: 2 });
    // The number a player reads on their first hall. It used to be six —
    // two Warriors — which is not an army in a game about fielding one.
    expect(armyCap(state)).toBe(150);
    addAllTrainers(state);
    expect(armyCap(state)).toBeGreaterThan(600);
  });

  // The arc Docs/features/11-expeditions.md §6 promises, asserted rather than
  // hoped for: each rung of ARMY opens more of the path and leaves the ruin
  // after it a real stretch. Measured by FIGHTING every room in order with
  // the resolver — the only thing that can answer it now, and the reason the
  // authored ladder was rewritten when it landed.
  it('the tier ladder actually holds at the authored numbers', () => {
    const state = freshGame();
    const reach = (troops: number, heroes: number, ruinId: RuinId): number => {
      const per = Math.ceil(troops / 4);
      const squads = (Object.keys(UNITS) as UnitId[])
        .map((u) => ({ unitId: u, count: Math.min(UNITS[u].squadSize, per) }));
      const h = HEROES.Warden;
      const ours = buildBoard(squads, Array.from({ length: heroes }, (_, i) => ({
        id: `h${i}`, name: h.name, type: h.unitType, dmg: h.dmg, def: h.def, hp: h.hp,
        cooldown: h.cooldown, power: Math.round(h.dmg / 2),
        troopDmgMult: h.troopDmgMult, troopHpMult: h.troopHpMult, troopDefBonus: h.troopDefBonus,
      })));
      let rooms = 0;
      for (const d of depthsOf(ruinId)) {
        for (let r = 1; r <= d.rooms; r++) {
          const theirs = roomBoard(state, ruinId, d.depth, r);
          if (resolveBattle(ours, theirs).winner !== 'ours') return rooms;
          rooms += 1;
        }
      }
      return rooms;
    };
    // The company the quest chain musters, behind the one free hero: most of
    // the Barrow, and the next ruin a wall rather than a door.
    const barrow = reach(24, 1, 'HollowBarrow');
    expect(barrow).toBeGreaterThan(roomCount('HollowBarrow') * 0.4);
    expect(barrow).toBeLessThan(roomCount('HollowBarrow'));
    expect(reach(24, 1, 'SunkenChapel')).toBeLessThan(roomCount('SunkenChapel') * 0.3);
    // Sixty under arms — the chain's later warband — walks the Barrow out and
    // gets most of the way through the Chapel.
    expect(reach(60, 1, 'HollowBarrow')).toBe(roomCount('HollowBarrow'));
    const chapel = reach(60, 1, 'SunkenChapel');
    expect(chapel).toBeGreaterThan(roomCount('SunkenChapel') * 0.5);
    expect(chapel).toBeLessThan(roomCount('SunkenChapel'));
    // A hundred and fifty behind three heroes finishes the Chapel and stalls
    // inside the Ironworks.
    expect(reach(150, 3, 'SunkenChapel')).toBe(roomCount('SunkenChapel'));
    const ironworks = reach(150, 3, 'DrownedIronworks');
    expect(ironworks).toBeGreaterThan(0);
    expect(ironworks).toBeLessThan(roomCount('DrownedIronworks'));
    // A FULL board — every squad at its size, every hero slot bought — takes
    // the Ironworks and gets a long way into the Counting House, and the
    // deepest ruin stays out of reach. What is left after that is hero levels
    // and unit tiers, not more bodies: six slots is six slots.
    expect(reach(340, 3, 'DrownedIronworks')).toBe(roomCount('DrownedIronworks'));
    const counting = reach(340, 3, 'CountingHouse');
    expect(counting).toBeGreaterThan(roomCount('CountingHouse') * 0.5);
    expect(counting).toBeLessThan(roomCount('CountingHouse'));
    expect(reach(340, 3, 'StarObservatory')).toBeGreaterThan(0);
    expect(reach(340, 3, 'StarObservatory')).toBeLessThan(roomCount('StarObservatory'));
  });

  it('an unfinished building contributes nothing', () => {
    const state = freshGame();
    addBuilt(state, 'Barracks', { x: 3, y: 2 });
    state.city.districts.find((d) => d.definitionId === 'Barracks')!.state = 'UnderConstruction';
    expect(armyCap(state)).toBe(0);
  });
});

describe('training takes time now', () => {
  it('each building runs its own line, in true chronological order', () => {
    const state = readyToDelve({});
    completeTech(state, 'Warrior');
    completeTech(state, 'Archery');
    // NAMED halls: the Barracks turns out Archers too, so without saying where,
    // all three would join one line and the parallelism this test is about
    // would quietly stop existing.
    const barracks = state.city.districts.find((d) => d.definitionId === 'Barracks')!;
    const grounds = state.city.districts.find((d) => d.definitionId === 'ShootingGrounds')!;
    expect(trainUnit(state, 'Warrior', T0, barracks)).toBe('Queued');
    expect(trainUnit(state, 'Warrior', T0, barracks)).toBe('Queued');
    expect(trainUnit(state, 'Archer', T0, grounds)).toBe('Queued');
    expect(state.army).toHaveLength(0);

    // The Archer (12s) lands before the first Warrior (15s); the SECOND
    // Warrior starts when the first finished, not when the window did.
    advance(state, map, T0 + 13_000);
    expect(state.army.map((u) => u.definitionId)).toEqual(['Archer']);
    advance(state, map, T0 + 16_000);
    expect(state.army).toHaveLength(2);
    advance(state, map, T0 + 31_000);
    expect(state.army).toHaveLength(3);
  });

  it('queued units count against the cap, so the queue is not a loophole', () => {
    const state = readyToDelve({});
    completeTech(state, 'Warrior');
    state.city.districts = state.city.districts.filter(
      (d) => d.definitionId === 'Townhall' || d.definitionId === 'Barracks');
    // A Barracks holds TROOPS, not power: one soldier is one place in it,
    // whatever it is worth in a fight (Docs/features/combat.md §14).
    const cap = armyCap(state);
    expect(cap).toBe(DISTRICTS.Barracks.armyCapPerLevel[0]);
    fund(state, { Gold: 100_000, Wood: 100_000, Food: 100_000 });
    for (let i = 0; i < cap; i++) {
      expect(trainUnit(state, 'Warrior', T0)).toBe('Queued');
    }
    expect(trainUnit(state, 'Warrior', T0)).toBe('ArmyAtCapacity');
  });

  it('one-call replay equals stepped ticking', () => {
    const build = (): GameState => {
      const s = readyToDelve({});
      completeTech(s, 'Warrior');
      for (let i = 0; i < 4; i++) trainUnit(s, 'Warrior', T0);
      return s;
    };
    const oneCall = build();
    advance(oneCall, map, T0 + 200_000);
    const stepped = build();
    for (let t = 1000; t <= 200_000; t += 1000) advance(stepped, map, T0 + t);
    expect(stepped.army.length).toBe(oneCall.army.length);
  });

  it('delivers the whole line during a long absence', () => {
    const state = readyToDelve({});
    completeTech(state, 'Warrior');
    for (let i = 0; i < 2; i++) trainUnit(state, 'Warrior', T0);
    // Through advance(), because that is the path that stamps the head at the
    // CURSOR — advanceArmyTraining on its own stamps at the time it is given,
    // exactly as advanceQueue does, so a raw far-future call starts the line
    // rather than finishing it.
    const report = advance(state, map, T0 + 3_600_000);
    expect(report.trainedUnits).toEqual(['Warrior', 'Warrior']);
    expect(state.city.trainingQueue).toHaveLength(0);
  });
});

describe('a ruin is a path of rooms', () => {
  it('is depths of rooms, and the ladder never steps backwards', () => {
    for (const id of RUIN_ORDER) {
      const depths = depthsOf(id);
      expect(depths.length).toBeGreaterThan(0);
      depths.forEach((d, i) => {
        expect(d.depth).toBe(i + 1);
        expect(d.rooms).toBeGreaterThanOrEqual(8); // §2: 8-18 rooms a depth
        expect(d.rooms).toBeLessThanOrEqual(18);
        const prev = depths[i - 1];
        if (prev === undefined) return;
        // §2's validation: a depth may not open easier than the one above it
        // finished.
        expect(d.powerStart)
          .toBeGreaterThanOrEqual(prev.powerStart + prev.powerStep * (prev.rooms - 1));
      });
    }
  });

  it('climbs room by room inside a depth', () => {
    const d = depthDef('HollowBarrow', 1)!;
    expect(roomPower('HollowBarrow', 1, 1)).toBe(d.powerStart);
    expect(roomPower('HollowBarrow', 1, 2)).toBe(d.powerStart + d.powerStep);
    expect(roomPower('HollowBarrow', 1, d.rooms))
      .toBe(d.powerStart + d.powerStep * (d.rooms - 1));
  });

  it('starts every player at Depth 1 · Room 1', () => {
    const state = readyToDelve();
    expect(frontier(state, BARROW)).toEqual({ depth: 1, room: 1, done: false });
    expect(roomsCleared(state, BARROW)).toBe(0);
    expect(ruinIsFinished(state, BARROW)).toBe(false);
  });
});

describe('entering a room', () => {
  /** A company big enough to walk into the Barrow's first rooms. */
  const company = [{ unitId: 'Warrior' as UnitId, count: 60 }];

  it('resolves THE INSTANT it is entered — nothing is left in flight', () => {
    const state = readyToDelve({ Warrior: 60 });
    const report = enterRoom(state, map, BARROW, ['Warden'], company);
    expect(report.result).toBe('Cleared');
    // Nothing to wait for, nothing parked, and the advance has no work.
    const before = JSON.stringify(state.ruins);
    advance(state, map, T0 + 7 * 86_400_000);
    expect(JSON.stringify(state.ruins)).toBe(before);
  });

  it('pays the room the moment it falls — there is no haul to carry home', () => {
    const state = readyToDelve({ Warrior: 60 });
    const gold = getWallet(state.city.wallet, 'Gold');
    const stardust = getWallet(state.kingdom.wallet, 'Stardust');
    const supplies = supplyCost(state, BARROW, 1, ['Warden']);
    const report = enterRoom(state, map, BARROW, ['Warden'], company);
    expect(report.result).toBe('Cleared');
    expect(getWallet(state.city.wallet, 'Gold'))
      .toBe(gold - (supplies.Gold ?? 0) + report.wallet.Gold!);
    // Stardust is the KINGDOM's, where it survives a region reset.
    expect(getWallet(state.kingdom.wallet, 'Stardust')).toBe(stardust + report.wallet.Stardust!);
  });

  it('advances the frontier one room, in order, and never replays one', () => {
    const state = readyToDelve({ Warrior: 60 });
    // The board is re-formed between attempts, because the first one killed
    // some of it: the same squad twice is a party the city no longer has.
    const whatIsLeft = () => [{ unitId: 'Warrior' as UnitId, count: state.army.length }];
    enterRoom(state, map, BARROW, ['Warden'], whatIsLeft());
    expect(frontier(state, BARROW)).toEqual({ depth: 1, room: 2, done: false });
    enterRoom(state, map, BARROW, ['Warden'], whatIsLeft());
    expect(frontier(state, BARROW)).toEqual({ depth: 1, room: 3, done: false });
    expect(roomsCleared(state, BARROW)).toBe(2);
  });

  /** A room deep enough to actually hit back, for the tests about bodies. */
  const bloodyRoom = (units: Partial<Record<UnitId, number>>): GameState => {
    const state = readyToDelve(units);
    fund(state, { Gold: 40_000, Food: 9000, Stone: 4000 });
    reveal(state, [RUINS.SunkenChapel.location]);
    // A tier-II room, five rooms into its second depth: deep enough that the
    // Chapel's own creature gets its swings in.
    state.ruins.SunkenChapel = { depth: 2, cleared: 4 };
    return state;
  };

  it('sends most of the fallen to the infirmary, and the rest nowhere', () => {
    const state = bloodyRoom({ Warrior: 60 });
    // Only a city that BUILT one has a ward; without it they simply die
    // (tests/infirmary.test.ts).
    addBuilt(state, 'Infirmary', { x: 4, y: 8 });
    const report = enterRoom(state, map, 'SunkenChapel', ['Warden'], company);
    const fell = report.losses.reduce((sum, l) => sum + l.count, 0);
    const hurt = report.wounded.reduce((sum, l) => sum + l.count, 0);
    expect(fell).toBeGreaterThan(0);
    // A bad room is a bill rather than a loss: what the ward catches can be
    // bought back at a military hall (tests/infirmary.test.ts).
    expect(hurt).toBe(Math.round(fell * ARMY.woundedShare));
    expect(woundedOf(state, 'Warrior')).toBe(hurt);
    expect(state.army).toHaveLength(60 - fell);
  });

  it('charges the fight\'s own dead, so a rout is free and a scrape is not', () => {
    // OVERWHELMING FORCE COSTS NOTHING. Sixty against the first room of the
    // first ruin wipe it before it swings, and the roster is untouched —
    // which is the whole reason to bring more than enough.
    const rout = readyToDelve({ Warrior: 60 });
    const easy = enterRoom(rout, map, BARROW, ['Warden'], company);
    expect(easy.result).toBe('Cleared');
    expect(easy.losses).toEqual([]);
    expect(rout.army).toHaveLength(60);

    // A fight that lasts costs bodies, win or lose, and they leave the ranks.
    const state = bloodyRoom({ Warrior: 60 });
    const hard = enterRoom(state, map, 'SunkenChapel', ['Warden'], company);
    const fell = hard.losses.reduce((sum, l) => sum + l.count, 0);
    expect(fell).toBeGreaterThan(0);
    expect(state.army).toHaveLength(60 - fell);

    // And a party that is driven off pays with everyone who was standing
    // there: the fight only ends when one side is gone.
    const beaten = readyToDelve({ Warrior: 2 });
    openRuin(beaten, 'StarObservatory');
    reveal(beaten, [RUINS.StarObservatory.location]);
    fund(beaten, { Gold: 20_000, Food: 5000, Stone: 2000 });
    const report = enterRoom(beaten, map, 'StarObservatory', ['Warden'],
      [{ unitId: 'Warrior', count: 2 }]);
    expect(report.result).toBe('Repelled');
    expect(report.losses.reduce((sum, l) => sum + l.count, 0)).toBe(2);
    expect(beaten.army).toHaveLength(0);
  });

  it('shows the room it is about to fight, and nothing it cannot know', () => {
    const state = readyToDelve({ Warrior: 60 });
    const preview = previewRoom(state, BARROW, ['Warden'], company);
    // The squads on the sheet ARE the board the resolver will use — the same
    // seeded room, asked twice.
    expect(preview.enemy).toEqual(
      roomBoard(state, BARROW, 1, 1).slots
        .filter((s) => s.unitId !== null)
        .map((s) => ({ unitId: s.unitId, count: s.count })));
    // …and the two numbers beside them are an ESTIMATE, which is all a sheet
    // can honestly be now (Docs/features/combat.md §12).
    expect(preview.attack).toBeGreaterThan(0);
    expect(preview.enough).toBe(preview.attack >= preview.power);
  });

  it('costs the supplies and nothing the player has banked when beaten', () => {
    // Two soldiers against the first room of the deepest ruin.
    const state = readyToDelve({ Warrior: 2 });
    openRuin(state, 'StarObservatory');
    reveal(state, [RUINS.StarObservatory.location]);
    fund(state, { Gold: 20_000, Food: 5000, Stone: 2000 });
    const gold = getWallet(state.city.wallet, 'Gold');
    const supplies = supplyCost(state, 'StarObservatory', 1, ['Warden']);
    const report = enterRoom(state, map, 'StarObservatory', ['Warden'],
      [{ unitId: 'Warrior', count: 2 }]);
    expect(report.result).toBe('Repelled');
    expect(report.wallet).toEqual({});
    expect(getWallet(state.city.wallet, 'Gold')).toBe(gold - supplies.Gold!);
    // …and the room is still there.
    expect(frontier(state, 'StarObservatory')).toEqual({ depth: 1, room: 1, done: false });
  });

  it('opens the next depth when the last room of one falls', () => {
    const state = readyToDelve({ Warrior: 200 });
    const rooms = depthDef(BARROW, 1)!.rooms;
    state.ruins[BARROW] = { depth: 1, cleared: rooms - 1 };
    const report = enterRoom(state, map, BARROW, ['Warden'],
      [{ unitId: 'Warrior', count: 200 }]);
    expect(report.result).toBe('Cleared');
    expect(report.depthCompleted).toBe(true);
    expect(frontier(state, BARROW)).toEqual({ depth: 2, room: 1, done: false });
    expect(state.deepestDepth).toBe(1);
  });

  it('pays a boss four times a room', () => {
    const state = readyToDelve();
    const rooms = depthDef(BARROW, 1)!.rooms;
    const plain = roomReward(state, BARROW, 1, rooms - 1).wallet.Gold!;
    const boss = roomReward(state, BARROW, 1, rooms).wallet.Gold!;
    expect(boss).toBeGreaterThan(plain * 3);
  });

  it('gives up the ruin’s relic when its last room falls, once', () => {
    const state = readyToDelve({ Warrior: 400 });
    const last = depthsOf(BARROW).length;
    state.ruins[BARROW] = { depth: last, cleared: depthDef(BARROW, last)!.rooms - 1 };
    const gems = getWallet(state.player.wallet, 'Gems');
    const report = enterRoom(state, map, BARROW, ['Warden'],
      [{ unitId: 'Warrior', count: 400 }]);
    expect(report.result).toBe('Cleared');
    expect(report.artifact).toBe(RUINS[BARROW].artifact);
    expect(state.ruinsCleared[BARROW]).toBe(true);
    expect(ruinIsFinished(state, BARROW)).toBe(true);
    // The recurring Gem faucet the design needs: one per ruin, once.
    expect(getWallet(state.player.wallet, 'Gems')).toBeGreaterThan(gems);
    // …and there is nothing left to enter.
    expect(enterRoom(state, map, BARROW, ['Warden'],
      [{ unitId: 'Warrior', count: 400 }]).result).toBe('Finished');
  });

  it('refuses a ruin whose gate still stands', () => {
    const state = readyToDelve({ Warrior: 60 });
    state.gates[BARROW] = { nextRaidAt: null, trips: 0, hoard: {}, cleared: false };
    expect(enterRoom(state, map, BARROW, ['Warden'], company).result).toBe('GateStanding');
  });

  it('survives a save round-trip, frontier and all', () => {
    const state = readyToDelve({ Warrior: 60 });
    enterRoom(state, map, BARROW, ['Warden'], company);
    enterRoom(state, map, BARROW, ['Warden'], company);
    const restored = deserialize(serialize(state, T0), map, T0)!;
    expect(restored.ruins[BARROW]).toEqual(state.ruins[BARROW]);
    expect(restored.deepestDepth).toBe(state.deepestDepth);
  });
});

describe('the read-out', () => {
  it('tells the player everything before they commit', () => {
    const state = readyToDelve({ Warrior: 60 });
    const preview = previewRoom(state, BARROW, ['Warden'],
      [{ unitId: 'Warrior', count: 60 }]);
    expect(preview.depth).toBe(1);
    expect(preview.room).toBe(1);
    expect(preview.rooms).toBe(roomCount(BARROW));
    expect(preview.power).toBeGreaterThan(0);
    expect(preview.attack).toBeGreaterThan(0);
    expect(preview.enough).toBe(preview.attack >= preview.power);
    // What it is worth, and what it costs to try.
    expect(preview.reward.wallet.Gold).toBeGreaterThan(0);
    expect(Object.keys(preview.supplies).length).toBeGreaterThan(0);
  });

  it('shows the squads the room is scored against', () => {
    const state = readyToDelve({ Warrior: 60 });
    const preview = previewRoom(state, BARROW, ['Warden'], []);
    const shown = preview.enemy.reduce((n, s) => n + UNITS[s.unitId].power * s.count, 0);
    expect(shown).toBe(preview.power);
  });

  it('marks the boss room as one', () => {
    const state = readyToDelve();
    const rooms = depthDef(BARROW, 1)!.rooms;
    state.ruins[BARROW] = { depth: 1, cleared: rooms - 1 };
    expect(previewRoom(state, BARROW, ['Warden'], []).isBoss).toBe(true);
  });

  // The two bars the sheet draws (Docs/features/11a-ruins-ui.md §2.5) are only
  // as honest as their denominators: the depth ladder is the RUIN's, the room
  // ladder is THIS DEPTH's, and mixing the two would draw a bar that fills at
  // the wrong pace and puts the boss in the wrong place.
  it('carries both ladders the widget draws a bar for', () => {
    const state = readyToDelve();
    const first = previewRoom(state, BARROW, ['Warden'], []);
    expect(first.depths).toBe(depthCount(BARROW));
    expect(first.roomsInDepth).toBe(depthDef(BARROW, 1)!.rooms);
    // The room ladder is the depth's, never the ruin's.
    expect(first.roomsInDepth).toBeLessThan(first.rooms);
    // …and it follows the player down.
    state.ruins[BARROW] = { depth: 2, cleared: 0 };
    const deeper = previewRoom(state, BARROW, ['Warden'], []);
    expect(deeper.roomsInDepth).toBe(depthDef(BARROW, 2)!.rooms);
    // The boss is the last room of the depth, which is where the bar puts it.
    state.ruins[BARROW] = { depth: 2, cleared: deeper.roomsInDepth - 1 };
    const atBoss = previewRoom(state, BARROW, ['Warden'], []);
    expect(atBoss.room).toBe(atBoss.roomsInDepth);
    expect(atBoss.isBoss).toBe(true);
  });
});

// A relic is the kingdom's or it is on the shelf: nothing carries one into a
// room any more (Docs/features/09-relics.md §5).
describe('a relic is no part of a room', () => {
  const troops = [{ unitId: 'Warrior' as UnitId, count: 60 }];

  it('neither blocks an attempt nor arms one', () => {
    const state = readyToDelve({ Warrior: 60 });
    grantArtifact(state, 'ForemansSigil');
    normaliseSlots(state);
    const bare = previewRoom(state, BARROW, ['Warden'], troops);
    attune(state, 0, 'ForemansSigil', T0);
    expect(roomBlock(state, map, BARROW, ['Warden'], troops)).toBeNull();
    const worn = previewRoom(state, BARROW, ['Warden'], troops);
    expect(worn.attack).toBe(bare.attack);
    expect(worn.stats.atk).toBe(bare.stats.atk);
  });
});

// Stables. Each unit is still behind its own technology, so the choice fills
// in as the player researches rather than arriving all at once.
describe('a hall can turn out more than one unit', () => {
  it('offers the three foot soldiers at the Barracks, and Cavalry only at the Stables', () => {
    expect(DISTRICTS.Barracks.trains).toEqual(['Warrior', 'Lancer', 'Archer']);
    expect(DISTRICTS.Stables.trains).toEqual(['Cavalry']);
    // Every trainable unit has a hall, and no unit is orphaned.
    for (const id of ['Warrior', 'Lancer', 'Archer', 'Cavalry'] as UnitId[]) {
      const halls = Object.values(DISTRICTS).filter((d) => d.trains.includes(id));
      expect(halls.length, `${id} is trained nowhere`).toBeGreaterThan(0);
    }
  });

  it('queues each of them into the SAME line at that hall, in order', () => {
    const state = readyToDelve({});
    for (const t of ['Warrior', 'Spears', 'Archery'] as const) completeTech(state, t);
    const barracks = state.city.districts.find((d) => d.definitionId === 'Barracks')!;

    expect(trainUnit(state, 'Archer', T0, barracks)).toBe('Queued');
    expect(trainUnit(state, 'Lancer', T0, barracks)).toBe('Queued');
    expect(lineFor(state, barracks.uniqueId).map((i) => i.trainee)).toEqual(['Archer', 'Lancer']);

    // One bench: the Archer (12s) finishes first because it was queued first,
    // and the Lancer starts only when the slot frees.
    advance(state, map, T0 + 13_000);
    expect(state.army.map((u) => u.definitionId)).toEqual(['Archer']);
    advance(state, map, T0 + 30_000);
    expect(state.army).toHaveLength(1); // the Lancer's 20s began at 12s
    advance(state, map, T0 + 33_000);
    expect(state.army.map((u) => u.definitionId)).toEqual(['Archer', 'Lancer']);
  });

  it('refuses a unit the hall does not turn out, even when another hall does', () => {
    const state = readyToDelve({});
    completeTech(state, 'Cavalry');
    const barracks = state.city.districts.find((d) => d.definitionId === 'Barracks')!;
    expect(trainUnit(state, 'Cavalry', T0, barracks)).toBe('NoBuilding');
  });

  it('still refuses one whose technology is missing', () => {
    const state = readyToDelve({});
    const barracks = state.city.districts.find((d) => d.definitionId === 'Barracks')!;
    expect(trainUnit(state, 'Archer', T0, barracks)).toBe('TechRequired');
  });
});

// Buying the wait (2026-09-02). The FINISH button on the training card takes
// the WHOLE line, priced at the build queue's rate (`rush.secondsPerGem`) — so
// the player meets one rule for buying time wherever they meet it.
describe('finishing a training line with gems', () => {
  const barracksOf = (state: GameState) =>
    state.city.districts.find((d) => d.definitionId === 'Barracks')!;

  it('prices the bench PLUS everyone behind it', () => {
    const state = readyToDelve({});
    completeTech(state, 'Warrior');
    const hall = barracksOf(state);
    trainUnit(state, 'Warrior', T0, hall); // 15s, started
    trainUnit(state, 'Warrior', T0, hall); // 15s, waiting

    // Five seconds in: 10 left on the bench + a full 15 behind it.
    expect(lineRemainingSeconds(state, hall.uniqueId, T0 + 5_000)).toBe(25);
    expect(lineRushCost(state, hall.uniqueId, T0 + 5_000)).toBe(5); // 25 s at 5 s a Gem
    // ...and it falls as the bench empties.
    expect(lineRushCost(state, hall.uniqueId, T0 + 12_000)).toBe(4); // 18 s
  });

  it('delivers every unit in the line and charges once', () => {
    const state = readyToDelve({});
    completeTech(state, 'Warrior');
    const hall = barracksOf(state);
    trainUnit(state, 'Warrior', T0, hall);
    trainUnit(state, 'Warrior', T0, hall);
    state.player.wallet.Gems = 1000;

    const cost = lineRushCost(state, hall.uniqueId, T0);
    expect(finishLineWithGems(state, hall.uniqueId, T0)).toBe('Success');
    expect(state.army).toHaveLength(2);
    expect(lineFor(state, hall.uniqueId)).toHaveLength(0);
    expect(getWallet(state.player.wallet, 'Gems')).toBe(1000 - cost);

    // And the advance cannot hand them over a second time.
    advance(state, map, T0 + 120_000);
    expect(state.army).toHaveLength(2);
  });

  it('takes only THAT hall, leaving the others training', () => {
    const state = readyToDelve({});
    completeTech(state, 'Warrior');
    completeTech(state, 'Cavalry');
    const hall = barracksOf(state);
    const stables = state.city.districts.find((d) => d.definitionId === 'Stables')!;
    trainUnit(state, 'Warrior', T0, hall);
    trainUnit(state, 'Cavalry', T0, stables);
    state.player.wallet.Gems = 100;

    expect(finishLineWithGems(state, hall.uniqueId, T0)).toBe('Success');
    expect(lineFor(state, stables.uniqueId)).toHaveLength(1); // untouched
    expect(state.army.map((u) => u.definitionId)).toEqual(['Warrior']);
  });

  it('refuses politely, and charges nothing, when the purse is short', () => {
    const state = readyToDelve({});
    completeTech(state, 'Warrior');
    const hall = barracksOf(state);
    trainUnit(state, 'Warrior', T0, hall);
    state.player.wallet.Gems = 0;
    expect(finishLineWithGems(state, hall.uniqueId, T0)).toBe('NotEnoughGems');
    expect(lineFor(state, hall.uniqueId)).toHaveLength(1);
    expect(getWallet(state.player.wallet, 'Gems')).toBe(0);
  });

  it('says so when there is nothing to buy', () => {
    const state = readyToDelve({});
    state.player.wallet.Gems = 100;
    expect(finishLineWithGems(state, barracksOf(state).uniqueId, T0)).toBe('NothingTraining');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(100);
  });

  // A villager bought outright must land by the same path as a waited-for one,
  // or its tax anchor is repriced at the wrong instant.
  it('a rushed villager starts paying tax from the moment it is bought', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', { x: 2, y: 0 });
    fund(state, { Food: 500 });
    state.player.wallet.Gems = 100;
    const hall = townhall(state);
    trainUnit(state, 'Villager', T0, hall);
    state.city.wallet.Gold = 0;
    state.city.lastTaxAt = T0;
    state.lastAdvance = T0;

    expect(finishLineWithGems(state, hall.uniqueId, T0)).toBe('Success');
    expect(state.city.population).toBe(1);
    advance(state, map, T0 + 60_000);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(30); // a full minute of rent
  });
});

// Docs/features/07-research.md §3 — Knowledge is the research clock,
// it is kingdom-scoped, and its rate is the ground you have taken.
//
// CLAIM: dungeons and the gacha, and nothing else. Clearing fog pays none
// (tests/fog.test.ts), the early quest chain pays none (tests/quests.test.ts),
// and the standing drip is earned one dungeon at a time rather than handed
// out for spotting one through the fog.
describe('Knowledge is the research clock, and cleared ruins drive it', () => {
  it('a ruin drips nothing until it has been CLEARED', () => {
    const state = readyToDelve();
    // The Barrow is discovered — readyToDelve can launch into it — and adds
    // nothing yet: only the base rate runs, and it is a rate a DAY.
    const base = KNOWLEDGE.basePerHour;
    expect(knowledgePerHour(state)).toBe(base);
    // The rate is a FRACTION of one an hour, so a day is the unit that banks
    // whole Knowledge: 0.8 an hour is one every four and a half hours.
    const before = getWallet(state.kingdom.wallet, 'Knowledge');
    advance(state, map, T0 + 86_400_000);
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(before + Math.floor(24 * base));

    state.ruinsCleared[BARROW] = true;
    expect(knowledgePerHour(state)).toBe(base + KNOWLEDGE.dripPerClearedRuinPerHour);
  });

  // The other half of the rate, and the reason the fog compounds into the
  // tree: a claimed landmark is territory too. Docs §3 — "Knowledge is not a
  // wage for existing, it is what the land teaches you once you have taken
  // some of it."
  it('a claimed landmark drips too, and pays a lump for taking the ground', () => {
    const state = freshGame();
    fund(state, { Gold: 1_000_000 });
    const def = LANDMARKS[0];
    reveal(state, [def.location]);
    expect(knowledgePerHour(state)).toBe(KNOWLEDGE.basePerHour); // no territory: the floor

    const held = getWallet(state.kingdom.wallet, 'Knowledge');
    expect(claimLandmark(state, map, def.location)).toBe('Claimed');
    // The lump lands the moment the ground is taken.
    expect(getWallet(state.kingdom.wallet, 'Knowledge'))
      .toBe(held + KNOWLEDGE.landmarkClaimLump);
    // …and the rate has territory on top of the floor.
    expect(knowledgePerHour(state))
      .toBe(KNOWLEDGE.basePerHour + KNOWLEDGE.perClaimedLandmarkPerHour);
  });

  // There IS a base rate (2026-09-08): the tree opens on the calendar, and
  // the province makes it open faster. A player who has taken no ground
  // learns the floor and nothing more — and starts with the opening's grant.
  it('pays a player who has taken no ground the floor, and only the floor', () => {
    const state = freshGame();
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(CURRENCIES.Knowledge.start);
    expect(knowledgePerHour(state)).toBe(KNOWLEDGE.basePerHour);
    advance(state, map, T0 + 86_400_000);
    expect(getWallet(state.kingdom.wallet, 'Knowledge'))
      .toBe(CURRENCIES.Knowledge.start + Math.floor(24 * KNOWLEDGE.basePerHour));
  });

  // THE LOAD-BEARING ASSERTION, for a rate that CHANGES mid-window.
  //
  // The drip banks whole units against an anchor, and the obvious worry is
  // that a rate change mid-walk re-measures the leftover remainder against
  // the new rate, landing the anchor somewhere the other path never puts it.
  //
  // It does not, and the reason is worth writing down because it looks like
  // an accident and is not: `advance` runs `runContinuous` UP TO a boundary
  // before `applyDueAt` does the discrete work at it, so the drip is always
  // settled at the exact instant before anything can change the rate. The
  // anchor is therefore `T0 + k × msPer` in both paths, and `floor` makes the
  // granularity of every observation in between irrelevant.
  //
  // What this test guards is narrower, and worth being honest about: the
  // ORDERING in `advance` is already held by `taxes.test.ts` and
  // `workers.test.ts`, which fail loudly if it moves. This one holds that the
  // Knowledge drip specifically stays replay-identical when its own rate
  // changes mid-window — the case those two do not exercise, because taxes
  // and training rates do not move underneath them.
  // A CLEARED RUIN CHANGES THE RATE, and it changes it at the instant the
  // last room falls — which is a player's tap, not a boundary. So the replay
  // assertion has nothing to prove here any more: the clock cannot move
  // between two advances on its own (Docs/features/11-expeditions.md §5).
  it('a cleared ruin lifts the rate from the moment its last room falls', () => {
    const state = readyToDelve({ Warrior: 400 });
    state.kingdom.lastKnowledgeAt = T0;
    const before = knowledgePerHour(state);
    const last = depthsOf(BARROW).length;
    state.ruins[BARROW] = { depth: last, cleared: depthDef(BARROW, last)!.rooms - 1 };
    expect(enterRoom(state, map, BARROW, ['Warden'],
      [{ unitId: 'Warrior', count: 400 }]).result).toBe('Cleared');
    expect(state.ruinsCleared[BARROW]).toBe(true);
    expect(knowledgePerHour(state)).toBeGreaterThan(before);
  });

  it('every cleared ruin adds its own hour rate, and the drip banks in whole units', () => {
    const state = readyToDelve();
    state.ruinsCleared[BARROW] = true;
    state.ruinsCleared.SunkenChapel = true;
    const rate = KNOWLEDGE.basePerHour + 2 * KNOWLEDGE.dripPerClearedRuinPerHour;
    expect(knowledgePerHour(state)).toBeCloseTo(rate, 10);

    state.kingdom.lastKnowledgeAt = T0;
    const before = getWallet(state.kingdom.wallet, 'Knowledge');
    advance(state, map, T0 + 86_400_000);
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(before + Math.floor(24 * rate));
  });

  // The runway that replaces the old "the map holds more Knowledge than the
  // tree costs" assertion in fog.test.ts. Demand is the collection; supply is
  // what five cleared ruins pay while the player is away.
  it('five cleared ruins carry the TREE on a scale of weeks', () => {
    const state = readyToDelve();
    for (const id of Object.keys(RUINS) as Array<keyof typeof RUINS>) {
      state.ruinsCleared[id] = true;
    }
    for (const l of LANDMARKS) state.landmarks.claimed[l.id] = true;
    const perDay = knowledgePerHour(state) * 24;
    const tree = TECH_ORDER.reduce((sum, id) => sum + techKnowledgeCost(id), 0);

    // The floor plus what the whole province holds.
    expect(perDay).toBeCloseTo((KNOWLEDGE.basePerHour
      + Object.keys(RUINS).length * KNOWLEDGE.dripPerClearedRuinPerHour
      + LANDMARKS.length * KNOWLEDGE.perClaimedLandmarkPerHour) * 24, 10);
    // …and it buys the tree in weeks, not days and not seasons. It used to
    // read a COLLECTIBLE's arc against this rate, which stopped meaning
    // anything when the collection moved to Stardust (2026-09-03) — the tree
    // is what a Knowledge rate actually buys (07-research.md §3).
    expect(tree / perDay).toBeGreaterThan(14);
    expect(tree / perDay).toBeLessThan(70);
  });
});
