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
import { TECH_STAT_IDS } from '../src/sim/data/techEffectRules';
import {
  DISTRICTS, HARVEST, TECHNOLOGIES, TECH_ORDER, UNITS, terrainGate,
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

  it('has every technology ON a page — nothing set aside and forgotten', () => {
    for (const id of TECH_ORDER) {
      const entry = doc.technologies[id];
      expect(entry.tome, `${id} is off the page`).toBeDefined();
      expect(entry.era).toBeDefined();
    }
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
      expect(def.description).toBe(entry.description ?? '');
      expect(def.kind).toBe(entry.kind);
      expect(def.requires).toEqual(entry.requires);
      expect(def.tome).toBe(entry.tome);
      expect(def.era).toBe(entry.era);
      expect({ row: def.row, col: def.col }).toEqual({ row: entry.row, col: entry.col });
      expect(def.cost.Gold).toBe(entry.gold);
      expect(def.cost.Knowledge ?? 0).toBe(entry.knowledge ?? 0);
      expect(def.durationSeconds).toBe(entry.seconds);
      expect(def.effects).toEqual(entry.effects ?? []);
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

  // A BONUS IS ONLY WORTH SOMETHING IF CODE READS ITS STAT. The stat lives in
  // the file now, so a typo would leave a rank the player pays for and nothing
  // collects — silently, since the resolver would be asked for a stat no call
  // site mentions. The readers are `techValue`/`techFlat`/`techFlatAimed`/
  // `techMultiplier` call sites, so this reads them.
  //
  // It replaces the same guard over the 37 lines, and it is STRONGER: the old
  // one had to allow a bare quoted id in a list position, because
  // `ABUNDANCE_LINES` routed seven lines through a table. Targets retired the
  // table, so every stat is now named at the call site that owns it.
  it('puts every stat the registry declares somewhere the sim reads it', () => {
    const dir = new URL('../src/sim/', import.meta.url);
    const sources = readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => readFileSync(new URL(f, dir), 'utf8'))
      .join('\n');
    const read = new Set([
      ...sources.matchAll(/tech(?:Value|Flat|FlatAimed|Multiplier|Totals)\(\s*state,\s*'([A-Za-z]+)'/g),
    ].map((m) => m[1]));
    for (const stat of TECH_STAT_IDS) {
      expect(read, `nothing in src/sim reads the ${stat} stat`).toContain(stat);
    }
    // …and every stat a technology names is one the registry declares, which
    // `validateTechTree` also refuses — belt and braces, because this one
    // fails with the stat's name in it.
    for (const id of TECH_ORDER) {
      for (const effect of TECHNOLOGIES[id].effects) {
        expect(TECH_STAT_IDS, `${id} moves "${effect.stat}"`).toContain(effect.stat);
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
    // Every book's first row uses the same coordinates on its own page, which
    // is the case that would break a global coordinate space.
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
    d.technologies.Forestry.requires = ['WarbandII'];
    expect(messages(d).some((m) => m.includes('another tome'))).toBe(true);
  });

  // One rule, and it is what makes a row number mean depth — and a loop
  // impossible, which is why there is no cycle finder any more.
  it('a requirement lower down the page than the card that needs it', () => {
    const d = clone();
    d.technologies.Forestry.requires = ['Saws']; // Saws is a row BELOW Forestry
    expect(messages(d).some((m) => m.includes('always sits higher up the page'))).toBe(true);
  });

  it('a fourth requirement', () => {
    const d = clone();
    d.technologies.Masonry.requires = ['Forestry', 'Agriculture', 'Market', 'Saws'];
    expect(messages(d).some((m) => m.includes('requirements'))).toBe(true);
  });

  it('a card mid-page with no requirement at all', () => {
    const d = clone();
    d.technologies.Masonry.requires = [];
    expect(messages(d).some((m) => m.includes('available from the first minute'))).toBe(true);
  });

  // …but the FIRST ROW of a book is where a root belongs: there is nothing
  // above it to require. It is POSITIONAL, not a name — the cover pages that
  // used to hold row 0 are gone, and Civics now opens on three ordinary
  // technologies that require nothing.
  it('accepts a root on the page’s first row, whatever it is called', () => {
    expect(messages(clone())).toEqual([]);
    expect(TECHNOLOGIES.Forestry.requires).toEqual([]);

    // And one row down it is an error, because now there IS something above.
    const below = clone();
    below.technologies.Saws.requires = [];
    expect(messages(below).some((m) => m.includes('available from the first minute'))).toBe(true);
  });

  it('a rank that does not require the rank before it', () => {
    const d = clone();
    d.technologies.SawpitsII.requires = ['Saws'];
    expect(messages(d).some((m) => m.includes('does not require SawpitsI'))).toBe(true);
  });

  it('an era that climbs back above the one before it', () => {
    const d = clone();
    d.technologies.Bureaucracy = { ...d.technologies.Bureaucracy, era: 2, row: 0, col: 0 };
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
    // Row 0 is empty now that the cover pages are gone, so this lands in era
    // 1 without colliding with anything — the case worth testing.
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

  // PROSE, in both directions. What a card says is generated from what the
  // technology does (`src/sim/techProse.ts`), so a line typed beside the data
  // is a second answer that nothing keeps in step — 150 cards once shared 68
  // sentences that way, and five of them contradicted their own numbers.
  describe('prose, which only a mechanic writes', () => {
    it('refuses a description on a technology whose data already says it', () => {
      const d = clone();
      d.technologies.Saws.description = 'Two men and a pit.';
      expect(messages(d).some((m) => m.includes('Saws carries a description'))).toBe(true);
      const bonus = clone();
      const rank = Object.keys(bonus.technologies)
        .find((id) => bonus.technologies[id].kind === 'bonus')!;
      bonus.technologies[rank].description = '+1 of something';
      expect(messages(bonus).some((m) => m.includes('already say what it does'))).toBe(true);
    });

    it('asks a mechanic for one, because its effect is code', () => {
      const d = clone();
      const mech = Object.keys(d.technologies)
        .find((id) => d.technologies[id].kind === 'mechanic')!;
      delete d.technologies[mech].description;
      expect(messages(d).some((m) => m.includes('says nothing about itself'))).toBe(true);
    });

    it('is happy with a technology that carries none at all', () => {
      const d = clone();
      delete d.technologies.Saws.description;
      expect(messages(d).filter((m) => m.startsWith('Saws '))).toEqual([]);
    });

    // ONE mistake, one message. A bonus that moves nothing is already an
    // error of its own; asking it for prose as well would say the same thing
    // twice about one card.
    it('reports a bonus that moves nothing once, not twice', () => {
      const d = clone();
      const rank = Object.keys(d.technologies)
        .find((id) => d.technologies[id].kind === 'bonus')!;
      delete d.technologies[rank].effects;
      delete d.technologies[rank].description;
      expect(messages(d).filter((m) => m.startsWith(`${rank} `)))
        .toEqual([`${rank} is a bonus that moves no number`]);
    });
  });

  // NOTHING is free. The granted cover pages were the one exemption and they
  // are gone: every book is open, so there is nothing left to grant.
  it('a technology that costs nothing and takes no time', () => {
    const d = clone();
    d.technologies.Saws.gold = 0;
    d.technologies.Saws.seconds = 0;
    expect(messages(d).some((m) => m.includes('costs nothing and takes no time'))).toBe(true);
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
    bonus.technologies.SawpitsI.effects = [];
    expect(messages(bonus).some((m) => m.includes('moves no number'))).toBe(true);

    const mechanic = clone();
    mechanic.technologies.Roadworks.unlocks = [{ unit: 'Warrior' }];
    expect(messages(mechanic).some((m) => m.includes('is a mechanic and also unlocks'))).toBe(true);
  });

  // A ladder is a naming convention now, so the two things that used to be
  // guaranteed by the `line` field are rules instead: a rank requires the one
  // above it, and the numerals run without a gap.
  it('a rank that does not hang off the rank before it', () => {
    const d = clone();
    d.technologies.SawpitsII.requires = ['Saws'];
    expect(messages(d).some((m) => m.includes('does not require SawpitsI'))).toBe(true);
  });

  it('a ladder with a hole in its numerals', () => {
    const d = clone();
    delete (d.technologies as Record<string, unknown>).SawpitsII;
    d.technologies.SawpitsIII.requires = ['SawpitsI'];
    expect(messages(d).some((m) => m.includes('no rank 2'))).toBe(true);
  });

  // OFF THE PAGE is a real state of the document — `?dev=tree` takes a
  // technology out of its slot without deleting it — and it is the THIRD
  // answer the rules give: not an error, because it is unfinished work rather
  // than a mistake, and clearing a band makes twenty of them at once. It does
  // not fail the verdict either: a book half rearranged saves, and the game
  // leaves an unplaced card out (`definitions.ts`).
  it('a technology with no slot — as pending, not as an error', () => {
    const d = clone();
    const masonry = d.technologies.Masonry;
    delete masonry.tome;
    delete masonry.era;
    delete masonry.row;
    delete masonry.col;
    masonry.requires = [];
    const said = validateTechTree(d);
    expect(said.offPage).toEqual(['Masonry']);
    // NOTHING in the error list about it, and not four things either: no tome,
    // no era, no row, no column is one fact, and the three that cascade would
    // bury whatever is genuinely wrong.
    expect(said.errors.map((e) => e.message).filter((m) => m.startsWith('Masonry '))).toEqual([]);
    // …and whatever was waiting on it DOES say so in its own words, because a
    // placed card waiting on nowhere is a real problem with the page.
    expect(messages(d).some((m) => m.includes('requires Masonry, which is off the page')))
      .toBe(true);
  });

  // The holding pen SHIPS. A book half rearranged has to survive being
  // written down, so pending work does not fail the verdict — the editor
  // saves it and the game leaves the card out (`definitions.ts`). What the
  // editor does when it takes a card off the page is exactly this: the slot
  // goes, and so does every requirement at either end of it.
  it('a tree with a card in the holding pen still saves', () => {
    const d = clone();
    // A leaf, so taking it off the page leaves nothing waiting on nowhere —
    // which is what `unplace` arranges for in the editor.
    const leaf = d.technologies.Communities;
    delete leaf.tome;
    delete leaf.era;
    delete leaf.row;
    delete leaf.col;
    leaf.requires = [];
    const said = validateTechTree(d);
    expect(said.offPage).toEqual(['Communities']);
    expect(said.errors.map((e) => e.message)).toEqual([]);
    expect(said.ok, 'pending work does not block the save').toBe(true);
  });

  it('a column the page does not have', () => {
    const d = clone();
    d.technologies.Forestry.col = COLS;
    expect(messages(d).some((m) => m.includes('a page has 3'))).toBe(true);
  });
});

describe('which edges the page draws', () => {
  it('draws an edge inside a band', () => {
    expect(isDrawnEdge(doc, 'Forestry', 'Saws')).toBe(true);
  });

  // ACROSS the bar too: that edge is how two bands connect, and a band whose
  // cards appear to grow from nothing reads as a page starting over rather
  // than one continuing. The line passes under the bar.
  it('draws a requirement that reaches back over an era bar', () => {
    expect(TECHNOLOGIES.SawpitsII.requires).toContain('SawpitsI');
    expect(TECHNOLOGIES.SawpitsII.era).toBe(2);
    expect(TECHNOLOGIES.SawpitsI.era).toBe(1);
    expect(isDrawnEdge(doc, 'SawpitsI', 'SawpitsII')).toBe(true);
  });

  // What is NOT drawn is an edge with an end that is nowhere.
  it('draws nothing to a card that is off the page', () => {
    const d = clone();
    delete d.technologies.SawpitsI.tome;
    delete d.technologies.SawpitsI.era;
    delete d.technologies.SawpitsI.row;
    delete d.technologies.SawpitsI.col;
    expect(isDrawnEdge(d, 'SawpitsI', 'SawpitsII')).toBe(false);
  });
});
