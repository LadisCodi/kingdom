// Production recalculation: rebuilds every active district's modifiers from
// definitions + map + workers. Spell modifiers are preserved (a recalc never
// cancels Rain). Docs/03 "Where the rates come from".

import { DISTRICTS, levelIndexed } from './data/definitions';
import { makeGenerator } from './economy';
import type { MapData } from './grid';
import {
  type CurrencyId, type District, type GameState, type Rng, type Wallet,
} from './state';
import { workedUnitCells, worksUnits } from './workedUnits';

const levelAmount = (base: number, perLevel: number, level: number): number =>
  Math.floor(base * (1 + perLevel * (level - 1)));

function ensureGenerator(
  district: District,
  currencyId: CurrencyId,
  vaultCapacity: number,
  now: number,
  rng: Rng,
) {
  let gen = district.generators.find((g) => g.currencyId === currencyId);
  if (!gen) {
    gen = makeGenerator(`${district.uniqueId}_${currencyId}`, currencyId, vaultCapacity, now, rng);
    district.generators.push(gen);
  }
  return gen;
}

export function recalculateCityProduction(
  state: GameState,
  map: MapData,
  now: number,
  rng: Rng,
): void {
  for (const district of state.city.districts) {
    if (district.state !== 'Built') continue;
    const def = DISTRICTS[district.definitionId];

    // Remove all owned Terrain/Feature/Building/Population modifiers; keep Spell.
    for (const gen of district.generators) {
      gen.modifiers = gen.modifiers.filter((m) => m.category === 'Spell');
    }

    const works = worksUnits(district.definitionId);
    const workers = district.assignedWorkers;
    const usesWorkers = def.maxWorkersPerLevel.length > 0;

    // Base generation, level-scaled.
    for (const [currencyId, baseAmount] of Object.entries(def.baseGeneration) as [
      CurrencyId, number,
    ][]) {
      const amount = levelAmount(baseAmount, def.baseGenerationPerLevel, district.level);
      let value: number;
      if (works) value = workers >= 1 ? amount : 0; // needs one staffer
      else if (usesWorkers) value = amount * workers; // scales per worker
      else value = amount; // unconditional
      const gen = ensureGenerator(district, currencyId, def.vaultCapacity, now, rng);
      gen.modifiers.push({ category: 'Building', source: district.uniqueId, kind: 'Flat', value });
    }

    // Worked units: worker #1 staffs the base; each extra works one unit.
    if (works) {
      const workedUnits = workedUnitCells(state, map, district).length;
      const tileWorkers = Math.min(workedUnits, Math.max(0, workers - 1));
      for (const [currencyId, perTile] of Object.entries(def.yieldPerWorkedTile) as [
        CurrencyId, number,
      ][]) {
        const amount =
          levelAmount(perTile, def.baseGenerationPerLevel, district.level) * tileWorkers;
        const gen = ensureGenerator(district, currencyId, def.vaultCapacity, now, rng);
        gen.modifiers.push({
          category: 'Feature', source: district.uniqueId, kind: 'Flat', value: amount,
        });
      }
    }

    // Population tax (the Townhall: 5 Silver/min per population point).
    if (def.silverPerPopulation > 0) {
      const gen = ensureGenerator(district, 'Silver', def.vaultCapacity, now, rng);
      gen.modifiers.push({
        category: 'Population',
        source: district.uniqueId,
        kind: 'Flat',
        value: def.silverPerPopulation * state.city.population,
      });
    }
  }
}

/** Current per-minute production of a built district, by currency (for UI stat rows). */
export function districtProductionPerMinute(district: District): Wallet {
  const out: Wallet = {};
  for (const gen of district.generators) {
    let flat = 0;
    let pct = 0;
    for (const m of gen.modifiers) {
      if (m.kind === 'Flat') flat += m.value;
      else pct += m.value;
    }
    if (flat < 0) flat = 0;
    const rate = flat * (1 + pct);
    if (rate > 0) out[gen.currencyId] = rate;
  }
  return out;
}

/** Max population = Σ PopulationCapacityForLevel over active (Built) districts. */
export function maxPopulation(state: GameState): number {
  let total = 0;
  for (const d of state.city.districts) {
    if (d.state !== 'Built') continue;
    total += DISTRICTS[d.definitionId].populationCapacity;
  }
  return total;
}

/** AvailableWorkers = Population − Σ AssignedWorkers. */
export function availableWorkers(state: GameState): number {
  let assigned = 0;
  for (const d of state.city.districts) assigned += d.assignedWorkers;
  return state.city.population - assigned;
}

// Re-export for convenience where recalc callers need it.
export { levelIndexed };
