// The tick resolver, rule by rule (Docs/features/combat.md §7–§11, §16).
//
// A fight is the one system in the game whose output nobody reads directly:
// the player watches a replay of it and the caller reads a number off the
// end. So the rules have to be pinned HERE, one at a time, against boards
// built by hand — and the whole thing has to be reproducible, which is what
// the golden log at the bottom is for.
import { describe, expect, it } from 'vitest';
import {
  boardPower, buildBoard, generateEnemy, resolveBattle, survivorsOf, targetingFor,
  type BattleEvent, type FighterSpec, type SquadSpec,
} from '../src/sim/battle';
import { COMBAT, UNITS, VILLAINS } from '../src/sim/data/definitions';
import type { UnitId } from '../src/sim/state';

/** A fighter with no passive, so a test about bodies is about bodies. */
const body = (over: Partial<FighterSpec> = {}): FighterSpec => ({
  id: 'probe',
  name: 'Probe',
  type: 'Warrior',
  dmg: 10,
  def: 0,
  hp: 100,
  cooldown: 10,
  power: 5,
  troopDmgMult: 1,
  troopHpMult: 1,
  troopDefBonus: 0,
  ...over,
});

const squad = (unitId: UnitId, count: number): SquadSpec => ({ unitId, count });

const attacks = (events: readonly BattleEvent[]) => events
  .filter((e): e is Extract<BattleEvent, { kind: 'attack' }> => e.kind === 'attack');

/** Our side's swings only. Whose lands FIRST is a question about cooldowns,
 *  not about targeting, so a test about targeting must not ask it. */
const ourAttacks = (events: readonly BattleEvent[]) => attacks(events)
  .filter((e) => e.from.side === 'ours');

describe('the damage formula', () => {
  // §7, worked by hand: 100 Warriors hit with `frontage` 50, each for
  // `dmg 8 − def 1` against an Archer, and Warrior→Archer is a DISADVANTAGE
  // (the archer beats the warrior), so the swing is three quarters.
  it('is frontage × (dmg − def), then the type fraction, floored', () => {
    const ours = buildBoard([squad('Warrior', 100)], []);
    const theirs = buildBoard([squad('Archer', 80)], []);
    const log = resolveBattle(ours, theirs);
    const first = attacks(log.events)[0]!;
    expect(first.from).toEqual({ side: 'ours', id: 0 });
    expect(first.hits).toBe(50); // frontage, not the hundred standing there
    expect(first.dealt).toBe(Math.floor((50 * (8 - 1) * 3) / 4)); // 262
  });

  it('never lets defence take a swing below one a troop', () => {
    // A hero with def 50 against a unit that hits for 8: the floor is 1 each.
    const ours = buildBoard([squad('Warrior', 10)], []);
    const theirs = buildBoard([], [body({ def: 50, hp: 1000, type: 'Lancer' })]);
    const log = resolveBattle(ours, theirs);
    const first = attacks(log.events)[0]!;
    // Warrior beats Lancer: ten troops, one damage each, ×3/2.
    expect(first.dealt).toBe(15);
  });

  it('spends troops whole, and keeps the remainder in the pool', () => {
    const ours = buildBoard([squad('Warrior', 100)], []);
    const theirs = buildBoard([squad('Warrior', 100)], []);
    const log = resolveBattle(ours, theirs);
    const lost = log.events.find((e) => e.kind === 'troops_lost');
    expect(lost?.kind).toBe('troops_lost');
    if (lost?.kind !== 'troops_lost') return;
    // 50 hits × (8 − 3) = 250 off a 2,000-point pool: 1,750 left, and
    // `ceil(1750 / 20)` = 88 still standing.
    expect(lost.hpPool).toBe(1750);
    expect(lost.alive).toBe(88);
  });
});

