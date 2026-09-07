// The tech tree's SHAPE left the workbook, so the importer no longer guards
// it — this does. Every rule the editor blocks a save on is asserted here
// against the shipped tree, which means a hand-edit to tech-tree.json fails
// in CI the same way it would have failed in `?dev=tree`.
//
// The layout invariants that used to live in research.test.ts are here now,
// as cases against a deliberately broken copy: the rules are one module and
// this is what pins them.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import treeDoc from '../src/sim/data/tech-tree.json';
import {
  isDrawnEdge, unlockKey, validateTechTree, type TechTreeDoc,
} from '../src/sim/data/techTreeRules';
import {
  DISTRICTS, HARVEST, TECHNOLOGIES, TECH_LINE_ORDER, TECH_ORDER, UNITS, terrainGate,
} from '../src/sim/data/definitions';
import { COLS, pageRows } from '../src/ui/research/layout';

const doc = treeDoc as unknown as TechTreeDoc;
const clone = (): TechTreeDoc => structuredClone(doc);

describe('the shipped tech tree', () => {
  it('has no errors', () => {
    expect(validateTechTree(doc).errors.map((e) => e.message)).toEqual([]);
  });

  it('has no warnings', () => {
    expect(validateTechTree(doc).warnings.map((w) => w.message)).toEqual([]);
  });

  it('gives every technology a slot — ranks included, the fan is gone', () => {
    for (const id of TECH_ORDER) {
      const entry = doc.technologies[id];
      expect(entry, `${id} is missing from tech-tree.json`).toBeDefined();
      expect(Number.isInteger(entry.row), `${id} has no row`).toBe(true);
      expect(entry.col).toBeGreaterThanOrEqual(0);
      expect(entry.col).toBeLessThan(COLS);
    }
  });

  it('is what definitions.ts serves: the file IS the technology', () => {
    for (const id of TECH_ORDER) {
      const entry = doc.technologies[id];
      const def = TECHNOLOGIES[id];
      expect(def.name).toBe(entry.name);
      expect(def.glyph).toBe(entry.glyph);
      expect(def.description).toBe(entry.description);
      expect(def.kind).toBe(entry.kind);
      expect(def.requires).toEqual(entry.requires);
      expect(def.tome).toBe(entry.tome);
      expect(def.era).toBe(entry.era);
      expect({ row: def.row, col: def.col }).toEqual({ row: entry.row, col: entry.col });
      expect(def.cost.Gold).toBe(entry.gold);
      expect(def.cost.Knowledge ?? 0).toBe(entry.knowledge ?? 0);
      expect(def.durationSeconds).toBe(entry.seconds);
      expect(def.line).toBe(entry.line ?? null);
      expect(def.effectPerRank).toBe(entry.effectPerRank ?? 0);
      expect(def.planned).toBe(entry.planned === true);
    }
  });

  // THE GATES POINT ONE WAY NOW. A district used to name its own
  // `required_tech`; the technology names what it opens and every gate in the
  // game is derived from that (definitions.ts `GATES`). This is that
  // derivation, checked in both directions.
  it('hands every gate to whatever the technology says it unlocks', () => {
    const claimed = new Set<string>();
    for (const id of TECH_ORDER) {
      for (const unlock of TECHNOLOGIES[id].unlocks) {
        claimed.add(unlockKey(unlock));
        if ('district' in unlock) {
          expect(DISTRICTS[unlock.district as 'Farm'].requiredTech).toBe(id);
        } else if ('districtLevel' in unlock) {
          const { id: district, level } = unlock.districtLevel;
          expect(DISTRICTS[district as 'Housing'].requiredTechPerLevel[level - 2]).toBe(id);
        } else if ('districtCount' in unlock) {
          expect(DISTRICTS[unlock.districtCount as 'Market'].extraCountTech).toBe(id);
        } else if ('unit' in unlock) {
          expect(UNITS[unlock.unit as 'Archer'].requiredTech).toBe(id);
        } else if ('harvest' in unlock) {
          expect(HARVEST[unlock.harvest as 'Forest'].requiredTech).toBe(id);
        } else if ('terrain' in unlock) {
          expect(terrainGate(unlock.terrain)).toBe(id);
        }
      }
    }
    // …and nothing is gated by a technology that never claimed it.
    for (const def of Object.values(DISTRICTS)) {
      if (def.requiredTech !== null) expect(claimed).toContain(`district:${def.id}`);
      if (def.extraCountTech !== null) expect(claimed).toContain(`districtCount:${def.id}`);
      def.requiredTechPerLevel.forEach((gate, i) => {
        if (gate !== null) expect(claimed).toContain(`districtLevel:${def.id}:${i + 2}`);
      });
    }
    for (const unit of Object.values(UNITS)) {
      if (unit.requiredTech !== null) expect(claimed).toContain(`unit:${unit.id}`);
    }
    for (const spec of Object.values(HARVEST)) {
      if (spec.requiredTech !== null) expect(claimed).toContain(`harvest:${spec.id}`);
    }
  });

  // A BONUS IS ONLY WORTH SOMETHING IF CODE READS ITS LINE. The line lives in
  // the file now, so a typo would leave a rank the player pays for and
  // nothing collects — silently, since `effect()` would be asked for a line
  // no call site mentions. The hooks are `effect(state, 'X')` call sites, so
  // this reads them.
  it('puts every bonus on a line the sim actually reads', () => {
    const dir = new URL('../src/sim/', import.meta.url);
    const sources = readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => readFileSync(new URL(f, dir), 'utf8'))
      .join('\n');
    // Two shapes reach `effect()`: a literal call site, and a table of line
    // ids (`ABUNDANCE_LINES`, `TAP_YIELD_UPGRADES`) the helper walks.
    const wired = new Set([...sources.matchAll(/effect\(state, '([A-Za-z]+)'\)/g)]
      .map((m) => m[1]));
    for (const m of sources.matchAll(/'([A-Za-z]+)'(?=\s*(?:,|\]))/g)) {
      if (TECH_LINE_ORDER.includes(m[1] as 'TapPower')) wired.add(m[1]);
    }
    for (const line of TECH_LINE_ORDER) {
      expect(wired, `nothing in src/sim reads the ${line} line`).toContain(line);
    }
  });

  // The pacing promise of the shape: a band is a run of rows, and the era bar
  // between two of them is a line of its own.
  it('lays every tome out as bands of rows, in era order', () => {
    for (const tome of ['Civics', 'Warfare', 'Magic']) {
      const rows = pageRows(TECHNOLOGIES, tome);
      let era = 0;
      let seenRow = -1;
      for (const row of rows) {
        if (row.kind === 'gate') {
          expect(row.era).toBe(era + 1);
          era = row.era;
          continue;
        }
        expect(row.era).toBe(era === 0 ? 1 : era);
        if (era === 0) era = 1;
        expect(row.row).toBeGreaterThan(seenRow);
        seenRow = row.row;
        expect(row.slots.filter((s) => s !== null).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('what the rules refuse', () => {
  const messages = (d: TechTreeDoc) => validateTechTree(d).errors.map((e) => e.message);

  it('two nodes in one slot of one page', () => {
    const d = clone();
    d.technologies.Saws = { ...d.technologies.Saws, ...d.technologies.Masonry };
    expect(messages(d).some((m) => m.includes('share the slot'))).toBe(true);
    expect(validateTechTree(d).ok).toBe(false);
  });

  it('the same slot on ANOTHER page, which is not a collision', () => {
    const d = clone();
    // Every tome's cover page is at (row 0, column 1) on its own page
    // already, which is the case that would break a global coordinate space.
    expect(messages(d)).toEqual([]);
  });

  it('a requirement that is not a technology, and one that points at itself', () => {
    const d = clone();
    d.technologies.Forestry.requires = ['Nonsense'];
    expect(messages(d).some((m) => m.includes('not a technology'))).toBe(true);

    const self = clone();
    self.technologies.Forestry.requires = ['Forestry'];
    expect(messages(self).some((m) => m.includes('requires itself'))).toBe(true);
  });

  it('a requirement that leaves the tome, because the page cannot draw it', () => {
    const d = clone();
    d.technologies.Forestry.requires = ['WarbandI'];
    expect(messages(d).some((m) => m.includes('another tome'))).toBe(true);
  });

  // One rule, and it is what makes a row number mean depth — and a loop
  // impossible, which is why there is no cycle finder any more.
  it('a requirement lower down the page than the card that needs it', () => {
    const d = clone();
    d.technologies.CharterI.requires = ['Forestry'];
    expect(messages(d).some((m) => m.includes('always sits higher up the page'))).toBe(true);
  });

  it('a fourth requirement', () => {
    const d = clone();
    d.technologies.Masonry.requires = ['CharterI', 'Forestry', 'Agriculture', 'Market'];
    expect(messages(d).some((m) => m.includes('requirements'))).toBe(true);
  });

  it('a card with no requirement at all, and a cover page with one', () => {
    const d = clone();
    d.technologies.Masonry.requires = [];
    expect(messages(d).some((m) => m.includes('available from the first minute'))).toBe(true);

    const cover = clone();
    cover.technologies.CharterI.requires = ['Forestry'];
    expect(messages(cover).some((m) => m.includes('may require nothing'))).toBe(true);
  });

  it('a rank that does not require the rank before it', () => {
    const d = clone();
    d.technologies.SawpitsII.requires = ['Saws'];
    expect(messages(d).some((m) => m.includes('does not require SawpitsI'))).toBe(true);
  });

  it('an era that climbs back above the one before it', () => {
    const d = clone();
    d.technologies.CharterII = { ...d.technologies.CharterII, era: 2, row: 0, col: 0 };
    expect(messages(d).some((m) => m.includes('at or above era 1'))).toBe(true);
  });

  it('one row shared by two eras, because the bar takes a whole line', () => {
    const d = clone();
    // Forestry shares row 1 with Agriculture; putting it in the next band
    // asks the page to draw an era bar through the middle of a row.
    d.technologies.Forestry = { ...d.technologies.Forestry, era: 2 };
    expect(messages(d).some((m) => m.includes('an era bar takes a whole line'))).toBe(true);
  });

  // The rule the importer used to own, moved with the era: `balance.mjs` can
  // no longer see which band a technology is in.
  it('Knowledge charged in era 1, where the clock has not started', () => {
    const d = clone();
    // Row 0 holds only the cover page, so this lands in era 1 without
    // colliding with anything — which is the case worth testing.
    d.technologies.SawpitsII = { ...d.technologies.SawpitsII, era: 1, row: 0, col: 0 };
    expect(messages(d).some((m) => m.includes('the clock has not started'))).toBe(true);
  });

  it('a technology with nothing to say about itself', () => {
    const d = clone();
    d.technologies.Saws.name = '';
    expect(messages(d).some((m) => m.includes('has no name'))).toBe(true);
    const glyph = clone();
    glyph.technologies.Saws.glyph = '';
    expect(messages(glyph).some((m) => m.includes('has no glyph'))).toBe(true);
  });

  it('a free technology that is not a cover page', () => {
    const d = clone();
    d.technologies.Saws.gold = 0;
    d.technologies.Saws.seconds = 0;
    expect(messages(d).some((m) => m.includes('only a cover page may'))).toBe(true);
  });

  it('an unlock that names something the game does not have', () => {
    const d = clone();
    d.technologies.Saws.unlocks = [{ district: 'Foundry' }];
    expect(messages(d).some((m) => m.includes('not a district'))).toBe(true);

    const level = clone();
    level.technologies.Saws.unlocks = [{ districtLevel: { id: 'Housing', level: 99 } }];
    expect(messages(level).some((m) => m.includes('only reaches'))).toBe(true);
  });

  // Two technologies opening one door would leave the game asking which, and
  // the answer would be whichever the derivation read last.
  it('two technologies claiming one gate', () => {
    const d = clone();
    d.technologies.Masonry.unlocks = [...(d.technologies.Masonry.unlocks ?? []),
      { district: 'Sawmill' }];
    expect(messages(d).some((m) => m.includes('both unlock'))).toBe(true);
  });

  it('a kind that does not match what the technology carries', () => {
    const unlocksNothing = clone();
    unlocksNothing.technologies.Saws.unlocks = [];
    expect(messages(unlocksNothing).some((m) => m.includes('unlocks nothing'))).toBe(true);

    const bonus = clone();
    bonus.technologies.SawpitsI.line = null;
    expect(messages(bonus).some((m) => m.includes('bonus with no line'))).toBe(true);

    const mechanic = clone();
    mechanic.technologies.CharterI.unlocks = [{ unit: 'Warrior' }];
    expect(messages(mechanic).some((m) => m.includes('is a mechanic and also unlocks'))).toBe(true);
  });

  it('a rank worth a different amount from the rest of its line', () => {
    const d = clone();
    d.technologies.SawpitsII.effectPerRank = 99;
    expect(messages(d).some((m) => m.includes('all the same size'))).toBe(true);
  });

  it('a column the page does not have', () => {
    const d = clone();
    d.technologies.Forestry.col = COLS;
    expect(messages(d).some((m) => m.includes('a page has 3'))).toBe(true);
  });
});

describe('which edges the page draws', () => {
  it('draws an edge inside a band', () => {
    expect(isDrawnEdge(doc, 'CharterI', 'Forestry')).toBe(true);
  });

  // 119 ranks each reaching back over an era bar would put a line across
  // every gate in the book and hide the edges that say something. The band a
  // card sits in says it instead.
  it('leaves a requirement that reaches over an era bar implied', () => {
    expect(TECHNOLOGIES.SawpitsII.requires).toContain('SawpitsI');
    expect(TECHNOLOGIES.SawpitsII.era).toBe(2);
    expect(TECHNOLOGIES.SawpitsI.era).toBe(1);
    expect(isDrawnEdge(doc, 'SawpitsI', 'SawpitsII')).toBe(false);
  });
});
