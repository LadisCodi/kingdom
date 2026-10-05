// What the game's data IS, and what a legal document of it looks like — in
// ONE place, the way `mapRules.ts` and `techTreeRules.ts` are for the map and
// the tree.
//
// `?dev=data` (src/editor/data/) is the tool that will replace the balance
// workbook. This module is its DOM-free half: the registry of COLLECTIONS
// (every top-level key of the data, grouped the way a designer looks for it),
// the SCHEMA of each (`schema/<collection>.json` — types, refs, enums,
// ranges, per-level lengths), the VALIDATOR, and how a collection file is
// FORMATTED. The editor, the save endpoint (scripts/vite-data-editor.mjs) and
// `tests/dataRules.test.ts` read the same functions.
//
// The data itself is one file per collection in `game/`, put back together
// in the shape the sim reads by `balance.ts`. Nothing in the sim imports this
// module.

import techTree from './tech-tree.json';
import regionMap from './region-map.json';
import { OUTER_SITE_ROOM, PLACED_SITES, WORLD_DISTRICTS, WORLD_FEATURES, WORLD_TERRAINS, WORLD_UPGRADES } from '../world/types';
import { CHARACTERS } from '../../render/characters/atlas.generated';

// ------------------------------------------------------------ the registry

/** How a collection is laid out in the tool. */
export type ViewKind = 'entity' | 'table' | 'ordered' | 'form' | 'canvas';

/** The game domains the rail groups collections by — never by data shape. */
export const DOMAINS = ['World', 'City', 'Research', 'Army', 'Magic', 'Progression', 'Store'] as const;
export type DomainId = typeof DOMAINS[number];

export interface CollectionDef {
  id: string;
  label: string;
  domain: DomainId;
  view: ViewKind;
  /** What one entry is called: "building", "quest". */
  noun: string;
  /** entity / table / ordered: the top-level key holding the entries. */
  source?: string;
  /** form: the top-level keys it shows, one group each (a bare number is a
   *  group of one). */
  groups?: string[];
  /** canvas: the file its own editor writes, through its own endpoint. */
  file?: string;
}

export const COLLECTIONS: readonly CollectionDef[] = [
  { id: 'map', label: 'Region map', domain: 'World', view: 'canvas', noun: 'cell', file: 'src/sim/data/region-map.json' },
  { id: 'terrain', label: 'Terrain', domain: 'World', view: 'table', noun: 'terrain', source: 'terrain' },
  { id: 'harvest', label: 'Harvest', domain: 'World', view: 'table', noun: 'source', source: 'harvest' },
  { id: 'garrisons', label: 'Garrisons', domain: 'World', view: 'table', noun: 'garrison', source: 'garrisons' },
  { id: 'exploration', label: 'Exploration', domain: 'World', view: 'form', noun: 'setting', groups: ['fog', 'treasure', 'knowledge', 'raid', 'delve'] },
  // The shared hex board (Docs/features/19-world-map.md): marches, explorers
  // and how a board is rolled.
  { id: 'world', label: 'World board', domain: 'World', view: 'form', noun: 'setting', groups: ['world', 'worldGen', 'worldBuild', 'worldBots', 'worldDungeon', 'worldPortal', 'worldTravel'] },

  { id: 'buildings', label: 'Buildings', domain: 'City', view: 'entity', noun: 'building', source: 'districts' },
  { id: 'goods', label: 'Goods', domain: 'City', view: 'table', noun: 'good', source: 'goods' },
  { id: 'adjacency', label: 'Adjacency', domain: 'City', view: 'table', noun: 'rule', source: 'adjacency' },
  { id: 'economy', label: 'Economy', domain: 'City', view: 'form', noun: 'setting',
    groups: ['tap', 'storage', 'taxes', 'mana', 'city', 'kingdom', 'harmony', 'worker', 'training', 'rush'] },

  { id: 'tree', label: 'Tech tree', domain: 'Research', view: 'canvas', noun: 'technology', file: 'src/sim/data/tech-tree.json' },

  { id: 'units', label: 'Units', domain: 'Army', view: 'table', noun: 'unit', source: 'units' },
  { id: 'heroes', label: 'Heroes', domain: 'Army', view: 'table', noun: 'hero', source: 'heroes' },
  { id: 'villains', label: 'Villains', domain: 'Army', view: 'table', noun: 'villain', source: 'villains' },
  { id: 'combat', label: 'Combat', domain: 'Army', view: 'form', noun: 'setting', groups: ['army', 'combat', 'party'] },

  { id: 'artifacts', label: 'Artifacts', domain: 'Magic', view: 'table', noun: 'artifact', source: 'artifacts' },
  { id: 'currencies', label: 'Currencies', domain: 'Magic', view: 'table', noun: 'currency', source: 'currencies' },
  { id: 'relics', label: 'Relic rules', domain: 'Magic', view: 'form', noun: 'setting',
    groups: ['artifactCooldownSeconds', 'artifactAutoTapPerSecond', 'artifactRadiusSteps'] },

  { id: 'quests', label: 'Quests', domain: 'Progression', view: 'ordered', noun: 'quest', source: 'quests' },
  { id: 'pass', label: 'Season pass', domain: 'Progression', view: 'form', noun: 'setting', groups: ['pass'] },
  { id: 'survey', label: 'The Survey', domain: 'Progression', view: 'form', noun: 'setting', groups: ['survey'] },
  { id: 'missions', label: 'Missions', domain: 'Progression', view: 'form', noun: 'setting', groups: ['missions'] },
  { id: 'collection', label: 'Card collection', domain: 'Progression', view: 'form', noun: 'setting', groups: ['collection'] },
  // The first-time experience (Docs/features/23-tutorials.md, 24-dialogue.md):
  // list order is the order scenes are considered in, as the quest chain's is.
  { id: 'scenes', label: 'Scenes', domain: 'Progression', view: 'ordered', noun: 'scene', source: 'scenes' },
  { id: 'speakers', label: 'Speakers', domain: 'Progression', view: 'table', noun: 'speaker', source: 'speakers' },
  { id: 'tutorial', label: 'Tutorial help', domain: 'Progression', view: 'form', noun: 'setting', groups: ['help'] },
  // The splash a big unlock opens with (Docs/features/23-tutorials.md §4.6):
  // when two open at once, list order is the order they are shown in.
  { id: 'unlocks', label: 'Unlock splashes', domain: 'Progression', view: 'table', noun: 'unlock', source: 'unlocks' },

  { id: 'store', label: 'Store', domain: 'Store', view: 'table', noun: 'product', source: 'store' },
  { id: 'packs', label: 'Card packs', domain: 'Store', view: 'table', noun: 'pack', source: 'packs' },
  { id: 'banners', label: 'Banners', domain: 'Store', view: 'table', noun: 'banner', source: 'banners' },
  { id: 'monetization', label: 'Ads & payers', domain: 'Store', view: 'form', noun: 'setting', groups: ['ads', 'payer'] },
];

