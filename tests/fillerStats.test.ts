// The filler stats (Docs/plans/tech-tree-rework.md §4): every one moves its
// number at the call site that owns it, aims only where that number exists,
// and — for a timer — prices the wait when it starts and never again.
//
// No card in the tree names these stats yet, so each test lends one
// technology the effect under test and puts it back — the price of testing a
// bonus that is not in the file (the same trick as techEffects.test.ts).
import { describe, expect, it } from 'vitest';
import { HARVEST, TECHNOLOGIES, TECH_ORDER } from '../src/sim/data/definitions';
import { effectProblems, type TechEffect } from '../src/sim/data/techEffectRules';
import { ownGoldPerMinute } from '../src/sim/population';
import { queueCapacity } from '../src/sim/workshops';
import { harmonySupply } from '../src/sim/harmony';
import { effectiveRespawnMs, effectiveStock } from '../src/sim/harvest';
import { workerStrikeMs } from '../src/sim/upgrades';
import { assignableWorkerLimit, influenceRadius } from '../src/sim/workers';
import { healSecondsAt, healWounded, lineFor } from '../src/sim/army';
import { armyMarchSpeed } from '../src/sim/world/armies';
import { explorerSpeed } from '../src/sim/world/explorers';
import { worldImprovementBoost } from '../src/sim/world/boost';
import { treasureReward } from '../src/sim/treasures';
import { buildBoard, generateEnemy } from '../src/sim/battle';
import { SEAT_INDICES, generateBoard } from '../src/sim/world/board';
import { boardNeighbors } from '../src/sim/world/hex';
import {
  build, claim, emptyWorld, fittingImprovements, improvementRate, join, resolveTo, sendArmy, setBoost, storesAt,
} from '../src/worldServer/core';
import { WORLD_BUILD } from '../src/sim/data/definitions';
import { townhall, type District, type DistrictId, type GameState, type TechId } from '../src/sim/state';
import { FOREST, addBuilt, freshGame, fund, map, T0 } from './helpers';

/** A technology with no effects of its own, to lend an effect to. */
const HOST = TECH_ORDER.find((id) => TECHNOLOGIES[id].effects.length === 0)! as TechId;

/** Run `fn` on a kingdom holding exactly these effects, then put the tree back. */
function withEffects<T>(effects: TechEffect[], fn: (state: GameState) => T, state = freshGame()): T {
  const was = TECHNOLOGIES[HOST].effects;
  try {
    TECHNOLOGIES[HOST].effects = effects;
    if (!state.research.completed.includes(HOST)) state.research.completed.push(HOST);
    return fn(state);
  } finally {
    TECHNOLOGIES[HOST].effects = was;
  }
}

/** Drop a built district on the first free cell it fits, and return it. */
function placed(state: GameState, id: DistrictId): District {
  const taken = new Set(state.city.districts.map((d) => `${d.location.x},${d.location.y}`));
  const cell = map.cells.find((c) => !taken.has(`${c.x},${c.y}`) && Math.abs(c.x) + Math.abs(c.y) >= 4)!;
  addBuilt(state, id, cell);
  return state.city.districts.at(-1)!;
}

describe('the city', () => {
  it('ownGold lifts what the Townhall makes by itself, and nothing else pays more', () => {
    const base = ownGoldPerMinute(freshGame(), townhall(freshGame()));
    withEffects([{ stat: 'ownGold', op: 'percent', value: 20 }], (state) => {
      expect(ownGoldPerMinute(state, townhall(state))).toBeCloseTo(base * 1.2, 9);
      const house = placed(state, 'Housing');
      expect(ownGoldPerMinute(state, house)).toBe(0); // a percent of nothing
    });
  });

  it('workshopQueueSlots adds whole orders to the workshop it names', () => {
    const plain = freshGame();
    const cap = queueCapacity(plain, placed(plain, 'Carpenter'));
    withEffects([{ stat: 'workshopQueueSlots', op: 'flat', value: 1, target: { district: 'Carpenter' } }], (state) => {
      expect(queueCapacity(state, placed(state, 'Carpenter'))).toBe(cap + 1);
      const mason = placed(state, 'MasonsYard');
      expect(queueCapacity(state, mason)).toBe(queueCapacity(plain, placed(plain, 'MasonsYard')));
    });
    expect(effectProblems({ stat: 'workshopQueueSlots', op: 'flat', value: 1, target: { district: 'Farm' } }))
      .not.toEqual([]);
  });

  it('decorationHarmony lifts what a standing decoration supplies, in whole points', () => {
    const plain = freshGame();
    placed(plain, 'Garden');
    const base = harmonySupply(plain);
    expect(base).toBeGreaterThan(0);
    withEffects([{ stat: 'decorationHarmony', op: 'flat', value: 2 }], (state) => {
      placed(state, 'Garden');
      expect(harmonySupply(state)).toBe(base + 2);
      placed(state, 'Housing'); // supplies none, and the tree gives it none
      expect(harmonySupply(state)).toBe(base + 2);
    });
    withEffects([{ stat: 'decorationHarmony', op: 'percent', value: 10 }], (state) => {
      placed(state, 'Garden');
      expect(harmonySupply(state)).toBe(Math.floor(base * 1.1));
    });
    expect(effectProblems({ stat: 'decorationHarmony', op: 'flat', value: 1, target: { district: 'Farm' } }))
      .not.toEqual([]);
  });
});

