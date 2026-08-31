// Balance data bridge: balance/*.csv  ⇄  src/sim/data/balance.json
//
//   node scripts/balance.mjs import   CSVs → balance.json (validates; the normal flow)
//   node scripts/balance.mjs export   balance.json → CSVs (regenerate the sheets)
//
// The CSVs are the human-edited source of truth (Excel / LibreOffice / Sheets);
// the JSON is generated and consumed by src/sim/data/definitions.ts.
// Import fails loudly on unknown columns/ids, missing rows, or non-numbers.
//
// CSV conventions:
//   - lists are pipe-separated:  3|5|7      (blank = empty list)
//   - blank cost cells mean 0 (the currency isn't part of the cost)
//   - both "," and ";" delimiters are accepted (";" is what Spanish-locale
//     Excel/LibreOffice writes); with ";", decimal commas ("1,25") work too.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSV_DIR = join(ROOT, 'balance');
const JSON_PATH = join(ROOT, 'src/sim/data/balance.json');

const DISTRICT_IDS = ['Townhall', 'Housing', 'Farm', 'FarmLands', 'Sawmill'];
const UNIT_IDS = ['Archer', 'Swordsman', 'Cavalry'];
const SPELL_IDS = ['Rain', 'Tap'];
const HARVEST_IDS = ['Forest', 'Crops'];
const CURRENCY_IDS = ['Food', 'Silver', 'Wood', 'Gold', 'Mana', 'Knowledge', 'Gems'];
const COST_CURRENCIES = ['Silver', 'Wood', 'Food'];

const SETTINGS = [
  // [csv key, json path]
  ['worker.move_speed_tiles_per_second', 'worker.moveSpeedTilesPerSecond'],
  ['worker.work_seconds', 'worker.workSeconds'],
  ['worker.carry', 'worker.carry'],
  ['townhall_cycle.cycle_seconds', 'townhallCycle.cycleSeconds'],
  ['townhall_cycle.tap_boost_seconds', 'townhallCycle.tapBoostSeconds'],
  ['townhall_cycle.silver_per_population', 'townhallCycle.silverPerPopulation'],
  ['offline_cap_hours', 'offlineCapHours'],
  ['fog.silver_per_tap', 'fog.silverPerTap'],
  ['fog.fallback_growth', 'fog.fallbackGrowth'],
  ['city.initial_population', 'city.initialPopulation'],
  ['city.initial_silver', 'city.initialCurrencies.Silver'],
  ['city.initial_food', 'city.initialCurrencies.Food'],
  ['city.population_cost_base', 'city.populationCostBase'],
  ['city.population_cost_growth', 'city.populationCostGrowth'],
  ['city.build_queue_capacity', 'city.buildQueueCapacity'],
  ['city.max_army_power_per_townhall_level', 'city.maxArmyPowerPerTownhallLevel', 'list'],
  ['kingdom.start_builders', 'kingdom.startBuilders'],
  ['kingdom.max_builders', 'kingdom.maxBuilders'],
  ['kingdom.mana_per_hour', 'kingdom.manaPerHour'],
];

const DISTRICT_COLUMNS = [
  'id', 'size_x', 'size_y', 'max_level', 'population_capacity',
  'max_workers_per_level', 'max_count_per_townhall_level',
  'influence_radius_per_level', 'required_townhall_level_per_level',
  'build_cost_silver', 'build_cost_wood', 'build_cost_food',
  'build_cost_multiplier', 'build_cost_exponential_growth', 'build_cost_distance_growth',
  'build_duration_seconds', 'build_duration_district_growth', 'build_duration_distance_growth',
  'upgrade_cost_silver', 'upgrade_cost_wood', 'upgrade_cost_food',
  'upgrade_cost_level_growth', 'upgrade_duration_seconds', 'upgrade_duration_level_growth',
];

// ------------------------------------------------------------------ CSV I/O

function fail(file, msg) {
  console.error(`balance: ${file}: ${msg}`);
  process.exit(1);
}