export const collectionById = (id: string): CollectionDef | undefined =>
  COLLECTIONS.find((c) => c.id === id);

/** Top-level keys that are not game data. */
export const IGNORED_KEYS = ['_note'];

// ---------------------------------------------------------------- the schema

export type FieldType = 'int' | 'float' | 'text' | 'bool' | 'list' | 'map' | 'object' | 'unknown';

/** What an id-valued field may name. */
export type RefKind =
  | 'building' | 'good' | 'currency' | 'unit' | 'hero' | 'villain' | 'pack' | 'artifact'
  | 'harvest' | 'terrain' | 'store' | 'banner' | 'tech' | 'feature' | 'lair' | 'face'
  /** What a building turns out: a unit, or the Villager. */
  | 'trainable'
  /** A character in the animated atlas (Docs/art/characters). */
  | 'character'
  /** A kind of landmark — Shrine, Watchtower… (sim/state.ts LandmarkKind). */
  | 'landmarkKind'
  /** Someone who speaks on the stage (`speakers`). */
  | 'speaker'
  /** A world hex's terrain, and what it may hold (sim/world/types.ts). */
  | 'worldTerrain' | 'worldFeature' | 'worldDistrict' | 'worldUpgrade';

/** Which collection a ref kind opens in the tool, for "points to" links. */
export const REF_COLLECTION: Partial<Record<RefKind, string>> = {
  building: 'buildings', good: 'goods', currency: 'currencies', unit: 'units', hero: 'heroes',
  villain: 'villains', pack: 'packs', artifact: 'artifacts', harvest: 'harvest',
  terrain: 'terrain', store: 'store', banner: 'banners', tech: 'tree', speaker: 'speakers',
};

/** A length rule for a list: exact, or tied to a sibling number. `orEmpty`
 *  lets a building leave a per-level column it does not use blank; `upTo`
 *  allows a SHORTER ladder, whose last value holds for the levels past it
 *  (`levelIndexed` in definitions.ts). */
export interface LengthRule {
  exact?: number;
  upTo?: true;
  /** Equal to the sibling field of this name, plus `offset`. */
  sibling?: string;
  offset?: number;
  /** Equal to Townhall's maxLevel — a ladder indexed by Townhall level. */
  townhall?: true;
  orEmpty?: true;
}

export interface FieldSpec {
  type: FieldType;
  nullable?: boolean;
  /** list / map: what each element is. */
  of?: FieldSpec;
  /** object: its fields, in order. */
  fields?: Record<string, FieldSpec>;
  /** map: what its keys must name. */
  keysRef?: RefKind;
  /** text: an id of this kind. */
  ref?: RefKind;
  /** text: one of these. */
  options?: readonly string[];
  /** A text field whose '' means "none" (the store's packTier). */
  emptyOk?: boolean;
  min?: number;
  max?: number;
  /** text: at most this many characters (a card's line). */
  maxLength?: number;
  length?: LengthRule;
  /** What it means, for the player-facing designer. */
  doc?: string;
}

/** Id lists the data itself cannot supply: they are unions in the sim
 *  (`FeatureId`, `LairId`) or live in another file (the technologies). */
export const STATIC_IDS: Partial<Record<RefKind, readonly string[]>> = {
  feature: ['Trees', 'Mountain', 'MountainIron', 'MountainGold', 'BerryBush', 'WildAnimals', 'FishShoal'],
  lair: ['Orcs', 'Harpies', 'Goblins', 'WolfRiders', 'Drake'],
  face: ['1star', '2star', '3star', '4star', '5star', '4gold', '5gold'],
  tech: Object.keys((techTree as { technologies: Record<string, unknown> }).technologies),
  character: Object.keys(CHARACTERS),
  landmarkKind: ['Shrine', 'StandingStones', 'Leyspring', 'Watchtower'],
  worldTerrain: WORLD_TERRAINS,
  worldFeature: WORLD_FEATURES,
  worldDistrict: WORLD_DISTRICTS,
  worldUpgrade: WORLD_UPGRADES,
};

export const ADJACENCY_STATS = ['goldPerMinute', 'workTime', 'trainTime'] as const;
export const ADJACENCY_GROUPS = ['AnyHall', 'AnyWorkshop', 'AnyProducer', 'AnyDecoration'] as const;

/** Quest goal types and what their target names; null = takes none. Mirrors
 *  the importer's QUEST_GOAL_TYPES. */
export const QUEST_GOALS: Record<string, RefKind | null> = {
  BuildDistrict: 'building', RepairDistrict: 'building', UpgradeDistrict: 'building', HoldResource: 'currency',
  ReachPopulation: null, CompleteTech: 'tech', CompleteTechs: null, AssignWorkers: null,
  TrainArmy: null, ClaimLandmarks: 'landmarkKind',
  OwnArtifacts: null, OwnHeroes: null, FindLairs: null, ClearLairs: null, CollectResource: 'currency',
  CollectTaps: null, DiscoverCells: null, SellGoods: null, DiscoverFeature: 'feature',
};

/** Goal types whose target may be left empty, meaning "any". */
export const QUEST_OPTIONAL_TARGET: ReadonlySet<string> = new Set(['ClaimLandmarks']);

