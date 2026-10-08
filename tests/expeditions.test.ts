// Combat as a scoring pass, the army that fights it, and the lair a party is
// sent at (Docs/proposals/lairs.md §5, Docs/features/combat.md).
//
// A lair is one fight, resolved on entry, cleared once. What
// these tests protect is the party around it — the type chart, the army cap,
// the training lines — and the two things a lair attack spends and pays that
// are not the garrison's own clock: the supplies, and the first-clear lump.
import { describe, expect, it } from 'vitest';
import {
  armyCap, finishLineWithGems, lineFor, lineRemainingSeconds, lineRushCost, trainUnit,
} from '../src/sim/army';
import { BEATS, typeMultiplier } from '../src/sim/combat';
import { buildBoard, resolveBattle } from '../src/sim/battle';
import { grantArtifactLevel } from '../src/sim/artifacts';
import { advance } from '../src/sim/commands';
import {
  ARMY, COMBAT, DELVE, DISTRICTS, KNOWLEDGE, LANDMARKS, LAIRS, LAIR_ORDER, UNITS,
} from '../src/sim/data/definitions';
import {
  attackLair, claimLair, lairBlock, lairSupplyCost, previewLair,
} from '../src/sim/expeditions';
import { claimLandmark } from '../src/sim/landmarks';
import { firstClearLump, knowledgePerHour, landmarkClaimLump } from '../src/sim/knowledge';
import {
  getWallet, townhall, type GameState, type UnitId,
} from '../src/sim/state';
import {
  addAllTrainers, addBuilt, completeTech, freshGame, fund, map, clearLair, reveal, T0, rentStored, toLastFight } from './helpers';

const ORCS = 'Orcs' as const;

/** A kingdom with a company under arms, the orc lair in view and it
 *  STANDING — armed but not counting, so a test is about the fight and not
 *  the clock (tests/lairs.test.ts owns the clock). */
function readyToDelve(units: Partial<Record<UnitId, number>> = { Warrior: 60 }): GameState {
  const state = freshGame();
  addAllTrainers(state);
  fund(state, { Gold: 5000, Food: 2000, Wood: 2000, Stone: 500, Iron: 500 });
  reveal(state, [LAIRS[ORCS].location]);
  state.lairs[ORCS] = { armedAt: 0, nextRaidAt: null, hoard: {}, defeated: false, cleared: false };
  for (const [unitId, n] of Object.entries(units)) {
    for (let i = 0; i < n!; i++) {
      state.army.push({ uniqueId: `u_${unitId}_${i}`, definitionId: unitId as UnitId });
    }
  }
  return state;
}


describe('the type chart', () => {
  it('is a cycle, and nothing beats itself', () => {
    const seen = new Set<UnitId>();
    let cursor: UnitId = 'Warrior';
    for (let i = 0; i < 4; i++) {
      expect(seen.has(cursor)).toBe(false);
      seen.add(cursor);
      expect(BEATS[cursor]).not.toBe(cursor);
      cursor = BEATS[cursor];
    }
    expect(cursor).toBe('Warrior'); // back where it started
  });

  it('is soft on purpose — one bad guess is a worse trip, not a wasted one', () => {
    expect(typeMultiplier('Lancer', 'Cavalry')).toBe(ARMY.typeAdvantage);
    expect(typeMultiplier('Cavalry', 'Lancer')).toBe(ARMY.typeDisadvantage);
    expect(typeMultiplier('Lancer', 'Archer')).toBe(1);
    // A lair that answers to nothing in particular is always neutral.
    expect(typeMultiplier('Lancer', 'Any')).toBe(1);
    expect(ARMY.typeAdvantage).toBeLessThanOrEqual(1.5);
    expect(ARMY.typeDisadvantage).toBeGreaterThanOrEqual(0.75);
  });

  it('does its work inside the FIGHT, on the swing (§7)', () => {
    // Four Lancers against a Cavalry squad and against an Archer one: the
    // same troops, the same swing, three halves against a quarter less.
    const swing = (against: UnitId): number => {
      const log = resolveBattle(
        buildBoard([{ unitId: 'Lancer', count: 4 }], []),
        buildBoard([{ unitId: against, count: 4 }], []),
      );
      const first = log.events.find((e) => e.kind === 'attack' && e.from.side === 'ours');
      return first?.kind === 'attack' ? first.dealt : 0;
    };
    // Lancer beats Cavalry, loses to Warrior, and is neutral to an Archer.
    expect(swing('Cavalry')).toBeGreaterThan(swing('Archer'));
    expect(swing('Warrior')).toBeLessThan(swing('Archer'));
  });
});

