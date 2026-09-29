import { describe, expect, it } from 'vitest';
import balance from '../src/sim/data/balance';
import { readFileSync, readdirSync } from 'node:fs';
import {
  COLLECTIONS, IGNORED_KEYS, SCHEMAS, collectionById, formatData, inferSpec, schemaOf, validateData,
  type DataDoc,
} from '../src/sim/data/dataRules';

const DATA = new URL('../src/sim/data/', import.meta.url);
const join = (base: URL, ...parts: string[]): URL => new URL(parts.map((p) => `${p}`).join('/'), base);

const doc = balance as unknown as DataDoc;

describe('data rules', () => {
  it('reaches every top-level key of the data exactly once', () => {
    const owned = COLLECTIONS.flatMap((c) => [...(c.source ? [c.source] : []), ...(c.groups ?? [])]);
    expect(new Set(owned).size).toBe(owned.length);
    const keys = Object.keys(doc).filter((k) => !IGNORED_KEYS.includes(k));
    expect([...keys].sort()).toEqual([...owned].sort());
  });

  it('accepts the data as it ships', () => {
    const errors = validateData(doc).filter((i) => i.level === 'error');
    expect(errors).toEqual([]);
  });

  it('infers maps from records whose keys are data', () => {
    expect(inferSpec([{ Wood: 20 }, {}, { Wood: 60, Stone: 5 }]).type).toBe('map');
    expect(inferSpec([{ a: 1, b: 2.5 }, { a: 3, b: 4 }])).toEqual({
      type: 'object', fields: { a: { type: 'int' }, b: { type: 'float' } },
    });
    expect(inferSpec([1, null]).nullable).toBe(true);
  });

  it('catches a broken reference, a short ladder and a bad target', () => {
    const broken = structuredClone(doc) as Record<string, any>;
    broken.heroes.Warden.unitType = 'Dragon';
    broken.districts.Sawmill.costPerLevel.pop();
    broken.quests[1].goalTarget = 'NoSuchTech';
    broken.districts.Sawmill.maxWorkersPerLevel = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const msgs = validateData(broken, doc).map((i) => `${i.collection}/${i.entry}/${i.path.join('.')}: ${i.message}`);
    expect(msgs).toEqual(expect.arrayContaining([
      'heroes/Warden/unitType: "Dragon" is not a unit',
      'buildings/Sawmill/costPerLevel: has 9 entries, needs 10',
      'quests/1/goalTarget: "NoSuchTech" is not a tech',
      'buildings/Sawmill/maxWorkersPerLevel: has 11 entries, at most 10',
    ]));
  });

  it('schemas a building as a record with per-level ladders', () => {
    const spec = schemaOf(doc, collectionById('buildings')!);
    expect(spec.type).toBe('object');
    expect(spec.fields!.costPerLevel.length).toEqual({ sibling: 'maxLevel' });
    expect(spec.fields!.costPerLevel.of!.fields!.cost.keysRef).toBe('currency');
  });

  it('keeps one data file and one schema file per collection, and nothing else', () => {
    const want = COLLECTIONS.filter((c) => c.view !== 'canvas').map((c) => `${c.id}.json`).sort();
    expect(readdirSync(join(DATA, 'game')).sort()).toEqual(want);
    expect(readdirSync(join(DATA, 'schema')).sort()).toEqual(want);
    expect(Object.keys(SCHEMAS).sort()).toEqual(want.map((f) => f.replace('.json', '')));
  });

  it('keeps every file exactly as a save would write it', () => {
    for (const dir of ['game', 'schema']) {
      for (const f of readdirSync(join(DATA, dir))) {
        const text = readFileSync(join(DATA, dir, f), 'utf8');
        expect(formatData(JSON.parse(text)), `${dir}/${f}`).toBe(text);
      }
    }
  });

  it('holds the rules that tie one field to another', () => {
    const b = structuredClone(doc) as Record<string, any>;
    b.districts.Carpenter.queueLengthPerLevel = [];
    b.districts.Garden.maxLevel = 2;
    b.districts.Sawmill.harmonyCostPerLevel = [0, 0, 0, 0, 0, 0, 0, 4, 2, 6];
    b.districts.Farm.taxBonusPerLevel = [0.1];
    b.districts.Barracks.trains = ['Warrior', 'Lancer'];
    b.goods.Planks.inputGood = 'Planks';
    b.currencies.Gold.goldValue = 3;
    b.units.Archer.frontage = b.units.Archer.squadSize + 1;
    b.heroes[Object.keys(b.heroes).find((k) => b.heroes[k].boon)!].boon.value = 0.9;
    b.depths[1].powerStart = 1;
    b.adjacency.push({ ...b.adjacency[0] });
    b.adjacency[3].magnitude = -0.5;
    b.store.GemsPouch.priceUsd = 0;
    b.banners.basic.softPityAt = b.banners.basic.hardPityAt;
    b.packs.Green.guarantees = { '1star': 99 };
    b.fog.rings[2].distance = 1;
    b.harmony.surplusTiers[1].at = 1;
    const msgs = validateData(b, doc).filter((i) => i.level === 'error').map((i) => `${i.collection}/${i.entry}/${i.path.join('.')}: ${i.message}`);
    const want = [
      'buildings/Carpenter/produces: a workshop needs both produces and queueLengthPerLevel',
      'buildings/Garden/maxLevel: a decoration has no ladder — maxLevel must be 1',
      'buildings/Sawmill/harmonyCostPerLevel.8: falls at level 9 (4 then 2) — it is a total, not an increment',
      'buildings/Farm/taxBonusPerLevel: on a building that houses nobody',
      'buildings/Barracks/trains: trains 2 things — a building trains one',
      'buildings/SpearHall/trains: Lancer is already trained at Barracks — each unit has one building',
      'goods/Planks/inputGood: a good cannot be made of itself',
      'currencies/Gold/goldValue: must be positive, and not on Gold itself',
      'units/Archer/frontage: cannot exceed squadSize',
      'depths/1/powerStart: starts at 1, below where depth 1 finished (95)',
      'adjacency/7/: duplicate rule Housing/Housing/goldPerMinute',
      'adjacency/3/magnitude: is past the ±0.25 clamp',
      'store/GemsPouch/priceUsd: a product needs a positive price',
      'banners/basic/softPityAt: soft pity (60) must come before hard pity (60)',
      'packs/Green/guarantees: guarantees 99 cards but the pack holds 2',
      'exploration/null/fog.rings.2.distance: distances must be ascending',
      'economy/null/harmony.surplusTiers.1.at: tiers must be ascending',
    ];
    for (const w of want) expect(msgs, w).toContain(w);
    expect(msgs.some((m) => m.startsWith('heroes/') && m.includes('boon.value'))).toBe(true);
  });
});