/** Where each ref kind's ids come from in the document. */
const REF_SOURCE: Partial<Record<RefKind, string>> = {
  building: 'districts', good: 'goods', currency: 'currencies', unit: 'units', hero: 'heroes',
  villain: 'villains', pack: 'packs', artifact: 'artifacts', harvest: 'harvest',
  terrain: 'terrain', store: 'store', banner: 'banners', speaker: 'speakers',
};

export type DataDoc = Record<string, unknown>;

/** Every id a ref of this kind may name, read live from the document so a new
 *  entry is referenceable the moment it exists. */
export function refIds(doc: DataDoc, kind: RefKind): readonly string[] {
  if (kind === 'trainable') return [...refIds(doc, 'unit'), 'Villager'];
  const src = REF_SOURCE[kind];
  if (src !== undefined) {
    const v = doc[src];
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v) : [];
  }
  return STATIC_IDS[kind] ?? [];
}

// ----------------------------------------------------------------- inference

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** Infer one spec that fits every sample. `asRecord` says the samples are
 *  entries of one collection: records with named fields, some optional, never
 *  a map whose keys are data. */
export function inferSpec(samples: readonly unknown[], asRecord = false): FieldSpec {
  const present = samples.filter((s) => s !== null && s !== undefined);
  const nullable = present.length < samples.length;
  if (present.length === 0) return { type: 'unknown', nullable: true };
  if (present.every((s) => typeof s === 'number')) {
    const type = present.every((s) => Number.isInteger(s)) ? 'int' : 'float';
    return nullable ? { type, nullable } : { type };
  }
  if (present.every((s) => typeof s === 'string')) return nullable ? { type: 'text', nullable } : { type: 'text' };
  if (present.every((s) => typeof s === 'boolean')) return nullable ? { type: 'bool', nullable } : { type: 'bool' };
  if (present.every(Array.isArray)) {
    const items = (present as unknown[][]).flat();
    return { type: 'list', of: inferSpec(items), ...(nullable ? { nullable } : {}) };
  }
  if (present.every(isPlainObject)) {
    const objs = present as Record<string, unknown>[];
    const keys = [...new Set(objs.flatMap((o) => Object.keys(o)))];
    // Every sample has the same keys: a record with named fields. Otherwise
    // the keys are data (a cost's currencies), and it is a map.
    const sameKeys = objs.every((o) => Object.keys(o).length === keys.length);
    if ((sameKeys || asRecord) && keys.length > 0) {
      const fields: Record<string, FieldSpec> = {};
      // A field some entries lack is optional, which reads as nullable.
      for (const k of keys) fields[k] = inferSpec(objs.map((o) => o[k]));
      return { type: 'object', fields, ...(nullable ? { nullable } : {}) };
    }
    return { type: 'map', of: inferSpec(objs.flatMap((o) => Object.values(o))), ...(nullable ? { nullable } : {}) };
  }
  // Mixed types: say so rather than guess.
  return { type: 'unknown', nullable };
}

/** The entries of an entity / table / ordered collection, as [id, value]. A
 *  list's ids are its indices (its ORDER is the data). */
export function entriesOf(doc: DataDoc, c: CollectionDef): Array<[string, unknown]> {
  if (!c.source) return [];
  const v = doc[c.source];
  if (Array.isArray(v)) return v.map((x, i) => [String(i), x]);
  if (isPlainObject(v)) return Object.entries(v);
  return [];
}

/** Is this collection's source a list (ids are positions) or a map? */
export const isListCollection = (doc: DataDoc, c: CollectionDef): boolean =>
  c.source !== undefined && Array.isArray(doc[c.source]);

/** Every collection's schema, as authored in `schema/<collection>.json`. */
export const SCHEMAS: Readonly<Record<string, FieldSpec>> = Object.fromEntries(
  Object.entries(import.meta.glob('./schema/*.json', { eager: true, import: 'default' }))
    .map(([file, spec]) => [file.replace(/^.*\/|\.json$/g, ''), spec as FieldSpec]),
);

/**
 * The schema of a collection: for entity/table/ordered, the spec of ONE entry;
 * for a form, an object spec whose fields are its groups.
 *
 * Authored in `schema/<collection>.json` and edited in the tool's Schema view.
 * A collection with no schema file yet falls back to one inferred from
 * `reference`, which is what a new collection's first schema is written from.
 */
export function schemaOf(reference: DataDoc, c: CollectionDef, schemas: Readonly<Record<string, FieldSpec>> = SCHEMAS): FieldSpec {
  const authored = schemas[c.id];
  if (authored) return authored;
  if (c.view === 'canvas') return { type: 'object', fields: {} };
  if (c.view === 'form') {
    const fields: Record<string, FieldSpec> = {};
    for (const g of c.groups ?? []) fields[g] = inferSpec([reference[g]]);
    return { type: 'object', fields };
  }
  return inferSpec(entriesOf(reference, c).map(([, v]) => v), true);
}

// ---------------------------------------------------------------- validation

export interface DataIssue {
  collection: string;
  /** Entry id, or null for a form collection / the collection as a whole. */
  entry: string | null;
  /** Path below the entry (or below the root, for a form). */
  path: Array<string | number>;
  level: 'error' | 'warning';
  message: string;
}

export function validateData(doc: DataDoc, reference: DataDoc = doc, schemas: Readonly<Record<string, FieldSpec>> = SCHEMAS): DataIssue[] {
  const issues: DataIssue[] = [];
  const townhallMax = (doc.districts as Record<string, { maxLevel: number }> | undefined)?.Townhall?.maxLevel ?? 10;
  for (const c of COLLECTIONS) {
    if (c.view === 'canvas') continue;
    const spec = schemaOf(reference, c, schemas);
    const push = (entry: string | null, path: Array<string | number>, message: string, level: DataIssue['level'] = 'error') =>
      issues.push({ collection: c.id, entry, path, level, message });
    if (c.view === 'form') {
      checkValue(doc, spec, pickGroups(doc, c), [], null, push, townhallMax, null);
      RULES[c.id]?.(doc, push);
      continue;
    }
    for (const [id, value] of entriesOf(doc, c)) {
      checkValue(doc, spec, value, [], id, push, townhallMax, value);
    }
    if (c.id === 'quests') checkQuests(doc, push);
    if (c.id === 'adjacency') checkAdjacency(doc, push);
    RULES[c.id]?.(doc, push);
    if (!isListCollection(doc, c)) {
      for (const [id] of entriesOf(doc, c)) {
        if (!/^[A-Za-z0-9_]+$/.test(id)) push(id, [], `id "${id}" must be letters, digits or _`);
      }
    }
  }
  return issues;
}