describe('targeting', () => {
  it('reads off the unit, so a type is never described twice', () => {
    expect(targetingFor('Warrior')).toBe('melee');
    expect(targetingFor('Lancer')).toBe('melee');
    expect(targetingFor('Archer')).toBe('ranged');
    expect(targetingFor('Cavalry')).toBe('flanker');
  });

  it('sends melee at the front row, and only then at the back', () => {
    const ours = buildBoard([squad('Warrior', 100)], []);
    // An Archer sits in the BACK row, a Lancer in the front — and the back
    // rank is deep enough that the fight outlives the front one.
    const theirs = buildBoard([squad('Archer', 80), squad('Lancer', 4)], []);
    const front = theirs.slots.find((s) => s.row === 'front')!;
    const back = theirs.slots.find((s) => s.row === 'back')!;
    const log = resolveBattle(ours, theirs);
    expect(ourAttacks(log.events)[0]!.to.id).toBe(front.id);
    // …and once the front rank is gone, the archers behind it.
    const wiped = log.events.findIndex(
      (e) => e.kind === 'slot_wiped' && e.at.side === 'theirs' && e.at.id === front.id);
    expect(wiped).toBeGreaterThan(0);
    const after = ourAttacks(log.events.slice(wiped));
    expect(after.length).toBeGreaterThan(0);
    expect(after[0]!.to.id).toBe(back.id);
  });

  it('sends a flanker at the back row first', () => {
    const ours = buildBoard([squad('Cavalry', 10)], []);
    const theirs = buildBoard([squad('Warrior', 10), squad('Archer', 10)], []);
    const back = theirs.slots.find((s) => s.row === 'back')!;
    const log = resolveBattle(ours, theirs);
    expect(ourAttacks(log.events)[0]!.to.id).toBe(back.id);
  });

  it('sends a ranged squad at the weakest pool, wherever it stands', () => {
    const ours = buildBoard([squad('Archer', 10)], []);
    // The Cavalry squad is thinner: 2 × 24 hp against the Warriors' 10 × 20.
    const theirs = buildBoard([squad('Warrior', 10), squad('Cavalry', 2)], []);
    const thin = theirs.slots.find((s) => s.unitId === 'Cavalry')!;
    const log = resolveBattle(ours, theirs);
    expect(ourAttacks(log.events)[0]!.to.id).toBe(thin.id);
  });
});

describe('the clock', () => {
  it('lets the shorter cooldown swing more often', () => {
    // Archers are 12 ticks, Warriors 10 — over a long fight the Warriors
    // must have swung strictly more times.
    const ours = buildBoard([squad('Warrior', 60)], []);
    const theirs = buildBoard([squad('Archer', 60)], []);
    const log = resolveBattle(ours, theirs);
    const mine = attacks(log.events).filter((e) => e.from.side === 'ours').length;
    const theirsCount = attacks(log.events).filter((e) => e.from.side === 'theirs').length;
    expect(mine).toBeGreaterThan(theirsCount);
  });

  it('gives a stalemate to the DEFENDER, and says why', () => {
    // Two walls that cannot hurt each other: def above dmg on both sides, so
    // every swing is the one-point floor and the clock runs out.
    const wall = body({ dmg: 1, def: 99, hp: 100_000, cooldown: 40 });
    const log = resolveBattle(buildBoard([], [wall]), buildBoard([], [{ ...wall, id: 'foe' }]));
    expect(log.reason).toBe('timeout');
    expect(log.winner).toBe('theirs');
    expect(log.ticks).toBe(COMBAT.timeoutTicks);
  });

  it('ends the moment the last slot falls, and says that too', () => {
    const log = resolveBattle(
      buildBoard([squad('Cavalry', 60)], []),
      buildBoard([squad('Archer', 1)], []),
    );
    expect(log.reason).toBe('wiped');
    expect(log.winner).toBe('ours');
    expect(log.events.at(-1)).toMatchObject({ kind: 'end', winner: 'ours' });
    // Nothing is logged after the end.
    expect(log.events.filter((e) => e.kind === 'end')).toHaveLength(1);
  });

  it('is over before it begins when one side is empty', () => {
    const log = resolveBattle(buildBoard([], []), buildBoard([squad('Warrior', 1)], []));
    expect(log.winner).toBe('theirs');
    expect(log.ticks).toBe(0);
  });
});

