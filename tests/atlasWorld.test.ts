// THE ATLAS ON THE WORLD BOARD (Docs/features/tech-tree.md §11.2,
// Docs/features/19-world-map.md §7): what its cards cost, and what the
// research the city sends the server does there — each kind of district's
// output and store, the builders' and menders' pace, which buildings may go
// up and how many, and what a fight or a hex pays.
import { describe, expect, it } from 'vitest';
import { TECHNOLOGIES, WORLD_BUILD, worldUpgradeGate } from '../src/sim/data/definitions';
import { validateTechTree, type TechTreeDoc } from '../src/sim/data/techTreeRules';
import treeJson from '../src/sim/data/tech-tree.json';
import { completeTech, techMaterialsCost } from '../src/sim/research';
import { getWallet, type GameState, type TechId } from '../src/sim/state';
import { worldImprovementBoost } from '../src/sim/world/boost';
import { SEAT_INDICES, generateBoard } from '../src/sim/world/board';
import { boardNeighbors } from '../src/sim/world/hex';
import { boostLoot, lootMultiplier } from '../src/sim/world/loot';
import { scoutPay } from '../src/sim/world/scouting';
import {
  chapelsAllowed, claim, districtOf, districtRate, emptyWorld, join, repairPrice, resolveTo, setBoost, upgrade, upgradeRefusal,
} from '../src/worldServer/core';
import type { SeatBoost, ServerBoard } from '../src/worldServer/types';
import { completeRequirements, freshGame, openEveryEra, T0 } from './helpers';

const HOUR = 3_600_000;

/** A kingdom that has researched these Atlas cards. */
function researched(...ids: TechId[]): GameState {
  const state = freshGame();
  state.research.completed.push(...ids);
  return state;
}

/** A board with the player in its first seat and every rival asleep. */
function board(): { b: ServerBoard; seat: number; data: ReturnType<typeof generateBoard> } {
  const w = emptyWorld();
  const { board: b, seat } = join(w, { id: 'me', name: 'Me', prefer: { id: 'test', seed: 0x5eed, seat: 0 } }, T0);
  for (const s of b.seats) if (s?.bot) s.nextMoveAt = null;
  return { b, seat, data: generateBoard('test', 0x5eed) };
}

/** A hex next to the city, held and standing: a district to build into. */
function held(b: ServerBoard, seat: number, data: ReturnType<typeof generateBoard>, skip: number[] = []): { at: number; t: number } {
  const at = boardNeighbors(SEAT_INDICES[seat]).find((n) => !skip.includes(n) && districtOf(data.hexes[n]) !== null
    && districtOf(data.hexes[n]) !== 'Shrine' && !data.hexes[n].features.includes('Dungeon'))!;
  const r = claim(b, seat, at, T0);
  if (!r.ok) throw new Error(r.why);
  const t = r.finishesAt + HOUR;
  resolveTo(b, t);
  return { at, t };
}

describe('an Atlas card’s price', () => {
  it('asks the first cards for Wood, Stone and Food, then precious materials, then refined goods too', () => {
    expect(techMaterialsCost('Cartography')).toEqual({ Wood: 600, Stone: 300, Food: 300 });
    expect(Object.keys(TECHNOLOGIES.Fortification.goods).some((g) => ['Starmetal', 'Heartwood', 'Moonglass'].includes(g))).toBe(true);
    expect(TECHNOLOGIES.Fortification.goods.Planks).toBeUndefined();
    expect(TECHNOLOGIES.MendersI.goods.Planks).toBeGreaterThan(0);
    expect(TECHNOLOGIES.Pathfinding.cost.Gold).toBe(1_500_000);
  });

  it('is refused while the city is short of a material, and pays it when researched', () => {
    const state = freshGame();
    openEveryEra(state);
    completeRequirements(state, 'Cartography');
    state.research.poured.Cartography = TECHNOLOGIES.Cartography.cost.Knowledge ?? 0;
    Object.assign(state.city.wallet, { Gold: 1e6, Wood: 600, Stone: 300, Food: 299 });
    expect(completeTech(state, 'Cartography')).toBe('NotEnoughMaterials');
    state.city.wallet.Food = 300;
    expect(completeTech(state, 'Cartography')).toBe('Researched');
    expect(getWallet(state.city.wallet, 'Wood')).toBe(0);
    expect(getWallet(state.city.wallet, 'Food')).toBe(0);
  });

  it('is a document the rules refuse when it asks for anything but Wood, Stone or Food', () => {
    const doc = structuredClone(treeJson) as unknown as TechTreeDoc;
    doc.technologies.Cartography.materials = { Gold: 5 };
    expect(validateTechTree(doc).errors.some((e) => e.message.includes('not Wood, Stone or Food'))).toBe(true);
  });
});