describe('unit stats make a real trade', () => {
  it('Archers buy reach, Warriors buy survival — neither is right alone', () => {
    const archer = UNITS.Archer;
    const warrior = UNITS.Warrior;
    // An archer line puts more troops in range of the enemy than any other
    // type; a warrior line outlasts it.
    expect(archer.frontage).toBeGreaterThan(warrior.frontage);
    expect(warrior.hp).toBeGreaterThan(archer.hp);
    expect(warrior.def).toBeGreaterThan(archer.def);
  });

  it('prices POWER apart from damage, because they answer different questions', () => {
    // `power` is what a troop costs against the army cap and what a room's
    // budget is written in; `dmg` is what it hits for. They were one number
    // while combat was a scoring pass, and the resolver made them two
    // (Docs/features/combat.md §5, §12).
    for (const u of Object.values(UNITS)) {
      expect(u.power).toBeGreaterThan(0);
      expect(u.dmg).toBeGreaterThan(u.power);
      expect(u.frontage).toBeLessThanOrEqual(u.squadSize);
      expect(u.cooldown).toBeGreaterThan(0);
    }
  });
});

describe('the army cap is a city decision', () => {
  it('comes from military buildings, not from the Townhall', () => {
    const state = freshGame();
    expect(armyCap(state)).toBe(0);
    state.city.districts.find((d) => d.definitionId === 'Townhall')!.level = 3;
    expect(armyCap(state)).toBe(0); // levelling the hall buys no soldiers

    addBuilt(state, 'Barracks', { x: 3, y: 2 });
    const perLevel = DISTRICTS.Barracks.armyCapPerLevel;
    expect(armyCap(state)).toBe(perLevel[0]);
    state.city.districts.find((d) => d.definitionId === 'Barracks')!.level = 3;
    expect(armyCap(state)).toBe(perLevel[2]);
  });

  it('holds companies, not pairs: a first hall is a hundred and a half', () => {
    const state = freshGame();
    addBuilt(state, 'Barracks', { x: 3, y: 2 });
    // The number a player reads on their first hall. It used to be six —
    // two Warriors — which is not an army in a game about fielding one.
    expect(armyCap(state)).toBe(150);
    addAllTrainers(state);
    expect(armyCap(state)).toBeGreaterThan(600);
  });

  it('an unfinished building contributes nothing', () => {
    const state = freshGame();
    addBuilt(state, 'Barracks', { x: 3, y: 2 });
    state.city.districts.find((d) => d.definitionId === 'Barracks')!.state = 'UnderConstruction';
    expect(armyCap(state)).toBe(0);
  });
});

