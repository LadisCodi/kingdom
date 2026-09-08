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
  // Workshops: each turns raw resources into ONE refined good.
  'Carpenter', 'MasonsYard', 'Smelter', 'RuneCarver',
  // Decorations: they SUPPLY Harmony and do nothing else. Each has its own
  // count cap, so a Townhall's demand needs several KINDS, and each kind is
  // priced in a different good (Docs/plans/builder-30-days.md §6.3).
  'Garden', 'Well', 'Orchard', 'Statue', 'Plaza', 'Shrine',
];
// Refined goods: what a workshop turns raw resources into, and what an
// advanced building level is priced in. They are NOT wallet rows — the city
// keeps a stockpile, the way the collection keeps ingredients
// (Docs/plans/builder-30-days.md §2).
const GOOD_IDS = ['Planks', 'CutStone', 'Iron', 'Runestone'];

// The technologies are not the workbook's any more: a technology is one
// object in src/sim/data/tech-tree.json — identity, kind, unlocks, price,
// clock and slot — authored in `?dev=tree` (Docs/tech-tree-editor.md). This
// reads that file for the ONE thing the importer still needs from it: the id
// list, so a quest that names a technology can be checked.
const TECH_IDS = Object.keys(JSON.parse(
  readFileSync(join(ROOT, 'src/sim/data/tech-tree.json'), 'utf8'),
).technologies);

const UNIT_IDS = ['Warrior', 'Lancer', 'Archer', 'Cavalry'];
const HARVEST_IDS = ['Forest', 'Crops', 'Berries', 'Meat', 'Stone', 'Fish', 'MountainIron', 'MountainGold'];
const TERRAIN_IDS = ['Grassland', 'Plains', 'Desert', 'Snow', 'Tundra', 'Water'];
// The SIMULATED store's real-money SKUs (Docs/features/14-monetization.md §2).
// Row order is the order the store shows them in.
const STORE_IDS = [
  'GemsPouch', 'GemsPurse', 'GemsChest', 'GemsVault', 'GemsHoard', 'GemsTreasury',
  // Not a Gem pack: the Royal chest grants nothing on purchase, it unlocks the
  // daily chest's paid column for the season and pays out a rung at a time
  // (Docs/features/12-quests.md §3.3). It is a Store row because the BUDGET is
  // the instrument — the purchase log, the refusal and the monthly allowance
  // all have to see it.
  'RoyalChest',
];
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
const HERO_IDS = ['Warden', 'Quartermaster', 'Scholar', 'RelicHunter', 'Scout',
  'Adventurer', 'Bard', 'BeastkinHunter', 'Cleric', 'Cook', 'Gardener', 'Joker',
  'Merchant', 'Priest', 'Rogue', 'ThreeMice', 'Sellsword', 'DarkKnight', 'Paladin',
  'Wizard', 'Witch', 'Druid', 'IceLancer', 'HolyWarrior', 'SavageWarrior', 'Spymaster',
  'ElectricArcher', 'GoldenDragon', 'VampireLord', 'Necromancer', 'Pharao',
  'ElvenPrincess'];
/** What a hero's rarity is worth: its stats, its trait magnitude, and WHICH
 *  banner can roll it. A banner weights each rarity, and a weight of 0 is what
 *  keeps a rarity off a banner — so there is no `pool` column, because the
 *  weights already are the pool (Docs/features/10-heroes.md §5). */
const HERO_RARITIES = ['Common', 'Rare', 'Legendary'];
const BANNER_IDS = ['basic', 'advanced'];
const HERO_TRAITS = [
  'PartyDefence', 'SupplyDiscount', 'KnowledgeBonus', 'FragmentBonus', 'RevealNextDepth',
];
const ARTIFACT_IDS = [
  'DowsingRod', 'VerdantSeal', 'ForemansSigil', 'GildedLedger', 'WanderersCompass',
];

const TOME_IDS = ['Civics', 'Warfare', 'Magic'];
const CURRENCY_IDS = [
  'Gold', 'Food', 'Wood', 'Stone', 'Mana', 'Knowledge', 'Stardust', 'HeroXp', 'Gems',
  // The two gacha keys. Player-scoped like Gems, bought with them, and spent
  // on one banner each — a PRICE on a button, which is the argument for a
  // wallet row over a counter (Docs/features/03-economy.md §1).
  'SilverKey', 'GoldKey',
];
const COST_CURRENCIES = ['Gold', 'Wood', 'Food', 'Stone'];

