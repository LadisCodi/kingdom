// The board and how it is rolled (Docs/features/19-world-map.md §1, §9).
import { describe, expect, it } from 'vitest';
import { depositMaterial } from '../src/sim/world/types';
import { WORLD_GEN } from '../src/sim/data/definitions';
import { validateData, type DataDoc } from '../src/sim/data/dataRules';
import balance from '../src/sim/data/balance';
import { HOME_RING, SEATS, SEAT_INDICES, generateBoard, siteRoom, type Board } from '../src/sim/world/board';
import { OUTER_SITE_ROOM } from '../src/sim/world/types';
import {
  BOARD_CENTRES, BOARD_COUNT, BOARD_HEXES, HEX_DIRS, PORTAL_INDEX, PORTAL_INDICES, hexDistance, hexIndex, hexNeighbors,
  localHex, miniBoardOf, rotate60, worldHex,
} from '../src/sim/world/hex';
import { localWorld } from '../src/sim/world/source';

const at = (board: Board, q: number, r: number) => board.hexes[hexIndex({ q, r })];

describe('the board', () => {
  const board = generateBoard('test', 0x5eed);

  it('gives every ring its role', () => {
    const count = (role: string) => board.hexes.filter((h) => h.role === role).length;
    expect([count('portal'), count('inner'), count('corridor'), count('home'), count('outer')])
      .toEqual([1, 6, 54, 30, 36].map((n) => n * BOARD_COUNT));
    for (const p of PORTAL_INDICES) expect(board.hexes[p]).toMatchObject({ role: 'portal', terrain: null, features: [] });
  });

  it('seats six cities a board, five hexes from its Portal and from each other', () => {
    expect(SEATS).toHaveLength(6 * BOARD_COUNT);
    SEATS.forEach((s, i) => {
      const b = Math.floor(i / 6);
      expect(miniBoardOf(s)).toBe(b);
      expect(hexDistance(s, BOARD_CENTRES[b])).toBe(HOME_RING);
      expect(hexDistance(s, SEATS[b * 6 + ((i + 1) % 6)])).toBe(5);
      expect(board.hexes[SEAT_INDICES[i]]).toMatchObject({ seat: i, terrain: 'Grassland', features: [] });
    });
    expect(board.hexes.filter((h) => h.seat !== null)).toHaveLength(6 * BOARD_COUNT);
  });

  it('is a pure function of its seed', () => {
    expect(generateBoard('test', 0x5eed)).toEqual(board);
    expect(generateBoard('test', 0x5eee)).not.toEqual(board);
  });

  it('turns one wedge six times, so every seat stands on the same ground', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const b = generateBoard('t', seed);
      for (const h of BOARD_HEXES) {
        const here = b.hexes[hexIndex(h)];
        if (here.role === 'inner' || here.role === 'portal') continue; // dealt, never turned
        // Turned a sixth about its own board's Portal.
        const turned = b.hexes[hexIndex(worldHex(miniBoardOf(h), rotate60(localHex(h))))];
        // A deposit stands on the same place in every wedge; which material
        // is the seat's deal.
        if (depositMaterial(here.features) !== null) {
          expect(depositMaterial(turned.features)).not.toBeNull();
          continue;
        }
        expect({ t: turned.terrain, f: turned.features }).toEqual({ t: here.terrain, f: here.features });
      }
    }
  });

  it('lays the inner ring on its authored terrain, east first, a deposit on each', () => {
    HEX_DIRS.forEach((d, i) => {
      const hex = at(board, d.q, d.r);
      expect(depositMaterial(hex.features)).not.toBeNull();
      // The authored terrain, unless the deposit never stands on it.
      const f = hex.features[0];
      const authored = WORLD_GEN.innerRing[i].terrain;
      expect(hex.terrain).toBe(WORLD_GEN.featureRules[f].terrains.includes(authored) ? authored : WORLD_GEN.featureRules[f].terrains[0]);
    });
  });

  it('keeps the §9 promises on every seed', () => {
    for (let seed = 0; seed < 500; seed++) {
      const b = generateBoard('t', seed * 7919);
      for (const s of SEATS) {
        const around = hexNeighbors(s).map(hexIndex).filter((i) => i >= 0).map((i) => b.hexes[i]);
        expect(around.some((h) => h.features.includes('Forest'))).toBe(true);
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

  it('places exactly one dungeon and one sanctuary in every sixth, on the rim, away from the cities', () => {
    expect(siteRoom()).toHaveLength(OUTER_SITE_ROOM);
    const nearCity = new Set(SEATS.flatMap((c) => hexNeighbors(c).map(hexIndex)));
    for (let seed = 0; seed < 300; seed++) {
      const b = generateBoard('t', seed * 104_729);
      for (const site of ['Dungeon', 'Sanctuary'] as const) {
        const at = b.hexes.filter((h) => h.features.includes(site));
        expect(at, `${site} on seed ${seed}`).toHaveLength(6 * BOARD_COUNT);
        for (const h of at) {
          expect(h.role).toBe('outer');
          expect(h.features).toEqual([site]);
          expect(nearCity.has(h.index)).toBe(false);
          expect(WORLD_GEN.featureRules[site].terrains).toContain(h.terrain);
        }
        // One a wedge: each seat has its own, at the same place on its board.
        // (Each board rolls on a seed of its own, so the place differs between boards.)
        for (let board = 0; board < BOARD_COUNT; board++) {
          const nearest = SEATS.slice(board * 6, board * 6 + 6).map((c) => Math.min(...at
            .filter((h) => miniBoardOf(h.hex) === board).map((h) => hexDistance(c, h.hex))));
          expect(new Set(nearest).size).toBe(1);
        }
      }
    }
  });

  it('skips a feature that does not fit, and keeps the rest', () => {
    const gen = structuredClone(WORLD_GEN) as typeof WORLD_GEN;
    for (const role of ['corridor', 'home', 'outer'] as const) gen.featureChance[role] = { Forest: 1, Game: 1 };
    gen.placedPerWedge = {};
    // Beside a city the §9 fix-up has the last word.
    const nearCity = new Set(SEATS.flatMap((c) => hexNeighbors(c).map(hexIndex)));
    for (const h of generateBoard('t', 1, gen).hexes) {
      if ((h.role !== 'corridor' && h.role !== 'outer') || nearCity.has(h.index) || depositMaterial(h.features) !== null) continue;
      if (h.terrain === 'Desert') expect(h.features).toEqual(['Game']);
      else expect(h.features).toEqual(['Forest']);
    }
  });

  it('puts the player in their seat and the rivals in the rest', () => {
    const world = localWorld({ id: 'test', seed: 0x5eed, seat: 2 });
    const seats = world.seats();
    expect(seats.filter((s) => s.owner.you)).toEqual([seats[2]]);
    expect(seats.filter((s) => !s.owner.you)).toHaveLength(6 * BOARD_COUNT - 1);
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
    b.worldGen.terrainWeights.corridor = { Grassland: 0, Plains: 0, Desert: 0 };
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

  it('refuses a placed site that is also rolled, or more sites than the rim holds', () => {
    const b = structuredClone(doc) as Record<string, any>;
    b.worldGen.featureChance.outer.Dungeon = 0.2;
    b.worldGen.placedPerWedge = { Dungeon: 2, Sanctuary: 1, Landmark: 1 };
    expect(errors(b)).toEqual(expect.arrayContaining([
      'worldGen.featureChance.outer.Dungeon: a Dungeon is placed (placedPerWedge), not rolled — its chance is 0',
      'worldGen.placedPerWedge.Landmark: only Dungeon and Sanctuary are placed',
      "worldGen.placedPerWedge: 4 sites, but a wedge's outer ring has room for 3 away from the city",
    ]));
  });

  it('refuses a feature rule that cannot hold', () => {
    const b = structuredClone(doc) as Record<string, any>;
    b.worldGen.featureRules.Game.excludes = [...b.worldGen.featureRules.Game.excludes, 'Game'];
    b.worldGen.featureRules.FertileLand.excludes = b.worldGen.featureRules.FertileLand.excludes.filter((f: string) => f !== 'Game');
    b.worldGen.featureRules.Landmark.terrains = [];
    delete b.worldGen.featureRules.Sanctuary;
    b.worldGen.deposits.weak = ['5:0'];
    b.worldGen.deposits.middle = [...b.worldGen.deposits.middle, b.worldGen.deposits.strong[0]];
    b.worldGen.featureChance.corridor.HeartwoodGrove = 0.2;
    expect(errors(b)).toEqual(expect.arrayContaining([
      'worldGen.featureRules.Game.excludes: cannot exclude itself',
      'worldGen.featureRules.FertileLand.excludes: Game excludes FertileLand, so FertileLand must exclude Game',
      'worldGen.featureRules.Landmark.terrains: names no terrain — it could never roll',
      'worldGen.featureRules.Sanctuary: is missing — every feature says where it rolls',
      'worldGen.deposits.weak.0: is not a corridor place (ring:step, rings 2–4)',
      'worldGen.deposits.middle.2: holds another deposit already',
      'worldGen.featureChance.corridor.HeartwoodGrove: a HeartwoodGrove is dealt (worldGen.deposits), not rolled — its chance is 0',
    ]));
  });
});
