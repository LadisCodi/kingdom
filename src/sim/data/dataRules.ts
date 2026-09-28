// What the game's data IS, and what a legal document of it looks like — in
// ONE place, the way `mapRules.ts` and `techTreeRules.ts` are for the map and
// the tree.
//
// `?dev=data` (src/editor/data/) is the tool that will replace the balance
// workbook. This module is its DOM-free half: the registry of COLLECTIONS
// (every top-level key of the data, grouped the way a designer looks for it),
// the SCHEMA of each (inferred from the data itself, then sharpened by the
// overrides below — refs, enums, ranges, per-level lengths), and the
// VALIDATOR. The editor, and `tests/dataRules.test.ts`, read the same
// functions; a save endpoint will too once the tool writes files.
//
// Phase 1 of the migration (Docs/plans/data-editor.md): the source of truth is
// still `balance.xlsx` → `balance.json`, so everything here reads the
// document as `balance.json` shapes it today. Nothing in the sim imports this.

import techTree from './tech-tree.json';

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
  /** canvas: the editor that authors it, until it moves inside Data. */
  href?: string;
}

export const COLLECTIONS: readonly CollectionDef[] = [
  { id: 'map', label: 'Region map', domain: 'World', view: 'canvas', noun: 'cell', href: '?dev=map' },
  { id: 'terrain', label: 'Terrain', domain: 'World', view: 'table', noun: 'terrain', source: 'terrain' },
  { id: 'harvest', label: 'Harvest', domain: 'World', view: 'table', noun: 'source', source: 'harvest' },
  { id: 'depths', label: 'Ruin depths', domain: 'World', view: 'table', noun: 'depth', source: 'depths' },
  { id: 'garrisons', label: 'Garrisons', domain: 'World', view: 'table', noun: 'garrison', source: 'garrisons' },
  { id: 'exploration', label: 'Exploration', domain: 'World', view: 'form', noun: 'setting', groups: ['fog', 'knowledge', 'raid', 'delve'] },

  { id: 'buildings', label: 'Buildings', domain: 'City', view: 'entity', noun: 'building', source: 'districts' },
  { id: 'goods', label: 'Goods', domain: 'City', view: 'table', noun: 'good', source: 'goods' },
  { id: 'adjacency', label: 'Adjacency', domain: 'City', view: 'table', noun: 'rule', source: 'adjacency' },
  { id: 'economy', label: 'Economy', domain: 'City', view: 'form', noun: 'setting',
    groups: ['tap', 'taxes', 'mana', 'city', 'kingdom', 'harmony', 'worker', 'training', 'rush', 'research', 'offlineCapHours'] },

  { id: 'tree', label: 'Tech tree', domain: 'Research', view: 'canvas', noun: 'technology', href: '?dev=tree' },

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
  { id: 'daily', label: 'Daily & missions', domain: 'Progression', view: 'form', noun: 'setting', groups: ['daily', 'missions'] },
  { id: 'collection', label: 'Card collection', domain: 'Progression', view: 'form', noun: 'setting', groups: ['collection'] },

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
  | 'harvest' | 'terrain' | 'store' | 'banner' | 'tech' | 'feature' | 'ruin' | 'face';

/** Which collection a ref kind opens in the tool, for "points to" links. */
export const REF_COLLECTION: Partial<Record<RefKind, string>> = {
  building: 'buildings', good: 'goods', currency: 'currencies', unit: 'units', hero: 'heroes',
  villain: 'villains', pack: 'packs', artifact: 'artifacts', harvest: 'harvest',
  terrain: 'terrain', store: 'store', banner: 'banners', tech: 'tree',
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
  length?: LengthRule;
  /** What it means, for the player-facing designer. */
  doc?: string;
}

/** Static id lists the data itself cannot supply. Mirrors the importer
 *  (`scripts/balance.mjs`) until the migration makes these collections. */
export const STATIC_IDS: Partial<Record<RefKind, readonly string[]>> = {
  feature: ['Trees', 'Mountain', 'MountainIron', 'MountainGold', 'BerryBush', 'WildAnimals', 'FishShoal'],
  ruin: ['HollowBarrow', 'SunkenChapel', 'DrownedIronworks', 'CountingHouse', 'StarObservatory'],
  face: ['1star', '2star', '3star', '4star', '5star', '4gold', '5gold'],
  tech: Object.keys((techTree as { technologies: Record<string, unknown> }).technologies),
};

const HERO_RARITIES = ['Common', 'Rare', 'Legendary'] as const;
const HERO_TRAITS = ['PartyDefence', 'SupplyDiscount', 'KnowledgeBonus', 'FragmentBonus', 'WoundedRecovery'] as const;
export const ADJACENCY_STATS = ['goldPerMinute', 'workTime', 'trainTime'] as const;
export const ADJACENCY_GROUPS = ['AnyHall', 'AnyWorkshop', 'AnyProducer', 'AnyDecoration'] as const;

/** Quest goal types and what their target names; null = takes none. Mirrors
 *  the importer's QUEST_GOAL_TYPES. */
export const QUEST_GOALS: Record<string, RefKind | null> = {
  BuildDistrict: 'building', UpgradeDistrict: 'building', HoldResource: 'currency',
  ReachPopulation: null, CompleteTech: 'tech', CompleteTechs: null, AssignWorkers: null,
  TrainArmy: null, ClaimLandmarks: null, ReachDepth: null, ClearRuins: null,
  OwnArtifacts: null, OwnHeroes: null, ClearGarrisons: null, CollectResource: 'currency',
  CollectTaps: null, DiscoverCells: null, SellGoods: null, DiscoverFeature: 'feature',
};

/** Where each ref kind's ids come from in the document. */
const REF_SOURCE: Partial<Record<RefKind, string>> = {
  building: 'districts', good: 'goods', currency: 'currencies', unit: 'units', hero: 'heroes',
  villain: 'villains', pack: 'packs', artifact: 'artifacts', harvest: 'harvest',
  terrain: 'terrain', store: 'store', banner: 'banners',
};

export type DataDoc = Record<string, unknown>;

/** Every id a ref of this kind may name, read live from the document so a new
 *  entry is referenceable the moment it exists. */
export function refIds(doc: DataDoc, kind: RefKind): readonly string[] {
  const src = REF_SOURCE[kind];
  if (src !== undefined) {
    const v = doc[src];
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v) : [];
  }
  return STATIC_IDS[kind] ?? [];
}