const pickGroups = (doc: DataDoc, c: CollectionDef): Record<string, unknown> =>
  Object.fromEntries((c.groups ?? []).map((g) => [g, doc[g]]));

type Push = (entry: string | null, path: Array<string | number>, message: string, level?: DataIssue['level']) => void;

function checkValue(
  doc: DataDoc, spec: FieldSpec, value: unknown, path: Array<string | number>,
  entry: string | null, push: Push, townhallMax: number, parent: unknown,
): void {
  if (value === null || value === undefined) {
    if (!spec.nullable && spec.type !== 'unknown') push(entry, path, 'is empty');
    return;
  }
  switch (spec.type) {
    case 'unknown': return;
    case 'int':
    case 'float':
      if (typeof value !== 'number' || !Number.isFinite(value)) return push(entry, path, 'must be a number');
      if (spec.type === 'int' && !Number.isInteger(value)) push(entry, path, 'must be a whole number');
      if (spec.min !== undefined && value < spec.min) push(entry, path, `must be ≥ ${spec.min}`);
      if (spec.max !== undefined && value > spec.max) push(entry, path, `must be ≤ ${spec.max}`);
      return;
    case 'bool':
      if (typeof value !== 'boolean') push(entry, path, 'must be on or off');
      return;
    case 'text':
      if (typeof value !== 'string') return push(entry, path, 'must be text');
      if (value === '' && spec.emptyOk) return;
      if (spec.maxLength !== undefined && value.length > spec.maxLength) push(entry, path, `is ${value.length} characters, at most ${spec.maxLength}`);
      if (spec.options && !spec.options.includes(value)) push(entry, path, `"${value}" is not one of ${spec.options.join(', ')}`);
      if (spec.ref && !refIds(doc, spec.ref).includes(value)) push(entry, path, `"${value}" is not a ${spec.ref}`);
      return;
    case 'list': {
      if (!Array.isArray(value)) return push(entry, path, 'must be a list');
      const want = expectedLength(spec.length, parent, townhallMax);
      if (want !== null) {
        const fits = spec.length?.upTo ? value.length <= want
          : value.length === want || (spec.length?.orEmpty === true && value.length === 0);
        if (!fits) {
          push(entry, path, spec.length?.upTo
            ? `has ${value.length} entries, at most ${want}`
            : `has ${value.length} entries, needs ${want}${spec.length?.orEmpty ? ' (or none)' : ''}`);
        }
      }
      if (spec.of) value.forEach((x, i) => checkValue(doc, spec.of!, x, [...path, i], entry, push, townhallMax, value));
      return;
    }
    case 'map': {
      if (typeof value !== 'object' || Array.isArray(value)) return push(entry, path, 'must be a map');
      for (const [k, x] of Object.entries(value as Record<string, unknown>)) {
        if (spec.keysRef && !refIds(doc, spec.keysRef).includes(k)) push(entry, [...path, k], `"${k}" is not a ${spec.keysRef}`);
        if (spec.of) checkValue(doc, spec.of, x, [...path, k], entry, push, townhallMax, value);
      }
      return;
    }
    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) return push(entry, path, 'must be a record');
      const obj = value as Record<string, unknown>;
      for (const [k, f] of Object.entries(spec.fields ?? {})) {
        if (!(k in obj)) { if (!f.nullable) push(entry, [...path, k], 'is missing'); continue; }
        checkValue(doc, f, obj[k], [...path, k], entry, push, townhallMax, obj);
      }
      return;
    }
  }
}

function expectedLength(rule: LengthRule | undefined, parent: unknown, townhallMax: number): number | null {
  if (!rule) return null;
  if (rule.exact !== undefined) return rule.exact;
  if (rule.townhall) return townhallMax;
  if (rule.sibling && isPlainObject(parent) && typeof parent[rule.sibling] === 'number') {
    return (parent[rule.sibling] as number) + (rule.offset ?? 0);
  }
  return null;
}

function checkQuests(doc: DataDoc, push: Push): void {
  const quests = doc.quests;
  if (!Array.isArray(quests)) return;
  const seen = new Set<string>();
  quests.forEach((q: Record<string, unknown>, i) => {
    const id = String(i);
    if (seen.has(String(q.id))) push(id, ['id'], `duplicate quest id "${q.id}"`);
    seen.add(String(q.id));
    const kind = QUEST_GOALS[String(q.goalType)];
    if (kind === undefined) return; // the enum check already said so
    const target = q.goalTarget ?? null;
    if (kind === null && target !== null) push(id, ['goalTarget'], `${q.goalType} takes no target`);
    // A target the goal may go without: "claim a landmark" reads as any.
    const optional = QUEST_OPTIONAL_TARGET.has(String(q.goalType));
    if (kind !== null && (target === null ? !optional : !refIds(doc, kind).includes(String(target)))) {
      push(id, ['goalTarget'], `"${target}" is not a ${kind}`);
    }
    if (q.goalType === 'UpgradeDistrict' && typeof q.goalLevel !== 'number') push(id, ['goalLevel'], 'UpgradeDistrict needs a level');
  });
}

function checkAdjacency(doc: DataDoc, push: Push): void {
  const rules = doc.adjacency;
  if (!Array.isArray(rules)) return;
  const sides = [...refIds(doc, 'building'), ...ADJACENCY_GROUPS];
  rules.forEach((r: Record<string, unknown>, i) => {
    for (const side of ['district', 'neighbor'] as const) {
      if (!sides.includes(String(r[side]))) push(String(i), [side], `"${r[side]}" is not a building or group`);
    }
  });
}

