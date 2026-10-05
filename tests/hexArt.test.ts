// What a world hex is drawn with (Docs/plans/world-hex-art.md §2–§4).
import { describe, expect, it } from 'vitest';
import { generateBoard } from '../src/sim/world/board';
import { COMBO_SPRITE, HEX_COMBOS, comboOf, hexArt, improvementTier, pickVariant } from '../src/render/world/hexArt';
import { fittingImprovements } from '../src/worldServer/core';

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

describe('a hex with an improvement', () => {
  it('takes out the feature it works, and leaves what it does not behind it', () => {
    expect(hexArt('Grassland', ['Forest'], { kind: 'LoggingCamp', level: 5 }, false))
      .toMatchObject({ behind: null, main: { improvement: 'LoggingCamp', sprite: 'whex_logging_camp_l5' }, front: null });
    expect(hexArt('Plains', ['Mountain'], { kind: 'StonePit', level: 3 }, false))
      .toMatchObject({ behind: null, main: { sprite: 'whex_stone_pit_l3' } });
    expect(hexArt('Plains', ['Forest'], { kind: 'Fortress', level: 1 }, false)).toMatchObject({ behind: 'Forest' });
  });

  it('keeps the game in front of a Homestead, and the fields go into it', () => {
    expect(hexArt('Grassland', ['Game'], { kind: 'Homestead', level: 1 }, false))
      .toMatchObject({ behind: null, front: 'Game' });
    expect(hexArt('Grassland', ['FertileLand'], { kind: 'Homestead', level: 1 }, false))
      .toMatchObject({ behind: null, front: null });
  });

  it('has three art tiers across five levels', () => {
    expect([1, 2, 3, 4, 5].map(improvementTier)).toEqual(['l1', 'l1', 'l3', 'l3', 'l5']);
  });

  it('only ever stands an improvement where it fits', () => {
    // Every improvement a hex could take leaves at most one thing behind.
    for (let seed = 1; seed <= 100; seed++) {
      for (const h of generateBoard('t', seed).hexes) {
        if (h.terrain === null) continue;
        for (const kind of fittingImprovements(h)) {
          const art = hexArt(h.terrain, h.features, { kind, level: 1 }, false);
          expect(art.main).not.toBeNull();
        }
      }
    }
  });
});

describe('the strategic zoom', () => {
  it('leaves the game out', () => {
    expect(hexArt('Grassland', ['Game'], null, true).main).toBeNull();
    expect(hexArt('Grassland', ['Game'], { kind: 'Homestead', level: 1 }, true).front).toBeNull();
    expect(hexArt('Grassland', ['Mountain'], null, true).main).toEqual({ combo: 'Mountain' });
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
