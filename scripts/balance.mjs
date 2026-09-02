// Balance data bridge:
//   balance/balance.xlsx  ⇄  src/sim/data/balance.json  (data sheets)
//   balance/balance.xlsx  ⇄  src/sim/data/region-map.json  (the Map sheet)
//
//   node scripts/balance.mjs import   xlsx → json (validates; the normal flow)
//   node scripts/balance.mjs export   json → xlsx (regenerate the workbook)
//
// The Map sheet IS the world: row 1 holds x labels, column A holds y labels,
// and each grid cell is one map cell — lowercase terrain code, uppercase
// feature code (feature alone implies Grassland), blank = void:
//   g Grassland  w Water  p Plains  d Desert  s Snow  u Tundra
//   T Trees  B BerryBush  A WildAnimals   (compound like "pT" also works)
//
// The workbook is the human-edited source of truth (Excel / LibreOffice /
// Google Sheets); the JSON is generated and consumed by definitions.ts.
// Import fails loudly on unknown columns/ids, missing rows, or bad numbers.
//
// Workbook conventions:
//   - one sheet per table: Districts, Units, Harvest, Currencies,
//     FogRings, Settings
//   - per-level LISTS are comma-separated in one cell:  3,5,7
//     (list cells are text-formatted on export so Excel never turns "3,5"
//     into the number 3.5; pipes "3|5|7" are accepted too)
//   - blank cost cells mean 0 (the currency isn't part of the cost)
//   - formulas are fine — the computed value is what gets imported

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const XLSX_PATH = join(ROOT, 'balance/balance.xlsx');
const JSON_PATH = join(ROOT, 'src/sim/data/balance.json');
const MAP_PATH = join(ROOT, 'src/sim/data/region-map.json');

const TERRAIN_CODES = {
  g: 'Grassland', w: 'Water', p: 'Plains', d: 'Desert', s: 'Snow', u: 'Tundra', m: 'Mountain',
};
const FEATURE_CODES = {
  T: 'Trees', B: 'BerryBush', A: 'WildAnimals', R: 'Rocks', F: 'FishShoal', I: 'IronVein',
};
const MAP_COLORS = { // conditional-formatting fills, keyed by code
  g: 'FF6FA84F', w: 'FF3D6F9E', p: 'FF9AA34F', d: 'FFC9B26A', s: 'FFDFE7EC', u: 'FF8B9A94',
  m: 'FF6B6F78',
  T: 'FF2E6B2E', B: 'FF7A4FA8', A: 'FF8A5A34', R: 'FF7A7F87', F: 'FF2E86AB', I: 'FF4A4E57',
};
// The Townhall footprint — must be feature-free Grassland (anchor 0,0; 2x2).
const TOWNHALL_CELLS = [[0, 0], [1, 0], [0, 1], [1, 1]];

const DISTRICT_IDS = [
  'Townhall', 'Housing', 'Farm', 'FarmLands', 'Sawmill', 'Market', 'Quarry', 'Docks', 'Mine',
  'Sanctum',
  // Military: each unit type is trained by its own building, and building and
  // upgrading them is what raises the army cap.
  'Barracks', 'SpearHall', 'ShootingGrounds', 'Stables',
];
const TECH_IDS = [
  'Forestry',
  'UrbanPlanning', 'Communities', 'Architecture', // civics
  'Agriculture', 'Farming', 'Market', 'CropRotation', // economics: farm side
  'Masonry', 'Mining', 'Engineering', 'DeepMining', // economics: stone side
  'Sailing', 'Fishing', 'Shipbuilding', 'ScalingTools', // exploration
  'Warrior', 'Spears', 'Archery', 'Cavalry', // military
  'Attunement', 'Warband', // the magic and expedition leaves
];
const UPGRADE_IDS = [
  'TapPower', 'QuickHands', 'WorkerLoad', 'MarketStall', 'TradeRoutes',
  'Stonecutting', 'BigNets', 'IronPicks',
];
const UNIT_IDS = ['Warrior', 'Lancer', 'Archer', 'Cavalry'];
const HARVEST_IDS = ['Forest', 'Crops', 'Berries', 'Meat', 'Stone', 'Fish', 'Iron'];
// Order matters: it is the Currencies sheet order AND the Market's sell order.
const QUEST_GOAL_TYPES = {
  // absolute — goal_target validated against the named id list (null = none)
  BuildDistrict: 'district', UpgradeDistrict: 'district', HoldResource: 'currency',
  ReachPopulation: null, CompleteTech: 'tech', CompleteTechs: null,
  AssignWorkers: null, TrainArmy: null,
  // The long game: magic and expeditions.
  ClaimLandmarks: null, ReachDepth: null, ClearRuins: null, OwnArtifacts: null,
  // relative
  CollectResource: 'currency', CollectTaps: null, DiscoverCells: null, SellGoods: null,
};

const LANDMARK_KINDS = ['Shrine', 'StandingStones', 'Leyspring'];
const RUIN_IDS = [
  'HollowBarrow', 'SunkenChapel', 'DrownedIronworks', 'CountingHouse', 'StarObservatory',
];
const HERO_IDS = ['Warden', 'Quartermaster', 'Scholar', 'RelicHunter', 'Scout'];
const HERO_TRAITS = [
  'PartyDefence', 'SupplyDiscount', 'KnowledgeBonus', 'FragmentBonus', 'RevealNextDepth',
];
const ARTIFACT_IDS = [
  'DowsingRod', 'VerdantSeal', 'ForemansSigil', 'GildedLedger', 'WanderersCompass',
];

const CURRENCY_IDS = [
  'Gold', 'Food', 'Wood', 'Stone', 'Iron', 'Mana',
  'Berries', 'Meat', 'Fish', 'Knowledge', 'Gems',
];
const COST_CURRENCIES = ['Gold', 'Wood', 'Food', 'Stone', 'Iron'];