describe('training takes time now', () => {
  it('each building runs its own line, in true chronological order', () => {
    const state = readyToDelve({});
    // Pushed by id, not through the chain helper: the chain above Archery
    // carries Drill Yards, which would speed the very clocks under test.
    state.research.completed.push('Warrior', 'Archery');
    // NAMED halls: the Barracks turns out Archers too, so without saying where,
    // all three would join one line and the parallelism this test is about
    // would quietly stop existing.
    const barracks = state.city.districts.find((d) => d.definitionId === 'Barracks')!;
    const grounds = state.city.districts.find((d) => d.definitionId === 'ShootingGrounds')!;
    expect(trainUnit(state, 'Warrior', T0, barracks)).toBe('Queued');
    expect(trainUnit(state, 'Warrior', T0, barracks)).toBe('Queued');
    expect(trainUnit(state, 'Archer', T0, grounds)).toBe('Queued');
    expect(state.army).toHaveLength(0);

    // The Archer (12s) lands before the first Warrior (15s); the SECOND
    // Warrior starts when the first finished, not when the window did.
    advance(state, map, T0 + 13_000);
    expect(state.army.map((u) => u.definitionId)).toEqual(['Archer']);
    advance(state, map, T0 + 16_000);
    expect(state.army).toHaveLength(2);
    advance(state, map, T0 + 31_000);
    expect(state.army).toHaveLength(3);
  });

  it('queued units count against the cap, so the queue is not a loophole', () => {
    const state = readyToDelve({});
    completeTech(state, 'Warrior');
    state.city.districts = state.city.districts.filter(
      (d) => d.definitionId === 'Townhall' || d.definitionId === 'Barracks');
    // A Barracks holds TROOPS, not power: one soldier is one place in it,
    // whatever it is worth in a fight (Docs/features/combat.md §14).
    const cap = armyCap(state);
    expect(cap).toBe(DISTRICTS.Barracks.armyCapPerLevel[0]);
    fund(state, { Gold: 100_000, Wood: 100_000, Food: 100_000 });
    for (let i = 0; i < cap; i++) {
      expect(trainUnit(state, 'Warrior', T0)).toBe('Queued');
    }
    expect(trainUnit(state, 'Warrior', T0)).toBe('ArmyAtCapacity');
  });

  it('one-call replay equals stepped ticking', () => {
    const build = (): GameState => {
      const s = readyToDelve({});
      completeTech(s, 'Warrior');
      for (let i = 0; i < 4; i++) trainUnit(s, 'Warrior', T0);
      return s;
    };
    const oneCall = build();
    advance(oneCall, map, T0 + 200_000);
    const stepped = build();
    for (let t = 1000; t <= 200_000; t += 1000) advance(stepped, map, T0 + t);
    expect(stepped.army.length).toBe(oneCall.army.length);
  });

  it('delivers the whole line during a long absence', () => {
    const state = readyToDelve({});
    completeTech(state, 'Warrior');
    for (let i = 0; i < 2; i++) trainUnit(state, 'Warrior', T0);
    // Through advance(), because that is the path that stamps the head at the
    // CURSOR — advanceArmyTraining on its own stamps at the time it is given,
    // exactly as advanceQueue does, so a raw far-future call starts the line
    // rather than finishing it.
    const report = advance(state, map, T0 + 3_600_000);
    expect(report.trainedUnits).toEqual(['Warrior', 'Warrior']);
    expect(state.city.trainingQueue).toHaveLength(0);
  });
});

// What a lair attack costs (Docs/proposals/lairs.md §5): the tier's
// `garrisons` supplies, discounted by the best Quartermaster in the party and
// and never below 1 of anything it asks for. The tree discounts nothing.
describe('what a lair attack costs', () => {
  const company = [{ unitId: 'Warrior' as UnitId, count: 60 }];

  // No hero discounts a trip: the bonus rule (every bonus climbs) took the
  // Quartermaster's discount with the traits (10-heroes.md §2.5).
  it('is the Mana every attack spends, whatever the lair and whoever leads', () => {
    const state = readyToDelve();
    for (const id of LAIR_ORDER) {
      expect(lairSupplyCost(state, id, ['Warden'])).toEqual({ Mana: COMBAT.fightMana });
      expect(lairSupplyCost(state, id, ['Quartermaster', 'Scout'])).toEqual({ Mana: COMBAT.fightMana });
    }
  });

  it('is what the attempt charges, and what the preview shows', () => {
    const state = readyToDelve();
    state.heroes.owned.push('Quartermaster');
    const heroes = ['Quartermaster'] as const;
    const cost = lairSupplyCost(state, ORCS, [...heroes]);
    expect(previewLair(state, ORCS, [...heroes], company).supplies).toEqual(cost);
    const gold = getWallet(state.city.wallet, 'Gold');
    const mana = getWallet(state.city.wallet, 'Mana');
    toLastFight(state, ORCS);
    const report = attackLair(state, map, ORCS, [...heroes], company);
    expect(report.result).toBe('Cleared');
    expect(report.supplies).toEqual(cost);
    expect(getWallet(state.city.wallet, 'Mana')).toBe(mana - cost.Mana!);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(gold + (report.hoard.Gold ?? 0));
  });

  it('refuses an attempt the city has not the Mana for', () => {
    const state = readyToDelve();
    state.city.wallet.Mana = COMBAT.fightMana - 1;
    expect(lairBlock(state, map, ORCS, ['Warden'], company)).toBe('NotEnoughSupplies');
  });
});

