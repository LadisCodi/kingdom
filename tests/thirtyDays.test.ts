// The thirty-day harness — Docs/plans/builder-30-days.md §1.
//
// A scripted player who visits three times a day for thirty days, plays only
// what the game grants and earns, and follows one fixed policy. Every visit
// goes through the REAL offline catch-up (serialize → deserialize), so the
// 8-hour cap is inside the measurement. The output is a week-by-week table of
// where the city stands, and the assertions pin the pacing the builder
// programme is trying to move: they are the baseline, not a target.
//
// Like the onboarding test: no `fund()`, ever.
//
// It is NOT part of `npm test`: thirty days of three visits is ~45 seconds of
// arithmetic against a suite that runs in one. Run it with `npm run harness`
// (`KINGDOM_DAYS=7` shortens a run while the policy itself is being written).
import { describe, expect, it } from 'vitest';
import {
  DECORATIONS, DISTRICTS, GOODS, TAP, TECH_ORDER, TECHNOLOGIES, type DistrictDef,
} from '../src/sim/data/definitions';
import {
  advance, changeWorkers, enqueueBuild, upgradeDistrict,
} from '../src/sim/commands';
import {
  LATE_FROM, placementBlock, maxCountForTownhallLevel, maxDistrictCount, requiredTechForLevel,
  requiredTownhallLevel, upgradeGoodsCost, validPlacementCells,
} from '../src/sim/districts';
import { explorationGate, fogState, isReachable, revealCostForCell, revealTap } from '../src/sim/fog';
import { collectTap, harvestSourceAt } from '../src/sim/harvest';
import { claimLandmark, isLandmarkClaimed, visibleLandmarks } from '../src/sim/landmarks';
import { harmonyBlock, harmonyDemand, harmonySupply } from '../src/sim/harmony';
import { mana } from '../src/sim/mana';
import { newGame } from '../src/sim/newGame';
import { availableWorkers, houseTap, housedPopulation, maxPopulation } from '../src/sim/population';
import { activeQuest, claimQuest, isQuestComplete } from '../src/sim/quests';
import { canStartTech, isTechComplete, startTech, techCost } from '../src/sim/research';
import { deserialize, serialize } from '../src/sim/save';
import { choosePayerProfile } from '../src/sim/store';
import {
  armyPower, availableRoster, maxArmyPower, trainUnit, trainerFor,
} from '../src/sim/army';
import {
  discoveredRuins, extract, freeHeroes, launchDelve, pushDeeper,
} from '../src/sim/expeditions';
import { RUINS, UNITS } from '../src/sim/data/definitions';
import { influenceCells } from '../src/sim/workers';
import { canAffordGoods, getGood } from '../src/sim/goods';
import { isWorkshop, queueGood } from '../src/sim/workshops';
import type { TechId, UnitId } from '../src/sim/state';
import {
  buildQueueCapacity, coordKey, getWallet, type Coord, type District, type DistrictId,
  type GameState,
} from '../src/sim/state';
import { map, T0, TEST_SEED } from './helpers';

const DAY = 86_400_000;
/** Thirty, unless a run is being shortened to iterate on the policy itself. */
const DAYS = Number(process.env.KINGDOM_DAYS ?? 30);
/** Three check-ins a day, hours after midnight UTC. The gap 21:00 → 08:00 is
 *  eleven hours, so every night crosses the 8 h offline cap on purpose. */
const VISIT_HOURS = [8, 14, 21];
const TAPS_PER_VISIT = 120; // a thumb budget: Mana runs out first anyway
/** The thumb's budget for FOG. It used to be what paced exploration — a cell
 *  cost one tap a Gold, so the far rings were hundreds of presses — and it no
 *  longer is: a cell is five taps at every ring, so this budget is a ceiling
 *  the purse now hits first (01-map-and-fog.md §5). Kept as the session's
 *  outer bound: a visit is ~10 minutes and a tap is half a second. */
const FOG_TAPS_PER_VISIT = 1_000;

/** What the scripted player builds, in the order they reach for it. Each
 *  entry is tried while the count cap, the technology and the purse allow. */
