// Initial game state: Oakville with its Townhall at (0,0), starting wallets,
// fog seed, authored map features.

import { CITY_DEF, CURRENCIES, KINGDOM_DEF } from './data/definitions';
import { dayIndex } from './day';
import { seedFog } from './fog';
import { manaCap } from './mana';
import { reconcileSchedule } from './timeline';
import { newSeed } from './rng';
import { TOWNHALL_ORIGIN, type MapData } from './grid';
import { coordKey, type CurrencyId, type GameState, type Wallet } from './state';
import { freshWorld } from './world/explorers';

export function newGame(map: MapData, now: number): GameState {
  const kingdomWallet: Wallet = {};
  const playerWallet: Wallet = {};
  for (const [id, def] of Object.entries(CURRENCIES)) {
    if (def.scope === 'kingdom') kingdomWallet[id as CurrencyId] = def.start;
    if (def.scope === 'player') playerWallet[id as CurrencyId] = def.start;
  }

  const seed = newSeed();
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
      wounded: {},
      lastManaAt: now,
    },
    kingdom: {
      builders: KINGDOM_DEF.startBuilders,
      wallet: kingdomWallet,
      survey: { claimedFree: [], claimedPaid: [], owned: false },
      lastKnowledgeAt: now,
      knowledgeBoughtWithGold: 0,
      utcOffsetMinutes: 0,
    },
    player: { wallet: playerWallet, payer: null },
    fog: { revealed: {}, discovered: {}, progress: {}, paidReveals: 0, treasuresPlaced: 0, treasures: {} },
    features: {},
    featureMeta: {},
    featureRespawns: [],
    harvest: {},
    workers: [],
    army: [],
    // Nothing is researched, and nothing is granted. Civics is open from the
    // first minute; every other book opens on a fact about the world
    // (sim/research.ts `TOME_OPENS`), and the era bars pace each page.
    research: { completed: [], poured: {}, rewarded: [] },
    schedule: [],
    // No hero yet. The first comes from the first call on the banner, free
    // once a Tavern stands (Docs/features/10-heroes.md §6.2); until then the
    // lairs are fought by soldiers alone.
    heroes: {
      owned: [], levels: {}, tiers: {},
      // One hero slot is free; the second and third are Gems, always
      // (Docs/features/10-heroes.md §3).
      heroSlotsPurchased: 0,
      hurt: {},
      fragments: {},
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
    landmarks: { claimed: {} },
    // No lair has been seen yet, so nothing is counting (sim/lairs.ts).
    lairs: {},
    artifacts: { levels: {}, casts: {}, charges: {} },
    modifiers: [],
    quests: { index: 0, progress: 0 },
    tallies: {},
    replaying: false,
    discoveries: {},
    // A new kingdom meets every door shut and every scene unplayed.
    tutorial: { veteran: false, seen: {}, startedAt: now },
    abandoned: { repaired: {} },
    bag: { held: {}, fresh: {}, badge: 0 },
    relics: { held: {}, chests: 0, premiumShrines: 0 },
    signals: { sightedAt: {}, discoveredAt: {}, treasureWaitMs: 0, returnTaps: [], playMs: 0 },
    pendingDiscoveries: [],
    pendingAnalytics: [],
    // The world board and seat are derived from the kingdom's own seed until
    // a server assigns them (sim/world/explorers.ts).
    world: freshWorld(seed),
    seed,
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
    ordinal: 1,
    level: 1,
    assignedWorkers: 0,
    location: TOWNHALL_ORIGIN,
    state: 'Built',
    visualVariant: 1,
  });

  // A new kingdom starts with a FULL pool, not an empty one. Mana is what
  // every tap on the ground is paid from, so an empty pool at minute zero would gate
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