// A relic is the kingdom's or it is on the shelf: nothing carries one into a
// fight (Docs/features/09-relics.md §5).
describe('a relic is no part of a fight', () => {
  const troops = [{ unitId: 'Warrior' as UnitId, count: 60 }];

  it('neither blocks an attempt nor arms one', () => {
    const state = readyToDelve({ Warrior: 60 });
    const bare = previewLair(state, ORCS, ['Warden'], troops);
    grantArtifactLevel(state, 'ForemansSigil');
    expect(lairBlock(state, map, ORCS, ['Warden'], troops)).toBeNull();
    const held = previewLair(state, ORCS, ['Warden'], troops);
    expect(held.attack).toBe(bare.attack);
    expect(held.stats.atk).toBe(bare.stats.atk);
  });
});

// ONE UNIT, ONE HALL. Each building trains exactly one thing and each unit is
// trained in exactly one building (dataRules.ts holds the data to it), so a
// hall's line is always one unit, and a card's training block one batch.
describe('each unit has a hall of its own', () => {
  it('trains every unit in exactly one building, and one unit per building', () => {
    for (const d of Object.values(DISTRICTS)) expect(d.trains.length, d.id).toBeLessThanOrEqual(1);
    const hallOf = (id: UnitId) => Object.values(DISTRICTS).filter((d) => d.trains.includes(id)).map((d) => d.id);
    expect(hallOf('Warrior')).toEqual(['Barracks']);
    expect(hallOf('Lancer')).toEqual(['SpearHall']);
    expect(hallOf('Archer')).toEqual(['ShootingGrounds']);
    expect(hallOf('Cavalry')).toEqual(['Stables']);
  });

  it('queues repeat orders of its one unit into one line, in order', () => {
    const state = readyToDelve({});
    completeTech(state, 'Warrior');
    const barracks = state.city.districts.find((d) => d.definitionId === 'Barracks')!;

    expect(trainUnit(state, 'Warrior', T0, barracks)).toBe('Queued');
    expect(trainUnit(state, 'Warrior', T0, barracks)).toBe('Queued');
    expect(lineFor(state, barracks.uniqueId).map((i) => i.trainee)).toEqual(['Warrior', 'Warrior']);

    // One bench: the first (15s) finishes first, and the second starts only
    // when the slot frees.
    advance(state, map, T0 + 16_000);
    expect(state.army.map((u) => u.definitionId)).toEqual(['Warrior']);
    advance(state, map, T0 + 31_000);
    expect(state.army.map((u) => u.definitionId)).toEqual(['Warrior', 'Warrior']);
  });

  it('refuses a unit the hall does not turn out, even when another hall does', () => {
    const state = readyToDelve({});
    completeTech(state, 'Archery');
    const barracks = state.city.districts.find((d) => d.definitionId === 'Barracks')!;
    expect(trainUnit(state, 'Archer', T0, barracks)).toBe('NoBuilding');
  });

  it('still refuses one whose technology is missing', () => {
    const state = readyToDelve({});
    expect(trainUnit(state, 'Archer', T0)).toBe('TechRequired');
  });
});