// ---------------------------------------------------------- rules across fields

/**
 * What a schema cannot say: rules that tie one field to another, or one entry
 * to the next. Each is a way the game goes silently wrong rather than loudly —
 * a workshop with no queue, a lair that gets easier, a pack that guarantees
 * more cards than it holds — so each is an error, stated where the data is.
 */
type Rule = (doc: DataDoc, push: Push) => void;

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const records = (v: unknown): Array<[string, Record<string, unknown>]> =>
  Array.isArray(v) ? v.map((x, i) => [String(i), x as Record<string, unknown>])
    : isPlainObject(v) ? Object.entries(v as Record<string, Record<string, unknown>>) : [];

/** A ladder that is a TOTAL at each level can stand still but never fall. */
function neverFalls(push: Push, id: string, field: string, v: unknown): void {
  const xs = list(v).map(num);
  xs.forEach((n, i) => {
    if (i > 0 && n < xs[i - 1]) push(id, [field, i], `falls at level ${i + 1} (${xs[i - 1]} then ${n}) — it is a total, not an increment`);
  });
}

/** How far an adjacency on a clock may move it (the goldPerMinute rent
 *  bonus is a flat amount and is not clamped). */
export const ADJACENCY_CLAMP = 0.25;

/** The abandoned buildings authored in the map (Docs/features/01-map-and-fog.md §6.3). */
const ABANDONED_IDS: readonly string[] = ((regionMap as { abandoned?: Array<{ id: string }> }).abandoned ?? [])
  .map((a) => a.id);

/** What a scene condition's target must name, by kind (Docs/features/24-dialogue.md §5). */
const SCENE_TARGETS: Record<string, (doc: DataDoc) => readonly string[]> = {
  questReached: (doc) => list(doc.quests).map((q) => String((q as { id: unknown }).id)),
  questComplete: (doc) => list(doc.quests).map((q) => String((q as { id: unknown }).id)),
  questClaimed: (doc) => list(doc.quests).map((q) => String((q as { id: unknown }).id)),
  questProgress: (doc) => list(doc.quests).map((q) => String((q as { id: unknown }).id)),
  techDone: () => STATIC_IDS.tech ?? [],
  techFilled: () => STATIC_IDS.tech ?? [],
  placing: (doc) => Object.keys(doc.districts ?? {}),
  placed: (doc) => Object.keys(doc.districts ?? {}),
  built: (doc) => [...Object.keys(doc.districts ?? {}), 'AnyWorkshop'],
  lairFound: () => ['', ...(STATIC_IDS.lair ?? [])],
  lairDefeated: () => ['', ...(STATIC_IDS.lair ?? [])],
  lairCleared: () => ['', ...(STATIC_IDS.lair ?? [])],
  bookOpen: () => ['Civics', 'Warfare', 'Magic', 'Sagas', 'Atlas'],
  featureSeen: () => STATIC_IDS.feature ?? [],
  sighted: () => ['', 'mountain', 'landmark', 'lair', ...(STATIC_IDS.landmarkKind ?? []), ...(STATIC_IDS.lair ?? [])],
  doorOpen: () => ['research', 'build', 'heroes', 'relics', 'store', 'world', 'knowledge', 'banner', 'survey'],
  abandonedRevealed: () => ABANDONED_IDS,
  siteOpen: () => ABANDONED_IDS,
  repairing: () => ABANDONED_IDS,
};

