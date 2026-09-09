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
} from '../src/sim/army';
import {
  BEATS, effectiveAttack, partyStats, typeMultiplier, type Party,
} from '../src/sim/combat';
import { attune, grantArtifact, normaliseSlots } from '../src/sim/artifacts';
import { advance } from '../src/sim/commands';
import { techKnowledgeCost } from '../src/sim/research';
import {
  ARMY, CURRENCIES, DISTRICTS, HEROES, KNOWLEDGE, LANDMARKS, RUINS,
  RUIN_ORDER, TECH_ORDER, UNITS, depthDef, depthsOf, roomCount, roomPower,
} from '../src/sim/data/definitions';
import {
  enterRoom, frontier, previewRoom, roomBlock, roomReward, roomsCleared,
  ruinIsFinished, supplyCost,
} from '../src/sim/expeditions';
import { claimLandmark } from '../src/sim/landmarks';
import { knowledgePerHour } from '../src/sim/mana';
import { deserialize, serialize } from '../src/sim/save';
import {
  getWallet, townhall, type ArtifactId, type GameState, type RuinId, type UnitId,
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

const party = (slots: Array<{ unitId: UnitId; count: number }>): Party =>
  ({ heroes: [{ id: 'Warden', level: 1 }], slots });

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

  it('does its work at COMPOSITION time', () => {
    const lancers = party([{ unitId: 'Lancer', count: 4 }]);
    const plain = partyStats(lancers).atk;
    expect(effectiveAttack(lancers, 'Cavalry')).toBeGreaterThan(plain);
    expect(effectiveAttack(lancers, 'Archer')).toBeLessThan(plain);
  });
});

