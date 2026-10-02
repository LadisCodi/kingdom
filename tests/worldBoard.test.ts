// The board and how it is rolled (Docs/features/19-world-map.md §1, §9).
import { describe, expect, it } from 'vitest';
import { WORLD_GEN } from '../src/sim/data/definitions';
import { validateData, type DataDoc } from '../src/sim/data/dataRules';
import balance from '../src/sim/data/balance';
import { HOME_RING, SEATS, SEAT_INDICES, generateBoard, type Board } from '../src/sim/world/board';
import {
  BOARD_HEXES, HEX_DIRS, PORTAL_INDEX, hexDistance, hexIndex, hexNeighbors, rotate60,
} from '../src/sim/world/hex';
import { localWorld } from '../src/sim/world/source';

const at = (board: Board, q: number, r: number) => board.hexes[hexIndex({ q, r })];

describe('the board', () => {
  const board = generateBoard('test', 0x5eed);

  it('gives every ring its role', () => {
    const count = (role: string) => board.hexes.filter((h) => h.role === role).length;
    expect([count('portal'), count('inner'), count('corridor'), count('home'), count('outer')])
      .toEqual([1, 6, 30, 24, 30]);
    expect(board.hexes[PORTAL_INDEX]).toMatchObject({ role: 'portal', terrain: null, features: [] });
  });

  it('seats six cities four hexes from the Portal and from each other', () => {
    expect(SEATS).toHaveLength(6);
    SEATS.forEach((s, i) => {
      expect(hexDistance(s, { q: 0, r: 0 })).toBe(HOME_RING);
      expect(hexDistance(s, SEATS[(i + 1) % 6])).toBe(4);
      expect(board.hexes[SEAT_INDICES[i]]).toMatchObject({ seat: i, terrain: 'Grassland', features: [] });
    });
    expect(board.hexes.filter((h) => h.seat !== null)).toHaveLength(6);
  });

  it('is a pure function of its seed', () => {
    expect(generateBoard('test', 0x5eed)).toEqual(board);
    expect(generateBoard('test', 0x5eee)).not.toEqual(board);
  });

  it('turns one wedge six times, so every seat stands on the same ground', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const b = generateBoard('t', seed);
      for (const h of BOARD_HEXES) {
        if (h.q === 0 && h.r === 0) continue;
        const here = b.hexes[hexIndex(h)];
        if (here.role === 'inner') continue; // authored, never turned
        const turned = b.hexes[hexIndex(rotate60(h))];
        expect({ t: turned.terrain, f: turned.features }).toEqual({ t: here.terrain, f: here.features });
      }
    }
  });

  it('lays the inner ring as authored, east first', () => {
    HEX_DIRS.forEach((d, i) => {
      const hex = at(board, d.q, d.r);
      expect({ terrain: hex.terrain, features: hex.features }).toEqual({
        terrain: WORLD_GEN.innerRing[i].terrain, features: [...WORLD_GEN.innerRing[i].features],
      });
    });
  });

  it('keeps the §9 promises on every seed', () => {
    for (let seed = 0; seed < 500; seed++) {
      const b = generateBoard('t', seed * 7919);
      for (const s of SEATS) {
        const around = hexNeighbors(s).map(hexIndex).filter((i) => i >= 0).map((i) => b.hexes[i]);
        expect(around.some((h) => h.terrain === 'Grassland' && h.features.includes('Forest'))).toBe(true);
        expect(around.some((h) => h.terrain === 'Grassland' && h.features.length === 0)).toBe(true);
        expect(around.some((h) => h.features.includes('Dungeon'))).toBe(false);
      }
      for (const h of b.hexes) {
        if (h.features.includes('Dungeon') || h.features.includes('Sanctuary')) expect(h.role).toBe('outer');
        if (h.features.includes('Landmark')) expect(h.role).toBe('corridor');
        expect(h.features.length).toBeLessThanOrEqual(Math.max(WORLD_GEN.maxFeaturesPerHex, 1));
      }
    }
  });

  it('puts every feature only where it may stand, and never beside one it excludes', () => {
    for (let seed = 0; seed < 500; seed++) {
      for (const h of generateBoard('t', seed * 7919).hexes) {
        if (h.terrain === null) continue;
        h.features.forEach((f, n) => {
          const rule = WORLD_GEN.featureRules[f];
          expect(rule.terrains, `${f} on ${h.terrain}`).toContain(h.terrain);
          for (const other of h.features.slice(0, n)) expect(rule.excludes, `${f} with ${other}`).not.toContain(other);
        });
      }
    }
  });

  it('skips a feature that does not fit, and keeps the rest', () => {
    const gen = structuredClone(WORLD_GEN) as typeof WORLD_GEN;
    for (const role of ['corridor', 'home', 'outer'] as const) gen.featureChance[role] = { Forest: 1, Game: 1 };
    // Beside a city the §9 fix-up has the last word.
    const nearCity = new Set(SEATS.flatMap((c) => hexNeighbors(c).map(hexIndex)));
    for (const h of generateBoard('t', 1, gen).hexes) {
      if ((h.role !== 'corridor' && h.role !== 'outer') || nearCity.has(h.index)) continue;
      if (h.terrain === 'Desert') expect(h.features).toEqual(['Game']);
      else expect(h.features).toEqual(['Forest']);
    }
  });

  it('puts the player in their seat and the rivals in the rest', () => {
    const world = localWorld({ id: 'test', seed: 0x5eed, seat: 2 });
    const seats = world.seats();
    expect(seats.filter((s) => s.owner.you)).toEqual([seats[2]]);
    expect(seats.filter((s) => !s.owner.you)).toHaveLength(5);
    expect(world.controlOf(SEAT_INDICES[2])?.owner.you).toBe(true);
    expect(world.controlOf(PORTAL_INDEX)).toBeNull();
    expect(world.board()).toBe(world.board());
  });
});