export const RULES: Readonly<Record<string, Rule>> = {
  unlocks: (doc, push) => {
    const targets: Record<string, readonly string[]> = { door: SCENE_TARGETS.doorOpen(doc), book: SCENE_TARGETS.bookOpen(doc) };
    for (const [id, raw] of Object.entries((doc.unlocks ?? {}) as Record<string, Record<string, unknown>>)) {
      const ids = targets[String(raw.kind)];
      if (ids !== undefined && !ids.includes(String(raw.target))) {
        push(id, ['target'], `"${raw.target}" is not a ${raw.kind}`);
      }
    }
  },
  scenes: (doc, push) => {
    const seen = new Set<string>();
    const check = (entry: string, path: Array<string | number>, kind: unknown, target: unknown) => {
      const ids = SCENE_TARGETS[String(kind)];
      if (ids === undefined) return;
      if (!ids(doc).includes(String(target ?? ''))) push(entry, path, `${kind} names "${target}", which is not one`);
    };
    list(doc.scenes).forEach((raw, i) => {
      const s = raw as Record<string, unknown>;
      const entry = String(i);
      if (seen.has(String(s.id))) push(entry, ['id'], `duplicate scene id "${s.id}"`);
      seen.add(String(s.id));
      check(entry, ['triggerTarget'], s.trigger, s.triggerTarget);
      const lines = list(s.lines);
      if (lines.length === 0) push(entry, ['lines'], 'a scene says at least one line');
      lines.forEach((l, j) => {
        const line = l as Record<string, unknown>;
        check(entry, ['lines', j, 'untilTarget'], line.until, line.untilTarget);
        if (line.stocks !== undefined && line.stocks !== null) check(entry, ['lines', j, 'stocks'], 'placed', line.stocks);
        if (line.lock !== 'none' && line.lock !== 'all' && String(line.point ?? '') === '') {
          push(entry, ['lines', j, 'lock'], `locks to a target but points at nothing`);
        }
      });
    });
  },
  buildings: (doc, push) => {
    const lateFrom = num((doc.city as Record<string, unknown> | undefined)?.lateUpgradeFromLevel) || Infinity;
    // ONE TRAINEE PER BUILDING, ONE BUILDING PER TRAINEE: each unit has a hall
    // of its own, so a card's training block is one unit and one batch, and
    // no two halls compete for the same order.
    const trainedAt = new Map<string, string>();
    for (const [id, b] of records(doc.districts)) {
      const trains = list(b.trains);
      if (trains.length > 1) push(id, ['trains'], `trains ${trains.length} things — a building trains one`);
      for (const t of trains) {
        const other = trainedAt.get(String(t));
        if (other !== undefined) push(id, ['trains'], `${t} is already trained at ${other} — each unit has one building`);
        else trainedAt.set(String(t), id);
      }
    }
    for (const [id, b] of records(doc.districts)) {
      const workshop = b.produces !== null && b.produces !== undefined;
      if (workshop !== (list(b.queueLengthPerLevel).length > 0)) {
        push(id, ['produces'], 'a workshop needs both produces and queueLengthPerLevel');
      }
      // A decoration has no level, no crew, no residents, no queue and makes
      // nothing: its whole contribution is its Harmony.
      if (num(b.harmonySupply) > 0) {
        if (!Number.isInteger(b.harmonySupply)) push(id, ['harmonySupply'], 'is not a whole number');
        if (b.maxLevel !== 1) push(id, ['maxLevel'], 'a decoration has no ladder — maxLevel must be 1');
        for (const f of ['maxWorkersPerLevel', 'populationCapacityPerLevel', 'armyCapPerLevel', 'bedsPerLevel', 'influenceRadiusPerLevel', 'queueLengthPerLevel']) {
          if (list(b[f]).length > 0) push(id, [f], 'a decoration has none');
        }
        if (workshop) push(id, ['produces'], 'a decoration makes nothing');
        if (list(b.harmonyCostPerLevel).length > 0) push(id, ['harmonyCostPerLevel'], 'a decoration supplies Harmony; it does not demand it');
      }
      neverFalls(push, id, 'harmonyCostPerLevel', b.harmonyCostPerLevel);
      // The rent bonus is a house's ladder.
      if (list(b.taxBonusPerLevel).length > 0 && list(b.populationCapacityPerLevel).length === 0) {
        push(id, ['taxBonusPerLevel'], 'on a building that houses nobody');
      }
      neverFalls(push, id, 'taxBonusPerLevel', b.taxBonusPerLevel);
      neverFalls(push, id, 'goldPerMinutePerLevel', b.goldPerMinutePerLevel);
      // What a building makes waits inside it for a tap, so anything that
      // makes Gold or harvests has a store — without one its production
      // would have no ceiling at all while the player is away.
      const makes = list(b.populationCapacityPerLevel).length > 0 || list(b.harvestSources).length > 0
        || list(b.goldPerMinutePerLevel).length > 0;
      const stores = list(b.storageCapacityPerLevel).length > 0;
      if (makes && !stores) push(id, ['storageCapacityPerLevel'], 'it makes Gold or harvests, so it needs a store');
      if (!makes && stores) push(id, ['storageCapacityPerLevel'], 'on a building that makes nothing to collect');
      neverFalls(push, id, 'storageCapacityPerLevel', b.storageCapacityPerLevel);
      // The late ladder only exists past the pivot level.
      const lateAuthored = num(b.upgradeDurationLateSeconds) > 0 || num(b.upgradeDurationLateLevelGrowth) > 0;
      if (lateAuthored && num(b.maxLevel) < lateFrom) {
        push(id, ['upgradeDurationLateSeconds'], `has a late ladder but stops at level ${b.maxLevel}, before city.lateUpgradeFromLevel (${lateFrom})`);
      }
    }
  },
  goods: (doc, push) => {
    for (const [id, g] of records(doc.goods)) if (g.inputGood === id) push(id, ['inputGood'], 'a good cannot be made of itself');
  },
  currencies: (doc, push) => {
    for (const [id, c] of records(doc.currencies)) {
      if (c.goldValue !== null && c.goldValue !== undefined && (num(c.goldValue) <= 0 || id === 'Gold')) {
        push(id, ['goldValue'], 'must be positive, and not on Gold itself');
      }
    }
  },
  units: (doc, push) => {
    for (const [id, u] of records(doc.units)) {
      if (num(u.frontage) < 1) push(id, ['frontage'], 'must be 1 or more');
      if (num(u.frontage) > num(u.squadSize)) push(id, ['frontage'], 'cannot exceed squadSize');
      if (num(u.cooldown) < 1) push(id, ['cooldown'], 'is in TICKS and must be 1 or more');
    }
  },
  heroes: (doc, push) => {
    for (const [id, h] of records(doc.heroes)) {
      const boon = h.boon as Record<string, unknown> | undefined;
      if (boon === undefined) continue;
      // Always a multiplier above 1: below is a discount, and a discount dies at 100%.
      if (!(num(boon.value) > 1)) push(id, ['boon', 'value'], `a boon must be more than 1 — ${boon.value} is a discount`);
      if (typeof boon.stat !== 'string' || boon.stat === '') push(id, ['boon', 'stat'], 'a boon names the stat it moves');
    }
  },
  adjacency: (doc, push) => {
    const seen = new Set<string>();
    for (const [i, r] of records(doc.adjacency)) {
      const key = `${r.district}/${r.neighbor}/${r.stat}`;
      if (seen.has(key)) push(i, [], `duplicate rule ${key}`);
      seen.add(key);
      if (num(r.magnitude) === 0) push(i, ['magnitude'], 'a rule with magnitude 0 does nothing — delete it');
      if (r.stat !== 'goldPerMinute' && Math.abs(num(r.magnitude)) > ADJACENCY_CLAMP) {
        push(i, ['magnitude'], `is past the ±${ADJACENCY_CLAMP} clamp`);
      }
    }
  },
  store: (doc, push) => {
    for (const [id, s] of records(doc.store)) {
      if (!(num(s.priceUsd) > 0)) push(id, ['priceUsd'], 'a product needs a positive price');
      if ((num(s.packs) > 0) !== (s.packTier !== '' && s.packTier !== undefined)) push(id, ['packTier'], 'a pack count and a pack tier go together');
      if ((num(s.wildcards) > 0) !== (num(s.wildcardRarity) > 0)) push(id, ['wildcardRarity'], 'a wildcard count and a wildcard rarity go together');
      if (num(s.wildcardRarity) > 5) push(id, ['wildcardRarity'], '5★ is the dearest wildcard');
      if (num(s.gems) > 0 && (num(s.packs) > 0 || num(s.wildcards) > 0)) push(id, ['gems'], 'grants both Gems and cards — a product is one thing');
    }
  },
  banners: (doc, push) => {
    for (const [id, b] of records(doc.banners)) {
      const w = (b.weights ?? {}) as Record<string, unknown>;
      if (Object.values(w).every((x) => num(x) <= 0)) push(id, ['weights'], 'every rarity at 0 — the banner can roll nothing');
      if (!(num(b.heroChance) > 0 && num(b.heroChance) <= 1)) push(id, ['heroChance'], 'is a fraction, above 0 and at most 1');
      if (num(b.softPityAt) >= num(b.hardPityAt)) push(id, ['softPityAt'], `soft pity (${b.softPityAt}) must come before hard pity (${b.hardPityAt})`);
      if ((num(b.legendaryPityAt) > 0) !== (num(w.Legendary) > 0)) push(id, ['legendaryPityAt'], 'a legendary guarantee and a legendary weight go together');
    }
  },
  packs: (doc, push) => {
    for (const [id, p] of records(doc.packs)) {
      const given = Object.values((p.guarantees ?? {}) as Record<string, unknown>).reduce((a: number, x) => a + num(x), 0);
      if (given > num(p.cards)) push(id, ['guarantees'], `guarantees ${given} cards but the pack holds ${p.cards}`);
      if (given < num(p.cards) && list(p.weights).every((x) => num(x) <= 0)) push(id, ['weights'], `has ${num(p.cards) - given} slots to roll and every weight is 0`);
    }
  },
  exploration: (doc, push) => {
    const rings = list((doc.fog as Record<string, unknown> | undefined)?.rings) as Array<Record<string, unknown>>;
    rings.forEach((r, i) => {
      if (i > 0 && num(r.distance) <= num(rings[i - 1].distance)) push(null, ['fog', 'rings', i, 'distance'], 'distances must be ascending');
    });
  },
  world: (doc, push) => {
    const gen = (doc.worldGen ?? {}) as Record<string, unknown>;
    const chances = (gen.featureChance ?? {}) as Record<string, Record<string, unknown> | undefined>;
    // Where each kind of place may stand (19-world-map.md §9).
    const only: Record<string, string> = { Dungeon: 'outer', Sanctuary: 'outer', Landmark: 'corridor' };
    for (const [role, row] of Object.entries(chances)) {
      for (const [feature, home] of Object.entries(only)) {
        if (role !== home && num(row?.[feature]) > 0) {
          push(null, ['worldGen', 'featureChance', role, feature], `a ${feature} only stands on the ${home} ring`);
        }
      }
    }
    // Where each feature may roll, and what it never shares a hex with
    // (Docs/plans/world-hex-art.md §1).
    const rules = (gen.featureRules ?? {}) as Record<string, Record<string, unknown> | undefined>;
    const excludes = (f: string) => list(rules[f]?.excludes) as string[];
    for (const f of WORLD_FEATURES) {
      if (rules[f] === undefined) { push(null, ['worldGen', 'featureRules', f], 'is missing — every feature says where it rolls'); continue; }
      if (list(rules[f]!.terrains).length === 0) push(null, ['worldGen', 'featureRules', f, 'terrains'], 'names no terrain — it could never roll');
      for (const other of excludes(f)) {
        if (other === f) push(null, ['worldGen', 'featureRules', f, 'excludes'], 'cannot exclude itself');
        else if (!excludes(other).includes(f)) push(null, ['worldGen', 'featureRules', other, 'excludes'], `${f} excludes ${other}, so ${other} must exclude ${f}`);
      }
    }
    // Sites placed, not rolled: on the outer ring, as many as it has room for.
    const placed = (gen.placedPerWedge ?? {}) as Record<string, unknown>;
    let placedTotal = 0;
    for (const [f, n] of Object.entries(placed)) {
      if (num(n) <= 0) continue;
      placedTotal += num(n);
      if (!PLACED_SITES.includes(f as never)) push(null, ['worldGen', 'placedPerWedge', f], `only ${PLACED_SITES.join(' and ')} are placed`);
      for (const [role, row] of Object.entries(chances)) {
        if (num(row?.[f]) > 0) push(null, ['worldGen', 'featureChance', role, f], `a ${f} is placed (placedPerWedge), not rolled — its chance is 0`);
      }
    }
    if (placedTotal > OUTER_SITE_ROOM) {
      push(null, ['worldGen', 'placedPerWedge'], `${placedTotal} sites, but a wedge's outer ring has room for ${OUTER_SITE_ROOM} away from the city`);
    }
    list(gen.innerRing).forEach((h, i) => {
      const hex = (h ?? {}) as Record<string, unknown>;
      const held = list(hex.features) as string[];
      held.forEach((f, n) => {
        const rule = rules[f];
        if (rule === undefined) return;
        if (!list(rule.terrains).includes(hex.terrain)) push(null, ['worldGen', 'innerRing', i, 'features', n], `a ${f} never stands on ${String(hex.terrain)}`);
        for (const other of held.slice(0, n)) {
          if (excludes(f).includes(other)) push(null, ['worldGen', 'innerRing', i, 'features', n], `a ${f} never shares a hex with ${other}`);
        }
      });
    });
    const weights = (gen.terrainWeights ?? {}) as Record<string, Record<string, unknown> | undefined>;
    for (const [role, row] of Object.entries(weights)) {
      if (Object.values(row ?? {}).every((w) => num(w) <= 0)) {
        push(null, ['worldGen', 'terrainWeights', role], 'every weight is 0 — a hex here could roll no terrain');
      }
    }
    // Every district once, every feature a hex can be held on decided by
    // exactly one of them (19 §7).
    const build = (doc.worldBuild ?? {}) as Record<string, unknown>;
    const districts = (build.districts ?? {}) as Record<string, Record<string, unknown>>;
    const decides = new Map<string, string>();
    for (const id of WORLD_DISTRICTS) {
      const def = districts[id];
      if (def === undefined) { push(null, ['worldBuild', 'districts', id], 'is missing — every district needs its row'); continue; }
      const feature = String(def.feature ?? '');
      const was = decides.get(feature);
      if (was !== undefined) push(null, ['worldBuild', 'districts', id, 'feature'], `${was} is already the district of ${feature}`);
      decides.set(feature, id);
      const makes = def.produces !== '' && def.produces !== undefined;
      if (makes && (num(def.perHour) <= 0 || num(def.store) <= 0)) push(null, ['worldBuild', 'districts', id], 'makes nothing, or has nowhere to put it');
      if (!makes && (num(def.perHour) > 0 || num(def.store) > 0)) push(null, ['worldBuild', 'districts', id], 'fills a store with nothing');
    }
    for (const f of ['None', ...WORLD_FEATURES.filter((x) => x !== 'Dungeon')]) {
      if (!decides.has(f)) push(null, ['worldBuild', 'districts'], `no district for ${f === 'None' ? 'bare ground' : `a ${f}`}`);
    }
    const upgrades = (build.upgrades ?? {}) as Record<string, Record<string, unknown>>;
    for (const id of WORLD_UPGRADES) {
      if (upgrades[id] === undefined) { push(null, ['worldBuild', 'upgrades', id], 'is missing'); continue; }
      if (list(upgrades[id].levels).length === 0) push(null, ['worldBuild', 'upgrades', id, 'levels'], 'has no level 1');
    }
    const world = (doc.world ?? {}) as Record<string, unknown>;
    if (num(world.explorerRevealRadius) > num(world.revealRadiusMax)) {
      push(null, ['world', 'explorerRevealRadius'], 'is past revealRadiusMax');
    }
  },
  economy: (doc, push) => {
    const tiers = list((doc.harmony as Record<string, unknown> | undefined)?.surplusTiers) as Array<Record<string, unknown>>;
    tiers.forEach((t, i) => {
      if (num(t.at) < 1) push(null, ['harmony', 'surplusTiers', i, 'at'], 'is below 1 — it is a RATIO of demand');
      if (num(t.bonus) === 0) push(null, ['harmony', 'surplusTiers', i, 'bonus'], 'a tier needs a bonus');
      if (i > 0 && num(t.at) <= num(tiers[i - 1].at)) push(null, ['harmony', 'surplusTiers', i, 'at'], 'tiers must be ascending');
    });
  },
};

