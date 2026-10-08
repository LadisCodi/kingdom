// EVERY LADDER MOVES SOMETHING — the successor to the source grep, and the
// only coverage **Stonecutting, Big Nets, Iron Picks and Prospecting** have
// anywhere.
//
// A ladder that changes no number a player can see is a ladder the player pays
// for and nothing collects. That can happen without a typo: a stat spelled
// right but aimed at the wrong harvest source, an effect on a card whose
// reader was deleted, a value of 0 saved from the editor. So this walks every
// ladder, rank by rank, and reads **the numbers a player actually meets** —
// what a tap owes, what a house pays, how long a build takes, what a lair
// costs to provision — then asserts that a fully-researched ladder has moved at least
// one of them away from its own rank-0 baseline.
//
// It does NOT assert the amounts. It used to: a frozen fixture of every
// number every ladder moved was the safety net while the 37 minor `line`s
// became declarative `effects`, and it is what proved that rewrite of ~30
// arithmetic expressions moved nothing. The crossing is done, so the fixture
// is gone — from here on those numbers are the BALANCE rather than a promise
// about it, and a fixture regenerated on every rebalance is not a guard.
// `tests/upgrades.test.ts` still pins the amounts that were argued for, one
// readable assertion at a time.

import { describe, expect, it } from 'vitest';
import { getWallet } from '../src/sim/state';
import {
  HARVEST, LANDMARKS, LAIRS, TECHNOLOGIES,
} from '../src/sim/data/definitions';
import { armyCap, healSecondsAt, trainCost, trainSecondsAt, woundedCap, woundedShareFor } from '../src/sim/army';
import { castCost } from '../src/sim/casting';
import { drillOf, lairSupplyCost } from '../src/sim/expeditions';
import { exploreSpeed, explorerSlots, explorerSpeed, revealRadius } from '../src/sim/world/explorers';
import { lootMultiplier, worldHeroXpMultiplier } from '../src/sim/world/loot';
import { scoutPay } from '../src/sim/world/scouting';
import { armyMarchSpeed } from '../src/sim/world/armies';
import { worldImprovementBoost } from '../src/sim/world/boost';
import { decorationHarmony } from '../src/sim/harmony';
import { treasureReward } from '../src/sim/treasures';
import { assignableWorkerLimit, influenceRadius } from '../src/sim/workers';
import { effectiveDiscoverRadius, revealCostForCell } from '../src/sim/fog';
import { landmarkClaimCost } from '../src/sim/landmarks';
import { manaCap, manaProduction } from '../src/sim/mana';
import { firstClearLump, knowledgeLump, landmarkClaimLump } from '../src/sim/knowledge';
import { cityGoldPerMinute, districtCapacity, maxPopulation, ownGoldPerMinute } from '../src/sim/population';
import {
  cityGatherPerSecond, effectiveBuildTimeMultiplier,
  effectiveTaxRate,
  effectiveUnitsPerStrike, effectiveWorkerSpeed, effectiveWorkerStrike, tapDraw,
  tapWorkSeconds, workerStrikeMs,
} from '../src/sim/upgrades';
import { addHeroXp, callStardust } from '../src/sim/heroes';
import { effectiveRecoveryMs, effectiveRespawnMs, effectiveStock } from '../src/sim/harvest';
import { storageCapacity } from '../src/sim/storage';
import { queueCapacity, queuedWorkMs } from '../src/sim/workshops';
import { grantArtifactLevel } from '../src/sim/artifacts';
import type { GameState, HarvestSourceId } from '../src/sim/state';
import {
  addBuilt, bonusLadders, completeRanks, freshGame, fund, ladders, map, clearLair, reveal, T0,
} from './helpers';


/** The cells the probes draw from — one per harvest source that a ladder can
 *  reach, so a mis-targeted abundance effect shows up as the wrong cell
 *  changing. */
const SOURCES: HarvestSourceId[] = [
  'Forest', 'Crops', 'Berries', 'Meat', 'Stone', 'Fish', 'MountainIron', 'MountainGold',
];

/**
 * One state, rich enough that every ladder has something to move.
 *
 * Deliberately fixed and modifier-free: the modifier stack is a later stage of
 * the same pipeline and this is measuring the middle one. `lastAdvance` is set
 * because `resolve()` reads the clock off it.
 */