describe('what the city sends the server', () => {
  it('locks the Fortress and the Chapel behind their cards, and caps Fortresses at one', () => {
    expect(worldUpgradeGate('Fortress')).toBe('Fortification');
    expect(worldUpgradeGate('Chapel')).toBe('HolyGround');
    expect(worldImprovementBoost(freshGame())).toMatchObject({ upgrades: [], fortresses: WORLD_BUILD.fortresses, chapels: 0 });
    expect(worldImprovementBoost(researched('Fortification', 'HolyGround', 'GarrisonRightsI', 'PilgrimRoadsI')))
      .toMatchObject({ upgrades: ['Fortress', 'Chapel'], fortresses: WORLD_BUILD.fortresses + 1, chapels: 1 });
  });

  it('lifts one kind of district, on top of every district', () => {
    const boost = worldImprovementBoost(researched('LoggingRoadsI', 'WoodYardsI', 'FrontierCharter'));
    expect(boost.produce).toBeCloseTo(1.1, 9);
    expect(boost.districts?.LoggingCamp).toEqual({ produce: 1.15, store: 1.25 });
    expect(boost.districts?.Rural).toBeUndefined();
  });

  it('builds and mends faster', () => {
    const boost = worldImprovementBoost(researched('FrontierBuildersI', 'MendersI'));
    expect(boost.build).toBeCloseTo(1.1, 9);
    expect(boost.repair).toBeCloseTo(1.25, 9);
  });
});