describe('the ground and the crews', () => {
  const tree = FOREST;

  it('cellStock fills a tree with more Wood, and is refused on a mountain', () => {
    const base = effectiveStock(freshGame(), map, tree, HARVEST.Forest);
    withEffects([{ stat: 'cellStock', op: 'percent', value: 50, target: { harvest: 'Forest' } }], (state) => {
      // The depot is rounded once, after the ground and the tree together:
      // a grassland tree's 12.5 Wood × 1.5 is 18.75, so 19 — not 13 × 1.5.
      const lifted = effectiveStock(state, map, tree, HARVEST.Forest);
      expect(lifted).toBeGreaterThan(base);
      expect(Math.abs(lifted - base * 1.5)).toBeLessThanOrEqual(1);
      expect(effectiveStock(state, map, tree, HARVEST.Crops))
        .toBe(effectiveStock(freshGame(), map, tree, HARVEST.Crops));
    });
    // A mountain holds no stock: a percent of it is a percent of nothing.
    for (const harvest of ['Stone', 'MountainIron', 'MountainGold'] as const) {
      expect(effectProblems({ stat: 'cellStock', op: 'percent', value: 10, target: { harvest } }), harvest)
        .not.toEqual([]);
    }
  });

  it('respawnSpeed brings a consumed bush back sooner, and only on what is consumed', () => {
    const base = effectiveRespawnMs(freshGame(), HARVEST.Berries);
    withEffects([{ stat: 'respawnSpeed', op: 'percent', value: 50, target: { harvest: 'Berries' } }], (state) => {
      expect(effectiveRespawnMs(state, HARVEST.Berries)).toBe(Math.round(base / 1.5));
      expect(effectiveRespawnMs(state, HARVEST.Fish)).toBe(effectiveRespawnMs(freshGame(), HARVEST.Fish));
    });
    expect(effectProblems({ stat: 'respawnSpeed', op: 'percent', value: 10, target: { harvest: 'Forest' } }))
      .not.toEqual([]);
  });

  it('crewStrikeSpeed makes the named building’s crew swing faster', () => {
    const plain = freshGame();
    const base = workerStrikeMs(plain, HARVEST.Forest, placed(plain, 'Sawmill'));
    const farmBase = workerStrikeMs(plain, HARVEST.Crops, placed(plain, 'Farm'));
    withEffects([{ stat: 'crewStrikeSpeed', op: 'percent', value: 25, target: { district: 'Sawmill' } }], (state) => {
      expect(workerStrikeMs(state, HARVEST.Forest, placed(state, 'Sawmill'))).toBe(Math.round(base / 1.25));
      expect(workerStrikeMs(state, HARVEST.Crops, placed(state, 'Farm'))).toBe(farmBase);
    });
  });

  it('influenceRadius and crewSlots add whole tiles and whole workers to one producer', () => {
    const plain = freshGame();
    const reach = influenceRadius(plain, placed(plain, 'Sawmill'));
    const slots = assignableWorkerLimit(plain, placed(plain, 'Sawmill'));
    withEffects([
      { stat: 'influenceRadius', op: 'flat', value: 1, target: { district: 'Sawmill' } },
      { stat: 'crewSlots', op: 'flat', value: 2, target: { district: 'Sawmill' } },
    ], (state) => {
      const mill = placed(state, 'Sawmill');
      expect(influenceRadius(state, mill)).toBe(reach + 1);
      expect(assignableWorkerLimit(state, mill)).toBe(slots + 2);
      const farm = placed(state, 'Farm');
      expect(influenceRadius(state, farm)).toBe(influenceRadius(plain, placed(plain, 'Farm')));
    });
    expect(effectProblems({ stat: 'crewSlots', op: 'flat', value: 1, target: { district: 'Barracks' } }))
      .not.toEqual([]);
  });
});

