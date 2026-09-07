// The tech tree's SHAPE left the workbook, so the importer no longer guards
// it — this does. Every rule the editor blocks a save on is asserted here
// against the shipped tree, which means a hand-edit to tech-tree.json fails
// in CI the same way it would have failed in `?dev=tree`.
//
// The layout invariants that used to live in research.test.ts are here now,
// as cases against a deliberately broken copy: the rules are one module and
// this is what pins them.
import { describe, expect, it } from 'vitest';
import treeDoc from '../src/sim/data/tech-tree.json';
import {
  isDrawnEdge, validateTechTree, type TechTreeDoc,
} from '../src/sim/data/techTreeRules';
import { TECHNOLOGIES, TECH_ORDER } from '../src/sim/data/definitions';

const doc = treeDoc as TechTreeDoc;
const clone = (): TechTreeDoc => structuredClone(doc);

describe('the shipped tech tree', () => {
  it('has no errors', () => {
    expect(validateTechTree(doc).errors.map((e) => e.message)).toEqual([]);
  });

  it('has no warnings', () => {
    expect(validateTechTree(doc).warnings.map((w) => w.message)).toEqual([]);
  });

  it('places every major and gives every technology an entry', () => {
    for (const id of TECH_ORDER) {
      expect(doc.technologies[id], `${id} is missing from tech-tree.json`).toBeDefined();
      if (TECHNOLOGIES[id].line === null) {
        expect(TECHNOLOGIES[id].node, `${id} is a major with no position`).not.toBeNull();
      }
    }
  });

  it('is what definitions.ts serves: the file IS the layout', () => {
    for (const id of TECH_ORDER) {
      const entry = doc.technologies[id];
      expect(TECHNOLOGIES[id].requires).toEqual(entry.requires);
      if (entry.x !== undefined) {
        expect(TECHNOLOGIES[id].node).toEqual({ x: entry.x, y: entry.y });
      } else {
        expect(TECHNOLOGIES[id].node).toBeNull();
      }
    }
  });
});

describe('what the rules refuse', () => {
  const messages = (d: TechTreeDoc) => validateTechTree(d).errors.map((e) => e.message);

  it('two nodes on one cell of one page', () => {
    const d = clone();
    d.technologies.Saws = { ...d.technologies.Saws, x: -2, y: 1 }; // onto UrbanPlanning
    expect(messages(d).some((m) => m.includes('share the cell'))).toBe(true);
    expect(validateTechTree(d).ok).toBe(false);
  });

  it('the same cell on ANOTHER page, which is not a collision', () => {
    const d = clone();
    // Every tome's cover page is at (0,0) on its own page already, which is
    // the case that would break a global coordinate space.
    expect(messages(d)).toEqual([]);
  });

  it('a major with no position', () => {
    const d = clone();
    delete d.technologies.Forestry.x;
    delete d.technologies.Forestry.y;
    expect(messages(d).some((m) => m.includes('major with no position'))).toBe(true);
  });

  it('a requirement that is not a technology, and one that loops', () => {
    const d = clone();
    d.technologies.Forestry.requires = ['Nonsense'];
    expect(messages(d).some((m) => m.includes('not a technology'))).toBe(true);

    const loop = clone();
    loop.technologies.CharterI.requires = ['CharterII'];
    expect(messages(loop).some((m) => m.includes('loop'))).toBe(true);
  });

  it('a requirement that leaves the tome, because the page cannot draw it', () => {
    const d = clone();
    d.technologies.Forestry.requires = ['WarbandI'];
    expect(messages(d).some((m) => m.includes('another tome'))).toBe(true);
  });

  it('a requirement on a LATER era, because the page reads downward', () => {
    const d = clone();
    d.technologies.Forestry.requires = ['CharterI', 'CharterIII'];
    expect(messages(d).some((m) => m.includes('from era 3'))).toBe(true);
  });

  it('an era that climbs back above the one before it', () => {
    const d = clone();
    d.technologies.CharterII = { ...d.technologies.CharterII, y: -2 };
    expect(messages(d).some((m) => m.includes('at or above era 1'))).toBe(true);
  });

  // The invariant that moved here from research.test.ts, and the reason the
  // editor needs a live problem list at all: a legal-looking drag can put a
  // node under a connector that was fine a second ago.
  it('a connector drawn through an unrelated node', () => {
    const d = clone();
    // Agriculture requires CharterI at (0,0); park Masonry on the elbow.
    d.technologies.Masonry = { ...d.technologies.Masonry, x: 1, y: 0 };
    expect(messages(d).some((m) => m.includes('runs through'))).toBe(true);
  });
});

describe('which edges the page draws', () => {
  it('draws a major to its keystone, and a rank to the rank before it', () => {
    expect(isDrawnEdge('CharterI', 'Forestry')).toBe(true);
    expect(isDrawnEdge('SawpitsI', 'SawpitsII')).toBe(true);
  });

  // 119 ranks each carrying a line to one of three keystones would hide every
  // edge that says something. The band the node sits in says it instead.
  it('leaves a rank’s era gate implied', () => {
    expect(TECHNOLOGIES.SawpitsII.requires).toContain('CharterII');
    expect(isDrawnEdge('CharterII', 'SawpitsII')).toBe(false);
  });
});
