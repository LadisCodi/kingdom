// Core simulation state types. This module (and everything under src/sim/) is
// pure TypeScript: no DOM, no Date.now() — callers pass `now` (epoch ms) and an
// injectable rng so the sim stays deterministic and portable to a server.
// (The DISTRICTS import is safe: definitions.ts only imports types from here.)

import { DISTRICTS } from './data/definitions';

export type CurrencyId =
  | 'Gold' | 'Food' | 'Wood' | 'Knowledge' | 'Gems'
  | 'Berries' | 'Meat'; // food-valued (see CurrencyDef.countsAs)
export type DistrictId = 'Townhall' | 'Housing' | 'Farm' | 'FarmLands' | 'Sawmill';
export type TerrainId = 'Grassland' | 'Plains' | 'Desert' | 'Snow' | 'Tundra' | 'Water';
export type FeatureId = 'Trees' | 'BerryBush' | 'WildAnimals';
export type HarvestSourceId = 'Forest' | 'Crops' | 'Berries' | 'Meat';
export type UnitId = 'Archer' | 'Swordsman' | 'Cavalry';
export type TechId = 'Agriculture' | 'Irrigation' | 'Forestry' | 'Archery' | 'CavalryTraining';
export type UpgradeId = 'TapPower' | 'QuickHands' | 'WorkerLoad' | 'MarketStall' | 'TradeRoutes';

export interface Coord { x: number; y: number }
export const coordKey = (c: Coord): string => `${c.x},${c.y}`;
export const parseCoordKey = (k: string): Coord => {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
};
export const sameCell = (a: Coord, b: Coord): boolean => a.x === b.x && a.y === b.y;

export type Wallet = Partial<Record<CurrencyId, number>>;

export type ConstructionState = 'UnderConstruction' | 'Built';

export interface District {
  uniqueId: string;
  definitionId: DistrictId;
  level: number;
  assignedWorkers: number;
  location: Coord;
  state: ConstructionState;
  visualVariant: number;
}

export interface QueueItem {
  uniqueId: string;
  kind: 'build' | 'upgrade';
  districtUniqueId: string;
  targetLevel?: number; // upgrades only
  durationSeconds: number;
  startedAt: number | null; // epoch ms; null until it enters the active window
}

export const completesAt = (item: QueueItem): number =>
  (item.startedAt ?? Infinity) + item.durationSeconds * 1000;
export const remainingSeconds = (item: QueueItem, now: number): number =>
  item.startedAt === null ? item.durationSeconds : Math.max(0, (completesAt(item) - now) / 1000);
export const queueProgress = (item: QueueItem, now: number): number =>
  item.startedAt === null || item.durationSeconds === 0
    ? (item.startedAt === null ? 0 : 1)
    : Math.min(1, Math.max(0, (now - item.startedAt) / (item.durationSeconds * 1000)));

export interface City {
  name: string;
  wallet: Wallet;
  population: number;
  districts: District[];
  queue: QueueItem[];
  /** Villager in training at the Townhall (one at a time); null = idle. */
  training: { startedAt: number } | null;
}

/** Per-resource-cell harvest state. Absent entry = fresh cell (0 taps). */
export interface CellHarvestState {
  taps: number;
  exhaustedUntil: number | null; // epoch ms; recovery is lazy (derived from time)
}

export type WorkerActivity = 'Idle' | 'MovingToCell' | 'Working' | 'MovingHome';

export interface Worker {
  id: string;
  buildingId: string; // district uniqueId
  activity: WorkerActivity;
  claimedCell: Coord | null;
  carrying: boolean; // true on the way home with a harvested unit
  stateStartedAt: number; // epoch ms — for render interpolation
  stateUntil: number | null; // event time; null while Idle
}

export interface ArmyUnit {
  uniqueId: string;
  definitionId: UnitId;
}

export interface GameState {
  city: City;
  kingdom: {
    maxBuilders: number;
    wallet: Wallet;
  };
  player: { wallet: Wallet };
  fog: {
    revealed: Record<string, true>; // coordKey → revealed
    /** coordKey → discovered by a building's discover radius. (Cells adjacent
     *  to a revealed cell are ALSO Discovered — that part stays derived.) */
    discovered: Record<string, true>;
    progress: Record<string, number>; // coordKey → gold paid so far
  };
  features: Record<string, FeatureId>; // coordKey → authored feature (static)
  harvest: Record<string, CellHarvestState>; // coordKey → taps/exhaustion
  workers: Worker[];
  army: ArmyUnit[];
  research: {
    completed: TechId[];
    /** Technologies in progress — length is capped by techSlots(). */
    active: Array<{ id: TechId; startedAt: number }>;
    /** Extra concurrent slots bought with Gems (escalating price). */
    slotsPurchased: number;
  };
  /** Upgrade levels (instant, gold-bought); absent = level 0. */
  upgrades: Partial<Record<UpgradeId, number>>;
  /** The Market's sell queue: units drip-sell for Gold, one per interval. */
  market: {
    queue: Wallet; // units up for sale (escrowed out of the city wallet)
    lastSaleAt: number; // epoch ms anchor; advances only by time paid out
  };
  nextId: number; // monotonic counter for unique ids
  lastAdvance: number; // epoch ms — where the unified advance left off
  /** Epoch ms of the last successful player collect tap (cooldown anchor).
   *  Transient — not persisted; resets on load. */
  lastCollectTapAt: number;
}

export type Rng = () => number; // [0, 1)

export const newId = (state: GameState, prefix: string): string => `${prefix}_${state.nextId++}`;

export const getWallet = (w: Wallet, c: CurrencyId): number => w[c] ?? 0;
export const addToWallet = (w: Wallet, c: CurrencyId, amount: number): void => {
  w[c] = getWallet(w, c) + amount;
};

// ------------------------------------------------------------- footprints

/** The cells of a size.x × size.y rectangle anchored (top-left) at `anchor`. */
export function cellsOfRect(anchor: Coord, size: { x: number; y: number }): Coord[] {
  const out: Coord[] = [];
  for (let dy = 0; dy < size.y; dy++) {
    for (let dx = 0; dx < size.x; dx++) out.push({ x: anchor.x + dx, y: anchor.y + dy });
  }
  return out;
}

export const districtSize = (d: District): { x: number; y: number } =>
  DISTRICTS[d.definitionId].size;

/** All cells a district occupies (location = top-left anchor). */
export const districtCells = (d: District): Coord[] => cellsOfRect(d.location, districtSize(d));

export const districtOccupies = (d: District, cell: Coord): boolean => {
  const size = districtSize(d);
  return (
    cell.x >= d.location.x && cell.x < d.location.x + size.x &&
    cell.y >= d.location.y && cell.y < d.location.y + size.y
  );
};

export const districtAt = (state: GameState, cell: Coord): District | undefined =>
  state.city.districts.find((d) => districtOccupies(d, cell));

export const districtById = (state: GameState, uniqueId: string): District | undefined =>
  state.city.districts.find((d) => d.uniqueId === uniqueId);

export const townhall = (state: GameState): District =>
  state.city.districts.find((d) => d.definitionId === 'Townhall')!;