describe('unit stats make a real trade', () => {
  it('Archers buy attack, Warriors buy survival — neither is right alone', () => {
    const archer = UNITS.Archer;
    const warrior = UNITS.Warrior;
    const goldOf = (u: typeof archer) => u.recruitCost.Gold ?? 0;
    expect(archer.atk / goldOf(archer)).toBeGreaterThan(warrior.atk / goldOf(warrior));
    expect(warrior.hp).toBeGreaterThan(archer.hp);
    expect(warrior.def).toBeGreaterThan(archer.def);
  });

  it('power equals attack, so the cap table reads as attack potential', () => {
    for (const u of Object.values(UNITS)) expect(u.power).toBe(u.atk);
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
  // after it a real stretch. Measured in ROOMS a party can walk through in
  // order — which is what a ruin is now — and against the WORST matchup, so
  // these are floors rather than best cases.
  it('the tier ladder actually holds at the authored numbers', () => {
    const reach = (troops: number, ruinId: RuinId): number => {
      let best = 0;
      for (const u of Object.keys(UNITS) as UnitId[]) {
        const attack = Math.round(
          (UNITS[u].atk * troops + HEROES.Warden.atk) * ARMY.typeDisadvantage);
        let rooms = 0;
        outer: for (const d of depthsOf(ruinId)) {
          for (let r = 1; r <= d.rooms; r++) {
            if (attack < roomPower(ruinId, d.depth, r)) break outer;
            rooms += 1;
          }
        }
        best = Math.max(best, rooms);
      }
      return best;
    };
    // The company the quest chain musters: half the Barrow, and the door of
    // the next ruin shut.
    expect(reach(24, 'HollowBarrow')).toBeGreaterThan(0);
    expect(reach(24, 'HollowBarrow')).toBeLessThan(roomCount('HollowBarrow'));
    expect(reach(24, 'SunkenChapel')).toBe(0);
    // Sixty under arms — the chain's later warband — walks the Barrow out and
    // gets most of the way through the Chapel.
    expect(reach(60, 'HollowBarrow')).toBe(roomCount('HollowBarrow'));
    expect(reach(60, 'SunkenChapel')).toBeGreaterThan(0);
    expect(reach(60, 'SunkenChapel')).toBeLessThan(roomCount('SunkenChapel'));
    // A hundred and fifty finishes the Chapel and stalls inside the Ironworks.
    expect(reach(150, 'SunkenChapel')).toBe(roomCount('SunkenChapel'));
    expect(reach(150, 'DrownedIronworks')).toBeLessThan(roomCount('DrownedIronworks'));
    // A full board of the best type — the ceiling of what any party can be —
    // takes the Counting House and still leaves the deepest ruin unfinished.
    expect(reach(600, 'CountingHouse')).toBe(roomCount('CountingHouse'));
    expect(reach(600, 'StarObservatory')).toBeGreaterThan(0);
    expect(reach(600, 'StarObservatory')).toBeLessThan(roomCount('StarObservatory'));
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

  it('costs soldiers, win or lose, and the fallen never come back', () => {
    const state = readyToDelve({ Warrior: 60 });
    const won = enterRoom(state, map, BARROW, ['Warden'], company);
    expect(won.result).toBe('Cleared');
    const lostWinning = won.losses.reduce((sum, l) => sum + l.count, 0);
    expect(lostWinning).toBeGreaterThan(0);
    expect(state.army).toHaveLength(60 - lostWinning);

    // …and a beating costs more than a win, because a party that is driven
    // off gives the enemy all the time it needs.
    const beaten = readyToDelve({ Warrior: 2 });
    openRuin(beaten, 'StarObservatory');
    reveal(beaten, [RUINS.StarObservatory.location]);
    fund(beaten, { Gold: 20_000, Food: 5000, Stone: 2000 });
    const report = enterRoom(beaten, map, 'StarObservatory', ['Warden'],
      [{ unitId: 'Warrior', count: 2 }]);
    expect(report.result).toBe('Repelled');
    expect(report.losses.reduce((sum, l) => sum + l.count, 0)).toBeGreaterThan(0);
    expect(beaten.army.length).toBeLessThan(2);
  });

  it('says what an attempt will cost in bodies before it is made', () => {
    const state = readyToDelve({ Warrior: 60 });
    const preview = previewRoom(state, BARROW, ['Warden'], company);
    const expected = preview.losses.reduce((sum, l) => sum + l.count, 0);
    expect(expected).toBeGreaterThan(0);
    const report = enterRoom(state, map, BARROW, ['Warden'], company);
    expect(report.losses).toEqual(preview.losses);
    expect(state.army).toHaveLength(60 - expected);
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
});

describe('attune or arm', () => {
  const troops = [{ unitId: 'Warrior' as UnitId, count: 60 }];
  const armed = (relic: ArtifactId = 'ForemansSigil') => {
    const state = readyToDelve({ Warrior: 60 });
    grantArtifact(state, relic);
    normaliseSlots(state);
    return state;
  };

  it('refuses to send a relic the kingdom is wearing', () => {
    const state = armed();
    attune(state, 0, 'ForemansSigil', T0);
    expect(roomBlock(state, map, BARROW, ['Warden'], troops, 'ForemansSigil'))
      .toBe('ArtifactAttuned');
    expect(roomBlock(state, map, BARROW, ['Warden'], troops)).toBeNull();
  });

  it('is worth attack in the room it walks into', () => {
    const state = armed();
    const bare = previewRoom(state, BARROW, ['Warden'], troops);
    const withRelic = previewRoom(state, BARROW, ['Warden'], troops, 'ForemansSigil');
    expect(withRelic.attack).toBeGreaterThan(bare.attack);
    expect(withRelic.stats.atk).toBeGreaterThan(bare.stats.atk);
  });

  it('comes straight back out — a room is over the moment it is entered', () => {
    const state = armed();
    enterRoom(state, map, BARROW, ['Warden'], troops, 'ForemansSigil');
    // Nothing holds it, so the kingdom can wear it again immediately.
    expect(attune(state, 0, 'ForemansSigil', T0)).toBe('Attuned');
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