/** A path from a collection's entry down to a field: '*' stands for any list
 *  index or map key. */
type Overrides = Record<string, Partial<FieldSpec>>;

const perLevel: Partial<FieldSpec> = { length: { sibling: 'maxLevel', upTo: true } };

/**
 * What inference cannot see: which strings are ids, which numbers have a
 * floor, which lists are ladders. Keyed by collection, then by field path
 * relative to ONE entry (or, for a form, relative to the document root).
 */
export const OVERRIDES: Record<string, Overrides> = {
  buildings: {
    maxLevel: { min: 1, max: 20, doc: 'How many levels it has. Level 1 is the build.' },
    costPerLevel: { length: { sibling: 'maxLevel' }, doc: 'What each level costs, level 1 being the build.' },
    'costPerLevel.*.cost': { keysRef: 'currency', doc: 'Currencies, multiplied by the instance ordinal.' },
    'costPerLevel.*.cost.*': { min: 0 },
    'costPerLevel.*.goods': { keysRef: 'good', doc: 'Refined goods; never multiplied.' },
    'costPerLevel.*.goods.*': { min: 0 },
    populationCapacityPerLevel: perLevel,
    taxBonusPerLevel: perLevel,
    maxWorkersPerLevel: perLevel,
    influenceRadiusPerLevel: perLevel,
    armyCapPerLevel: perLevel,
    bedsPerLevel: perLevel,
    extraUnitsPerDeliveryPerLevel: perLevel,
    strikeSpeedPerLevel: perLevel,
    queueLengthPerLevel: perLevel,
    harmonyCostPerLevel: { ...perLevel, doc: 'Harmony demanded: a TOTAL at each level, entry 0 gating the build.' },
    requiredTownhallLevelPerLevel: { length: { sibling: 'maxLevel', offset: -1, upTo: true }, doc: 'Entry 0 gates level 2.' },
    requiredPopulationPerLevel: { length: { sibling: 'maxLevel', offset: -1, upTo: true }, doc: 'Villagers each level asks for; entry 0 gates level 2.' },
    maxCountPerTownhallLevel: { length: { townhall: true, upTo: true }, doc: 'How many the city may own at each Townhall level.' },
    produces: { ref: 'good', nullable: true },
    instanceLinearGrowth: { min: 0, doc: 'M(N) = linear × (N − 1) + exponential^(N − 1).' },
    instanceExponentialGrowth: { min: 1 },
    buildDurationSeconds: { min: 0 },
    upgradeDurationSeconds: { min: 0 },
    fogRevealRadius: { min: 0 },
    fogDiscoverRadius: { min: 0 },
    harmonySupply: { min: 0, doc: 'Non-zero makes it a decoration.' },
  },
  goods: {
    input: { keysRef: 'currency' },
    'input.*': { min: 0 },
    inputGood: { ref: 'good', nullable: true },
    workSeconds: { min: 1 },
    tier: { min: 1 },
  },
  terrain: { '*': { min: 0 } },
  harvest: { unitsPerStrike: { min: 0 }, secondsPerStrike: { min: 0 }, stock: { min: 0 } },
  currencies: { cap: { nullable: true, min: 0 }, goldValue: { nullable: true, min: 0 }, start: { min: 0 } },
  units: { recruitCost: { keysRef: 'currency' }, 'recruitCost.*': { min: 0 }, hp: { min: 1 }, squadSize: { min: 1 } },
  heroes: { rarity: { options: HERO_RARITIES }, unitType: { ref: 'unit' }, trait: { options: HERO_TRAITS }, hp: { min: 1 } },
  villains: { unitType: { ref: 'unit' }, hp: { min: 1 } },
  depths: {
    ruin: { ref: 'ruin' }, villainPool: { ref: 'villain' }, bossVillain: { ref: 'villain' },
    supplies: { keysRef: 'currency' }, depth: { min: 1 }, rooms: { min: 1 },
  },
  garrisons: { supplies: { keysRef: 'currency' }, tier: { min: 1 } },
  adjacency: { stat: { options: ADJACENCY_STATS } },
  quests: {
    goalType: { options: Object.keys(QUEST_GOALS) },
    goalTarget: { nullable: true },
    goalLevel: { nullable: true },
    goalAmount: { min: 1 },
    reward: { keysRef: 'currency' },
  },
  store: { packTier: { ref: 'pack', emptyOk: true }, priceUsd: { min: 0 } },
  packs: { guarantees: { keysRef: 'face' }, weights: { length: { exact: 7 } } },
  banners: { key: { ref: 'currency' } },
  economy: {
    'taxes.townhallMultiplierPerLevel': { length: { townhall: true } },
    'mana.sanctumCapPerLevel': { length: { exact: 10 } },
    'mana.sanctumPerHourPerLevel': { length: { exact: 10 } },
    'city.initialCurrencies': { keysRef: 'currency' },
    'tap.manaCost': { min: 0, doc: 'What every player tap costs.' },
    'tap.workSeconds': { min: 1, doc: 'A tap pays this many seconds of what it touches produces.' },
    offlineCapHours: { min: 0, doc: 'Production stops after this long away; timers do not.' },
  },
  exploration: { 'fog.reachPerTownhallLevel': { length: { townhall: true } } },
};

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

