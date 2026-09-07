// The declarative resolver, proved against the thing it replaces.
//
// While `line`/`effectPerRank` and `effects` both exist, the file says what a
// bonus does twice — on purpose. This is the moment to prove the two agree,
// because it is the only moment both are readable: after the readers swap over
// there is nothing left to compare against.
//
// So the parity block below writes each reader's expression BOTH ways and
// asserts `toBe` — bit equality, not `toBeCloseTo`. A percentage is authored
// in whole points and divided per effect for exactly this reason: `5/100`
// three times is bit-identical to `3 * 0.05`, while `15/100` is a different
// double.

import { describe, expect, it } from 'vitest';
import {
  DELVE, FOG, HARVEST, MANA, TAP, TAXES, TECHNOLOGIES, TECH_LINES, TECH_LINE_ORDER,
} from '../src/sim/data/definitions';
import {
  TECH_STATS, TECH_STAT_IDS, effectLabel, effectProblems, effectKey,
} from '../src/sim/data/techEffectRules';
import {
  techFlat, techFlatAimed, techMultiplier, techTotals, techValue,
} from '../src/sim/techEffects';
import { effect } from '../src/sim/upgrades';
import type { GameState } from '../src/sim/state';
import { completeRanks, freshGame } from './helpers';

/** A kingdom holding every rank of every ladder — the state that makes a
 *  disagreement between the two vocabularies as loud as it can be. */
function maxed(): GameState {
  const state = freshGame();
  for (const line of TECH_LINE_ORDER) completeRanks(state, line, TECH_LINES[line].length);
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
    ];
    for (const effect of bad) {
      expect(effectProblems(effect), effectLabel(effect)).not.toEqual([]);
    }
    // …and accepts the shapes the tree actually uses.
    for (const good of [
      { stat: 'buildTime' as const, op: 'percent' as const, value: -5 },
      { stat: 'harvestUnitsPerStrike' as const, op: 'flat' as const, value: 1, target: { harvest: 'Crops' as const } },
      { stat: 'unitDef' as const, op: 'flat' as const, value: 1, target: { unitTag: 'Melee' as const } },
    ]) {
      expect(effectProblems(good), effectLabel(good)).toEqual([]);
    }
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