/** Parse a whole CSV file into row objects keyed by header. */
function readCsv(name, expectedColumns) {
  const file = join(CSV_DIR, name);
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    fail(name, 'file not found — run "node scripts/balance.mjs export" to regenerate the sheets');
  }
  text = text.replace(/^﻿/, ''); // Excel BOM
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) fail(name, 'no data rows');
  // Delimiter: whichever of ; or , splits the header into more fields.
  const delim = (lines[0].split(';').length > lines[0].split(',').length) ? ';' : ',';
  const split = (line) => line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ''));
  const header = split(lines[0]);
  for (const col of header) {
    if (!expectedColumns.includes(col)) fail(name, `unknown column "${col}"`);
  }
  for (const col of expectedColumns) {
    if (!header.includes(col)) fail(name, `missing column "${col}"`);
  }
  return lines.slice(1).map((line, i) => {
    const cells = split(line);
    if (cells.length !== header.length) {
      fail(name, `row ${i + 2}: expected ${header.length} cells, got ${cells.length}`);
    }
    const row = {};
    header.forEach((h, c) => { row[h] = cells[c]; });
    row._line = i + 2;
    row._delim = delim;
    return row;
  });
}

function num(row, file, col, { blankAs = null } = {}) {
  let raw = row[col];
  if (raw === '' || raw === undefined) {
    if (blankAs !== null) return blankAs;
    fail(file, `row ${row._line}: "${col}" is blank`);
  }
  // Spanish-locale sheets write decimal commas when the delimiter is ";".
  if (row._delim === ';' && /^\d+,\d+$/.test(raw)) raw = raw.replace(',', '.');
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) fail(file, `row ${row._line}: "${col}" is not a non-negative number (got "${raw}")`);
  return n;
}

function list(row, file, col) {
  const raw = row[col];
  if (raw === '' || raw === undefined) return [];
  return raw.split('|').map((part) => {
    const n = Number(part.trim());
    if (!Number.isFinite(n) || n < 0) fail(file, `row ${row._line}: "${col}" has a bad list entry ("${part}")`);
    return n;
  });
}

function wallet(row, file, prefix) {
  const out = {};
  for (const c of COST_CURRENCIES) {
    const v = num(row, file, `${prefix}_${c.toLowerCase()}`, { blankAs: 0 });
    if (v > 0) out[c] = v;
  }
  return out;
}

function byId(rows, file, expectedIds, idColumn = 'id') {
  const seen = new Map();
  for (const row of rows) {
    const id = row[idColumn];
    if (!expectedIds.includes(id)) fail(file, `row ${row._line}: unknown ${idColumn} "${id}"`);
    if (seen.has(id)) fail(file, `row ${row._line}: duplicate ${idColumn} "${id}"`);
    seen.set(id, row);
  }
  for (const id of expectedIds) {
    if (!seen.has(id)) fail(file, `missing row for ${idColumn} "${id}"`);
  }
  return seen;
}

// ------------------------------------------------------------------- import

