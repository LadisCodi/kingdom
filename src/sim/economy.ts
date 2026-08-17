// Generator model, rate formula, and the per-second accrual algorithm (Docs/03).

import { CURRENCIES } from './data/definitions';
import {
  addToWallet, getWallet,
  type CurrencyId, type Generator, type GameState, type Rng, type Wallet,
} from './state';

/** flat = Σ Flat (clamped ≥ 0); rate = flat × (1 + Σ Percentage), per minute. */
export function generationPerMinute(gen: Generator): number {
  let flat = 0;
  let pct = 0;
  for (const m of gen.modifiers) {
    if (m.kind === 'Flat') flat += m.value;
    else pct += m.value;
  }
  if (flat < 0) flat = 0;
  return flat * (1 + pct);
}

export function makeGenerator(
  id: string,
  currencyId: CurrencyId,
  vaultCapacity: number,
  now: number,
  rng: Rng,
): Generator {
  return {
    id,
    currencyId,
    modifiers: [],
    // Stagger whole-unit payouts across districts (as built: now − random(0..60s)).
    lastProduction: now - Math.floor(rng() * 60_000),
    vaultStored: 0,
    vaultCapacity,
  };
}

const walletCapReached = (wallet: Wallet, currencyId: CurrencyId): boolean => {
  const cap = CURRENCIES[currencyId].cap;
  return cap !== null && getWallet(wallet, currencyId) >= cap;
};

/**
 * Accrue one generator against its destination wallet. Follows Docs/03 exactly:
 * whole units only, timestamp advanced only by the time paid out, overflow on a
 * full destination deliberately lost (resets the timestamp).
 */
export function accrueGenerator(gen: Generator, wallet: Wallet, now: number): number {
  const rate = generationPerMinute(gen);
  if (rate === 0) {
    gen.lastProduction = now; // no backlog builds up
    return 0;
  }
  const hasVault = gen.vaultCapacity > 0;
  const destinationFull = hasVault
    ? gen.vaultStored >= gen.vaultCapacity
    : walletCapReached(wallet, gen.currencyId);
  if (destinationFull) {
    gen.lastProduction = now; // overflow is LOST, deliberately
    return 0;
  }
  const minutes = (now - gen.lastProduction) / 60_000;
  const produced = Math.trunc(rate * minutes);
  if (produced <= 0) return 0; // keep the sub-unit remainder (timestamp untouched)
  gen.lastProduction += (produced / rate) * 60_000;
  if (hasVault) {
    gen.vaultStored = Math.min(gen.vaultCapacity, gen.vaultStored + produced);
  } else {
    const cap = CURRENCIES[gen.currencyId].cap;
    let credited = produced;
    if (cap !== null) credited = Math.min(credited, cap - getWallet(wallet, gen.currencyId));
    addToWallet(wallet, gen.currencyId, credited);
  }
  return produced;
}

/** Deposited amounts by currency, for UI feedback. */
export type ProductionReport = Partial<Record<CurrencyId, number>>;

/** Accrue every active district generator + kingdom generators. Runs once per second. */
export function accrueAll(state: GameState, now: number): Map<string, ProductionReport> {
  const reports = new Map<string, ProductionReport>();
  for (const district of state.city.districts) {
    if (district.state !== 'Built') continue;
    for (const gen of district.generators) {
      const produced = accrueGenerator(gen, state.city.wallet, now);
      if (produced > 0 && gen.vaultCapacity === 0) {
        const r = reports.get(district.uniqueId) ?? {};
        r[gen.currencyId] = (r[gen.currencyId] ?? 0) + produced;
        reports.set(district.uniqueId, r);
      }
    }
  }
  for (const gen of state.kingdom.generators) {
    accrueGenerator(gen, state.kingdom.wallet, now);
  }
  return reports;
}

/** Clicker-style collection: one tap banks 1 unit of each stored currency. */
export function collectFromDistrict(state: GameState, districtUniqueId: string): ProductionReport {
  const district = state.city.districts.find((d) => d.uniqueId === districtUniqueId);
  const collected: ProductionReport = {};
  if (!district || district.state !== 'Built') return collected;
  for (const gen of district.generators) {
    if (gen.vaultCapacity > 0 && gen.vaultStored >= 1) {
      gen.vaultStored -= 1;
      addToWallet(state.city.wallet, gen.currencyId, 1);
      collected[gen.currencyId] = 1;
    }
  }
  return collected;
}

/** Vault fill fraction across a district's vaulted generators (drives the vault bar). */
export function vaultFillFraction(generators: Generator[]): number {
  let stored = 0;
  let capacity = 0;
  for (const g of generators) {
    if (g.vaultCapacity > 0) {
      stored += g.vaultStored;
      capacity += g.vaultCapacity;
    }
  }
  return capacity === 0 ? 0 : stored / capacity;
}
