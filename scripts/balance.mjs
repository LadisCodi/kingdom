// Balance data bridge:
//   balance/balance.xlsx  ⇄  src/sim/data/balance.json  (data sheets)
//
//   node scripts/balance.mjs import   xlsx → json (validates; the normal flow)
//   node scripts/balance.mjs export   json → xlsx (regenerate the workbook)
//
// MAP content is NOT here. Terrain, features, landmarks and ruins are authored
// by coordinate, which a spreadsheet expresses badly and a painting tool
// expresses well, so they live in src/sim/data/region-map.json and are edited
// in the map editor (npm run dev, then ?dev=map). Their rules are enforced by
// src/sim/data/mapRules.ts and gated by tests/regionMap.test.ts.
// See Docs/map-editor.md.
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

const DISTRICT_IDS = [
  'Townhall', 'Housing', 'Farm', 'FarmLands', 'Sawmill', 'Market', 'Quarry', 'Docks',
  'Sanctum',
  // Military: each unit type is trained by its own building, and building and
  // upgrading them is what raises the army cap.
  'Barracks', 'SpearHall', 'ShootingGrounds', 'Stables',
];
const TECH_IDS = [
  'CharterI', 'CharterII', 'CharterIII', 'CharterIV',
  'Forestry', 'UrbanPlanning', 'Saws', 'Agriculture',
  'Masonry', 'Communities', 'Hunting', 'Farming',
  'Market', 'Mining', 'Architecture', 'Engineering',
  'DeepMining', 'WarbandI', 'WarbandII', 'WarbandIII',
  'WarbandIV', 'Warrior', 'Spears', 'Archery',
  'Cavalry', 'AttunementI', 'AttunementII', 'AttunementIII',
  'AttunementIV', 'Cartography', 'Consecration', 'Sailing',
  'ScalingTools', 'Fishing', 'Shipbuilding', 'TapPowerI',
  'TapPowerII', 'TapPowerIII', 'TapPowerIV', 'TapPowerV',
  'QuickHandsI', 'QuickHandsII', 'QuickHandsIII', 'QuickHandsIV',
  'QuickHandsV', 'WorkerLoadI', 'WorkerLoadII', 'WorkerLoadIII',
  'SawpitsI', 'SawpitsII', 'SawpitsIII', 'ButcheryI',
  'ButcheryII', 'ButcheryIII', 'IrrigationI', 'IrrigationII',
  'IrrigationIII', 'ScythesI', 'ScythesII', 'ScythesIII',
  'SurveyingI', 'SurveyingII', 'PitonsI', 'PitonsII',
  'MarketStallI', 'MarketStallII', 'MarketStallIII', 'MarketStallIV',
  'TradeRoutesI', 'TradeRoutesII', 'TradeRoutesIII', 'TradeRoutesIV',
  'TradeRoutesV', 'StonecuttingI', 'StonecuttingII', 'StonecuttingIII',
  'BigNetsI', 'BigNetsII', 'BigNetsIII', 'IronPicksI',
  'IronPicksII', 'IronPicksIII', 'ResonanceI', 'ResonanceII',
  'CarpentryI', 'CarpentryII', 'CarpentryIII', 'ScrivenersI',
  'ScrivenersII', 'ScrivenersIII', 'CartageI', 'CartageII',
  'CartageIII', 'DeepWellsI', 'DeepWellsII', 'DeepWellsIII',
  'DeepWellsIV', 'DeepWellsV', 'LeyTapsI', 'LeyTapsII',
  'LeyTapsIII', 'WaypostsI', 'WaypostsII', 'WaypostsIII',
  'ScriptoriumI', 'ScriptoriumII', 'ScriptoriumIII', 'VigilsI',
  'VigilsII', 'VigilsIII', 'PilgrimageI', 'PilgrimageII',
  'PilgrimageIII', 'ProspectingI', 'ProspectingII', 'ProspectingIII',
  'ColoursI', 'ColoursII', 'ColoursIII', 'ColoursIV',
  'ColoursV', 'MusterDrillI', 'MusterDrillII', 'MusterDrillIII',
  'RationsI', 'RationsII', 'RationsIII', 'DrillmasterI',
  'DrillmasterII', 'DrillmasterIII', 'BearersI', 'BearersII',
  'BearersIII', 'PathfindersI', 'PathfindersII', 'PathfindersIII',
  'ShieldWallI', 'ShieldWallII', 'ShieldWallIII', 'FletchingI',
  'FletchingII', 'FletchingIII', 'BardingI', 'BardingII',
  'BardingIII', 'WarhornsI', 'WarhornsII', 'WarhornsIII',
  'ManoeuvreI', 'ManoeuvreII', 'ManoeuvreIII', 'FarsightI',
  'FarsightII', 'FarsightIII', 'Aqueducts', 'Guildhalls',
  'Roadworks', 'LandSurvey', 'Apprenticeships', 'FieldMedicine',
  'Veterancy', 'Siegecraft', 'Tactics', 'Scouting',
  'Salvage', 'Vanguard', 'Standards', 'Conquest',
  'Meditation', 'LeyReading', 'Scrying', 'Invocation',
  'Lorekeeping', 'Wayshrines', 'LeyLines', 'FrugalRites',
  'SanctifiedRuins', 'RitualCasting', 'LeyStorm', 'SecondSanctum',
];
const UNIT_IDS = ['Warrior', 'Lancer', 'Archer', 'Cavalry'];
const HARVEST_IDS = ['Forest', 'Crops', 'Berries', 'Meat', 'Stone', 'Fish', 'MountainIron', 'MountainGold'];
const TERRAIN_IDS = ['Grassland', 'Plains', 'Desert', 'Snow', 'Tundra', 'Water'];
// Order matters: it is the Currencies sheet order AND the Market's sell order.
const QUEST_GOAL_TYPES = {
  // absolute — goal_target validated against the named id list (null = none)
  BuildDistrict: 'district', UpgradeDistrict: 'district', HoldResource: 'currency',
  ReachPopulation: null, CompleteTech: 'tech', CompleteTechs: null,
  AssignWorkers: null, TrainArmy: null,
  // The long game: magic and expeditions.
  ClaimLandmarks: null, ReachDepth: null, ClearRuins: null, OwnArtifacts: null,
  OwnHeroes: null,
  // relative
  CollectResource: 'currency', CollectTaps: null, DiscoverCells: null, SellGoods: null,
  // "clear two cells with forest on them" — a DiscoverCells that cares WHAT
  // it uncovered, so the opening can point the player at the thing the next
  // quest is about to need.
  DiscoverFeature: 'feature',
};