function probeState(): GameState {
  const state = freshGame();
  fund(state, { Gold: 1_000_000, Wood: 10_000, Food: 10_000, Stone: 10_000 });
  // A city with one of everything the probes ask about.
  addBuilt(state, 'Housing', { x: 3, y: 2 });
  addBuilt(state, 'Housing', { x: 2, y: 3 });
  addBuilt(state, 'Farm', { x: 4, y: 2 });
  addBuilt(state, 'Sawmill', { x: 5, y: 2 });
  addBuilt(state, 'Infirmary', { x: 6, y: 2 });
  addBuilt(state, 'Quarry', { x: 7, y: 2 });
  addBuilt(state, 'Barracks', { x: 8, y: 2 });
  addBuilt(state, 'Sanctum', { x: 9, y: 2 });
  addBuilt(state, 'Carpenter', { x: 10, y: 2 });
  addBuilt(state, 'Docks', { x: 11, y: 2 });
  addBuilt(state, 'Garden', { x: 12, y: 2 });
  state.city.population = 4;
  // Two landmarks held and one lair cleared, so the per-entity drips are not
  // multiplied by zero.
  state.landmarks.claimed = { 'Shrine:1': true, 'Leyspring:1': true };
  clearLair(state, 'Orcs');
  state.heroes.owned = ['Scout'];
  state.army.push({ uniqueId: 'probe_warrior', definitionId: 'Warrior' });
  reveal(state, [LAIRS.Orcs.location]);
  grantArtifactLevel(state, 'VerdantSeal');
  state.modifiers = [];
  state.lastAdvance = T0;
  return state;
}

