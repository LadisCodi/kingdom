// Initial game state: Oakville with its Townhall at (0,0), starting wallets,
// fog seed, spellbook, initial map features (Docs/01, 03, 10).

import { CITY_DEF, CURRENCIES, KINGDOM_DEF, SPELLS, DISTRICTS } from './data/definitions';
import { makeGenerator } from './economy';
import { seedFog } from './fog';
import { TOWNHALL_ORIGIN, type MapData } from './grid';
import { recalculateCityProduction } from './recalc';
import {
  coordKey, type CurrencyId, type GameState, type Rng, type Wallet,
} from './state';

export function newGame(map: MapData, now: number, rng: Rng): GameState {
  const kingdomWallet: Wallet = {};
  const playerWallet: Wallet = {};
  for (const [id, def] of Object.entries(CURRENCIES)) {
    if (def.scope === 'kingdom') kingdomWallet[id as CurrencyId] = def.start;
    if (def.scope === 'player') playerWallet[id as CurrencyId] = def.start;
  }

  const state: GameState = {
    city: {
      name: CITY_DEF.name,
      wallet: { ...CITY_DEF.initialCurrencies },
      population: CITY_DEF.initialPopulation,
      districts: [],
      queue: [],
    },
    kingdom: {
      maxBuilders: KINGDOM_DEF.startBuilders,
      wallet: kingdomWallet,
      generators: [],
    },
    player: { wallet: playerWallet },
    spellbook: {},
    activeSpells: [],
    fog: { revealed: {}, progress: {} },
    features: {},
    army: [],
    nextId: 1,
  };

  // Kingdom generators from {currencyId, perHour} entries (Mana 300/h = 5/min).
  for (const p of KINGDOM_DEF.production) {
    const gen = makeGenerator(`kingdom_${p.currencyId}`, p.currencyId, 0, now, rng);
    gen.modifiers.push({
      category: 'Building', source: 'kingdom', kind: 'Flat', value: p.perHour / 60,
    });
    state.kingdom.generators.push(gen);
  }

  // Spellbook: one runtime spell per definition; unlock those flagged from start.
  for (const def of Object.values(SPELLS)) {
    state.spellbook[def.id] = { unlocked: def.unlockedFromStart, level: 1 };
  }

  // Initial features from the authored map (dynamic afterwards: Trees ↔ TreesCut).
  for (const [key, featureId] of map.initialFeatures) {
    state.features[key] = { featureId, taps: 0, threshold: 0 };
  }

  // The Townhall, pre-built at the origin.
  state.city.districts.push({
    uniqueId: `district_Townhall_${state.nextId++}`,
    definitionId: 'Townhall',
    level: 1,
    assignedWorkers: 0,
    location: TOWNHALL_ORIGIN,
    state: 'Built',
    visualVariant: 1,
    generators: [
      makeGenerator(`townhall_Silver`, 'Silver', DISTRICTS.Townhall.vaultCapacity, now, rng),
    ],
  });

  seedFog(state, map);
  recalculateCityProduction(state, map, now, rng);

  // Sanity: the Townhall cell must be revealed grassland per the authored map.
  if (!state.fog.revealed[coordKey(TOWNHALL_ORIGIN)]) {
    throw new Error('New game seed failed: Townhall cell not revealed');
  }
  return state;
}