describe('the world data', () => {
  const doc = balance as unknown as DataDoc;
  const errors = (d: DataDoc) => validateData(d, doc)
    .filter((i) => i.level === 'error' && i.collection === 'world')
    .map((i) => `${i.path.join('.')}: ${i.message}`);

  it('ships clean', () => expect(errors(doc)).toEqual([]));

  it('refuses a place on a ring it cannot stand on', () => {
    const b = structuredClone(doc) as Record<string, any>;
    b.worldGen.featureChance.home.Dungeon = 0.1;
    b.worldGen.featureChance.outer.Landmark = 0.1;
    b.worldGen.terrainWeights.corridor = { Grassland: 0, Plains: 0, Desert: 0, Mountain: 0 };
    b.worldGen.innerRing.pop();
    b.world.explorerRevealRadius = 2;
    b.world.revealRadiusMax = 1;
    expect(errors(b)).toEqual(expect.arrayContaining([
      'worldGen.featureChance.home.Dungeon: a Dungeon only stands on the outer ring',
      'worldGen.featureChance.outer.Landmark: a Landmark only stands on the corridor ring',
      'worldGen.terrainWeights.corridor: every weight is 0 — a hex here could roll no terrain',
      'world.explorerRevealRadius: is past revealRadiusMax',
    ]));
    expect(errors(b).some((m) => m.startsWith('worldGen.innerRing'))).toBe(true);
  });

  it('refuses a feature rule that cannot hold', () => {
    const b = structuredClone(doc) as Record<string, any>;
    b.worldGen.featureRules.Game.excludes = ['Forest', 'Dungeon', 'Sanctuary', 'Landmark', 'Game', 'FertileLand'];
    b.worldGen.featureRules.Landmark.terrains = [];
    delete b.worldGen.featureRules.Sanctuary;
    b.worldGen.innerRing[0] = { terrain: 'Desert', features: ['Forest'] };
    expect(errors(b)).toEqual(expect.arrayContaining([
      'worldGen.featureRules.Game.excludes: cannot exclude itself',
      'worldGen.featureRules.FertileLand.excludes: Game excludes FertileLand, so FertileLand must exclude Game',
      'worldGen.featureRules.Landmark.terrains: names no terrain — it could never roll',
      'worldGen.featureRules.Sanctuary: is missing — every feature says where it rolls',
      'worldGen.innerRing.0.features.0: a Forest never stands on Desert',
    ]));
  });
});