const SETTINGS = [
  // [sheet key, json path, kind]
  ['worker.move_speed_tiles_per_second', 'worker.moveSpeedTilesPerSecond'],
  ['worker.work_seconds', 'worker.workSeconds'],
  ['tap.collect_cooldown_seconds', 'tap.collectCooldownSeconds'],
  ['training.seconds', 'training.seconds'],
  ['training.tap_boost_seconds', 'training.tapBoostSeconds'],
  ['taxes.gold_per_population_per_minute', 'taxes.goldPerPopulationPerMinute'],
  ['tap.mana_cost', 'tap.manaCost'],
  // The one number behind every tap in the game: a tap hands you this many
  // seconds of whatever you tapped is producing. Houses have always worked
  // this way; resource cells now join them.
  ['tap.boost_seconds', 'tap.boostSeconds'],
  ['offline_cap_hours', 'offlineCapHours'],
  ['fog.gold_per_tap', 'fog.goldPerTap'],
  ['fog.fallback_growth', 'fog.fallbackGrowth'],
  ['city.initial_population', 'city.initialPopulation'],
  ['city.initial_gold', 'city.initialCurrencies.Gold'],
  ['city.initial_food', 'city.initialCurrencies.Food'],
  ['city.population_cost_base', 'city.populationCostBase'],
  ['city.population_cost_growth', 'city.populationCostGrowth'],
  ['city.build_queue_capacity', 'city.buildQueueCapacity'],
  ['kingdom.start_builders', 'kingdom.startBuilders'],
  ['kingdom.max_builders', 'kingdom.maxBuilders'],
  ['research.tech_slots', 'research.techSlots'],
  ['research.max_slots', 'research.maxSlots'],
  ['research.slot_gem_cost_base', 'research.slotGemCostBase'],
  ['research.slot_gem_cost_growth', 'research.slotGemCostGrowth'],
  // Mana. The ceiling is DYNAMIC (Townhall level + Sanctum levels), so the
  // Currencies sheet's static `cap` column stays blank for Mana and these are
  // the numbers that actually decide it — see src/sim/mana.ts.
  ['mana.production_per_townhall_level', 'mana.productionPerTownhallLevel', 'list'],
  ['mana.base_cap_per_townhall_level', 'mana.baseCapPerTownhallLevel', 'list'],
  ['mana.sanctum_cap_per_level', 'mana.sanctumCapPerLevel', 'list'],
  ['mana.landmark_cap', 'mana.landmarkCap'],
  ['mana.gem_refill_per_gem', 'mana.gemRefillPerGem'],
  ['attunement.base_slots', 'attunement.baseSlots'],
  ['attunement.max_slots', 'attunement.maxSlots'],
  ['attunement.slot_gem_cost_base', 'attunement.slotGemCostBase'],
  ['attunement.slot_gem_cost_growth', 'attunement.slotGemCostGrowth'],
  ['attunement.swap_lock_seconds', 'attunement.swapLockSeconds'],
  // The COLLECTION substrate: one set of rules shared by artifacts and heroes.
  // Fragments raise a tier cap; Knowledge buys levels within it.
  ['collection.level_cost_base', 'collection.levelCostBase'],
  ['collection.level_cost_growth', 'collection.levelCostGrowth'],
  ['collection.max_level', 'collection.maxLevel'],
  ['collection.levels_per_tier', 'collection.levelsPerTier'],
  ['collection.max_tier', 'collection.maxTier'],
  ['collection.fragments_per_tier_base', 'collection.fragmentsPerTierBase'],
  ['collection.fragments_per_tier_growth', 'collection.fragmentsPerTierGrowth'],
  ['knowledge.drip_per_ruin_per_hour', 'knowledge.dripPerRuinPerHour'],
  // Combat is a SCORING PASS, not a simulation — these six numbers are the
  // whole of it. Sharper type values (x2/x0.5) are more dramatic but make one
  // bad guess feel like a wasted trip, which is the un-cozy end of the dial.
  ['army.train_tap_boost_seconds', 'army.trainTapBoostSeconds'],
  ['army.type_advantage', 'army.typeAdvantage'],
  ['army.type_disadvantage', 'army.typeDisadvantage'],
  ['army.threat_floor_fraction', 'army.threatFloorFraction'],
  ['army.damage_per_strength', 'army.damagePerStrength'],
  ['army.damage_absorbed_per_defence', 'army.damageAbsorbedPerDefence'],
  // Delves. `fail_haul_loss` is the number that most needs playtest rather
  // than argument: lower is gentler and may make pushing automatic, higher
  // bites but starts to feel like the loss aversion the positioning rules out.
  ['delve.gold_per_depth_per_tier', 'delve.goldPerDepthPerTier'],
  ['delve.material_per_depth_per_tier', 'delve.materialPerDepthPerTier'],
  ['delve.knowledge_per_depth_per_tier', 'delve.knowledgePerDepthPerTier'],
  ['delve.fragments_per_depth', 'delve.fragmentsPerDepth'],
  ['delve.fail_haul_loss', 'delve.failHaulLoss'],
  ['delve.first_clear_gems', 'delve.firstClearGems'],
  ['party.base_slots', 'party.baseSlots'],
  ['party.max_slots', 'party.maxSlots'],
  ['party.slot_gem_cost_base', 'party.slotGemCostBase'],
  ['party.slot_gem_cost_growth', 'party.slotGemCostGrowth'],
  // The gacha. Pity is MANDATORY: it is the single thing that makes a gacha
  // read as fair rather than predatory, and it matters more in a cozy game.
  ['gacha.pull_gem_cost', 'gacha.pullGemCost'],
  ['gacha.hero_chance', 'gacha.heroChance'],
  ['gacha.soft_pity_at', 'gacha.softPityAt'],
  ['gacha.hard_pity_at', 'gacha.hardPityAt'],
  ['gacha.duplicate_fragments', 'gacha.duplicateFragments'],
  ['gacha.fragments_per_miss', 'gacha.fragmentsPerMiss'],
  // Ad offers. The cooldown is a RANGE so the offer never becomes a metronome
  // the player can plan around; `eligible_below_fraction` is what keeps it an
  // answer to being short rather than an interruption.
  ['ads.cooldown_min_seconds', 'ads.cooldownMinSeconds'],
  ['ads.cooldown_max_seconds', 'ads.cooldownMaxSeconds'],
  ['ads.eligible_below_fraction', 'ads.eligibleBelowFraction'],
  ['ads.watch_seconds', 'ads.watchSeconds'],
];

