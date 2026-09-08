// The declarative resolver: the registry's rules, the arithmetic, and the aim.
//
// The one thing here that is a CHOICE and not an implementation detail is that
// a percentage is authored in whole points and divided PER EFFECT, before the
// sum — `5/100` three times is bit-identical to `3 * 0.05`, while `15/100` is
// a different double. That is what let the shipped numbers stay exactly where
// they were while a designer authors `-22`, so it is asserted with `toBe`
// rather than `toBeCloseTo` below, and it must stay that way.

import { describe, expect, it } from 'vitest';
import { HARVEST, TECHNOLOGIES } from '../src/sim/data/definitions';
import {
  TECH_STATS, TECH_STAT_IDS, effectLabel, effectProblems, effectKey,
  type StatDef, type TechStat,
} from '../src/sim/data/techEffectRules';
import {
  techFlat, techFlatAimed, techMultiplier, techTotals, techValue,
} from '../src/sim/techEffects';
import { effectiveTaxRate } from '../src/sim/upgrades';
import type { GameState, TechId } from '../src/sim/state';
import { bonusLadders, completeRanks, freshGame, ladders } from './helpers';

/** A kingdom holding every rank of every ladder — the state that makes a
 *  mis-aimed or double-counted effect as loud as it can be. */
function maxed(): GameState {
  const state = freshGame();
  for (const ladder of bonusLadders) completeRanks(state, ladder, ladders[ladder].length);
  return state;
}

