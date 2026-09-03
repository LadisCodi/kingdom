// The editor's working copy of the region map, plus undo.
//
// Everything derived — the MapData the game would build, the validation, the
// census — is recomputed from scratch whenever the document changes and then
// cached until the next edit. That sounds wasteful and is not: the region is
// a few hundred cells, so a full rebuild is well under a millisecond, and it
// buys the one property that matters here — the fog costs and warnings a
// designer is looking at are the REAL ones, derived by the same code the game
// runs, never an editor-side approximation that can drift.
//
// Undo is whole-document snapshots for the same reason. A command/diff stack
// would be the "proper" answer and would also be the thing quietly getting a
// case wrong; a 30 KB structuredClone per stroke is free at this size.

import { buildMapDataFrom, type MapData } from '../sim/grid';
import { revealCost } from '../sim/fog';
import { FEATURES } from '../sim/data/definitions';
import {
  validateRegionMap, type MapValidation, type RegionMapDoc,
} from '../sim/data/mapRules';
import { coordKey, type Coord, type FeatureId, type TerrainId } from '../sim/state';

export type LandmarkRow = RegionMapDoc['landmarks'][number];
export type RuinRow = RegionMapDoc['ruins'][string];

/** What the census counts, per distance ring. */
export interface RingRow {
  ring: number;
  cost: number;
  cells: number;
  features: Partial<Record<FeatureId, number>>;
}

export interface Census {
  terrain: Array<{ id: TerrainId; count: number }>;
  features: Array<{ id: FeatureId; count: number }>;
  rings: RingRow[];
  cells: number;
}

const MAX_UNDO = 200;

export class MapDoc {
  private doc: RegionMapDoc;
  private past: string[] = [];
  private future: string[] = [];
  private pending: string | null = null;
  private revision = 0;
  private derivedAt = -1;
  private cachedMap!: MapData;
  private cachedValidation!: MapValidation;
  private cachedCensus!: Census;
  /** The document as last written to disk, so "dirty" is a fact, not a flag. */
  private savedText: string;

  constructor(initial: RegionMapDoc) {
    this.doc = structuredClone(initial);
    this.savedText = JSON.stringify(this.doc);
  }

  // ------------------------------------------------------------- reading

  get terrainCells(): ReadonlyArray<{ x: number; y: number; id: string }> {
    return this.doc.terrain.cells;
  }

  get landmarks(): ReadonlyArray<LandmarkRow> { return this.doc.landmarks; }
  get ruins(): Readonly<Record<string, RuinRow>> { return this.doc.ruins; }

  terrainAt(cell: Coord): TerrainId | null {
    return this.map.terrain.get(coordKey(cell)) ?? null;
  }

  featureAt(cell: Coord): FeatureId | null {
    return this.map.initialFeatures.get(coordKey(cell)) ?? null;
  }

  /** BFS distance from the Townhall — the number the fog price comes from. */
  distanceAt(cell: Coord): number {
    return this.map.distanceFromTownhall.get(coordKey(cell)) ?? 0;
  }

  /** The Gold this cell would cost to reveal, at the authored ring prices. */
  costAt(cell: Coord): number {
    return revealCost(this.distanceAt(cell));
  }

  siteAt(cell: Coord): { kind: 'landmark' | 'ruin'; id: string } | null {
    return this.sitesOn(cell)[0] ?? null;
  }

  get map(): MapData { this.derive(); return this.cachedMap; }
  get validation(): MapValidation { this.derive(); return this.cachedValidation; }
  get census(): Census { this.derive(); return this.cachedCensus; }