describe('a hero on the board', () => {
  it('fights with a frontage of one, and stops when it dies', () => {
    const ours = buildBoard([], [body({ dmg: 40, hp: 30 })]);
    const theirs = buildBoard([squad('Warrior', 100)], []);
    const log = resolveBattle(ours, theirs);
    expect(attacks(log.events)[0]!.hits).toBe(1);
    expect(log.winner).toBe('theirs');
  });

  it('multiplies its OWN type, and nothing else (§9.2)', () => {
    const passive = body({ type: 'Warrior', troopDmgMult: 2, troopHpMult: 2, troopDefBonus: 5 });
    const board = buildBoard([squad('Warrior', 10), squad('Archer', 10)], [passive]);
    const warriors = board.slots.find((s) => s.unitId === 'Warrior')!;
    const archers = board.slots.find((s) => s.unitId === 'Archer')!;
    expect(warriors.dmg).toBe(UNITS.Warrior.dmg * 2);
    expect(warriors.hpUnit).toBe(UNITS.Warrior.hp * 2);
    expect(warriors.def).toBe(UNITS.Warrior.def + 5);
    expect(archers.dmg).toBe(UNITS.Archer.dmg);
    expect(archers.hpUnit).toBe(UNITS.Archer.hp);
  });

  it('stacks additively on the excess with a second hero of its type', () => {
    const a = body({ id: 'a', troopDmgMult: 1.5 });
    const b = body({ id: 'b', troopDmgMult: 1.25 });
    const board = buildBoard([squad('Warrior', 10)], [a, b]);
    // 1 + 0.5 + 0.25, not 1.5 × 1.25.
    expect(board.slots[0]!.dmg).toBe(Math.round(UNITS.Warrior.dmg * 1.75));
  });

  it('holds its buff after it falls — the bonus is start-of-battle', () => {
    const glass = body({ dmg: 1, hp: 1, troopDmgMult: 3, cooldown: 99 });
    const ours = buildBoard([squad('Warrior', 20)], [glass]);
    expect(ours.slots[0]!.dmg).toBe(UNITS.Warrior.dmg * 3);
    const log = resolveBattle(ours, buildBoard([squad('Lancer', 60)], []));
    // The hero is wiped early; the squad's damage never changes after that.
    const dealt = attacks(log.events).filter((e) => e.from.side === 'ours' && e.from.id === 0);
    expect(new Set(dealt.map((e) => e.dealt)).size).toBeLessThanOrEqual(2);
  });
});

describe('what the caller reads off it', () => {
  it('counts the survivors of every slot, so losses are the fight\'s own', () => {
    const ours = buildBoard([squad('Warrior', 100)], []);
    const log = resolveBattle(ours, buildBoard([squad('Lancer', 40)], []));
    const left = survivorsOf(log, 'ours');
    expect(left.get(0)).toBeLessThan(100);
    expect(left.get(0)).toBeGreaterThan(0);
  });

  it('adds up the board for the bar at the top', () => {
    expect(boardPower(buildBoard([squad('Warrior', 10)], []))).toBe(10 * UNITS.Warrior.power);
  });
});

