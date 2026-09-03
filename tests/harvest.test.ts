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
import { DISTRICTS, FEATURES, HARVEST, TAP } from '../src/sim/data/definitions';
import { mana, manaCap } from '../src/sim/mana';
import {
  collectTap, harvestSourceAt, isExhausted, tapCell, tapFraction,
} from '../src/sim/harvest';
import { getWallet, parseCoordKey, type Coord } from '../src/sim/state';
import { effectiveAutoTapCooldownMs } from '../src/sim/upgrades';
import {
  addBuilt, BERRIES, canGather, completeTech, FOREST, freshGame, freshPresenter, map,
  reveal, screenAt, T0,
} from './helpers';


describe('harvest sources', () => {
  it('Trees cells are Forest; built FarmLands are Crops; districts block', () => {
    const state = canGather(freshGame());
    expect(harvestSourceAt(state, FOREST)).toBe('Forest');
    expect(harvestSourceAt(state, { x: 0, y: 0 })).toBe(null); // Townhall
    expect(harvestSourceAt(state, { x: 1, y: 0 })).toBe(null); // Townhall footprint cell
    expect(harvestSourceAt(state, { x: 3, y: 0 })).toBe(null); // empty grass
  });
});

describe('tapping', () => {
  it('a tap yields 1 Wood; the 10th tap exhausts the cell for 90 s', () => {
    const state = canGather(freshGame());
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
    const state = canGather(freshGame());
    expect(collectTap(state, map, FOREST, T0)).toBe('Harvested');
    expect(collectTap(state, map, FOREST, T0 + 1)).toBe('Harvested');
    expect(collectTap(state, map, FOREST, T0 + 2)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Wood')).toBe(3);
  });

  it('held-pointer repeats wait out the auto-tap cooldown', () => {
    const state = canGather(freshGame());
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
    const state = canGather(freshGame());
    // (2,5) is a tree beyond the Townhall's fog reveal radius (3).
    expect(tapCell(state, map, { x: 2, y: 5 }, T0)).toBe('NotRevealed');
    expect(tapCell(state, map, { x: 2, y: 0 }, T0)).toBe('NotHarvestable'); // revealed empty grass
  });
});

describe('the energy a tap is paid from', () => {
  it('charges one Mana per collect, and refuses when the pool is dry', () => {
    const state = canGather(freshGame());
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
    const state = canGather(freshGame());
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
    const state = canGather(freshGame());
    reveal(state, [FOREST]);
    const before = mana(state);
    expect(tapCell(state, map, FOREST, T0)).toBe('Harvested');
    expect(mana(state)).toBe(before);
  });
});

// Docs/features/12-quests.md §2 (quests 2-3), revised: Forestry gates BOTH the woods and
// the berry bushes, so during the first-time experience the only thing a
// player can do is tap fog. That is the point — it is what stops Food (and
// therefore a villager, and therefore rent) arriving before it is meant to,
// and it makes the first research the thing the player actually wants.
describe('Forestry is the only door out of the opening', () => {
  it('leaves a new kingdom with NOTHING on the map it can tap', () => {
    const state = freshGame();
    for (const key of map.terrain.keys()) {
      const [x, y] = key.split(',').map(Number);
      const result = collectTap(state, map, { x, y }, T0);
      expect(result, `(${key}) yielded ${result} before any research`)
        .not.toBe('Harvested');
    }
    // ...and it cost them nothing to find that out.
    expect(mana(state)).toBe(manaCap(state));
  });

  it('refuses the forest until the technology is in, then works normally', () => {
    const state = freshGame();
    reveal(state, [FOREST]); // the player pays for this cell first
    expect(tapCell(state, map, FOREST, T0)).toBe('TechLocked');
    expect(collectTap(state, map, FOREST, T0)).toBe('TechLocked');

    completeTech(state, 'Forestry');
    expect(tapCell(state, map, FOREST, T0)).toBe('Harvested');
  });

  it('refuses the berries on the same technology', () => {
    const state = freshGame();
    reveal(state, [BERRIES]);
    expect(HARVEST.Berries.requiredTech).toBe('Forestry');
    expect(tapCell(state, map, BERRIES, T0)).toBe('TechLocked');
    completeTech(state, 'Forestry');
    expect(tapCell(state, map, BERRIES, T0)).toBe('Harvested');
  });

  it('charges no Mana for a tap the gate refused', () => {
    const state = freshGame();
    reveal(state, [FOREST]);
    const before = mana(state);
    expect(collectTap(state, map, FOREST, T0)).toBe('TechLocked');
    expect(mana(state)).toBe(before);
  });

  // Gates are the exception, not the rule: everything else the map yields
  // stays open, so a player who explores sideways is never told to go and
  // research something first. Three sources are gated and each for its own
  // reason — the first two to pace the opening, the third because taking game
  // is a skill rather than a chore.
  it('gates only what is authored', () => {
    const gated = Object.fromEntries(Object.entries(HARVEST)
      .filter(([, spec]) => spec.requiredTech !== null)
      .map(([id, spec]) => [id, spec.requiredTech]));
    expect(gated).toEqual({
      Forest: 'Forestry',
      Berries: 'Forestry',
      Meat: 'Hunting',
      // Stone comes out of mountains, and Scaling Tools is what opens one.
      Stone: 'ScalingTools',
    });
  });
});

// A crop plot is a district that trains nothing AND a resource cell you tap.
// Those two facts collided when `DistrictDef.trains` became an array: the
// tap handler tested it for truthiness, an empty array is truthy, and every
// non-trainer fell into the "hurry the unit in training" branch, which
// consumed the tap and did nothing. Houses and trees were unaffected —
// Housing has its own branch above it, and a forest cell is not a district
// at all — so the plot was the one thing in the game you could no longer tap.
describe('tapping a crop plot', () => {
  const plot: Coord = { x: 2, y: 0 };

  const withPlot = () => {
    const state = freshGame();
    reveal(state, [plot]);
    addBuilt(state, 'FarmLands', plot);
    const game = freshPresenter(state);
    return { state, game };
  };

  it('collects Food, and does not vanish into the training branch', () => {
    const { state, game } = withPlot();
    expect(DISTRICTS.FarmLands.trains).toEqual([]); // trains nothing…
    expect(harvestSourceAt(state, plot)).toBe('Crops'); // …but IS a resource cell

    const before = getWallet(state.city.wallet, 'Food');
    game.handleTap(...screenAt(game, plot));
    expect(getWallet(state.city.wallet, 'Food')).toBeGreaterThan(before);
  });

  it('still opens the plot card, so inspecting it stays useful', () => {
    const { state, game } = withPlot();
    game.handleTap(...screenAt(game, plot));
    const district = state.city.districts.find((d) => d.definitionId === 'FarmLands')!;
    expect(game.inspectedDistrictId).toBe(district.uniqueId);
  });

  it('spends Mana like every other collect tap', () => {
    const { state, game } = withPlot();
    const before = mana(state);
    game.handleTap(...screenAt(game, plot));
    expect(mana(state)).toBe(before - TAP.manaCost);
  });

  // The other half of the same slip: a building that DOES train still gets
  // the training branch, and the floater names the unit rather than the
  // building's whole offer list.
  it('leaves a real trainer to the training branch', () => {
    const state = freshGame();
    const hall: Coord = { x: 3, y: 2 };
    reveal(state, [hall]);
    addBuilt(state, 'Barracks', hall);
    expect(DISTRICTS.Barracks.trains.length).toBeGreaterThan(0);
    const game = freshPresenter(state);
    const before = getWallet(state.city.wallet, 'Food');
    game.handleTap(...screenAt(game, hall));
    // Nothing harvested — a Barracks is not a resource cell.
    expect(getWallet(state.city.wallet, 'Food')).toBe(before);
    const district = state.city.districts.find((d) => d.definitionId === 'Barracks')!;
    expect(game.inspectedDistrictId).toBe(district.uniqueId);
  });
});

// Mountains used to be a TERRAIN gated by Scaling Tools at REVEAL time. They
// are a feature now, and the gate moved to working one — the same shape
// Forestry has on the forest, and for the same reason: the mountain is visible
// and refusing from the first second, so the research is something the player
// wants rather than a chore. Docs/features/01-map-and-fog.md §3.
describe('a mountain does not answer a pick until Scaling Tools', () => {
  /** Found rather than pinned: the region is repainted often, and a moved
   *  mountain is not a broken gate. */
  const someMountain = (): Coord | null => {
    for (const [key, feature] of [...map.initialFeatures].sort()) {
      if (feature === 'Mountain') return parseCoordKey(key);
    }
    return null;
  };

  it('refuses the tap, charges no Mana, then works once researched', () => {
    const peak = someMountain();
    expect(peak, 'the map holds no Mountain feature to test the gate with').not.toBeNull();
    const state = freshGame();
    reveal(state, [peak!]);

    const before = mana(state);
    expect(collectTap(state, map, peak!, T0)).toBe('TechLocked');
    // A tap a technology refused is a tap that cost nothing.
    expect(mana(state)).toBe(before);
    expect(getWallet(state.city.wallet, 'Stone')).toBe(0);

    completeTech(state, 'ScalingTools');
    expect(collectTap(state, map, peak!, T0)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Stone')).toBe(HARVEST.Stone.yieldPerTap);
    expect(mana(state)).toBe(before - TAP.manaCost);
  });

  it('is what the Quarry works, so the Quarry needs the same research', () => {
    // The Quarry's source and the mountain's source are the same row: that
    // single link is what makes "the Quarry cuts stone from every mountain in
    // range" true without a rule of its own.
    expect(DISTRICTS.Quarry.harvestSource).toBe('Stone');
    expect(FEATURES.Mountain.source).toBe('Stone');
    expect(HARVEST.Stone.requiredTech).toBe('ScalingTools');
  });
});