const BUILD_ORDER: DistrictId[] = [
  'Sawmill', 'Housing', 'FarmLands', 'Farm', 'Quarry', 'Market', 'Housing',
  'Sanctum', 'Docks', 'Barracks', 'SpearHall', 'ShootingGrounds', 'Stables',
  // The workshops, once their cards and Townhall 5 allow: every level from 6
  // is priced in what they make, and the Townhall's own from 5.
  'Carpenter', 'MasonsYard', 'Smelter', 'RuneCarver',
];
/** A visit is about this long. A research that finishes inside it is waited
 *  for and the next one started — a player does not leave after one card. */
const VISIT_MS = 10 * 60_000;

interface WeekRow {
  week: number; townhall: number; population: number; roofs: number; food: number; districts: number;
  maxed: number; levels: number; techs: number; gold: number; knowledge: number;
  army: number; ruins: number; landmarks: number; harmony: string; idleDays: number;
}

const townhall = (state: GameState): District =>
  state.city.districts.find((d) => d.definitionId === 'Townhall')!;

const builtCount = (state: GameState, id: DistrictId): number =>
  state.city.districts.filter((d) => d.definitionId === id).length;

/** The four von Neumann neighbours of a 1×1 cell that hold Housing. */
const housingNeighbours = (state: GameState, cell: Coord): number =>
  state.city.districts.filter((d) => d.definitionId === 'Housing'
    && Math.abs(d.location.x - cell.x) + Math.abs(d.location.y - cell.y) === 1).length;

/** Where to put a building: a producer goes where its area of influence
 *  covers the most cells it can work; a house goes where it has the fewest
 *  house neighbours; anything else takes the first legal cell. */
function chooseCell(state: GameState, def: DistrictDef): Coord | null {
  const cells = validPlacementCells(state, map, def.id);
  if (cells.length === 0) return null;
  if (def.id === 'Housing') {
    return cells.slice().sort((a, b) => housingNeighbours(state, a) - housingNeighbours(state, b))[0];
  }
  if (def.harvestSources.length > 0) {
    const score = (cell: Coord): number => {
      const ghost: District = {
        uniqueId: 'ghost', definitionId: def.id, level: 1, assignedWorkers: 0,
        location: cell, state: 'Built', visualVariant: 1,
      };
      return influenceCells(map, ghost).filter((c) => {
        const src = harvestSourceAt(state, c);
        return src !== null && def.harvestSources.includes(src)
          && state.fog.revealed[coordKey(c)] === true;
      }).length;
    };
    const best = cells.slice().sort((a, b) => score(b) - score(a))[0];
    return score(best) > 0 ? best : null;
  }
  // A crop plot is its own resource: put it where the Farm can reach it, or
  // anywhere legal if no Farm exists yet.
  return cells[0];
}

/** Delve bookkeeping, for the run's closing diagnostic. */
let launched = 0;
let extracted = 0;