const SETTINGS = [
  // [sheet key, json path, kind]
  ['worker.move_speed_tiles_per_second', 'worker.moveSpeedTilesPerSecond'],
  ['tap.collect_cooldown_seconds', 'tap.collectCooldownSeconds'],
  ['training.seconds', 'training.seconds'],
  ['taxes.gold_per_population_per_minute', 'taxes.goldPerPopulationPerMinute'],
  ['tap.mana_cost', 'tap.manaCost'],
  // Buying time: one Gem finishes this many seconds of a build or a training
  // line. One rule wherever the player meets it. Kingshot charges 800 Gems an
  // hour; 5 s a Gem is 720 (14-monetization.md §9).
  ['rush.seconds_per_gem', 'rush.secondsPerGem'],
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
  // Where the LATE city starts. Below it a level is priced and timed by the
  // row's own curve, tuned for the opening; from it the late columns take
  // over (`upgrade_cost_late_level_growth`, `upgrade_duration_late_*`), so
  // levels 6-10 can be a multi-hour ladder without deforming levels 2-5.
  ['city.late_upgrade_from_level', 'city.lateUpgradeFromLevel'],
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
  // The simulated wallet (14-monetization.md §3): what each payer profile may
  // spend a MONTH, in dollars. A profile is chosen once per save, and the
  // budget is what turns a free tap into a preference — with money that is
  // scarce, buying one thing means not buying another.
  ['payer.f2p_monthly_usd', 'payer.f2pMonthlyUsd'],
  ['payer.minnow_monthly_usd', 'payer.minnowMonthlyUsd'],
  ['payer.dolphin_monthly_usd', 'payer.dolphinMonthlyUsd'],
  ['payer.whale_monthly_usd', 'payer.whaleMonthlyUsd'],
  ['payer.super_whale_monthly_usd', 'payer.superWhaleMonthlyUsd'],
  // The daily chest season (Docs/features/12-quests.md §3). Parallel lists,
  // one per reward kind, so a rung is a column rather than a sheet — and so
  // the ladder's LENGTH is the length of these lists. The first two are the
  // free track, the `premium_*` ones the Royal track.
  ['daily.season_days', 'daily.seasonDays'],
  ['daily.mana_fractions', 'daily.manaFractions', 'list'],
  ['daily.gems', 'daily.gems', 'list'],
  ['daily.premium_gems', 'daily.premiumGems', 'list'],
  ['daily.premium_gold_keys', 'daily.premiumGoldKeys', 'list'],
  // Hero XP is priced in HOURS of the player's own delve trickle, floored —
  // an absolute XP number goes stale by era three. The floor is what pays a
  // city that has never delved, which is most of them.
  ['daily.premium_xp_hours', 'daily.premiumXpHours', 'list'],
  ['daily.premium_xp_floor', 'daily.premiumXpFloor'],
  ['research.tech_slots', 'research.techSlots'],
  ['research.max_slots', 'research.maxSlots'],
  ['research.slot_gem_cost_base', 'research.slotGemCostBase'],
  ['research.slot_gem_cost_growth', 'research.slotGemCostGrowth'],
  // Mana. The ceiling is DYNAMIC (Townhall level + Sanctum levels), so the
  // Currencies sheet's static `cap` column stays blank for Mana and these are
  // the numbers that actually decide it — see src/sim/mana.ts.
  // The Townhall produces no Mana and sets no ceiling — it gates and nothing
  // else (Docs/features/08-magic.md §2). A flat floor, then the Sanctum,
  // then the sanctuaries: the whole curve lives in the Magic tome now.
  ['mana.base_cap', 'mana.baseCap'],
  ['mana.base_per_hour', 'mana.basePerHour'],
  ['mana.sanctum_cap_per_level', 'mana.sanctumCapPerLevel', 'list'],
  ['mana.sanctum_per_hour_per_level', 'mana.sanctumPerHourPerLevel', 'list'],
  ['mana.landmark_cap', 'mana.landmarkCap'],
  ['mana.meditation_cap', 'mana.meditationCap'],
  // The Gem price of a refill, as a LADDER indexed by how many refills have
  // already been bought TODAY — one entry per rung, so the list's length is
  // also the daily cap (src/sim/manaRefill.ts). A refill is always a whole
  // pool, so the price is never per Mana: what rises is the rung, not the
  // pool.
  ['mana.gem_refill_costs', 'mana.gemRefillCosts', 'list'],
  ['attunement.base_slots', 'attunement.baseSlots'],
  ['attunement.max_slots', 'attunement.maxSlots'],
  ['attunement.slot_gem_cost_base', 'attunement.slotGemCostBase'],
  ['attunement.slot_gem_cost_growth', 'attunement.slotGemCostGrowth'],
  ['attunement.swap_lock_seconds', 'attunement.swapLockSeconds'],
  // The COLLECTION substrate: one set of rules shared by artifacts and heroes.
  // Fragments raise a tier cap; Knowledge buys levels within it.
  // The completed-depth XP trickle, per tier per depth per hour
  // (Docs/features/10-heroes.md §5). Read by the daily chest's Royal track.
  ['collection.xp_trickle_per_tier_depth', 'collection.xpTricklePerTierDepth'],
  ['collection.level_cost_base', 'collection.levelCostBase'],
  ['collection.level_cost_growth', 'collection.levelCostGrowth'],
  ['collection.max_level', 'collection.maxLevel'],
  ['collection.levels_per_tier', 'collection.levelsPerTier'],
  ['collection.max_tier', 'collection.maxTier'],
  ['collection.fragments_per_tier_base', 'collection.fragmentsPerTierBase'],
  ['collection.fragments_per_tier_growth', 'collection.fragmentsPerTierGrowth'],
  // The Stardust TOLL on an ascension, which only HEROES pay: a relic's tier
  // is ingredients and nothing else (Docs/features/10-heroes.md §4). It lives
  // in the shared block rather than under `heroes.` because that key is the
  // Heroes SHEET — thirty-two rows — and a setting written into it would be a
  // thirty-third hero with no stats.
  ['collection.ascension_stardust_base', 'collection.ascensionStardustBase'],
  ['collection.ascension_stardust_growth', 'collection.ascensionStardustGrowth'],
  // A HERO's levels are bought with Hero XP, a relic's with Stardust
  // (Docs/features/10-heroes.md §4) — so the substrate carries two level
  // curves of the same shape in two currencies. The XP one is FIVE TIMES the
  // Stardust one because its faucet is: a room pays x10 XP against x2
  // Stardust and the completed-depth trickle keeps the same ratio
  // (11-expeditions.md §7). Same pacing, bigger numbers. **OQ-79 owns
  // whether that holds up in play.**
  ['collection.xp_level_cost_base', 'collection.xpLevelCostBase'],
  ['collection.xp_level_cost_growth', 'collection.xpLevelCostGrowth'],
  // A HERO's ladder is longer than a relic's and has its own two numbers.
  // `levels_per_tier` and `max_level` above stay the relics': ten levels an
  // ascension is a roster the player grinds for weeks, and a relic is not
  // that shape. **The XP growth is what pays for the length** — 1.6 a level
  // is fine over ten and absurd over fifty (level 50 alone would cost 4e11),
  // so the curve flattens as the ladder stretches and the TOTAL is what is
  // held roughly steady. **OQ-79.**
  ['collection.hero_levels_per_tier', 'collection.heroLevelsPerTier'],
  ['collection.hero_max_level', 'collection.heroMaxLevel'],
  // Knowledge per hour per ruin the player has CLEARED. Discovery pays
  // nothing: taking a dungeon to its bottom is what turns it into a faucet.
  // The floor under the clock: what a kingdom holding no ground still learns
  // an hour. Territory adds to it; it never replaces it. **Fractions are the
  // point**: Knowledge is the slowest currency in the game, so a rate per
  // hour is a fraction of one and a research is priced in tens rather than
  // thousands (2026-09-08).
  ['knowledge.base_per_hour', 'knowledge.basePerHour'],
  ['knowledge.drip_per_cleared_ruin_per_hour', 'knowledge.dripPerClearedRuinPerHour'],
  // The research clock's rate is the ground you have taken, and nothing else:
  // there is deliberately NO base term, so a player who claims nothing
  // generates nothing. Era 1 of the tree costs no Knowledge, which is what
  // keeps that from being a wall (Docs/features/07-research.md §3).
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
  // Ad offers. The cooldown is a RANGE so the offer never becomes a metronome
  // the player can plan around; `eligible_below_fraction` is what keeps it an
  // answer to being short rather than an interruption.
  ['ads.cooldown_min_seconds', 'ads.cooldownMinSeconds'],
  ['ads.cooldown_max_seconds', 'ads.cooldownMaxSeconds'],
  ['ads.eligible_below_fraction', 'ads.eligibleBelowFraction'],
  ['ads.watch_seconds', 'ads.watchSeconds'],
  // How many refills a day a video may pay for. Its own counter, independent
  // of the Gem ladder's, and both roll at UTC midnight.
  ['ads.mana_refills_per_day', 'ads.manaRefillsPerDay'],
  // Harmony's surplus bonus: `supply / demand` thresholds and what each pays
  // on the tax rate. A THRESHOLD AND ITS BONUS ARE ONE FACT, so they travel
  // in one cell rather than two parallel lists. There is deliberately no
  // `harmony.surplus_stat` beside it: the stat a bonus moves is a call site,
  // so a setting whose only legal value is `taxRate` would be a knob that
  // cannot turn (Docs/plans/builder-30-days.md §6.5).
  ['harmony.surplus_tiers', 'harmony.surplusTiers', 'tiers'],
];

