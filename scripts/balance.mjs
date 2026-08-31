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
  g: 'Grassland', w: 'Water', p: 'Plains', d: 'Desert', s: 'Snow', u: 'Tundra',
};
const FEATURE_CODES = { T: 'Trees', B: 'BerryBush', A: 'WildAnimals' };
const MAP_COLORS = { // conditional-formatting fills, keyed by code
  g: 'FF6FA84F', w: 'FF3D6F9E', p: 'FF9AA34F', d: 'FFC9B26A', s: 'FFDFE7EC', u: 'FF8B9A94',
  T: 'FF2E6B2E', B: 'FF7A4FA8', A: 'FF8A5A34',
};
// The Townhall footprint — must be feature-free Grassland (anchor 0,0; 2x2).
const TOWNHALL_CELLS = [[0, 0], [1, 0], [0, 1], [1, 1]];

const DISTRICT_IDS = ['Townhall', 'Housing', 'Farm', 'FarmLands', 'Sawmill'];
const RESEARCH_IDS = ['Agriculture'];
const UNIT_IDS = ['Archer', 'Swordsman', 'Cavalry'];
const HARVEST_IDS = ['Forest', 'Crops', 'Berries', 'Meat'];
// Order matters: it is the Currencies sheet order AND the Market's sell order.
const CURRENCY_IDS = ['Gold', 'Food', 'Wood', 'Berries', 'Meat', 'Knowledge', 'Gems'];
const COST_CURRENCIES = ['Gold', 'Wood', 'Food'];

const SETTINGS = [
  // [sheet key, json path, kind]
  ['worker.move_speed_tiles_per_second', 'worker.moveSpeedTilesPerSecond'],
  ['worker.work_seconds', 'worker.workSeconds'],
  ['tap.collect_cooldown_seconds', 'tap.collectCooldownSeconds'],
  ['training.seconds', 'training.seconds'],
  ['training.tap_boost_seconds', 'training.tapBoostSeconds'],
  ['market.sell_interval_seconds', 'market.sellIntervalSeconds'],
  ['market.capacity', 'market.capacity'],
  ['offline_cap_hours', 'offlineCapHours'],
  ['fog.gold_per_tap', 'fog.goldPerTap'],
  ['fog.fallback_growth', 'fog.fallbackGrowth'],
  ['city.initial_population', 'city.initialPopulation'],
  ['city.initial_gold', 'city.initialCurrencies.Gold'],
  ['city.initial_food', 'city.initialCurrencies.Food'],
  ['city.population_cost_base', 'city.populationCostBase'],
  ['city.population_cost_growth', 'city.populationCostGrowth'],
  ['city.build_queue_capacity', 'city.buildQueueCapacity'],
  ['city.max_army_power_per_townhall_level', 'city.maxArmyPowerPerTownhallLevel', 'list'],
  ['kingdom.start_builders', 'kingdom.startBuilders'],
  ['kingdom.max_builders', 'kingdom.maxBuilders'],
];

const DISTRICT_COLUMNS = [
  'id', 'size_x', 'size_y', 'max_level', 'population_capacity',
  'fog_reveal_radius', 'fog_discover_radius',
  'max_workers_per_level', 'max_count_per_townhall_level',
  'influence_radius_per_level', 'required_townhall_level_per_level',
  'build_cost_gold', 'build_cost_wood', 'build_cost_food',
  'build_cost_multiplier', 'build_cost_exponential_growth',
  'build_duration_seconds', 'build_duration_district_growth', 'build_duration_distance_growth',
  'upgrade_cost_gold', 'upgrade_cost_wood', 'upgrade_cost_food',
  'upgrade_cost_level_growth', 'upgrade_duration_seconds', 'upgrade_duration_level_growth',
];
const DISTRICT_LIST_COLUMNS = [
  'max_workers_per_level', 'max_count_per_townhall_level',
  'influence_radius_per_level', 'required_townhall_level_per_level',
];