/** Every player-visible number a ladder could plausibly move. */
function probe(state: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  const put = (key: string, value: number): void => {
    out[key] = Number.isFinite(value) ? value : -1;
  };

  // The thumb and the crew.
  put('tapWorkSeconds', tapWorkSeconds(state));
  put('workerSpeed', effectiveWorkerSpeed(state));
  for (const id of SOURCES) {
    const spec = HARVEST[id];
    put(`unitsPerStrike.${id}`, effectiveUnitsPerStrike(state, spec));
    put(`workerStrike.${id}`, effectiveWorkerStrike(state, spec));
    put(`tapDraw.${id}`, tapDraw(state, spec, 0));
    put(`strikeMs.${id}`, workerStrikeMs(state, spec));
    put(`recoveryMs.${id}`, effectiveRecoveryMs(state, spec, { x: 0, y: 0 }));
    put(`stock.${id}`, effectiveStock(state, map, { x: 0, y: 0 }, spec));
    put(`respawnMs.${id}`, effectiveRespawnMs(state, spec));
  }
  // What a producer's crew does, building by building.
  for (const d of state.city.districts) {
    const source = d.definitionId === 'Farm' ? 'Crops' : d.definitionId === 'Sawmill' ? 'Forest'
      : d.definitionId === 'Quarry' ? 'Stone' : d.definitionId === 'Docks' ? 'Fish' : null;
    if (source === null) continue;
    put(`strikeMs.${d.definitionId}`, workerStrikeMs(state, HARVEST[source], d));
    put(`crewSlots.${d.definitionId}`, assignableWorkerLimit(state, d));
    put(`reach.${d.definitionId}`, influenceRadius(state, d));
  }
  const sawmill = state.city.districts.find((d) => d.definitionId === 'Sawmill') ?? null;
  put('workerStrike.Forest.sawmill', effectiveWorkerStrike(state, HARVEST.Forest, sawmill));
  for (const c of ['Gold', 'Wood', 'Food', 'Stone'] as const) {
    put(`gatherPerSecond.${c}`, cityGatherPerSecond(state, c));
  }

  // The city's own numbers.
  put('buildTimeMultiplier', effectiveBuildTimeMultiplier(state));
  put('taxRate', effectiveTaxRate(state));
  put('cityGoldPerMinute', cityGoldPerMinute(state));
  put('maxPopulation', maxPopulation(state));
  for (const d of state.city.districts) {
    put(`capacity.${d.definitionId}`, districtCapacity(state, d));
    put(`store.${d.definitionId}`, storageCapacity(state, d));
  }
  const th = state.city.districts.find((d) => d.definitionId === 'Townhall')!;
  const barracks = state.city.districts.find((d) => d.definitionId === 'Barracks')!;
  const carpenter = state.city.districts.find((d) => d.definitionId === 'Carpenter')!;
  // Long enough that a 15% step does not round back to the same second.
  put('trainSeconds.Villager', trainSecondsAt(state, th.uniqueId, 'Villager') * 1000);
  for (const u of ['Warrior', 'Lancer', 'Archer', 'Cavalry'] as const) {
    put(`trainMs.${u}`, trainSecondsAt(state, barracks.uniqueId, u));
  }
  put('workshopMs.Planks', queuedWorkMs(state, carpenter, 'Planks'));
  put('workshopQueue.Carpenter', queueCapacity(state, carpenter));
  put('ownGold.Townhall', ownGoldPerMinute(state, th));
  const garden = state.city.districts.find((d) => d.definitionId === 'Garden')!;
  put('harmony.Garden', decorationHarmony(state, garden));
  const infirmary = state.city.districts.find((d) => d.definitionId === 'Infirmary')!;
  put('healSeconds.Warrior10', healSecondsAt(state, infirmary.uniqueId, 'Warrior', 10));
  for (const [c, n] of Object.entries(treasureReward(state, { n: 5, coin: 'Wood' }))) put(`treasure.${c}`, n as number);
  put('woundedCap', woundedCap(state));
  put('callStardust', callStardust(state, 100));

  // The fog. Only the Gold: the taps are five at every ring and nothing in
  // the tree can buy one back.
  put('revealCost.near', revealCostForCell(state, map, { x: 4, y: 0 }));
  put('revealCost.far', revealCostForCell(state, map, { x: 9, y: 6 }));
  put('discoverRadius.1', effectiveDiscoverRadius(state, 1));
  put('discoverRadius.3', effectiveDiscoverRadius(state, 3));

  // Mana, Knowledge, landmarks.
  put('manaProduction', manaProduction(state));
  put('manaCap', manaCap(state));
  // Knowledge from the ground is lumps; a hundred is big enough that a 5%
  // rank does not round away.
  put('knowledge.landmarkClaimLump', landmarkClaimLump(state));
  put('knowledge.firstClearLump', firstClearLump(state));
  put('knowledge.lump100', knowledgeLump(state, 100));
  put('castCost.VerdantSeal', castCost(state, 'VerdantSeal'));
  put('claimCost', landmarkClaimCost(state, LANDMARKS[0]));

  // The army and the delve.
  put('armyCap', armyCap(state));
  const warrior = trainCost(state, 'Warrior');
  for (const [c, n] of Object.entries(warrior)) put(`trainCost.Warrior.${c}`, n as number);
  // The deepest lair's supplies: big enough that a 5% rank does not round
  // away.
  const supplies = lairSupplyCost(state, 'Drake', []);
  for (const [c, n] of Object.entries(supplies)) put(`supplyCost.${c}`, n as number);
  // What a fight gives back: the share of the fallen that reaches a bed
  // (Docs/features/combat.md §4). Probed without heroes, so this is the
  // TREE's half of the number.
  put('woundedShare', woundedShareFor(state));
  const drill = drillOf(state);
  put('drill.atk.all', drill.atk.all ?? 0);
  put('drill.atk.Distance', drill.atk.Distance ?? 0);
  put('drill.def.all', drill.def.all ?? 0);
  put('drill.def.Melee', drill.def.Melee ?? 0);
  put('drill.def.Mounted', drill.def.Mounted ?? 0);
  put('drill.disadvantageOffset', drill.disadvantageOffset);
  for (const tag of ['all', 'Melee', 'Distance', 'Mounted'] as const) {
    put(`drill.atkPct.${tag}`, drill.atkPct?.[tag] ?? 0);
    put(`drill.defPct.${tag}`, drill.defPct?.[tag] ?? 0);
  }
  put('drill.hpMult', drill.hpMult);

  // The hero, measured as the XP one delve pays. Read on a COPY: a probe must
  // not be the thing that changes the state it is measuring.
  const before = getWallet(state.kingdom.wallet, 'HeroXp');
  addHeroXp(state, 100);
  put('heroXp.per100', getWallet(state.kingdom.wallet, 'HeroXp') - before);
  state.kingdom.wallet.HeroXp = before;

  // The world board.
  put('explorerSlots', explorerSlots(state));
  put('worldRevealRadius', revealRadius(state));
  put('explorerSpeed', explorerSpeed(state));
  put('armyMarchSpeed', armyMarchSpeed(state));
  const boost = worldImprovementBoost(state);
  put('improvement.produce', boost.produce);
  put('improvement.store', boost.store);
  for (const [d, m] of Object.entries(boost.districts ?? {})) {
    put(`improvement.${d}.produce`, m.produce);
    put(`improvement.${d}.store`, m.store);
  }
  put('world.build', boost.build ?? 1);
  put('world.repair', boost.repair ?? 1);
  put('world.fortresses', boost.fortresses ?? 0);
  put('world.chapels', boost.chapels ?? 0);
  put('exploreSpeed', exploreSpeed(state));
  for (const from of ['camp', 'room', 'portal'] as const) put(`loot.${from}`, lootMultiplier(state, from));
  put('loot.heroXp', worldHeroXpMultiplier(state));
  put('scout.gold', scoutPay(state, { reward: 'Stardust', weight: 1, amount: 100, pack: null }, 'outer').wallet.Stardust ?? 0);

  // A control that no ladder may move: what a lair fields, which is authored
  // and belongs to nobody's ladder.
  put('control.lairPower', LAIRS.Orcs.guard.power);
  return out;
}