const DISTRICT_COLUMNS = [
  'id', 'size_x', 'size_y', 'max_level', 'population_capacity',
  'fog_reveal_radius', 'fog_discover_radius',
  'max_workers_per_level', 'max_count_per_townhall_level',
  'influence_radius_per_level', 'required_townhall_level_per_level',
  'required_tech_per_level', 'army_cap_per_level',
  'build_cost_gold', 'build_cost_wood', 'build_cost_food',
  'build_cost_stone', 'build_cost_iron',
  'build_cost_multiplier', 'build_cost_exponential_growth',
  'build_duration_seconds', 'build_duration_district_growth', 'build_duration_distance_growth',
  'upgrade_cost_gold', 'upgrade_cost_wood', 'upgrade_cost_food',
  'upgrade_cost_stone', 'upgrade_cost_iron',
  'upgrade_cost_level_growth', 'upgrade_duration_seconds', 'upgrade_duration_level_growth',
];
const DISTRICT_LIST_COLUMNS = [
  'population_capacity', 'max_workers_per_level', 'max_count_per_townhall_level',
  'influence_radius_per_level', 'required_townhall_level_per_level',
  'required_tech_per_level', 'army_cap_per_level',
];

const SHEETS = {
  Districts: DISTRICT_COLUMNS,
  Units: ['id', 'power', 'atk', 'def', 'hp',
    'recruit_cost_gold', 'recruit_cost_wood', 'recruit_cost_food',
    'recruit_cost_stone', 'recruit_cost_iron', 'train_duration_seconds'],
  Harvest: ['source', 'yield_per_tap', 'yield_per_worker', 'taps_to_exhaust', 'recovery_seconds',
    'respawn_seconds'],
  Currencies: ['id', 'cap', 'start', 'primary', 'counts_as', 'unit_value', 'gold_value'],
  FogRings: ['distance', 'cost'],
  Technologies: ['id', 'cost_gold', 'cost_wood', 'cost_food', 'cost_stone', 'cost_iron',
    'duration_seconds', 'requires'],
  Upgrades: ['id', 'cost_base', 'cost_growth', 'max_level', 'effect_per_level', 'required_tech'],
  Adjacency: ['district', 'neighbor', 'gold_per_minute'],
  Quests: ['id', 'name', 'description', 'goal_type', 'goal_target', 'goal_amount',
    'goal_level', 'reward_gold', 'reward_wood', 'reward_food', 'reward_stone', 'reward_iron',
    'reward_gems'],
  Artifacts: ['id', 'passive_base', 'passive_per_level', 'active_mana_cost',
    'active_duration_seconds', 'active_radius',
    'carried_atk', 'carried_def', 'carried_hp',
    'carried_atk_per_level', 'carried_def_per_level', 'carried_hp_per_level'],
  Heroes: ['id', 'unit_type', 'trait', 'trait_value', 'atk', 'def', 'hp',
    'atk_per_level', 'def_per_level', 'hp_per_level'],
  Landmarks: ['id', 'kind', 'x', 'y', 'defended', 'claim_cost'],
  Ruins: ['id', 'x', 'y', 'tier', 'difficulty', 'base_depth_seconds', 'depth_growth',
    'max_depth', 'supply_food', 'supply_gold', 'supply_iron', 'affinity', 'artifact'],
  Settings: ['key', 'value'],
};

// -------------------------------------------------------------- xlsx reading

function fail(where, msg) {
  console.error(`balance: ${where}: ${msg}`);
  process.exit(1);
}

/** A cell's raw value as either a number (kept exact) or a trimmed string. */
function cellValue(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('').trim();
    if (v.result !== undefined && v.result !== null) return cellValue(v.result); // formula
    if (v.formula !== undefined) return ''; // formula with no cached result
    if (v.text !== undefined) return String(v.text).trim(); // hyperlink
    return String(v).trim();
  }
  return String(v).trim();
}

/** Read one sheet into row objects keyed by header. */
function readSheet(workbook, name) {
  const ws = workbook.getWorksheet(name);
  if (!ws) fail(name, 'sheet not found — run "npm run balance:export" to regenerate the workbook');
  const expected = SHEETS[name];
  const header = [];
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    header[col] = String(cellValue(cell.value));
  });
  for (const col of header.filter(Boolean)) {
    if (!expected.includes(col)) fail(name, `unknown column "${col}"`);
  }
  for (const col of expected) {
    if (!header.includes(col)) fail(name, `missing column "${col}"`);
  }
  const rows = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const out = { _row: rowNumber, _sheet: name };
    let hasContent = false;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      if (!header[col]) return;
      // Spill/array formulas (SEQUENCE, ...) can't be read: only the master
      // cell has a cached result — the spilled cells arrive blank.
      if (cell.value && typeof cell.value === 'object' && cell.value.shareType === 'array') {
        fail(`${name} row ${rowNumber}`,
          `"${header[col]}" uses an array formula (${cell.value.formula}) — ` +
          'spilled values cannot be imported; use plain values or per-cell formulas');
      }
      const v = cellValue(cell.value);
      if (v !== '') hasContent = true;
      out[header[col]] = v;
    });
    if (hasContent) rows.push(out);
  });
  if (rows.length === 0) fail(name, 'no data rows');
  return rows;
}

const where = (row) => `${row._sheet} row ${row._row}`;

function num(row, col, { blankAs = null } = {}) {
  const raw = row[col];
  if (raw === '' || raw === undefined) {
    if (blankAs !== null) return blankAs;
    fail(where(row), `"${col}" is blank`);
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) fail(where(row), `"${col}" is not a non-negative number (got "${raw}")`);
  return n;
}