describe('the server, told', () => {
  it('scales one kind of district’s output and store, and no other', () => {
    const { data } = board();
    const forest = data.hexes.find((h) => districtOf(h) === 'LoggingCamp')!;
    const rural = data.hexes.find((h) => districtOf(h) === 'Rural')!;
    const boost: SeatBoost = { produce: 1.1, store: 1, districts: { LoggingCamp: { produce: 1.5, store: 2 } } };
    const base = districtRate(forest);
    expect(districtRate(forest, boost).perHour).toBeCloseTo(base.perHour * 1.1 * 1.5, 9);
    expect(districtRate(forest, boost).cap).toBeCloseTo(base.cap * 2, 9);
    expect(districtRate(rural, boost).perHour).toBeCloseTo(districtRate(rural).perHour * 1.1, 9);
  });

  it('refuses a building its research has not opened, and a Fortress past the cap', () => {
    const { b, seat, data } = board();
    // Two districts beside the city, claimed together.
    const pick = boardNeighbors(SEAT_INDICES[seat]).filter((n) => districtOf(data.hexes[n]) !== null
      && districtOf(data.hexes[n]) !== 'Shrine' && !data.hexes[n].features.includes('Dungeon'));
    const done = Math.max(...pick.slice(0, 2).map((at) => {
      const r = claim(b, seat, at, T0);
      if (!r.ok) throw new Error(r.why);
      return r.finishesAt;
    }));
    const t = done + HOUR;
    resolveTo(b, t);
    const first = { at: pick[0], t };
    const second = { at: pick[1], t };
    setBoost(b, seat, { produce: 1, store: 1, upgrades: [], fortresses: 1 }, first.t);
    expect(upgradeRefusal(b, seat, first.at, 'Fortress', first.t)).toBe('Locked');
    expect(upgradeRefusal(b, seat, first.at, 'Chapel', first.t)).toBe('Locked');
    setBoost(b, seat, { produce: 1, store: 1, upgrades: ['Fortress', 'Chapel'], fortresses: 1 }, first.t);
    expect(upgrade(b, seat, first.at, 'Fortress', first.t).ok).toBe(true);
    expect(upgradeRefusal(b, seat, second.at, 'Fortress', second.t)).toBe('TooManyFortresses');
    setBoost(b, seat, { produce: 1, store: 1, upgrades: ['Fortress', 'Chapel'], fortresses: 2 }, second.t);
    expect(upgradeRefusal(b, seat, second.at, 'Fortress', second.t)).toBeNull();
  });

  it('leaves a seat that says nothing — an older client, a rival — as it was', () => {
    const { b, seat, data } = board();
    const first = held(b, seat, data);
    expect(upgradeRefusal(b, seat, first.at, 'Fortress', first.t)).toBeNull();
    expect(chapelsAllowed(b, seat)).toBe(1 + Math.floor(2 / WORLD_BUILD.chapelsPerHexes));
  });

  it('adds the Atlas’s Chapels, times builds and repairs at its speeds', () => {
    const { b, seat, data } = board();
    const base = chapelsAllowed(b, seat);
    const plain = repairPrice(b, seat).seconds;
    setBoost(b, seat, { produce: 1, store: 1, chapels: 2, build: 2, repair: 2 }, T0);
    expect(chapelsAllowed(b, seat)).toBe(base + 2);
    expect(repairPrice(b, seat).seconds).toBe(Math.round(plain / 2));
    const at = boardNeighbors(SEAT_INDICES[seat]).find((n) => districtOf(data.hexes[n]) !== null
      && !data.hexes[n].features.includes('Dungeon'))!;
    const r = claim(b, seat, at, T0);
    expect(r.ok && r.finishesAt).toBe(T0 + WORLD_BUILD.claim.buildSeconds * 1000 / 2);
  });
});

describe('what a fight and a hex pay', () => {
  const loot = { kind: 'loot' as const, at: T0, gold: 1000, knowledge: 10, heroXp: 500, stardust: 20 };

  it('adds the camp, dungeon and Portal shares to their own fights only — never to Gems', () => {
    const state = researched('BountyHuntersI', 'BattleLoreI');
    expect(lootMultiplier(state, 'camp')).toBeCloseTo(1.1, 9);
    expect(lootMultiplier(state, 'room')).toBe(1);
    const camp = boostLoot(state, { ...loot, hours: 2, gems: 5 });
    expect(camp).toMatchObject({ gold: 1100, knowledge: 11, gems: 5, heroXp: 605 });
    expect(camp.hours).toBeCloseTo(2.2, 9);
    // A dungeon room: only the world's Hero XP share.
    expect(boostLoot(state, { ...loot, from: 'room' })).toMatchObject({ gold: 1000, heroXp: 550 });
    // Nothing researched: the very effect the server sent.
    const plain = { ...loot, from: 'portal' as const };
    expect(boostLoot(freshGame(), plain)).toBe(plain);
  });

  it('adds Keen Eyes’ share to what a hex pays, never to its pack', () => {
    const def = { reward: 'Stardust' as const, weight: 1, amount: 100, pack: null };
    expect(scoutPay(researched('KeenEyesI'), def, 'outer').wallet.Stardust).toBe(115);
    expect(scoutPay(researched('KeenEyesI'), { reward: 'Pack', weight: 1, amount: 1, pack: 'Green' }, 'outer').pack).toBe('Green');
  });
});
