import { describe, expect, it } from 'vitest';
import { groupFootprints } from '../src/sim/data/mapRules';
import { buildMapData, footprintAt, footprintCells, townhallDistance } from '../src/sim/grid';
import { coordKey, parseCoordKey, type Coord } from '../src/sim/state';
import {
  fogState, isWithinReach, reachLevelFor, revealCostForCell, revealTap, revealTapsDone,
} from '../src/sim/fog';
import { depotStock, effectiveStock } from '../src/sim/harvest';
import { FOG, HARVEST } from '../src/sim/data/definitions';
import { freshGame, fund } from './helpers';

const at = (xs: string): Coord[] =>
  xs.trim().split('\n').flatMap((row, y) =>
    [...row.trim()].flatMap((ch, x) => (ch === '#' ? [{ x, y }] : [])));

const shape = (cells: Coord[], max: number): string =>
  groupFootprints(cells, max)
    .map(({ anchor, size }) => `${size}@${anchor.x},${anchor.y}`)
    .sort().join(' ');

describe('grouping painted cells into blocks', () => {
  it('takes the largest block it can, then the next', () => {
    // A 3×3 with one extra cell hanging off the bottom-right.
    expect(shape(at(`
      ###
      ###
      ####
    `), 3)).toBe('1@3,2 3@0,0');
  });

  it('falls back to 2×2 when three will not fit', () => {
    expect(shape(at(`
      ##
      ##
    `), 3)).toBe('2@0,0');
  });

  it('leaves a shape nothing squares onto as single cells', () => {
    expect(shape(at(`
      #.#
      .#.
    `), 3)).toBe('1@0,0 1@1,1 1@2,0');
  });

  it('never covers a cell twice, and never misses one', () => {
    const cells = at(`
      #####
      #####
      #####
      #####
    `);
    const seen = new Set<string>();
    for (const { anchor, size } of groupFootprints(cells, 3)) {
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          const k = coordKey({ x: anchor.x + dx, y: anchor.y + dy });
          expect(seen.has(k), `${k} covered twice`).toBe(false);
          seen.add(k);
        }
      }
    }
    expect(seen.size).toBe(cells.length);
    for (const c of cells) expect(seen.has(coordKey(c))).toBe(true);
  });

  it('is STABLE — the same cells always give the same blocks', () => {
    // The whole requirement. A grouping that depended on iteration order
    // would reshuffle the map under saves written against the old one.
    const cells = at(`
      .####.
      ######
      ######
      .####.
      ..##..
    `);
    const first = shape(cells, 3);
    for (const order of [[...cells].reverse(), [...cells].sort(() => 0.5)]) {
      expect(shape(order, 3)).toBe(first);
    }
  });

  it('honours the maximum it is given', () => {
    const big = at(`
      ###
      ###
      ###
    `);
    expect(groupFootprints(big, 3)).toEqual([{ anchor: { x: 0, y: 0 }, size: 3 }]);
    expect(groupFootprints(big, 1).every((f) => f.size === 1)).toBe(true);
  });
});

describe('the shipped province', () => {
  const map = buildMapData();

  it('puts every cell of a block on the same anchor', () => {
    for (const [cellKey, anchorKey] of map.footprintOf) {
      const size = map.footprintSize.get(anchorKey);
      expect(size, `${cellKey} points at ${anchorKey}, which is no anchor`)
        .toBeGreaterThan(1);
    }
  });

  it('gives a cell outside any block a block of one', () => {
    const plain = map.cells.find((c) => !map.footprintOf.has(coordKey(c)))!;
    expect(footprintAt(map, plain)).toEqual({ anchor: plain, size: 1 });
    expect(footprintCells(map, plain)).toEqual([plain]);
  });

  it('only ever groups cells that hold the same feature', () => {
    for (const [cellKey, anchorKey] of map.footprintOf) {
      expect(map.initialFeatures.get(cellKey), cellKey)
        .toBe(map.initialFeatures.get(anchorKey));
    }
  });
});

