// What a world hex is drawn with (Docs/plans/world-hex-art.md §2–§4).
import { describe, expect, it } from 'vitest';
import { generateBoard } from '../src/sim/world/board';
import { COMBO_SPRITE, DISTRICT_SPRITE, HEX_COMBOS, comboOf, fortressSprite, hexArt, pickVariant } from '../src/render/world/hexArt';
import { WORLD_BUILD } from '../src/sim/data/definitions';
import { districtOf } from '../src/worldServer/core';

describe('a hex by its combination', () => {
  it('names the drawing of each feature, on any terrain', () => {
    expect(comboOf('Grassland', [])).toBeNull();
    expect(comboOf('Plains', ['Forest'])).toBe('Forest');
    expect(comboOf('Grassland', ['FertileLand'])).toBe('FertileLand');
    expect(comboOf('Desert', ['Game'])).toBe('Game');
    expect(comboOf('Grassland', ['Mountain'])).toBe('Mountain');
    expect(comboOf('Desert', ['Mountain'])).toBe('Mountain');
    expect(comboOf('Plains', ['Dungeon'])).toBe('MountainDungeon');
    expect(comboOf('Desert', ['Landmark'])).toBe('Landmark');
    expect(comboOf('Plains', ['Sanctuary'])).toBe('Sanctuary');
  });

  it('has a sprite for every combination any board rolls, and one sprite each', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      for (const h of generateBoard('t', seed).hexes) {
        if (h.terrain === null) continue;
        const c = comboOf(h.terrain, h.features);
        if (c !== null) seen.add(c);
      }
    }
    expect([...seen].sort()).toEqual([...HEX_COMBOS].sort());
    expect(new Set(Object.values(COMBO_SPRITE)).size).toBe(HEX_COMBOS.length);
  });
});

describe('a hex with a district', () => {
  it('draws the district over its feature, each with its own art', () => {
    expect(hexArt('Grassland', ['Forest'], 'LoggingCamp', false))
      .toEqual({ plate: 'terrain_grassland', combo: 'Forest', district: { kind: 'LoggingCamp', sprite: 'whex_logging_camp_l1' } });
    expect(hexArt('Plains', ['Mountain'], 'Quarry', false).district?.sprite).toBe('whex_stone_pit_l1');
    expect(hexArt('Desert', [], 'Rural', false)).toMatchObject({ combo: null, district: { sprite: 'whex_rural' } });
    expect(new Set(Object.values(DISTRICT_SPRITE)).size).toBe(Object.keys(DISTRICT_SPRITE).length);
  });

  it('has a district for every hex that can be held, and none for one that cannot', () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const h of generateBoard('t', seed).hexes) {
        const d = districtOf(h);
        if (h.role === 'portal' || h.seat !== null || h.features.includes('Dungeon')) expect(d).toBeNull();
        else expect(WORLD_BUILD.districts[d!].feature).toBe(h.features[0] ?? 'None');
      }
    }
  });

  it('marks a Fortress with the keep of its level', () => {
    expect([1, 2, 3].map(fortressSprite)).toEqual(['whex_fortress_l1', 'whex_fortress_l3', 'whex_fortress_l5']);
  });
});

describe('the strategic zoom', () => {
  it('leaves the game out', () => {
    expect(hexArt('Grassland', ['Game'], null, true).combo).toBeNull();
    expect(hexArt('Grassland', ['Game'], 'HuntingGrounds', true).combo).toBeNull();
    expect(hexArt('Grassland', ['Mountain'], null, true).combo).toBe('Mountain');
  });
});

describe('variants', () => {
  it('picks one of the variants that exist, the same one for the same hex', () => {
    expect(pickVariant('whex_forest', 1, 7)).toBe('whex_forest');
    expect(pickVariant('whex_forest', 0, 7)).toBe('whex_forest');
    const names = Array.from({ length: 127 }, (_, i) => pickVariant('whex_forest', 4, i));
    expect(new Set(names)).toEqual(new Set(['whex_forest', 'whex_forest_2', 'whex_forest_3', 'whex_forest_4']));
    expect(pickVariant('whex_forest', 4, 12)).toBe(names[12]);
    // Spread evenly enough that no variant takes half the board.
    for (const v of new Set(names)) expect(names.filter((n) => n === v).length).toBeLessThan(56);
  });
});
