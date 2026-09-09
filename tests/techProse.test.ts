// WHAT A CARD SAYS, now that nobody types it.
//
// A technology's line is generated from its own `unlocks` or `effects`
// (`src/sim/techProse.ts`), so the thing that used to be checked by reading it
// is checked here instead. Three kinds of assertion, and they answer different
// failures:
//
//   1. the REGISTRY has words for every number it lets a technology move — a
//      stat without a sentence is a card the player cannot read;
//   2. the SENTENCES are goldens over synthetic nodes, so the wording is
//      pinned whatever the shipped tree happens to hold this week;
//   3. the SHIPPED tree still says something on every card, and carries no
//      prose it no longer needs.
import { describe, expect, it } from 'vitest';
import treeDoc from '../src/sim/data/tech-tree.json';
import {
  TECH_STATS, TECH_STAT_IDS, type StatDef, type TargetKind, type TechEffectOp,
} from '../src/sim/data/techEffectRules';
import { saysItself, type TechNodeDoc, type TechTreeDoc } from '../src/sim/data/techTreeRules';
import { TECHNOLOGIES, TECH_ORDER } from '../src/sim/data/definitions';
import {
  describeTech, effectSentence, techLine, techSentences, unlockPhrase,
} from '../src/sim/techProse';

const doc = treeDoc as unknown as TechTreeDoc;

describe('the registry has words for every number', () => {
  it('says something for every op it accepts, and for no op it does not', () => {
    for (const id of TECH_STAT_IDS) {
      const def = TECH_STATS[id] as StatDef;
      const said = Object.keys(def.says) as TechEffectOp[];
      // `ops` and `says` are two lists of the same fact, so they agree or the
      // editor offers an op that renders to nothing.
      expect([...said].sort(), `${id}: ops and says disagree`)
        .toEqual([...def.ops].sort());
      for (const op of said) {
        expect(def.says[op]!.trim(), `${id}.${op} is empty`).not.toBe('');
      }
    }
  });

  // The bracket convention rests on a stat knowing which KIND of target its
  // sentence is written around. Two non-global kinds on one stat would need
  // two sentences for one op, and there is nowhere to put the second.
  it('never lets one stat accept two kinds of target', () => {
    for (const id of TECH_STAT_IDS) {
      const aimed = (TECH_STATS[id] as StatDef).targets.filter((t: TargetKind) => t !== 'global');
      expect(aimed.length, `${id} accepts ${aimed.join(' and ')}`).toBeLessThan(2);
    }
  });

  it('only reaches for a placeholder the stat can fill', () => {
    for (const id of TECH_STAT_IDS) {
      const def = TECH_STATS[id] as StatDef;
      const aimed = def.targets.includes('harvest');
      for (const [op, phrase] of Object.entries(def.says) as Array<[TechEffectOp, string]>) {
        const where = `${id}.${op}`;
        // `{resource}` is the currency a HARVEST cell pays. Nothing else has one.
        if (phrase.includes('{resource}')) {
          expect(aimed, `${where} names a resource but cannot aim at a harvest source`)
            .toBe(true);
        }
        // A target only exists when the effect is aimed, so a mention of one
        // outside brackets would render as a hole on every unaimed effect.
        if (phrase.includes('{target}') && def.targets.includes('global')) {
          const bracketed = [...phrase.matchAll(/\[[^\]]*\]/g)].map((m) => m[0]).join('');
          expect(bracketed.includes('{target}'), `${where} names a target outside brackets`)
            .toBe(true);
        }
        // `{pct}` reads a FRACTION as a percentage, which is only ever how a
        // `×` stat is authored.
        if (phrase.includes('{pct}')) {
          expect(`${op}:${def.unit}`, `${where} uses {pct}`).toBe('flat:×');
        }
      }
    }
  });
});

describe('one unlock, one noun phrase', () => {
  it('names the thing the way the game names it', () => {
    expect(unlockPhrase({ district: 'Sawmill' })).toBe('the Sawmill');
    expect(unlockPhrase({ district: 'ShootingGrounds' })).toBe('the Shooting Grounds');
    expect(unlockPhrase({ districtLevel: { id: 'Housing', level: 3 } }))
      .toBe('Housing level 3');
    // "one more", never "a second": the gate says one more may stand, which
    // stays true however many the Townhall already allows.
    expect(unlockPhrase({ districtCount: 'Market' })).toBe('one more Market');
    expect(unlockPhrase({ unit: 'Archer' })).toBe('the Archer');
    expect(unlockPhrase({ harvest: 'MountainIron' })).toBe('the iron mountains');
    expect(unlockPhrase({ terrain: 'Water' })).toBe('the open water');
  });
});