/** A map coordinate: any integer, including negative ones. */
function coord(row, col) {
  const raw = row[col];
  if (raw === '' || raw === undefined) fail(where(row), `"${col}" is blank`);
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(n)) fail(where(row), `"${col}" is not an integer (got "${raw}")`);
  return n;
}

/** Like num() but negatives are allowed (adjacency penalties); blank = 0. */
function signedNum(row, col) {
  const raw = row[col];
  if (raw === '' || raw === undefined) return 0;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) fail(where(row), `"${col}" is not a number (got "${raw}")`);
  return n;
}

function list(row, col) {
  const raw = row[col];
  if (raw === '' || raw === undefined) return [];
  if (typeof raw === 'number') {
    // A one-entry list arrives as a number; a NON-integer one usually means
    // Excel turned "3,5" into 3.5 because the cell lost its Text format.
    if (!Number.isInteger(raw)) {
      fail(where(row), `"${col}" is ${raw} — if you meant a list, format the cell as Text and re-enter it (e.g. 3,5)`);
    }
    return [raw];
  }
  return String(raw).split(/[,|;]/).map((part) => {
    const n = Number(part.trim());
    if (!Number.isFinite(n) || n < 0) fail(where(row), `"${col}" has a bad list entry ("${part}")`);
    return n;
  });
}

/** Per-level tech list: comma-separated tech ids, "-" (or blank entry) = no
 *  requirement at that level. Blank cell = no requirements at all. */
function techList(row, col) {
  const raw = row[col];
  if (raw === '' || raw === undefined) return [];
  return String(raw).split(/[,|;]/).map((part) => {
    const id = part.trim();
    if (id === '' || id === '-') return null;
    if (!TECH_IDS.includes(id)) fail(where(row), `"${col}" has an unknown tech ("${id}")`);
    return id;
  });
}

function wallet(row, prefix) {
  const out = {};
  for (const c of COST_CURRENCIES) {
    const v = num(row, `${prefix}_${c.toLowerCase()}`, { blankAs: 0 });
    if (v > 0) out[c] = v;
  }
  return out;
}

function byId(rows, expectedIds, idColumn = 'id') {
  const seen = new Map();
  for (const row of rows) {
    const id = row[idColumn];
    if (!expectedIds.includes(id)) fail(where(row), `unknown ${idColumn} "${id}"`);
    if (seen.has(id)) fail(where(row), `duplicate ${idColumn} "${id}"`);
    seen.set(id, row);
  }
  for (const id of expectedIds) {
    if (!seen.has(id)) fail(rows[0]._sheet, `missing row for ${idColumn} "${id}"`);
  }
  return seen;
}

// ---------------------------------------------------------------- Map sheet

/** Read the Map sheet's coordinate labels: row 1 → x per column, col A → y per row. */
function readMapLabels(ws) {
  const xByCol = new Map();
  const yByRow = new Map();
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    if (col === 1) return;
    const v = cellValue(cell.value);
    if (v === '') return;
    if (typeof v !== 'number' || !Number.isInteger(v)) fail('Map', `row 1: bad x label "${v}"`);
    xByCol.set(col, v);
  });
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const v = cellValue(row.getCell(1).value);
    if (v === '') return;
    if (typeof v !== 'number' || !Number.isInteger(v)) fail('Map', `column A: bad y label "${v}"`);
    yByRow.set(rowNumber, v);
  });
  if (xByCol.size === 0 || yByRow.size === 0) fail('Map', 'missing coordinate labels');
  return { xByCol, yByRow };
}

/** Map sheet → region-map.json. */
function importMap(workbook) {
  const ws = workbook.getWorksheet('Map');
  if (!ws) fail('Map', 'sheet not found — run "npm run balance:export" to regenerate the workbook');
  const { xByCol, yByRow } = readMapLabels(ws);

  const terrain = [];
  const features = [];
  const byCoord = new Map();
  ws.eachRow((row, rowNumber) => {
    const y = yByRow.get(rowNumber);
    if (y === undefined) return;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const x = xByCol.get(col);
      if (x === undefined) return;
      const code = String(cellValue(cell.value)).trim();
      if (code === '') return;
      const m = code.match(/^([a-z])?([A-Z])?$/);
      if (!m || (!m[1] && !m[2])) fail('Map', `cell (${x},${y}): unknown code "${code}"`);
      const terrainId = m[1] ? TERRAIN_CODES[m[1]] : 'Grassland'; // bare feature = grass
      if (m[1] && !terrainId) fail('Map', `cell (${x},${y}): unknown terrain code "${m[1]}"`);
      const featureId = m[2] ? FEATURE_CODES[m[2]] : null;
      if (m[2] && !featureId) fail('Map', `cell (${x},${y}): unknown feature code "${m[2]}"`);
      terrain.push({ x, y, id: terrainId });
      if (featureId) features.push({ x, y, id: featureId });
      byCoord.set(`${x},${y}`, { terrainId, featureId });
    });
  });
  if (terrain.length === 0) fail('Map', 'the map is empty');

  for (const [x, y] of TOWNHALL_CELLS) {
    const c = byCoord.get(`${x},${y}`);
    if (!c || c.terrainId !== 'Grassland' || c.featureId) {
      fail('Map', `the Townhall footprint cell (${x},${y}) must be feature-free Grassland ("g")`);
    }
  }

  const order = (a, b) => a.y - b.y || a.x - b.x;
  terrain.sort(order);
  features.sort(order);
  writeFileSync(MAP_PATH, JSON.stringify(
    { terrain: { cells: terrain }, features: { cells: features } }, null, 2) + '\n');
  console.log(`balance: wrote ${MAP_PATH} (${terrain.length} cells, ${features.length} features)`);
  return byCoord;
}

/** Every landmark and ruin has to sit on a real, walkable, empty cell. Getting
 *  this wrong authors a site nobody can ever reach, which is invisible until a
 *  player fails to find it. */