// THE PARITY BLOCK. Each case is one reader's expression, written both ways.
// When a reader is swapped over in the next stage, its `after` half here is
// the line that goes in — so a wrong stat or a wrong target fails before any
// call site moves.
describe('the two vocabularies agree, number for number', () => {
  const at = (ranks: number) => {
    const state = freshGame();
    for (const line of TECH_LINE_ORDER) {
      completeRanks(state, line, Math.min(ranks, TECH_LINES[line].length));
    }
    return state;
  };

  for (const ranks of [0, 1, 2, 3, 4, 5]) {
    it(`at ${ranks} rank(s) of every ladder`, () => {
      const s = at(ranks);
      // the thumb and the crew
      expect(techValue(s, 'tapWorkSeconds', TAP.workSeconds))
        .toBe(TAP.workSeconds * (1 + effect(s, 'TapPower')));
      expect(techValue(s, 'autoTapCooldown', TAP.collectCooldownSeconds))
        .toBe(TAP.collectCooldownSeconds - effect(s, 'QuickHands'));
      for (const [source, line] of [
        ['Forest', 'Sawpits'], ['Meat', 'Butchery'], ['Stone', 'Stonecutting'],
        ['Fish', 'BigNets'], ['MountainIron', 'IronPicks'],
      ] as const) {
        const spec = HARVEST[source];
        expect(techValue(s, 'harvestUnitsPerStrike', spec.unitsPerStrike, { harvest: source }))
          .toBe(spec.unitsPerStrike + effect(s, line));
      }
      // Crops is the one cell two ladders reach.
      expect(techValue(s, 'harvestUnitsPerStrike', HARVEST.Crops.unitsPerStrike,
        { harvest: 'Crops' }))
        .toBe(HARVEST.Crops.unitsPerStrike + effect(s, 'Irrigation') + effect(s, 'Scythes'));
      expect(techFlat(s, 'workerStrikeUnits')).toBe(effect(s, 'WorkerLoad'));
      expect(techMultiplier(s, 'workerSpeed')).toBe(1 + effect(s, 'Cartage'));

      // the city
      expect(techValue(s, 'buildTime', 1)).toBe(1 - effect(s, 'Carpentry'));
      expect(techValue(s, 'researchTime', 1)).toBe(1 - effect(s, 'Scriveners'));
      expect(techValue(s, 'salePrice', 1.5)).toBe(1.5 + effect(s, 'MarketStall'));
      expect(techValue(s, 'taxRate', TAXES.goldPerPopulationPerMinute))
        .toBe(TAXES.goldPerPopulationPerMinute * (1 + effect(s, 'TradeRoutes')));

      // magic and the clock
      expect(techValue(s, 'manaCap', MANA.baseCap)).toBe(MANA.baseCap + effect(s, 'DeepWells'));
      expect(techFlat(s, 'manaPerClaimedLandmark')).toBe(effect(s, 'LeyTaps'));
      expect(techFlat(s, 'knowledgePerClaimedLandmark')).toBe(effect(s, 'Wayposts'));
      expect(techFlat(s, 'knowledgePerClearedRuin')).toBe(effect(s, 'Vigils'));
      expect(techMultiplier(s, 'knowledgeYield')).toBe(1 + effect(s, 'Scriptorium'));
      expect(techValue(s, 'activeCost', 10)).toBe(10 * (1 - effect(s, 'Resonance')));

      // the fog
      expect(techValue(s, 'revealCost', 320)).toBe(320 * (1 - effect(s, 'Pitons')));
      expect(techValue(s, 'fogRevealPerTap', FOG.goldPerTap))
        .toBe(FOG.goldPerTap * (1 + effect(s, 'Surveying')));
      expect(techValue(s, 'discoverRadius', 2)).toBe(2 + effect(s, 'Farsight'));
      expect(techValue(s, 'claimCost', 500)).toBe(500 * (1 - effect(s, 'Pilgrimage')));

      // the army
      expect(techValue(s, 'armyCap', 12)).toBe(12 + effect(s, 'Colours'));
      expect(techValue(s, 'recruitCost', 1)).toBe(1 - effect(s, 'MusterDrill'));
      expect(techFlat(s, 'unitAtk')).toBe(effect(s, 'Warhorns'));
      expect(techFlatAimed(s, 'unitAtk', { unitTag: 'Distance' })).toBe(effect(s, 'Fletching'));
      expect(techFlatAimed(s, 'unitDef', { unitTag: 'Melee' })).toBe(effect(s, 'ShieldWall'));
      expect(techFlatAimed(s, 'unitDef', { unitTag: 'Mounted' })).toBe(effect(s, 'Barding'));
      expect(techFlat(s, 'typeDisadvantage')).toBe(effect(s, 'Manoeuvre'));

      // the delve
      expect(techValue(s, 'supplyCost', 1)).toBe(1 - effect(s, 'Rations'));
      expect(techValue(s, 'delveSpeed', 60_000)).toBe(60_000 * (1 - effect(s, 'Pathfinders')));
      expect(techValue(s, 'haulLoss', DELVE.failHaulLoss))
        .toBe(DELVE.failHaulLoss - effect(s, 'Bearers'));
      expect(techValue(s, 'heroXp', 100)).toBe(100 * (1 + effect(s, 'Drillmaster')));
      expect(techMultiplier(s, 'stardustYield')).toBe(1 + effect(s, 'Prospecting'));
    });
  }

  it('gives every ladder in the file an effect that says the same thing', () => {
    for (const line of TECH_LINE_ORDER) {
      for (const id of TECH_LINES[line]) {
        const effects = TECHNOLOGIES[id].effects;
        expect(effects, `${id} carries a line but moves nothing`).toHaveLength(1);
        expect(effectProblems(effects[0]), effectLabel(effects[0])).toEqual([]);
      }
    }
  });
});