/** What one ladder moves, rank by rank: only the probes that differ from its
 *  own rank-0 baseline. */
function ladderDiffs(line: string): Record<string, Record<string, number>> {
  const baseline = probe(probeState());
  const out: Record<string, Record<string, number>> = {};
  for (let rank = 1; rank <= ladders[line].length; rank++) {
    const state = probeState();
    completeRanks(state, line, rank);
    const after = probe(state);
    const diff: Record<string, number> = {};
    for (const [key, value] of Object.entries(after)) {
      if (value !== baseline[key]) diff[key] = value;
    }
    out[String(rank)] = diff;
  }
  return out;
}

/** Every ladder's movements, keyed `ladder → rank → probe → value`. */
const movements = (): Record<string, Record<string, Record<string, number>>> => {
  const out: Record<string, Record<string, Record<string, number>>> = {};
  for (const ladder of bonusLadders) out[ladder] = ladderDiffs(ladder);
  return out;
};

describe('every rank ladder in the tree', () => {
  /**
   * Ladders whose RULE was retired and whose cards have not been repointed
   * yet. Each one is a promise on a card the sim cannot keep, so the list is
   * debt, not an exemption — and it is here, in the guard, so it cannot be
   * forgotten (Docs/implementation-plan.md H8).
   *
   * `Bearers` bought back part of a failed delve's haul, and `Pathfinders`
   * hurried a depth's clock. The room model has neither: a failed room grants
   * nothing and deducts nothing, and a room resolves the instant it is
   * entered (Docs/features/11-expeditions.md §5).
   *
   * `Prospecting` raised the Stardust a ROOM paid, and the rooms were retired
   * with the depths: `stardustYield` has no reader (Docs/open-questions.md
   * OQ-113).
   */
  const RETIRED_RULES: string[] = [];

  it('moves at least one number a player can see', () => {
    const moved = movements();
    const inert = bonusLadders.filter((ladder) => {
      if (RETIRED_RULES.includes(ladder)) return false;
      const top = String(ladders[ladder].length);
      return Object.keys(moved[ladder][top] ?? {}).length === 0;
    });
    expect(inert, 'these ladders move nothing at full rank').toEqual([]);
  });

  // Asserted at FULL rank, not at every rank: a 5% rank on a small number
  // can round back to the same integer, and a per-rank guard would need an
  // exception list for rounding.

  it('is a chain of bonuses, so the stems above mean what they say', () => {
    for (const ladder of bonusLadders) {
      for (const id of ladders[ladder]) {
        expect(TECHNOLOGIES[id].kind, `${id} is not a bonus`).toBe('bonus');
        expect(TECHNOLOGIES[id].effects, `${id} moves nothing`).not.toHaveLength(0);
      }
    }
  });
});