// ------------------------------------------------------------------- helpers

/** Read a path out of a value. */
export function getAt(root: unknown, path: ReadonlyArray<string | number>): unknown {
  let v: unknown = root;
  for (const p of path) {
    if (v === null || typeof v !== 'object') return undefined;
    v = (v as Record<string | number, unknown>)[p];
  }
  return v;
}

/** Every collection id a spec's refs point to, for "points to" links. */
export function refsIn(spec: FieldSpec, value: unknown, path: Array<string | number> = []): Array<{ path: Array<string | number>; kind: RefKind; id: string }> {
  const out: Array<{ path: Array<string | number>; kind: RefKind; id: string }> = [];
  if (value === null || value === undefined) return out;
  if (spec.type === 'text' && spec.ref && typeof value === 'string' && value !== '') out.push({ path, kind: spec.ref, id: value });
  if (spec.type === 'map' && isPlainObject(value)) {
    for (const [k, x] of Object.entries(value)) {
      if (spec.keysRef) out.push({ path: [...path, k], kind: spec.keysRef, id: k });
      if (spec.of) out.push(...refsIn(spec.of, x, [...path, k]));
    }
  }
  if (spec.type === 'list' && Array.isArray(value) && spec.of) value.forEach((x, i) => out.push(...refsIn(spec.of!, x, [...path, i])));
  if (spec.type === 'object' && isPlainObject(value)) {
    for (const [k, f] of Object.entries(spec.fields ?? {})) out.push(...refsIn(f, value[k], [...path, k]));
  }
  return out;
}