function checkSites(out, cells) {
  const townhall = new Set(TOWNHALL_CELLS.map(([x, y]) => `${x},${y}`));
  const check = (what, x, y) => {
    const c = cells.get(`${x},${y}`);
    if (!c) fail('sites', `${what} is on (${x},${y}), which is not a map cell`);
    if (c.terrainId === 'Water') fail('sites', `${what} is on water at (${x},${y})`);
    if (c.featureId) fail('sites', `${what} shares (${x},${y}) with a ${c.featureId}`);
    if (townhall.has(`${x},${y}`)) fail('sites', `${what} is under the Townhall at (${x},${y})`);
  };
  for (const l of out.landmarks) check(`landmark ${l.id}`, l.x, l.y);
  for (const [id, r] of Object.entries(out.ruins)) check(`ruin ${id}`, r.x, r.y);
  console.log(`balance: ${out.landmarks.length} landmarks and ${Object.keys(out.ruins).length} ruins check out`);
}

/** region-map.json → Map sheet (with live color rules per code). */
function exportMap(workbook) {
  const m = JSON.parse(readFileSync(MAP_PATH, 'utf8'));
  const featureAt = new Map(m.features.cells.map((c) => [`${c.x},${c.y}`, c.id]));
  const xs = m.terrain.cells.map((c) => c.x);
  const ys = m.terrain.cells.map((c) => c.y);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];

  const ws = workbook.addWorksheet('Map', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });
  ws.getColumn(1).width = 4;
  for (let x = x0; x <= x1; x++) {
    ws.getRow(1).getCell(x - x0 + 2).value = x;
    ws.getColumn(x - x0 + 2).width = 3.5;
  }
  ws.getRow(1).font = { bold: true };
  for (let y = y0; y <= y1; y++) {
    const row = ws.getRow(y - y0 + 2);
    row.getCell(1).value = y;
    row.getCell(1).font = { bold: true };
  }
  const terrainLetter = Object.fromEntries(
    Object.entries(TERRAIN_CODES).map(([k, v]) => [v, k]));
  const featureLetter = Object.fromEntries(
    Object.entries(FEATURE_CODES).map(([k, v]) => [v, k]));
  for (const c of m.terrain.cells) {
    const feature = featureAt.get(`${c.x},${c.y}`);
    const code = feature
      ? (c.id === 'Grassland' ? '' : terrainLetter[c.id]) + featureLetter[feature]
      : terrainLetter[c.id];
    const cell = ws.getRow(c.y - y0 + 2).getCell(c.x - x0 + 2);
    cell.value = code;
    cell.numFmt = '@';
    cell.alignment = { horizontal: 'center' };
  }
  // Live colors: the fill follows the code as you type.
  const ref = `B2:${ws.getColumn(x1 - x0 + 2).letter}${y1 - y0 + 2}`;
  ws.addConditionalFormatting({
    ref,
    rules: Object.entries(MAP_COLORS).map(([code, argb], i) => ({
      type: 'cellIs', operator: 'equal', formulae: [`"${code}"`], priority: i + 1,
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb } } },
    })),
  });
}

// ------------------------------------------------------------------- import