function importCsvs() {
  const out = {
    _note: 'GENERATED from balance/*.csv — edit the CSVs and run: npm run balance',
    districts: {}, harvest: {}, currencies: {}, units: {}, spells: {},
    worker: {}, townhallCycle: {},
    fog: { silverPerTap: 0, rings: [], fallbackGrowth: 0 },
    city: { initialCurrencies: {} }, kingdom: {},
    offlineCapHours: 0,
  };

  const districts = byId(readCsv('districts.csv', DISTRICT_COLUMNS), 'districts.csv', DISTRICT_IDS);
  for (const [id, r] of districts) {
    out.districts[id] = {
      size: { x: num(r, 'districts.csv', 'size_x'), y: num(r, 'districts.csv', 'size_y') },
      maxLevel: num(r, 'districts.csv', 'max_level'),
      populationCapacity: num(r, 'districts.csv', 'population_capacity'),
      maxWorkersPerLevel: list(r, 'districts.csv', 'max_workers_per_level'),
      maxCountPerTownhallLevel: list(r, 'districts.csv', 'max_count_per_townhall_level'),
      influenceRadiusPerLevel: list(r, 'districts.csv', 'influence_radius_per_level'),
      requiredTownhallLevelPerLevel: list(r, 'districts.csv', 'required_townhall_level_per_level'),
      buildCost: wallet(r, 'districts.csv', 'build_cost'),
      buildCostMultiplier: num(r, 'districts.csv', 'build_cost_multiplier'),
      buildCostExponentialGrowth: num(r, 'districts.csv', 'build_cost_exponential_growth'),
      buildCostDistanceGrowth: num(r, 'districts.csv', 'build_cost_distance_growth'),
      buildDurationSeconds: num(r, 'districts.csv', 'build_duration_seconds'),
      buildDurationDistrictGrowth: num(r, 'districts.csv', 'build_duration_district_growth'),
      buildDurationDistanceGrowth: num(r, 'districts.csv', 'build_duration_distance_growth'),
      upgradeCost: wallet(r, 'districts.csv', 'upgrade_cost'),
      upgradeCostLevelGrowth: num(r, 'districts.csv', 'upgrade_cost_level_growth'),
      upgradeDurationSeconds: num(r, 'districts.csv', 'upgrade_duration_seconds'),
      upgradeDurationLevelGrowth: num(r, 'districts.csv', 'upgrade_duration_level_growth'),
    };
  }

  const harvest = byId(
    readCsv('harvest.csv', ['source', 'yield_per_tap', 'taps_to_exhaust', 'recovery_seconds']),
    'harvest.csv', HARVEST_IDS, 'source',
  );
  for (const [id, r] of harvest) {
    out.harvest[id] = {
      yieldPerTap: num(r, 'harvest.csv', 'yield_per_tap'),
      tapsToExhaust: num(r, 'harvest.csv', 'taps_to_exhaust'),
      recoverySeconds: num(r, 'harvest.csv', 'recovery_seconds'),
    };
  }

  const currencies = byId(
    readCsv('currencies.csv', ['id', 'cap', 'start']), 'currencies.csv', CURRENCY_IDS,
  );
  for (const [id, r] of currencies) {
    out.currencies[id] = {
      cap: r.cap === '' ? null : num(r, 'currencies.csv', 'cap'),
      start: num(r, 'currencies.csv', 'start'),
    };
  }

  const units = byId(
    readCsv('units.csv', ['id', 'power', 'recruit_cost_silver', 'recruit_cost_wood',
      'recruit_cost_food', 'train_duration_seconds']),
    'units.csv', UNIT_IDS,
  );
  for (const [id, r] of units) {
    out.units[id] = {
      power: num(r, 'units.csv', 'power'),
      recruitCost: wallet(r, 'units.csv', 'recruit_cost'),
      trainDurationSeconds: num(r, 'units.csv', 'train_duration_seconds'),
    };
  }

  const spellRows = readCsv('spells.csv',
    ['spell', 'level', 'mana_cost', 'duration_seconds', 'effect_magnitude', 'upgrade_cost']);
  for (const id of SPELL_IDS) out.spells[id] = [];
  for (const r of spellRows) {
    if (!SPELL_IDS.includes(r.spell)) fail('spells.csv', `row ${r._line}: unknown spell "${r.spell}"`);
    const level = num(r, 'spells.csv', 'level');
    if (level !== out.spells[r.spell].length + 1) {
      fail('spells.csv', `row ${r._line}: ${r.spell} levels must be contiguous from 1 (got ${level})`);
    }
    out.spells[r.spell].push({
      manaCost: num(r, 'spells.csv', 'mana_cost'),
      durationSeconds: num(r, 'spells.csv', 'duration_seconds'),
      effectMagnitude: num(r, 'spells.csv', 'effect_magnitude'),
      upgradeCost: num(r, 'spells.csv', 'upgrade_cost'),
    });
  }
  for (const id of SPELL_IDS) {
    if (out.spells[id].length === 0) fail('spells.csv', `no levels for spell "${id}"`);
  }

  const rings = readCsv('fog_rings.csv', ['distance', 'cost']);
  let lastDistance = 0;
  for (const r of rings) {
    const distance = num(r, 'fog_rings.csv', 'distance');
    if (distance <= lastDistance) fail('fog_rings.csv', `row ${r._line}: distances must be ascending`);
    lastDistance = distance;
    out.fog.rings.push({ distance, cost: num(r, 'fog_rings.csv', 'cost') });
  }

  const settings = readCsv('settings.csv', ['key', 'value']);
  const byKey = byId(settings, 'settings.csv', SETTINGS.map(([k]) => k), 'key');
  for (const [key, path, kind] of SETTINGS) {
    const row = byKey.get(key);
    const value = kind === 'list' ? list(row, 'settings.csv', 'value') : num(row, 'settings.csv', 'value');
    const parts = path.split('.');
    let target = out;
    while (parts.length > 1) target = target[parts.shift()];
    target[parts[0]] = value;
  }

  writeFileSync(JSON_PATH, JSON.stringify(out, null, 2) + '\n');
  console.log(`balance: wrote ${JSON_PATH}`);
}

