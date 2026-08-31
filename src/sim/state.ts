// Core simulation state types. This module (and everything under src/sim/) is
// pure TypeScript: no DOM, no Date.now() — callers pass `now` (epoch ms) and an
// injectable rng so the sim stays deterministic and portable to a server.
// (The DISTRICTS import is safe: definitions.ts only imports types from here.)

import { DISTRICTS } from './data/definitions';

export type CurrencyId = 'Food' | 'Silver' | 'Wood' | 'Gold' | 'Mana' | 'Knowledge' | 'Gems';
export type DistrictId = 'Townhall' | 'Housing' | 'Farm' | 'FarmLands' | 'Sawmill';
export type TerrainId = 'Grassland' | 'Plains' | 'Desert' | 'Snow' | 'Tundra' | 'Water';
export type FeatureId = 'Trees';
export type HarvestSourceId = 'Forest' | 'Crops';
export type UnitId = 'Archer' | 'Swordsman' | 'Cavalry';
export type SpellId = 'Rain' | 'Tap';
export type ResearchId = 'Agriculture';

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
  /** Townhall only: start of the current tax cycle (epoch ms). */
  cycleStartedAt?: number;
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

export interface ActiveSpell {
  spellId: SpellId;
  cell: Coord;
  level: number;
  magnitude: number;
  expiresAt: number; // epoch ms
  sourceId: string;
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
    manaLastProduction: number; // epoch ms — the 5/min trickle's timestamp
  };
  player: { wallet: Wallet };
  spellbook: Record<string, { unlocked: boolean; level: number }>;
  activeSpells: ActiveSpell[];
  fog: {
    revealed: Record<string, true>; // coordKey → revealed
    progress: Record<string, number>; // coordKey → silver paid so far
  };
  features: Record<string, FeatureId>; // coordKey → authored feature (static)
  harvest: Record<string, CellHarvestState>; // coordKey → taps/exhaustion
  workers: Worker[];
  army: ArmyUnit[];
  research: {
    completed: ResearchId[];
    active: { id: ResearchId; startedAt: number } | null; // one at a time
  };
  nextId: number; // monotonic counter for unique ids
  lastAdvance: number; // epoch ms — where the unified advance left off
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