// ---------------------------------------------------------------- the files

/**
 * How a collection file is written — by the migration, and by every save
 * after it, so a save never reformats what it did not change.
 *
 * The root and each entry are always broken one key per line, so a diff
 * names the entry and the field that moved. Anything deeper that fits on a
 * line of ~100 characters stays on one — a cost, a ladder, a reward — so a
 * rebalanced level reads as one changed line, not as a reflowed block.
 */
export function formatData(value: unknown): string {
  return fmtNode(value, 0, '') + '\n';
}

const INLINE_WIDTH = 100;

function fmtNode(v: unknown, depth: number, indent: string): string {
  const flat = JSON.stringify(v);
  if (v === null || typeof v !== 'object') return flat;
  const empty = Array.isArray(v) ? v.length === 0 : Object.keys(v).length === 0;
  if (empty) return flat;
  if (depth >= 2 && indent.length + flat.length <= INLINE_WIDTH) return inline(v);
  const inner = indent + '  ';
  if (Array.isArray(v)) {
    return `[\n${v.map((x) => inner + fmtNode(x, depth + 1, inner)).join(',\n')}\n${indent}]`;
  }
  const lines = Object.entries(v as Record<string, unknown>)
    .map(([k, x]) => `${inner}${JSON.stringify(k)}: ${fmtNode(x, depth + 1, inner)}`);
  return `{\n${lines.join(',\n')}\n${indent}}`;
}

/** One line, with a space after each comma and colon so it reads. */
function inline(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`;
  const e = Object.entries(v as Record<string, unknown>);
  return e.length === 0 ? '{}' : `{ ${e.map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }`;
}

/** The document the sim reads, from one value per collection file — the
 *  runtime twin of `balance.ts`, for the save endpoint. */
export function assemble(files: Readonly<Record<string, unknown>>): DataDoc {
  const doc: DataDoc = {};
  for (const c of COLLECTIONS) {
    const f = files[c.id];
    if (c.view === 'canvas' || f === undefined) continue;
    if (c.source) doc[c.source] = f;
    else Object.assign(doc, f as Record<string, unknown>);
  }
  return doc;
}

/** What one collection's file holds, cut out of the document. */
export function sliceOf(doc: DataDoc, c: CollectionDef): unknown {
  if (c.source) return doc[c.source];
  return Object.fromEntries((c.groups ?? []).map((g) => [g, doc[g]]));
}