async function importXlsx() {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(XLSX_PATH);
  } catch {
    fail('balance.xlsx', 'cannot read the workbook — run "npm run balance:export" to regenerate it');
  }

  const out = {
    _note: 'GENERATED from balance/balance.xlsx — edit the workbook and run: npm run balance',
    districts: {}, harvest: {}, currencies: {}, units: {}, technologies: {}, upgrades: {},
    research: {},
    worker: {}, tap: {}, training: {}, taxes: {}, adjacency: [],
    mana: {}, attunement: {}, collection: {}, knowledge: {}, army: {},
    delve: {}, party: {}, gacha: {}, heroes: {}, ads: {},
    landmarks: [], ruins: {}, artifacts: {},
    quests: [],
    fog: { silverPerTap: 0, rings: [], fallbackGrowth: 0 },
    city: { initialCurrencies: {} }, kingdom: {},
    offlineCapHours: 0,
  };

  for (const [id, r] of byId(readSheet(workbook, 'Districts'), DISTRICT_IDS)) {
    out.districts[id] = {
      size: { x: num(r, 'size_x'), y: num(r, 'size_y') },
      maxLevel: num(r, 'max_level'),
      populationCapacityPerLevel: list(r, 'population_capacity'),
      fogRevealRadius: num(r, 'fog_reveal_radius'),
      fogDiscoverRadius: num(r, 'fog_discover_radius'),
      maxWorkersPerLevel: list(r, 'max_workers_per_level'),
      maxCountPerTownhallLevel: list(r, 'max_count_per_townhall_level'),
      influenceRadiusPerLevel: list(r, 'influence_radius_per_level'),
      requiredTownhallLevelPerLevel: list(r, 'required_townhall_level_per_level'),
      requiredTechPerLevel: techList(r, 'required_tech_per_level'),
      armyCapPerLevel: list(r, 'army_cap_per_level'),
      buildCost: wallet(r, 'build_cost'),
      buildCostMultiplier: num(r, 'build_cost_multiplier'),
      buildCostExponentialGrowth: num(r, 'build_cost_exponential_growth'),
      buildDurationSeconds: num(r, 'build_duration_seconds'),
      buildDurationDistrictGrowth: num(r, 'build_duration_district_growth'),
      buildDurationDistanceGrowth: num(r, 'build_duration_distance_growth'),
      upgradeCost: wallet(r, 'upgrade_cost'),
      upgradeCostLevelGrowth: num(r, 'upgrade_cost_level_growth'),
      upgradeDurationSeconds: num(r, 'upgrade_duration_seconds'),
      upgradeDurationLevelGrowth: num(r, 'upgrade_duration_level_growth'),
    };
  }

  for (const [id, r] of byId(readSheet(workbook, 'Harvest'), HARVEST_IDS, 'source')) {
    out.harvest[id] = {
      yieldPerTap: num(r, 'yield_per_tap'),
      yieldPerWorker: num(r, 'yield_per_worker'),
      tapsToExhaust: num(r, 'taps_to_exhaust'),
      recoverySeconds: num(r, 'recovery_seconds'),
      respawnSeconds: num(r, 'respawn_seconds', { blankAs: 0 }),
    };
  }

  const currencyRows = byId(readSheet(workbook, 'Currencies'), CURRENCY_IDS);
  for (const [id, r] of currencyRows) {
    // primary = shown in the top resource bar; blank/0 = hidden.
    const primary = num(r, 'primary', { blankAs: 0 }) === 1;
    // gold_value = the Market sells 1 unit for this much Gold; blank = not sellable.
    const goldValue = (r.gold_value === '' || r.gold_value === undefined)
      ? null : num(r, 'gold_value');
    if (goldValue !== null && (goldValue <= 0 || id === 'Gold')) {
      fail(where(r), 'gold_value must be positive and not on Gold itself');
    }
    const countsAs = (r.counts_as === '' || r.counts_as === undefined) ? null : r.counts_as;
    let countsAsOut = null;
    if (countsAs !== null) {
      if (!CURRENCY_IDS.includes(countsAs)) fail(where(r), `unknown counts_as currency "${countsAs}"`);
      const baseRow = currencyRows.get(countsAs);
      if (baseRow && baseRow.counts_as) fail(where(r), `counts_as chains are not allowed ("${countsAs}" is itself equivalent)`);
      const value = num(r, 'unit_value');
      if (value <= 0) fail(where(r), 'unit_value must be positive');
      countsAsOut = { currency: countsAs, value };
    } else if (r.unit_value !== '' && r.unit_value !== undefined) {
      fail(where(r), 'unit_value without counts_as');
    }
    out.currencies[id] = {
      cap: (r.cap === '' || r.cap === undefined) ? null : num(r, 'cap'),
      start: num(r, 'start'),
      primary,
      countsAs: countsAsOut,
      goldValue,
    };
  }

  for (const [id, r] of byId(readSheet(workbook, 'Units'), UNIT_IDS)) {
    const atk = num(r, 'atk');
    // A unit's POWER — what it costs against the army cap — equals its ATK,
    // so the cap table reads directly as attack potential.
    if (num(r, 'power') !== atk) fail(where(r), `power must equal atk (${atk})`);
    out.units[id] = {
      power: atk,
      atk,
      def: num(r, 'def'),
      hp: num(r, 'hp'),
      recruitCost: wallet(r, 'recruit_cost'),
      trainDurationSeconds: num(r, 'train_duration_seconds'),
    };
  }

  for (const [id, r] of byId(readSheet(workbook, 'Technologies'), TECH_IDS)) {
    const requires = (r.requires === '' || r.requires === undefined)
      ? [] : String(r.requires).split(/[,;]/).map((part) => part.trim());
    for (const req of requires) {
      if (!TECH_IDS.includes(req)) fail(where(r), `unknown required tech "${req}"`);
      if (req === id) fail(where(r), 'a technology cannot require itself');
    }
    out.technologies[id] = {
      cost: wallet(r, 'cost'),
      durationSeconds: num(r, 'duration_seconds'),
      requires,
    };
  }

  for (const [id, r] of byId(readSheet(workbook, 'Upgrades'), UPGRADE_IDS)) {
    const requiredTech = (r.required_tech === '' || r.required_tech === undefined)
      ? null : r.required_tech;
    if (requiredTech !== null && !TECH_IDS.includes(requiredTech)) {
      fail(where(r), `unknown required_tech "${requiredTech}"`);
    }
    out.upgrades[id] = {
      costBase: num(r, 'cost_base'),
      costGrowth: num(r, 'cost_growth'),
      maxLevel: num(r, 'max_level'),
      effectPerLevel: num(r, 'effect_per_level'),
      requiredTech,
    };
  }

  const adjacencySeen = new Set();
  for (const r of readSheet(workbook, 'Adjacency')) {
    for (const col of ['district', 'neighbor']) {
      if (!DISTRICT_IDS.includes(r[col])) fail(where(r), `unknown ${col} "${r[col]}"`);
    }
    const pair = `${r.district}+${r.neighbor}`;
    if (adjacencySeen.has(pair)) fail(where(r), `duplicate adjacency rule ${pair}`);
    adjacencySeen.add(pair);
    out.adjacency.push({
      district: r.district,
      neighbor: r.neighbor,
      goldPerMinute: signedNum(r, 'gold_per_minute'),
    });
  }

  const questIds = new Set();
  for (const r of readSheet(workbook, 'Quests')) {
    if (!(r.goal_type in QUEST_GOAL_TYPES)) fail(where(r), `unknown goal_type "${r.goal_type}"`);
    if (questIds.has(r.id)) fail(where(r), `duplicate quest id "${r.id}"`);
    questIds.add(r.id);
    const targetKind = QUEST_GOAL_TYPES[r.goal_type];
    const target = (r.goal_target === '' || r.goal_target === undefined) ? null : r.goal_target;
    const lists = { district: DISTRICT_IDS, tech: TECH_IDS, currency: CURRENCY_IDS };
    if (targetKind === null && target !== null) {
      fail(where(r), `goal_type ${r.goal_type} takes no goal_target`);
    }
    if (targetKind !== null && (target === null || !lists[targetKind].includes(target))) {
      fail(where(r), `goal_target "${target}" is not a valid ${targetKind}`);
    }
    const amount = num(r, 'goal_amount');
    if (amount < 1) fail(where(r), 'goal_amount must be ≥ 1');
    const level = (r.goal_level === '' || r.goal_level === undefined) ? null : num(r, 'goal_level');
    if ((r.goal_type === 'UpgradeDistrict') !== (level !== null)) {
      fail(where(r), 'goal_level is required for UpgradeDistrict and only there');
    }
    out.quests.push({
      id: r.id,
      name: String(r.name),
      description: String(r.description),
      goalType: r.goal_type,
      goalTarget: target,
      goalAmount: amount,
      goalLevel: level,
      reward: wallet(r, 'reward'),
      rewardGems: num(r, 'reward_gems', { blankAs: 0 }),
    });
  }

  for (const [id, r] of byId(readSheet(workbook, 'Artifacts'), ARTIFACT_IDS)) {
    out.artifacts[id] = {
      passiveBase: signedNum(r, 'passive_base'),
      passivePerLevel: signedNum(r, 'passive_per_level'),
      activeManaCost: num(r, 'active_mana_cost', { blankAs: 0 }),
      activeDurationSeconds: num(r, 'active_duration_seconds', { blankAs: 0 }),
      activeRadius: num(r, 'active_radius', { blankAs: 0 }),
      // What the relic is worth when a hero carries it DOWN instead of the
      // kingdom wearing it. Attuning costs Mana every hour; carrying costs
      // none — so the trade is never "which is cheaper" but "which do I need
      // right now". A relic with no carried stats at all would make that a
      // non-question, so every one of them earns its keep underground.
      carriedAtk: num(r, 'carried_atk', { blankAs: 0 }),
      carriedDef: num(r, 'carried_def', { blankAs: 0 }),
      carriedHp: num(r, 'carried_hp', { blankAs: 0 }),
      carriedAtkPerLevel: num(r, 'carried_atk_per_level', { blankAs: 0 }),
      carriedDefPerLevel: num(r, 'carried_def_per_level', { blankAs: 0 }),
      carriedHpPerLevel: num(r, 'carried_hp_per_level', { blankAs: 0 }),
    };
  }

  for (const [id, r] of byId(readSheet(workbook, 'Heroes'), HERO_IDS)) {
    if (!UNIT_IDS.includes(r.unit_type)) fail(where(r), `unknown unit_type "${r.unit_type}"`);
    if (!HERO_TRAITS.includes(r.trait)) fail(where(r), `unknown trait "${r.trait}"`);
    out.heroes[id] = {
      unitType: r.unit_type,
      trait: r.trait,
      traitValue: num(r, 'trait_value'),
      atk: num(r, 'atk'),
      def: num(r, 'def'),
      hp: num(r, 'hp'),
      atkPerLevel: num(r, 'atk_per_level'),
      defPerLevel: num(r, 'def_per_level'),
      hpPerLevel: num(r, 'hp_per_level'),
    };
  }

  // Landmarks and ruins are MAP content authored by coordinate. The importer
  // is the only place that can check the cell actually exists, is land, and is
  // not already occupied by a feature or the Townhall — so it does.
  const siteSeen = new Map();
  const claimSite = (r, x, y, what) => {
    const key = `${x},${y}`;
    if (siteSeen.has(key)) fail(where(r), `two sites on cell (${key}) — ${siteSeen.get(key)} is already there`);
    siteSeen.set(key, what);
    return key;
  };
  const landmarkIds = new Set();
  for (const r of readSheet(workbook, 'Landmarks')) {
    if (!LANDMARK_KINDS.includes(r.kind)) fail(where(r), `unknown landmark kind "${r.kind}"`);
    if (landmarkIds.has(r.id)) fail(where(r), `duplicate landmark id "${r.id}"`);
    landmarkIds.add(r.id);
    const x = coord(r, 'x');
    const y = coord(r, 'y');
    claimSite(r, x, y, r.id);
    out.landmarks.push({
      id: String(r.id), kind: r.kind, x, y,
      defended: num(r, 'defended', { blankAs: 0 }) === 1,
      // Authored per sanctuary, not derived from distance. The tiers ARE the
      // design — one in sight you save weeks for, then two rings beyond it —
      // and a curve cannot express "5,000 / 25,000 / 100,000" exactly.
      claimCost: num(r, 'claim_cost'),
    });
  }

  for (const [id, r] of byId(readSheet(workbook, 'Ruins'), RUIN_IDS)) {
    const x = coord(r, 'x');
    const y = coord(r, 'y');
    claimSite(r, x, y, id);
    if (r.affinity !== 'Any' && !UNIT_IDS.includes(r.affinity)) {
      fail(where(r), `affinity must be a unit id or "Any" (got "${r.affinity}")`);
    }
    if (!ARTIFACT_IDS.includes(r.artifact)) fail(where(r), `unknown artifact "${r.artifact}"`);
    const supplies = {};
    for (const c of ['Food', 'Gold', 'Iron']) {
      const v = num(r, `supply_${c.toLowerCase()}`, { blankAs: 0 });
      if (v > 0) supplies[c] = v;
    }
    out.ruins[id] = {
      x, y,
      tier: num(r, 'tier'),
      difficulty: num(r, 'difficulty'),
      baseDepthSeconds: num(r, 'base_depth_seconds'),
      depthGrowth: num(r, 'depth_growth'),
      maxDepth: num(r, 'max_depth'),
      supplies,
      affinity: r.affinity,
      artifact: r.artifact,
    };
  }

  let lastDistance = 0;
  for (const r of readSheet(workbook, 'FogRings')) {
    const distance = num(r, 'distance');
    if (distance <= lastDistance) fail(where(r), 'distances must be ascending');
    lastDistance = distance;
    out.fog.rings.push({ distance, cost: num(r, 'cost') });
  }

  const settings = byId(readSheet(workbook, 'Settings'), SETTINGS.map(([k]) => k), 'key');
  for (const [key, path, kind] of SETTINGS) {
    const row = settings.get(key);
    const value = kind === 'list' ? list(row, 'value') : num(row, 'value');
    const parts = path.split('.');
    let target = out;
    while (parts.length > 1) target = target[parts.shift()];
    target[parts[0]] = value;
  }

  writeFileSync(JSON_PATH, JSON.stringify(out, null, 2) + '\n');
  console.log(`balance: wrote ${JSON_PATH}`);
  const cells = importMap(workbook);
  checkSites(out, cells);
}