/** One visit. Returns true if the player did anything that moves the city. */
function playVisit(state: GameState, now: number): { acted: boolean; until: number } {
  let acted = false;
  let t = now;
  const tick = (ms: number) => { t += ms; advance(state, map, t); };

  // 1. Claim every quest that is complete.
  for (let i = 0; i < 20; i++) {
    const q = activeQuest(state);
    if (!q || !isQuestComplete(state, q)) break;
    if (claimQuest(state) !== 'Claimed') break;
    acted = true;
  }

  // Mana the thumb must LEAVE: a Runestone costs Mana to queue, and a Townhall
  // level that asks for one waits on it — the taps would otherwise drain the
  // pool every visit and the Rune Carver would never start.
  const runestoneShort = Math.max(0,
    (upgradeGoodsCost('Townhall', townhall(state).level + 1).Runestone ?? 0)
    - getGood(state.city.goods, 'Runestone'));
  const manaReserve = state.city.districts.some((d) => d.definitionId === 'RuneCarver' && d.state === 'Built')
    ? runestoneShort * GOODS.Runestone.inputMana : 0;

  // 2. Tap: houses first (rent), then every revealed resource cell, round
  //    robin, until Mana or the thumb budget runs out.
  const houses = state.city.districts.filter((d) => d.definitionId === 'Housing' && d.state === 'Built');
  const resourceCells = map.cells.filter((c) => harvestSourceAt(state, c) !== null
    && fogState(state, map, c) === 'Revealed');
  // One tick per ROUND, not per tap: the collect cooldown is per cell, so a
  // round-robin over every cell already leaves each one longer than its
  // cooldown. Ticking per tap would be a full advance() per tap.
  let taps = 0;
  for (const h of houses) {
    if (mana(state) < 1 || taps >= TAPS_PER_VISIT) break;
    if (houseTap(state, h, t).result === 'Collected') taps++;
  }
  let rounds = 0;
  while (mana(state) >= 1 && taps < TAPS_PER_VISIT && rounds++ < 12) {
    let any = false;
    let inRound = 0;
    for (const cell of resourceCells) {
      if (mana(state) < 1 + manaReserve || taps >= TAPS_PER_VISIT) break;
      if (collectTap(state, map, cell, t) === 'Harvested') { any = true; taps++; inRound++; }
    }
    // The thumb's own cadence: a round of N taps took N cooldowns to make.
    tick(Math.max(1, inRound) * TAP.collectCooldownSeconds * 1000);
    if (!any) break;
  }
  if (taps > 0) acted = true;

  // 3. Villagers: fill every roof.
  for (let i = 0; i < 40; i++) {
    if (housedPopulation(state) + state.city.trainingQueue.length >= maxPopulation(state)) break;
    if (trainUnit(state, 'Villager', t) !== 'Queued') break;
    acted = true;
  }

  // The Townhall is asked FIRST, because its answer shapes the visit: a good
  // nobody makes yet → that workshop is built and crewed before anything
  // else; Harmony → the card that discovers a decoration is wanted.
  const needs = { goods: new Set<string>(), harmony: false };
  {
    const th = townhall(state);
    const r = upgradeDistrict(state, th.uniqueId);
    if (r === 'Started') acted = true;
    if (r === 'NeedsHarmony') needs.harmony = true;
    if (r === 'NotEnoughGoods' && harmonyBlock(state, DISTRICTS.Townhall, th.level + 1, th) !== null) {
      needs.harmony = true;
    }
    if (r === 'NotEnoughGoods') {
      for (const good of Object.keys(upgradeGoodsCost('Townhall', th.level + 1))) needs.goods.add(good);
    }
  }
  const makerOf = (good: string): DistrictDef | undefined =>
    Object.values(DISTRICTS).find((d) => d.produces === good);

  // 4. Put every free villager to work. The makers of what the Townhall is
  //    short of get one villager each before anyone; then the producers,
  //    lowest-crewed first — food and wood are what trains the next villager;
  //    then whatever is left goes to the workshops. A workshop is always the
  //    emptiest building in town, and crewing it first starved the farms.
  const crew = (d: District): boolean => changeWorkers(state, map, d.uniqueId, 1, t) === 'Assigned';
  for (const good of needs.goods) {
    const maker = makerOf(good);
    const shop = maker && state.city.districts
      .find((d) => d.definitionId === maker.id && d.state === 'Built' && d.assignedWorkers === 0);
    if (!shop) continue;
    if (availableWorkers(state) === 0) {
      // Nobody idle: a player moves someone. The fullest crew that is not
      // itself a needed maker gives one up.
      const donor = state.city.districts
        .filter((d) => d.state === 'Built' && d.assignedWorkers > 0
          && ![...needs.goods].some((g) => makerOf(g)?.id === d.definitionId))
        .sort((a, b) => b.assignedWorkers - a.assignedWorkers)[0];
      if (donor) changeWorkers(state, map, donor.uniqueId, -1, t);
    }
    if (availableWorkers(state) > 0 && crew(shop)) acted = true;
  }
  for (const pass of ['producers', 'workshops'] as const) {
    for (let i = 0; i < 60 && availableWorkers(state) > 0; i++) {
      // Food first: it is what the next villager costs, and a farm with no
      // crew is a town that stops growing.
      const feeds = (d: District): number =>
        (DISTRICTS[d.definitionId].harvestSources.includes('Crops') ? 0 : 1);
      const crews = state.city.districts
        .filter((d) => d.state === 'Built' && DISTRICTS[d.definitionId].maxWorkersPerLevel.length > 0)
        .filter((d) => isWorkshop(d) === (pass === 'workshops'))
        .sort((a, b) => feeds(a) - feeds(b) || a.assignedWorkers - b.assignedWorkers);
      let placed = false;
      for (const d of crews) {
        if (crew(d)) { placed = true; acted = true; break; }
      }
      if (!placed) break;
    }
  }

  // 5. Build and upgrade while a builder is free. The Townhall first, then a
  //    roof when the city is full, then the build order, then upgrades.
  //    `chooseCell` scans the whole plot, so its answer is cached for the
  //    visit and dropped as soon as a building actually lands.
  const cellCache = new Map<DistrictId, Coord | null>();
  const cellFor = (def: DistrictDef): Coord | null => {
    if (!cellCache.has(def.id)) cellCache.set(def.id, chooseCell(state, def));
    return cellCache.get(def.id)!;
  };
  // A level refused for Harmony is answered the way the card says: with a
  // decoration — the cheapest kind the city may still stand.
  const buildDecoration = (): boolean => {
    for (const id of DECORATIONS) {
      const def = DISTRICTS[id];
      if (def.requiredTech !== null && !isTechComplete(state, def.requiredTech)) continue;
      if (builtCount(state, id) >= maxDistrictCount(state, def)) continue;
      const cell = cellFor(def);
      if (!cell) continue;
      if (enqueueBuild(state, map, id, cell) === 'Started') return true;
    }
    return false;
  };
  // The Townhall is the clock every ladder hangs from, so when it is ready
  // in everything but a builder, the builder is kept for it: no build and no
  // other upgrade is started this visit.
  const townhallWaitsOnBuilder = (): boolean => {
    const th = townhall(state);
    const next = th.level + 1;
    if (next > DISTRICTS.Townhall.maxLevel) return false;
    if (state.city.queue.some((q) => q.districtUniqueId === th.uniqueId)) return false;
    const gate = requiredTechForLevel('Townhall', next);
    if (gate !== null && !isTechComplete(state, gate)) return false;
    return canAffordGoods(state.city.goods, upgradeGoodsCost('Townhall', next))
      && harmonyBlock(state, DISTRICTS.Townhall, next, th) === null
      && state.city.queue.length >= buildQueueCapacity(state);
  };
  for (let i = 0; i < 12; i++) {
    let started = false;
    const th = townhall(state);
    const thResult = upgradeDistrict(state, th.uniqueId);
    if (thResult === 'Started') started = true;
    if (thResult === 'NoBuilderFree' && townhallWaitsOnBuilder()) break;
    if (thResult === 'NeedsHarmony' && buildDecoration()) started = true;
    // Goods are refused before Harmony is, and both take days: ask about the
    // Harmony too, so the decoration is standing by the time the goods are.
    if (thResult === 'NotEnoughGoods'
      && harmonyBlock(state, DISTRICTS.Townhall, th.level + 1, th) !== null
      && buildDecoration()) started = true;
    if (thResult === 'NotEnoughGoods') {
      for (const good of Object.keys(upgradeGoodsCost('Townhall', th.level + 1))) {
        const maker = makerOf(good);
        if (!maker || builtCount(state, maker.id) >= maxDistrictCount(state, maker)) continue;
        const cell = cellFor(maker);
        if (!cell || placementBlock(state, map, maker.id, cell) !== null) continue;
        if (enqueueBuild(state, map, maker.id, cell) === 'Started') { started = true; break; }
      }
    }
    if (!started && housedPopulation(state) >= maxPopulation(state) - 1) {
      const cell = cellFor(DISTRICTS.Housing);
      if (cell && builtCount(state, 'Housing') < maxDistrictCount(state, DISTRICTS.Housing)
        && enqueueBuild(state, map, 'Housing', cell) === 'Started') started = true;
      if (!started) {
        for (const h of houses) {
          if (upgradeDistrict(state, h.uniqueId) === 'Started') { started = true; break; }
        }
      }
    }
    if (!started) {
      for (const id of BUILD_ORDER) {
        const def = DISTRICTS[id];
        if (builtCount(state, id) >= maxDistrictCount(state, def)) continue;
        const cell = cellFor(def);
        if (!cell || placementBlock(state, map, id, cell) !== null) continue;
        const r = enqueueBuild(state, map, id, cell);
        if (r === 'Started') { started = true; break; }
        if (r === 'NoBuilderFree') break;
      }
    }
    if (started) cellCache.clear(); // the plot moved under every cached answer
    if (!started) {
      const candidates = state.city.districts
        .filter((d) => d.state === 'Built' && d.definitionId !== 'Townhall'
          && d.level < DISTRICTS[d.definitionId].maxLevel)
        .sort((a, b) => a.level - b.level);
      let needsHarmony = false;
      for (const d of candidates) {
        const r = upgradeDistrict(state, d.uniqueId);
        if (r === 'Started') { started = true; break; }
        if (r === 'NeedsHarmony') { needsHarmony = true; needs.harmony = true; }
        if (r === 'NoBuilderFree') break;
      }
      if (!started && needsHarmony && buildDecoration()) started = true;
    }
    if (!started) break;
    acted = true;
  }

  // 5b. The workshops: queue what the next Townhall level asks for, and a
  //     little over — never a full queue regardless. Goods are made of raw
  //     Stone and Wood, and a crew that turns every stone into blocks leaves
  //     none for the building that would have used it: this player once sat
  //     on 160 Cut Stone with no Rune Carver, refused for 200 Stone.
  const nextGoods = upgradeGoodsCost('Townhall', townhall(state).level + 1);
  for (const d of state.city.districts) {
    if (d.state !== 'Built' || !isWorkshop(d)) continue;
    const good = DISTRICTS[d.definitionId].produces!;
    const enough = Math.max(6, 2 * (nextGoods[good] ?? 0));
    for (let i = 0; i < 12; i++) {
      if (getGood(state.city.goods, good) >= enough) break;
      if (queueGood(state, d.uniqueId, t) !== 'Queued') break;
      acted = true;
    }
  }

  // 6. The army, and the ruins it is for. Knowledge only comes from ground
  //    the kingdom holds — claimed landmarks and CLEARED RUINS — so a player
  //    who never delves never reaches the era-3 keystones the late city is
  //    gated behind (Docs/features/07-research.md §3). Delving is on the
  //    critical path of the builder, and the harness has to walk it.
  for (let i = 0; i < 30; i++) {
    const cheapest = (Object.keys(UNITS) as UnitId[])
      .filter((u) => trainerFor(state, u) !== undefined)
      .sort((a, b) => UNITS[a].power - UNITS[b].power)[0];
    if (!cheapest) break;
    if (armyPower(state) + UNITS[cheapest].power > maxArmyPower(state)) break;
    if (trainUnit(state, cheapest, t) !== 'Queued') break;
    acted = true;
  }

  // Answer every party waiting at a checkpoint: press on while the party is
  // healthy and there is more ruin below, otherwise come home with the haul.
  for (const delve of [...state.delves]) {
    if (delve.phase !== 'checkpoint') continue;
    const healthy = delve.partyHp > delve.maxPartyHp / 2;
    const deeper = delve.depth < RUINS[delve.ruinId].maxDepth;
    if (healthy && deeper) pushDeeper(state, delve.id, t);
    else { extract(state, delve.id); extracted += 1; }
    acted = true;
  }

  // Send whoever is free at whatever is open, biggest party the cap allows.
  for (const heroId of freeHeroes(state)) {
    const busy = new Set(state.delves.map((d) => d.ruinId));
    const ruin = discoveredRuins(state, map).find((r) => !busy.has(r));
    if (!ruin) break;
    const roster = availableRoster(state);
    const best = (Object.keys(roster) as UnitId[])
      .filter((u) => roster[u] > 0)
      .sort((a, b) => UNITS[b].power - UNITS[a].power)[0];
    if (!best) break;
    const room = Math.floor(maxArmyPower(state) / UNITS[best].power);
    const count = Math.max(1, Math.min(roster[best], room));
    if (launchDelve(state, map, ruin, heroId, [{ unitId: best, count }], t) === 'Launched') {
      acted = true;
      launched += 1;
    } else break;
  }

  // 7. Research. FIRST whatever gates the next Townhall level — the card says
  //    "Research Magistracy first" and a player reads it — walking the rows
  //    above it, since a requirement is the row above; THEN the cheapest
  //    thing that can start. Cheapest-first alone never got there: Magistracy
  //    is the 154th-cheapest card of 174, and this player ended thirty days
  //    on Townhall 3 with three thousand Knowledge unspent.
  const nextLevel = townhall(state).level + 1;
  const gate = requiredTechForLevel('Townhall', nextLevel);
  const wanted = new Set<TechId>();
  const want = (id: TechId): void => {
    if (wanted.has(id) || isTechComplete(state, id)) return;
    wanted.add(id);
    for (const above of TECHNOLOGIES[id].requires) want(above);
  };
  if (gate !== null) want(gate);
  // …and the workshops whose goods that level is priced in. The card says
  // "needs Planks"; the build sheet says the Carpenter wants Engineering; a
  // player follows that trail, so the harness does too.
  for (const good of Object.keys(upgradeGoodsCost('Townhall', nextLevel))) {
    const maker = Object.values(DISTRICTS).find((d) => d.produces === good);
    if (maker?.requiredTech) want(maker.requiredTech);
  }
  // A level refused for Harmony wants a decoration, and a decoration wants
  // its card — the cheapest piece's first.
  if (needs.harmony) {
    for (const id of DECORATIONS) {
      const def = DISTRICTS[id];
      if (def.requiredTech && maxCountForTownhallLevel(def, townhall(state).level) > 0) {
        want(def.requiredTech);
      }
    }
  }
  // Half the purse is the tree's for this visit; the other half stays for fog
  // and buildings. Without a budget a chained researcher spends the opening's
  // fifty Gold on cards and never buys a house.
  let budget = getWallet(state.city.wallet, 'Gold') / 2;
  for (let i = 0; i < 40; i++) {
    const byCost = (a: TechId, b: TechId) => techCost(a) - techCost(b);
    const startable = TECH_ORDER.filter((id) => canStartTech(state, id));
    const next = startable.filter((id) => wanted.has(id)).sort(byCost)[0]
      ?? startable.sort(byCost)[0];
    if (!next || techCost(next) > budget) break;
    if (startTech(state, next, t) !== 'Started') break;
    budget -= techCost(next);
    acted = true;
    // A short card finishes while the player is still here, and the next one
    // is started in the same sitting. A long one is left running.
    const doneMs = TECHNOLOGIES[next].durationSeconds * 1000;
    if (t + doneMs - now > VISIT_MS) break;
    tick(doneMs);
  }

  // 8. Claim an affordable landmark: Mana capacity and the research clock.
  for (const lm of visibleLandmarks(state, map)) {
    if (lm.defended || isLandmarkClaimed(state, lm.id)) continue;
    if (claimLandmark(state, map, lm.location) === 'Claimed') acted = true;
  }

  // 9. Push the border with what is left: the cheapest reachable cells.
  let fogTaps = 0;
  for (let i = 0; fogTaps < FOG_TAPS_PER_VISIT; i++) {
    const next = map.cells
      .filter((c) => fogState(state, map, c) === 'Discovered'
        && isReachable(state, map, c) && explorationGate(map, c) === null)
      .sort((a, b) => revealCostForCell(state, map, a) - revealCostForCell(state, map, b))[0];
    if (!next) break;
    let r: string = 'Paid';
    while (r === 'Paid' && fogTaps++ < FOG_TAPS_PER_VISIT) r = revealTap(state, map, next);
    if (r !== 'Revealed') break;
    acted = true;
  }

  return { acted, until: t };
}