const SHEETS = {
  Districts: DISTRICT_COLUMNS,
  Units: ['id', 'power', 'recruit_cost_gold', 'recruit_cost_wood', 'recruit_cost_food',
    'train_duration_seconds'],
  Harvest: ['source', 'yield_per_tap', 'yield_per_worker', 'taps_to_exhaust', 'recovery_seconds'],
  Currencies: ['id', 'cap', 'start', 'primary', 'counts_as', 'unit_value', 'gold_value'],
  FogRings: ['distance', 'cost'],
  Research: ['id', 'cost_gold', 'cost_wood', 'cost_food', 'duration_seconds'],
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
    districts: {}, harvest: {}, currencies: {}, units: {}, research: {},
    worker: {}, tap: {}, training: {}, market: {},
    fog: { silverPerTap: 0, rings: [], fallbackGrowth: 0 },
    city: { initialCurrencies: {} }, kingdom: {},
    offlineCapHours: 0,
  };

  for (const [id, r] of byId(readSheet(workbook, 'Districts'), DISTRICT_IDS)) {
    out.districts[id] = {
      size: { x: num(r, 'size_x'), y: num(r, 'size_y') },
      maxLevel: num(r, 'max_level'),
      populationCapacity: num(r, 'population_capacity'),
      fogRevealRadius: num(r, 'fog_reveal_radius'),
      fogDiscoverRadius: num(r, 'fog_discover_radius'),
      maxWorkersPerLevel: list(r, 'max_workers_per_level'),
      maxCountPerTownhallLevel: list(r, 'max_count_per_townhall_level'),
      influenceRadiusPerLevel: list(r, 'influence_radius_per_level'),
      requiredTownhallLevelPerLevel: list(r, 'required_townhall_level_per_level'),
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
    out.units[id] = {
      power: num(r, 'power'),
      recruitCost: wallet(r, 'recruit_cost'),
      trainDurationSeconds: num(r, 'train_duration_seconds'),
    };
  }

  for (const [id, r] of byId(readSheet(workbook, 'Research'), RESEARCH_IDS)) {
    out.research[id] = {
      cost: wallet(r, 'cost'),
      durationSeconds: num(r, 'duration_seconds'),
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
  importMap(workbook);
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
      id, d.size.x, d.size.y, d.maxLevel, d.populationCapacity,
      d.fogRevealRadius, d.fogDiscoverRadius,
      listCell(d.maxWorkersPerLevel), listCell(d.maxCountPerTownhallLevel),
      listCell(d.influenceRadiusPerLevel), listCell(d.requiredTownhallLevelPerLevel),
      ...costCells(d.buildCost),
      d.buildCostMultiplier, d.buildCostExponentialGrowth,
      d.buildDurationSeconds, d.buildDurationDistrictGrowth, d.buildDurationDistanceGrowth,
      ...costCells(d.upgradeCost),
      d.upgradeCostLevelGrowth, d.upgradeDurationSeconds, d.upgradeDurationLevelGrowth,
    ];
  }), (col) => DISTRICT_LIST_COLUMNS.includes(col));

  addSheet(workbook, 'Units', UNIT_IDS.map((id) => {
    const u = b.units[id];
    return [id, u.power, ...costCells(u.recruitCost), u.trainDurationSeconds];
  }));

  addSheet(workbook, 'Harvest', HARVEST_IDS.map((id) => {
    const h = b.harvest[id];
    return [id, h.yieldPerTap, h.yieldPerWorker, h.tapsToExhaust, h.recoverySeconds];
  }));

  addSheet(workbook, 'Currencies', CURRENCY_IDS.map((id) => {
    const c = b.currencies[id];
    return [id, c.cap ?? '', c.start, c.primary ? 1 : '',
      c.countsAs?.currency ?? '', c.countsAs?.value ?? '', c.goldValue ?? ''];
  }));

  addSheet(workbook, 'FogRings', b.fog.rings.map((r) => [r.distance, r.cost]));

  addSheet(workbook, 'Research', RESEARCH_IDS.map((id) => {
    const r = b.research[id];
    return [id, ...costCells(r.cost), r.durationSeconds];
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