describe('the generator', () => {
  it('is a pure function of the room it is generating (§11)', () => {
    const once = generateEnemy({ seed: 42, parts: ['HollowBarrow', 2, 5], budget: 400, affinity: 'Warrior' });
    const twice = generateEnemy({ seed: 42, parts: ['HollowBarrow', 2, 5], budget: 400, affinity: 'Warrior' });
    expect(twice).toEqual(once);
    const elsewhere = generateEnemy({ seed: 42, parts: ['HollowBarrow', 2, 6], budget: 400, affinity: 'Warrior' });
    expect(elsewhere).not.toEqual(once);
  });

  it('spends nearly all of the budget, and leads with the ruin\'s own type', () => {
    for (const budget of [80, 400, 1200]) {
      const plan = generateEnemy({ seed: 1, parts: ['probe'], budget, affinity: 'Archer' });
      const spent = boardPower(buildBoard(plan.squads, plan.fighters));
      expect(spent, `budget ${budget}`).toBeLessThanOrEqual(budget);
      expect(spent, `budget ${budget}`).toBeGreaterThan(budget * 0.8);
      expect(plan.squads[0]!.unitId).toBe('Archer');
    }
  });

  it('never fields more squads than the board has slots', () => {
    const plan = generateEnemy({ seed: 1, parts: ['probe'], budget: 99_999, affinity: 'Warrior' });
    expect(plan.squads.length).toBeLessThanOrEqual(COMBAT.genSlotsMax);
  });

  it('puts the melee in front and the archers behind (§11 step 5)', () => {
    const plan = generateEnemy({ seed: 3, parts: ['probe'], budget: 600, affinity: 'Any' });
    const board = buildBoard(plan.squads, plan.fighters);
    for (const s of board.slots) {
      expect(s.row).toBe(s.unitId === 'Archer' ? 'back' : 'front');
    }
  });

  it('spends part of a big budget on a villain, and none of a small one', () => {
    const pool = ['BarrowThane'] as const;
    const thin = generateEnemy({
      seed: 1, parts: ['probe'], budget: 100, affinity: 'Warrior', villainPool: pool as never,
    });
    expect(thin.fighters).toHaveLength(0);
    // A deep room spends up to a hero slot's worth of them — three, the same
    // three the player fields — because SQUADS SATURATE at six slots and a
    // villain is the only thing another thousand points can buy (§3, §11).
    const deep = generateEnemy({
      seed: 1, parts: ['probe'], budget: 1200, affinity: 'Warrior', villainPool: pool as never,
    });
    expect(deep.fighters).toHaveLength(COMBAT.genVillainSlots);
    expect(new Set(deep.fighters.map((f) => f.id))).toEqual(new Set(['BarrowThane']));
  });

  it('always fields the authored villain in a boss room, whatever the budget', () => {
    const plan = generateEnemy({
      seed: 1, parts: ['probe'], budget: 80, affinity: 'Warrior', boss: 'BarrowThane' as never,
    });
    expect(plan.fighters.map((f) => f.id)).toEqual(['BarrowThane']);
    expect(plan.fighters[0]!.dmg).toBe(VILLAINS.BarrowThane.dmg);
  });
});

// THE GOLDEN LOG (§16). One board pair, one expected stream, compared whole.
//
// It is here to make a change to §7, §8 or §10 impossible to make by
// accident: any of them rewrites this list, and a diff that rewrites it is a
// diff that has to say why. Regenerate it deliberately — never by pasting
// whatever the code now prints.
describe('determinism', () => {
  const ours = () => buildBoard(
    [squad('Warrior', 30), squad('Archer', 20)],
    [body({ id: 'Warden', name: 'The Warden', dmg: 40, def: 4, hp: 200, cooldown: 12 })],
  );
  const theirs = () => buildBoard([squad('Lancer', 25), squad('Cavalry', 8)], []);

  it('replays the same fight twice, event for event', () => {
    expect(JSON.stringify(resolveBattle(ours(), theirs()).events))
      .toBe(JSON.stringify(resolveBattle(ours(), theirs()).events));
  });

  it('leaves the boards it was handed untouched', () => {
    const board = ours();
    const before = JSON.stringify(board);
    resolveBattle(board, theirs());
    expect(JSON.stringify(board)).toBe(before);
  });

  it('matches the golden log', () => {
    const log = resolveBattle(ours(), theirs());
    const shape = log.events.map((e) => (e.kind === 'start'
      ? 'start'
      : e.kind === 'end'
        ? `end ${e.tick} ${e.winner} ${e.reason}`
        : e.kind === 'attack'
          ? `${e.tick} ${e.from.side[0]}${e.from.id}→${e.to.side[0]}${e.to.id} ${e.hits}×${e.dealt}`
          : e.kind === 'troops_lost'
            ? `${e.tick} ${e.at.side[0]}${e.at.id} left ${e.alive}`
            : `${e.tick} ${e.at.side[0]}${e.at.id} wiped`));
    expect(shape).toMatchSnapshot();
  });
});
