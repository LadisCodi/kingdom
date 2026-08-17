// Core simulation state types. This module (and everything under src/sim/) is
// pure TypeScript: no DOM, no Date.now() — callers pass `now` (epoch ms) and an
// injectable rng so the sim stays deterministic and portable to a server.

export type CurrencyId = 'Food' | 'Silver' | 'Wood' | 'Gold' | 'Mana' | 'Knowledge' | 'Gems';
export type DistrictId = 'Townhall' | 'Housing' | 'Farm' | 'FarmLands' | 'Lumber';
export type TerrainId = 'Grassland' | 'Plains' | 'Desert' | 'Snow' | 'Tundra' | 'Water';
export type FeatureId = 'Trees' | 'TreesCut';
export type UnitId = 'Archer' | 'Swordsman' | 'Cavalry';
export type SpellId = 'Rain' | 'Tap';

export interface Coord { x: number; y: number }
export const coordKey = (c: Coord): string => `${c.x},${c.y}`;
export const parseCoordKey = (k: string): Coord => {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
};

export type Wallet = Partial<Record<CurrencyId, number>>;

export type ModifierCategory = 'Building' | 'Feature' | 'Population' | 'Spell' | 'Terrain';
export interface Modifier {
  category: ModifierCategory;
  source: string;
  kind: 'Flat' | 'Percentage';
  value: number; // Flat: units/min; Percentage: fraction added
}

export interface Generator {
  id: string; // `${districtUniqueId}_${currencyId}` (or kingdom id)
  currencyId: CurrencyId;
  modifiers: Modifier[];
  lastProduction: number; // epoch ms UTC
  vaultStored: number;
  vaultCapacity: number; // 0 = wallet-direct
}

export type ConstructionState = 'UnderConstruction' | 'Built';

export interface District {
  uniqueId: string;
  definitionId: DistrictId;
  level: number;
  assignedWorkers: number;
  location: Coord;
  state: ConstructionState;
  visualVariant: number;
  generators: Generator[];
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

export interface FeatureCell {
  featureId: FeatureId;
  taps: number;
  threshold: number; // 0 = not rolled yet; rolled on first tap
}

export interface ActiveSpell {
  spellId: SpellId;
  cell: Coord;
  level: number;
  magnitude: number;
  expiresAt: number; // epoch ms
  sourceId: string; // modifier source for removal
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
    generators: Generator[];
  };
  player: { wallet: Wallet };
  spellbook: Record<string, { unlocked: boolean; level: number }>;
  activeSpells: ActiveSpell[];
  fog: {
    revealed: Record<string, true>; // coordKey → revealed
    progress: Record<string, number>; // coordKey → silver paid so far
  };
  features: Record<string, FeatureCell>; // coordKey → current feature (dynamic: Trees ↔ TreesCut)
  army: ArmyUnit[];
  nextId: number; // monotonic counter for unique ids
}

export type Rng = () => number; // [0, 1)

export const newId = (state: GameState, prefix: string): string => `${prefix}_${state.nextId++}`;

export const getWallet = (w: Wallet, c: CurrencyId): number => w[c] ?? 0;
export const addToWallet = (w: Wallet, c: CurrencyId, amount: number): void => {
  w[c] = getWallet(w, c) + amount;
};

export const districtAt = (state: GameState, cell: Coord): District | undefined =>
  state.city.districts.find((d) => d.location.x === cell.x && d.location.y === cell.y);

export const townhall = (state: GameState): District =>
  state.city.districts.find((d) => d.definitionId === 'Townhall')!;