describe('one technology, one line', () => {
  const said = (node: Partial<TechNodeDoc>): string =>
    describeTech({ kind: 'bonus', ...node } as TechNodeDoc);

  it('joins what it opens into one sentence', () => {
    expect(said({ kind: 'unlock', unlocks: [{ district: 'Sawmill' }] }))
      .toBe('Unlocks the Sawmill');
    expect(said({
      kind: 'unlock',
      unlocks: [{ district: 'SpearHall' }, { unit: 'Lancer' }],
    })).toBe('Unlocks the Spear Hall and the Lancer');
  });

  // Four halls reaching level 4 is ONE fact, and four clauses of it overflow
  // the card. The collapse is what keeps `Warband II` readable.
  it('folds building levels that share a number', () => {
    expect(said({
      kind: 'unlock',
      unlocks: [
        { districtLevel: { id: 'Barracks', level: 4 } },
        { districtLevel: { id: 'SpearHall', level: 4 } },
        { districtLevel: { id: 'ShootingGrounds', level: 4 } },
        { districtLevel: { id: 'Stables', level: 4 } },
      ],
    })).toBe('Unlocks Barracks, Spear Hall, Shooting Grounds and Stables at level 4');
    // …and leaves two different levels as two clauses, because they are two.
    expect(said({
      kind: 'unlock',
      unlocks: [
        { districtLevel: { id: 'Sawmill', level: 4 } },
        { districtLevel: { id: 'Quarry', level: 3 } },
      ],
    })).toBe('Unlocks Sawmill level 4 and Quarry level 3');
  });

  it('reads an effect in the stat’s own words', () => {
    expect(effectSentence({ stat: 'taxRate', op: 'percent', value: 10 }))
      .toBe('+10% tax income');
    expect(effectSentence({
      stat: 'taxRate', op: 'percent', value: 5, target: { district: 'Housing' },
    })).toBe('+5% tax income from Housing');
    expect(effectSentence({
      stat: 'harvestUnitsPerStrike', op: 'flat', value: 1, target: { harvest: 'Forest' },
    })).toBe('+1 Wood per tap and delivery from a forest');
    // Unaimed: the bracketed halves go, and the sentence still reads.
    expect(effectSentence({ stat: 'harvestUnitsPerStrike', op: 'flat', value: 1 }))
      .toBe('+1 per tap and delivery');
    expect(effectSentence({
      stat: 'unitAtk', op: 'flat', value: 1, target: { unitTag: 'Distance' },
    })).toBe('+1 ATK to every Distance unit');
    expect(effectSentence({ stat: 'researchTime', op: 'percent', value: -5 }))
      .toBe('−5% time to finish a research');
    expect(effectSentence({ stat: 'autoTapCooldown', op: 'flat', value: -0.05 }))
      .toBe('−0.05s between auto-taps');
  });

  // A value authored as a fraction is read to the player as a percentage,
  // because "+0.05 ×" is not a thing anyone can price a research against.
  it('reads a fraction as a percentage where the number is one', () => {
    expect(effectSentence({ stat: 'haulLoss', op: 'flat', value: -0.03 }))
      .toBe('−3% of the haul lost on a bad depth');
  });

  // The one kind that still writes its own line: its effect is code, so there
  // is nothing in its data to read.
  it('gives a mechanic back its written line', () => {
    expect(said({ kind: 'mechanic', description: 'Paved ways — every worker walks faster.' }))
      .toBe('Paved ways — every worker walks faster.');
  });

  // DATA FIRST. A description left behind by a hand-edit is dead, not a
  // second opinion that wins.
  it('ignores prose a technology should not be carrying', () => {
    expect(said({
      kind: 'unlock',
      unlocks: [{ district: 'Sawmill' }],
      description: 'something a designer forgot to delete',
    })).toBe('Unlocks the Sawmill');
  });

  it('breaks into one sentence per effect for a panel with room', () => {
    expect(techSentences({
      kind: 'bonus',
      effects: [
        { stat: 'taxRate', op: 'percent', value: 10 },
        { stat: 'researchTime', op: 'percent', value: -5 },
      ],
    })).toEqual(['+10% tax income', '−5% time to finish a research']);
  });
});

describe('the shipped tree', () => {
  it('says something on every card', () => {
    for (const id of TECH_ORDER) {
      expect(techLine(id).trim(), `${id} says nothing`).not.toBe('');
    }
  });

  // A card is 120 × 96 px and clamps at three lines. This is a rail, not a
  // layout: a sentence past it is one to shorten, not a broken build.
  it('keeps a generated line short enough to read on a card', () => {
    const long = TECH_ORDER
      .filter((id) => saysItself(TECHNOLOGIES[id] as unknown as TechNodeDoc))
      .filter((id) => techLine(id).length > 80)
      .map((id) => `${id}: ${techLine(id)}`);
    expect(long).toEqual([]);
  });

  it('carries prose only where nothing else speaks', () => {
    for (const [id, node] of Object.entries(doc.technologies ?? {})) {
      if (saysItself(node)) {
        expect(node.description, `${id} still carries a description`).toBeUndefined();
      } else {
        expect((node.description ?? '').trim(), `${id} has nothing to say`).not.toBe('');
      }
    }
  });

  // The editor and the game read one generator over two shapes. If they ever
  // stopped agreeing, a designer would be arranging a card the player never
  // sees.
  it('says the same thing to the editor and to the game', () => {
    for (const id of TECH_ORDER) {
      const authored = doc.technologies[id];
      expect(describeTech(authored), `${id} reads differently in ?dev=tree`)
        .toBe(describeTech(TECHNOLOGIES[id]));
    }
  });
});