describe('the effect registry', () => {
  it('gives every stat a reader, so nothing authored is inert', () => {
    for (const stat of TECH_STAT_IDS) {
      expect(TECH_STATS[stat].reads, `${stat} says nothing about who reads it`)
        .toMatch(/^[a-z]+\.ts#[A-Za-z]+$/);
      expect(TECH_STATS[stat].ops.length).toBeGreaterThan(0);
      expect(TECH_STATS[stat].targets).toContain('global');
    }
  });

  it('refuses an effect the game cannot carry out', () => {
    const bad = [
      { stat: 'nonsense' as never, op: 'flat' as const, value: 1 },
      { stat: 'buildTime' as const, op: 'flat' as const, value: 1 },
      { stat: 'typeDisadvantage' as const, op: 'percent' as const, value: 10 },
      { stat: 'manaCap' as const, op: 'flat' as const, value: 0 },
      { stat: 'taxRate' as const, op: 'percent' as const, value: 2.5 },
      { stat: 'manaCap' as const, op: 'flat' as const, value: 1, target: { harvest: 'Forest' as const } },
      { stat: 'harvestUnitsPerStrike' as const, op: 'flat' as const, value: 1, target: { harvest: 'Coal' as never } },
      // A regrowth bonus on something that does not grow back. A berry bush
      // is CONSUMED and reappears on another tile, so its clock is
      // `respawnSeconds` in another call site — aiming recovery at it would
      // be a rank the player pays for and nothing collects.
      { stat: 'harvestRecovery' as const, op: 'percent' as const, value: -20, target: { harvest: 'Berries' as const } },
      { stat: 'harvestRecovery' as const, op: 'percent' as const, value: -20, target: { harvest: 'Fish' as const } },
      // Seconds of waiting take a percentage, not a flat second: the same
      // second off a 60 s regrowth and a 300 s one are different mechanics.
      { stat: 'harvestRecovery' as const, op: 'flat' as const, value: -10, target: { harvest: 'Forest' as const } },
    ];
    for (const effect of bad) {
      expect(effectProblems(effect), effectLabel(effect)).not.toEqual([]);
    }
    // …and accepts the shapes the tree actually uses.
    for (const good of [
      { stat: 'buildTime' as const, op: 'percent' as const, value: -5 },
      { stat: 'harvestUnitsPerStrike' as const, op: 'flat' as const, value: 1, target: { harvest: 'Crops' as const } },
      { stat: 'unitDef' as const, op: 'flat' as const, value: 1, target: { unitTag: 'Melee' as const } },
      // "Trees grow back 20% faster" — a NEGATIVE percent, because the number
      // is seconds of waiting and less of it is the good news.
      { stat: 'harvestRecovery' as const, op: 'percent' as const, value: -20, target: { harvest: 'Forest' as const } },
      { stat: 'harvestRecovery' as const, op: 'percent' as const, value: -10, target: { harvest: 'Crops' as const } },
      { stat: 'harvestRecovery' as const, op: 'percent' as const, value: -5 },
    ]) {
      expect(effectProblems(good), effectLabel(good)).toEqual([]);
    }
  });

  it('narrows an aim to the subjects that HAVE the number', () => {
    // `targetIds` is the twin of `ops`: both refuse an authoring that would
    // read as a bonus and collect nothing. Derived from the workbook, so a
    // designer who gives the berries a regrowth time makes them aimable by
    // doing that and nothing else.
    // Read through StatDef: the registry is a narrow literal, so an entry
    // that authors no `targetIds` has no such property to compare.
    const def = (stat: TechStat): StatDef => TECH_STATS[stat] as StatDef;
    const recovers = def('harvestRecovery').targetIds!;
    for (const [id, spec] of Object.entries(HARVEST)) {
      expect(recovers.includes(id), `${id} recovers in place: ${spec.recoverySeconds}s`)
        .toBe(spec.recoverySeconds > 0);
    }
    // Every other stat aims at every id of the kinds it accepts.
    expect(def('harvestUnitsPerStrike').targetIds).toBeUndefined();
  });

  it('keys a target by its KIND, so a coin and a mountain are not one scope', () => {
    // `ModifierScope` is a bare id union, where 'Stone' the currency and
    // 'Stone' the harvest source are the same scope. This layer must not
    // inherit that.
    expect(effectKey('harvestUnitsPerStrike', { harvest: 'Stone' }))
      .not.toBe(effectKey('harvestUnitsPerStrike', { district: 'Quarry' }));
    expect(effectKey('manaCap')).toBe('manaCap|*');
  });
});

describe('the resolver', () => {
  it('sums what is complete, and only that', () => {
    const state = freshGame();
    const forest = { harvest: 'Forest' } as const;
    expect(techFlat(state, 'harvestUnitsPerStrike', forest)).toBe(0);
    completeRanks(state, 'Sawpits', 2);
    expect(techFlat(state, 'harvestUnitsPerStrike', forest)).toBe(2);
    completeRanks(state, 'Sawpits', 3);
    expect(techFlat(state, 'harvestUnitsPerStrike', forest)).toBe(3);
  });

  // The trap the whole target vocabulary exists to avoid: an effect aimed at
  // one cell must not lift another, and an unaimed one lifts them all.
  it('aims: Sawpits lifts the forest and nothing else', () => {
    const state = freshGame();
    completeRanks(state, 'Sawpits', 3);
    expect(techFlat(state, 'harvestUnitsPerStrike', { harvest: 'Forest' })).toBe(3);
    expect(techFlat(state, 'harvestUnitsPerStrike', { harvest: 'Crops' })).toBe(0);
    expect(techFlat(state, 'harvestUnitsPerStrike')).toBe(0); // nothing unaimed
  });

  it('stacks two ladders aimed at one cell', () => {
    const state = freshGame();
    completeRanks(state, 'Irrigation', 3);
    completeRanks(state, 'Scythes', 3);
    // What `ABUNDANCE_LINES` said with a table of two entries under `Crops`.
    expect(techFlat(state, 'harvestUnitsPerStrike', { harvest: 'Crops' })).toBe(6);
    expect(techFlat(state, 'harvestUnitsPerStrike', { harvest: 'Meat' })).toBe(0);
  });

  it('keeps an unaimed query clear of the aimed effects', () => {
    const state = maxed();
    // Warhorns is unaimed; Fletching aims at Distance. The Drill needs each
    // separately or combat pays the unaimed one once per tag a unit carries.
    expect(techFlat(state, 'unitAtk')).toBe(3);
    expect(techFlatAimed(state, 'unitAtk', { unitTag: 'Distance' })).toBe(3);
    expect(techFlat(state, 'unitAtk', { unitTag: 'Distance' })).toBe(6); // both, on purpose
  });

  it('divides a percent per effect, which is what keeps it bit-exact', () => {
    const state = freshGame();
    completeRanks(state, 'Carpentry', 3);
    expect(techTotals(state, 'buildTime').pct).toBe(3 * -0.05);
    // …and NOT the value a single division would give.
    expect(techTotals(state, 'buildTime').pct).not.toBe(-15 / 100);
  });

  it('is the identity for a stat nothing authors', () => {
    const state = maxed();
    expect(techValue(state, 'populationCapacity', 7)).toBe(7);
    expect(techMultiplier(state, 'populationCapacity')).toBe(1);
  });

  // Completion order is a fact about a save's history, not about a kingdom.
  // Float addition is not associative, so folding in that order would let two
  // clients holding the same technologies disagree in the last bit.
  it('does not depend on the order the player researched things in', () => {
    const forward = maxed();
    const shuffled = maxed();
    const seeded = [...shuffled.research.completed];
    // A deterministic shuffle: reverse, then rotate, so the set is identical
    // and the order is not.
    shuffled.research.completed = [...seeded.slice(60).reverse(), ...seeded.slice(0, 60)];
    for (const stat of TECH_STAT_IDS) {
      expect(techTotals(shuffled, stat), stat).toEqual(techTotals(forward, stat));
    }
  });
});

// The parity block that lived here proved, expression by expression, that
// each reader's new form equalled its `effect(state, 'Line')` form at 0 to 5
// ranks of every ladder. Both halves were needed to write it, so it went when
// `effect()` did — its job was the crossing, and the crossing is done. So did
// the frozen fixture that proved no number moved; what survives of it is
// `tests/ladderEffects.test.ts`, which asserts every ladder still moves
// something.
describe('every rank in the shipped tree carries a legal effect', () => {
  it('gives every rank of every ladder exactly one effect the rules accept', () => {
    for (const ladder of bonusLadders) {
      for (const id of ladders[ladder]) {
        const effects = TECHNOLOGIES[id].effects;
        expect(effects, `${id} is a bonus but moves nothing`).toHaveLength(1);
        expect(effectProblems(effects[0]), effectLabel(effects[0])).toEqual([]);
      }
    }
  });
});

// THE GESTURE THE WHOLE SYSTEM EXISTS FOR: a bonus nobody wrote code for.
//
// "+5% gold income from houses" was the example that started this — a kind of
// bonus the tree could not express, because a line's hook was a call site and
// nothing read a per-building tax rate. Nothing in the shipped tree aims at a
// district yet, so this authors one the way `?dev=tree` would, on a
// technology that already exists, and asks the SIM what a house now pays.
//
// It mutates `TECHNOLOGIES` and puts it back, which is the price of testing a
// technology that is not in the file. Worth paying once: without it the
// district half of `effectiveTaxRate` is only exercised by a call site passing
// a target no effect ever names, which proves the plumbing and not the water.
describe('a bonus the code has never heard of', () => {
  it('taxes one kind of roof and leaves the rest alone', () => {
    const host = 'TradeRoutesV' satisfies TechId;
    const was = TECHNOLOGIES[host].effects;
    try {
      TECHNOLOGIES[host].effects = [
        { stat: 'taxRate', op: 'percent', value: 5, target: { district: 'Housing' } },
      ];
      const state = freshGame();
      const before = effectiveTaxRate(state, 'Housing');
      // Pushed, not `completeTech`ed: that recurses the requirements, and
      // four of `TradeRoutes`' own earlier ranks lift the rate for every roof
      // — which would drown the one thing under test.
      state.research.completed.push(host);

      // The house it names pays more…
      expect(effectiveTaxRate(state, 'Housing')).toBeCloseTo(before * 1.05, 9);
      // …and nothing else does: not another building, and not the unaimed
      // rate the daily reward and the city-wide estimate read.
      expect(effectiveTaxRate(state, 'Townhall')).toBe(before);
      expect(effectiveTaxRate(state)).toBe(before);
    } finally {
      TECHNOLOGIES[host].effects = was;
    }
  });
});