/** Kept in step with `AdjacencyStat` and `ADJACENCY_GROUPS` in
 *  src/sim/data/definitions.ts, and with the ±clamp the resolver applies. */
const ADJACENCY_STATS = ['goldPerMinute', 'workTime', 'trainTime'];
const ADJACENCY_GROUPS = ['AnyHall', 'AnyWorkshop', 'AnyProducer', 'AnyDecoration'];
const ADJACENCY_CLAMP = 0.25;

const DISTRICT_COLUMNS = [
  'id', 'size_x', 'size_y', 'max_level', 'population_capacity',
  'fog_reveal_radius', 'fog_discover_radius',
  'max_workers_per_level', 'max_count_per_townhall_level',
  'influence_radius_per_level', 'required_townhall_level_per_level',
  'army_cap_per_level',
  'build_cost_gold', 'build_cost_wood', 'build_cost_food',
  'build_cost_stone', 'build_cost_goods',
  'build_cost_multiplier', 'build_cost_exponential_growth',
  'build_duration_seconds', 'build_duration_district_growth', 'build_duration_distance_growth',
  'upgrade_cost_gold', 'upgrade_cost_wood', 'upgrade_cost_food',
  'upgrade_cost_stone',
  'upgrade_cost_level_growth', 'upgrade_duration_seconds', 'upgrade_duration_level_growth',
  'upgrade_cost_late_level_growth',
  'upgrade_duration_late_seconds', 'upgrade_duration_late_level_growth',
  'upgrade_cost_goods_per_level',
  'extra_units_per_delivery_per_level', 'strike_speed_per_level',
  'sale_price_per_level',
  'produces', 'queue_length_per_level',
  'harmony_supply', 'harmony_cost_per_level',
];
const DISTRICT_LIST_COLUMNS = [
  'population_capacity', 'max_workers_per_level', 'max_count_per_townhall_level',
  'influence_radius_per_level', 'required_townhall_level_per_level',
  'army_cap_per_level',
  'upgrade_cost_goods_per_level', 'queue_length_per_level',
  'extra_units_per_delivery_per_level', 'strike_speed_per_level', 'sale_price_per_level',
  'build_cost_goods', 'harmony_cost_per_level',
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
  // NO `required_tech`: which technology opens a cell is the TECHNOLOGY's to
  // say (`unlocks: [{ harvest: 'Forest' }]`), like every other gate.
  Harvest: ['source', 'units_per_strike', 'seconds_per_strike', 'stock', 'recovery_seconds',
    'respawn_seconds'],
  // A workshop turns raw resources into one good, one queue item at a time,
  // and `work_seconds` is the work ONE villager does — a second worker halves
  // it (Docs/plans/builder-30-days.md §3). `input_good` is the tier-2 recipe:
  // Runestone is cut stone with Mana poured into it.
  Goods: ['id', 'name', 'tier',
    'input_gold', 'input_wood', 'input_food', 'input_stone', 'input_mana',
    'input_good', 'input_good_amount', 'work_seconds'],
  Currencies: ['id', 'cap', 'start', 'primary', 'gold_value'],
  FogRings: ['distance', 'cost'],
  // A rule is (district, neighbour) → one STAT moved by one MAGNITUDE. The
  // Gold column it replaced could only ever say one thing; this can say ten,
  // which is the whole of OQ-48. `neighbor` takes a district id or a group
  // token (AnyHall, AnyWorkshop, AnyProducer).
  Adjacency: ['district', 'neighbor', 'stat', 'magnitude'],
  Quests: ['id', 'name', 'description', 'goal_type', 'goal_target', 'goal_amount',
    'goal_level', 'reward_gold', 'reward_wood', 'reward_food', 'reward_stone',
    'reward_gems', 'reward_stardust', 'reward_knowledge', 'reward_mana'],
  Artifacts: ['id', 'passive_base', 'passive_per_level', 'active_mana_cost',
    'active_duration_seconds', 'active_radius',
    'carried_atk', 'carried_def', 'carried_hp',
    'carried_atk_per_level', 'carried_def_per_level', 'carried_hp_per_level'],
  Heroes: ['id', 'rarity', 'unit_type', 'trait', 'trait_value', 'atk', 'def', 'hp',
    'atk_per_level', 'def_per_level', 'hp_per_level'],
  // Real-money SKUs of the simulated store. `price_usd` is what the purchase
  // deducts from the player's monthly budget; `gems` is what it grants ON
  // PURCHASE, which is 0 for a SKU that pays out over a season. Builders and
  // the hero banner are priced in Gems (Settings), so the store shows them
  // without owning them.
  Store: ['id', 'price_usd', 'gems'],
  // One row per banner. Odds and prices are numbers a designer tunes, so they
  // belong here — unlike a banner SCHEDULE, which is a wall-clock live-ops
  // date and stays out of the workbook (balance/README.md).
  Banners: ['id', 'key', 'key_gem_cost', 'hero_chance', 'soft_pity_at', 'hard_pity_at',
    'legendary_pity_at', 'weight_common', 'weight_rare', 'weight_legendary',
    'duplicate_fragments', 'fragments_per_miss', 'pull_stardust',
    'free_per_day', 'free_cooldown_seconds'],
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

function wallet(row, prefix) {
  const out = {};
  for (const c of COST_CURRENCIES) {
    const v = num(row, `${prefix}_${c.toLowerCase()}`, { blankAs: 0 });
    if (v > 0) out[c] = v;
  }
  return out;
}

/**
 * A per-level goods price: levels separated by `|`, the goods of one level by
 * `,`, each written `Good:amount`. Entry 0 is what it costs to reach level 2,
 * the same indexing every other per-level district column uses.
 *
 *   `|Planks:2|Planks:4,CutStone:2`  →  [{}, {Planks:2}, {Planks:4,CutStone:2}]
 */
function goodsList(row, col) {
  const raw = row[col];
  if (raw === '' || raw === undefined) return [];
  return String(raw).split('|').map((level) => {
    const out = {};
    for (const part of level.split(',')) {
      const entry = part.trim();
      if (entry === '' || entry === '-') continue;
      const [id, amount] = entry.split(':').map((x) => x.trim());
      if (!GOOD_IDS.includes(id)) fail(where(row), `"${col}" has an unknown good ("${id}")`);
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) {
        fail(where(row), `"${col}" has a bad amount for ${id} ("${amount}")`);
      }
      if (out[id] !== undefined) fail(where(row), `"${col}" names ${id} twice in one level`);
      out[id] = n;
    }
    return out;
  });
}

