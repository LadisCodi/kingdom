// The map left the workbook, so the importer no longer guards it — this does.
// Every rule the map editor blocks a save on is asserted here against the
// shipped region, which means a hand-edit to region-map.json fails in CI the
// same way it would have failed in the editor.

import { describe, expect, it } from 'vitest';
import regionMap from '../src/sim/data/region-map.json';
import { validateRegionMap, type RegionMapDoc } from '../src/sim/data/mapRules';
import { buildMapData, townhallDistance } from '../src/sim/grid';
import { LANDMARKS, RUINS, RUIN_ORDER } from '../src/sim/data/definitions';

const doc = regionMap as RegionMapDoc;
const clone = (): RegionMapDoc => structuredClone(doc);

describe('the shipped region map', () => {
  it('has no errors', () => {
    const { errors } = validateRegionMap(doc);
    expect(errors.map((e) => e.message)).toEqual([]);
  });

  it('has no warnings — an island with free fog is a trap, not a design', () => {
    const { warnings } = validateRegionMap(doc);
    expect(warnings.map((w) => w.message)).toEqual([]);
  });

  it('reaches every site from the Townhall', () => {
    const map = buildMapData();
    for (const l of LANDMARKS) {
      // Distance 0 off the Townhall footprint means "the BFS never got here".
      expect(townhallDistance(map, l.location), `landmark ${l.id}`).toBeGreaterThan(0);
    }
    for (const id of RUIN_ORDER) {
      expect(townhallDistance(map, RUINS[id].location), `ruin ${id}`).toBeGreaterThan(0);
    }
  });
});

describe('the rules the editor enforces', () => {
  it('refuses a Townhall footprint that is not clear Grassland', () => {
    const d = clone();
    d.terrain.cells.find((c) => c.x === 1 && c.y === 1)!.id = 'Water';
    expect(validateRegionMap(d).errors.map((e) => e.message))
      .toContain('the Townhall cell (1,1) is Water, not Grassland');
  });

  it('refuses a site in the sea', () => {
    const d = clone();
    const sea = d.terrain.cells.find((c) => c.id === 'Water')!;
    d.landmarks[0].x = sea.x;
    d.landmarks[0].y = sea.y;
    expect(validateRegionMap(d).errors.some((e) => /is on water at/.test(e.message))).toBe(true);
  });

  it('refuses two sites on one cell', () => {
    const d = clone();
    d.landmarks[1].x = d.landmarks[0].x;
    d.landmarks[1].y = d.landmarks[0].y;
    expect(validateRegionMap(d).errors.some((e) => /shares \(.*\) with landmark/.test(e.message)))
      .toBe(true);
  });

  it('refuses a shoal on dry land, and a forest at sea', () => {
    const d = clone();
    const grass = d.terrain.cells.find((c) => c.id === 'Grassland' && c.x > 3)!;
    d.features.cells.push({ x: grass.x, y: grass.y, id: 'FishShoal' });
    expect(validateRegionMap(d).errors.some((e) => /is on Grassland, not on Water/.test(e.message)))
      .toBe(true);

    const d2 = clone();
    const sea = d2.terrain.cells.find((c) => c.id === 'Water')!;
    d2.features.cells.push({ x: sea.x, y: sea.y, id: 'Trees' });
    expect(validateRegionMap(d2).errors.some((e) => /is in the water/.test(e.message))).toBe(true);
  });

  it('refuses a ruin the code does not know about, and notices a missing one', () => {
    const d = clone();
    d.ruins.Atlantis = structuredClone(d.ruins.HollowBarrow);
    expect(validateRegionMap(d).errors.some((e) => /"Atlantis" is not a ruin/.test(e.message)))
      .toBe(true);

    const d2 = clone();
    delete d2.ruins.HollowBarrow;
    expect(validateRegionMap(d2).errors.some((e) => /ruin "HollowBarrow" is missing/.test(e.message)))
      .toBe(true);
  });

  it('warns about land the Townhall cannot walk to', () => {
    const d = clone();
    // An island two cells clear of everything: reachability crosses water, so
    // it has to be surrounded by void to actually strand.
    d.terrain.cells.push({ x: 99, y: 99, id: 'Grassland' });
    const { errors, warnings } = validateRegionMap(d);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => /cannot be walked to from the Townhall/.test(w.message))).toBe(true);
  });
});