// Quest `DiscoverFeature` targets. Mirrors `FEATURES` in definitions.ts.
const FEATURE_IDS = [
  'Trees', 'Mountain', 'MountainIron', 'MountainGold', 'BerryBush', 'WildAnimals', 'FishShoal',
];
const HERO_IDS = ['Warden', 'Quartermaster', 'Scholar', 'RelicHunter', 'Scout'];
const HERO_TRAITS = [
  'PartyDefence', 'SupplyDiscount', 'KnowledgeBonus', 'FragmentBonus', 'RevealNextDepth',
];
const ARTIFACT_IDS = [
  'DowsingRod', 'VerdantSeal', 'ForemansSigil', 'GildedLedger', 'WanderersCompass',
];

const TOME_IDS = ['Civics', 'Warfare', 'Magic'];
const CURRENCY_IDS = [
  'Gold', 'Food', 'Wood', 'Stone', 'Mana', 'Knowledge', 'Stardust', 'Gems',
];
const COST_CURRENCIES = ['Gold', 'Wood', 'Food', 'Stone'];

const SETTINGS = [
  // [sheet key, json path, kind]
  ['worker.move_speed_tiles_per_second', 'worker.moveSpeedTilesPerSecond'],
  ['tap.collect_cooldown_seconds', 'tap.collectCooldownSeconds'],
  ['training.seconds', 'training.seconds'],
  ['taxes.gold_per_population_per_minute', 'taxes.goldPerPopulationPerMinute'],
  ['tap.mana_cost', 'tap.manaCost'],
  // The one number behind every tap in the game: a tap advances whatever you
  // tapped by this many SECONDS OF ITS OWN WORK — a woodcutter's swing at a
  // tree, a house's rent. Priced against the ground and the thumb, never
  // against the payroll. TapPower buys this duration up, +20% a level.
  ['tap.work_seconds', 'tap.workSeconds'],
  ['offline_cap_hours', 'offlineCapHours'],
  ['fog.gold_per_tap', 'fog.goldPerTap'],
  ['fog.fallback_growth', 'fog.fallbackGrowth'],
  // Claiming a sanctuary lifts the fog around it: every cell within this many
  // rings becomes DISCOVERED, never revealed. A claim buys you a place to
  // look, not the ground itself — the paid reveal is still the sink.
  ['fog.claim_discover_radius', 'fog.claimDiscoverRadius'],
  ['city.initial_population', 'city.initialPopulation'],
  ['city.initial_gold', 'city.initialCurrencies.Gold'],
  ['city.initial_food', 'city.initialCurrencies.Food'],
  // Villager pricing is AUTHORED for the opening and exponential after it.
  // A pure curve gave the designer no grip where it matters most: the first
  // few villagers are the whole early game, and `base × growth^n` cannot be
  // made to say 5, 20, 100 without deforming everything past it.
  ['city.population_cost_first', 'city.populationCostFirst', 'list'],
  ['city.population_cost_growth', 'city.populationCostGrowth'],
  // NO `city.build_queue_capacity`. There is no waiting line: a build either
  // starts because a builder is free or it does not start at all, so the
  // queue's length IS the builder count and a second dial for it could only
  // ever disagree. See src/sim/state.ts `buildQueueCapacity`.
  ['kingdom.start_builders', 'kingdom.startBuilders'],
  ['kingdom.max_builders', 'kingdom.maxBuilders'],
  // Buying the Nth builder, on the same escalating-slot curve as research,
  // party and attunement slots: round(base x growth^purchased).
  ['kingdom.builder_gem_cost_base', 'kingdom.builderGemCostBase'],
  ['kingdom.builder_gem_cost_growth', 'kingdom.builderGemCostGrowth'],
  // The daily chest ladder (Docs/features/12-quests.md §4.2). Three parallel
  // seven-long lists, one per reward kind, so a step is a column rather than a
  // sheet — and so the ladder's LENGTH is the length of these lists.
  ['daily.mana_fractions', 'daily.manaFractions', 'list'],
  ['daily.gold_seconds', 'daily.goldSeconds', 'list'],
  ['daily.gems', 'daily.gems', 'list'],
  ['daily.gold_floor', 'daily.goldFloor'],
  ['research.tech_slots', 'research.techSlots'],
  ['research.max_slots', 'research.maxSlots'],
  ['research.slot_gem_cost_base', 'research.slotGemCostBase'],
  ['research.slot_gem_cost_growth', 'research.slotGemCostGrowth'],
  // Mana. The ceiling is DYNAMIC (Townhall level + Sanctum levels), so the
  // Currencies sheet's static `cap` column stays blank for Mana and these are
  // the numbers that actually decide it — see src/sim/mana.ts.
  // The Townhall produces no Mana and sets no ceiling — it gates and nothing
  // else (Docs/features/tech-tree.md §12). A flat floor, then the Sanctum,
  // then the sanctuaries: the whole curve lives in the Magic tome now.
  ['mana.base_cap', 'mana.baseCap'],
  ['mana.base_per_hour', 'mana.basePerHour'],
  ['mana.sanctum_cap_per_level', 'mana.sanctumCapPerLevel', 'list'],
  ['mana.sanctum_per_hour_per_level', 'mana.sanctumPerHourPerLevel', 'list'],
  ['mana.landmark_cap', 'mana.landmarkCap'],
  ['mana.meditation_cap', 'mana.meditationCap'],
  // A fraction of the CAP, not an absolute: one Gem buys what a daily chest
  // step pays (0.34 of a pool), so it never goes stale as the pool grows.
  ['mana.gem_refill_fraction', 'mana.gemRefillFraction'],
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
  // Knowledge per hour per ruin the player has CLEARED. Discovery pays
  // nothing: taking a dungeon to its bottom is what turns it into a faucet.
  ['knowledge.drip_per_cleared_ruin_per_hour', 'knowledge.dripPerClearedRuinPerHour'],
  // The research clock's rate is the ground you have taken, and nothing else:
  // there is deliberately NO base term, so a player who claims nothing
  // generates nothing. Era 1 of the tree costs no Knowledge, which is what
  // keeps that from being a wall (Docs/features/tomes-and-research.md §3).
  ['knowledge.per_claimed_landmark_per_hour', 'knowledge.perClaimedLandmarkPerHour'],
  // Taking ground is an EVENT, not just a rate change a nobody is looking at.
  ['knowledge.landmark_claim_lump', 'knowledge.landmarkClaimLump'],
  ['knowledge.conquest_per_cleared_ruin_per_hour', 'knowledge.conquestPerClearedRuinPerHour'],
  // Combat is a SCORING PASS, not a simulation — these six numbers are the
  // whole of it. Sharper type values (x2/x0.5) are more dramatic but make one
  // bad guess feel like a wasted trip, which is the un-cozy end of the dial.
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
  ['delve.stardust_per_depth_per_tier', 'delve.stardustPerDepthPerTier'],
  ['delve.fragments_per_depth', 'delve.fragmentsPerDepth'],
  ['delve.fail_haul_loss', 'delve.failHaulLoss'],
  ['delve.first_clear_gems', 'delve.firstClearGems'],
  // The lump a first clear pays. Together with the drip above and the gacha,
  // this is where ALL Knowledge comes from — clearing fog pays none.
  ['delve.first_clear_knowledge', 'delve.firstClearKnowledge'],
  ['delve.first_clear_stardust', 'delve.firstClearStardust'],
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
  // Every pull pays this, hero or not — Fragments only ever point at one
  // hero, but Knowledge levels whoever the player already has.
  ['gacha.pull_stardust', 'gacha.pullStardust'],
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
  'required_tech_per_level', 'army_cap_per_level', 'extra_count_tech',
  'build_cost_gold', 'build_cost_wood', 'build_cost_food',
  'build_cost_stone',
  'build_cost_multiplier', 'build_cost_exponential_growth',
  'build_duration_seconds', 'build_duration_district_growth', 'build_duration_distance_growth',
  'upgrade_cost_gold', 'upgrade_cost_wood', 'upgrade_cost_food',
  'upgrade_cost_stone',
  'upgrade_cost_level_growth', 'upgrade_duration_seconds', 'upgrade_duration_level_growth',
];
const DISTRICT_LIST_COLUMNS = [
  'population_capacity', 'max_workers_per_level', 'max_count_per_townhall_level',
  'influence_radius_per_level', 'required_townhall_level_per_level',
  'required_tech_per_level', 'army_cap_per_level', 'extra_count_tech',
];