describe('a block behaves as one thing', () => {
  const map = buildMapData();
  const anchorKey = [...map.footprintSize.keys()][0];
  const anchor = parseCoordKey(anchorKey);
  const size = map.footprintSize.get(anchorKey)!;
  const other = { x: anchor.x + size - 1, y: anchor.y + size - 1 };
  const block = footprintCells(map, anchor);
  const inBlock = new Set(block.map(coordKey));

  /** Re-fog the block and clear one real cell beside it, so it is Discovered
   *  and payable from a single corner. Blocks sit at the map edge, so the
   *  neighbour has to be looked up rather than assumed. */
  const isolate = (state: ReturnType<typeof freshGame>): void => {
    // The mountains sit seventeen rings out and a fresh capital reaches
    // three, so the reach has to be opened before any of this is testable.
    const hall = state.city.districts.find((d) => d.definitionId === 'Townhall')!;
    hall.level = 10;
    for (const c of map.cells) delete state.fog.revealed[coordKey(c)];
    const touching = map.cells.find((c) => !inBlock.has(coordKey(c)) &&
      block.some((b) => Math.abs(b.x - c.x) + Math.abs(b.y - c.y) === 1))!;
    state.fog.revealed[coordKey(touching)] = true;
  };

  it('costs the sum of its cells', () => {
    const state = freshGame();
    const whole = revealCostForCell(state, map, anchor);
    const one = revealCostForCell(state, map, { x: anchor.x, y: anchor.y - 5 });
    // Not an exact multiple — the cells sit at different rings — but a 2×2
    // must cost well over any single cell near it.
    expect(whole).toBeGreaterThan(one * 2);
    // Every cell of the block reports the same price: it is one purchase.
    expect(revealCostForCell(state, map, other)).toBe(whole);
  });

  it('counts its taps once, wherever they land', () => {
    const state = freshGame();
    fund(state, { Gold: 500_000_000 });
    isolate(state);
    expect(fogState(state, map, anchor)).toBe('Discovered');
    // Taps spread over DIFFERENT cells of the block still count as one run.
    expect(revealTap(state, map, anchor)).toBe('Paid');
    expect(revealTap(state, map, other)).toBe('Paid');
    expect(revealTapsDone(state, map, anchor)).toBe(2);
    expect(revealTapsDone(state, map, other)).toBe(2);
  });

  it('clears every one of its cells at once', () => {
    const state = freshGame();
    fund(state, { Gold: 500_000_000 });
    isolate(state);
    let last = '';
    for (let i = 0; i < FOG.tapsToReveal; i++) last = revealTap(state, map, anchor);
    expect(last, `after ${FOG.tapsToReveal} taps; cost ${revealCostForCell(state, map, anchor)}`)
      .toBe('Revealed');
    for (const c of footprintCells(map, anchor)) {
      expect(state.fog.revealed[coordKey(c)], coordKey(c)).toBe(true);
    }
  });

  it('opens when ANY one of its cells is in reach', () => {
    // A block the reach ring CUTS IN HALF — near corner inside, far corner
    // out. That is the whole case: asking for every cell refused a tap on a
    // thing the player could plainly see they had reached.
    const ladder = FOG.reachPerTownhallLevel;
    let split: { anchor: Coord; level: number; near: number } | null = null;
    for (const anchorKey of map.footprintSize.keys()) {
      const a = parseCoordKey(anchorKey);
      const d = footprintCells(map, a).map((c) => townhallDistance(map, c));
      const near = Math.min(...d);
      const far = Math.max(...d);
      const i = ladder.findIndex((r) => r >= near && r < far);
      if (i !== -1) { split = { anchor: a, level: i + 1, near }; break; }
    }
    expect(split, 'no block on the province is split by any reach').not.toBeNull();

    const state = freshGame();
    const hall = state.city.districts.find((d) => d.definitionId === 'Townhall')!;
    hall.level = split!.level;
    expect(isWithinReach(state, map, split!.anchor)).toBe(true);
    // And the refusal names the level that opens it — the NEAREST cell's.
    expect(reachLevelFor(map, split!.anchor)).toBe(split!.level);
  });

  it('draws on one depot, holding its whole area', () => {
    const state = freshGame();
    const spec = HARVEST.Stone;
    expect(depotStock(state, map, anchor, spec))
      .toBe(effectiveStock(state, map, anchor, spec) * size * size);
    // Every cell of the block reads the same depot.
    expect(depotStock(state, map, other, spec)).toBe(depotStock(state, map, anchor, spec));
  });
});