/** The real offline path: save at `from`, load at `to`. */
function comeBack(state: GameState, from: number, to: number): GameState {
  const loaded = deserialize(serialize(state, from), map, to);
  expect(loaded, 'the save did not load').not.toBeNull();
  return loaded!;
}

describe.skipIf(!process.env.KINGDOM_HARNESS)('thirty days of the builder', () => {
  it('plays thirty days, three visits a day, on nothing but what the game gives', () => {
    let state = newGame(map, T0);
    state.seed = TEST_SEED;
    choosePayerProfile(state, 'Dolphin', T0);
    const dayStart = Date.parse('2026-08-21T00:00:00Z'); // the morning after T0
    let last = T0;
    const weeks: WeekRow[] = [];
    let idleDays = 0;
    let idleInWeek = 0;
    launched = 0; extracted = 0;

    // THE DAY each Townhall level, and each technology that gates one, was
    // first seen standing — the pacing table step 7 is measured against
    // (Docs/plans/builder-30-days.md §7). Printed with the weeks.
    const milestones: Record<string, number> = {};
    const early: Array<Record<string, number>> = [];
    for (let day = 0; day < DAYS; day++) {
      let actedToday = false;
      for (const hour of VISIT_HOURS) {
        const now = dayStart + day * DAY + hour * 3_600_000;
        state = comeBack(state, last, now);
        const visit = playVisit(state, now);
        if (visit.acted) actedToday = true;
        // The visit lasts at least a minute of sim time, and as long as the
        // research it sat through. Never advance BACKWARDS over that.
        last = Math.max(visit.until, now + 60_000);
        advance(state, map, last);
      }
      const inProgress = state.city.queue.length > 0 || state.research.active.length > 0;
      if (!actedToday && !inProgress) { idleDays++; idleInWeek++; }
      for (let l = 1; l <= townhall(state).level; l++) milestones[`TH${l}`] ??= day + 1;
      for (const level of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        const gate = requiredTechForLevel('Townhall', level);
        if (gate !== null && isTechComplete(state, gate)) milestones[gate] ??= day + 1;
      }
      for (const d of state.city.districts) {
        if (isWorkshop(d) && d.state === 'Built') milestones[d.definitionId] ??= day + 1;
      }
      // …and the cards that open the makers and the pieces, so a level that
      // waits on a good or on Harmony says which card it was waiting for.
      for (const def of Object.values(DISTRICTS)) {
        if ((def.produces !== null || def.harmonySupply > 0) && def.requiredTech !== null
          && isTechComplete(state, def.requiredTech)) milestones[def.requiredTech] ??= day + 1;
      }

      if (day < 7) {
        early.push({
          day: day + 1,
          knowledge: Math.round(getWallet(state.kingdom.wallet, 'Knowledge')),
          revealed: map.cells.filter((c) => fogState(state, map, c) === 'Revealed').length,
          techs: state.research.completed.length,
        });
      }
      if ((day + 1) % 7 === 0 || day === DAYS - 1) {
        weeks.push({
          week: Math.floor(day / 7) + 1,
          townhall: townhall(state).level,
          population: state.city.population,
          roofs: maxPopulation(state),
          food: Math.round(getWallet(state.city.wallet, 'Food')),
          districts: state.city.districts.length,
          maxed: state.city.districts.filter((d) => d.level >= DISTRICTS[d.definitionId].maxLevel).length,
          // `maxed` says how much of the city has nothing left to buy;
          // `levels` says how much was bought at all, which is the column the
          // builder programme moves (Docs/plans/builder-30-days.md §4).
          levels: state.city.districts.reduce((n, d) => n + d.level, 0),
          techs: state.research.completed.length,
          gold: Math.round(getWallet(state.city.wallet, 'Gold')),
          knowledge: Math.round(getWallet(state.kingdom.wallet, 'Knowledge')),
          army: maxArmyPower(state),
          // Supply over demand. Both stay 0 until the Townhall ladder past 4
          // lands: the first piece opens at TH5 and the first level that
          // demands any is 8 (Docs/features/18-harmony.md).
          harmony: `${harmonySupply(state)}/${harmonyDemand(state)}`,
          ruins: Object.keys(state.ruinsCleared).length,
          landmarks: Object.keys(state.landmarks.claimed).length,
          idleDays: idleInWeek,
        });
        idleInWeek = 0;
      }
    }

    // eslint-disable-next-line no-console
    console.table(weeks);
    // eslint-disable-next-line no-console
    console.log('first seen on day:', JSON.stringify(milestones));
    if (process.env.KINGDOM_TRACE) {
      const th = townhall(state);
      // eslint-disable-next-line no-console
      console.log('DAY30', JSON.stringify({
        goods: state.city.goods, mana: mana(state), pop: state.city.population,
        idle: availableWorkers(state),
        th: upgradeDistrict(state, th.uniqueId),
        harmony: harmonyBlock(state, DISTRICTS.Townhall, th.level + 1, th),
        shops: state.city.districts.filter((d) => isWorkshop(d)).map((d) => ({
          id: d.definitionId, crew: d.assignedWorkers, lvl: d.level,

        })),
        queue: state.city.queue.map((q) => `${q.kind}:${q.districtUniqueId}`),
        builders: state.kingdom.builders,
      }));
    }
    // eslint-disable-next-line no-console
    console.table(early);
    // eslint-disable-next-line no-console
    console.log('ruins', discoveredRuins(state, map).length, 'of', Object.keys(RUINS).length,
      'discovered;', Object.keys(state.ruinsCleared).length, 'cleared; deepest',
      state.deepestDepth,
      '| landmarks visible', visibleLandmarks(state, map).length,
      'defended', visibleLandmarks(state, map).filter((l) => l.defended).length,
      'claimed', Object.keys(state.landmarks.claimed).length,
      '| launched', launched, 'extracted', extracted,
      '| revealed cells', map.cells.filter((c) => fogState(state, map, c) === 'Revealed').length,
      'of', map.cells.length);

    // The city never goes backwards, and no save was lost on the way.
    for (let i = 1; i < weeks.length; i++) {
      expect(weeks[i].townhall).toBeGreaterThanOrEqual(weeks[i - 1].townhall);
    }

    // ---- The baseline the builder programme exists to move ----------------
    // Docs/plans/builder-30-days.md §1. Every one of these is a MEASUREMENT of
    // today's game, not a target: re-pin them as each step lands.
    const end = weeks[weeks.length - 1];
    const prev = weeks[weeks.length - 2];

    // 1. THE PACING TABLE (Docs/plans/builder-30-days.md §7), as the day each
    //    Townhall level has to be standing by. The design's days are
    //    orientative, so each bound carries a few days of slack; the two
    //    lower bounds keep the ladder from collapsing into a week. Measured
    //    2026-09-08: 2 · 3 · 7 · 9 · 9 · 11 · 14 · 21 · 25.
    const noLaterThan: Record<string, number> = {
      TH2: 3, TH3: 4, TH4: 8, TH5: 10, TH6: 13, TH7: 17, TH8: 23, TH9: 27, TH10: 30,
    };
    for (const [level, day] of Object.entries(noLaterThan)) {
      expect(milestones[level], `${level} was never reached`).toBeDefined();
      expect(milestones[level], `${level} first stood on day`).toBeLessThanOrEqual(day);
    }
    expect(milestones.TH8, 'TH8 comes in the third week, not the second').toBeGreaterThanOrEqual(10);
    expect(milestones.TH10, 'TH10 is the month\'s last week, not its middle').toBeGreaterThanOrEqual(18);
    expect(end.townhall).toBe(DISTRICTS.Townhall.maxLevel);

    // 2. THE PURSE IS NOW WHAT PACES EXPLORING, and this is the measurement
    //    that says so. The player used to end on millions of idle Gold
    //    because clearing fog was rationed by the thumb — one tap a Gold, so
    //    a distance-9 cell was 320 presses. A cell is five taps at every ring
    //    now (01-map-and-fog.md §5) and the rings from 4 out are five times
    //    dearer, so the ground absorbs the surplus instead: 17,860 in hand at
    //    day 30, against a tree costing 518,955.
    //
    //    The bound is an upper one for that reason. This bot reserves half
    //    each visit for the tree and spends the rest on the border, so what
    //    it holds at the end is what the frontier could not take — and a
    //    million idle Gold would mean the sink stopped draining again.
    expect(end.gold, 'Gold in hand at day 30').toBeLessThan(100_000);

    // 4. The ground still starves, and now it starves on money. A player at
    //    the designed session length uncovers about half the province in a
    //    month — 715 of 1,470 cells, measured with the five-tap fog — so they
    //    still meet only some of the ruins and landmarks the Knowledge drip
    //    is made of, and the drip is what the late city is gated behind.
    const revealed = map.cells.filter((c) => fogState(state, map, c) === 'Revealed').length;
    expect(revealed / map.cells.length, 'share of the province uncovered by day 30')
      .toBeLessThan(0.55);
    expect(end.ruins, 'ruins cleared by day 30').toBeLessThan(3);
    expect(end.landmarks, 'landmarks claimed by day 30').toBeLessThanOrEqual(5);
    expect(end.knowledge, 'Knowledge in hand at day 30').toBeLessThan(10_000);

    // 5. The late weeks still buy levels, and the ladder reaches its top:
    //    with the Townhall at 10 the goods wall from level 6 is a wall the
    //    player actually climbs, on every building that has one.
    expect(end.levels, 'levels bought in the last week').toBeGreaterThan(prev.levels);
    const deepest = Math.max(...state.city.districts.map((d) => d.level));
    expect(deepest, 'the highest level any building reached').toBe(10);
    expect(requiredTownhallLevel('Sawmill', LATE_FROM), 'what the sixth level asks for')
      .toBeLessThanOrEqual(end.townhall);
    expect(Object.keys(upgradeGoodsCost('Sawmill', LATE_FROM)).length,
      'the goods wall is authored, and climbed')
      .toBeGreaterThan(0);
  }, 120_000);
});
