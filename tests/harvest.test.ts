// Cell harvest: tap yields, exhaustion, lazy recovery.
import { describe, expect, it } from 'vitest';
import { HARVEST } from '../src/sim/data/definitions';
import { harvestSourceAt, isExhausted, tapCell, tapFraction } from '../src/sim/harvest';
import { getWallet } from '../src/sim/state';
import { freshGame, map, reveal, T0 } from './helpers';

const FOREST = { x: 2, y: 2 }; // authored Trees cell near the origin

describe('harvest sources', () => {
  it('Trees cells are Forest; built FarmLands are Crops; districts block', () => {
    const state = freshGame();
    expect(harvestSourceAt(state, FOREST)).toBe('Forest');
    expect(harvestSourceAt(state, { x: 0, y: 0 })).toBe(null); // Townhall
    expect(harvestSourceAt(state, { x: 1, y: 0 })).toBe(null); // Townhall footprint cell
    expect(harvestSourceAt(state, { x: 3, y: 0 })).toBe(null); // empty grass
  });
});

describe('tapping', () => {
  it('a tap yields 1 Wood; the 10th tap exhausts the cell for 90 s', () => {
    const state = freshGame();
    reveal(state, [FOREST]);
    for (let i = 1; i <= 9; i++) {
      expect(tapCell(state, map, FOREST, T0)).toBe('Harvested');
      expect(isExhausted(state, FOREST, T0)).toBe(false);
    }
    expect(tapCell(state, map, FOREST, T0)).toBe('Harvested'); // 10th
    expect(getWallet(state.city.wallet, 'Wood')).toBe(10);
    expect(isExhausted(state, FOREST, T0)).toBe(true);
    expect(tapCell(state, map, FOREST, T0)).toBe('Exhausted');
    // Lazy recovery after recoverySeconds.
    const recoverAt = T0 + HARVEST.Forest.recoverySeconds * 1000;
    expect(isExhausted(state, FOREST, recoverAt - 1)).toBe(true);
    expect(isExhausted(state, FOREST, recoverAt)).toBe(false);
    expect(tapFraction(state, FOREST, HARVEST.Forest, recoverAt)).toBe(1); // taps reset
    expect(tapCell(state, map, FOREST, recoverAt)).toBe('Harvested');
  });

  it('rejects unrevealed and non-resource cells', () => {
    const state = freshGame();
    // (2,5) is a tree beyond the Townhall's fog reveal radius (3).
    expect(tapCell(state, map, { x: 2, y: 5 }, T0)).toBe('NotRevealed');
    expect(tapCell(state, map, { x: 2, y: 0 }, T0)).toBe('NotHarvestable'); // revealed empty grass
  });
});