/**
 * A ladder of thresholds and what each one pays, written
 * `1.10:0.05|1.25:0.10|1.50:0.15` — read as "at 110% of demand, +5%".
 * Ascending, because a reader takes the LAST tier reached and a ladder that
 * doubled back would silently pay the wrong one.
 */
function tiers(row, col) {
  const raw = row[col];
  if (raw === '' || raw === undefined) fail(where(row), `"${col}" is blank`);
  const out = [];
  for (const part of String(raw).split('|')) {
    const entry = part.trim();
    if (entry === '') continue;
    const [at, bonus] = entry.split(':').map((x) => Number(String(x).trim()));
    if (!Number.isFinite(at) || at < 1) {
      fail(where(row), `"${col}" has a threshold below 1 ("${entry}") — it is a RATIO of demand`);
    }
    if (!Number.isFinite(bonus) || bonus === 0) {
      fail(where(row), `"${col}" has no bonus for the ${at} tier ("${entry}")`);
    }
    const last = out[out.length - 1];
    if (last && at <= last.at) {
      fail(where(row), `"${col}" is not ascending (${last.at} then ${at})`);
    }
    out.push({ at, bonus });
  }
  if (out.length === 0) fail(where(row), `"${col}" names no tier`);
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
    districts: {}, goods: {}, terrain: {}, harvest: {}, currencies: {}, units: {},
    store: {}, payer: {},
    research: {}, rush: {},
    worker: {}, tap: {}, training: {}, taxes: {}, adjacency: [],
    mana: {}, attunement: {}, collection: {}, knowledge: {}, army: {},
    daily: {},
    delve: {}, party: {}, heroes: {}, ads: {},
    artifacts: {},
    quests: [], banners: {},
    fog: { rings: [], fallbackGrowth: 0 },
    city: { initialCurrencies: {} }, kingdom: {}, harmony: {},
    offlineCapHours: 0,
  };

  for (const [id, r] of byId(readSheet(workbook, 'Districts'), DISTRICT_IDS)) {
    // A build has ONE level, so its goods price is one entry of the
    // `|`-separated form the upgrade column already uses — same parser, same
    // validation of the ids and the amounts.
    const buildGoodsLevels = goodsList(r, 'build_cost_goods');
    if (buildGoodsLevels.length > 1) {
      fail(where(r), '"build_cost_goods" has more than one level — a build has only one');
    }
    const buildGoods = buildGoodsLevels[0] ?? {};
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
      armyCapPerLevel: list(r, 'army_cap_per_level'),
      buildCost: wallet(r, 'build_cost'),
      // Refined goods a BUILD costs, on top of the currencies. Only the
      // decorations name any today, and that is the point of them: a piece of
      // beauty is a queue at a workshop rather than a walk to the map.
      buildCostGoods: buildGoods,
      buildCostMultiplier: num(r, 'build_cost_multiplier'),
      buildCostExponentialGrowth: num(r, 'build_cost_exponential_growth'),
      buildDurationSeconds: num(r, 'build_duration_seconds'),
      buildDurationDistrictGrowth: num(r, 'build_duration_district_growth'),
      buildDurationDistanceGrowth: num(r, 'build_duration_distance_growth'),
      upgradeCost: wallet(r, 'upgrade_cost'),
      upgradeCostLevelGrowth: num(r, 'upgrade_cost_level_growth'),
      upgradeDurationSeconds: num(r, 'upgrade_duration_seconds'),
      upgradeDurationLevelGrowth: num(r, 'upgrade_duration_level_growth'),
      // The late curve. 0 = "this row has no late levels", and every level is
      // priced and timed by the columns above it.
      upgradeCostLateLevelGrowth: num(r, 'upgrade_cost_late_level_growth', { blankAs: 0 }),
      upgradeDurationLateSeconds: num(r, 'upgrade_duration_late_seconds', { blankAs: 0 }),
      upgradeDurationLateLevelGrowth:
        num(r, 'upgrade_duration_late_level_growth', { blankAs: 0 }),
      upgradeCostGoodsPerLevel: goodsList(r, 'upgrade_cost_goods_per_level'),
      // What a producer's late level buys instead of crew: units ADDED to a
      // delivery (the shape WorkerLoad already uses, because a chunk is 1-5
      // units and a percentage of that rounds away), and a multiplier on the
      // swing. Blank = 0 added, 1.0 speed.
      extraUnitsPerDeliveryPerLevel: list(r, 'extra_units_per_delivery_per_level'),
      strikeSpeedPerLevel: list(r, 'strike_speed_per_level'),
      // The Market's own ladder: what its level pays for a sold unit. Blank =
      // 1.0, which is every other building.
      salePricePerLevel: list(r, 'sale_price_per_level'),
      // A workshop makes ONE good. Which one is its identity, the way a
      // Sawmill's identity is the forest.
      produces: (r.produces === '' || r.produces === undefined) ? null : r.produces,
      queueLengthPerLevel: list(r, 'queue_length_per_level'),
      // Harmony. A decoration SUPPLIES; everything else DEMANDS, and the
      // demand is the TOTAL at that level rather than an increment — indexed
      // from level 1 like `army_cap_per_level`, so one column states the
      // build gate (entry 0) and every upgrade gate, and nothing anywhere has
      // to sum a prefix (Docs/plans/builder-30-days.md §6.1).
      harmonySupply: num(r, 'harmony_supply', { blankAs: 0 }),
      harmonyCostPerLevel: list(r, 'harmony_cost_per_level'),
    };
    const made = out.districts[id].produces;
    if (made !== null && !GOOD_IDS.includes(made)) {
      fail(where(r), `"produces" is not a good ("${made}")`);
    }
    if ((made === null) !== (out.districts[id].queueLengthPerLevel.length === 0)) {
      fail(where(r), 'a workshop needs both "produces" and "queue_length_per_level"');
    }
    const d = out.districts[id];
    // A decoration has no level, no crew, no residents, no queue and nothing
    // it trains. Its whole contribution is the number in `harmony_supply`, so
    // a row that supplies AND does something else is a row whose author meant
    // two different buildings.
    if (d.harmonySupply > 0) {
      if (!Number.isInteger(d.harmonySupply)) {
        fail(where(r), '"harmony_supply" is not a whole number');
      }
      if (d.maxLevel !== 1) fail(where(r), 'a decoration has no ladder — "max_level" must be 1');
      for (const col of ['max_workers_per_level', 'population_capacity',
        'army_cap_per_level', 'influence_radius_per_level', 'queue_length_per_level']) {
        if (list(r, col).length > 0) fail(where(r), `a decoration has no "${col}"`);
      }
      if (made !== null) fail(where(r), 'a decoration makes nothing — clear "produces"');
      if (d.harmonyCostPerLevel.length > 0) {
        fail(where(r), 'a decoration supplies Harmony; it does not demand it');
      }
    }
    // Demand is a TOTAL at each level, so it can stand still but never fall.
    d.harmonyCostPerLevel.forEach((n, i) => {
      if (i > 0 && n < d.harmonyCostPerLevel[i - 1]) {
        fail(where(r), '"harmony_cost_per_level" falls at level '
          + `${i + 1} (${d.harmonyCostPerLevel[i - 1]} then ${n}) — it is a total, not an increment`);
      }
    });
  }

  for (const [id, r] of byId(readSheet(workbook, 'Goods'), GOOD_IDS)) {
    const inputGood = (r.input_good === '' || r.input_good === undefined) ? null : r.input_good;
    if (inputGood !== null && !GOOD_IDS.includes(inputGood)) {
      fail(where(r), `"input_good" is not a good ("${inputGood}")`);
    }
    if (inputGood === id) fail(where(r), 'a good cannot be made of itself');
    out.goods[id] = {
      name: String(r.name),
      tier: num(r, 'tier'),
      input: wallet(r, 'input'),
      inputMana: num(r, 'input_mana', { blankAs: 0 }),
      inputGood,
      inputGoodAmount: inputGood === null ? 0 : num(r, 'input_good_amount'),
      workSeconds: num(r, 'work_seconds'),
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

  const adjacencySeen = new Set();
  for (const r of readSheet(workbook, 'Adjacency')) {
    // EITHER column may be a district or one of the group tokens, which are
    // derived sets in definitions.ts rather than rows anywhere — so the four
    // halls sharing a rule is one line, not twelve.
    for (const col of ['district', 'neighbor']) {
      if (!DISTRICT_IDS.includes(r[col]) && !ADJACENCY_GROUPS.includes(r[col])) {
        fail(where(r), `unknown ${col} "${r[col]}" — a district id or ` +
          ADJACENCY_GROUPS.join('/'));
      }
    }
    if (!ADJACENCY_STATS.includes(r.stat)) {
      fail(where(r), `unknown stat "${r.stat}" — one of ${ADJACENCY_STATS.join(', ')}`);
    }
    // One rule per (district, neighbour, stat): two rows moving the same stat
    // for the same pair would just be one row with their sum, and reading
    // both is how a designer double-counts by accident.
    const key = `${r.district}+${r.neighbor}+${r.stat}`;
    if (adjacencySeen.has(key)) fail(where(r), `duplicate adjacency rule ${key}`);
    adjacencySeen.add(key);
    const magnitude = signedNum(r, 'magnitude');
    if (magnitude === 0) fail(where(r), 'a rule with magnitude 0 does nothing — delete the row');
    // A fraction is a fraction: anything past the clamp is authored noise,
    // because the resolver would refuse to pay it anyway.
    if (r.stat !== 'goldPerMinute' && Math.abs(magnitude) > ADJACENCY_CLAMP) {
      fail(where(r), `"${r.stat}" magnitude ${magnitude} is past the ±${ADJACENCY_CLAMP} clamp`);
    }
    out.adjacency.push({
      district: r.district,
      neighbor: r.neighbor,
      stat: r.stat,
      magnitude,
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
      // Mana is a city currency but not one of the four `reward_*` wallet
      // columns, which are the materials every cost sheet shares. It gets a
      // scalar of its own, the way Gems and Stardust do.
      rewardMana: num(r, 'reward_mana', { blankAs: 0 }),
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
    if (!HERO_RARITIES.includes(r.rarity)) fail(where(r), `unknown rarity "${r.rarity}"`);
    out.heroes[id] = {
      rarity: r.rarity,
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

  for (const [id, r] of byId(readSheet(workbook, 'Store'), STORE_IDS)) {
    const priceUsd = num(r, 'price_usd');
    const gems = num(r, 'gems');
    if (priceUsd <= 0) fail(where(r), 'a store SKU needs a positive price');
    if (gems < 0) fail(where(r), 'a store SKU cannot grant negative Gems');
    out.store[id] = { priceUsd, gems };
  }

  for (const [id, r] of byId(readSheet(workbook, 'Banners'), BANNER_IDS)) {
    if (!CURRENCY_IDS.includes(r.key)) fail(where(r), `"key" is not a currency ("${r.key}")`);
    const weights = {
      Common: num(r, 'weight_common', { blankAs: 0 }),
      Rare: num(r, 'weight_rare', { blankAs: 0 }),
      Legendary: num(r, 'weight_legendary', { blankAs: 0 }),
    };
    // A banner that weights nothing can roll nothing. Loudly, here, rather
    // than as a pull that silently returns 'NothingToPull' forever.
    if (Object.values(weights).every((w) => w <= 0)) {
      fail(where(r), 'weights every rarity at 0 — the banner can roll nothing');
    }
    const chance = num(r, 'hero_chance');
    if (chance <= 0 || chance > 1) fail(where(r), `"hero_chance" is ${chance}, not a fraction`);
    const soft = num(r, 'soft_pity_at');
    const hard = num(r, 'hard_pity_at');
    if (soft >= hard) fail(where(r), `soft pity (${soft}) must come before hard pity (${hard})`);
    // 0 = this banner has no legendary guarantee, which is right for one that
    // weights Legendary at 0 and wrong for one that does not.
    const legendary = num(r, 'legendary_pity_at', { blankAs: 0 });
    if ((legendary > 0) !== (weights.Legendary > 0)) {
      fail(where(r), 'a legendary guarantee and a legendary weight go together');
    }
    out.banners[id] = {
      key: r.key,
      keyGemCost: num(r, 'key_gem_cost'),
      heroChance: chance,
      softPityAt: soft,
      hardPityAt: hard,
      legendaryPityAt: legendary,
      weights,
      duplicateFragments: num(r, 'duplicate_fragments'),
      fragmentsPerMiss: num(r, 'fragments_per_miss'),
      pullStardust: num(r, 'pull_stardust'),
      freePerDay: num(r, 'free_per_day', { blankAs: 0 }),
      freeCooldownSeconds: num(r, 'free_cooldown_seconds', { blankAs: 0 }),
    };
  }

  const settings = byId(readSheet(workbook, 'Settings'), SETTINGS.map(([k]) => k), 'key');
  for (const [key, path, kind] of SETTINGS) {
    const row = settings.get(key);
    const value = kind === 'list' ? list(row, 'value')
      : kind === 'tiers' ? tiers(row, 'value')
        : num(row, 'value');
    const parts = path.split('.');
    let target = out;
    while (parts.length > 1) target = target[parts.shift()];
    target[parts[0]] = value;
  }

  // The late curve is checked here rather than in the Districts loop, because
  // where the late city starts is a Setting and the settings are read last.
  // A building that reaches past the pivot without the late columns would be
  // priced and timed for levels 6-10 by a curve tuned for the opening, which
  // is silently wrong rather than loudly wrong.
  const pivot = out.city.lateUpgradeFromLevel;
  for (const [id, d] of Object.entries(out.districts)) {
    const late = d.maxLevel >= pivot;
    const authored = d.upgradeCostLateLevelGrowth > 0
      || d.upgradeDurationLateSeconds > 0 || d.upgradeDurationLateLevelGrowth > 0;
    if (!late && authored) {
      fail(`Districts/${id}`, `has late-curve columns but stops at level ${d.maxLevel}`);
    }
    if (late && !authored && Object.keys(d.upgradeCost).length > 0) {
      fail(`Districts/${id}`,
        `reaches level ${d.maxLevel} but authors no late curve — set ` +
        'upgrade_cost_late_level_growth and upgrade_duration_late_*');
    }
  }

  writeFileSync(JSON_PATH, JSON.stringify(out, null, 2) + '\n');
  console.log(`balance: wrote ${JSON_PATH}`);
}

// ------------------------------------------------------------------- export

const listCell = (arr) => arr.join(',');

const goodsCell = (levels) => levels
  .map((m) => Object.entries(m).map(([id, n]) => `${id}:${n}`).join(','))
  .join('|');
const costCells = (w) => COST_CURRENCIES.map((c) => (w[c] && w[c] !== 0 ? w[c] : ''));
const tiersCell = (ts) => ts.map((t) => `${t.at}:${t.bonus}`).join('|');

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
      listCell(d.armyCapPerLevel),
      ...costCells(d.buildCost),
      goodsCell(Object.keys(d.buildCostGoods).length > 0 ? [d.buildCostGoods] : []),
      d.buildCostMultiplier, d.buildCostExponentialGrowth,
      d.buildDurationSeconds, d.buildDurationDistrictGrowth, d.buildDurationDistanceGrowth,
      ...costCells(d.upgradeCost),
      d.upgradeCostLevelGrowth, d.upgradeDurationSeconds, d.upgradeDurationLevelGrowth,
      d.upgradeCostLateLevelGrowth || '',
      d.upgradeDurationLateSeconds || '', d.upgradeDurationLateLevelGrowth || '',
      goodsCell(d.upgradeCostGoodsPerLevel),
      listCell(d.extraUnitsPerDeliveryPerLevel), listCell(d.strikeSpeedPerLevel),
      listCell(d.salePricePerLevel),
      d.produces ?? '', listCell(d.queueLengthPerLevel),
      d.harmonySupply || '', listCell(d.harmonyCostPerLevel),
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
      h.respawnSeconds || ''];
  }));

  addSheet(workbook, 'Goods', GOOD_IDS.map((id) => {
    const g = b.goods[id];
    return [id, g.name, g.tier,
      ...costCells(g.input), g.inputMana || '',
      g.inputGood ?? '', g.inputGoodAmount || '', g.workSeconds];
  }));

  addSheet(workbook, 'Currencies', CURRENCY_IDS.map((id) => {
    const c = b.currencies[id];
    return [id, c.cap ?? '', c.start, c.primary ? 1 : '', c.goldValue ?? ''];
  }));

  addSheet(workbook, 'FogRings', b.fog.rings.map((r) => [r.distance, r.cost]));

  addSheet(workbook, 'Adjacency', (b.adjacency ?? []).map((a) =>
    [a.district, a.neighbor, a.stat, a.magnitude]));

  addSheet(workbook, 'Quests', (b.quests ?? []).map((q) => [
    q.id, q.name, q.description, q.goalType, q.goalTarget ?? '', q.goalAmount,
    q.goalLevel ?? '', ...costCells(q.reward), q.rewardGems || '', q.rewardStardust || '',
    q.rewardKnowledge || '', q.rewardMana || '',
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
    return [id, h.rarity, h.unitType, h.trait, h.traitValue, h.atk, h.def, h.hp,
      h.atkPerLevel, h.defPerLevel, h.hpPerLevel];
  }));

  addSheet(workbook, 'Banners', BANNER_IDS.map((id) => {
    const n = b.banners[id];
    return [id, n.key, n.keyGemCost, n.heroChance, n.softPityAt, n.hardPityAt,
      n.legendaryPityAt || '', n.weights.Common || '', n.weights.Rare || '',
      n.weights.Legendary || '', n.duplicateFragments, n.fragmentsPerMiss,
      n.pullStardust, n.freePerDay || '', n.freeCooldownSeconds || ''];
  }));

  addSheet(workbook, 'Store', STORE_IDS.map((id) => {
    const s = b.store[id];
    return [id, s.priceUsd, s.gems];
  }));

  addSheet(workbook, 'Settings', SETTINGS.map(([key, path, kind]) => {
    let value = b;
    for (const part of path.split('.')) value = value[part];
    return [key, kind === 'list' ? listCell(value)
      : kind === 'tiers' ? tiersCell(value)
        : value];
  }), (col, row) => col === 'value' &&
    SETTINGS.some(([key, , kind]) => key === row[0] && kind !== undefined));

  await workbook.xlsx.writeFile(XLSX_PATH);
  console.log(`balance: wrote ${XLSX_PATH}`);
}

// --------------------------------------------------------------------- main

const mode = process.argv[2] ?? 'import';
if (mode === 'import') await importXlsx();
else if (mode === 'export') await exportXlsx();
else fail('(args)', `unknown mode "${mode}" — use import or export`);