describe('the army', () => {
  it('healSpeed shortens a ward priced from now on, and never one already mending', () => {
    const base = healSecondsAt(freshGame(), undefined, 'Warrior', 10);
    expect(withEffects([{ stat: 'healSpeed', op: 'percent', value: 50 }],
      (state) => healSecondsAt(state, undefined, 'Warrior', 10))).toBe(Math.max(1, Math.round(base / 1.5)));

    // A ward already on the bed keeps the time it was stamped with.
    const state = freshGame();
    fund(state, { Gold: 1e9, Wood: 1e9, Food: 1e9, Stone: 1e9 });
    const ward = placed(state, 'Infirmary');
    placed(state, 'Barracks');
    state.city.wounded = { Warrior: 10 };
    expect(healWounded(state, 'Warrior', 10, T0)).toBe('Queued');
    const item = lineFor(state, ward.uniqueId)[0];
    const stamped = item.seconds;
    expect(stamped).toBe(healSecondsAt(state, ward.uniqueId, 'Warrior', 10));
    withEffects([{ stat: 'healSpeed', op: 'percent', value: 50 }], (s) => {
      expect(lineFor(s, ward.uniqueId)[0].seconds).toBe(stamped);
    }, state);
  });

  it('armyMarchSpeed is the pace the city sends, and the server marches at it', () => {
    expect(armyMarchSpeed(freshGame())).toBe(1);
    expect(withEffects([{ stat: 'armyMarchSpeed', op: 'percent', value: 100 }], armyMarchSpeed)).toBe(2);

    const march = (speed?: number) => {
      const w = emptyWorld();
      const { board, seat } = join(w, { id: 'me', name: 'Me', prefer: { id: 'test', seed: 0x5eed, seat: 0 } }, T0);
      for (const s of board.seats) if (s?.bot) s.nextMoveAt = null;
      const plan = generateEnemy({ seed: 1, parts: ['test', 'march'], budget: 100, affinity: 'Any' });
      const dungeon = generateBoard('test', 0x5eed).hexes.find((h) => h.features.includes('Dungeon'))!.index;
      const r = sendArmy(board, seat, {
        purpose: 'delve', target: dungeon, heroes: [], board: buildBoard(plan.squads, plan.fighters), speed,
      }, T0);
      if (!r.ok) throw new Error(r.why);
      return board.armies[0].stepMs;
    };
    const slow = march();
    const fast = march(2);
    expect(fast).toEqual(slow.map((ms) => Math.max(1, Math.round(ms / 2))));
  });
});

describe('the world', () => {
  it('explorerSpeed is a tech stat under the hero’s boon', () => {
    expect(explorerSpeed(freshGame())).toBe(1);
    expect(withEffects([{ stat: 'explorerSpeed', op: 'percent', value: 30 }], explorerSpeed)).toBeCloseTo(1.3, 9);
  });

  it('the improvement boost lifts output and store from the moment it is taken, never before', () => {
    expect(worldImprovementBoost(freshGame())).toEqual({ produce: 1, store: 1 });
    expect(withEffects([
      { stat: 'improvementYield', op: 'percent', value: 50 },
      { stat: 'improvementStore', op: 'percent', value: 100 },
    ], worldImprovementBoost)).toEqual({ produce: 1.5, store: 2 });

    const data = generateBoard('test', 0x5eed);
    const w = emptyWorld();
    const { board: b, seat } = join(w, { id: 'me', name: 'Me', prefer: { id: 'test', seed: 0x5eed, seat: 0 } }, T0);
    for (const s of b.seats) if (s?.bot) s.nextMoveAt = null;
    const at = boardNeighbors(SEAT_INDICES[seat])
      .find((n) => fittingImprovements(data.hexes[n]).some((k) => k !== 'Fortress')
        && !data.hexes[n].features.includes('Dungeon'))!;
    claim(b, seat, at, T0);
    const t1 = T0 + WORLD_BUILD.outpost.buildSeconds * 1000;
    const kind = fittingImprovements(data.hexes[at]).find((k) => k !== 'Fortress')!;
    const r = build(b, seat, at, kind, t1);
    if (!r.ok) throw new Error(r.why);
    const HOUR = 3_600_000;
    const { perHour, cap } = improvementRate(data.hexes[at], kind, 1);
    expect(improvementRate(data.hexes[at], kind, 1, { produce: 1.5, store: 2 }))
      .toEqual({ perHour: perHour * 1.5, cap: cap * 2 });

    const boostAt = r.finishesAt + HOUR;
    resolveTo(b, boostAt);
    const before = storesAt(b, at, boostAt).material;
    setBoost(b, seat, { produce: 1.5, store: 2 }, boostAt);
    // What was made before the research is not repriced…
    expect(storesAt(b, at, boostAt).material).toBeCloseTo(before, 9);
    // …and what is made after it is.
    resolveTo(b, boostAt + HOUR);
    expect(storesAt(b, at, boostAt + HOUR).material).toBeCloseTo(Math.min(cap * 2, before + perHour * 1.5), 6);
  });

  it('treasureYield lifts a find priced in production, never the first and never Knowledge', () => {
    const plain = freshGame();
    const gold = treasureReward(plain, { n: 3, coin: 'Gold' }).Gold!;
    withEffects([{ stat: 'treasureYield', op: 'percent', value: 50 }], (state) => {
      expect(treasureReward(state, { n: 3, coin: 'Gold' }).Gold).toBe(Math.round(gold * 1.5));
      expect(treasureReward(state, { n: 0, coin: 'Gold' })).toEqual(treasureReward(plain, { n: 0, coin: 'Gold' }));
      expect(treasureReward(state, { n: 3, coin: 'Knowledge' }))
        .toEqual(treasureReward(plain, { n: 3, coin: 'Knowledge' }));
    });
  });
});
