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
  DISTRICTS, TAP, TECH_ORDER, type DistrictDef,
} from '../src/sim/data/definitions';
import {
  advance, changeWorkers, enqueueBuild, upgradeDistrict,
} from '../src/sim/commands';
import { placementBlock, maxDistrictCount, validPlacementCells } from '../src/sim/districts';
import { explorationGate, fogState, isReachable, revealCostForCell, revealTap } from '../src/sim/fog';
import { collectTap, harvestSourceAt } from '../src/sim/harvest';
import { claimLandmark, isLandmarkClaimed, visibleLandmarks } from '../src/sim/landmarks';
import { mana } from '../src/sim/mana';
import { newGame } from '../src/sim/newGame';
import { availableWorkers, houseTap, housedPopulation, maxPopulation } from '../src/sim/population';
import { activeQuest, claimQuest, isQuestComplete } from '../src/sim/quests';
import { canStartTech, startTech, techCost } from '../src/sim/research';
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
import type { UnitId } from '../src/sim/state';
import {
  coordKey, getWallet, type Coord, type District, type DistrictId, type GameState,
} from '../src/sim/state';
import { map, T0, TEST_SEED } from './helpers';

const DAY = 86_400_000;
/** Thirty, unless a run is being shortened to iterate on the policy itself. */
const DAYS = Number(process.env.KINGDOM_DAYS ?? 30);
/** Three check-ins a day, hours after midnight UTC. The gap 21:00 → 08:00 is
 *  eleven hours, so every night crosses the 8 h offline cap on purpose. */
const VISIT_HOURS = [8, 14, 21];
const TAPS_PER_VISIT = 120; // a thumb budget: Mana runs out first anyway
/** The thumb's budget for FOG, which is what actually paces exploration: the
 *  purse is never the limit (this player ends on millions of Gold), the
 *  tapping is. A visit is ~10 minutes and a tap is half a second, so a
 *  thousand of them is a generous reading of the design's session length. */
const FOG_TAPS_PER_VISIT = 1_000;

/** What the scripted player builds, in the order they reach for it. Each
 *  entry is tried while the count cap, the technology and the purse allow. */
const BUILD_ORDER: DistrictId[] = [
  'Sawmill', 'Housing', 'FarmLands', 'Farm', 'Quarry', 'Market', 'Housing',
  'Sanctum', 'Docks', 'Barracks', 'SpearHall', 'ShootingGrounds', 'Stables',
];

interface WeekRow {
  week: number; townhall: number; population: number; districts: number;
  maxed: number; techs: number; gold: number; knowledge: number;
  army: number; ruins: number; landmarks: number; idleDays: number;
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
function playVisit(state: GameState, now: number): boolean {
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
      if (mana(state) < 1 || taps >= TAPS_PER_VISIT) break;
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

  // 4. Put every free villager to work, lowest-crewed building first.
  for (let i = 0; i < 60 && availableWorkers(state) > 0; i++) {
    const crews = state.city.districts
      .filter((d) => d.state === 'Built' && DISTRICTS[d.definitionId].maxWorkersPerLevel.length > 0)
      .sort((a, b) => a.assignedWorkers - b.assignedWorkers);
    let placed = false;
    for (const d of crews) {
      if (changeWorkers(state, map, d.uniqueId, 1, t) === 'Assigned') { placed = true; acted = true; break; }
    }
    if (!placed) break;
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
  for (let i = 0; i < 12; i++) {
    let started = false;
    const th = townhall(state);
    if (upgradeDistrict(state, th.uniqueId) === 'Started') { started = true; }
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
      for (const d of candidates) {
        const r = upgradeDistrict(state, d.uniqueId);
        if (r === 'Started') { started = true; break; }
        if (r === 'NoBuilderFree') break;
      }
    }
    if (!started) break;
    acted = true;
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

  // 7. Research the cheapest thing that can start.
  for (let i = 0; i < 6; i++) {
    const next = TECH_ORDER.filter((id) => canStartTech(state, id))
      .sort((a, b) => techCost(a) - techCost(b))[0];
    if (!next || startTech(state, next, t) !== 'Started') break;
    acted = true;
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

  return acted;
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

    for (let day = 0; day < DAYS; day++) {
      let actedToday = false;
      for (const hour of VISIT_HOURS) {
        const now = dayStart + day * DAY + hour * 3_600_000;
        state = comeBack(state, last, now);
        if (playVisit(state, now)) actedToday = true;
        last = now + 60_000; // the visit itself lasts a minute of sim time
        advance(state, map, last);
      }
      const inProgress = state.city.queue.length > 0 || state.research.active.length > 0;
      if (!actedToday && !inProgress) { idleDays++; idleInWeek++; }
      if ((day + 1) % 7 === 0 || day === DAYS - 1) {
        weeks.push({
          week: Math.floor(day / 7) + 1,
          townhall: townhall(state).level,
          population: state.city.population,
          districts: state.city.districts.length,
          maxed: state.city.districts.filter((d) => d.level >= DISTRICTS[d.definitionId].maxLevel).length,
          techs: state.research.completed.length,
          gold: Math.round(getWallet(state.city.wallet, 'Gold')),
          knowledge: Math.round(getWallet(state.kingdom.wallet, 'Knowledge')),
          army: maxArmyPower(state),
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

    // 1. The Townhall stalls one level short of its own sheet, and does so in
    //    week 2. Level 4 is Charter III, an era-3 keystone priced in
    //    Knowledge, and Knowledge is territorial — so the late city is behind
    //    the delve half of the game by design (07-research.md §3).
    expect(weeks[0].townhall, 'Townhall at the end of week 1').toBe(2);
    expect(end.townhall, 'Townhall at day 30').toBe(3);
    expect(end.townhall, 'a level still on the sheet, unreached in thirty days')
      .toBeLessThan(DISTRICTS.Townhall.maxLevel);

    // 2. The builder is finished long before the thirty days are: the last
    //    week adds no building at all.
    expect(end.districts, 'buildings added in the last week').toBe(prev.districts);

    // 3. And it is not the purse that stops it — this player ends on millions
    //    with the whole tech tree costing 550,165.
    expect(end.gold, 'Gold in hand at day 30').toBeGreaterThan(10_000_000);

    // 4. What actually starves is the ground. A player at the designed
    //    session length uncovers well under half the province in a month, so
    //    they meet a minority of the ruins and landmarks the Knowledge drip
    //    is made of — and the drip is what the late city is gated behind.
    const revealed = map.cells.filter((c) => fogState(state, map, c) === 'Revealed').length;
    expect(revealed / map.cells.length, 'share of the province uncovered by day 30')
      .toBeLessThan(0.5);
    expect(end.ruins, 'ruins cleared by day 30').toBeLessThan(3);
    expect(end.landmarks, 'landmarks claimed by day 30').toBeLessThan(5);
    expect(end.knowledge, 'Knowledge in hand at day 30').toBeLessThan(10_000);
  }, 120_000);
});
