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
  collectTap, effectiveStock, harvestSourceAt, isExhausted, stockFraction, tapCell,
  tapYieldAt,
} from '../src/sim/harvest';
import {
  coordKey, getWallet, parseCoordKey, type Coord, type TerrainId,
} from '../src/sim/state';
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
  // A tap takes `tap.work_seconds` of the cell's own work out of its depot —
  // two Wood on a forest — so five taps empty a tree and the tree's total is
  // its STOCK however hard the thumb is upgraded. Nobody mints.
  it('drains the depot and cannot take more than the cell holds', () => {
    const state = canGather(freshGame());
    reveal(state, [FOREST]);
    // One Forest strike takes 10 s, and a tap is worth `tap.workSeconds` of
    // it — so the tree's stock over that is how many taps it stands.
    const perTap = tapYieldAt(state, map, FOREST, T0);
    expect(perTap).toBe(Math.max(1, Math.floor(
      TAP.workSeconds * HARVEST.Forest.unitsPerStrike / HARVEST.Forest.secondsPerStrike)));
    // What the tree actually holds is its authored stock times the GROUND
    // under it — a grassland tree is richer than a desert one.
    const held = effectiveStock(map, FOREST, HARVEST.Forest);
    const taps = Math.ceil(held / perTap);
    for (let i = 1; i < taps; i++) {
      expect(tapCell(state, map, FOREST, T0)).toBe('Harvested');
      expect(isExhausted(state, map, FOREST, T0)).toBe(false);
    }
    expect(tapCell(state, map, FOREST, T0)).toBe('Harvested'); // the last one
    expect(getWallet(state.city.wallet, 'Wood')).toBe(held);
    expect(isExhausted(state, map, FOREST, T0)).toBe(true);
    expect(tapCell(state, map, FOREST, T0)).toBe('Exhausted');
    // Lazy recovery after recoverySeconds.
    const recoverAt = T0 + HARVEST.Forest.recoverySeconds * 1000;
    expect(isExhausted(state, map, FOREST, recoverAt - 1)).toBe(true);
    expect(isExhausted(state, map, FOREST, recoverAt)).toBe(false);
    expect(stockFraction(state, map, FOREST, HARVEST.Forest, recoverAt)).toBe(1); // depot refilled
    expect(tapCell(state, map, FOREST, recoverAt)).toBe('Harvested');
  });

  // The asymmetry is the design: tapping fast is a skill and stays
  // unrestricted; holding trades speed for not having to work, so its
  // repeats are paced.
  it('manual taps are never gated — the player can tap as fast as they like', () => {
    const state = canGather(freshGame());
    const perTap = tapYieldAt(state, map, FOREST, T0);
    expect(collectTap(state, map, FOREST, T0)).toBe('Harvested');
    expect(collectTap(state, map, FOREST, T0 + 1)).toBe('Harvested');
    expect(collectTap(state, map, FOREST, T0 + 2)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Wood')).toBe(3 * perTap);
  });

  it('held-pointer repeats wait out the auto-tap cooldown', () => {
    const state = canGather(freshGame());
    const cooldownMs = effectiveAutoTapCooldownMs(state);
    const perTap = tapYieldAt(state, map, FOREST, T0);
    expect(collectTap(state, map, FOREST, T0)).toBe('Harvested');
    // The input layer retries every 100ms; those land as autoRepeat…
    expect(collectTap(state, map, FOREST, T0 + 100, true)).toBe('OnCooldown');
    expect(collectTap(state, map, FOREST, T0 + cooldownMs - 1, true)).toBe('OnCooldown');
    expect(getWallet(state.city.wallet, 'Wood')).toBe(perTap); // nothing meanwhile
    // …and the first retry at/after the cooldown collects again.
    expect(collectTap(state, map, FOREST, T0 + cooldownMs, true)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Wood')).toBe(2 * perTap);
    // A failed collect (an empty cell) does NOT reset the cooldown anchor.
    for (let i = 0; i < 20; i++) tapCell(state, map, FOREST, T0 + cooldownMs); // drain it
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

// The ground under a cell decides how much is IN it. The multiplier lands on
// the depot rather than on a single extraction, and it has to: a chunk is 1
// unit on most cells and 1 x 0.75 rounds straight back to 1, so a percentage
// on the chunk would be a no-op (04-harvest.md §2.3).
describe('the ground under a cell', () => {
  const cellOf = (kind: TerrainId): Coord | null =>
    map.cells.find((c) => map.terrain.get(coordKey(c)) === kind) ?? null;

  it('scales what a cell holds, by currency, and never below one unit', () => {
    const state = freshGame();
    for (const [kind, food, wood] of [
      ['Grassland', 1.25, 1.25], ['Plains', 1, 1],
      ['Desert', 0.5, 0.5], ['Snow', 0.75, 0.75], ['Tundra', 0.75, 1.5],
    ] as const) {
      const cell = cellOf(kind);
      if (cell === null) continue; // the province may not paint every biome
      expect(effectiveStock(map, cell, HARVEST.Forest), `${kind} wood`)
        .toBe(Math.max(1, Math.round(HARVEST.Forest.stock * wood)));
      expect(effectiveStock(map, cell, HARVEST.Crops), `${kind} food`)
        .toBe(Math.max(1, Math.round(HARVEST.Crops.stock * food)));
    }
    void state;
  });

  it('is a DESERT that gives up stone: poor in food and wood, rich in rock', () => {
    const sand = cellOf('Desert');
    if (sand === null) return; // no desert painted yet
    expect(effectiveStock(map, sand, HARVEST.Forest))
      .toBeLessThan(HARVEST.Forest.stock);
    expect(effectiveStock(map, sand, HARVEST.Stone))
      .toBeGreaterThan(HARVEST.Stone.stock);
  });

  it('is a TUNDRA that pays in materials: hungry, and the best timber there is', () => {
    const cold = cellOf('Tundra');
    if (cold === null) return; // no tundra painted yet
    expect(effectiveStock(map, cold, HARVEST.Crops))
      .toBeLessThan(HARVEST.Crops.stock);
    // Better timber than the grassland that grows the food, which is the whole
    // trade: you go there for materials and you do not eat there.
    const grass = cellOf('Grassland');
    if (grass !== null) {
      expect(effectiveStock(map, cold, HARVEST.Forest))
        .toBeGreaterThan(effectiveStock(map, grass, HARVEST.Forest));
    }
    expect(effectiveStock(map, cold, HARVEST.Stone))
      .toBeGreaterThan(HARVEST.Stone.stock);
  });

  it('leaves Water alone, because shoals sit on it and pay Food', () => {
    const wet = cellOf('Water');
    expect(wet).not.toBeNull();
    expect(effectiveStock(map, wet!, HARVEST.Fish)).toBe(HARVEST.Fish.stock);
  });

  it('does not touch bedrock, which has no depot to scale', () => {
    const sand = cellOf('Desert');
    if (sand === null) return;
    const bedrock = { ...HARVEST.Stone, stock: 0 };
    expect(effectiveStock(map, sand, bedrock)).toBe(0);
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
    while (tapCell(state, map, FOREST, T0) === 'Harvested') { /* drain it */ }
    expect(isExhausted(state, map, FOREST, T0)).toBe(true);

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
      // One landform, two depths of skill. A bare peak answers a pick from
      // the first second — Scaling Tools sits in the Magic tome now, far too
      // late to hold era-1 Stone — Mining gets the iron out of it and Deep
      // Mining reaches the gold. One building works all three: the ladder is
      // in the research, not in the buildings.
      MountainIron: 'Mining',
      MountainGold: 'DeepMining',
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
// are a feature now, and the gate moved to WORKING one — the same shape
// Forestry has on the forest, and for the same reason: the mountain is visible
// and refusing from the first second, so the research is something the player
// wants rather than a chore. Docs/features/01-map-and-fog.md §3. The bare
// peak itself is free to tap since the tome tree (Scaling Tools sits in Magic
// era 2, far too late to hold era-1 Stone); the gate that remains is on the
// METAL.
describe('an iron mountain does not answer a pick until Mining', () => {
  /** Found rather than pinned: the region is repainted often, and a moved
   *  mountain is not a broken gate. */
  const someMountain = (kind: 'Mountain' | 'MountainIron' = 'Mountain'): Coord | null => {
    for (const [key, feature] of [...map.initialFeatures].sort()) {
      if (feature === kind) return parseCoordKey(key);
    }
    return null;
  };

  it('refuses the tap, charges no Mana, then works once researched', () => {
    const peak = someMountain('MountainIron');
    expect(peak, 'the map holds no MountainIron feature to test the gate with').not.toBeNull();
    const state = freshGame();
    reveal(state, [peak!]);

    const before = mana(state);
    expect(collectTap(state, map, peak!, T0)).toBe('TechLocked');
    // A tap a technology refused is a tap that cost nothing.
    expect(mana(state)).toBe(before);
    expect(getWallet(state.city.wallet, 'Stone')).toBe(0);

    completeTech(state, 'Mining');
    expect(collectTap(state, map, peak!, T0)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Stone')).toBe(tapYieldAt(state, map, peak!, T0));
    expect(mana(state)).toBe(before - TAP.manaCost);
  });

  it('gives out after five strikes and comes back on a timer', () => {
    const peak = someMountain();
    expect(peak).not.toBeNull();
    const state = freshGame();
    reveal(state, [peak!]);

    const spec = HARVEST.Stone;
    for (let i = 0; i < spec.stock; i++) {
      expect(tapCell(state, map, peak!, T0), `strike ${i + 1}`).toBe('Harvested');
    }
    expect(isExhausted(state, map, peak!, T0)).toBe(true);
    expect(tapCell(state, map, peak!, T0)).toBe('Exhausted');
    expect(isExhausted(state, map, peak!, T0 + spec.recoverySeconds * 1000)).toBe(false);
  });

  // A rich node is throttled by how long it stays dead, not only by what it
  // pays: iron and gold recover in five minutes against a bare peak's two.
  // Written down because the value was silently halved once already, when
  // MountainIron was created by copying the plain mountain's spec.
  it('makes the metal mountains slower to come back than a bare one', () => {
    expect(HARVEST.Stone.recoverySeconds).toBe(120);
    expect(HARVEST.MountainIron.recoverySeconds).toBe(300);
    expect(HARVEST.MountainGold.recoverySeconds).toBe(300);
    // And a metal peak is RICHER as well as slower: more units in the ground,
    // not merely a bigger number per swing.
    expect(HARVEST.Stone.stock).toBe(5);
    expect(HARVEST.MountainIron.stock).toBeGreaterThan(HARVEST.Stone.stock);
    expect(HARVEST.MountainGold.stock).toBeGreaterThan(HARVEST.Stone.stock);
  });

  it('is worked by the Quarry — the one building that goes after every peak', () => {
    // One building, three sources. The Mine was deleted rather than kept as a
    // second quarry pointed at a second rock: what separates ordinary stone
    // from metal is a technology, not a different shed.
    expect(DISTRICTS.Quarry.harvestSources)
      .toEqual(['Stone', 'MountainIron', 'MountainGold']);
    expect(FEATURES.Mountain.source).toBe('Stone');
    expect(FEATURES.MountainIron.source).toBe('MountainIron');
    expect(FEATURES.MountainGold.source).toBe('MountainGold');
    expect(Object.keys(DISTRICTS)).not.toContain('Mine');
  });
});
