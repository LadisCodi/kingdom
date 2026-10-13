// The tree editor's document: what a save from ?dev=data#tree writes.
//
// The editor rebuilds the document it saves, so a field it forgets to carry
// is a field every save wipes — which is how the chapters' relic-fragment
// rewards went to nothing on the first save after they were authored.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import treeJson from '../src/sim/data/tech-tree.json';
import { TOME_IDS, type TechTreeDoc } from '../src/sim/data/techTreeRules';
import { TreeDoc } from '../src/editor/tree/doc';
// @ts-expect-error — a dev-server plugin in plain JS, with no types.
import { serialiseTechTree } from '../scripts/vite-tree-editor.mjs';

const shipped = (): TechTreeDoc => structuredClone(treeJson) as unknown as TechTreeDoc;
const save = (doc: TreeDoc): string => serialiseTechTree(doc.document, TOME_IDS);

describe('the tree editor', () => {
  it('saves the shipped tree back exactly as it is', () => {
    const file = readFileSync(new URL('../src/sim/data/tech-tree.json', import.meta.url), 'utf8');
    expect(save(new TreeDoc(shipped()))).toBe(file);
  });

  it('keeps what every chapter pays', () => {
    const doc = new TreeDoc(shipped());
    expect(doc.document.eraRewards).toEqual(shipped().eraRewards);
    const saved = JSON.parse(save(doc)) as TechTreeDoc;
    expect(saved.eraRewards).toEqual(shipped().eraRewards);
  });

  it('sets a band\'s reward, and 0 pays nothing', () => {
    const doc = new TreeDoc(shipped());
    doc.setEraReward('Kingdom', 2, 5);
    expect(doc.eraReward('Kingdom', 2)).toBe(5);
    doc.setEraReward('Kingdom', 2, 0);
    expect(doc.eraReward('Kingdom', 2)).toBeNull();
    doc.undo();
    expect(doc.eraReward('Kingdom', 2)).toBe(5);
  });

  it('a band added pays nothing, and a band dropped takes its reward with it', () => {
    const doc = new TreeDoc(shipped());
    const before = shipped().eraRewards!.Kingdom;
    const era = doc.addEra('Kingdom');
    expect(era).not.toBeNull();
    expect(doc.document.eraRewards!.Kingdom).toEqual([...before, null]);
    doc.removeEra('Kingdom', 2);
    expect(doc.document.eraRewards!.Kingdom).toEqual([before[0], ...before.slice(2), null]);
    expect(doc.document.eraRewards!.Kingdom).toHaveLength(doc.eras('Kingdom').length);
  });
});