// Buying the wait (2026-09-02). The FINISH button on the training card takes
// the WHOLE line, priced at the build queue's rate (`rush.secondsPerGem`) — so
// the player meets one rule for buying time wherever they meet it.
describe('finishing a training line with gems', () => {
  const barracksOf = (state: GameState) =>
    state.city.districts.find((d) => d.definitionId === 'Barracks')!;

  it('prices the bench PLUS everyone behind it', () => {
    const state = readyToDelve({});
    completeTech(state, 'Warrior');
    const hall = barracksOf(state);
    trainUnit(state, 'Warrior', T0, hall); // 15s, started
    trainUnit(state, 'Warrior', T0, hall); // 15s, waiting

    // Five seconds in: 10 left on the bench + a full 15 behind it.
    expect(lineRemainingSeconds(state, hall.uniqueId, T0 + 5_000)).toBe(25);
    expect(lineRushCost(state, hall.uniqueId, T0 + 5_000)).toBe(5); // 25 s at 5 s a Gem
    // ...and it falls as the bench empties.
    expect(lineRushCost(state, hall.uniqueId, T0 + 12_000)).toBe(4); // 18 s
  });

  it('delivers every unit in the line and charges once', () => {
    const state = readyToDelve({});
    completeTech(state, 'Warrior');
    const hall = barracksOf(state);
    trainUnit(state, 'Warrior', T0, hall);
    trainUnit(state, 'Warrior', T0, hall);
    state.player.wallet.Gems = 1000;

    const cost = lineRushCost(state, hall.uniqueId, T0);
    expect(finishLineWithGems(state, hall.uniqueId, T0)).toBe('Success');
    expect(state.army).toHaveLength(2);
    expect(lineFor(state, hall.uniqueId)).toHaveLength(0);
    expect(getWallet(state.player.wallet, 'Gems')).toBe(1000 - cost);

    // And the advance cannot hand them over a second time.
    advance(state, map, T0 + 120_000);
    expect(state.army).toHaveLength(2);
  });

  it('takes only THAT hall, leaving the others training', () => {
    const state = readyToDelve({});
    completeTech(state, 'Warrior');
    completeTech(state, 'Cavalry');
    const hall = barracksOf(state);
    const stables = state.city.districts.find((d) => d.definitionId === 'Stables')!;
    trainUnit(state, 'Warrior', T0, hall);
    trainUnit(state, 'Cavalry', T0, stables);
    state.player.wallet.Gems = 100;

    expect(finishLineWithGems(state, hall.uniqueId, T0)).toBe('Success');
    expect(lineFor(state, stables.uniqueId)).toHaveLength(1); // untouched
    expect(state.army.map((u) => u.definitionId)).toEqual(['Warrior']);
  });

  it('refuses politely, and charges nothing, when the purse is short', () => {
    const state = readyToDelve({});
    completeTech(state, 'Warrior');
    const hall = barracksOf(state);
    trainUnit(state, 'Warrior', T0, hall);
    state.player.wallet.Gems = 0;
    expect(finishLineWithGems(state, hall.uniqueId, T0)).toBe('NotEnoughGems');
    expect(lineFor(state, hall.uniqueId)).toHaveLength(1);
    expect(getWallet(state.player.wallet, 'Gems')).toBe(0);
  });

  it('says so when there is nothing to buy', () => {
    const state = readyToDelve({});
    state.player.wallet.Gems = 100;
    expect(finishLineWithGems(state, barracksOf(state).uniqueId, T0)).toBe('NothingTraining');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(100);
  });

  // A villager bought outright must land by the same path as a waited-for one,
  // or its tax anchor is repriced at the wrong instant.
  it('a rushed villager starts paying tax from the moment it is bought', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', { x: 2, y: 0 });
    fund(state, { Food: 500 });
    state.player.wallet.Gems = 100;
    const hall = townhall(state);
    trainUnit(state, 'Villager', T0, hall);
    state.city.wallet.Gold = 0;
    state.lastAdvance = T0;

    expect(finishLineWithGems(state, hall.uniqueId, T0)).toBe('Success');
    expect(state.city.population).toBe(1);
    advance(state, map, T0 + 60_000);
    expect(rentStored(state)).toBe(30); // a full minute of rent, in the house
  });
});

