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
});