const SHEETS = {
  Districts: DISTRICT_COLUMNS,
  Units: ['id', 'power', 'atk', 'def', 'hp',
    'recruit_cost_gold', 'recruit_cost_wood', 'recruit_cost_food',
    'recruit_cost_stone', 'train_duration_seconds'],
  // What the ground under a cell does to what comes out of it. A multiplier
  // per currency, applied to the cell's STOCK — the only quantity with room
  // for a ±25% in whole units, since a chunk of 1 rounds any percentage away.
  // Blank = 1. Water is authored at 1 on purpose: fish shoals sit on it and
  // pay Food, and nobody asked for wet fields to change fishing.
  Terrain: ['terrain', 'food', 'wood', 'stone'],
  // A cell is a DEPOT: `stock` units, drawn `units_per_strike` at a time,
  // one strike every `seconds_per_strike`. A tap is priced in SECONDS of that
  // same work, so nobody mints matter. stock 0 = bedrock, never runs down.
  Harvest: ['source', 'units_per_strike', 'seconds_per_strike', 'stock', 'recovery_seconds',
    'respawn_seconds', 'required_tech'],
  Currencies: ['id', 'cap', 'start', 'primary', 'gold_value'],
  FogRings: ['distance', 'cost'],
  // Research is paid in Gold and nothing else — one column, not a
  // four-currency wallet. See the tech importer for why.
  // `line` and `effect_per_rank` are what is left of the Upgrades sheet.
  // A minor technology carries a line id and a per-rank effect; a major one
  // leaves both blank. Ranks of a line are ordered by ROW ORDER, the same
  // way the quest chain is (Docs/features/tech-tree.md §1 rule 2).
  // `tome` and `era` are the shelf (Docs/features/tomes-and-research.md §5):
  // three books, each paced by eras whose keystone requires everything above
  // it. `node_x`/`node_y` are per-PAGE positions and are blank for a minor
  // rank, which is drawn in its line's bead under the parent instead.
  // `cost_knowledge` is the clock's price (tomes-and-research.md §1): blank
  // in era 1, where the clock has not started; the era-1 keystone is the
  // first node that charges it.
  // `planned` = 1 marks a node that is on the tree for its SHAPE and does
  // nothing yet. It is badged in the game, its description says so, and no
  // keystone requires it (tech-tree.md §13).
  Technologies: ['id', 'cost_gold', 'cost_knowledge', 'duration_seconds', 'requires',
    'line', 'effect_per_rank', 'tome', 'era', 'node_x', 'node_y', 'planned'],
  Adjacency: ['district', 'neighbor', 'gold_per_minute'],
  Quests: ['id', 'name', 'description', 'goal_type', 'goal_target', 'goal_amount',
    'goal_level', 'reward_gold', 'reward_wood', 'reward_food', 'reward_stone',
    'reward_gems', 'reward_stardust', 'reward_knowledge'],
  Artifacts: ['id', 'passive_base', 'passive_per_level', 'active_mana_cost',
    'active_duration_seconds', 'active_radius',
    'carried_atk', 'carried_def', 'carried_hp',
    'carried_atk_per_level', 'carried_def_per_level', 'carried_hp_per_level'],
  Heroes: ['id', 'unit_type', 'trait', 'trait_value', 'atk', 'def', 'hp',
    'atk_per_level', 'def_per_level', 'hp_per_level'],
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

/** A tree-page coordinate: any integer, including negative ones (a page is
 *  centred on its spine, so x is negative left of the trunk). */
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

function techOrBlank(row, column) {
  const v = row[column];
  if (v === '' || v === undefined) return null;
  if (!TECH_IDS.includes(String(v))) fail(where(row), `unknown technology "${v}"`);
  return String(v);
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
    districts: {}, terrain: {}, harvest: {}, currencies: {}, units: {}, technologies: {},
    research: {},
    worker: {}, tap: {}, training: {}, taxes: {}, adjacency: [],
    mana: {}, attunement: {}, collection: {}, knowledge: {}, army: {},
    daily: {},
    delve: {}, party: {}, gacha: {}, heroes: {}, ads: {},
    artifacts: {},
    quests: [],
    fog: { rings: [], fallbackGrowth: 0 },
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
      // One more of this district may stand once the named technology is
      // done — how Guildhalls buys a second Market and Second Sanctum a
      // second Sanctum, without a per-count gate mechanism nobody else needs.
      extraCountTech: (r.extra_count_tech === '' || r.extra_count_tech === undefined)
        ? null : r.extra_count_tech,
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

  for (const [id, r] of byId(readSheet(workbook, 'Terrain'), TERRAIN_IDS, 'terrain')) {
    out.terrain[id] = {
      Food: num(r, 'food', { blankAs: 1 }),
      Wood: num(r, 'wood', { blankAs: 1 }),
      Stone: num(r, 'stone', { blankAs: 1 }),
    };
  }

  for (const [id, r] of byId(readSheet(workbook, 'Harvest'), HARVEST_IDS, 'source')) {
    out.harvest[id] = {
      unitsPerStrike: num(r, 'units_per_strike'),
      secondsPerStrike: num(r, 'seconds_per_strike'),
      stock: num(r, 'stock'),
      recoverySeconds: num(r, 'recovery_seconds'),
      respawnSeconds: num(r, 'respawn_seconds', { blankAs: 0 }),
      // Blank = anyone can tap it. A gate here is a TUTORIAL beat: the trees
      // around the Townhall are visible from the first second and refuse the
      // tap until Forestry is in, which is what makes the first research
      // something the player wants rather than something they are told to do.
      requiredTech: techOrBlank(r, 'required_tech'),
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
    out.currencies[id] = {
      cap: (r.cap === '' || r.cap === undefined) ? null : num(r, 'cap'),
      start: num(r, 'start'),
      primary,
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
    // Gold, alone. Research is paid out of the CITY purse, so the tree
    // competes with clearing fog and raising a building for one budget —
    // which is the decision the economy is built around. Minor ranks are
    // Gold too; what separates them from a major is cost and time, not kind
    // (Docs/features/tech-tree.md §1 rule 3).
    // 0 is legal, and only for a spine's rank I: the cover page is GRANTED
    // when its tome opens rather than researched, so it has no price.
    const gold = num(r, 'cost_gold', { blankAs: 0 });
    if (gold < 0) fail(where(r), 'cost_gold cannot be negative');
    if (gold === 0 && !/^(Charter|Warband|Attunement)I$/.test(id)) {
      fail(where(r), 'only a tome cover page may cost nothing');
    }
    const line = (r.line === '' || r.line === undefined) ? null : String(r.line);
    if (!TOME_IDS.includes(r.tome)) fail(where(r), `unknown tome "${r.tome}"`);
    const era = num(r, 'era');
    if (era < 1 || era > 4) fail(where(r), 'era must be 1-4');
    const hasX = r.node_x !== '' && r.node_x !== undefined;
    if (hasX !== (line === null)) {
      fail(where(r), 'a major needs a node position and a minor rank must not have one');
    }
    const knowledge = num(r, 'cost_knowledge', { blankAs: 0 });
    if (knowledge > 0 && era === 1 && !/^(Charter|Warband|Attunement)II$/.test(id)) {
      // Era 1 runs on Gold and time alone: the research clock has not started,
      // and charging for it there would strangle the opening (§3).
      fail(where(r), 'an era-1 technology must not cost Knowledge');
    }
    out.technologies[id] = {
      cost: knowledge > 0 ? { Gold: gold, Knowledge: knowledge } : { Gold: gold },
      durationSeconds: num(r, 'duration_seconds', { blankAs: 0 }),
      requires,
      line,
      effectPerRank: num(r, 'effect_per_rank', { blankAs: 0 }),
      tome: r.tome,
      era,
      // coord(), not num(): a page is centred on its spine, so x is negative
      // on the left of the trunk.
      node: hasX ? { x: coord(r, 'node_x'), y: coord(r, 'node_y') } : null,
      planned: num(r, 'planned', { blankAs: 0 }) === 1,
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
    const lists = {
      district: DISTRICT_IDS, tech: TECH_IDS, currency: CURRENCY_IDS,
      feature: FEATURE_IDS,
    };
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
      rewardStardust: num(r, 'reward_stardust', { blankAs: 0 }),
      rewardKnowledge: num(r, 'reward_knowledge', { blankAs: 0 }),
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
      listCell(d.armyCapPerLevel), d.extraCountTech ?? '',
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

  addSheet(workbook, 'Terrain', TERRAIN_IDS.map((id) => {
    const m = b.terrain[id];
    return [id, m.Food, m.Wood, m.Stone];
  }));

  addSheet(workbook, 'Harvest', HARVEST_IDS.map((id) => {
    const h = b.harvest[id];
    return [id, h.unitsPerStrike, h.secondsPerStrike, h.stock, h.recoverySeconds,
      h.respawnSeconds || '', h.requiredTech ?? ''];
  }));

  addSheet(workbook, 'Currencies', CURRENCY_IDS.map((id) => {
    const c = b.currencies[id];
    return [id, c.cap ?? '', c.start, c.primary ? 1 : '', c.goldValue ?? ''];
  }));

  addSheet(workbook, 'FogRings', b.fog.rings.map((r) => [r.distance, r.cost]));

  addSheet(workbook, 'Technologies', TECH_IDS.map((id) => {
    const t = b.technologies[id];
    return [id, t.cost.Gold || '', t.cost.Knowledge || '', t.durationSeconds || '',
      t.requires.join(','), t.line ?? '', t.effectPerRank || '', t.tome, t.era,
      t.node ? t.node.x : '', t.node ? t.node.y : '', t.planned ? 1 : ''];
  }), (col) => col === 'requires');

  addSheet(workbook, 'Adjacency', (b.adjacency ?? []).map((a) =>
    [a.district, a.neighbor, a.goldPerMinute]));

  addSheet(workbook, 'Quests', (b.quests ?? []).map((q) => [
    q.id, q.name, q.description, q.goalType, q.goalTarget ?? '', q.goalAmount,
    q.goalLevel ?? '', ...costCells(q.reward), q.rewardGems || '', q.rewardStardust || '',
    q.rewardKnowledge || '',
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

  addSheet(workbook, 'Settings', SETTINGS.map(([key, path, kind]) => {
    let value = b;
    for (const part of path.split('.')) value = value[part];
    return [key, kind === 'list' ? listCell(value) : value];
  }), (col, row) => col === 'value' &&
    SETTINGS.some(([key, , kind]) => key === row[0] && kind === 'list'));

  await workbook.xlsx.writeFile(XLSX_PATH);
  console.log(`balance: wrote ${XLSX_PATH}`);
}

// --------------------------------------------------------------------- main

const mode = process.argv[2] ?? 'import';
if (mode === 'import') await importXlsx();
else if (mode === 'export') await exportXlsx();
else fail('(args)', `unknown mode "${mode}" — use import or export`);
