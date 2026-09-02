// Initial game state: Oakville with its Townhall at (0,0), starting wallets,
// fog seed, authored map features.

import { CITY_DEF, CURRENCIES, KINGDOM_DEF } from './data/definitions';
import { seedFog } from './fog';
import { reconcileSchedule } from './timeline';
import { newSeed } from './rng';
import { TOWNHALL_ORIGIN, type MapData } from './grid';
import { coordKey, type CurrencyId, type GameState, type Wallet } from './state';

export function newGame(map: MapData, now: number): GameState {
  const kingdomWallet: Wallet = {};
  const playerWallet: Wallet = {};
  for (const [id, def] of Object.entries(CURRENCIES)) {
    if (def.scope === 'kingdom') kingdomWallet[id as CurrencyId] = def.start;
    if (def.scope === 'player') playerWallet[id as CurrencyId] = def.start;
  }

  const state: GameState = {
    regionId: 'oakville',
    city: {
      name: CITY_DEF.name,
      wallet: { ...CITY_DEF.initialCurrencies },
      population: CITY_DEF.initialPopulation,
      districts: [],
      queue: [],
      training: null,
      armyQueue: [],
      lastTaxAt: now,
      lastManaAt: now,
    },
    kingdom: {
      maxBuilders: KINGDOM_DEF.startBuilders,
      wallet: kingdomWallet,
      lastKnowledgeAt: now,
    },
    player: { wallet: playerWallet },
    fog: { revealed: {}, discovered: {}, progress: {} },
    features: {},
    featureMeta: {},
    featureRespawns: [],
    harvest: {},
    workers: [],
    army: [],
    research: { completed: [], active: [], slotsPurchased: 0 },
    schedule: [],
    delves: [],
    // One hero free at the start — the gacha sells breadth and speed, never
    // access, so the system has to be reachable without it.
    heroes: {
      owned: ['Warden'], levels: { Warden: 1 }, tiers: { Warden: 1 },
      fragments: {}, xp: {}, partySlotsPurchased: 0,
    },
    gacha: { pullCounts: {}, pityCounters: {} },
    deepestDepth: 0,
    ruinsCleared: {},
    landmarks: { claimed: {}, cleared: {} },
    artifacts: {
      owned: [], levels: {}, tiers: {}, fragments: {},
      attuned: [null], slotsPurchased: 0, lockedUntil: [0],
    },
    upgrades: {},
    modifiers: [],
    quests: { index: 0, progress: 0 },
    discoveries: {},
    pendingDiscoveries: [],
    seed: newSeed(),
    nextId: 1,
    lastAdvance: now,
    lastCollectTapAt: 0,
  };

  // Authored features from the map (static under the harvest model).
  for (const [key, featureId] of map.initialFeatures) {
    state.features[key] = featureId;
  }

  // The Townhall, pre-built at the origin, with its tax cycle running.
  state.city.districts.push({
    uniqueId: `district_Townhall_${state.nextId++}`,
    definitionId: 'Townhall',
    level: 1,
    assignedWorkers: 0,
    location: TOWNHALL_ORIGIN,
    state: 'Built',
    visualVariant: 1,
    lastTapAt: 0,
  });

  reconcileSchedule(state, now);
  seedFog(state, map);

  if (!state.fog.revealed[coordKey(TOWNHALL_ORIGIN)]) {
    throw new Error('New game seed failed: Townhall cell not revealed');
  }
  return state;
}