// ------------------------------------------------------------------- export

const csvLine = (cells) => cells.join(',') + '\n';
const listCell = (arr) => arr.join('|');
const costCells = (w) => COST_CURRENCIES.map((c) => (w[c] ?? '') === 0 ? '' : (w[c] ?? ''));

function exportCsvs() {
  const b = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
  mkdirSync(CSV_DIR, { recursive: true });

  let csv = csvLine(DISTRICT_COLUMNS);
  for (const id of DISTRICT_IDS) {
    const d = b.districts[id];
    csv += csvLine([
      id, d.size.x, d.size.y, d.maxLevel, d.populationCapacity,
      listCell(d.maxWorkersPerLevel), listCell(d.maxCountPerTownhallLevel),
      listCell(d.influenceRadiusPerLevel), listCell(d.requiredTownhallLevelPerLevel),
      ...costCells(d.buildCost),
      d.buildCostMultiplier, d.buildCostExponentialGrowth, d.buildCostDistanceGrowth,
      d.buildDurationSeconds, d.buildDurationDistrictGrowth, d.buildDurationDistanceGrowth,
      ...costCells(d.upgradeCost),
      d.upgradeCostLevelGrowth, d.upgradeDurationSeconds, d.upgradeDurationLevelGrowth,
    ]);
  }
  writeFileSync(join(CSV_DIR, 'districts.csv'), csv);

  csv = csvLine(['source', 'yield_per_tap', 'taps_to_exhaust', 'recovery_seconds']);
  for (const id of HARVEST_IDS) {
    const h = b.harvest[id];
    csv += csvLine([id, h.yieldPerTap, h.tapsToExhaust, h.recoverySeconds]);
  }
  writeFileSync(join(CSV_DIR, 'harvest.csv'), csv);

  csv = csvLine(['id', 'cap', 'start']);
  for (const id of CURRENCY_IDS) {
    const c = b.currencies[id];
    csv += csvLine([id, c.cap ?? '', c.start]);
  }
  writeFileSync(join(CSV_DIR, 'currencies.csv'), csv);

  csv = csvLine(['id', 'power', 'recruit_cost_silver', 'recruit_cost_wood',
    'recruit_cost_food', 'train_duration_seconds']);
  for (const id of UNIT_IDS) {
    const u = b.units[id];
    csv += csvLine([id, u.power, ...costCells(u.recruitCost), u.trainDurationSeconds]);
  }
  writeFileSync(join(CSV_DIR, 'units.csv'), csv);

  csv = csvLine(['spell', 'level', 'mana_cost', 'duration_seconds', 'effect_magnitude', 'upgrade_cost']);
  for (const id of SPELL_IDS) {
    b.spells[id].forEach((l, i) => {
      csv += csvLine([id, i + 1, l.manaCost, l.durationSeconds, l.effectMagnitude, l.upgradeCost]);
    });
  }
  writeFileSync(join(CSV_DIR, 'spells.csv'), csv);

  csv = csvLine(['distance', 'cost']);
  for (const r of b.fog.rings) csv += csvLine([r.distance, r.cost]);
  writeFileSync(join(CSV_DIR, 'fog_rings.csv'), csv);

  csv = csvLine(['key', 'value']);
  for (const [key, path, kind] of SETTINGS) {
    let value = b;
    for (const part of path.split('.')) value = value[part];
    csv += csvLine([key, kind === 'list' ? listCell(value) : value]);
  }
  writeFileSync(join(CSV_DIR, 'settings.csv'), csv);

  console.log(`balance: wrote ${CSV_DIR}/*.csv`);
}

// --------------------------------------------------------------------- main

const mode = process.argv[2] ?? 'import';
if (mode === 'import') importCsvs();
else if (mode === 'export') exportCsvs();
else fail('(args)', `unknown mode "${mode}" — use import or export`);
