// Initial game state: Oakville with its Townhall at (0,0), starting wallets,
// fog seed, authored map features.

import { CITY_DEF, CURRENCIES, KINGDOM_DEF } from './data/definitions';
import { dayIndex } from './daily';
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
      daily: { season: -1, rung: 0, lastClaimedDay: null, royalSeason: null, royalClaimed: [] },
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
    // Nothing is researched, and nothing is granted. Every book is open from
    // the first minute (sim/research.ts `isTomeOpen`); what paces one is the
    // era bars, which ask for revealed cells.
    research: { completed: [], active: [], slotsPurchased: 0 },
    schedule: [],
    delves: [],
    // One hero free at the start — a wallet may buy power, but never sole
    // access, so the system has to be reachable without it.
    heroes: {
      owned: ['Warden'], levels: { Warden: 1 }, tiers: { Warden: 1 },
      // One hero slot is free; the second and third are Gems, always
      // (Docs/features/10-heroes.md §3).
      heroSlotsPurchased: 0,
      fragments: {}, partySlotsPurchased: 0,
    },
    gacha: { pullCounts: {}, pityCounters: {}, legendaryPity: {}, freePulls: {} },
    // Ready from the first minute: a new kingdom starts with a full pool, so
    // the offer simply waits for the player to spend down to half.
    ads: {
      readyAt: now,
      claims: 0,
      pending: false,
      refills: { day: dayIndex(now), watched: 0, bought: 0 },
    },
    deepestDepth: 0,
    ruinsCleared: {},
    landmarks: { claimed: {} },
    // No ruin has been seen yet, so nothing is counting (sim/gates.ts).
    gates: {},
    raidReports: [],
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

  // `fresh`: a kingdom created this instant did not live through a window
  // that is already open, so it is not paid for one.
  reconcileSchedule(state, now, { fresh: true });
  seedFog(state, map);

  if (!state.fog.revealed[coordKey(TOWNHALL_ORIGIN)]) {
    throw new Error('New game seed failed: Townhall cell not revealed');
  }
  return state;
}
