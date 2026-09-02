// Cell harvest: tap yields, exhaustion, lazy recovery, the auto-tap cooldown
// that paces holding (but never a deliberate tap), and the ENERGY every
// player tap is paid from.
//
// Mana is the one budget behind every tap in the game — a resource cell and a
// house charge the same `TAP.manaCost` — because tapping is how the player
// accelerates any generator by hand. `tapCell` is the raw primitive and stays
// free, so test setup and the sim can harvest without minting energy; only
// `collectTap`, the thing a finger drives, pays.
import { describe, expect, it } from 'vitest';
import { HARVEST, TAP } from '../src/sim/data/definitions';
import { mana } from '../src/sim/mana';
import {
  collectTap, harvestSourceAt, isExhausted, tapCell, tapFraction,
} from '../src/sim/harvest';
import { getWallet } from '../src/sim/state';
import { effectiveAutoTapCooldownMs } from '../src/sim/upgrades';
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

  // The asymmetry is the design: tapping fast is a skill and stays
  // unrestricted; holding trades speed for not having to work, so its
  // repeats are paced.
  it('manual taps are never gated — the player can tap as fast as they like', () => {
    const state = freshGame();
    expect(collectTap(state, map, FOREST, T0)).toBe('Harvested');
    expect(collectTap(state, map, FOREST, T0 + 1)).toBe('Harvested');
    expect(collectTap(state, map, FOREST, T0 + 2)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Wood')).toBe(3);
  });

  it('held-pointer repeats wait out the auto-tap cooldown', () => {
    const state = freshGame();
    const cooldownMs = effectiveAutoTapCooldownMs(state);
    expect(collectTap(state, map, FOREST, T0)).toBe('Harvested');
    // The input layer retries every 100ms; those land as autoRepeat…
    expect(collectTap(state, map, FOREST, T0 + 100, true)).toBe('OnCooldown');
    expect(collectTap(state, map, FOREST, T0 + cooldownMs - 1, true)).toBe('OnCooldown');
    expect(getWallet(state.city.wallet, 'Wood')).toBe(1); // nothing collected meanwhile
    // …and the first retry at/after the cooldown collects again.
    expect(collectTap(state, map, FOREST, T0 + cooldownMs, true)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Wood')).toBe(2);
    // A failed collect (exhausted cell) does NOT reset the cooldown anchor.
    for (let i = 0; i < 8; i++) tapCell(state, map, FOREST, T0 + cooldownMs); // exhaust (10 taps total)
    expect(collectTap(state, map, FOREST, T0 + 2 * cooldownMs, true)).toBe('Exhausted');
    expect(state.lastCollectTapAt).toBe(T0 + cooldownMs);
  });

  it('rejects unrevealed and non-resource cells', () => {
    const state = freshGame();
    // (2,5) is a tree beyond the Townhall's fog reveal radius (3).
    expect(tapCell(state, map, { x: 2, y: 5 }, T0)).toBe('NotRevealed');
    expect(tapCell(state, map, { x: 2, y: 0 }, T0)).toBe('NotHarvestable'); // revealed empty grass
  });
});

describe('the energy a tap is paid from', () => {
  it('charges one Mana per collect, and refuses when the pool is dry', () => {
    const state = freshGame();
    reveal(state, [FOREST]);
    const before = mana(state);
    expect(before).toBeGreaterThan(0); // a new kingdom starts full
    expect(collectTap(state, map, FOREST, T0)).toBe('Harvested');
    expect(mana(state)).toBe(before - TAP.manaCost);

    state.city.wallet.Mana = 0;
    const wood = getWallet(state.city.wallet, 'Wood');
    expect(collectTap(state, map, FOREST, T0)).toBe('NoMana');
    expect(wood).toBe(getWallet(state.city.wallet, 'Wood')); // nothing harvested
  });

  it('never charges for a tap the cell itself refuses', () => {
    const state = freshGame();
    reveal(state, [FOREST]);
    // Exhaust it with the free primitive so the pool is untouched.
    for (let i = 0; i < HARVEST.Forest.tapsToExhaust; i++) tapCell(state, map, FOREST, T0);
    expect(isExhausted(state, FOREST, T0)).toBe(true);

    const before = mana(state);
    expect(collectTap(state, map, FOREST, T0)).toBe('Exhausted');
    expect(mana(state)).toBe(before);
    // An unrevealed cell is the same story, and says the useful thing rather
    // than blaming the pool.
    expect(collectTap(state, map, { x: 9, y: 9 }, T0)).toBe('NotRevealed');
    expect(mana(state)).toBe(before);
  });

  it('leaves the raw primitive free, so the sim and fixtures do not mint energy', () => {
    const state = freshGame();
    reveal(state, [FOREST]);
    const before = mana(state);
    expect(tapCell(state, map, FOREST, T0)).toBe('Harvested');
    expect(mana(state)).toBe(before);
  });
});