// Docs/features/07-research.md §3 — the Knowledge bar.
//
// CLAIM: the drip is a fixed 1 an hour that no ground raises; what the ground
// pays is LUMPS, each once — a landmark taken, a lair cleared — into
// the KINGDOM wallet.
describe('Knowledge: a fixed drip, and lumps for the ground', () => {
  it('drips 1 an hour whatever ground has been taken', () => {
    const bare = freshGame();
    const owner = readyToDelve();
    for (const id of LAIR_ORDER) clearLair(owner, id);
    for (const l of LANDMARKS) owner.landmarks.claimed[l.id] = true;
    expect(knowledgePerHour()).toBe(KNOWLEDGE.basePerHour);
    expect(KNOWLEDGE.basePerHour).toBe(1);
    for (const state of [bare, owner]) {
      state.kingdom.wallet.Knowledge = 0;
      state.kingdom.lastKnowledgeAt = T0;
      advance(state, map, T0 + 5 * 3_600_000);
      expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(5);
    }
  });

  it('a claimed landmark pays its lump once, and does not raise the drip', () => {
    const state = freshGame();
    fund(state, { Gold: 1_000_000 });
    const def = LANDMARKS[0];
    reveal(state, [def.location]);
    const held = getWallet(state.kingdom.wallet, 'Knowledge');
    expect(claimLandmark(state, map, def.location)).toBe('Claimed');
    expect(getWallet(state.kingdom.wallet, 'Knowledge'))
      .toBe(held + KNOWLEDGE.landmarkClaimLump);
    expect(landmarkClaimLump(state)).toBe(KNOWLEDGE.landmarkClaimLump);
    // Once: the ground cannot be taken twice.
    expect(claimLandmark(state, map, def.location)).toBe('AlreadyClaimed');
    expect(getWallet(state.kingdom.wallet, 'Knowledge'))
      .toBe(held + KNOWLEDGE.landmarkClaimLump);
    expect(knowledgePerHour()).toBe(KNOWLEDGE.basePerHour);
  });

  it('clearing a lair pays the first-clear lump exactly once', () => {
    const state = readyToDelve({ Warrior: 60 });
    const company = [{ unitId: 'Warrior' as UnitId, count: 60 }];
    const lump = firstClearLump(state);
    expect(lump).toBe(DELVE.firstClearKnowledge);
    const held = getWallet(state.kingdom.wallet, 'Knowledge');
    toLastFight(state, ORCS);
    const report = attackLair(state, map, ORCS, ['Warden'], company);
    expect(report.result).toBe('Cleared');
    expect(report.knowledge).toBe(lump);
    // The fight pays nothing; the claim pays the lump, once.
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(held);
    expect(claimLair(state, ORCS).knowledge).toBe(lump);
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(held + lump);
    expect(claimLair(state, ORCS).result).toBe('AlreadyClaimed');
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(held + lump);
    // Never into the city's purse, which a region reset would take.
    expect(getWallet(state.city.wallet, 'Knowledge')).toBe(0);
    // Once: a cleared lair refuses, and pays nothing for the refusal.
    const again = attackLair(state, map, ORCS, ['Warden'], company);
    expect(again.result).toBe('AlreadyCleared');
    expect(again.knowledge).toBe(0);
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(held + lump);
    expect(knowledgePerHour()).toBe(KNOWLEDGE.basePerHour);
  });

  it('a repulse pays no lump', () => {
    const state = readyToDelve({ Warrior: 2 });
    fund(state, { Gold: 20_000, Food: 5000, Stone: 2000 });
    reveal(state, [LAIRS.Drake.location]);
    state.lairs.Drake = { armedAt: 0, nextRaidAt: null, hoard: {}, defeated: false, cleared: false };
    const held = getWallet(state.kingdom.wallet, 'Knowledge');
    const report = attackLair(state, map, 'Drake', ['Warden'],
      [{ unitId: 'Warrior', count: 2 }]);
    expect(report.result).toBe('Repelled');
    expect(report.knowledge).toBe(0);
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(held);
  });

  // The old "five cleared lairs carry the TREE on a scale of weeks" runway
  // measured a per-hour rate the ground no longer has. How long the tree
  // takes is now the whole economy's question — drip, lumps, quests and
  // purchases together — and it is OQ-13, pending the 30-day harness
  // (tests/thirtyDays.test.ts), not a single-rate sum here.
});
