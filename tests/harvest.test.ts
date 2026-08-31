// Cell harvest: tap yields, exhaustion, lazy recovery, Rain ×2 recovery math.
import { describe, expect, it } from 'vitest';
import { HARVEST } from '../src/sim/data/definitions';
import {
  harvestSourceAt, isExhausted, rainAdjustedRecovery, tapCell, tapFraction,
} from '../src/sim/harvest';
import { castSpell } from '../src/sim/spells';
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
    // (2,2) is seed-revealed now that the Townhall spans 2x2 — use a farther tree.
    expect(tapCell(state, map, { x: 2, y: 3 }, T0)).toBe('NotRevealed');
    expect(tapCell(state, map, { x: 2, y: 0 }, T0)).toBe('NotHarvestable'); // revealed empty grass
  });
});

describe('Rain ×2 recovery', () => {
  it('formula: completion moves to max(R/2, R − D)', () => {
    expect(rainAdjustedRecovery(90_000, 30_000)).toBe(60_000); // R−D wins: 90−30
    expect(rainAdjustedRecovery(40_000, 30_000)).toBe(20_000); // R/2 wins
    expect(rainAdjustedRecovery(20_000, 30_000)).toBe(10_000); // fully covered
  });

  it('cast on an exhausted cell halves the wait covered by the rain window', () => {
    const state = freshGame();
    reveal(state, [FOREST]);
    for (let i = 0; i < 10; i++) tapCell(state, map, FOREST, T0);
    expect(isExhausted(state, FOREST, T0)).toBe(true); // recovers at T0+90s
    expect(castSpell(state, 'Rain', FOREST, T0)).toBe('Cast');
    // 90s remaining, 30s window → recovers at T0 + max(45, 60) = 60s.
    expect(isExhausted(state, FOREST, T0 + 59_999)).toBe(true);
    expect(isExhausted(state, FOREST, T0 + 60_000)).toBe(false);
    expect(getWallet(state.kingdom.wallet, 'Mana')).toBe(40);
  });

  it('a cell exhausting DURING the rain gets the remaining window', () => {
    const state = freshGame();
    reveal(state, [FOREST]);
    expect(castSpell(state, 'Rain', FOREST, T0)).toBe('Cast'); // fresh cell OK
    const t = T0 + 20_000; // 10s of rain left
    for (let i = 0; i < 10; i++) tapCell(state, map, FOREST, t);
    // R=90s, D=10s → max(45, 80) = 80s from t.
    expect(isExhausted(state, FOREST, t + 79_999)).toBe(true);
    expect(isExhausted(state, FOREST, t + 80_000)).toBe(false);
  });

  it('non-stackable: a second Rain on the same cell is rejected while active', () => {
    const state = freshGame();
    reveal(state, [FOREST]);
    expect(castSpell(state, 'Rain', FOREST, T0)).toBe('Cast');
    expect(castSpell(state, 'Rain', FOREST, T0 + 1000)).toBe('AlreadyActive');
    expect(castSpell(state, 'Rain', FOREST, T0 + 31_000)).toBe('Cast'); // expired
  });

  it('Tap spell has no valid targets (dormant pending rework)', () => {
    const state = freshGame();
    reveal(state, [FOREST]);
    expect(castSpell(state, 'Tap', FOREST, T0)).toBe('InvalidTarget');
  });
});