/** Apply `overrides` onto a spec tree. Paths are relative to `spec`. */
function applyOverrides(spec: FieldSpec, overrides: Overrides): FieldSpec {
  const out = structuredClone(spec);
  for (const [path, patch] of Object.entries(overrides)) {
    for (const node of nodesAt(out, path.split('.'))) Object.assign(node, patch);
  }
  return out;
}

function nodesAt(spec: FieldSpec, parts: string[]): FieldSpec[] {
  if (parts.length === 0) return [spec];
  const [head, ...rest] = parts;
  if (head === '*') {
    if ((spec.type === 'list' || spec.type === 'map') && spec.of) return nodesAt(spec.of, rest);
    if (spec.type === 'object' && spec.fields) return Object.values(spec.fields).flatMap((f) => nodesAt(f, rest));
    return [];
  }
  if (spec.type === 'object' && spec.fields?.[head]) return nodesAt(spec.fields[head], rest);
  return [];
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

/**
 * The schema of a collection: for entity/table/ordered, the spec of ONE entry;
 * for a form, an object spec whose fields are its groups.
 *
 * Inferred from `reference` — the document as it was loaded — so an edit
 * cannot quietly change what a field is.
 */
export function schemaOf(reference: DataDoc, c: CollectionDef): FieldSpec {
  if (c.view === 'canvas') return { type: 'object', fields: {} };
  if (c.view === 'form') {
    const fields: Record<string, FieldSpec> = {};
    for (const g of c.groups ?? []) fields[g] = inferSpec([reference[g]]);
    return applyOverrides({ type: 'object', fields }, OVERRIDES[c.id] ?? {});
  }
  const spec = inferSpec(entriesOf(reference, c).map(([, v]) => v), true);
  return applyOverrides(spec, OVERRIDES[c.id] ?? {});
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

export function validateData(doc: DataDoc, reference: DataDoc = doc): DataIssue[] {
  const issues: DataIssue[] = [];
  const townhallMax = (doc.districts as Record<string, { maxLevel: number }> | undefined)?.Townhall?.maxLevel ?? 10;
  for (const c of COLLECTIONS) {
    if (c.view === 'canvas') continue;
    const spec = schemaOf(reference, c);
    const push = (entry: string | null, path: Array<string | number>, message: string, level: DataIssue['level'] = 'error') =>
      issues.push({ collection: c.id, entry, path, level, message });
    if (c.view === 'form') {
      checkValue(doc, spec, pickGroups(doc, c), [], null, push, townhallMax, null);
      continue;
    }
    for (const [id, value] of entriesOf(doc, c)) {
      checkValue(doc, spec, value, [], id, push, townhallMax, value);
    }
    if (c.id === 'quests') checkQuests(doc, push);
    if (c.id === 'adjacency') checkAdjacency(doc, push);
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
    if (kind !== null && (target === null || !refIds(doc, kind).includes(String(target)))) {
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
