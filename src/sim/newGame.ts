// Initial game state: Oakville with its Townhall at (0,0), starting wallets,
// fog seed, authored map features.

import { CITY_DEF, CURRENCIES, KINGDOM_DEF, tomeCoverPage } from './data/definitions';
import { seedFog } from './fog';
import { manaCap } from './mana';
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
      goods: {},
      population: CITY_DEF.initialPopulation,
      districts: [],
      queue: [],
      trainingQueue: [],
      workshops: {},
      lastTaxAt: now,
      lastManaAt: now,
    },
    kingdom: {
      builders: KINGDOM_DEF.startBuilders,
      wallet: kingdomWallet,
      daily: { ladderStep: 0, lastClaimedDay: null },
      lastKnowledgeAt: now,
    },
    player: { wallet: playerWallet, payer: null },
    fog: { revealed: {}, discovered: {}, progress: {} },
    features: {},
    featureMeta: {},
    featureRespawns: [],
    harvest: {},
    workers: [],
    army: [],
    // Civics opens with the kingdom: its cover page is granted, not bought,
    // because Civics IS the game. Magic and Warfare are opened by events in
    // the world — the first paid reveal and the first ruin in sight — see
    // sim/research.ts `openTome`.
    research: {
      completed: [tomeCoverPage('Civics')], active: [], slotsPurchased: 0,
    },
    schedule: [],
    delves: [],
    // One hero free at the start — the gacha sells breadth and speed, never
    // access, so the system has to be reachable without it.
    heroes: {
      owned: ['Warden'], levels: { Warden: 1 }, tiers: { Warden: 1 },
      fragments: {}, xp: {}, partySlotsPurchased: 0,
    },
    gacha: { pullCounts: {}, pityCounters: {} },
    // Ready from the first minute: a new kingdom starts with a full pool, so
    // the offer simply waits for the player to spend down to half.
    ads: { readyAt: now, claims: 0, pending: false },
    deepestDepth: 0,
    ruinsCleared: {},
    landmarks: { claimed: {}, cleared: {} },
    artifacts: {
      owned: [], levels: {}, tiers: {}, fragments: {},
      attuned: [null], slotsPurchased: 0, lockedUntil: [0],
    },
    modifiers: [],
    quests: { index: 0, progress: 0 },
    discoveries: {},
    pendingDiscoveries: [],
    seed: newSeed(),
    nextId: 1,
    lastAdvance: now,
    lastCollectTapAt: 0,
    tapCarry: {},
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
  });

  // A new kingdom starts with a FULL pool, not an empty one. Mana is what
  // every house tap is paid from, so an empty pool at minute zero would gate
  // the city's most-used verb behind a wait before the player has learned
  // that the verb exists. Set after the Townhall is placed, because the cap
  // is read from it.
  state.city.wallet.Mana = manaCap(state);

  reconcileSchedule(state, now);
  seedFog(state, map);

  if (!state.fog.revealed[coordKey(TOWNHALL_ORIGIN)]) {
    throw new Error('New game seed failed: Townhall cell not revealed');
  }
  return state;
}