  get dirty(): boolean { return JSON.stringify(this.doc) !== this.savedText; }
  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }

  toJSON(): RegionMapDoc { return structuredClone(this.doc); }

  markSaved(): void { this.savedText = JSON.stringify(this.doc); }

  // ------------------------------------------------------------- editing
  //
  // Every mutation runs inside a stroke. A drag is ONE undo step, not one per
  // cell it crossed — which is the difference between undo being useful and
  // being forty presses of ctrl+Z.

  /** Open an undo step. Nested calls join the open one. */
  begin(): void {
    this.pending ??= JSON.stringify(this.doc);
  }

  /** Close the step, keeping it only if something actually changed. */
  commit(): void {
    if (this.pending === null) return;
    const before = this.pending;
    this.pending = null;
    if (before === JSON.stringify(this.doc)) return;
    this.past.push(before);
    if (this.past.length > MAX_UNDO) this.past.shift();
    this.future.length = 0;
  }

  /** Do `edit` as one undo step. */
  stroke(edit: () => void): void {
    this.begin();
    edit();
    this.commit();
  }

  /** Like stroke(), for an edit that hands something back (a new id). */
  strokeResult<T>(edit: () => T): T {
    this.begin();
    const out = edit();
    this.commit();
    return out;
  }

  undo(): boolean {
    const snapshot = this.past.pop();
    if (snapshot === undefined) return false;
    this.future.push(JSON.stringify(this.doc));
    this.doc = JSON.parse(snapshot) as RegionMapDoc;
    this.revision += 1;
    return true;
  }

  redo(): boolean {
    const snapshot = this.future.pop();
    if (snapshot === undefined) return false;
    this.past.push(JSON.stringify(this.doc));
    this.doc = JSON.parse(snapshot) as RegionMapDoc;
    this.revision += 1;
    return true;
  }

  /** Paint terrain. A cell that did not exist is created — this is how the
   *  world grows, so there is no separate "resize the map" gesture. */
  setTerrain(cell: Coord, id: TerrainId): void {
    const existing = this.rawTerrainAt(cell);
    if (existing) {
      if (existing.id === id) return;
      existing.id = id;
    } else {
      this.doc.terrain.cells.push({ x: cell.x, y: cell.y, id });
    }
    this.revision += 1;
    // A feature that cannot live on the new terrain goes with it, rather than
    // becoming a validation error the designer has to go hunting for.
    const feature = this.rawFeatureAt(cell);
    if (feature && !featureFits(feature.id as FeatureId, id)) this.clearFeature(cell);
  }

  /** Erase a cell back to void, taking its feature and any site with it. */
  clearTerrain(cell: Coord): void {
    const i = this.doc.terrain.cells.findIndex((c) => c.x === cell.x && c.y === cell.y);
    if (i >= 0) { this.doc.terrain.cells.splice(i, 1); this.revision += 1; }
    this.clearFeature(cell);
    for (const site of this.sitesOn(cell)) {
      if (site.kind === 'landmark') this.removeLandmark(site.id);
      // A ruin cannot be deleted (RuinId is fixed in code), so erasing the
      // ground under one is refused rather than silently stranding it.
      else this.setTerrain(cell, 'Grassland');
    }
  }

  setFeature(cell: Coord, id: FeatureId): void {
    const terrain = this.rawTerrainAt(cell)?.id as TerrainId | undefined;
    if (!terrain || !featureFits(id, terrain)) return; // never author an error
    if (this.siteAt(cell)) return; // a site already owns the cell
    const existing = this.rawFeatureAt(cell);
    if (existing) {
      if (existing.id === id) return;
      existing.id = id;
    } else {
      this.doc.features.cells.push({ x: cell.x, y: cell.y, id });
    }
    this.revision += 1;
  }

  clearFeature(cell: Coord): void {
    const i = this.doc.features.cells.findIndex((c) => c.x === cell.x && c.y === cell.y);
    if (i >= 0) { this.doc.features.cells.splice(i, 1); this.revision += 1; }
  }

  // --------------------------------------------------------------- sites

  moveLandmark(id: string, cell: Coord): void {
    const l = this.doc.landmarks.find((x) => x.id === id);
    if (l) { l.x = cell.x; l.y = cell.y; this.revision += 1; }
  }

  moveRuin(id: string, cell: Coord): void {
    const r = this.doc.ruins[id];
    if (r) { r.x = cell.x; r.y = cell.y; this.revision += 1; }
  }

  updateLandmark(id: string, patch: Partial<LandmarkRow>): void {
    const i = this.doc.landmarks.findIndex((x) => x.id === id);
    if (i < 0) return;
    this.doc.landmarks[i] = { ...this.doc.landmarks[i], ...patch };
    this.revision += 1;
  }

  updateRuin(id: string, patch: Partial<RuinRow>): void {
    if (!this.doc.ruins[id]) return;
    this.doc.ruins[id] = { ...this.doc.ruins[id], ...patch };
    this.revision += 1;
  }

  addLandmark(cell: Coord): string {
    // Ids are stable references (saves key claims off them), so a new one is
    // generated to be unique and then renamed by hand in the inspector.
    let n = this.doc.landmarks.length + 1;
    let id = `NewShrine${n}`;
    while (this.doc.landmarks.some((l) => l.id === id)) id = `NewShrine${++n}`;
    this.doc.landmarks.push({
      id, kind: 'Shrine', x: cell.x, y: cell.y, defended: false, claimCost: 25000,
    });
    this.revision += 1;
    return id;
  }

  removeLandmark(id: string): void {
    const i = this.doc.landmarks.findIndex((l) => l.id === id);
    if (i >= 0) { this.doc.landmarks.splice(i, 1); this.revision += 1; }
  }

  /** Every site standing on a cell (validation forbids more than one, but the
   *  editor has to cope with the moment before the designer fixes it). */
  sitesOn(cell: Coord): Array<{ kind: 'landmark' | 'ruin'; id: string }> {
    const out: Array<{ kind: 'landmark' | 'ruin'; id: string }> = [];
    for (const l of this.doc.landmarks) {
      if (l.x === cell.x && l.y === cell.y) out.push({ kind: 'landmark', id: l.id });
    }
    for (const [id, r] of Object.entries(this.doc.ruins)) {
      if (r.x === cell.x && r.y === cell.y) out.push({ kind: 'ruin', id });
    }
    return out;
  }

  // ------------------------------------------------------------- derived

  // Mutators read through these rather than the derived MapData: painting a
  // drag would otherwise rebuild the whole region once per cell crossed.
  private rawTerrainAt(cell: Coord): { x: number; y: number; id: string } | undefined {
    return this.doc.terrain.cells.find((c) => c.x === cell.x && c.y === cell.y);
  }

  private rawFeatureAt(cell: Coord): { x: number; y: number; id: string } | undefined {
    return this.doc.features.cells.find((c) => c.x === cell.x && c.y === cell.y);
  }

  private derive(): void {
    if (this.derivedAt === this.revision) return;
    this.cachedMap = buildMapDataFrom(this.doc);
    this.cachedValidation = validateRegionMap(this.doc);
    this.cachedCensus = countUp(this.cachedMap);
    this.derivedAt = this.revision;
  }
}

/** A shoal belongs in water and nothing else does. Terrain is otherwise free:
 *  Trees on Plains is a legal, authored thing. */
export const featureFits = (feature: FeatureId, terrain: TerrainId): boolean =>
  (FEATURES[feature].respawnTerrain === 'Water') === (terrain === 'Water');

function countUp(map: MapData): Census {
  const terrain = new Map<TerrainId, number>();
  const features = new Map<FeatureId, number>();
  const rings = new Map<number, RingRow>();

  for (const [key, t] of map.terrain) {
    terrain.set(t, (terrain.get(t) ?? 0) + 1);
    const d = map.distanceFromTownhall.get(key) ?? 0;
    let row = rings.get(d);
    if (!row) {
      row = { ring: d, cost: revealCost(d), cells: 0, features: {} };
      rings.set(d, row);
    }
    row.cells += 1;
    const f = map.initialFeatures.get(key);
    if (f !== undefined) {
      features.set(f, (features.get(f) ?? 0) + 1);
      row.features[f] = (row.features[f] ?? 0) + 1;
    }
  }

  return {
    cells: map.terrain.size,
    terrain: [...terrain].map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count),
    features: [...features].map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count),
    rings: [...rings.values()].sort((a, b) => a.ring - b.ring),
  };
}
