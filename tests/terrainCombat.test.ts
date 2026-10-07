// What a hex's ground does to a fight on it (Docs/features/19-world-map.md
// §4.2): a troop type's attack moved by the terrain and each feature, the
// same for both sides, on a copy of the board.
import { describe, expect, it } from 'vitest';
import { buildBoard } from '../src/sim/battle';
import { WORLD_TERRAIN_COMBAT } from '../src/sim/data/definitions';
import type { BoardHex } from '../src/sim/world/board';
import { groundEdges, onGround } from '../src/sim/world/terrainCombat';

const hex = (terrain: BoardHex['terrain'], features: BoardHex['features']): BoardHex =>
  ({ index: 0, hex: { q: 0, r: 0 }, role: 'outer', terrain, features, seat: null, camp: null, scout: null }) as BoardHex;

const army = () => buildBoard([{ unitId: 'Archer', count: 10 }, { unitId: 'Cavalry', count: 10 }], []);

describe('the ground of a fight', () => {
  it('moves each rule’s troop type, and no other', () => {
    for (const rule of WORLD_TERRAIN_COMBAT) {
      const ground = ['Grassland', 'Plains', 'Desert'].includes(rule.ground)
        ? hex(rule.ground as BoardHex['terrain'], [])
        : hex('Grassland', [rule.ground as BoardHex['features'][number]]);
      expect(groundEdges(ground)).toContainEqual({ unit: rule.unit, attack: rule.attack });
    }
    const forest = hex('Grassland', ['Forest']);
    const before = army();
    const after = onGround(before, forest);
    const archer = (b: ReturnType<typeof army>) => b.slots.find((s) => s.type === 'Archer')!.dmg;
    const cavalry = (b: ReturnType<typeof army>) => b.slots.find((s) => s.type === 'Cavalry')!.dmg;
    const share = groundEdges(forest).filter((e) => e.unit === 'Archer').reduce((n, e) => n + e.attack, 0);
    expect(archer(after)).toBeCloseTo(archer(before) * (1 + share));
    expect(cavalry(after)).toBe(cavalry(before));
  });

  it('is a copy: the army keeps its own board', () => {
    const before = army();
    const dmg = before.slots.map((s) => s.dmg);
    onGround(before, hex('Plains', ['Forest']));
    expect(before.slots.map((s) => s.dmg)).toEqual(dmg);
  });

  it('leaves bare ground with no rule alone', () => {
    const b = army();
    expect(onGround(b, hex('Grassland', []))).toBe(b);
  });
});