// ------------------------------------------------------------------- export

const listCell = (arr) => arr.join(',');
const costCells = (w) => COST_CURRENCIES.map((c) => (w[c] && w[c] !== 0 ? w[c] : ''));

/** isTextCell(colName, rowValues) marks list cells: they get Excel's Text
 *  format so a two-entry list like "3,5" can't collapse into the number 3.5. */
function addSheet(workbook, name, rows, isTextCell = () => false) {
  const columns = SHEETS[name];
  const ws = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.addRow(columns);
  ws.getRow(1).font = { bold: true };
  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = Math.max(col.length + 2, 10);
  });
  for (const row of rows) {
    const added = ws.addRow(row.map((v, i) => (isTextCell(columns[i], row) ? String(v) : v)));
    added.eachCell({ includeEmpty: true }, (cell, col) => {
      if (isTextCell(columns[col - 1], row)) cell.numFmt = '@';
    });
  }
}

async function exportXlsx() {
  const b = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
  const workbook = new ExcelJS.Workbook();

  addSheet(workbook, 'Districts', DISTRICT_IDS.map((id) => {
    const d = b.districts[id];
    return [
      id, d.size.x, d.size.y, d.maxLevel, listCell(d.populationCapacityPerLevel),
      d.fogRevealRadius, d.fogDiscoverRadius,
      listCell(d.maxWorkersPerLevel), listCell(d.maxCountPerTownhallLevel),
      listCell(d.influenceRadiusPerLevel), listCell(d.requiredTownhallLevelPerLevel),
      listCell(d.requiredTechPerLevel.map((t) => t ?? '-')),
      listCell(d.armyCapPerLevel),
      ...costCells(d.buildCost),
      d.buildCostMultiplier, d.buildCostExponentialGrowth,
      d.buildDurationSeconds, d.buildDurationDistrictGrowth, d.buildDurationDistanceGrowth,
      ...costCells(d.upgradeCost),
      d.upgradeCostLevelGrowth, d.upgradeDurationSeconds, d.upgradeDurationLevelGrowth,
    ];
  }), (col) => DISTRICT_LIST_COLUMNS.includes(col));

  addSheet(workbook, 'Units', UNIT_IDS.map((id) => {
    const u = b.units[id];
    return [id, u.power, u.atk, u.def, u.hp, ...costCells(u.recruitCost), u.trainDurationSeconds];
  }));

  addSheet(workbook, 'Harvest', HARVEST_IDS.map((id) => {
    const h = b.harvest[id];
    return [id, h.yieldPerTap, h.yieldPerWorker, h.tapsToExhaust, h.recoverySeconds,
      h.respawnSeconds || ''];
  }));

  addSheet(workbook, 'Currencies', CURRENCY_IDS.map((id) => {
    const c = b.currencies[id];
    return [id, c.cap ?? '', c.start, c.primary ? 1 : '',
      c.countsAs?.currency ?? '', c.countsAs?.value ?? '', c.goldValue ?? ''];
  }));

  addSheet(workbook, 'FogRings', b.fog.rings.map((r) => [r.distance, r.cost]));

  addSheet(workbook, 'Technologies', TECH_IDS.map((id) => {
    const t = b.technologies[id];
    return [id, ...costCells(t.cost), t.durationSeconds, t.requires.join(',')];
  }), (col) => col === 'requires');

  addSheet(workbook, 'Upgrades', UPGRADE_IDS.map((id) => {
    const u = b.upgrades[id];
    return [id, u.costBase, u.costGrowth, u.maxLevel, u.effectPerLevel, u.requiredTech ?? ''];
  }));

  addSheet(workbook, 'Adjacency', (b.adjacency ?? []).map((a) =>
    [a.district, a.neighbor, a.goldPerMinute]));

  addSheet(workbook, 'Quests', (b.quests ?? []).map((q) => [
    q.id, q.name, q.description, q.goalType, q.goalTarget ?? '', q.goalAmount,
    q.goalLevel ?? '', ...costCells(q.reward), q.rewardGems || '',
  ]));

  addSheet(workbook, 'Artifacts', ARTIFACT_IDS.map((id) => {
    const a = b.artifacts[id];
    return [id, a.passiveBase, a.passivePerLevel, a.activeManaCost,
      a.activeDurationSeconds || '', a.activeRadius || '',
      a.carriedAtk || '', a.carriedDef || '', a.carriedHp || '',
      a.carriedAtkPerLevel || '', a.carriedDefPerLevel || '', a.carriedHpPerLevel || ''];
  }));

  addSheet(workbook, 'Heroes', HERO_IDS.map((id) => {
    const h = b.heroes[id];
    return [id, h.unitType, h.trait, h.traitValue, h.atk, h.def, h.hp,
      h.atkPerLevel, h.defPerLevel, h.hpPerLevel];
  }));

  addSheet(workbook, 'Landmarks', (b.landmarks ?? []).map((l) =>
    [l.id, l.kind, l.x, l.y, l.defended ? 1 : '', l.claimCost]));

  addSheet(workbook, 'Ruins', RUIN_IDS.map((id) => {
    const r = b.ruins[id];
    return [id, r.x, r.y, r.tier, r.difficulty, r.baseDepthSeconds, r.depthGrowth, r.maxDepth,
      r.supplies.Food ?? '', r.supplies.Gold ?? '', r.supplies.Iron ?? '',
      r.affinity, r.artifact];
  }));

  addSheet(workbook, 'Settings', SETTINGS.map(([key, path, kind]) => {
    let value = b;
    for (const part of path.split('.')) value = value[part];
    return [key, kind === 'list' ? listCell(value) : value];
  }), (col, row) => col === 'value' &&
    SETTINGS.some(([key, , kind]) => key === row[0] && kind === 'list'));

  exportMap(workbook);

  await workbook.xlsx.writeFile(XLSX_PATH);
  console.log(`balance: wrote ${XLSX_PATH}`);
}

// --------------------------------------------------------------------- main

const mode = process.argv[2] ?? 'import';
if (mode === 'import') await importXlsx();
else if (mode === 'export') await exportXlsx();
else fail('(args)', `unknown mode "${mode}" — use import or export`);
